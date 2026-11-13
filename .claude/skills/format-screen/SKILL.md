---
name: format-screen
description: Пишет экран одного формата задания Talentia — choose / point / match / order / group / build — по SCREENS.md и оркестратору domain/lessonSession.ts одним конвейером: чистый черновик ответа «ткнул → ткнул» в src/domain/taskDraft.ts с тестами, компонент формата в src/ui/lesson/formats/, состояния плиток и ход ошибки из общих примитивов, тесты механики и сужения. Используй, когда просят «сделай экран формата», «реализуй choose / match / order», «добавь формат group». Не для каркаса урока и не для содержания заданий (это lesson-author), не для проверки готового экрана (design-lead → child-ux-specialist).
---

# Экран формата

Один формат — один компонент в `talentia-mobile/src/ui/lesson/formats/<Format>Task.tsx` и один
редьюсер черновика в `talentia-mobile/src/domain/taskDraft.ts`. Экран ничего не решает сам:
что показать — говорит `LessonStep` (`domain/lessonSession.ts`, `lessonStepOf`), что ребёнок
собрал — черновик, проверяет ответ только `applyLessonEvent({type:'answer'})`.

Зачем конвейер: шесть форматов делят одни состояния плиток, один ход ошибки и одно правило
составных форматов (SCREENS.md 2.3–2.6, 3.3 «Единое правило»). Формат, написанный «по-своему»,
ломает это для ребёнка незаметно: молчащая цель, второй залитый `primary`, снятый выбор после
пересчёта кучки. Поэтому шаги ниже не пропускаются даже для «простого» формата.

## 0. Предусловия

1. Прочитай в `SCREENS.md`: 1.1–1.5 (каркас), 2.1–2.7 (плитка, значки, состояния, ход ошибки,
   сужение, проба), раздел своего формата в 3, 3.8 и 3.8.1 если формат несёт кучки или
   карточки-числа, 4 (calm / focus / тёмная / reduce motion), 5 (Tali), 6 (доступность), 7
   (чего быть не должно). `docs/design/slice-screens-2026-10-24.md` §3 — раскладки на SE.
2. В коде: тип `LessonStep` и `LessonAnswer` (`domain/lessonSession.ts`), `Narrowing`,
   `activeResponseAfterShow`, `feedbackFor` (`domain/lessonFlow.ts`), тип задания в
   `types/task.ts`, `countSilhouette` (`domain/countLayout.ts`) — рендер кучек обязан рисовать то,
   что понимает гард.
3. Токены: `lessonLayout`, `touch`, `badge`, `icon`, `countSizes`, `numeralOption`, `symbolGlyph`,
   `countMark`, `listeningCue`, `selectedRepeatPress`, `orderMark*`, `orderFirstPlaceCue`,
   `orderEmptyPlaceTap`, `lessonTiming`, `progressSegment`, `selectedStroke`, `emptyOutlineColor`,
   `basketArt`. Чисел в компонентах формата нет — только токены; нет токена — добавь в
   `tokens.ts` с тестом, не хардкодь.
4. Общие примитивы, которые формат **использует, а не копирует**: `Tile` (состояния 2.3 поверх
   `CushionPressable`), значки `Badge`, `CountableShape`, `Basket`, `NumeralCard`, `ListeningCue`
   — `src/ui/lesson/`. Нет нужного — добавь туда, с тестом, и используй из формата.

## 1. Черновик ответа — `domain/taskDraft.ts`

Чистые функции, без React. Для формата:

- тип `XDraft` — что ребёнок собрал (выбранный элемент, пары, места …);
- `emptyXDraft(task, step)` — старт: для `order` — все в лотке; для `match` — пар нет;
- `xTap(draft, target, ctx)` — **единственная** точка касаний. Правила:
  - **повторный тап по выбранному состояние не меняет** (отклик — `selectedRepeatPress`);
  - действие (пара, перелёт, обмен, возврат) — только тапом по **цели**; после действия
    **выбор снят**; следующее касание — только выбор;
  - касание, которое ничего не меняет (пустое место без выбора, пара с собой), — не попытка:
    редьюсер возвращает тот же черновик и `effect` для голоса / отклика;
  - заблокированные / закреплённые / снятые элементы черновик не меняют (`locked` в `ctx`).
