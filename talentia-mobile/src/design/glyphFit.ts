/**
 * Кегль знака на карточке-символе — цифра, буква, слог (`design-lead`, этап D2 по аудиту 2026-11-09). Один кегль на все
 * карточки задания — по самому широкому и самому высокому знаку (размер знака не подсказывает ответ): меньшее из ступени
 * `symbolGlyph` по числу знаков, того, что входит в поле по измеренной ширине Nunito 800, и того, что входит по высоте
 * плитки по чернилам знаков (бреве Й, точки Ё, хвост Щ и Ң не ложатся на контур — `child-ux-specialist` после D2).
 *
 * Высота — по **общим чернилам задания** (№192): от самой низкой точки до самой высокой среди всех знаков, и все знаки
 * сдвинуты одним `symbolShift`, чтобы середина этих чернил стояла в середине карточки. Базовая линия у всех карточек
 * задания общая: И рядом с Й сидит ниже центра, и разница — только в дужке. По отдельной середине каждого знака нельзя —
 * базовые линии разошлись бы, и положение подсказало бы ответ. Сдвиг — `translateY`, а не меньшая высота строки:
 * при меньшей строке Android режет бреве. Чистые функции: их же зовёт гард корпуса.
 */
import { GLYPH_ADVANCE_800, GLYPH_INK_800, NUNITO_LINE_CENTER } from './glyphMetrics';
import { glyphCard, spacing, stroke, symbolGlyph } from './tokens';

/** Самый широкий знак таблицы: запас для знака, которого в таблице нет (гард `glyphScript` такого не пустит). */
const WIDEST = Math.max(...Object.values(GLYPH_ADVANCE_800));
/** Самый большой размах чернил от середины строки — запас для знака вне таблицы. */
const TALLEST = Math.max(...Object.values(GLYPH_INK_800).map(([lo, hi]) => Math.max(hi - NUNITO_LINE_CENTER, NUNITO_LINE_CENTER - lo)));

/** Ширина строки в em при кегле 1. */
export function glyphEm(text: string): number {
  return [...text].reduce((sum, ch) => sum + (GLYPH_ADVANCE_800[ch] ?? WIDEST), 0);
}

/** Насколько чернила знаков уходят от середины строки вверх или вниз, em (без сдвига — знак по середине строки). */
export function glyphReach(text: string): number {
  return [...text].reduce((max, ch) => {
    const ink = GLYPH_INK_800[ch];
    return Math.max(max, ink ? Math.max(ink[1] - NUNITO_LINE_CENTER, NUNITO_LINE_CENTER - ink[0]) : TALLEST);
  }, 0);
}

/** Общие чернила знаков задания над базовой линией, em: [низ, верх]. Знак вне таблицы — с запасом `TALLEST`. */
export function glyphInk(texts: readonly string[]): readonly [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const ch of texts.flatMap((t) => [...t])) {
    const [a, b] = GLYPH_INK_800[ch] ?? [NUNITO_LINE_CENTER - TALLEST, NUNITO_LINE_CENTER + TALLEST];
    lo = Math.min(lo, a);
    hi = Math.max(hi, b);
  }
  return lo <= hi ? [lo, hi] : [NUNITO_LINE_CENTER, NUNITO_LINE_CENTER];
}

/**
 * Сдвиг знаков вниз, pt, при кегле `size`: середина общих чернил задания — в середину карточки. Положительный — вниз
 * (бреве Й поднимает чернила, и знаки опускаются).
 */
export function symbolShift(texts: readonly string[], size: number): number {
  const [lo, hi] = glyphInk(texts);
  return ((lo + hi) / 2 - NUNITO_LINE_CENTER) * size;
}

/** Есть ли в задании буква с мелкой различающей деталью (`glyphCard.twinDetail`, №192). */
export function hasTwinDetail(texts: readonly string[]): boolean {
  return texts.some((t) => [...t].some((ch) => glyphCard.twinDetail.includes(ch)));
}

/** Нижний предел кегля задания: 40 при букве с деталью, иначе 32 (гард `glyphFit`). */
export function symbolMinSize(texts: readonly string[]): number {
  return hasTwinDetail(texts) ? glyphCard.twinMinSize : glyphCard.minSize;
}

/**
 * Зазоры, pt, от чернил знаков до рамки карточки (`symbolBox`): [сверху, снизу] после сдвига `symbolShift`. Строка стоит
 * в рамке по центру, поэтому базовая линия — `NUNITO_LINE_CENTER × size + shift` ниже середины рамки, и при сдвиге оба
 * зазора равны (рамка − высота чернил) / 2 — не меньше `inset` по построению кегля. Округление высоты строки вверх
 * (`Math.ceil` в `NumeralCard`) здесь не моделируется: iOS центрирует строку, Android отдаёт верху до 0.5 px больше
 * (≈ 0.25 pt на 2x, `design-lead`) — это проверяет смоук К2, пункт 5.1д, а не этот расчёт.
 */
export function symbolInkGaps(texts: readonly string[], tileH: number, size: number): readonly [number, number] {
  const [lo, hi] = glyphInk(texts);
  const half = symbolBox(tileH) / 2;
  const baseline = NUNITO_LINE_CENTER * size + symbolShift(texts, size);
  return [half + (baseline - hi * size), half - (baseline - lo * size)];
}

/** Поле под знак в плитке: минус контур «выбрано» и отступ с двух сторон. */
export function symbolField(tile: number): number {
  return tile - 2 * stroke.bold - 2 * glyphCard.inset;
}

/** Рамка карточки в плитке — внутри контура «выбрано»; отступ `inset` между полем знака и рамкой — запас от многоточия. */
export function symbolBox(tile: number): number {
  return tile - 2 * stroke.bold;
}

/** Кегль для знаков задания `texts` в плитке `tileW` × `tileH` (без высоты — только по ширине). */
export function symbolFontSize(texts: readonly string[], tileW: number, tileH?: number): number {
  const chars = Math.max(1, ...texts.map((t) => [...t].length));
  const step = symbolGlyph[Math.min(4, chars) as 1 | 2 | 3 | 4];
  const widest = Math.max(0, ...texts.map(glyphEm));
  const [lo, hi] = glyphInk(texts);
  const byWidth = widest === 0 ? step : Math.floor(symbolField(tileW) / widest);
  const byHeight = tileH === undefined || hi <= lo ? step : Math.floor(symbolField(tileH) / (hi - lo));
  return Math.min(step, byWidth, byHeight);
}

/** Ширина плитки в ряду из `cols` через `spacing.lg` на самом узком экране (`glyphCard.narrowContentW`). */
export function narrowTileW(cols: number): number {
  return (glyphCard.narrowContentW - spacing.lg * (cols - 1)) / cols;
}
