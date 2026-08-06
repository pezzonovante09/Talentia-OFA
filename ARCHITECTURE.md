# Talentia — Architecture

## System Overview
```
┌─────────────────────────────────────────────────────────┐
│                    Child's Device                        │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │           Expo React Native App                  │   │
│  │                                                  │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │   │
│  │  │  Zustand │  │AsyncStor │  │  i18next     │  │   │
│  │  │  Stores  │  │  (persist│  │  RU/EN/KY    │  │   │
│  │  └────┬─────┘  └──────────┘  └──────────────┘  │   │
│  │       │                                          │   │
│  └───────┼──────────────────────────────────────────┘   │
│          │ sync                                         │
└──────────┼──────────────────────────────────────────────┘
           │
    ┌──────┴──────────────────────────┐
    │                                 │
    ▼                                 ▼
┌─────────────┐               ┌──────────────────────┐
│  Supabase   │               │  Next.js AI Proxy    │
│             │               │  (Vercel)            │
│  auth.users │               │                      │
│  profiles   │               │  /api/tali           │
│  lessons    │◄──────────────│  /api/tts            │
│  tasks      │   JWT auth    │  /api/report         │
│  user_prog  │               │  /api/report/world   │
│  user_stats │               │  /api/report/weekly  │
│  lesson_ana │               │  /api/ping           │
│  aba_live   │               │                      │
│  parent_chi │               │  Rate limit:         │
└─────────────┘               │   Upstash Redis      │
                               │   (fail-closed in    │
                               │   production if      │
                               │   unconfigured)      │
                               │  Validation: Zod on  │
                               │   every route body   │
                               │  Auth: Supabase JWT   │
                               └──────┬────────┬──────┘
                                      │        │
                          Tali chat  ▼        ▼  Text-to-speech
                          ┌──────────────┐  ┌────────────────────────┐
                          │  DeepSeek    │  │  ElevenLabs (primary) /│
                          │  Chat API    │  │  Hugging Face (ru/en   │
                          │              │  │  fallback, or forced   │
                          │              │  │  via TTS_ENGINE)       │
                          └──────────────┘  └────────────────────────┘
```

`/api/report`, `/api/report/weekly` and `/api/report/world` do **not** call an LLM — they build a
localized, rule-based summary from the stats the client sends (`src/lib/report.ts`). Only
`/api/tali` (chat/hints/explanations) talks to DeepSeek, and only `/api/tts` talks to
ElevenLabs/Hugging Face.

## Data Flow

### Lesson completion
```
User finishes lesson
→ markLessonCompleted() [progressStore]
→ updates AsyncStorage (local, instant)
→ syncLessonCompletion() → user_progress (Supabase)
→ flushQueue() → lesson_analytics (Supabase)
→ addXP() [progressStore]
→ updates AsyncStorage
→ syncUserStats() → user_stats (Supabase)
```

### Parent report
```
Parent opens report → PIN gate (with lockout after repeated failed attempts;
  web shows a warning instead, since expo-secure-store PIN storage isn't
  available there)
→ useCloudProgress(userId)
→ SELECT user_progress (stars, completions by topic)
→ SELECT user_stats (xp, level, streak)
→ generateReport(baseStats) → AI Proxy /api/report → rule-based, localized
  summary (no LLM call — see src/lib/report.ts)
```

Optionally, the parent can tap "Discuss with Tali" to send the report summary into
`/api/tali` (`parentContext`), which *does* go through DeepSeek for a conversational
follow-up.

### ABA live session
```
Specialist starts ABA mode
→ abaLiveSessionStore → INSERT aba_live_sessions (task-progress/result updates
  are throttled client-side to at most 1 write / 2.5s to avoid flooding the
  Realtime channel)
→ Supabase Realtime channel
→ Parent device receives postgres_changes
→ parent-report.tsx updates live UI, showing a "stale" warning if no update has
  arrived for 90s while a session claims to be active
```

### Lesson resume
```
Child exits mid-lesson (back button, killed app, phone call, ...)
→ lessonResumeStore checkpoints { lessonId, phase, index } to AsyncStorage as
  the child progresses through dialog/intro/tasks
→ Next time the same lesson is opened, the checkpoint (if <24h old) restores
  phase + index instead of restarting from the top; cleared once the lesson
  reaches a celebration/completion phase
```

