# Talentia AI proxy (Next.js)

API routes for the **Talentia** mobile app: Tali (DeepSeek), parent reports, TTS (ElevenLabs / Hugging Face).

## Environment

Copy `.env.example` to `.env.local` and set at least:

| Variable | Purpose |
|----------|---------|
| `DEEPSEEK_API_KEY` | Tali chat (`/api/tali`) |
| `TALENTIA_API_SECRET` | When set, all `/api/*` methods except OPTIONS require header `X-Talentia-Secret` with the same value (timing-safe check). **Unset** = no secret check (local dev only). |
| `ALLOWED_CORS_ORIGINS` | Comma-separated list of browser `Origin` values allowed for CORS. Native apps send no Origin — they are not CORS-restricted. |
| `ELEVENLABS_API_KEY` / `ELEVENLABS_VOICE_ID` | TTS (`/api/tts`) |

Mobile app: set `EXPO_PUBLIC_BACKEND_URL` to this deployment’s origin and `EXPO_PUBLIC_TALENTIA_API_SECRET` to match `TALENTIA_API_SECRET`.

## Abuse prevention

- **Shared secret**: `X-Talentia-Secret` (see above).
- **CORS**: no wildcard; browser origins must be listed in `ALLOWED_CORS_ORIGINS`.
- **Rate limit**: Edge middleware — max **60 requests/minute per client IP** (sliding window, in-memory). For global limits on Vercel, migrate to **@upstash/ratelimit + KV** (see `TODO` in `src/middleware.ts` and `src/lib/rate-limit-edge.ts`).

## Run

```bash
npm install
npm run dev
```

## Verify auth / rate limit (curl)

With `TALENTIA_API_SECRET=mysecret` and server on port 3010:

```bash
# 401 — missing secret
curl -s -w "\n%{http_code}\n" http://localhost:3010/api/ping

# 200 — correct secret
curl -s -w "\n%{http_code}\n" -H "X-Talentia-Secret: mysecret" http://localhost:3010/api/ping

# 429 — more than 60 requests in one minute (repeat in a loop)
```
