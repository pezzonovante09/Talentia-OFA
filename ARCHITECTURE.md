# Talentia — архитектура

Обновлено 2026-11-06. Приложение пересобирается с нуля (`REBUILD.md`, «С чего начать новой
сессии»; решения и находки — `AUDIT.md`). Прежняя версия удалена из кода 2026-10-01: она не
была опубликована, в облаке только тестовые данные. Её код — в истории git до коммита `38f57a7`.

Экраны детского режима, ABA и родительского раздела написаны (этапы 9–11 плана, октябрь–ноябрь
2026). Приложение работает только офлайн: прокси и база готовы, но к нему не подключены
(ворота «Данные», `CLAUDE.md`).

## Части

| Часть | Путь | Что там |
|---|---|---|
| Мобильное приложение | `talentia-mobile/` | Expo SDK 54, RN 0.81, React 19, expo-router; экраны в `app/` |
| AI-прокси | `talentia-ai-proxy-next/` | Next.js на Vercel: `/api/v2/tali`, `/api/account/delete`, `/api/ping` |
| База | `supabase/migrations/` | PostgreSQL + RLS; тесты RLS в PGlite — `supabase/tests/` |

## Мобильный пакет

```
app/                экраны (expo-router): index (первый запуск, профили), map, lesson/[id],
                    atlas/, review, aba/ (index, pairing, session), parent/ (за PIN-гейтом)
src/ui/             компоненты: lesson/formats (choose, match, order), map, atlas, aba, parent, TaliFigure
src/state/          zustand-сторы: account, gate, childSession, abaRun, mapModel, parentView, device
src/types/          схемы: task.ts (уроки), aba.ts (ABA)
src/domain/         чистая логика без I/O: урок (lessonSession, lessonFlow, lessonAssembly),
                    освоение (mastery, mapProgress), ABA (aba*.ts), согласия, отчёт, гейт, компаньон
src/services/local/ данные на устройстве (expo-sqlite; на web — sql.js), атомарные итоги commit.ts,
                    журналы ABA, удаление purge.ts, синхронизация sync.ts (адаптера RemotePort нет)
src/services/       syncStatus.ts (syncWithRetry), networkFuse.ts (запрет сети в рантайме),
                    voice.ts и audioPlayer.ts (проигрывание предзаписанной озвучки; файлов пока нет)
src/design/         токены направления B, ABA и родительского раздела, контраст
src/assets/         реестр ассетов (registry.ts); файлы — assets/ (SVG панорам, иконок, предметов)
src/content/        уроки по клеткам сетки (сейчас numbers-5-6: 6 уроков) + aba/ (4 цели) + гарды корпуса
src/i18n/locales/   ru и en — полные; ky — пустой
plugins/            config plugin: запрет резервной копии данных
scripts/            приёмка и нормализация SVG (assets:check), входящие ассеты в input/
```

Сеть из `src/` и `app/` запрещена ESLint-правилами `offlineRules` (`eslint.config.js`,
`eslint-disable` не действует) и в рантайме `networkFuse.ts`; единственное исключение —
`expo-sharing` для выгрузки журнала специалисту. Expo Go не годится (`expo-sqlite`,
config-плагин): на устройстве — development-сборка EAS.

Правила слоёв:

- `domain/` не знает про хранилище и сеть.
- Экраны пишут итоги урока и ABA только через `services/local/commit.ts` — одной
  транзакцией. Пробы ABA пишутся только при согласии `aba_processing`.
- Журналы (пробы, сессии, прохождения, согласия) — только дописывание; это держат
  триггеры SQLite (`schema.ts`). Удаление — только через `purge.ts`.
- В облако данные уходят через `sync.ts` и только при согласии на облако; пробы ABA в
  облако не уходят.

## Прокси

Каждый роут: Supabase JWT, Zod-схема на тело, лимиты на пользователя (Upstash). Всё о ребёнке —
от имени пользователя (`supabaseAsUser`), согласие — `hasConsent`. Sentry без
идентификаторов и тел запросов. Фильтры входа и выхода Tali — `src/lib/taliSafety.ts`.
Провайдер ИИ не задан (`src/lib/aiConfig.ts`, `AI_PROVIDER = null`, DeepSeek убран решением
№4): `/api/v2/tali` отвечает 503 `ai_disabled`. Озвучка ответа — ElevenLabs внутри того же роута.

## База

Схема пересборки — миграции `20260924*` и следующие (в облако ещё не накатывались).
Таблицы прежней версии в облачной Supabase остаются, пока их не удалят отдельной
миграцией по решению владельца.

## Тесты и CI

`npm test` (Jest в мобильном, Vitest в прокси), `npm run test:db` (PGlite). CI на Node 22:
джобы mobile, proxy, db на ветках `master` и пересборки.
