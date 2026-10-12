/**
 * Визуальный язык ABA-режима. Спецификация — «Визуальный язык» в `ABA.md`.
 *
 * Режим получается из «Живой гуаши» **вычитанием**: тот же язык без
 * цвета-украшения. Правило одной строкой: **в ABA цвет не бывает
 * дискриминативным стимулом.** Он кодирует только две вещи — где предмет, на
 * который смотреть (белая плита против песка), и накопленное подкрепление (жёлтый
 * жетон против пустого слота). Правильность ответа, цель и уровень подсказки,
 * позицию верного варианта — никогда.
 *
 * Запрещены целиком: цвета регионов, secondary, error, success, растр, градиенты,
 * эмодзи. Проверяет `__tests__/abaTokens.test.ts`.
 */
import type { PanelButton } from '../domain/abaScoring';
import type { RoutineRunKind } from '../types/aba';
import { parentColors } from './parentTokens';
import { motion, type Scheme } from './tokens';

export type AbaColors = {
  /** Фон экрана пробы. */
  background: string;
  /**
   * Плита стимула. Единственная поверхность, которая в тёмной теме **не
   * становится тёмной**: ребёнок учит этот конкретный стимул, и изображение на
   * тёмном фоне вечером и на светлом днём — по построению разные стимулы.
   * Поэтому в тёмной схеме только минус 20% яркости, рисунок не перекрашивается.
   */
  plate: string;
  /**
   * Контур плиты — **всегда тёмный**, в обеих схемах. Системное правило «в
   * тёмной теме контур светлеет» здесь ломается: светлый контур на светлой плите
   * даёт 1.12:1 — линия исчезает, а вместе с ней подсказка, построенная на ней.
   */
  plateOutline: string;
  /** Текст инструкции и метки подсказки — на фоне экрана. */
  ink: string;
  /** Пустой слот доски жетонов. Утоплен цветом заливки, не смещением — доска плоская. */
  tokenSlot: string;
  /** Контур пустого слота — пунктир. */
  tokenSlotOutline: string;
  /** Жёлтый существует только здесь — на заработанном жетоне. */
  tokenEarned: string;
  /** Контур жетона — контрастен к жёлтой заливке, а не к фону. */
  tokenOutline: string;
  /** Фиолетовый — только между пробами, на экране подкрепления, никогда рядом со стимулом. */
  reinforcement: string;
  onReinforcement: string;
  /**
   * Детские кнопки управления (выход, повтор, «перерыв»): заливка и контур. В зоне стимула
   * они не добавляют цветов — это те же `plate`/`ink`-тона: светлая — белая кнопка с
   * почти-чёрным контуром и глифом, тёмная — `surface` со светлым контуром и глифом (правило
   * «контур инвертируется»; плиты стимула оно не касается).
   */
  controlFill: string;
  controlInk: string;
};

export const abaColors: Record<Scheme, AbaColors> = {
  light: {
    background: '#FFF3E3',
    plate: '#FFFFFF', // к фону 1.09:1 — границу несёт только контур
    plateOutline: '#2A1A12', // к плите 16.73:1, к фону 15.28:1
    ink: '#2A1A12',
    tokenSlot: '#F2D9B8',
    tokenSlotOutline: '#2A1A12',
    tokenEarned: '#FFC42E', // к фону 1.45:1 — только с контуром
    tokenOutline: '#2A1A12', // к жёлтому 10.51:1
    reinforcement: '#5A34C4',
    onReinforcement: '#FFFFFF', // 7.71:1
    controlFill: '#FFFFFF',
    controlInk: '#2A1A12', // 16.73:1
  },
  dark: {
    background: '#1B1410',
    plate: '#EDE7DC', // к фону 14.79:1 — плита сама отделилась от фона
    plateOutline: '#2A1A12', // к плите 13.60:1; светлый дал бы 1.12:1
    ink: '#FFF3E3',
    tokenSlot: '#221A15',
    tokenSlotOutline: '#FFF3E3',
    tokenEarned: '#FFC42E', // тот же жёлтый: жетон — тот же объект вечером и днём
    tokenOutline: '#2A1A12',
    reinforcement: '#9B7CFF',
    onReinforcement: '#1B1410', // 5.82:1; белое дало бы ≈3:1 (правило перевода, tokens.ts)
    controlFill: '#2A211B',
    controlInk: '#FFF3E3', // 14.40:1
  },
};

/**
 * Панель взрослого в родительской тональности (Р6): полоса — `background` раздела, кнопка —
 * `card` + `hairline` + `text`; недоступная в этом окне кнопка — без заливки и **без границы**
 * (`borderDisabled` = цвет полосы: габарит и место те же, линии нет), подпись `textMuted`
 * (6.03 / 6.47 к полосе). Кнопка не исчезает — её держит подпись на том же месте. Недоступность
 * не рисуется прозрачностью и пунктиром: пунктир в ABA значит «здесь пусто» (слот жетона).
 */
export const abaAdultPanelColors = (scheme: Scheme) => {
  const p = parentColors[scheme];
  return {
    band: p.background,
    button: p.card,
    border: p.hairline,
    borderDisabled: p.background,
    label: p.text,
    labelDisabled: p.textMuted,
  };
};

/**
 * Контур плиты стимула. Спокойный режим понижает `stroke.base` 3 → 2, но у плиты
 * контур — единственная граница с фоном (1.09:1 по заливке), поэтому он не
 * понижается никогда.
 */
