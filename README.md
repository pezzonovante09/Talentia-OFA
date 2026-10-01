# Talentia

Образовательное приложение для детей 5–10 лет (полосы `5-6`, `7`, `8`, `9-10`) на русском,
английском и кыргызском, с отдельным ABA-режимом и компаньоном Tali.

**Идёт пересборка с нуля.** Вход — [`AUDIT.md`](AUDIT.md), затем раздел «С чего начать новой
сессии» в [`REBUILD.md`](REBUILD.md). Экранов в коде пока нет — только фундамент. Устройство
кода — [`ARCHITECTURE.md`](ARCHITECTURE.md), правила работы — [`CLAUDE.md`](CLAUDE.md).

## Структура

| Папка | Что там |
|---|---|
| `talentia-mobile/` | Expo-приложение: схемы, доменная логика, данные на устройстве, дизайн-токены, контент |
| `talentia-ai-proxy-next/` | Next.js-прокси на Vercel: `/api/v2/tali`, `/api/account/delete`, `/api/ping` |
| `supabase/` | миграции и тесты RLS в PGlite |

## Команды

```bash
npm run install:all   # зависимости всех пакетов
npm run lint
npm run typecheck
npm test              # Jest (mobile) + Vitest (proxy)
npm run test:db       # RLS и функции базы в PGlite
```

Node 22.13+ (`.nvmrc`). Переменные окружения — `talentia-mobile/.env.example` и
`talentia-ai-proxy-next/.env.example`.
