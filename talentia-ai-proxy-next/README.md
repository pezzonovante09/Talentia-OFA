# Talentia AI proxy (Next.js)

API routes for the **Talentia** mobile app: Tali (DeepSeek), parent reports, TTS (ElevenLabs / Hugging Face).

## Environment

Copy `.env.example` to `.env.local` and set at least:

| Variable | Purpose |
|----------|---------|
| `DEEPSEEK_API_KEY` | Tali chat (`/api/tali`) |
| `SUPABASE_URL` | Supabase project URL — required to verify user JWTs on `/api/tali`, `/api/tts`, `/api/report*`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key — used server-side only with `auth.getUser(jwt)` and `auth.admin.deleteUser`; never expose to clients. |
| `SUPABASE_ANON_KEY` | Public anon key — `/api/account/delete` calls the database **as the user** (their JWT), so RLS and `transfer_child_ownership` check the rights, not this code. |
| `TALENTIA_API_SECRET` | Optional: when set, `/api/ping` requires header `X-Talentia-Secret`. **Not** used for Tali, TTS, or report routes (those use Supabase JWT). |
| `ALLOWED_CORS_ORIGINS` | Comma-separated list of browser `Origin` values allowed for CORS. Native apps send no Origin — they are not CORS-restricted. |
| `ELEVENLABS_API_KEY` / `ELEVENLABS_VOICE_ID` | TTS (`/api/tts`), языки `ru` / `en` / `ky` (для `ky` — мультиязычный голос; опционально `ELEVENLABS_VOICE_ID_KY`) |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Rate limiting (`src/lib/ratelimit.ts`). **Required in production**: if unset, requests are rejected with 503 instead of running unmetered. Outside production, unset just disables rate limiting (with a console warning). |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Optional error monitoring (`src/instrumentation.ts`, `src/instrumentation-client.ts`). Unset by default — the proxy runs and builds fine without a Sentry account. |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | Optional: only needed to upload source maps / associate releases at build time (`next.config.ts`). |

Mobile app: set `EXPO_PUBLIC_BACKEND_URL` to this deployment’s origin. Authenticated calls send `Authorization: Bearer` from the current Supabase session (`access_token`).

## Abuse prevention

- **Auth**: Supabase JWT on protected routes; optional shared secret for `/api/ping` only (see above).
- **CORS**: no wildcard. Browser origins must be listed in `ALLOWED_CORS_ORIGINS`;
  responses are built in `src/lib/cors-strict.ts` (do **not** set
  `Access-Control-Allow-Origin` via `vercel.json` headers — that would override the
  allowlist with `*` and undo this protection).
- **Rate limit** (`src/lib/ratelimit.ts`, `@upstash/ratelimit` sliding window, per client IP):
  **20 requests/minute** on `/api/tali` and `/api/report*`, **10 requests/minute** on `/api/tts`,
  **3 requests / 10 minutes** on `/api/account/delete`.
  **Fail-closed** in production — if Upstash isn't configured, requests get a 503 instead of
  running unmetered; outside production it fails open with a warning so local dev isn't blocked.
- **Input validation**: every route body is validated with Zod (`src/lib/reportSchemas.ts` and
  per-route schemas in `tali/route.ts` / `tts/route.ts`), with length caps on free-form text to
  bound LLM prompt size/cost.

## Run

```bash
npm install
npm run dev
```

## Lint, typecheck, test, build

```bash
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm test           # Vitest — ratelimit fail-open/closed, Zod schemas
npm run build      # Next.js production build
```

## Verify auth / rate limit (curl)

With `TALENTIA_API_SECRET=mysecret` and `npm run dev` (default port **3000**):

```bash
# 401 — missing secret
curl -s -w "\n%{http_code}\n" http://localhost:3000/api/ping

# 200 — correct secret
curl -s -w "\n%{http_code}\n" -H "X-Talentia-Secret: mysecret" http://localhost:3000/api/ping

# 429 — more than 20 requests/minute on /api/ping (ratelimitApi); TTS POST is 10/min
```

Production deploys assume **Vercel** (trusted `x-vercel-forwarded-for` for rate-limit keys).

## Account deletion — `POST /api/account/delete`

Deletes the calling adult's account (`sub` from the verified JWT only — the body has no
user id). Logic: `src/lib/accountDeletion.ts`; spec: `PARENT.md` in the repo root.

- The body carries a decision for **every** child the caller owns: `delete` or
  `transfer` to an active second guardian. Missing, extra or duplicate decisions → 409,
  nothing happens.
- Transfers run first, as the user (`transfer_child_ownership` under their JWT). If one
  fails, the account is **not** deleted.
- Then `auth.admin.deleteUser(id, false)` — a **hard** delete. Database triggers delete
  the children that were not transferred and pseudonymize the consent and access logs;
  a soft delete would skip them and leave the data.
- The caller must have signed in **with an email code within the last 5 minutes**
  (`signInWithOtp` with `shouldCreateUser: false`, then `verifyOtp`). The route reads the
  time of that sign-in from the JWT `amr` claim — not `iat`, which any session refresh
  renews without the parent. No recent email code → 401.
- Rate limit: 3 / 10 min per IP **and** 3 / hour per user.
- After a 502 with partial success, retry without the children listed in
  `transferred` — they are no longer the caller's.

```json
{ "confirm": "DELETE_MY_ACCOUNT",
  "children": [ { "childId": "…", "action": "transfer", "newOwnerId": "…" },
                { "childId": "…", "action": "delete" } ] }
```

## Consent checks on the server

Anything about a specific child is done **as the user** — `supabaseAsUser(jwt)`
(`src/lib/supabaseUser.ts`) — never with `supabaseAdmin`, which bypasses RLS and would make
a `childId` from the request body the only access check.

Before calling DeepSeek or a voice provider for a child, check consent with
**`hasConsent(asUser, childId, scope)`** (`src/lib/consentCheck.ts`). It calls the database
`has_consent` under the user's JWT: for a child the user has no access to, the answer is
always `false`, so a foreign `childId` cannot "borrow" another child's consent. Any error
means `false`.

`consent_active(child, scope)` is granted to `service_role` only and is for background jobs
that have no user. Never widen `has_consent`'s grants to "fix" a `false`.
