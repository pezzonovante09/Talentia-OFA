/**
 * Тональность взрослого — «Тихий кабинет» (направление Б, решение №203; спецификация
 * `docs/design/aba-direction-b-spec-2026-11-16.md`). Холодно-нейтральный фон, белые и
 * тонированные блоки вместо столбца строк, чернила `#1E2A2F`, одно действие — глубокий
 * бирюзовый `primary`, шрифт Golos Text. Те же токены несут раздел взрослого и лист
 * взрослого в ABA (`abaAdultPanelColors`), поэтому взрослый узнаёт «свою» зону на любом экране.
 *
 * Чем раздел непривлекателен для ребёнка: ни одного жёлтого пикселя, ни звезды, ни
 * жетона; Tali нет; ни одной иллюстрации; одна залитая кнопка на экране; контура и
 * подушки нет — кнопка держит границу кромкой `edge`, а не «нажимаемым» рельефом.
 *
 * `calmMode`, `focusMode` и `density: roomy` сюда не применяются: они придуманы под
 * ребёнка, а включённый ребёнком спокойный режим не должен менять вид отчёта.
 * Поэтому у сборки нет этих параметров вовсе.
 */
import { palettes, type RegionPalette, type Scheme } from './tokens';

export type ParentColors = {
  background: string;
  /** Карточка — единственная поверхность, на которой живут предметные чернила. */
  card: string;
  /** Тонкая линия группировки (разделитель строк, граница простой карточки) — границу элемента не несёт. */
  hairline: string;
  /**
   * Кромка: граница кнопки и поля (1.5) и верх листа взрослого в ABA (2). Держит ≥ 3:1 к фону,
   * к карточке и к листу `zone` — граница нажимаемого видна без заливки.
   */
  edge: string;
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  error: string;
  onError: string;
  /** Блок «где мы сейчас» (шалфей). Тон блока — роль, текст на нём `text` / `textMuted`. */
  blockWhere: string;
  /** Блок «объяснение» (небо). */
  blockExplain: string;
  /** Блок «правило взрослому» (абрикос). */
  blockRule: string;
  /** Лист взрослого внизу экрана ABA и «взрослые» цели на детских экранах. */
  zone: string;
  /** Предметные чернила — **только на карточке**, см. `REGION_INK_SURFACE`. */
  regionsInk: RegionPalette;
};

