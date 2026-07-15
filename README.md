# Talentia

AI-powered multilingual educational app for children ages 5–10
(content age bands: `5-6`, `7`, `8`, `9-10`).
Supports Russian, English, and Kyrgyz. Includes ABA-compatible learning modes.

## Monorepo Structure

| Folder | Description |
|--------|-------------|
| `talentia-mobile/` | Expo React Native app (iOS & Android) |
| `talentia-ai-proxy-next/` | Next.js backend — AI proxy, report generation |
| `supabase/migrations/` | Database schema and RLS policies |

## Quick Start

### Mobile app
```bash
cd talentia-mobile
cp .env.example .env   # fill in Supabase + backend URL (optional: Sentry DSN)
npm install
npx expo start
```

### AI Proxy
```bash
cd talentia-ai-proxy-next
cp .env.example .env.local   # DEEPSEEK + Supabase required; Upstash required in production
npm install
npm run dev
```

### Database
Apply migrations in order via Supabase SQL Editor or CLI:
```
supabase/migrations/20260423170000_profiles_and_lesson_analytics.sql
supabase/migrations/20260423180000_rls_profiles_analytics.sql
supabase/migrations/20260425120000_content_tables.sql
supabase/migrations/20260510000000_user_progress.sql
supabase/migrations/20260510000001_user_stats.sql
supabase/migrations/20260715220000_aba_live_sessions.sql
supabase/migrations/20260715221000_indexes.sql
```

## Key Features

- **Subject tracks across age bands** — Math, Reading (EN/RU), world/social topics and more
  (dozens of world entries in `worlds.ts`, not a single 4-world map)
- **ABA methodology support** — least-to-most prompt levels (L1 visual highlight; L2
  restricted choice without verbally revealing the answer), token rewards, routine chains,
  break reminders
- **Multilingual** — full i18n across RU / EN / KY, including pluralization
- **Parent dashboard** — real-time ABA session tracking (with a "stale connection" warning),
  rule-based progress reports with an optional AI follow-up chat
- **Offline-first** — local progress with cloud sync via Supabase, retried on failure and
  surfaced via a sync-status store instead of failing silently
- **Anti-farming safeguards** — replaying a completed lesson can't re-grant XP/tokens, and
  skipping tasks can't be used to farm a perfect star rating
- **Lesson resume** — exiting mid-lesson picks back up near where the child left off
- **AI tutor Tali** — conversational assistant powered by DeepSeek, with text-to-speech via
  ElevenLabs (Hugging Face as a free-tier fallback for RU/EN)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | Expo SDK 54, React Native 0.81, React 19 |
| State | Zustand + AsyncStorage (persist) |
| Backend | Next.js 16, Vercel |
| Database | Supabase (PostgreSQL + RLS + Realtime) |
| Auth | Supabase Auth (email/password) |
| AI chat | DeepSeek Chat API, via secure proxy |
| Text-to-speech | ElevenLabs (primary) / Hugging Face (RU/EN fallback) |
| Rate limiting | Upstash Redis (fail-closed in production if unconfigured) |
| Validation | Zod on every proxy route |
| Error monitoring | Sentry (optional — no-op until a DSN is configured) |
| i18n | i18next + expo-localization |
| CI | GitHub Actions (`.github/workflows/ci.yml`) — lint, typecheck, test, build |

## Environment Variables

See `talentia-mobile/.env.example` and `talentia-ai-proxy-next/.env.example`.
Supabase is required for cloud auth/sync. **Upstash Redis is required in production**
(the proxy fail-closes with 503 if it is missing). Sentry and TTS provider keys are
optional and degrade gracefully when unset — no real third-party account ships with this repo.

## Documentation

- [Mobile app](talentia-mobile/README.md)
- [AI Proxy](talentia-ai-proxy-next/README.md)
- [Architecture](ARCHITECTURE.md)
- [Troubleshooting](talentia-mobile/TROUBLESHOOTING-PHONE.md)
