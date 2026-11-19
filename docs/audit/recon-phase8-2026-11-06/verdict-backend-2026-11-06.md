# Вердикт `backend-auditor` по фазе 8 ABA (2026-11-06)

**Одной строкой:** готов с оговорками; три места плана как написано сломают продукт или данные (B1, B2, Major 1);
ключ `abaSessionLeft` **не вводить** — он дублирует `updated_at` снимка, который `markAbaSessionLeft` и так
переписывает той же транзакцией. Статический анализ, прогоны не запускались (qa-engineer правил тесты параллельно).

## Блокеры

| # | Где | Проблема | Что сломается |
|---|---|---|---|
| B1 | план шаг 5; `commit.ts` 254–276, `abaSession.ts` 1172 | «При ошибке „нет вариантов" закрывать по снимку без resume» — ошибка возникает ровно когда рутина уже сменила `rev` доски, снимок несёт устаревший `boardRev` | `writeSessionBoard` бросает `AbaBoardConflictError` при каждой попытке; просроченное занятие не закрыть, `abaBlockOf` вечно `in_progress` |
| B2 | `purge.ts` 335–342 | `revokeAbaProcessing` удаляет по явному списку, не по `JOURNALS`; `aba_session_tails` сама не появится | Триггер отзыва отклонит отзыв при любом хвосте — право на удаление нереализуемо |

Решение B1: всегда живая доска и её версия без требования вариантов —
`resumeSessionState(state, { earned, nonContingent, rev: boardRevOf(live) }, { routineExchanged: false, awayMs: 0 })`.
Решение B2: ввести `ABA_JOURNALS` и в `revokeAbaProcessing` идти циклом; плюс `JOURNALS`, `RETENTION_COLUMNS`,
`exportChild`, `exportForSpecialist`, `abaDataSummary`.

## Major

- `session.tsx` 266–299, 839–860: `writing.current` покрывает только `saveAside`; `finish`/`endBreak`/`endAccess`/
  `noReturn`/`takeCard`/`advance → save` пишут мимо. Фон во время `finish` → хвост раньше итога; `onReturn` раньше
  конца `onLeave` → возобновление со старым `boardRev`. Лечение: единая очередь записи (`useSerialWrite`:
  `enqueue(fn)`, `idle()`), `onLeave`/`onReturn` ждут `idle()`; `commitAbaSessionTail` проверяет наличие
  `aba_sessions.id` и бросает `AbaSessionMissingError`.
- `abaOverview(now)` позиционно ломает ~35 вызовов с `art`. Чище: `abaOverview` без `now` отдаёт `inProgressLeftAt`
  (`updated_at` снимка), просрочку считает чистая `abaBlockOf(o, now)` через `awayOutcome`; `loadPairingStart`
  получает `now` в опции. `Date.now()` по умолчанию не ставить.

## 1. Миграция 17 — DDL

После миграции 16 (без ключа — только таблица и триггер отзыва):

```ts
  // 17 — хвост конца сессии (фаза 8, №178)
  `
CREATE TABLE aba_session_tails (
  seq         INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id    TEXT NOT NULL,
  session_id  TEXT NOT NULL,
  body        TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  UNIQUE (child_id, session_id)
);
${gated('aba_session_tails')}
${retained('aba_session_tails', 'recorded_at')}
CREATE TRIGGER aba_session_tails_need_consent BEFORE INSERT ON aba_session_tails
WHEN NOT EXISTS (SELECT 1 FROM aba_write_gate WHERE child_id = NEW.child_id)
BEGIN SELECT RAISE(ABORT, 'aba_session_tails: запись только через commit.ts при согласии на данные ABA'); END;
DROP TRIGGER consent_events_aba_revoke_needs_purge;
CREATE TRIGGER consent_events_aba_revoke_needs_purge … (список миграции 16 + aba_session_tails)
`,
```

Замечания: индекс не нужен (`UNIQUE` даёт autoindex); `retained` дропает `_no_delete` из `gated` и создаёт заново
— порядок как в 8/10/12/16; идемпотентность — в `commitAbaSessionTail`, не в SQL; `recorded_at` хвоста ≈ конец
сессии, срок как у `aba_sessions`. Тесты, перечисляющие триггеры поимённо: `migrations7to9.test.ts` 121–123,
`pairingJournal.test.ts` 647 — проверить `toEqual`/`toContain`.

Тест миграции 16→17 по образцу `migrations9to10.test.ts`: `memoryDb(16)` → данные версии 16 → `migrate(db)`;
`user_version`; дамп таблиц 16 до/после равен; повторный `migrate` без изменений; `aba_session_tails` пуста; вставка
мимо ворот — `/только через commit\.ts/`; через ворота — ок; вторая строка той же пары — `/UNIQUE/`; `UPDATE`/`DELETE`
— `/только дописывание/`; `purge_gate` чужого не пускает; `retention_gate`; отзыв блокируется одним лишь хвостом.

## 2. Ключ `abaSessionLeft` против `updated_at`

