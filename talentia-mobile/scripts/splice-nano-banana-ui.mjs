/**
 * Нарезает scripts/input/ui-spritesheet.png сеткой 7×4 (равные ячейки).
 * Экспортирует только слоты с 1-based индексами:
 * 1,2,3,4,5,6,8,10,11,12,13,15,16,18,19,20,22,23,24,27,28
 *
 * Индекс n → row = floor((n-1)/7), col = (n-1)%7
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const COLS = 7;
const ROWS = 4;

/** 1-based индексы на листе → имя файла */
const EXPORT = [
  [1, 'ui-streak'],
  [2, 'ui-book'],
  [3, 'ui-book-bookmark'],
  [4, 'ui-check'],
  [5, 'ui-medal'],
  [6, 'ui-backpack'],
  [8, 'ui-stars'],
  [10, 'ui-x'],
  [11, 'ui-lightning'],
  [12, 'ui-gift'],
  [13, 'ui-level-up'],
  [15, 'ui-bulb'],
  [16, 'ui-map'],
  [18, 'ui-egg'],
  [19, 'ui-help'],
  [20, 'ui-lock'],
  [22, 'ui-heart'],
  [23, 'ui-trophy'],
  [24, 'ui-pencil-paper'],
  [27, 'ui-meteor'],
  [28, 'ui-flame'],
];

function cellBounds(width, height, index1) {
  const i = index1 - 1;
  const row = Math.floor(i / COLS);
  const col = i % COLS;
  const baseW = Math.floor(width / COLS);
  const baseH = Math.floor(height / ROWS);
  const extraW = width - baseW * COLS;
  const extraH = height - baseH * ROWS;
  const wCell = baseW + (col === COLS - 1 ? extraW : 0);
  const hCell = baseH + (row === ROWS - 1 ? extraH : 0);
  const left = col * baseW;
  const top = row * baseH;
  return { left, top, width: wCell, height: hCell };
}

async function main() {
  const sheet = path.join(root, 'scripts', 'input', 'ui-spritesheet.png');
  if (!fs.existsSync(sheet)) {
    console.error('Нет файла:', sheet);
    console.error('Сначала: node scripts/import-nano-banana-assets.mjs');
    process.exit(1);
  }

  const meta = await sharp(sheet).metadata();
  const w = meta.width || 0;
  const h = meta.height || 0;
  const outDir = path.join(root, 'assets', 'images', 'ui');
  fs.mkdirSync(outDir, { recursive: true });

  for (const [idx, base] of EXPORT) {
    const { left, top, width, height } = cellBounds(w, h, idx);
    const dest = path.join(outDir, `${base}.webp`);
    await sharp(sheet).extract({ left, top, width, height }).webp({ quality: 85, effort: 6 }).toFile(dest);
    console.log(`#${idx} → ${path.relative(root, dest)} (${width}×${height})`);
  }
  console.log('Готово.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