## State Management

| Store | Persisted | Cloud sync | Purpose |
|-------|-----------|------------|---------|
| `progressStore` | AsyncStorage | `user_progress`, `user_stats` | XP, stars, streak, topic skill. Guards against XP/token farming: only a *first* completion of a lesson grants XP/tokens, and replays can only raise (never lower) the stored star rating. |
| `analyticsQueueStore` | AsyncStorage | `lesson_analytics` | Task-level telemetry queue |
| `settingsStore` | AsyncStorage | — | Language, PIN (+ lockout state), child profile |
| `abaLiveSessionStore` | — | `aba_live_sessions` | Real-time ABA tracking (throttled writes, see above) |
| `abaTokenStore` | AsyncStorage | — | ABA puzzle-piece token progress |
| `lessonResumeStore` (service, not Zustand) | AsyncStorage | — | Single "resume this lesson" checkpoint |
| `syncStatusStore` | — | — | Tracks background cloud-sync failures (`syncWithRetry`) so a failed sync is retried and surfaced instead of silently swallowed |

Background cloud syncs (progress, analytics, ABA live sessions) go through `syncWithRetry`
(`src/services/syncStatus.ts`): a couple of retries with backoff, then the failure is recorded in
`syncStatusStore` rather than disappearing into a bare `.catch(() => {})`.

## Security

- **AI Proxy**: all DeepSeek/ElevenLabs/Hugging Face calls go through the Next.js proxy — provider
  API keys never ship to the device
- **Auth**: Supabase JWT validated on `/api/tali`, `/api/tts`, and `/api/report*`
  (`/api/ping` uses an optional shared secret only — not JWT)
- **Rate limiting** (`src/lib/ratelimit.ts`): Upstash Redis, sliding window, per client IP —
  20 req/min on `/api/tali` and `/api/report*`, 10 req/min (stricter) on `/api/tts`. **Fail-closed**
  in production: if `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` aren't configured and
  `NODE_ENV`/`VERCEL_ENV` is `production`, requests are rejected with 503 instead of silently
  bypassing the limiter. Outside production, an unconfigured limiter fails open (with a console
  warning) so local dev isn't blocked.
- **Input validation**: Zod schemas validate every proxy request body (`/api/tali`, `/api/tts`,
  `/api/report`, `/api/report/weekly`, `/api/report/world`), including hard caps on free-form text
  fields (e.g. `taskContext.questionPrompt` ≤ 1000 chars, ≤ 12 answer options) to bound LLM prompt
  size/cost and reduce prompt-injection surface
- **RLS**: every table has row-level security — users can only read/write their own data
  (`aba_live_sessions` included: owner has full CRUD, linked parents get SELECT only)
- **Parent access**: `parent_child` table enables parent users to SELECT child's progress
  and ABA live sessions. The mobile parent report currently uses **same-device PIN** on the
  child account (Realtime filter = signed-in `user_id`). Multi-device parent login is not
  wired in the app yet — RLS still prevents reading unrelated children.
- **PIN gate**: lesson methodology changes and parent report access require a PIN, with lockout
  after repeated failed attempts; the web build shows an explicit warning that this gate is
  unavailable there (no `expo-secure-store`) instead of silently skipping it
- **Error monitoring**: Sentry is wired into both apps (`talentia-mobile/src/services/sentry.ts`,
  `talentia-ai-proxy-next/src/instrumentation*.ts`) but is a no-op until `EXPO_PUBLIC_SENTRY_DSN` /
  `SENTRY_DSN` are set — no Sentry account ships with this codebase

