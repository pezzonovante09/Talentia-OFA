/**
 * Размер плитки варианта в форматах `choose`, `match`, `order` по зоне задания — одна формула на экран и на гард корпуса
 * (`glyphFit`): кегль карточки-символа проверяется на той плитке, которую ребёнок увидит на самом малом экране
 * (`child-ux-specialist` после D2 по аудиту 2026-11-09). Чистые функции; `lift` — подъём плитки темы (в calm — 0).
 */
import { elevation, lessonFixedHeight, lessonLayout, orderMark, spacing } from './tokens';

export type TileSize = { w: number; h: number };

const GAP = spacing.lg;
const across = (width: number, cols: number) => (width - GAP * (cols - 1)) / cols;

/** `choose`: со стимулом — все варианты в ряд, высота 112; без — 2 колонки (3 варианта: 2 сверху + 1). */
export function chooseTile(width: number, height: number, n: number, withStimulus: boolean): TileSize {
  const w = across(width, withStimulus ? n : Math.min(2, n));
  const h = withStimulus ? 112 : n === 2 ? Math.min(196, height) : Math.min(129, (height - GAP) / 2);
  return { w, h };
}

/** `match`: два ряда по `n` через желоб под линии пар. */
export function matchTile(width: number, height: number, n: number, lift: number = elevation.raised.offsetY): TileSize {
  const w = across(width, n);
  return { w, h: Math.min(Math.floor((height - lessonLayout.matchGutter) / 2) - lift, w * 1.4) };
}

/** `order`: ряд мест под полосой-стрелой и лоток. */
export function orderTile(width: number, height: number, n: number, lift: number = elevation.raised.offsetY): TileSize {
  const w = across(width, n);
  return { w, h: Math.min(Math.floor((height - orderMark.strip - lessonLayout.trayGap - lift * 2) / 2), w * 1.4) };
}

/**
 * Зона задания на самом малом экране. Ширина — 320 − 2 × 16 (iPhone SE 1-го поколения; SE 2/3 и 8 в «Увеличенном
 * виде»). Высота — у Android 360×640 с трёхкнопочной навигацией в старом режиме вставок: доступно 568, как у SE, но
 * строка состояния 24, а не 20 (тот же случай, что малый тир `abaTokens.ts`, В-4; `child-ux-specialist` после D2):
 * 568 − 24 − каркас урока (`lessonFixedHeight`) − нижний отступ 16 = 172.
 */
export const NARROW_TASK_ZONE = { width: 320 - 2 * spacing.lg, height: 568 - 24 - lessonFixedHeight() - spacing.lg } as const;
