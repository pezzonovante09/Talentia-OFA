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
   * Полоса 68: слева выход 60 (+ подушка 4), в центре счётчик «Проба 3 из 10» (ненажимаемый
   * Caption), справа детская карточка «перерыв» 64 (+ подушка 4 = 68) — постоянное место (Р7).
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
 * Политика окна (Б1). Тир выбирается **один раз на сессию**, плиты на лету не пересчитываются:
 * смена окна (мультиоконность, поворот, складной экран) — предупреждение взрослому на панели,
 * не перестройка. Окно ниже `ABA_MIN_AVAILABLE_HEIGHT` — предупреждение взрослому на
 * родительском экране при включении режима, не посреди сессии (запрещать ли — решает
 * владелец, REBUILD.md). Предупреждение — причина с выходом, не только блок: «экран слишком
 * мал для режима» + действия «вернуться» и «оставить обычные уроки» (кнопка включения остаётся
 * недоступной, но объяснённой).
 */
export const abaWindowPolicy = {
  tierChosen: 'once_per_session',
  onWindowChange: 'warn_adult_no_relayout',
  belowMin: 'warn_adult_on_enable',
  belowMinReason: 'screen_too_small',
  belowMinHasExit: true,
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
   * (через `t()`), карточку вводят в начале сессии (SCREENS.md, 8.1).
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
   * Тап ребёнка (по плите или мимо) блокирует панель на это время. Честно о границах (В-2):
   * блокировка защищает только **вторую** часть цепочки «плита → панель» (ребёнок тапнул, а
   * следом рука взрослого попадает в панель). **Первую** — промах ладонью сразу по кнопке
   * панели — закрывают мёртвая зона и «взрослый вид» панели, не блокировка.
   */
  childTapLockMs: 400,
  /**
   * Правила блокировки: окно открывается первым тапом и **не продлевается** серией (не более
   * `childTapLockMs` подряд; потолок серии `seriesCapMs`), следующий тап после снятия открывает
   * новое окно. Тапы взрослого в окне гасятся **без отклика** (панель не мерцает «недоступна»).
   * После первой отметки обе группы кнопок недоступны до следующего окна ответа (двойное
   * нажатие). Тап по «перерыв» и по выходу блокировку не включает.
   */
  childTapLock: {
    extendedBySeries: false,
    seriesCapMs: 1000,
    adultTapFeedback: 'none',
    lockAfterMark: true,
    triggeredByBreakOrExit: false,
  },
  /**
   * «Исправить последнюю отметку» (В-1). Живёт не дольше 5 с **и не дольше фазы подкрепления**:
   * открытие следующего окна ответа немедленно возвращает ряд 2 («Я подсказал(а)» + «Отказ»),
   * отмена исчезает, а не вытесняет. Кнопка — в **левом слоте** ряда 2 (место «Я подсказал(а)»),
   * не на всю ширину; правый слот («Отказ») остаётся недоступным без поля, поэтому позиция
   * «Отказ» с позицией отмены не пересекается. Один уровень: после тапа кнопка исчезает, повтор
   * ничего не стирает. Процедуру отмены (что пишется в журнал) определяет методист.
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
  /** Рекомендуемый размер: на 390 pt помещается пять. */
  size: 48,
  /** Предел ряда — восемь по 32 pt. */
  minSize: 32,
  maxPerRow: 8,
  stroke: 3,
} as const;

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
 *   контур 6 с L2, на L3 активна только она, к ней идёт пунктирная направляющая.
 * - `match` и сортировка — L1–L2 ответа не раскрывают: L1 — метка и пульс над образцом (над
 *   предметом у сортировки), верная не выделена; L2 — активны верная и один случайный
 *   дистрактор (у выбора из двух L2 нет), остальные неактивны; L3 — активна только верная,
 *   метки нет. Выделения верной плиты нет ни на каком уровне.
 * - L4 на экране как L3 (`adultPhysical` меняет только панель взрослого).
 */
export type PromptVisual = {
  mark: 'none' | 'chevron_open' | 'triangle_solid';
  /** Над чем метка: над верной плитой (`identify`) или над образцом / предметом (`match`). */
  markOn: 'none' | 'correct_choice' | 'source';
  markSize: number;
  /** Однократный пульс 1 → `PROMPT_PULSE.scale` → 1 при появлении метки; только `match`, L1. */
  pulse: boolean;
  /** Контур верной плиты; утолщается внутрь — габарит и зона нажатия не меняются. */
  plateStroke: number;
  /** Какие плиты выбора принимают нажатие; остальные — `inactiveChoice`. */
  activeChoices: 'all' | 'correct_and_one' | 'correct_only';
  guide: 'none' | 'dashed';
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

export const promptVisual: Record<'identify' | 'match', Record<0 | 1 | 2 | 3, PromptVisual>> = {
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
      guide: 'dashed',
    },
  },
  match: {
    0: NO_PROMPT,
    1: { ...NO_PROMPT, mark: 'chevron_open', markOn: 'source', markSize: 32, pulse: true },
    2: { ...NO_PROMPT, activeChoices: 'correct_and_one' },
    3: { ...NO_PROMPT, activeChoices: 'correct_only' },
  },
};

/**
 * Неактивная плита выбора: **приглушена, не скрыта** — позиции не меняются (перестройка сетки
 * сама была бы подсказкой местом). Штриховка 45° цветом `ink`, подушки нет, контур сплошной
 * 3 (пунктир значит «пусто»), прозрачности нет. Нажатие по ней ничего не делает и не
 * пишется; экранному чтецу она не доступна.
 */
export const inactiveChoice = {
  pattern: 'hatched_45',
  hatchStroke: 2,
  hatchStep: 8,
  /** Calm: реже штрихи — меньше мелькающей текстуры; толщина штриха 2 остаётся. */
  hatchStepCalm: 12,
  cushion: false,
  reactsToTap: false,
  hiddenFromScreenReader: true,
} as const;

/**
 * Пульс образца на L1 `match`: один раз, `motion.slow`. Масштабируется **образец** (120 / 88 / 80),
 * не плита зоны: 1.04 — до 2.4 pt за край образца, внутри зоны стимула, соседей и полосы подсказки
 * пульс не задевает.
 */
export const PROMPT_PULSE = { scale: 1.04, durationMs: motion.slow, count: 1 } as const;

/** Контур утолщается внутрь плиты: внешний габарит стимула не зависит от уровня. */
export const PLATE_STROKE_INSET = true;
