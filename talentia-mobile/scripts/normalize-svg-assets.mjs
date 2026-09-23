/**
 * Нормализует сгенерированные SVG под дизайн-систему.
 *
 * Зачем: генератор выдаёт свою палитру, а не нашу. В первой партии из
 * шестнадцати файлов совпадений с токенами было ноль: контур приходил
 * тёмно-синим (#030041 и соседние) вместо тёплого #2A1A12, зелёный —
 * кислотным #8CF936 вместо #3FC08A, красный — розовым #FA3854 вместо #D93A1E.
 * Стиль при этом держался ровно, то есть ошибка систематическая и лечится
 * переназначением цветов. Именно ради этого ассеты и брались вектором:
 * растр так не поправить.
 *
 * Что делает:
 *   1. сопоставляет каждый цвет файла ближайшему токену из его палитры;
 *   2. снимает метаданные C2PA, которые генератор вшивает в каждый файл
 *      (в иконке это 38 КБ из 41 при трёх килобайтах путей);
 *   3. прогоняет svgo;
 *   4. раскладывает результат по assets/.
 *
 * Запуск: npm run assets:normalize-svg
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { optimize } from 'svgo';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const inputDir = path.join(root, 'scripts', 'input');

/* ───────────────────────── палитры ───────────────────────── */

const OUTLINE = '#2A1A12';
const CREAM = '#FFE6C7';
const PAPER = '#FFF3E3';
const WHITE = '#FFFFFF';
const BROWN = '#8C6A03';

/** Общие для всех: контур, бумага, кремовый, коричневый. */
const BASE = [OUTLINE, PAPER, WHITE, CREAM, BROWN];

const TALI = [...BASE, '#3FC08A', '#2FA24E', '#FFC42E', '#0E8FBF', '#D93A1E'];

const REGIONS = {
  'region-numbers': [...BASE, '#F2B705', '#C79104', '#2FA24E', '#D93A1E'],
  'region-words': [...BASE, '#0E8FBF', '#0C6E92', '#D93A1E', '#FFC42E', '#2FA24E'],
  'region-nature': [...BASE, '#2FA24E', '#1F7A3A', '#6FD6AC', '#D93A1E'],
  'region-logic': [...BASE, '#9671DB', '#6F49B0', '#D93A1E', '#FFC42E'],
};

const ICONS = {
  'ui-check': [...BASE, '#12855A'],
  'ui-x': [...BASE, '#C42020'],
  'ui-lock': [...BASE],
  'ui-sound': [...BASE, '#FFC42E'],
  'ui-map': [...BASE, '#2FA24E', '#0E8FBF', '#D93A1E'],
  'ui-bulb': [...BASE, '#FFC42E'],
};

/** Куда класть результат. */
const TARGETS = [
  { match: /^tali-/, dir: 'assets/images/tali', palette: () => TALI },
  { match: /^region-/, dir: 'assets/images/regions', palette: (n) => REGIONS[n] },
  { match: /^ui-/, dir: 'assets/icons', palette: (n) => ICONS[n] },
];

/* ───────────────────────── цвет ───────────────────────── */

function toHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

/** Расстояние по оттенку с учётом того, что круг замкнут. */
function hueGap(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Ближайший токен. Оттенок весит больше светлоты, а светлота больше
 * насыщенности: для плоской аппликации важнее попасть в «тот же цвет»,
 * чем в ту же яркость. Серое (S < 12) сопоставляется только по светлоте,
 * иначе случайный оттенок шума тянет его в цветной токен.
 */
function nearest(hex, palette) {
  const c = toHsl(hex);

  // Тёмное и насыщенное — это контур. Генератор рисует его тёмно-синим,
  // и по расстоянию он иначе уезжает в фиолетовый регион.
  if (c.l < 22) return OUTLINE;

  let best = palette[0];
  let bestScore = Infinity;
  for (const p of palette) {
    const t = toHsl(p);
    const grey = c.s < 12 || t.s < 12;
    const score = grey
      ? Math.abs(c.l - t.l) * 2 + Math.abs(c.s - t.s)
      : hueGap(c.h, t.h) * 2 + Math.abs(c.l - t.l) * 1.2 + Math.abs(c.s - t.s) * 0.4;
    if (score < bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

/* ───────────────────────── обработка ───────────────────────── */

const svgoConfig = {
  multipass: true,
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          // Идентификаторы могут понадобиться для анимации поз.
          cleanupIds: false,
          // viewBox несёт пропорции кадра: шесть поз обязаны совпадать.
          removeViewBox: false,
        },
      },
    },
    'removeMetadata',
    'removeComments',
    'removeDimensions',
  ],
};

function normalize(name, source, palette) {
  const seen = new Map();
  const recoloured = source.replace(
    /(fill|stroke)="(#[0-9a-fA-F]{6})"/g,
    (_, attr, hex) => {
      const from = hex.toUpperCase();
      const to = nearest(from, palette);
      seen.set(from, to);
      return `${attr}="${to}"`;
    },
  );
  const { data } = optimize(recoloured, { ...svgoConfig, path: name });
  return { data, seen };
}

function main() {
  const files = fs
    .readdirSync(inputDir)
    .filter((f) => f.endsWith('.svg'))
    .sort();

  if (files.length === 0) {
    console.error('В scripts/input нет ни одного .svg');
    process.exit(1);
  }

  let before = 0;
  let after = 0;
  const report = [];

  for (const file of files) {
    const name = path.basename(file, '.svg');
    const target = TARGETS.find((t) => t.match.test(name));
    if (!target) {
      console.warn(`× ${file} — не подходит ни под один раздел, пропущен`);
      continue;
    }
    const palette = target.palette(name);
    if (!palette) {
      console.warn(`× ${file} — нет палитры для этого имени, пропущен`);
      continue;
    }

    const source = fs.readFileSync(path.join(inputDir, file), 'utf8');
    const { data, seen } = normalize(file, source, palette);

    const outDir = path.join(root, target.dir);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, file), data);

    before += Buffer.byteLength(source);
    after += Buffer.byteLength(data);
    report.push({ file, dir: target.dir, from: source.length, to: data.length, colours: seen.size });
  }

  const kb = (n) => `${(n / 1024).toFixed(0)} КБ`;
  console.log(`\n${'файл'.padEnd(22)}${'было'.padStart(9)}${'стало'.padStart(9)}  цветов  куда`);
  for (const r of report) {
    console.log(
      `${r.file.padEnd(22)}${kb(r.from).padStart(9)}${kb(r.to).padStart(9)}` +
        `${String(r.colours).padStart(8)}  ${r.dir}`,
    );
  }
  console.log(
    `\nИтого: ${kb(before)} → ${kb(after)} (−${Math.round((1 - after / before) * 100)}%), ` +
      `файлов: ${report.length}`,
  );
}

main();