export const ABA_STIMULUS_STROKE = 3;

/**
 * Экран пробы сверху вниз, pt. Полоса подсказки резервируется **всегда**, даже
 * когда подсказки нет: если стимул при подсказке смещается, ребёнок выучивает
 * смещение, а не стимул.
 */
export const abaLayout = {
  /**
   * Полоса 68: слева выход 60 (+ подушка 4), справа детская карточка «перерыв» 64 (+ подушка
   * 4 = 68) — постоянное место (Р7). **Счётчика проб ребёнку нет** (I-3, В7 методиста: «Проба 3
   * из 10» превращается в срок, и к концу блока растёт протест; о длине блока говорит доска
   * жетонов). Центр полосы в сессии пуст; в прогоне рутины там точки звеньев (`abaRoutine.run`).
   */
  topBar: 68,
  tokenBoard: 48,
  gapAfterBoard: 32,
  /** Две строки инструкции зарезервированы всегда. */
  instruction: 72,
  hintBand: 40,
  /** Плита стимула 240×240 — без подушки: стимул не кнопка. */
  stimulus: 240,
  /** Панель взрослого крупного тира: 8 + 56 + 12 + 56 + 8 (Р6, У3), см. `abaAdultPanelTier`. */
  adultPanel: 140,
  /** Зазор между плитами, если их несколько. */
  plateGap: 24,
  /** Карточка «перерыв» 64×64: ≥ 60 и с запасом под подушку в полосе 68. */
  breakCard: 64,
} as const;

export type AbaLayoutSpec = { readonly [K in keyof typeof abaLayout]: number };

/**
 * Средний тир (iPhone SE, 667; окно ≥ 592 без запаса): зазор после доски 16, плита 200,
 * панель 124 (кнопки 48, зазор рядов 12). Плита постоянна на сессии — тир выбирается один
 * раз (`abaWindowPolicy`), а не от пробы к пробе: ребёнок выучил бы размер, а не стимул.
 */
export const abaLayoutCompact = { ...abaLayout, gapAfterBoard: 16, stimulus: 200, adultPanel: 124 } as const;

/**
 * Малый тир (360×640 с трёхкнопочной навигацией, доступно 568): зазор 8, плита 176, панель та же
 * 124, что в среднем (зазор рядов 12: «Сопротивляется» над «Отказ» не путаются тапом). Полосу
 * подсказки 40 и цели 60 pt не трогаем: стимул не смещается, ребёнку по-прежнему попасть.
 * Высота 536; 568 − 536 = 32 ≥ 24.
 */
export const abaLayoutTight = { ...abaLayoutCompact, gapAfterBoard: 8, stimulus: 176 } as const;

export type AbaTier = 'roomy' | 'compact' | 'tight';

/** Раскладки тиров от крупного к малому. */
export const abaLayoutByTier: Record<AbaTier, AbaLayoutSpec> = {
  roomy: abaLayout,
  compact: abaLayoutCompact,
  tight: abaLayoutTight,
};

/** Мёртвая зона между плитой и панелью взрослого: свободное поле, без `hitSlop` вверх у панели. */
export const ABA_DEAD_ZONE_MIN = 24;
/**
 * Мёртвая зона крупного тира: промах ребёнка 4–6 лет ≈ 60 pt, поэтому где тир позволяет —
 * 32 (В1). Средний и малый держат минимум 24 и компенсируют блокировкой панели после тапа
 * ребёнка (`abaAdultPanel.childTapLockMs`).
 */
export const ABA_DEAD_ZONE_ROOMY = 32;
/** Мёртвая зона, ниже которой тир не выбирается, по тирам. */
export const abaDeadZoneMin: Record<AbaTier, number> = {
  roomy: ABA_DEAD_ZONE_ROOMY,
  compact: ABA_DEAD_ZONE_MIN,
  tight: ABA_DEAD_ZONE_MIN,
};
/**
 * Запас под то, что `abaLayoutHeight` не знает (жестовая полоса, вырезы, поля экрана).
 * Плавный, без скачка на границе: `max(0, 24 − insetBottom × 1.5)` — 24 при нижней safe area 0,
 * 12 при 8, 1.5 при 15, 0 с 16. Нижняя safe area уже вычтена из доступной высоты, поэтому
 * запас убывает вместе с ней, а не считается дважды.
 */
export const ABA_SAFE_RESERVE = 24;
export const ABA_RESERVE_INSET_BOTTOM = 16;
export const ABA_RESERVE_SLOPE = ABA_SAFE_RESERVE / ABA_RESERVE_INSET_BOTTOM; // 1.5

/** Высота блоков экрана пробы сверху вниз (без свободного поля). */
export function abaLayoutHeight(l: AbaLayoutSpec): number {
  return l.topBar + l.tokenBoard + l.gapAfterBoard + l.instruction + l.hintBand + l.stimulus + l.adultPanel;
}

/** Запас, который нужно вычесть из доступной высоты при данной нижней safe area. */
export function abaReserve(insetBottom: number): number {
  return Math.max(0, ABA_SAFE_RESERVE - insetBottom * ABA_RESERVE_SLOPE);
}

/**
 * Доступная высота = высота **корневого контейнера экрана внутри safe area**, снятая `onLayout`
 * (В-4). Не `useWindowDimensions().height − insets`: на Android edge-to-edge (SDK 54) окно уже
 * включает системные панели, а в прежнем режиме — не включает, и вычитание insets задваивается
 * (360×640: 544 вместо 568). `onLayout` даёт то, что реально осталось, в обоих режимах.
 * Дробные значения округляются вниз.
 */
