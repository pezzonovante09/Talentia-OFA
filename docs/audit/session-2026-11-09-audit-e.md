# Итог сессии 2026-11-09: этап E плана правок, шаги E1 и E4 (Ж12, часть Ж19)

Отдельная сессия в своём worktree, ветка `claude/quizzical-heyrovsky-39a6f6` от `83f2660` (`claude/jolly-clarke-ttbuh5`).
План — `C:\Users\User\.claude\plans\abstract-popping-rose.md`, «Этап E»; решение владельца — AUDIT.md №185. Домен
`src/domain/aba*.ts` не менялся (заморозка №134): новые сводки только вызывают его функции. Ничего не запушено; ветку
вливать в `claude/jolly-clarke-ttbuh5` по готовности.

Коммиты: `ac0f924` E4 (тесты ворот), `d9403bf` E1 (сводки специалисту), `35a73e1` E4 после повтора мутаций, `41d42d6` E1 после
вердиктов методиста и приватности; журнал — следующим коммитом.

## E1 — сводки специалисту в файле выгрузки (Ж12)

`talentia-mobile/src/services/local/purge.ts`, `exportForSpecialist` → поле `summaries` (`SpecialistSummaries`);
счёт — `specialistSummaries` и `distributionOf` там же. Тесты — `src/services/local/__tests__/specialistSummaries.test.ts`
(34: чистый счёт на синтетических пробах, итог сессии как в домене, цепочка, рутина, удалённая цель, сквозной через `memoryDb`,
приватность).

| Блок | Что | Откуда |
|---|---|---|
| `criterion` | весь `MASTERY`: линия 80 %, минимумы проб и прогонов, пороги `criterionGaps` | `types/aba.ts` |
| `bySession[]` (сессия × цель) | `role: teaching \| baseline \| probe_only`; у `teaching` — `trials`, `independentRate`, `outcome`, `counted`, `unit: trials \| runs` | `summarizeSession` + итог как в `finishSession`: срыв рвёт серию только сорвавшейся цели, отказ / снятая не предъявленная проба / ненадёжная цель снимают `meets` до `neutral` (копия `hasUnpresentedDrop` до разморозки домена) |
| | `byStartLevel`, `byUsedLevel` (0–4), `fade` (`at_start / waited / above / approximation`) | `fadeClass`; популяция = `applyTrialToFading`: обучение + перенос, без прерванных и подсказки взрослого вне процедуры |
| | `l0Latency {medianMs, n, bySource}` | самостоятельные ответы обучения со старта L0 (ABA.md: «только по `independent`») |
| | `promptDelayMs {min, max, last}`, `emittedBeforePromptRate` | пробы затухания со старта L0; доля попыток до подсказки среди несамостоятельных обучающих проб со старта L0 — выборка детектора зависимости домена |
| | `transfer {independent, waited, prompted, promptedAbove, failed, approximation}` + `interrupted`, `adultUnplanned` | исходы переноса (методист 2026-10-01), пять классов делят пробы без остатка |
| | `byKind {trials, independent}`, `byScoredBy`, `adultScoredRate`, `corrections`, `adultUnplannedPrompts`, `interrupted`, `endReason`, `incomplete` | все не прерванные пробы; доля оценённых человеком (ABA.md:567); нагрузка ошибок и точность процедуры |
| | `byStep` у цепочек | пробы затухания звена, доля самостоятельных, уровни |
| `byTarget[]` | `phaseChanges[] {sessionIndex, day, from, to, reason}` | события `phase` записей сессий — отсечки на графике |
| | `pooledIndependentRate`, `pooledFromSessionIndex` | зачётные пробы с последнего входа в `acquisition`; критерий — по `state.recentIndependentRates` |
| | `state {phase, criterionGaps, sessionsAtCriterion, verifiedCriterionSessions, criterionDays, generalizationPasses, recentIndependentRates, flags, startPromptLevel, currentDelayMs, lastSuccessfulPromptLevel, maintenanceFailsInRow}` | `criterionGaps`, `generalizationPasses`; неполное состояние — `null`, не ошибка |
| | `routine`, `catalogMissing` | рутина — только здесь (прогоны не сессии); удалённая из каталога цель — без счёта критерия |

Исходные пробы исправленных отметок (`aba_trial_corrections.trialId`) исключены из всех счётчиков: их замены — отдельные
строки `abaTrials`. Приватность: ни одного нового источника данных — только производные от уже экспортируемых записей;
`sessionId` сводок проходит `aliasTimeLeakingIds` вместе с записями (тест: uuid v7 → `A1` везде); дни и номера сессий как
у записей; тесты на «нет чч:мм, ISO-времени, чисел > 10⁶, uuid, ключей name/child/observer/deviceId/account».

Методист до кода (`aba-pedagogy-specialist`) дал список правок к спецификации — приняты все критичные: популяция
затухания как в домене, исключение исправленных, `phaseChanges`, разделение «подсказан / провал» не по `fadeClass`
(он включает провалы в `above`), `unit` и `byStep` у цепочек, `pooledIndependentRate` с последнего входа в обучение.
Не принято по объёму шага: мода `promptDelayMs`; счётчики поддержания и переноса отдельными полями (видны в `byKind`).

## E4 — тесты ворот полной доски (Ж19, часть «тесты gate»)

