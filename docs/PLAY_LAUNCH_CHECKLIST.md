# Play launch checklist (Talentia)

Use this after the Android `.aab` is built. Code blockers from the July 2026 audit are addressed in-repo; remaining items are **ops**.

## 1. Deploy legal pages (required for Data Safety)

**Full Vercel deploy guide:** [`docs/PROXY_VERCEL_DEPLOY.md`](./PROXY_VERCEL_DEPLOY.md)

Proxy must serve:

- `https://YOUR_PROXY/privacy`
- `https://YOUR_PROXY/terms`
- `https://YOUR_PROXY/api/ping` (health)

Mobile EAS Secrets (override placeholders in `talentia-mobile/eas.json`):

```env
EXPO_PUBLIC_LEGAL_BASE_URL=https://YOUR_PROXY
EXPO_PUBLIC_BACKEND_URL=https://YOUR_PROXY
```

Verify in a browser before submitting to Play.

## 2. Supabase migrations

Apply in order, including:

- `20260724120000_parental_consent.sql`
- `20260724230000_profiles_consent_required.sql` (CHECK: named profile requires consent)

**Before production apply of `20260724230000`:** run the preflight queries in
[`supabase/migrations/20260724230000_profiles_consent_required.preflight.sql`](../supabase/migrations/20260724230000_profiles_consent_required.preflight.sql).
The migration backfills existing named profiles (`guardian_attested=true`,
`parental_consent_at=COALESCE(...)`), then adds `profiles_consent_when_named`.
After apply, `named_without_consent` must be `0`. Optional verify:
`npm run verify:consent-constraint` in `talentia-mobile` (needs service role).

## 3. Google Play Data Safety (copy-paste form text)

Align with [`talentia-ai-proxy-next/src/app/privacy/page.tsx`](../talentia-ai-proxy-next/src/app/privacy/page.tsx).

**Does your app collect or share any of the required user data types?** Yes.

| Data type | Collected | Shared | Encrypted in transit | Purpose | Notes for “Why collected” field |
|-----------|-----------|--------|----------------------|---------|----------------------------------|
| **Email address** | Yes | No (processor: Supabase) | Yes | Account management | Parent/guardian account sign-in and account recovery. Stored in Supabase Auth. |
| **Name** | Yes | No (processor: Supabase) | Yes | App functionality / Personalization | Child first name or nickname on profile — not legal name or date of birth. |
| **App interactions** | Yes | No (processor: Supabase) | Yes | App functionality | Lesson completion, stars, XP, streaks, task-level analytics (no child name in analytics rows). |
| **Other user-generated content** (chat text) | Yes | Yes → DeepSeek | Yes | App functionality | Tali AI companion: text sent per request; keyword safety filters on proxy; **not stored in our database**. |
| **Audio** | Yes (transcript only) | Yes → DeepSeek (as text) | Yes | App functionality | Microphone for on-device speech recognition; **we do not upload raw audio** to our DB. Transcript text may be sent to Tali when the child uses voice answers. |
| **Crash logs** (optional) | If Sentry enabled | Yes → Sentry | Yes | Analytics / Stability | Device/app metadata for error diagnosis; optional, no lesson chat content by design. |

**Additional declarations:**

- **Data sold:** No  
- **Used for advertising / marketing:** No  
- **Ephemeral processing:** Chat text processed per request, not persisted in Talentia DB  
- **Required vs optional:** Email required for account; voice/chat optional features  
- **Privacy policy URL:** `https://YOUR_PROXY/privacy`  
- **Data deletion:** In-app Settings → Delete account (`POST /api/account/delete`); cascades cloud profile/progress  

**Not collected:** precise location, photos/videos, contacts, financial info, advertising ID, push notification tokens (local scheduled reminders only).

## 4. Families / Designed for Families

**Store listing declaration (English):**

> Designed for children 5–10 with parent supervision. Parent creates account and provides consent. Contains AI learning companion with keyword safety filters (not human moderation).

**Console checklist:**

1. Enroll in **Designed for Families** (or declare child-directed treatment per your Play policy path).  
2. Target age bands: **5–10** (consistent with app copy).  
3. Disclose third parties in Data Safety: **Supabase**, **DeepSeek** (Tali chat), **ElevenLabs / Hugging Face** (TTS if enabled), optional **Sentry**.  
4. Do **not** claim “fully moderated” or “human-reviewed chat” — the app uses prompt rules + **keyword input/output filters** only.  
5. Privacy policy URL must be the **deployed proxy** (`https://YOUR_PROXY/privacy`), not `talentia.app` until that domain serves the same pages.  

## 5. Upload build

- One-time Play developer fee: **$25** (only when you create the developer account)  
- Prefer **Internal testing** first  
- Upload the EAS `.aab` manually if Google Service Account JSON keys are org-blocked  
- Or `eas submit -p android --latest` when a service account is available  

## 6. Smoke test on device

- Signup with parental consent checkboxes  
- Parent setup → map → one lesson  
- Tali chat / hint (safe redirect on blocked words)  
- Settings → Privacy / Terms links open  
- Delete account (or Reset = local wipe only)
