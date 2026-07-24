# Talentia Mobile

Inclusive learning app for ages 5–10 (content age bands `5-6` … `9-10`). Built with Expo, React Native, and Supabase.

## Features

- **Adventure Map** — Subject tracks (math, Russian, English, world around us, social skills) with lesson nodes, stars, and world sections
- **Lessons** — Dialog → intro slides → tasks (multiple choice & input), voice input, bundled lesson audio, XP and collectibles
- **Tali** — AI companion (hints, facts, motivation) when `EXPO_PUBLIC_BACKEND_URL` is set
- **Parent Report** — Progress, weekly stats, per-world summaries (PIN-protected); rule-based
  report text from the backend with local fallbacks, plus optional Tali AI follow-up chat
- **Profiles** — Standard vs **special** child mode; in special mode, **ABA** methodology and adapted tasks (`special_aba` audience)
- **Accessibility** — Tab bar `tabBarAccessibilityLabel`, map nodes with labels, `Button` exposes `accessibilityState.disabled` when loading/disabled; pass `accessibilityLabel` / `accessibilityHint` on buttons where the label is not obvious
- **Comfort** — Calm mode, focus mode, reduce motion, TTS toggles, break reminders
- **Multi-language** — English, Russian, Kyrgyz (i18next)

## Tech Stack

- Expo SDK 54, React Native 0.81, React 19
- Expo Router (file-based routing, typed routes)
- Zustand + AsyncStorage persist
- Supabase (auth + profiles, optional)
- i18next

## Setup

```bash
npm install
```

### Environment

Copy `.env.example` to `.env` and fill in:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_BACKEND_URL=https://your-backend.com  # optional: Tali, TTS, AI reports (see talentia-ai-proxy-next)
# Backend calls use the Supabase session access token (Authorization: Bearer). Sign in with Supabase for proxy routes that require JWT.
EXPO_PUBLIC_SENTRY_DSN=  # optional: error monitoring, https://sentry.io — leave empty to disable
```

Without Supabase config, the app runs in **demo mode** (local auth only).

### Optional: Sentry error monitoring

The app calls `Sentry.init()` on startup (`src/services/sentry.ts`) only when `EXPO_PUBLIC_SENTRY_DSN` is set; without it, monitoring is a no-op and errors just go to the console. To enable it, create a React Native project in Sentry, copy its DSN into `.env`, and rebuild. The `@sentry/react-native` config plugin is already listed in `app.json`; a fresh native build is still required for native crash reporting beyond JS errors.

### Optional: Nano Banana assets

If you use the Cursor asset import scripts:

```bash
npm run assets:import-nano
npm run assets:splice-nano-ui
```

## Run

```bash
npx expo start
```

Then open in iOS simulator, Android emulator, or Expo Go.

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start Expo dev server |
| `npm run android` | Run on Android |
| `npm run ios` | Run on iOS |
| `npm run web` | Run on web |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Run unit tests (`**/__tests__/**/*.test.ts`) |
| `npm run test:watch` | Tests in watch mode |
| `npm run check:i18n` | Verify referenced `data.*` keys (from `src/data`) and UI `t()` keys (from `app/` + `src/components`) exist as non-empty strings in `ru`/`en`/`ky` |

## Tests

Unit tests cover:

- `src/utils/xpUtils` — level and XP bar math
- `src/services/reportService` — `getWorldStats` aggregation
- `src/data/worlds` — `getLesson`, `getWorldForLesson`, `filterTasksForProfile` (standard vs special/ABA)
- `src/store/progressStore` — XP/level accounting, skill/streak tracking, and the anti-farming
  rules for lesson completion (first-completion-only rewards, stars that can only improve on
  replay, skip capping the max star rating)

Add new tests under `src/**/__tests__/*.test.ts`.

## Project Structure

```
app/               # Screens (Expo Router)
  (auth)/          # Auth flow: welcome, login, signup, parent-setup, onboarding
  (tabs)/          # Main tabs: map, profile, settings
  lesson/[id]      # Lesson flow
src/
  components/      # Reusable UI
  context/         # AuthContext
  data/            # worlds.ts (lessons, topics, tasks)
  i18n/            # Locales (en, ru, ky)
  services/        # Supabase, companionService, reportService, notifications, TTS
  store/           # Zustand (settings, progress, collectibles)
  theme/           # App theme
  utils/           # Helpers (e.g. xpUtils)
```

## Monorepo

This app lives next to **`talentia-ai-proxy-next`** (Next.js API routes for Tali, reports, ElevenLabs TTS). From repo root:

```bash
npm run install:all
npm run dev          # mobile
npm run dev:api      # proxy (separate terminal)
```

## Learn More

- [Expo docs](https://docs.expo.dev/)
- [Expo Router](https://docs.expo.dev/router/introduction/)

## Pre-launch ops

- Set `EXPO_PUBLIC_SENTRY_DSN` in EAS Secrets for production builds.
- Set `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` on Vercel.
- Deploy proxy so `/privacy` and `/terms` are publicly reachable; point `EXPO_PUBLIC_LEGAL_BASE_URL` or `EXPO_PUBLIC_BACKEND_URL` at that host.
- Apply migration `20260724120000_parental_consent.sql` before relying on consent columns.