- `xAnswerOf(draft, task)` → `LessonAnswer | null` — `null`, пока ответ не собран
  («Проверить, недоступно»);
- `xAfterNarrowing(draft, task, step)` — что остаётся после первой ошибки: `kept` стоит,
  `pinned` закреплён, остальное возвращено (2.5); `removed` — заглушки;
- `xShown(task)` — полная верная раскладка для показа (2.4), `xWrongOf(draft, task)` — что
  помечается крестом на t = 0–220.

Тесты `domain/__tests__/taskDraft.test.ts` — на каждый пункт единого правила и каждую строку
таблицы действий формата из SCREENS.md; сужение по 2.5 (включая «закреплять только если неверных
≥ 3»); «сужать некуда» (2.6) приходит из оркестратора как `narrowing.kind === 'show'` — проверь,
что черновик переходит в показ.

## 2. Компонент формата — `ui/lesson/formats/<Format>Task.tsx`

Пропсы: `{ step, draft, phase, onTap, listening }` — `phase` из каркаса
(`'answer' | 'locked' | 'narrowing' | 'shown' | 'done'`), `listening` — id элемента, который
сейчас звучит (`listeningCue`). Компонент:

- раскладывает по таблице SE своего формата (§3 дизайн-дока, SCREENS.md 3.x) в зоне `X`; высота
  плиток по токенам, зазор `touch.gap` (focus — `spacing.lg` темы, откат на 16 всем форматом);
- состояние каждой плитки выводит из `step` + `draft` + `phase` → `Tile` (2.3): ожидание /
  выбрано / ждёт / заблокировано / ошибка / снят / закреплён / показан / верно / тень / место;
- **у каждого касания есть отклик** (SCREENS.md 7): снятое и тень не нажимаются, но не
  занимают место цели; заблокированное — посадка + «тук» (№140б); закреплённое — сжатие 0.98 и
  голос «это уже на месте»;
- озвучка по тапу — `voice.say(labelKey)`, кроме кучек (3.8) и немых карточек (3.8.1);
- `accessibilityLabel` / `accessibilityState` по разделу 6; снятые и тени скрыты от скринридера;
- анимации — RN `Animated` (перелёты `motion.base`, линейно в calm; reduce motion — без
  перехода). Reanimated — только если без него перелёт автораскладки не сделать, и только здесь.

Ничего из SCREENS.md 7 на экране нет: ни таймера, ни звёзд, ни второго `primary`, ни свайпа.

## 3. Подключение в каркас

`ui/lesson/LessonFrame.tsx` уже ведёт таймлайн ошибки (2.4), кнопку действия (1.5), пузырь и
Tali. Формат регистрируется в `ui/lesson/formats/index.ts` — таблица `format → { Component,
emptyDraft, tap, answerOf, afterNarrowing, shown, wrongOf }`. Каркас с форматом не знаком иначе.

## 4. Тесты экрана — `ui/lesson/__tests__/<Format>Task.test.tsx`

RNTL (`renderWithProviders`, всё `await`): выбор → «Проверить» доступна; верно → галочки,
«Дальше» после `lessonTiming.nextUnlock`; первая ошибка → крест, блокировка на время, сужение
по 2.5 и подсказка `hintKey` в пузыре; вторая → показ, активный ответ, «Дальше»; двойной тап по
«Проверить» — один `answer`; calm — контур 2, подушка 2; focus — поля 24; тёмная — `picturePlate`
под фигурами. Демо первой встречи (`step.demo`) — прерываемо касанием.

## 5. Проверка

`npm test`, `npm run typecheck`, `npm run lint`; Expo Web (`talentia-web` в `.claude/launch.json`)
на 375×667 в светлой, тёмной, calm. Затем агенты последовательно: `design-lead` (вид по
токенам и SCREENS.md) → `child-ux-specialist` (зоны, отклики, нагрузка). Блокер UX — назад к
`design-lead` с конкретным ограничением, не правь дизайн сам. Запись в журнал — `rebuild-log`.
