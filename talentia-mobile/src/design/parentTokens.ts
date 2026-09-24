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
    error: '#C42020',
    onError: '#FFFFFF',
    regionsInk: palettes.light.normal.regionsInk,
  },
  /**
   * Утверждено `design-lead`. Детская тёмная схема не подходит: её приглушённый
   * текст на карточке даёт 3.93:1, а «Слова» и «Логика» на ней — 4.20 и 3.88.
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
   * 4.71:1. Взамен приглушённые чернила того же тона, как `#8C6A03` / `#25803E`
   * в светлой схеме — чернила, а не наклейка.
   *
   * Известное ограничение: «Логика» `#A07FE0` близка по тону к `primary`. То же
   * в светлой схеме (`#7A4BD1` и `#5A34C4`); различие держит форма — чернила
   * только текстом на карточке, действие только залитой кнопкой.
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
      logic: '#A07FE0', // 4.87:1 / 5.52:1
    },
  },
};

/**
 * Где разрешены предметные чернила. `regionsInk.numbers` `#8C6A03` на фоне
 * раздела даёт 4.46:1 при пороге 4.5 — не проходит на сотых; на белой карточке —
 * 5.03:1. Подгонять hex ради сотых ненадёжно, ограничение по поверхности надёжно.
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
export const parentTypography: Record<'heading' | 'body' | 'caption' | 'number', ParentTypeStyle> = {
  heading: { size: 24, lineHeight: 30, weight: '800', family: 'Nunito' },
  body: { size: 16, lineHeight: 22, weight: '400', family: 'Nunito' },
  caption: { size: 14, lineHeight: 20, weight: '600', family: 'Nunito' },
  /** Числа недели: табличные цифры, чтобы «12» и «7» стояли в колонке. */
  number: { size: 32, lineHeight: 36, weight: '800', family: 'Nunito', tabularNums: true },
};

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
