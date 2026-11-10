/**
 * Кегль знака на карточке-символе — цифра, буква, слог (`design-lead`, этап D2 по аудиту 2026-11-09). Один кегль на все
 * карточки задания — по самому широкому и самому высокому знаку (размер знака не подсказывает ответ): меньшее из ступени
 * `symbolGlyph` по числу знаков, того, что входит в поле по измеренной ширине Nunito 800, и того, что входит по высоте
 * плитки по чернилам знаков (бреве Й, точки Ё, хвост Щ и Ң не ложатся на контур — `child-ux-specialist` после D2).
 * Чистые функции: их же зовёт гард корпуса.
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

/** Насколько чернила знаков уходят от середины строки вверх или вниз, em: знак стоит в плитке по середине строки. */
export function glyphReach(text: string): number {
  return [...text].reduce((max, ch) => {
    const ink = GLYPH_INK_800[ch];
    return Math.max(max, ink ? Math.max(ink[1] - NUNITO_LINE_CENTER, NUNITO_LINE_CENTER - ink[0]) : TALLEST);
  }, 0);
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
  const reach = Math.max(0, ...texts.map(glyphReach));
  const byWidth = widest === 0 ? step : Math.floor(symbolField(tileW) / widest);
  const byHeight = tileH === undefined || reach === 0 ? step : Math.floor(symbolField(tileH) / (2 * reach));
  return Math.min(step, byWidth, byHeight);
}

/** Ширина плитки в ряду из `cols` через `spacing.lg` на самом узком экране (`glyphCard.narrowContentW`). */
export function narrowTileW(cols: number): number {
  return (glyphCard.narrowContentW - spacing.lg * (cols - 1)) / cols;
}
