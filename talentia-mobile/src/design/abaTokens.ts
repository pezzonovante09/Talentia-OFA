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
import type { Scheme } from './tokens';

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
  /** Пустой слот доски жетонов. */
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
    onReinforcement: '#FFFFFF',
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
    onReinforcement: '#1B1410',
  },
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
  topBar: 64,
  tokenBoard: 48,
  gapAfterBoard: 32,
  /** Две строки инструкции зарезервированы всегда. */
  instruction: 72,
  hintBand: 40,
  /** Плита стимула 240×240 — без подушки: стимул не кнопка. */
  stimulus: 240,
  adultPanel: 88,
  /** Зазор между плитами, если их несколько. */
  plateGap: 24,
} as const;

/** Управление взрослого: выход 60×60 с удержанием, три кнопки панели в родительской тональности. */
export const abaControls = {
  exitSize: 60,
  exitHoldMs: 800,
  replaySize: 60,
  adultButton: 48,
} as const;

/**
 * Доска жетонов. **Жетоны не интерактивны**, поэтому правило `touch.min` 60 pt к
 * ним не применяется — это зафиксировано здесь, чтобы размер не отметили как дефект.
 */
export const abaTokenBoard = {
  interactive: false,
  /** Рекомендуемый размер: на 390 pt помещается пять. */
  size: 48,
  /** Предел ряда — восемь по 32 pt. */
  minSize: 32,
  maxPerRow: 8,
  stroke: 3,
  /** Подушка у заработанного, у пустого слота — нет (он утоплен). */
  cushion: 4,
} as const;

/** Состояние ячейки доски. Различаются четырьмя признаками, ни одного — по прозрачности. */
export type TokenCellStyle = {
  fill: 'slot' | 'earned';
  outline: 'dashed' | 'solid';
  star: 'none' | 'solid' | 'outline';
  relief: 'sunken' | 'cushion';
};

export const tokenCell: Record<'empty' | 'earnedIndependent' | 'earnedPrompted', TokenCellStyle> = {
  empty: { fill: 'slot', outline: 'dashed', star: 'none', relief: 'sunken' },
  earnedIndependent: { fill: 'earned', outline: 'solid', star: 'solid', relief: 'cushion' },
  earnedPrompted: { fill: 'earned', outline: 'solid', star: 'outline', relief: 'cushion' },
};

/**
 * Уровни подсказки без цвета. Четыре независимых канала: форма метки, толщина
 * контура целевой плиты, вид дистракторов, направляющая. Обесцветьте экран —
 * уровни останутся различимы. Движение уровень не несёт.
 *
 * Метка ставится **над** целевой плитой: слева от крайней она уходит за край, а в
 * зазор 24 pt легибельную стрелку не поставить.
 */
export type PromptVisual = {
  mark: 'none' | 'chevron_open' | 'triangle_solid';
  markSize: number;
  /** Контур целевой плиты; утолщается внутрь — габарит и зона нажатия не меняются. */
  plateStroke: number;
  distractors: 'unchanged' | 'hatched_flat' | 'removed';
  guide: 'none' | 'dashed';
};

export const promptVisual: Record<0 | 1 | 2 | 3, PromptVisual> = {
  0: { mark: 'none', markSize: 0, plateStroke: ABA_STIMULUS_STROKE, distractors: 'unchanged', guide: 'none' },
  1: { mark: 'chevron_open', markSize: 32, plateStroke: ABA_STIMULUS_STROKE, distractors: 'unchanged', guide: 'none' },
  2: { mark: 'triangle_solid', markSize: 32, plateStroke: 6, distractors: 'hatched_flat', guide: 'none' },
  3: { mark: 'triangle_solid', markSize: 32, plateStroke: 6, distractors: 'removed', guide: 'dashed' },
};

/** Контур утолщается внутрь плиты: внешний габарит стимула не зависит от уровня. */
export const PLATE_STROKE_INSET = true;
