/**
 * Surebet Tracker — Anthropic API proxy.
 *
 * Holds the Anthropic API key server-side (as a Worker secret) and forwards
 * image-analysis requests from the static Surebet Tracker page. The page
 * never sees the real API key.
 *
 * Two layers keep this from being an open, unmetered proxy to your key:
 *  1. A shared "app secret" header the page sends. It lives in the page's
 *     own source, so anyone who reads the page's JS can read it too — this
 *     is NOT a real secret, just a filter against blind/automated scraping
 *     of this URL. Don't treat it as access control.
 *  2. A hard daily request cap (see DAILY_LIMIT below), tracked in a KV
 *     namespace, so the worst case if someone finds the URL and the app
 *     secret is a bounded number of Claude calls per day, not unlimited.
 */

const DAILY_LIMIT = 50;
const ANTHROPIC_MODEL = "claude-sonnet-5";
const ANTHROPIC_VERSION = "2023-06-01";

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-App-Secret",
  };
}

function json(data, status, env) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { ...corsHeaders(env), "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(env) });
    }
    if (request.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405, env);
    }

    const appSecret = request.headers.get("X-App-Secret");
    if (!env.APP_SECRET || appSecret !== env.APP_SECRET) {
      return json({ error: "unauthorized" }, 401, env);
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ error: "bad_request" }, 400, env);
    }

    const prompt = body && body.prompt;
    const images = body && body.images;
    if (!prompt || typeof prompt !== "string" || !Array.isArray(images) || images.length === 0) {
      return json({ error: "bad_request" }, 400, env);
    }
    if (images.length > 6) {
      return json({ error: "too_many_images" }, 400, env);
    }
    for (const img of images) {
      if (!img || typeof img.base64 !== "string" || typeof img.mediaType !== "string") {
        return json({ error: "bad_request" }, 400, env);
      }
      // Rough cap on decoded size per image (~5.5MB base64 ≈ 4MB binary).
      if (img.base64.length > 5_500_000) {
        return json({ error: "image_too_large" }, 400, env);
      }
    }

    // Daily quota, tracked per UTC day in KV.
    const today = new Date().toISOString().slice(0, 10);
    const kvKey = "count:" + today;
    let current = 0;
    if (env.RATE_LIMIT_KV) {
      current = parseInt((await env.RATE_LIMIT_KV.get(kvKey)) || "0", 10);
      if (current >= DAILY_LIMIT) {
        return json({ error: "daily_limit_reached" }, 429, env);
      }
    }

    const content = [
      { type: "text", text: prompt },
      ...images.map((img) => ({
        type: "image",
        source: { type: "base64", media_type: img.mediaType, data: img.base64 },
      })),
    ];

    let anthropicResp;
    try {
      anthropicResp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": ANTHROPIC_VERSION,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: 4096,
          messages: [{ role: "user", content }],
        }),
      });
    } catch (e) {
      console.log("fetch to anthropic threw:", String(e));
      return json({ error: "upstream_error" }, 502, env);
    }

    if (!anthropicResp.ok) {
      let detail = "";
      try { detail = await anthropicResp.text(); } catch (e) {}
      console.log("anthropic non-ok status:", anthropicResp.status, "detail:", detail.slice(0, 800));
      return json({ error: "upstream_error", status: anthropicResp.status, detail: detail.slice(0, 500) }, 502, env);
    }

    const data = await anthropicResp.json();
    const text = (data.content || []).map((b) => b.text || "").join("");

    if (env.RATE_LIMIT_KV) {
      await env.RATE_LIMIT_KV.put(kvKey, String(current + 1), { expirationTtl: 60 * 60 * 24 * 3 });
    }

    if (!text) {
      console.log("empty text. stop_reason:", data.stop_reason, "block types:", (data.content || []).map((b) => b.type), "usage:", JSON.stringify(data.usage));
      return json({ error: "empty_completion" }, 502, env);
    }
    return json({ text }, 200, env);
  },
};