export function abaAvailableHeight(rootLayoutHeight: number): number {
  return Math.floor(rootLayoutHeight);
}

/** Минимальная доступная высота (окно минус верхняя и нижняя safe area), при которой ABA включается. */
export function abaMinAvailableHeight(insetBottom: number): number {
  return abaLayoutHeight(abaLayoutTight) + ABA_DEAD_ZONE_MIN + abaReserve(insetBottom);
}
/** Без запаса (нижняя safe area ≥ 16): 560. Без нижней safe area (полный запас 24): 584. */
export const ABA_MIN_AVAILABLE_HEIGHT = abaMinAvailableHeight(ABA_RESERVE_INSET_BOTTOM);

/**
 * Тир по доступной высоте (`abaAvailableHeight`: корневой контейнер внутри safe area) и нижней safe
 * area. Берётся самый крупный тир, у которого остаётся мёртвая зона не меньше своей нормы
 * сверх запаса; ни один не подходит — `null`: режим на этом окне не включается.
 */
export function abaTierFor(availableHeight: number, insetBottom: number): AbaTier | null {
  const room = availableHeight - abaReserve(insetBottom);
  for (const tier of ['roomy', 'compact', 'tight'] as const) {
    if (room - abaLayoutHeight(abaLayoutByTier[tier]) >= abaDeadZoneMin[tier]) return tier;
  }
  return null;
}

export function abaLayoutFor(availableHeight: number, insetBottom: number): AbaLayoutSpec | null {
  const tier = abaTierFor(availableHeight, insetBottom);
  return tier ? abaLayoutByTier[tier] : null;
}

/** Фактическая мёртвая зона между плитой и панелью (без вычета запаса). */
export function abaDeadZone(tier: AbaTier, availableHeight: number): number {
  return availableHeight - abaLayoutHeight(abaLayoutByTier[tier]);
}

/**
 * Политика окна — **запрет с причиной** (решение №100, Г9; пересмотр №97 «только
 * предупреждение»: при нём `abaTierFor` давал `null` и показывать пробу было нечем). Тир
 * выбирается **один раз на сессию**, плиты на лету не пересчитываются. Три шага:
 *
 * 1. Родительский экран при включении режима — мягкая **оценка** «возможно, экрану мало места»,
 *    кнопка включения НЕ блокируется (`parentScreenBlocks: false`): оценка по размеру окна на
 *    родительском экране — не приговор.
 * 2. Окончательная проверка — **при старте пробы** по `onLayout` экрана пробы: `abaTierFor` даёт
 *    `null` → ребёнок пробу не видит, взрослому — экран «экран слишком мал для режима» с двумя
 *    кнопками высотой 56: «Обычные уроки» и «Назад».
 * 3. Сжатие окна в сессии (мультиоконность, поворот, складной экран) — **пауза**: плита и доска
 *    скрыты, проба в работе уходит в очередь с `interruptedBy: 'app'`, взрослому — карточка
 *    «верните размер окна», панель закреплена внизу над системной полосой; перестройки нет.
 */
export const abaWindowPolicy = {
  tierChosen: 'once_per_session',
  parentScreen: 'soft_estimate',
  parentScreenBlocks: false,
  finalCheck: 'on_trial_start',
  belowMin: 'block_with_reason',
  belowMinReason: 'screen_too_small',
  belowMinButtons: ['regular_lessons', 'back'],
  /** Кнопки экрана «слишком мал» — взрослые, но крупные: рука может быть с ребёнком на коленях. */
  belowMinButtonHeight: 56,
  childSeesTrial: false,
  onWindowChange: 'pause',
  pause: {
    stimulusHidden: true,
    trialInterruptedBy: 'app',
    requeue: true,
    adultCard: 'restore_window_size',
    panelPinnedBottom: true,
    relayout: false,
  },
} as const;

/** Экран пробы — только портрет: в ландшафте телефон даёт ≈ 360 pt высоты, это ни один тир. */
export const ABA_ORIENTATION = 'portrait' as const;

/**
 * Зона стимула при выборе (`match`, сортировка): образец + зазор + ряд плит. Сумма равна
 * высоте плиты, поэтому экран с выбором не выше экрана с одной плитой. Три плиты в ряд:
 * 3 × 96 + 2 × 24 = 336, 3 × 88 + 2 × 24 = 312 и 3 × 72 + 2 × 24 = 264 — все ≤ 343 (SE).
 * Плиты ≥ 60 (`touch.min`) в каждом тире.
 */
export const abaChoiceZone = {
  regular: { sample: 120, choice: 96 },
  compact: { sample: 88, choice: 88 },
  tight: { sample: 80, choice: 72 },
} as const;

