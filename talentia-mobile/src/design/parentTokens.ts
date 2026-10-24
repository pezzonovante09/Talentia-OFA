/**
 * Родительская тональность. Спецификация — «Визуальный язык» в `PARENT.md`.
 *
 * Раздел получается из системы **вычитанием**: та же бумага и те же чернила, но
 * без контура, без подушки, без Comfortaa и без Tali. Родитель не попадает в
 * другое приложение — он попадает на ту же бумагу, с которой убрали теплоту.
 *
 * Чем раздел непривлекателен для ребёнка: ни одного жёлтого пикселя, ни звезды, ни
 * жетона; Tali нет; ни одной иллюстрации; ничто не выглядит нажимаемым на ощупь;
 * плотный мелкий текст.
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
  /** Тонкая граница карточки вместо контура 3 pt. */
  hairline: string;
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  error: string;
  onError: string;
  /** Предметные чернила — **только на карточке**, см. `REGION_INK_SURFACE`. */
  regionsInk: RegionPalette;
};

export const parentColors: Record<Scheme, ParentColors> = {
  light: {
    background: '#F4F1EC', // к детскому #FFF3E3 1.03:1 — та же бумага без теплоты
    card: '#FFFFFF',
    hairline: '#C9C1B6', // группировка, а не граница элемента
    text: '#2A1A12', // 14.85:1
    textMuted: '#6E564A', // 6.03:1 к фону, 6.79:1 к карточке
    primary: '#5A34C4',
    onPrimary: '#FFFFFF',
    error: '#BB1E1E', // как у ребёнка; к карточке 6.33, к фону 5.62
    onError: '#FFFFFF',
    // Те же чернила, что у ребёнка. После А25 они держат 4.5 и на детской surfaceSunken,
    // поэтому здесь с запасом: к карточке 6.38–6.44, к фону 5.66–5.71 (kyrgyz #964460 —
    // 6.38 / 5.66).
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
   * заливка «Числовой долины» с детской карты, чистый жёлтый, а раздел обещает
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
    primary: '#9B7CFF', // 4.95:1 к карточке, 5.62:1 к фону
    onPrimary: '#1B1410', // на primary 5.82:1
    error: '#FF6B6B', // 5.57:1 к карточке
    onError: '#1B1410', // на error 6.56:1
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
  weight: '400' | '600' | '800';
  family: 'Nunito';
  tabularNums?: boolean;
};

/** Только Nunito: Comfortaa — голос детского экрана. */
export const parentTypography: Record<'heading' | 'body' | 'caption' | 'number' | 'label', ParentTypeStyle> = {
  heading: { size: 24, lineHeight: 30, weight: '800', family: 'Nunito' },
  body: { size: 16, lineHeight: 22, weight: '400', family: 'Nunito' },
  caption: { size: 14, lineHeight: 20, weight: '600', family: 'Nunito' },
  /** Числа недели: табличные цифры, чтобы «12» и «7» стояли в колонке. */
  number: { size: 32, lineHeight: 36, weight: '800', family: 'Nunito', tabularNums: true },
  /** Кнопки и названия строк (`docs/design/parent-screens-2026-10-25.md`). */
  label: { size: 16, lineHeight: 22, weight: '600', family: 'Nunito' },
};

/* ───────────── раскладка раздела (docs/design/parent-screens-2026-10-25.md, этап 10) ───────────── */

/** Заливка под пальцем: сдвиг на ~12 % к `text` (светлая темнеет, тёмная светлеет); контрасты посчитаны в дизайн-доке. */
export const parentPressed: Record<Scheme, { card: string; primary: string; error: string }> = {
  light: { card: '#E9E4DC', primary: '#4A2AA6', error: '#9E1717' },
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
export const parentCard = { padX: 16, padY: 12, gap: 16 } as const;
export const parentButton = { height: 48, guardMs: 300 } as const;
/** Полоса недели: 7 клеток 36 с зазором 8; день с занятием — заливка `text`, без — пунктир `hairline`. */
export const weekStrip = { cell: 36, gap: 8, filled: 'text', emptyDash: 'hairline' } as const;
/** Автозакрытие 2 мин, свежесть подтверждения 5 мин, блокировка 1 → 5 → 15 мин (`domain/parentGate.ts`). */
export const parentIdle = { lockAfterMs: 120_000, confirmFreshMs: 300_000, lockoutMin: [1, 5, 15] } as const;
export const parentHeader = 48;

export const parentShape = {
  /** Контура и подушки нет: ничто не выглядит нажимаемым на ощупь. */
  outline: 0,
  cushion: 0,
  hairline: 1,
  /** Один радиус вместо детских 20 / 28. */
  radius: 12,
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