export const parentColors: Record<Scheme, ParentColors> = {
  /** «Тихий кабинет» (№203). Контрасты — к фону `#F4F6F5` / к карточке `#FFFFFF`. */
  light: {
    background: '#F4F6F5',
    card: '#FFFFFF',
    hairline: '#C9D2CF', // группировка, а не граница элемента
    edge: '#6F7E84', // 3.87 к фону, 4.20 к карточке, 3.39 к листу zone
    text: '#1E2A2F', // 13.55 / 14.71
    textMuted: '#55656B', // 5.59 / 6.07
    primary: '#1D6B66', // onPrimary на нём 6.28; к фону 5.78
    onPrimary: '#FFFFFF',
    error: palettes.light.normal.error, // #BB1E1E без изменений: к карточке 6.33
    onError: '#FFFFFF',
    blockWhere: '#DDEDE6', // text 12.14, textMuted 5.01, primary 5.18
    blockExplain: '#DCE8F2', // text 11.81, textMuted 4.88, primary 5.04
    blockRule: '#FBE7D3', // text 12.24, textMuted 5.05, primary 5.22
    zone: '#E2E8E6', // text 11.85, textMuted 4.89
    // Те же чернила, что у ребёнка: к карточке 6.38–6.44, к новому фону — не ниже, чем к прежнему (он светлее).
    regionsInk: palettes.light.normal.regionsInk,
  },
  /**
   * Утверждено `design-lead`. Детская тёмная схема не подходит: её приглушённый
   * текст на карточке даёт 3.93:1, а «Слова» и «Мастерская» (прежняя «Логика») на ней — 4.20 и 3.88.
   *
   * Логика та же, что у светлой: **та же ночная бумага без теплоты**. Детский фон
   * `#1B1410` — тёплый коричневый; `#1A1918` почти нейтрален и отличается от него
   * на 1.04:1 — зеркально светлой паре (1.03:1). Карточка светлее фона (1.14:1),
   * потому что без контура и подушки поверхность отделяется только яркостью и
   * тонкой границей; `hairline` к карточке 2.10:1 — чуть сильнее светлой (1.78:1),
   * на тёмном ступени яркости различаются хуже.
   *
   * Действие и ошибка — те же, что у ребёнка в тёмной схеме: фиолетовый значит
   * «нажать» в обоих разделах. Контрасты текста — с запасом не ниже 5.5:1, кроме
   * чернил, где держится 4.87 и выше. Все значения проходят и на фоне, поэтому
   * ограничение `REGION_INK_SURFACE` в тёмной схеме соблюдается с запасом.
   *
   * Заменены два предметных чернила из черновика: `numbers #F2B705` — это ровно
   * заливка «Мира чисел» с детской карты, чистый жёлтый, а раздел обещает
   * «ни одного жёлтого пикселя»; `nature #2FA24E` — тоже детская заливка и всего
   * 4.71:1. Взамен приглушённые чернила того же тона, как `#785A02` / `#1E6D34`
   * в светлой схеме — чернила, а не наклейка.
   *
   * Известное ограничение: «Мастерская» `#A07FE0` близка по тону к `primary`. То же
   * в светлой схеме (`#7044C0` и `#5A34C4`); различие держит форма — чернила
   * только текстом на карточке, действие только залитой кнопкой.
   *
   * Кыргызский `#D9789B` — приглушённый малиновый, а не детская заливка `#E36A93`
   * и не детские чернила `#EB6E98`: чернила, а не наклейка.
   */
  dark: {
    background: '#1A1918', // text 15.58:1, textMuted 6.47:1
    card: '#262422', // к фону 1.14:1
    hairline: '#5A5550', // 2.10:1 к карточке, 2.38:1 к фону — группировка
    text: '#F4F1EC', // 13.73:1 к карточке
    textMuted: '#A39C94', // 5.70:1 к карточке
    primary: palettes.dark.normal.primary, // #9B7CFF // 4.95:1 к карточке, 5.62:1 к фону
    onPrimary: palettes.dark.normal.onPrimary, // #1B1410 // на primary 5.82:1
    error: palettes.dark.normal.error, // #FF6B6B // 5.57:1 к карточке
    onError: '#1B1410', // на error 6.56:1
    // Роли «Тихого кабинета» (№203) в тёмной схеме — временно из уже утверждённых тёмных тонов: тёмная тема
    // заморожена (№197), сборка ABA закреплена в светлой. Свой расчёт — вместе с тёмной темой.
    edge: '#A39C94', // = textMuted: 5.70 к карточке и листу, 6.47 к фону
    blockWhere: '#262422', // = card
    blockExplain: '#262422',
    blockRule: '#262422',
    zone: '#262422',
    regionsInk: {
      numbers: '#D4A25A', // 6.71:1 к карточке, 7.62:1 к фону — охра, не жёлтый
      words: '#2E9FCC', // 5.12:1 / 5.81:1
      nature: '#5BB06E', // 5.80:1 / 6.59:1
      workshop: '#A07FE0', // 4.87:1 / 5.52:1
      kyrgyz: '#D9789B', // 5.24:1 / 5.94:1
    },
  },
};

/**
 * Где разрешены предметные чернила — только на карточке.
 *
 * Правило появилось из контраста: прежние `#8C6A03` давали на фоне раздела 4.46:1.
 * После А25 детские чернила затемнены и на фоне проходят с запасом (≥5.66), но правило
 * остаётся как правило композиции: предмет в отчёте — всегда строка карточки, а не
 * подпись, брошенная на фон (PARENT.md, «Визуальный язык»). Детский аналог —
 * `INK_SURFACES` в `tokens.ts`.
 */
export const REGION_INK_SURFACE = 'card' as const;

