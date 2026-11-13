# Talentia

Образовательное приложение для детей 5–10 лет (полосы `5-6`, `7`, `8`, `9-10`) с отдельным
ABA-режимом и компаньоном Tali. Интерфейс и контент — на русском и английском; кыргызская
локаль заведена, но пока пуста (ждёт носителя, решение №126).

**Идёт пересборка с нуля** (решение владельца, 2026-10-01). Вход для новой сессии — раздел
«С чего начать новой сессии» в [`REBUILD.md`](REBUILD.md), таблица решений и находок —
[`AUDIT.md`](AUDIT.md), итоги сессий — `docs/audit/`. Устройство кода —
[`ARCHITECTURE.md`](ARCHITECTURE.md), правила работы — [`CLAUDE.md`](CLAUDE.md).

## Что есть сейчас (2026-11-06)

- **Детский режим**: первый запуск и профили, карта «Мира чисел», урок на форматах `choose` /
  `match` / `order`, страница атласа, сессия повторения. Контент — срез прототипа: одна полоса
  `5-6`, две темы, 6 уроков (`talentia-mobile/src/content/`); остальные регионы и полосы —
  этапы 12 и 17 плана (`REBUILD.md`, «План до релиза»).
- **ABA-режим**: сопряжение с подкрепителем, экран пробы с панелью взрослого, жетонная доска и
  обмен, карточка «перерыв», журнал проб; контент — 4 цели формата `match` уровня 1.
- **Родительский раздел** за PIN-гейтом: отчёт, профили детей, согласия, данные и удаление,
  запуск ABA-сессии, выгрузка журнала специалисту.
- **Tali** говорит авторскими репликами из контента (завязка, пример, подсказка, объяснение);
  живого ИИ и озвучки в приложении пока нет.
- **Только офлайн.** Приложение не выходит в сеть: запрет держат ESLint `offlineRules`
  (`talentia-mobile/eslint.config.js`) и рантайм-предохранитель `src/services/networkFuse.ts`.
  Прокси и база написаны и покрыты тестами, но к приложению не подключены (ворота «Данные»,
  `CLAUDE.md`). Провайдер ИИ в прокси не задан (`AI_PROVIDER = null`), роут Tali отвечает 503.

## Структура

| Папка | Что там |
|---|---|
| `talentia-mobile/` | Expo SDK 54: экраны `app/` (expo-router), `src/ui/`, доменная логика `src/domain/`, данные на устройстве `src/services/local/`, контент `src/content/`, токены `src/design/`, локали `src/i18n/`, реестр ассетов `src/assets/` |
| `talentia-ai-proxy-next/` | Next.js-прокси на Vercel: `/api/v2/tali`, `/api/account/delete`, `/api/ping` |
| `supabase/` | миграции и тесты RLS в PGlite |
| `docs/` | итоги сессий и аудитов (`audit/`), дизайн (`design/`), ассеты (`assets/`), источники программы (`sources/`), юридические тексты (`legal/`) |

## Команды

```bash
npm run install:all   # зависимости всех пакетов
npm run dev           # expo start (мобильное)
npm run dev:api       # прокси локально
npm run lint
npm run typecheck
npm test              # Jest (mobile) + Vitest (proxy)
npm run test:db       # RLS и функции базы в PGlite
npm run build:api     # сборка прокси
npm run build:aba     # preview-сборка Android «только ABA» на EAS (запускать можно из корня)
```

В `talentia-mobile/`: `npm run assets:check` — приёмка SVG по `ASSETS.md`.

Запуск на устройстве — только development-сборка EAS (`eas.json`, профиль `development`):
Expo Go не годится из-за `expo-sqlite` и config-плагина `withNoDataBackup`. `expo start --web`
работает как прототип (адаптер базы на sql.js, родительский раздел на web скрыт).

Node 22.13+ (`.nvmrc`). Переменные окружения — `talentia-mobile/.env.example` и
`talentia-ai-proxy-next/.env.example`.