/** Управление: выход с удержанием, повтор, карточка «перерыв». */
export const abaControls = {
  exitSize: 60,
  /**
   * Удержание выхода. Первые `exitHoldIdleMs` — без отклика (случайное касание ничего не
   * показывает), затем кольцо; отпустил — отмена. 800 мс было слишком мало для взрослого,
   * 1500 — ребёнок до конца не удержит (`child-ux-specialist`, Р6).
   */
  exitHoldMs: 1500,
  exitHoldIdleMs: 300,
  replaySize: 60,
  adultButton: 48,
  /** Детская карточка «перерыв» (assent, ABA.md, «Согласие ребёнка»): правый край верхней полосы. */
  breakSize: 64,
  /** От плит стимула и вариантов не ближе. */
  breakMinGapToPlate: 48,
  /** От кнопки повтора не ближе. */
  breakMinGapToReplay: 24,
  /**
   * Поле справа от карточки «перерыв»: жест «назад» Android забирает край экрана. Тот же
   * отступ слева у выхода — полоса симметрична. «Перерыв» — `accessibilityLabel`
   * (через `t()`); карточку обучают настоящим перерывом 15–20 с (`abaBreak`, SCREENS.md 8.1).
   */
  edgeInset: 16,
  /**
   * Короткий тап по выходу (отпустил раньше `exitHoldMs`) — тихая подсказка «держите»: статичная
   * иконка «палец + кольцо» рядом с кнопкой на `exitHintMs`, без движения и звука (так же в
   * calm и reduce motion). Тап по выходу не выходит. Для скринридера и переключателей выход
   * доступен как `accessibilityAction` — удержание им не нужно.
   */
  exitTapHint: { icon: 'finger_ring', durationMs: 1200, animated: false },
  exitAccessibilityAction: true,
} as const;

/** Инструкция экрана пробы: кегль Subtitle (30 межстрочный) ×1.2 × 2 строки = 72 — ровно её слот. */
export const abaInstruction = { maxFontSizeMultiplier: 1.2, lines: 2, lineHeight: 30 } as const;

/** Контур детской кнопки в ABA не понижается в calm: на плите и рядом с ней он несёт границу. */
export const ABA_CONTROL_STROKE = 3;

/**
 * Размеры панели по тирам (Р6, В3, У3): `padding + button + rowGap + button + padding`.
 * Зазор рядов 12 во всех трёх тирах: «Сопротивляется» (ряд 1) стоит над «Отказ» (ряд 2) —
 * при 8 их можно было спутать тапом. Кнопка крупного тира 56, зазор колонок 12 — там хватает
 * высоты и ширины.
 */
export const abaAdultPanelTier: Record<
  AbaTier,
  { height: number; rowGap: number; colGap: number; buttonHeight: number }
> = {
  roomy: { height: 140, rowGap: 12, colGap: 12, buttonHeight: 56 },
  compact: { height: 124, rowGap: 12, colGap: 8, buttonHeight: 48 },
  tight: { height: 124, rowGap: 12, colGap: 8, buttonHeight: 48 },
};

/**
 * Панель взрослого (Р6). Два ряда внутри панели (`abaAdultPanelTier`). Ряд 1 — три слота с
 * весами `colWeights` (средняя шире: в ней «Почти» и «Сопротивляется»), ряд 2 — два равных
 * широких. Позиции **фиксированы**: скрытая «Почти» (цель оценивает устройство) — пустой слот;
 * вне окна ответа кнопки недоступны, но не исчезают; «Отказ» всегда в ряду 2 справа. Кнопки
 * окна ответа и карточки L4 делят слоты — на экране одновременно одна из групп.
 * `hitSlop` вверх — 0: между плитой и панелью мёртвая зона.
 */
export const abaAdultPanel = {
  padding: 8,
  slotsPerRow: [3, 2],
  colWeights: [1, 1.25, 1],
  hitSlopUp: 0,
  /** Подпись — родительский `caption` 14/20, до двух строк. */
  labelLines: 2,
  /** Горизонтальное поле внутри кнопки (было 8): «Сопротивляется» ≈ 110 pt в слоте 126. */
  labelPadX: 4,
  /** Потолок системного шрифта: 2 строки × 20 × 1.2 = 48 — ровно кнопка, вертикальных полей нет. */
  maxFontSizeMultiplier: 1.2,
  /** Ужатие длинной подписи вместо третьей строки. */
  minimumFontScale: 0.86,
  /**
   * Тап ребёнка (по плите или мимо) ставит нажатия панели «в очередь» на это время. Честно о
   * границах (В-2): окно защищает только **вторую** часть цепочки «плита → панель» (ребёнок
   * тапнул, а следом рука взрослого попадает в панель). **Первую** — промах ладонью сразу по
   * кнопке панели — закрывают мёртвая зона и «взрослый вид» панели, не окно.
   */
  childTapLockMs: 400,
  /**
   * Правила окна (Г2, методист Б3, UX B-1). Окно открывается первым тапом ребёнка и **не
   * продлевается** серией; следующий тап после снятия открывает новое окно. Прежняя редакция
   * («тапы взрослого в окне гасятся без отклика», потолок серии 1000 мс) теряла «Отказ» и
   * «Сопротивляется» без следа: при протесте 4–6 тапов/с панель была закрыта почти непрерывно, а
   * взрослый не знал, что записи нет, и жал повторно. Теперь нажатие НЕ теряется:
   * - кнопка показывает «нажата» не позже `pressedStateMaxMs` (`adultTapFeedback: 'pressed_queued'`);
   * - действие применяется по снятии окна, не позже `applyAfterWindowMaxMs` после тапа ребёнка;
   * - `respondedAt` = момент касания взрослого (`touch_down`), а не момент применения;
   * - две кнопки в одном окне — применяется первая (`first_wins`), вторая гасится;
   * - `neverBlocked` — «Отказ» и «Сопротивляется» применяются сразу, как выход и «перерыв»;
   * - ошибочную кнопку страхует «Исправить отметку» (`undo`, 5 с).
   * После первой отметки обе группы кнопок недоступны до следующего окна ответа (двойное
   * нажатие).
   */
  childTapLock: {
    extendedBySeries: false,
    adultTapFeedback: 'pressed_queued',
    pressedStateMaxMs: 100,
    applyAfterWindowMaxMs: 400,
    respondedAt: 'touch_down',
    twoButtonsInWindow: 'first_wins',
    neverBlocked: ['refusal', 'l4_resisted'] as readonly PanelButton[],
    lockAfterMark: true,
    triggeredByBreakOrExit: false,
  },
  /**
   * «Исправить последнюю отметку» (В-1). Живёт не дольше 5 с **и не дольше фазы подкрепления**:
   * открытие следующего окна ответа немедленно возвращает ряд 2 («Я подсказал(а)» + «Отказ»),
   * отмена исчезает, а не вытесняет. Кнопка — в **левом слоте** ряда 2 (место «Я подсказал(а)»),
   * не на всю ширину; правый слот («Отказ») остаётся недоступным без поля, поэтому позиция
   * «Отказ» с позицией отмены не пересекается (недоступность правого слота — от фазы подкрепления,
   * а не от окна защиты `childTapLock`). Один уровень: после тапа кнопка исчезает, повтор ничего
   * не стирает. Процедура отмены — ABA.md «Отмена отметки и карточка «перерыв»» (№99): журнал
   * только дописывается, жетон не отнимается, окно закрывается с началом следующего SD.
   */
  undo: { windowMs: 5000, row: 1, col: 0, span: 'slot', levels: 1, endsWith: 'reinforcement_phase' },
} as const;