export type ParentTypeStyle = {
  size: number;
  lineHeight: number;
  /**
   * Только загруженные начертания (`src/ui/fonts.ts`): Golos Text 400 / 500 / 600 / 700, Nunito 400 / 700 / 800.
   * Незагруженная пара уходит в ближайший вес (`fontFamilyFor`), но в токенах её быть не должно — проверяет тест.
   */
  weight: '400' | '500' | '600' | '700' | '800';
  family: 'Nunito' | 'Golos Text';
  tabularNums?: boolean;
};

export type ParentTypeRole = 'heading' | 'screen' | 'title' | 'body' | 'caption' | 'label' | 'stage' | 'number';

const GOLOS = 'Golos Text' as const;

/**
 * Golos Text (№203): ровная кириллица, спокойные пропорции; Nunito остаётся детскому уроку (№176). Кегли и
 * интерлиньяжи прежних ролей не меняются — слоты 72 / 56 ABA и строки раздела рассчитаны под них; меняются
 * семейство и веса: заголовки 700, кнопки и подписи 600, текст 400.
 *
 * Высота строки: на Android строка ниже натуральной срезает верх первой строки, поэтому
 * `lineHeight ≥ ceil(size × (верх чернил Й/Ё + descender hhea))` — коэффициент тест берёт прямо из TTF Golos
 * (`src/design/__tests__/cabinetType.test.ts`), а не из константы: шрифт обновился — проверка пересчитается сама.
 */
export const parentTypography: Record<ParentTypeRole, ParentTypeStyle> = {
  heading: { size: 24, lineHeight: 30, weight: '700', family: GOLOS },
  /** Заголовок в шапке экрана 56. */
  screen: { size: 21, lineHeight: 28, weight: '700', family: GOLOS },
  /** Заголовок блока рядом с иконкой в круге 40 (`Card` с `icon`). */
  title: { size: 19, lineHeight: 24, weight: '700', family: GOLOS },
  body: { size: 16, lineHeight: 22, weight: '400', family: GOLOS },
  caption: { size: 14, lineHeight: 20, weight: '600', family: GOLOS },
  /** Кнопки и названия строк (`docs/design/parent-screens-2026-10-25.md`). */
  label: { size: 16, lineHeight: 22, weight: '600', family: GOLOS },
  /** Подписи этапов «Где мы сейчас»: до 2 строк, потолок системного масштаба 1.1 (`ParentText`). */
  stage: { size: 13, lineHeight: 16, weight: '600', family: GOLOS },
  /** Числа недели: табличные цифры (`tnum` в Golos есть), чтобы «12» и «7» стояли в колонке. */
  number: { size: 32, lineHeight: 36, weight: '700', family: GOLOS, tabularNums: true },
};

/** Потолок системного масштаба шрифта по роли: числа — без роста (колонка), этапы — 1.1 (4 колонки на 360), прочее — 1.3. */
export const parentFontScaleMax: Record<ParentTypeRole, number> = {
  heading: 1.3,
  screen: 1.3,
  title: 1.3,
  body: 1.3,
  caption: 1.3,
  label: 1.3,
  stage: 1.1,
  number: 1,
};

/* ───────────── раскладка раздела (docs/design/parent-screens-2026-10-25.md, этап 10) ───────────── */

/** Заливка под пальцем: сдвиг на ~12 % к `text` (светлая темнеет, тёмная светлеет); контрасты посчитаны в дизайн-доке. */
export const parentPressed: Record<Scheme, { card: string; primary: string; error: string }> = {
  // №203: text на нажатой карточке 12.20, белый на нажатой primary 8.94
  light: { card: '#E6EBE9', primary: '#15524E', error: '#9E1717' },
  dark: { card: '#302D2A', primary: '#AE95FF', error: '#FF8A8A' },
};
export const parentScrim = 'rgba(0,0,0,0.4)';
export const parentSpacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
/** Точки PIN Ø14 с зазором 16, клавиша 72×60 с зазором 12 (блок 240×276), вспышка ошибки 140 мс. */
export const parentPin = { dot: 14, dotGap: 16, ring: 2, keyW: 72, keyH: 60, keyGap: 12, errorFlashMs: 140, length: 6 } as const;
/** Сегменты: выбранный — заливка `text`, подпись `card` (не `primary`: иначе экран настроек — четыре кнопки). */
export const parentSegmented = { height: 40, minSegment: 48, selectedFill: 'text', selectedLabel: 'card' } as const;
export const parentSwitch = { trackOn: 'primary', trackOff: 'hairline', thumb: 'card' } as const;
export const parentRow = { minHeight: 56, padX: 16, dividerInset: 16, chevron: 24 } as const;
/**
 * Глиф цели ABA у родителя (этап G2, вопрос 66): степень заполнения круга Ø 16, обводка 2 — «насколько дошли»,
 * не «насколько хорошо». Пусто = впереди, кольцо `textMuted` = учим, левая половина = почти, круг `text` = освоено.
 * Цвета только `text` / `textMuted`: hairline как обводка не держит 3:1.
 */