**Без ключа.** `markAbaSessionLeft` пишет снимок с тем же `at` → `updated_at` строки `abaSessionInProgress` равен
моменту ухода. Тёплый возврат — `leftAt` в ref экрана; холодный — `childStateUpdatedAt(db, childId,
'abaSessionInProgress')`. Теряется только различение «ушёл» / «последний шаг записан» при убитом приложении — ошибка
≤ одного шага и в консервативную сторону. Цена ключа: миграция триггеров, правка purge (`IN_PROGRESS_KEYS` не
подходит — `json_extract('$.startedAt')`), вопрос приватности, фиксатор `routineRuns.test.ts:490`.

## 3. Идемпотентность `commitAbaSession`

Проверка первой строкой в `withAbaWrite`, до `writeSessionBoard`, по `aba_sessions.id`. При повторе **ничего не
трогать** (ни снимок, ни ключ): первый успех их обнулил, у родителя там может лежать снимок следующей сессии.
`RoutineWindowNotAccountedError` — после проверки.

## 4. `abandonInProgressSession`

Одна транзакция (`db.transaction`, адаптеры делают вложенную той же): снимок → `resumeAbaSession(tx, …, pool, 0)`,
при ошибке «нет вариантов» → `resumeSessionState(state, live, { routineExchanged: false })` → `leftAt =
max(o.at, updated_at снимка)` (иначе `endedAt` раньше `sdEndedAt` последней пробы) → `stopSession(resumed, reason,
leftAt)` → `loadFinishInputs(tx)` → `commitAbaSession(tx, …, finishAbaSession(stopped, leftAt, …), iso(now))`.
`finishInProgressSession(db, childId, now)` → обёртка `{ reason: 'adult_stopped', at: leftAt ?? now, now }`.
`resumePoolFor` нужен `soundOn` — у родителя нет; для закрытия варианты не показываются, допустимо `soundOn: true`.
Общий код «закрыть с повтором» для экрана (`finish`) и родителя — в `services/local/abaResume.ts` (`closeSession`).

## 5. `loadAbaResume` одной транзакцией

Вложенность безопасна; внутри работать только с `tx` (вызов на корневой `db` повиснет в очереди). Не звать
`abaOverview` целиком — выделить `abaGateOf(tx, childId)` → `{ consent, paused }`. Транзакция короткая, без `await`
на UI. Порядок с записью: экран дожидается своей записи (п. 8), иначе прочитает старый снимок.

## 6. `abaOverview(now)`

См. Major 2: просрочка — в `abaBlockOf(o, now)`, `abaOverview` отдаёт `inProgressLeftAt`.

## 7. Границы `session.tsx`

План недостаточен (+120–150 строк веток против −80 типов). Обязательно вынести ещё: (1) весь I/O конца — `finish`
в `abaResume.ts` как `closeSession(db, childId, state, { now, maxConflicts })` → `{ steps, board } | { kind:
'blocked' | 'failed' }`, тот же код для `abandonInProgressSession`; (2) `nextTail` → чистая `phaseForTailStep(step,
now, still)` в `sessionPhase.ts`; (3) сериализацию записи → хук `useSerialWrite()`; ожидание ≈ −40 строк. Гард:
`max-lines: ['warn', 1183]` для `app/aba/session.tsx` в `eslint.config.js` (предупреждение, №122).

## 8. Хвост и гонка с фоном

1. Все записи экрана через одну очередь; `onLeave` ждёт `idle()`; `commitAbaSessionTail` проверяет `aba_sessions`
   (`AbaSessionMissingError`, как у IOA `commit.ts` 722).
2. `onReturn` ждёт `idle()`, затем читает.
3. iOS-заморозка посреди транзакции — не дыра (WAL откатит, `closeGates` при открытии снимет ворота); снимок на входе
   в перерыв/доступ обязателен.
4. `setPhase({ kind: 'busy' })` при уходе: на возврате фазу восстанавливать только из `resumeEntry`, не из
   `lastPhase.current`.
5. Двойной хвост (уход на `end_wait`, затем `tailOnEnd`) — идемпотентность гасит второй; первая запись окончательна.
6. Хвост при отозванном согласии → `AbaConsentRequiredError` → только `__DEV__`.

## Обязательные сервисные тесты

`migrations16to17.test.ts`; `sessionTail.test.ts` (без согласия/на паузе — ошибка; для сессии без записи —
`AbaSessionMissingError`; дважды с разным телом — одна строка, первое тело; `UPDATE`/`DELETE` отклонены;
`revokeAbaProcessing` проходит и удаляет; отзыв мимо него при хвосте — `/вместе с удалением/`; `purgeChild`,
`clearChildProgress`, `wipeDevice` чистят; `exportChild` содержит; `exportForSpecialist` `tail` относительно, `null`
без хвоста; `abaDataSummary` считает); `abaResume.test.ts` (`commitAbaSession` дважды — одна строка, снимок другой
сессии цел; повтор при `rev` +1 не бросает; `abandonInProgressSession`: `endedAt === at`, `recorded_at === now`,
причина, снимок `null`, перерыв/доступ закрыты моментом ухода, **`rev` изменён рутиной + пул мал → закрывается**,
`at` раньше `updated_at` → `endedAt = updated_at`, повтор → `false`; `loadAbaResume` все пороги на ручных часах,
другой день у локальной полуночи, пауза → `blocked`, отзыв → `none`, `leftAt` из `updated_at`; `abaBlockOf(o, now)`:
`in_progress_stale` раньше `in_progress`, `paused` раньше обоих).