/** Слот кнопки: ряд 0 или 1, колонка в ряду. `undo` — не кнопка окна ответа, но делит слот ряда 2. */
export const abaAdultPanelSlot: Record<PanelButton | 'undo', { row: 0 | 1; col: 0 | 1 | 2 }> = {
  undo: { row: 1, col: 0 },
  correct: { row: 0, col: 0 },
  approximation: { row: 0, col: 1 },
  incorrect: { row: 0, col: 2 },
  adult_prompted: { row: 1, col: 0 },
  refusal: { row: 1, col: 1 },
  // карточка L4 (после провала на модели): L4 в первом ряду, «звено сам» на месте «Я подсказал(а)»
  l4_done: { row: 0, col: 0 },
  l4_resisted: { row: 0, col: 1 },
  l4_skipped: { row: 0, col: 2 },
  adult_completed: { row: 1, col: 0 },
};

/** Группы кнопок, которые бывают на панели вместе: слоты внутри группы не пересекаются. */
export const abaAdultPanelStages = {
  answerWindow: ['correct', 'approximation', 'incorrect', 'adult_prompted', 'refusal'],
  l4Card: ['l4_done', 'l4_resisted', 'l4_skipped', 'adult_completed', 'refusal'],
} as const satisfies Record<string, readonly PanelButton[]>;

/**
 * Фаза подкрепления: на панели только отмена, во времени не пересекается с окном ответа
 * (делит с «Я подсказал(а)» слот, но не существует одновременно с ним).
 */
export const abaAdultPanelUndoStage = ['undo'] as const;

/**
 * Доска жетонов. **Жетоны не интерактивны**, поэтому правило `touch.min` 60 pt к
 * ним не применяется — это зафиксировано здесь, чтобы размер не отметили как дефект.
 *
 * **Жетоны плоские** (решения №10, №69; `cushionByRole.abaToken` в `tokens.ts`): подушка
 * значит «нажми меня», а жетон не нажимается — с подушкой ребёнок тыкал бы в доску
 * вместо стимула. Calm понижает общий контур 3 → 2, но контур жетона остаётся 3:
 * у пустого слота он — пунктир, и тоньше 3 pt пунктир на 32 pt перестаёт читаться.
 */
export const abaTokenBoard = {
  interactive: false,
  /** Рекомендуемый размер в полосе пробы: на 390 pt помещается пять. */
  size: 48,
  /** Доска в полосе пробы на экране шириной ≤ `narrowWidth` (Г8, I-8): ячейка 44. */
  sizeNarrow: 44,
  narrowWidth: 360,
  /** Предел ряда — восемь по 32 pt. */
  minSize: 32,
  maxPerRow: 8,
  /** Зазор между ячейками. */
  gap: 8,
  /** Крупная доска (экран подкрепления): ячейка не больше. */
  largeMax: 64,
  stroke: 3,
} as const;

/** Ячейка доски в полосе пробы по ширине экрана. */
export function abaStripCell(screenWidth: number): number {
  return screenWidth <= abaTokenBoard.narrowWidth ? abaTokenBoard.sizeNarrow : abaTokenBoard.size;
}

/**
 * Ячейка крупной доски (экран подкрепления, перерыв, выбор подкрепителя) для `n` ячеек в ряд
 * (Г8): `min(64, 4·floor((inner − (n − 1)·8)/(4n)))`, где `inner` — ширина контента (экран
 * минус 2×16), кратно 4. Для пяти ячеек это `min(64, 4·floor((inner − 32)/20))`: 64 на 390, 60 на
 * 375, 56 на 360. Прежние 5 × 64 + 4 × 8 = 352 не помещались в 328 (экран 360).
 */
export function abaBoardCell(inner: number, n = 5): number {
  const gaps = (n - 1) * abaTokenBoard.gap;
  return Math.min(abaTokenBoard.largeMax, 4 * Math.floor((inner - gaps) / (4 * n)));
}

