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
   * В `PARENT.md` тёмная схема не задана; детская не подходит — её приглушённый
   * текст на карточке даёт 3.93:1, а «Слова» и «Логика» на ней — 4.20 и 3.88.
   * Нейтральные тёмные подобраны с запасом по контрасту. ПРЕДВАРИТЕЛЬНО: до
   * утверждения `design-lead`.
   */
  dark: {
    background: '#1A1918',
    card: '#262422',
    hairline: '#5A5550',
    text: '#F4F1EC', // 13.73:1 к карточке
    textMuted: '#A39C94', // 5.70:1 к карточке
    primary: '#9B7CFF',
    onPrimary: '#1B1410',
    error: '#FF6B6B',
    onError: '#1B1410',
    regionsInk: {
      numbers: '#F2B705', // 8.51:1 к карточке
      words: '#2E9FCC', // 5.12:1
      nature: '#2FA24E', // 4.71:1
      logic: '#A07FE0', // 4.87:1
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
