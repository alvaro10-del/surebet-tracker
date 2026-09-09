# surebet-tracker-proxy (Cloudflare Worker)

Proxy que guarda la API key de Anthropic del lado del servidor y la usa para
analizar las capturas que suben los usuarios de la página pública de Surebet
Tracker (GitHub Pages). La página nunca ve la clave real.

Desplegado en: `https://surebet-tracker-proxy.arbitrajetraker.workers.dev`

## Seguridad — leer antes de tocar esto

- La API key de Anthropic vive **solo** como secreto de Cloudflare
  (`ANTHROPIC_API_KEY`). Nunca la pongas en este código ni en `wrangler.toml`.
- `APP_SECRET` **no es un secreto real**: la página pública lo trae en su
  propio código fuente (visible para cualquiera que mire "ver código
  fuente"). Sirve solo para filtrar bots/scrapers que pegan directo contra
  esta URL sin pasar por la página. La protección real es el límite diario
  de pedidos (`DAILY_LIMIT` en `src/index.js`, hoy 50/día), guardado en el
  namespace KV `RATE_LIMIT_KV`.
- `ALLOWED_ORIGIN` en `wrangler.toml` restringe qué sitios pueden llamar a
  este Worker desde un navegador (CORS). Si cambiás el dominio de GitHub
  Pages, actualizalo acá.

## Redeploy

```
cd worker
npx wrangler deploy
```

## Rotar secretos

```
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put APP_SECRET
```

Si cambiás `APP_SECRET`, actualizá también `EXTERNAL_AI_CONFIG.appSecret` en
`Surebet Tracker.html` (raíz del repo) para que coincidan.

## Subir el límite diario

Editá `DAILY_LIMIT` en `src/index.js` y volvé a desplegar.