/**
 * Карточка выбора подкрепителя (экран 2.3, Г8): три карточки — две в ряд, одна под ними.
 * Сторона квадрата — `min(160, floor((W − 16)/2), floor((H − 72 − 48 − 88 − 64 − 16)/2))`,
 * где `W` — ширина контента, `H` — доступная высота экрана; 72 инструкция, 48 доска, 88
 * кнопка, 64 — четыре зазора по 16, 16 — зазор между рядами карточек. Прежние 160×160
 * давали 2 × 160 + 16 = 336 > 328 и не помещались на экране 360.
 */
export const abaReinforcerCard = {
  max: 160,
  gap: 16,
  /** Вертикальные блоки экрана, pt: инструкция + доска + кнопка + четыре зазора + зазор между рядами. */
  reservedHeight: 72 + 48 + 88 + 64 + 16,
} as const;

export function abaReinforcerCardSize(contentWidth: number, availableHeight: number): number {
  return Math.min(
    abaReinforcerCard.max,
    Math.floor((contentWidth - abaReinforcerCard.gap) / 2),
    Math.floor((availableHeight - abaReinforcerCard.reservedHeight) / 2),
  );
}

/**
 * Состояние ячейки доски. Пустой и заработанный различаются **тремя** признаками —
 * заливкой, контуром (пунктир / сплошной) и звездой; ни прозрачностью, ни рельефом: доска
 * плоская во всех состояниях (подушки нет ни у пустой, ни у заработанной; пустая «утоплена»
 * только цветом заливки). «Сам» и «с подсказкой» различает одна звезда — сплошная или
 * контурная. Обесцветьте доску — останутся контур и звезда.
 */
export type TokenCellStyle = {
  fill: 'slot' | 'earned';
  outline: 'dashed' | 'solid';
  star: 'none' | 'solid' | 'outline';
};

export const tokenCell: Record<'empty' | 'earnedIndependent' | 'earnedPrompted', TokenCellStyle> = {
  empty: { fill: 'slot', outline: 'dashed', star: 'none' },
  earnedIndependent: { fill: 'earned', outline: 'solid', star: 'solid' },
  earnedPrompted: { fill: 'earned', outline: 'solid', star: 'outline' },
};

/**
 * Уровни подсказки без цвета — по формату экрана выбора (Р5; домен — `promptVisualFor` в
 * `abaPrompting.ts`, токены обязаны ему соответствовать, это проверяет `abaTokens.test.ts`).
 * Каналы: форма метки и то, над чем она стоит, толщина контура верной плиты, какие плиты
 * активны, направляющая. Обесцветьте экран — уровни останутся различимы. **Движение уровень
 * не несёт**: пульс образца — только дополнение к метке, в calm и reduce motion его нет.
 *
 * Метка ставится **над** плитой: слева от крайней она уходит за край, а в зазор 24 pt
 * легибельную стрелку не поставить.
 *
 * - `identify` — жест к верной плите и есть ответ (`highlightCorrect`): метка над верной с L1,
 *   контур 6 с L2, на L3 активна только она. Пунктирной направляющей нет (Г5): в полосе
 *   подсказки 40 от метки 32 до плиты остаётся ≈ 8 pt, на таком отрезке пунктир нечитаем, а L2
 *   и L3 различает число активных плит.
 * - `match` и сортировка — L1–L2 ответа не раскрывают: L1 — метка и пульс над образцом (над
 *   предметом у сортировки), верная не выделена; L2 — активны верная и один случайный
 *   дистрактор (у выбора из двух L2 нет), остальные неактивны; L3 — активна только верная,
 *   метки нет. Выделения верной плиты нет ни на каком уровне.
 * - `single` — одна плита (эхоика, подражание, действие, громкость; Г5): L0, L1 (открытый
 *   шеврон 32 над плитой), L3 (сплошной треугольник и контур 6). У эхоики и подражания L2 нет
 *   вообще (лестница L0 → L1 → L3, ABA.md); у действия и громкости экран L2 = экран L3, а L2 от
 *   L3 различают звук или анимация модели и панель взрослого (`promptVisualSingleLevel`).
 * - L4 на экране как L3 (`adultPhysical` меняет только панель взрослого).
 */
export type PromptVisual = {
  mark: 'none' | 'chevron_open' | 'triangle_solid';
  /** Над чем метка: над верной плитой (`identify`), образцом / предметом (`match`), единственной плитой (`single`). */
  markOn: 'none' | 'correct_choice' | 'source' | 'plate';
  markSize: number;
  /** Однократный пульс 1 → `PROMPT_PULSE.scale` → 1 при появлении метки; только `match`, L1. */
  pulse: boolean;
  /** Контур верной плиты; утолщается внутрь — габарит и зона нажатия не меняются. */
  plateStroke: number;
  /** Какие плиты выбора принимают нажатие; остальные — `inactiveChoice`. */
  activeChoices: 'all' | 'correct_and_one' | 'correct_only';
  /** Направляющей нет нигде (Г5): тип оставлен, чтобы тест ловил её возвращение. */
  guide: 'none';
};

const NO_PROMPT: PromptVisual = {
  mark: 'none',
  markOn: 'none',
  markSize: 0,
  pulse: false,
  plateStroke: ABA_STIMULUS_STROKE,
  activeChoices: 'all',
  guide: 'none',
};

