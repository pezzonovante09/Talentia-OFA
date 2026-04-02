# Talentia Mobile

Inclusive learning app for ages 5–8. Built with Expo, React Native, and Supabase.

## Features

- **Adventure Map** — World map with lesson nodes, subjects (math, English, Russian, science)
- **Tali** — AI companion for hints, motivation, and science facts
- **Parent Report** — Weekly progress and insights (PIN-protected)
- **Profiles** — Child setup with methodology (Montessori, ABA, TEACCH)
- **Multi-language** — English, Russian, Kyrgyz

## Tech Stack

- Expo SDK 54, React Native 0.81, React 19
- Expo Router (file-based routing)
- Zustand (state management)
- Supabase (auth + profiles)
- i18next (internationalization)

## Setup

```bash
npm install
```

### Environment

Copy `.env.example` to `.env` and fill in:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_BACKEND_URL=https://your-backend.com  # optional, for Tali AI
```

Without Supabase config, the app runs in **demo mode** (local auth only).

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
| `npm test` | Run unit tests |
| `npm run test:watch` | Run tests in watch mode |

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
  services/        # Supabase, CompanionService, reportService, notifications
  store/           # Zustand (settings, progress, collectibles)
  theme/           # App theme
  utils/           # Helpers
```

## Learn More

- [Expo docs](https://docs.expo.dev/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
