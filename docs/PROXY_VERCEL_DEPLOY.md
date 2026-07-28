# Deploy talentia-ai-proxy-next (Vercel)

Legal pages (`/privacy`, `/terms`) and the mobile API live in this Next.js app. Until it is deployed, `https://talentia.app/privacy` will 404 — the marketing domain does not host these routes.

## Prerequisites

- Vercel account linked to the GitHub repo
- Supabase project URL + service role key
- DeepSeek API key
- Upstash Redis (required in production for rate limiting)

## 1. Create / configure Vercel project

| Setting | Value |
|---------|--------|
| **Root Directory** | `talentia-ai-proxy-next` |
| **Framework** | Next.js (auto-detected) |
| **Node.js** | 24.x (see `package.json` engines) |
| **Production branch** | `master` or your release branch |

`vercel.json` in the proxy folder sets build/install commands; no custom rewrites needed for `/privacy` or `/terms` (App Router pages).

## 2. Environment variables (Vercel → Settings → Environment Variables)

Set for **Production** (and Preview if you test PRs):

| Variable | Required | Notes |
|----------|----------|--------|
| `DEEPSEEK_API_KEY` | Yes | Tali `/api/tali` |
| `SUPABASE_URL` | Yes | JWT verification + consent checks |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only; never in mobile app |
| `UPSTASH_REDIS_REST_URL` | Yes (prod) | Rate limiting; without it prod returns 503 |
| `UPSTASH_REDIS_REST_TOKEN` | Yes (prod) | |
| `ELEVENLABS_API_KEY` | If TTS enabled | `/api/tts` |
| `ELEVENLABS_VOICE_ID` | If TTS enabled | Optional `ELEVENLABS_VOICE_ID_KY` for Kyrgyz |
| `TALENTIA_API_SECRET` | Optional | When set, `/api/ping` requires `X-Talentia-Secret` |
| `ALLOWED_CORS_ORIGINS` | Optional | Browser origins only; native app has no Origin |
| `SENTRY_DSN` | Optional | Error monitoring |

Do **not** set `Access-Control-Allow-Origin: *` in Vercel headers — CORS is handled in `src/lib/cors-strict.ts`.

## 3. Deploy

```bash
# From repo root — CLI optional if Git integration is enabled
cd talentia-ai-proxy-next
vercel --prod
```

Or push to the connected production branch and wait for Vercel build.

**Build must pass:** `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` (Vercel runs build).

## 4. Post-deploy smoke checks

Replace `https://YOUR_PROXY_HOST` with the Vercel production URL (e.g. `https://talentia-ai-proxy.vercel.app` or custom domain `https://api.talentia.app`).

### Legal pages (public, no auth)

```bash
curl -sI "https://YOUR_PROXY_HOST/privacy" | head -1
# Expect: HTTP/2 200

curl -sI "https://YOUR_PROXY_HOST/terms" | head -1
# Expect: HTTP/2 200
```

Open in browser:

- `https://YOUR_PROXY_HOST/privacy` — sections on AsyncStorage, SecureStore, local notifications, AI flow, contact email
- `https://YOUR_PROXY_HOST/terms` — AI disclaimer, contact email

### API health

```bash
# Without TALENTIA_API_SECRET configured:
curl -s "https://YOUR_PROXY_HOST/api/ping"
# Expect: {"ping":true,"at":"..."}

# With TALENTIA_API_SECRET=mysecret:
curl -s -H "X-Talentia-Secret: mysecret" "https://YOUR_PROXY_HOST/api/ping"
```

If `/api/ping` returns 404 or 405, the deployment is stale or the wrong root directory was used.

### Optional: authenticated route (403 without consent)

With a valid Supabase JWT but profile without parental consent, `POST /api/tali` should return `403` and `{ "error": "Parental consent required" }`.

## 5. Point mobile app at the proxy

After smoke checks pass, set EAS Secrets (or `eas.json` env overrides) for **production** builds:

```env
EXPO_PUBLIC_LEGAL_BASE_URL=https://YOUR_PROXY_HOST
EXPO_PUBLIC_BACKEND_URL=https://YOUR_PROXY_HOST
```

Also set in Expo dashboard → Project → Secrets for the same keys.

Rebuild the Android AAB / iOS IPA — env vars are baked at build time.

**Verify on device:** Settings → Privacy / Terms open the deployed URLs; Tali and reports hit the same host.

## 6. Play Console

- **Privacy policy URL:** `https://YOUR_PROXY_HOST/privacy`
- Use [`docs/PLAY_LAUNCH_CHECKLIST.md`](./PLAY_LAUNCH_CHECKLIST.md) for Data Safety and Families text

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| `/privacy` 404 | Wrong Vercel root (must be `talentia-ai-proxy-next`) |
| `/api/ping` 503 | Upstash not configured in production |
| Mobile links still 404 | `EXPO_PUBLIC_LEGAL_BASE_URL` unset → fallback `https://talentia.app` |
| CORS errors in web preview | Add origin to `ALLOWED_CORS_ORIGINS` |