export const promptVisual: {
  identify: Record<0 | 1 | 2 | 3, PromptVisual>;
  match: Record<0 | 1 | 2 | 3, PromptVisual>;
  /** Одна плита: уровня 2 в таблице нет (см. `promptVisualSingleLevel`). */
  single: Record<0 | 1 | 3, PromptVisual>;
} = {
  identify: {
    0: NO_PROMPT,
    1: { ...NO_PROMPT, mark: 'chevron_open', markOn: 'correct_choice', markSize: 32 },
    2: { ...NO_PROMPT, mark: 'triangle_solid', markOn: 'correct_choice', markSize: 32, plateStroke: 6 },
    3: {
      ...NO_PROMPT,
      mark: 'triangle_solid',
      markOn: 'correct_choice',
      markSize: 32,
      plateStroke: 6,
      activeChoices: 'correct_only',
    },
  },
  match: {
    0: NO_PROMPT,
    1: { ...NO_PROMPT, mark: 'chevron_open', markOn: 'source', markSize: 32, pulse: true },
    2: { ...NO_PROMPT, activeChoices: 'correct_and_one' },
    3: { ...NO_PROMPT, activeChoices: 'correct_only' },
  },
  single: {
    0: NO_PROMPT,
    1: { ...NO_PROMPT, mark: 'chevron_open', markOn: 'plate', markSize: 32 },
    3: { ...NO_PROMPT, mark: 'triangle_solid', markOn: 'plate', markSize: 32, plateStroke: 6 },
  },
};

/**
 * Какой из трёх экранов одной плиты показывать на данном уровне подсказки. L2 (есть только у
 * стандартной лестницы: действие и громкость с инструкцией) выглядит как L3 — отличает его звук
 * или анимация модели и панель взрослого, не рисунок плиты; L4 на экране тоже как L3
 * (`adultPhysical` меняет панель). У эхоики и подражания L2 не бывает (лестница `imitative`).
 */
export function promptVisualSingleLevel(level: 0 | 1 | 2 | 3 | 4): 0 | 1 | 3 {
  if (level === 0) return 0;
  if (level === 1) return 1;
  return 3;
}

/**
 * Неактивная плита выбора: **приглушена, не скрыта** — позиции не меняются (перестройка сетки
 * сама была бы подсказкой местом). Штриховка 45° цветом **`plateOutline`** (Г6; не `ink`: в
 * тёмной схеме `ink` светлый `#FFF3E3`, а плита `#EDE7DC` — ≈ 1.2:1, и L3 не читался;
 * `plateOutline` `#2A1A12` даёт 16.73:1 / 13.60:1), подушки нет, контур сплошной 3 (пунктир
 * значит «пусто»), прозрачности нет. Нажатие по ней ничего не делает (`reactsToTap`) и не
 * пишется; экранному чтецу она не доступна. Но касание не остаётся молчаливым (I-6): плита
 * сжимается `tapPress` и возвращается — без звука и без записи.
 */
export const inactiveChoice = {
  pattern: 'hatched_45',
  hatchStroke: 2,
  hatchStep: 8,
  /** Calm: реже штрихи — меньше мелькающей текстуры; толщина штриха 2 остаётся. */
  hatchStepCalm: 12,
  /** Цвет штриховки — поле `AbaColors`, одно и то же в обеих схемах (`inactiveHatchColor`). */
  hatchColor: 'plateOutline',
  cushion: false,
  /** Действия нет: ответ не принимается и не пишется. */
  reactsToTap: false,
  /** Видимый отклик на касание, как у широких плоских (0.98 за `motion.press`), в calm тот же. */
  tapPress: { scale: 0.98, durationMs: motion.press, sound: false, records: false },
  hiddenFromScreenReader: true,
} as const;

/** Цвет штриховки неактивной плиты в данной схеме — всегда контур плиты. */
export function inactiveHatchColor(scheme: Scheme): string {
  return abaColors[scheme][inactiveChoice.hatchColor];
}

/**
 * Пульс образца на L1 `match`: один раз, `motion.slow`. Масштабируется **образец** (120 / 88 / 80),
 * не плита зоны: 1.04 — до 2.4 pt за край образца, внутри зоны стимула, соседей и полосы подсказки
 * пульс не задевает.
 */
export const PROMPT_PULSE = { scale: 1.04, durationMs: motion.slow, count: 1 } as const;

/** Контур утолщается внутрь плиты: внешний габарит стимула не зависит от уровня. */
export const PLATE_STROKE_INSET = true;

/* ───────────────── перерыв: один экран для трёх инициаторов (Г3) ───────────────── */

/**
 * Экран перерыва (DESIGN_PROMPTS.md 2.4, 2.4а; SCREENS.md 8.1; ABA.md «Отмена отметки и карточка
 * «перерыв»»). Один экран на трёх инициаторов — карточка ребёнка, расписание, предложение
 * устройства. Обучение карточке — **настоящий перерыв** 15–20 с (№99), а не «касание без
 * награды»: касание без последствия гасит просьбу.
 *
 * Для карточки: без Tali, жетонов, доски, похвалы и выбора подкрепителя; иконка «две планки»
 * 120 в кольце-таймере 160 без чисел (в calm — шагами по 1 с), внизу кнопка «Вернуться» 88.
 * Приглашение вернуться — по окончании таймера и через 30 с: один тихий сигнал и статичный
 * контур 6, без пульса и эскалации; после второго приглашения и ещё 30 с без касания — конец
 * сессии нейтральным экраном (без Tali-прощания и «молодец»). Вне пробы карточка как просьба не
 * принимается (№106).
 */
