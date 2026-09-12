/**
 * Surebet Tracker — Anthropic API proxy + shared team storage.
 *
 * Two responsibilities:
 *  1. POST / — holds the Anthropic API key server-side and forwards image
 *     analysis requests from the static Surebet Tracker page.
 *  2. /team/:collection[/:id] — a tiny shared datastore (Cloudflare KV) so two
 *     or more people using the same "team code" see the same bets, bookmakers
 *     and partners instead of each browser's own localStorage.
 *
 * Team code is NOT a strong secret — it's a shared passphrase two teammates
 * pick themselves, sent as the X-Team-Code header. Anyone who knows it can
 * read/write that team's data. That's the intended trust model (like a
 * shared folder link), not bank-grade security.
 */

const DAILY_LIMIT = 50;
const ANTHROPIC_MODEL = "claude-sonnet-5";
const ANTHROPIC_VERSION = "2023-06-01";
const TEAM_COLLECTIONS = ["bets", "bookmakers", "partners"];

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-App-Secret, X-Team-Code",
  };
}

function json(data, status, env) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { ...corsHeaders(env), "Content-Type": "application/json" },
  });
}

function sanitizeTeamCode(raw) {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (!code || code.length > 64) return null;
  return code;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

async function handleTeamRequest(request, env, url) {
  const teamCode = sanitizeTeamCode(request.headers.get("X-Team-Code"));
  if (!teamCode) return json({ error: "invalid_team_code" }, 400, env);
  if (!env.TEAM_DATA) return json({ error: "team_storage_unavailable" }, 503, env);

  const parts = url.pathname.split("/").filter(Boolean); // ["team", collection, id?]
  const collection = parts[1];
  const id = parts[2];
  if (!TEAM_COLLECTIONS.includes(collection)) return json({ error: "unknown_collection" }, 404, env);

  const kvKey = "team:" + teamCode + ":" + collection;

  async function readArr() {
    const raw = await env.TEAM_DATA.get(kvKey);
    if (!raw) return [];
    try { return JSON.parse(raw); } catch (e) { return []; }
  }
  async function writeArr(arr) {
    await env.TEAM_DATA.put(kvKey, JSON.stringify(arr));
  }

  if (request.method === "GET") {
    return json({ items: await readArr() }, 200, env);
  }

  if (request.method === "POST") {
    let body;
    try { body = await request.json(); } catch (e) { return json({ error: "bad_request" }, 400, env); }
    const data = body && body.data;
    if (!data || typeof data !== "object" || Array.isArray(data)) return json({ error: "bad_request" }, 400, env);
    // Re-read right before writing so a concurrent write from the teammate isn't clobbered.
    const arr = await readArr();
    const record = Object.assign({}, data, { id: uid() });
    arr.unshift(record);
    await writeArr(arr);
    return json({ item: record }, 200, env);
  }

  if (request.method === "PUT" && id) {
    let body;
    try { body = await request.json(); } catch (e) { return json({ error: "bad_request" }, 400, env); }
    const patch = body && body.patch;
    const inc = body && body.inc;
    const hasPatch = patch && typeof patch === "object" && !Array.isArray(patch);
    const hasInc = inc && typeof inc === "object" && !Array.isArray(inc);
    if (!hasPatch && !hasInc) return json({ error: "bad_request" }, 400, env);
    // Read-modify-write within one request: increments computed against the
    // freshest value we just read, not one the client may have had stale for a while.
    const arr = await readArr();
    const rec = arr.find((r) => r.id === id);
    if (!rec) return json({ error: "not_found" }, 404, env);
    if (hasPatch) Object.assign(rec, patch);
    if (hasInc) {
      for (const k of Object.keys(inc)) {
        const n = Number(inc[k]);
        if (Number.isFinite(n)) rec[k] = (Number(rec[k]) || 0) + n;
      }
    }
    await writeArr(arr);
    return json({ item: rec }, 200, env);
  }

  if (request.method === "DELETE" && id) {
    const arr = await readArr();
    const next = arr.filter((r) => r.id !== id);
    await writeArr(next);
    return json({ ok: true }, 200, env);
  }

  return json({ error: "method_not_allowed" }, 405, env);
}

async function handleAnalyze(request, env) {
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
        max_tokens: 8000,
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

  console.log(
    "stop_reason:", data.stop_reason,
    "text length:", text.length,
    "usage:", JSON.stringify(data.usage),
    "text tail:", JSON.stringify(text.slice(-300))
  );

  if (!text) {
    return json({ error: "empty_completion" }, 502, env);
  }
  if (data.stop_reason === "max_tokens") {
    return json({ error: "truncated", text }, 502, env);
  }
  return json({ text }, 200, env);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(env) });
    }
    const url = new URL(request.url);
    if (url.pathname.startsWith("/team/")) {
      return handleTeamRequest(request, env, url);
    }
    return handleAnalyze(request, env);
  },
};
