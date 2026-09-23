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
 *   1. сопоставляет каждый цвет файла ближайшему токену из его палитры,
 *      сохраняя при этом светотень: если в один токен попало несколько
 *      цветов, они остаются разными по светлоте, иначе фигура теряет объём;
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

function toHex({ h, s, l }) {
  const S = s / 100;
  const L = l / 100;
  const k = (n) => (n + h / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const hx = (v) =>
    Math.round(Math.max(0, Math.min(1, v)) * 255)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
  return `#${hx(f(0))}${hx(f(8))}${hx(f(4))}`;
}

/** Расстояние по оттенку с учётом того, что круг замкнут. */
function hueGap(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** sRGB → CIELAB, D65. */
function toLab(hex) {
  const lin = (v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = lin(parseInt(hex.slice(1, 3), 16));
  const g = lin(parseInt(hex.slice(3, 5), 16));
  const b = lin(parseInt(hex.slice(5, 7), 16));
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

/**
 * Выбор «семьи» — того токена, которым цвет станет.
 *
 * Считаем в CIELAB, а не в HSL, потому что подбор весов в HSL не сходится:
 * стоит поднять вес оттенка, чтобы кислотно-зелёный #8CF936 перестал
 * уезжать в жёлтый, — и туда же уезжает почти-белый #F9F4DB, у которого
 * оттенок бессмысленный, потому что цвета в нём почти нет. В LAB обе
 * пары разводятся сами: расстояние там устроено так, как цвета различает
 * глаз, и у светлого молочного ближайшим оказывается бумага, а не жёлтый,
 * без единого коэффициента.
 */
function family(hex, palette) {
  // Тёмное — это контур. Генератор рисует его тёмно-синим; правило стоит
  // явно ещё и потому, что контур единственный не затеняется.
  if (toHsl(hex).l < 22) return OUTLINE;

  const c = toLab(hex);
  let best = palette[0];
  let bestScore = Infinity;
  for (const p of palette) {
    const t = toLab(p);
    const score = (c.L - t.L) ** 2 + (c.a - t.a) ** 2 + (c.b - t.b) ** 2;
    if (score < bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

/**
 * Светотень внутри семьи.
 *
 * Когда в семью попадает несколько цветов, это почти всегда не случайность,
 * а градация: у холма светлая ступень, средняя и теневая; у динозавра
 * освещённый бок и затенённый. Если сплющить их в один токен, фигура
 * теряет объём и выглядит нарисованной заливкой — ровно то, из-за чего
 * первый макет вышел плоским.
 *
 * Поэтому семья берёт у токена оттенок и насыщенность, а светлоту каждому
 * участнику оставляет свою: считаем, насколько он отступает от средней
 * светлоты семьи, и откладываем тот же отступ от светлоты токена.
 *
 * Контур не затеняется никогда: он обязан быть одной линией одного цвета.
 */
function shadeFamily(token, members) {
  if (token === OUTLINE || members.length === 1) {
    return new Map(members.map((m) => [m, token]));
  }
  const t = toHsl(token);
  const mean = members.reduce((acc, m) => acc + toHsl(m).l, 0) / members.length;
  const out = new Map();
  for (const m of members) {
    const delta = toHsl(m).l - mean;
    out.set(m, toHex({ h: t.h, s: t.s, l: Math.max(10, Math.min(95, t.l + delta)) }));
  }
  return out;
}

/**
 * Полная таблица замен для файла: сначала семьи, потом светотень внутри них.
 * Заодно жалуется, если в одну семью попали цвета, разведённые по оттенку
 * больше чем на 55° — это уже не светотень, а два разных цвета, слипшихся
 * из-за бедной палитры, и такой файл стоит посмотреть глазами.
 */
function buildMapping(colours, palette) {
  const families = new Map();
  for (const c of colours) {
    const f = family(c, palette);
    if (!families.has(f)) families.set(f, []);
    families.get(f).push(c);
  }
  const mapping = new Map();
  const warnings = [];
  for (const [token, members] of families) {
    if (token !== OUTLINE && members.length > 1) {
      const hues = members.map((m) => toHsl(m).h);
      const spread = Math.max(...hues.map((a) => Math.max(...hues.map((b) => hueGap(a, b)))));
      if (spread > 55) {
        warnings.push(`${token}: слиплись разные цвета (${members.join(', ')}), разброс ${Math.round(spread)}°`);
      }
    }
    for (const [from, to] of shadeFamily(token, members)) mapping.set(from, to);
  }
  return { mapping, warnings };
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
        },
      },
    },
    // viewBox несёт пропорции кадра: шесть поз Tali обязаны совпадать,
    // иначе при переключении позы персонаж прыгает в размере.
    { name: 'removeViewBox', active: false },
    'removeMetadata',
    'removeComments',
    'removeDimensions',
  ],
};

function normalize(name, source, palette) {
  const re = /(fill|stroke)="(#[0-9a-fA-F]{6})"/g;
  // Первый проход — собрать всю палитру файла: решение по цвету зависит
  // от того, какие ещё цвета рядом, поэтому по одному его принять нельзя.
  const colours = [...new Set([...source.matchAll(re)].map((m) => m[2].toUpperCase()))];
  const { mapping, warnings } = buildMapping(colours, palette);
  const recoloured = source.replace(re, (_, attr, hex) => `${attr}="${mapping.get(hex.toUpperCase())}"`);
  const { data } = optimize(recoloured, { ...svgoConfig, path: name });
  return { data, mapping, warnings };
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
    const { data, mapping, warnings } = normalize(file, source, palette);
    for (const w of warnings) console.warn(`! ${file} — ${w}`);

    const outDir = path.join(root, target.dir);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, file), data);

    before += Buffer.byteLength(source);
    after += Buffer.byteLength(data);
    report.push({ file, dir: target.dir, from: source.length, to: data.length, colours: mapping.size, shades: new Set(mapping.values()).size });
  }

  const kb = (n) => `${(n / 1024).toFixed(0)} КБ`;
  console.log(`\n${'файл'.padEnd(22)}${'было'.padStart(9)}${'стало'.padStart(9)}  цветов  оттенков  куда`);
  for (const r of report) {
    console.log(
      `${r.file.padEnd(22)}${kb(r.from).padStart(9)}${kb(r.to).padStart(9)}` +
        `${String(r.colours).padStart(8)}${String(r.shades).padStart(10)}  ${r.dir}`,
    );
  }
  console.log(
    `\nИтого: ${kb(before)} → ${kb(after)} (−${Math.round((1 - after / before) * 100)}%), ` +
      `файлов: ${report.length}`,
  );
}

main();