export const abaBreak = {
  initiators: ['child_card', 'schedule', 'device_offer'],
  /** Обучающий перерыв по карточке (№99). */
  trainingSeconds: { min: 15, max: 20 },
  /** Касание карточки → экран перерыва. */
  reactionMaxMs: 300,
  /** Иконка «две планки» внутри кольца. */
  icon: 120,
  timerRing: 160,
  timerNumbers: false,
  /** Calm и reduce motion: заполнение шагами по 1 с, не плавной развёрткой. */
  timerCalmStepMs: 1000,
  returnButton: 88,
  /** Tali на экране перерыва: у карточки ребёнка слот пуст (место не занято). */
  taliSlot: { child_card: false, schedule: true, device_offer: true },
  childCardShows: { tali: false, tokens: false, praise: false, choice: false },
  invite: {
    atTimerEnd: true,
    repeatAfterMs: 30_000,
    signalsPerInvite: 1,
    /** Статичный контур вокруг «Вернуться»: толщина = `stroke.bold`. */
    contour: 6,
    pulse: false,
    escalation: false,
    invitesBeforeEnd: 2,
    endAfterLastInviteMs: 30_000,
  },
  endScreen: { tali: false, farewell: false, praise: false },
  /** «Tali предлагает перерыв» между пробами (две пробы без активности в «Сам»). */
  offer: { tali: 88, card: 120, cardIcon: 64, nextButton: 88, minGapCardToNext: 48, gapTaliToCard: 24 },
  /** Решение №106: вне пробы (подкрепление, переход, обмен, перерыв) карточка просьбой не принимается. */
  outsideTrialCardAccepted: false,
} as const;

/* ───────────────── calm в ABA (V10, I-4) ───────────────── */

/**
 * Calm на экране подкрепления: жетон появляется НА СВОЁМ МЕСТЕ без падения; плашка подкрепления
 * контурная (заливка фона, контур 3 цветом `reinforcement`, текст `ink`), а не залитая
 * фиолетовым — самая насыщенная площадь режима. Залитая площадь цвета подкрепления — не более
 * `maxFilledShare` экрана.
 */
export const abaCalm = {
  tokenArrival: 'in_place',
  reinforcementPanel: 'outline_only',
  panelStroke: 3,
  maxFilledShare: 0.25,
} as const;

/* ───────────────── рутины самообслуживания (Г8) ───────────────── */

/** Ключи подписей вида прогона (`t()`; русские слова — «Базовая линия» · «Обучение» · «Поддержание» · «Проверка дома»). */
export const abaRoutineKindLabelKey: Record<RoutineRunKind, string> = {
  baseline: 'abaRoutine.kind.baseline',
  teaching: 'abaRoutine.kind.teaching',
  maintenance: 'abaRoutine.kind.maintenance',
  verification: 'abaRoutine.kind.verification',
};

/**
 * Экраны рутины (DESIGN_PROMPTS.md 2.7–2.10). Список «ждут прогона» — взрослая тональность
 * (строка 64 ≥ `touchAdult`); расписание до старта — ребёнок смотрит картинки звеньев, плиты не
 * нажимаются (60 pt к ним не применяется); прогон — экран пробы, где плита = картинка текущего
 * звена, а центр верхней полосы занимает прогресс звеньев точками (счётчика проб нет).
 * Жетон рутины ребёнку показывается ≤ 3 с после последнего звена; запись и PIN — после.
 */
export const abaRoutine = {
  dueList: { rowHeight: 64, picture: 40, doneTodayPosition: 'bottom', doneTodayActive: false },
  schedule: {
    interactive: false,
    gap: 8,
    /** 5–6 лет: один ряд до 5 плит по 56: 5 × 56 + 4 × 8 = 312. */
    band56: { tile: 56, maxSteps: 5, perRow: 5 },
    /** С 7 лет: две строки по 4 плиты 72: 4 × 72 + 3 × 8 = 312. */
    band7: { tile: 72, maxSteps: 8, perRow: 4 },
  },
  run: {
    /** Плита стимула — картинка текущего звена (`AbaChainStep.image`). */
    plate: 'step_picture',
    trialCounterForChild: false,
    /**
     * Точки звеньев в центре верхней полосы: пройдено — сплошной диск 14; текущее — кольцо 16 с
     * контуром 3 и точкой 6; впереди — пустое кольцо 14 с контуром 2. Три состояния различаются
     * формой, цвет один.
     */
    dots: { done: 14, upcoming: 14, current: 16, gap: 8, currentStroke: 3, upcomingStroke: 2, centerDot: 6, max: 8 },
  },
  reward: {
    /** Жетон ребёнку — не позже, чем через столько после отметки последнего звена. */
    childSeesTokenWithinMs: 3000,
    commitAfter: 'adult_form',
    /** PIN после каждого прогона не спрашивается: «взрослый режим рутины» на 10 минут. */
    pinAfterEveryRun: false,
    biometrics: false,
    adultModeMinutes: 10,
    adultModeScope: 'routines_only',
    formRowHeight: 56,
  },
  /** Новый выбор после обмена рутины (`reinforcerStale`) — экран 2.3 без вступления. */
  reinforcerRepick: { screen: 'reinforcer_choice', intro: false },
} as const;