## Key Directories
```
talentia-mobile/
├── app/                    # Expo Router screens
│   ├── (auth)/             # Login, signup, parent setup
│   ├── (tabs)/             # Main tab navigation
│   ├── lesson/[lessonId].tsx
│   ├── parent-report.tsx
│   └── tali.tsx
├── src/
│   ├── components/         # Shared UI components
│   │   └── lesson/         # IntroPhase, DialogPhase, RewardPhase, Confetti, StarsRow,
│   │                        # BreakReminderModal — extracted from lesson/[lessonId].tsx
│   ├── constants/          # Assets, worlds config
│   ├── context/            # AuthContext
│   ├── hooks/              # useCloudProgress, useBreakReminder, useTypingText, custom hooks
│   ├── services/           # supabase.ts, analyticsService.ts, reportService.ts, sentry.ts,
│   │                        # syncStatus.ts, lessonResumeStore.ts
│   ├── store/              # Zustand stores
│   └── theme/              # Design tokens, useAppTheme
├── curricula/              # Программа по классам: grade-0 … grade-4 (Markdown, `npm run export:curriculum-grades`)
└── scripts/                # Content seeding scripts
```

## Database Schema

```sql
profiles          -- child profile (name, age_band, language, methodology)
worlds            -- learning worlds (math, reading, logic)
lessons           -- lessons within worlds
tasks             -- individual tasks within lessons
lesson_analytics  -- per-task telemetry (correct, latency, prompt_level)
user_progress     -- lesson completion + stars (cloud sync of progressStore)
user_stats        -- XP, level, streak (cloud sync of progressStore)
aba_live_sessions -- real-time ABA session state for parent dashboard
parent_child      -- parent ↔ child account links
tali_safety_events -- audit log of Tali input/output safety-filter hits (category + timestamp only, no message text)
```

Indexes (`supabase/migrations/20260715221000_indexes.sql`): `tasks(lesson_id)`,
`lessons(world_id)`, `lesson_analytics(user_id, event_ts)`, `parent_child(child_id)`.
The `aba_live_sessions(user_id, status)` index lives in
`20260715220000_aba_live_sessions.sql` alongside the table + RLS.
The `tali_safety_events(user_id, created_at)` index + RLS live in
`20260807000000_tali_safety_events.sql` — writable only by the proxy's
service-role client, never by `authenticated`, so a flagged event can't be
forged or erased by the account it's about.

## Testing & CI

- **Mobile** (`talentia-mobile`): `npm run lint` (ESLint), `npm run typecheck` (`tsc --noEmit`),
  `npm test` (Jest — `progressStore`, `lessonResumeStore`, PIN lockout, `abaLiveSessionStore`,
  `xpUtils`, `worlds`, `reportService`), `npm run check:i18n`
  (verifies **referenced** `data.*` keys from `src/data` and UI `t()` keys from `app/` +
  `src/components` exist in `ru`/`en`/`ky` — not full locale-file parity).
- **Proxy** (`talentia-ai-proxy-next`): `npm run lint`, `npm run typecheck`, `npm test` (Vitest —
  `ratelimit`, `verifyAuth`, `cors-strict`, Zod schemas for tali/tts/reports), `npm run
  build`.
- `.github/workflows/ci.yml` runs both suites on every PR and on push to `main`.

## Production readiness — manual setup required

This codebase ships without any real third-party account wired in; the following are
intentionally left to whoever deploys it (see each project's `.env.example`):

- **Upstash Redis** (`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`) — without it, rate
  limiting fails closed (503) in production, so the proxy needs this before going live.
- **Sentry** (`EXPO_PUBLIC_SENTRY_DSN` for mobile via EAS Secrets / `eas.json` production `env`;
  `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` on Vercel) — error monitoring is a no-op without it.
- **DeepSeek / ElevenLabs / Hugging Face API keys** — `/api/tali` and `/api/tts` return explicit
  "not configured" errors without them; the app still runs, just without Tali chat/TTS.
- **Legal pages** — Privacy Policy and Terms are served by the proxy at `/privacy` and `/terms`.
  Point `EXPO_PUBLIC_LEGAL_BASE_URL` (or `EXPO_PUBLIC_BACKEND_URL`) at the deployed proxy host.
  Signup requires parental consent checkboxes; profiles store `parental_consent_at` /
  `guardian_attested` (migration `20260724120000_parental_consent.sql`).
- **Account deletion** — Settings → Delete account calls `POST /api/account/delete` (JWT +
  service-role `auth.admin.deleteUser`); DB cascades remove child rows.
- **Google Play Data Safety / Families forms** — still a Play Console process; align disclosures
  with the hosted Privacy Policy (name, age band, email, progress, mic/STT, Tali/DeepSeek, TTS, Sentry).
