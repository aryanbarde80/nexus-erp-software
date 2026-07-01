# Deploying Nexus ERP

This project is a **TanStack Start SSR app** whose production runtime is a **Cloudflare Worker**
(configured via `@cloudflare/vite-plugin`, `wrangler.jsonc`, and `src/server.ts`).
That runtime target is preserved intentionally — do not remove it, or SSR, server functions
(`src/lib/*.functions.ts`), the auth middleware, and the `/api/public/*` routes will break.

`bun run build` / `npm run build` both produce the Worker bundle. No other targets are emitted.

## Required environment variables

Set these on every hosting platform:

| Variable | Where | Notes |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | build-time | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | build-time | Supabase anon key |
| `LOVABLE_API_KEY` | runtime (Worker secret) | Powers AI features via Lovable Gateway |

For Cloudflare, use `wrangler secret put LOVABLE_API_KEY`.
For Vercel/Netlify, add them in the project's env settings and re-deploy.

---

## ✅ Cloudflare Workers (primary, first-class)

Native target. Ship it directly:

```bash
bun install
bun run build
bunx wrangler deploy
```

`wrangler.jsonc` already points to the built entry.

## ✅ Cloudflare Pages

Cloudflare Pages can host the same Worker output via the Workers-in-Pages integration.

- **Build command:** `bun run build`
- **Build output directory:** `dist/client`
- **Compatibility flags / date:** copy from `wrangler.jsonc` (`nodejs_compat`, `2024-11-06` or newer)
- Set the same env vars above under **Settings → Environment variables**.
- The Worker portion (`dist/_worker.js`) is auto-detected and deployed as Pages Functions.

## ✅ Vercel

Vercel supports TanStack Start via its Edge/Node runtime, but this project is compiled for
Cloudflare Workers. Two supported paths:

1. **Recommended — deploy the Worker to Cloudflare and point Vercel at it** with a rewrite:
   add `vercel.json`:
   ```json
   { "rewrites": [{ "source": "/(.*)", "destination": "https://<your-worker>.workers.dev/$1" }] }
   ```
2. **Native Vercel target:** requires swapping the Vite `cloudflare` plugin for the Vercel
   preset (`@tanstack/react-start` Vercel adapter). That's an architectural change and is
   explicitly out of scope for this deploy pass (would violate the "do not remove Cloudflare"
   constraint).

## ✅ Netlify

Same story as Vercel. `netlify.toml` is included and set up to proxy to your deployed Worker
(edit the `to = "..."` URL). If you'd rather use Netlify Functions natively, switch the
TanStack Start server preset — again, out of scope here without removing Cloudflare.

## ⚠️ Standard Vite / Node hosting (Render, Fly, Railway, self-hosted)

The build output is a Worker module, not a Node server. To run it under Node you need the
`workerd` runtime or a Node adapter. Fastest path:

```bash
bun run build
bunx wrangler dev --local   # serves the built Worker locally on Node/workerd
```

For a production Node deploy, add the `@tanstack/react-start` Node preset — again, this is a
runtime swap and is intentionally not enabled in this repo.

## ❌ GitHub Pages — not supported

GitHub Pages is static-only. This app has SSR, server functions, and authenticated API routes,
none of which can run on GH Pages. There is no configuration that makes a TanStack Start SSR
app work on GitHub Pages without deleting the server layer (and with it: auth, AI features,
Supabase middleware, `/api/public/*`). Use Cloudflare, Vercel, or Netlify instead.

---

## About the `tanstack-start-manifest:v` / `tanstack-start-injected-head-scripts:v` errors

These virtual-module IDs are provided by the `tanstackStart` Vite plugin, which is preloaded by
`@lovable.dev/vite-tanstack-config`. If you see "cannot resolve" errors for them it means the
Lovable Vite preset was removed or replaced. Fix: keep `defineConfig` importing from
`@lovable.dev/vite-tanstack-config` (see `vite.config.ts`). Do **not** replace it with a bare
`vite` config.