`src/ui/aba/model/__tests__/sessionPhase.test.ts` — 24 теста на `gateWait`, `gateOnHold`, `gateOnRelease`,
`participationPhase`: лежащий палец ждёт ровно потолка; касание до показа кадра кадр не держит; отпускание — отклик + 300
не дальше потолка; удержание переживает смену кадра; в продуктовых таймингах окно от плановой смены до потолка 220 мс < 300,
поэтому формула «отпускание + 300» проверяется и на широком окне.

Мутации (вручную, затем `qa-engineer` — девять мутаций, таблица ниже; все откачены, рабочее дерево проверено):

| Мутация | Результат |
|---|---|
| `gateOnHold` не переносит срок на потолок | падают 4 unit-теста и модельный «новое касание, пока кадр уже ждёт…» в `session.test.tsx` |
| `gateWait` под пальцем ждёт касание + 300, а не потолок | падает unit-тест с широким окном (на продуктовых токенах мутация эквивалентна: 220 < 300) |
| `gateOnRelease` без потолка | падают 3 unit-теста |
| `gateOnHold` `now > since`, `gateWait` `held.at > since`, `participationPhase` `since = now` | падают 1 / 3 / 1 unit-тест |
| ворота плашки `since = landedAt` вместо `markedAt` (`session.tsx`) | выживала — реальная дыра: ни один тест не клал палец до посадки жетона; закрыто модельным тестом «палец, лёгший на плашке до посадки жетона…» (`35a73e1`) |
| `commitHeld` без `at < gate.ceilingAt` (`session.tsx`) | **выживает, эквивалентна**: пока лежит засчитываемый палец, `frameAt` всегда равен потолку (его ставят `gateWait` и `gateOnHold`), `useDue` передаёт значение срока, гонка pressIn и таймера закрыта синхронным сбросом эффектов. Вторая линия той же защиты; инвариант записан в комментарии к `commitHeld` |
| `commitHeld` `h.at <= gate.since` | выживает: граница в одну мс на экране; для чистых функций граница защищена |

Остаток Ж19 (тесты Ж1, Ж2, база N+1, обвязка `clock` в `src/test/manualClockDriver.ts`, `testTimeout`, чеклист К2) — этап F.

## Проверки по диффу

- **`aba-pedagogy-specialist` до кода** — список правок к спецификации, приняты все критичные (выше).
- **`aba-pedagogy-specialist` по диффу `d9403bf`** — блокеров нет; важное: `breakdown` применялся ко всем целям сессии
  (домен — только к сорвавшейся), три нейтрализации `meets → neutral` не воспроизведены, знаменатель
  `emittedBeforePromptRate` шире выборки детектора зависимости, строки для сессий без обучения цели выглядели как «проб мало».
  Все четыре закрыты в `41d42d6` (+ мелочи: комментарии, порядок проб цели, доля оценённых человеком). Рекомендация на
  разморозку домена (E3): вынести итог сессии в одну функцию домена и звать её из `finishSession` и экспорта, экспортировать
  `hasUnpresentedDrop`, добавить `independent` в `AbaSessionSummary` — тогда совпадение гарантируется, а не проверяется.
- **`child-privacy-compliance` по диффу** — блокеров и важного нет: сводки — производные от уже экспортируемых записей, новых
  категорий, получателей и хранилища нет; `consentBody` и privacy-policy не трогать. Мелочи закрыты в `41d42d6`: тип `reason`
  из события, тесты на ключи времени / суффикс `Id` / `leaksTime` по ключам и строкам / день без поля `day`. Осталось: одна
  строка в ABA.md после :567 по образцу хвоста («сводки считаются при выгрузке и не хранятся, правка согласия не нужна») —
  ABA.md заморожен (№123), вносить точечной разморозкой вместе с E2.
- **`qa-engineer`** — повтор мутаций (таблица выше), подтверждение недостижимости `at < ceilingAt`, дыра `since = landedAt`
  закрыта. Вне зоны, на заметку `backend-auditor`: отпускание касания, начатого до показа кадра, всё же сдвигает смену кадра на
  +300 (вероятно намеренно — отклик «принято» любому отпусканию); один `held.current` на два пальца (карточка + «Отказ»).

## Прогон

`talentia-mobile`: `npx jest` — 152 набора, **4603 теста, все зелёные** (было 4548 на `8fe8225`; +24 `sessionPhase.test.ts`,
+34 `specialistSummaries.test.ts`, +1 в `session.test.tsx`); `tsc --noEmit` и `expo lint` чистые. Промежуточный прогон
показал одно падение в «цикле 4» — его дала мутация `qa-engineer`, шедшая параллельно в том же дереве; чистый повтор зелёный.
Прокси в этом worktree без зависимостей и не трогался. На устройстве ничего не проверялось.

## Что дальше

- Влить `claude/quizzical-heyrovsky-39a6f6` в `claude/jolly-clarke-ttbuh5` (основная сессия параллельно правит `purge.ts` в
  районе `trustedNow`/`applyRetention` — здесь правки только в `exportForSpecialist` и его хелперах, конфликт маловероятен).
- E2 (ABA.md, точечная разморозка): строка после :567 о сводках (не хранятся, согласие не трогать); E3 (домен после
  методиста 34–37): общая функция итога сессии для `finishSession` и экспорта, экспорт `hasUnpresentedDrop`, `independent`
  в `AbaSessionSummary`.
- Остаток Ж19 — этап F.