export const parentGoalGlyph = { size: 16, stroke: 2, gap: 12 } as const;
/**
 * Карточка-блок (№203): поле 16; у блока с иконкой — круг 40 (глиф 24) и зазор 12 до заголовка. Круг на тонированном
 * блоке — `card`, на простой карточке — `blockWhere`.
 */
export const parentCard = { padX: 16, padY: 12, gap: 16, blockPad: 16, icon: 40, iconGlyph: 24, iconGap: 12 } as const;
/**
 * Полоса этапов «Где мы сейчас» (№203, `StageStrip`): 4 колонки с весами под длину слова (Знакомство / Проверка /
 * Учимся / Повторяем), зазор 6. Пройденный — полоса 6 `primary` и кружок ✓ 20 (глиф 12, ободок 2 цвета блока) на её
 * конце; текущий — полоса 12 с рамкой 3 `primary`; следующий — 6 с границей `edge`. Подпись — роль `stage`, одной
 * строкой с ужатием до `labelMinScale`: подписи — по одному слову, и вторая строка разрезала бы слово посередине; на
 * экране 360 при масштабе ×1.1 «Знакомство» шире своей колонки (85.6 против 82.7 pt по TTF) — ужатие до ~0.97.
 */
export const parentStageStrip = { weights: [1.25, 1, 0.85, 1.1], gap: 6, bar: 6, barNow: 12, ringNow: 3, check: 20, checkGlyph: 12, checkRing: 2, checkOverhang: 2, labelGap: 6, labelMinScale: 0.86 } as const;
/** Кнопка 52; единственная главная кнопка экрана («Начать занятие») — 56. */
export const parentButton = { height: 52, mainHeight: 56, guardMs: 300 } as const;
/** Полоса недели: 7 клеток 36 с зазором 8; день с занятием — заливка `text`, без — пунктир `hairline`. */
export const weekStrip = { cell: 36, gap: 8, filled: 'text', emptyDash: 'hairline' } as const;
/** Шапка экрана 56, заголовок — роль `screen` 21. */
export const parentHeader = 56;

export const parentShape = {
  /** Контура и подушки нет: ничто не выглядит нажимаемым на ощупь. */
  outline: 0,
  cushion: 0,
  hairline: 1,
  /** Толщина кромки `edge` у кнопки и поля. */
  edge: 1.5,
  /** Кнопки, поля, сегменты, клавиши PIN. */
  radius: 16,
  /** Карточки и блоки. */
  blockRadius: 24,
} as const;

/**
 * Зона нажатия взрослого — **отдельный токен**, а не понижение `touch.min`: порог
 * 60 pt обоснован моторикой четырёхлетки и остаётся обязательным на детских
 * поверхностях.
 */
export const touchAdult = 48;

/** Одна плавность на весь раздел. */
export const parentMotion = 140;

export type ParentTheme = {
  scheme: Scheme;
  colors: ParentColors;
  typography: typeof parentTypography;
  shape: typeof parentShape;
  touch: number;
  motion: number;
};

/** Тема раздела. Только схема — спокойный и фокус-режим сюда не проходят. */
export function buildParentTheme(scheme: Scheme): ParentTheme {
  return {
    scheme,
    colors: parentColors[scheme],
    typography: parentTypography,
    shape: parentShape,
    touch: touchAdult,
    motion: parentMotion,
  };
}
