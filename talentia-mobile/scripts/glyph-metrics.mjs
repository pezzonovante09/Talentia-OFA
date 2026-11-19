/**
 * Ширины знаков Nunito 800 для карточки-символа (буква, слог, цифра; `design-lead`, этап D2 по аудиту 2026-11-09).
 * Читает таблицы `cmap` (формат 4), `hmtx`, `hhea`, `head` прямо из TTF пакета `@expo-google-fonts/nunito`
 * и печатает `src/design/glyphMetrics.ts`. Тест `src/design/__tests__/glyphMetrics.test.ts` сверяет файл с шрифтом:
 * поменялся шрифт — перегенерировать:
 *
 *   node scripts/glyph-metrics.mjs > src/design/glyphMetrics.ts
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const FONT = join(ROOT, 'node_modules/@expo-google-fonts/nunito/800ExtraBold/Nunito_800ExtraBold.ttf');

/** Знаки, которые может показать карточка: кириллица ru и ky, латиница, цифры. */
export const CHARS = [
  ...'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯҢӨҮ',
  ...'абвгдеёжзийклмнопрстуфхцчшщъыьэюяңөү',
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  ...'abcdefghijklmnopqrstuvwxyz',
  ...'0123456789',
];

function tables(font) {
  const out = {};
  const n = font.readUInt16BE(4);
  for (let i = 0; i < n; i += 1) {
    const e = 12 + i * 16;
    out[font.toString('latin1', e, e + 4)] = font.readUInt32BE(e + 8);
  }
  return out;
}

function glyphIndex(font, cmap, cp) {
  const subtables = font.readUInt16BE(cmap + 2);
  for (let i = 0; i < subtables; i += 1) {
    const off = cmap + font.readUInt32BE(cmap + 4 + i * 8 + 4);
    if (font.readUInt16BE(off) !== 4) continue;
    const segX2 = font.readUInt16BE(off + 6);
    const ends = off + 14;
    const starts = ends + segX2 + 2;
    const deltas = starts + segX2;
    const ranges = deltas + segX2;
    for (let s = 0; s < segX2; s += 2) {
      if (cp > font.readUInt16BE(ends + s)) continue;
      const start = font.readUInt16BE(starts + s);
      if (cp < start) return 0;
      const delta = font.readInt16BE(deltas + s);
      const range = font.readUInt16BE(ranges + s);
      if (range === 0) return (cp + delta) & 0xffff;
      const g = font.readUInt16BE(ranges + s + range + (cp - start) * 2);
      return g === 0 ? 0 : (g + delta) & 0xffff;
    }
    return 0;
  }
  throw new Error('в шрифте нет подтаблицы cmap формата 4');
}

/** Рамка глифа из `glyf` (через `loca`): у составных Й, Ё — рамка всего знака. */
function glyphBox(font, t, g) {
  const long = font.readInt16BE(t.head + 50) === 1;
  const at = (i) => (long ? font.readUInt32BE(t.loca + i * 4) : font.readUInt16BE(t.loca + i * 2) * 2);
  const start = at(g);
  if (at(g + 1) === start) return { yMin: 0, yMax: 0 };
  return { yMin: font.readInt16BE(t.glyf + start + 4), yMax: font.readInt16BE(t.glyf + start + 8) };
}

const round3 = (x) => Math.round(x * 1000) / 1000;

/**
 * Ширины знаков в em, их чернила по вертикали `[yMin, yMax]` в em от базовой линии, натуральная высота строки
 * (ascender − descender) / unitsPerEm и середина строки над базовой линией — всё с 3 знаками после точки.
 */
export function measure(path = FONT) {
  const font = readFileSync(path);
  const t = tables(font);
  const upem = font.readUInt16BE(t.head + 18);
  const ascender = font.readInt16BE(t.hhea + 4);
  const descender = font.readInt16BE(t.hhea + 6);
  const hMetrics = font.readUInt16BE(t.hhea + 34);
  const advance = (g) => font.readUInt16BE(t.hmtx + Math.min(g, hMetrics - 1) * 4);
  const widths = {};
  const ink = {};
  for (const ch of CHARS) {
    const g = glyphIndex(font, t.cmap, ch.codePointAt(0));
    if (g === 0) throw new Error(`нет глифа ${ch}`);
    widths[ch] = round3(advance(g) / upem);
    const box = glyphBox(font, t, g);
    ink[ch] = [round3(box.yMin / upem), round3(box.yMax / upem)];
  }
  return { widths, ink, lineRatio: round3((ascender - descender) / upem), lineCenter: round3((ascender + descender) / 2 / upem) };
}

function emit() {
  const { widths, ink, lineRatio, lineCenter } = measure();
  const rows = CHARS.map((ch) => `  '${ch}': ${widths[ch]},`).join('\n');
  const inkRows = CHARS.map((ch) => `  '${ch}': [${ink[ch][0]}, ${ink[ch][1]}],`).join('\n');
  return `/**
 * Ширины знаков Nunito 800 в em и натуральная высота строки — из TTF (\`scripts/glyph-metrics.mjs\`, не править руками;
 * тест \`glyphMetrics.test.ts\` сверяет с файлом шрифта). Кегль карточки-символа считается от ширины, а не от числа
 * знаков: «МАШ» шире «111» почти вдвое (\`design-lead\`, этап D2 по аудиту 2026-11-09).
 */
export const GLYPH_ADVANCE_800: Readonly<Record<string, number>> = {
${rows}
};

/**
 * Чернила знака по вертикали — \`[yMin, yMax]\` в em от базовой линии: бреве Й, точки Ё, хвосты Щ, Ң, у. Кегль по
 * высоте плитки считается по ним (\`child-ux-specialist\` после D2): по одной ширине знак ложился на контур плитки.
 */
export const GLYPH_INK_800: Readonly<Record<string, readonly [number, number]>> = {
${inkRows}
};

/** (ascender − descender) / unitsPerEm: строка такой высоты не режет Й, Ё, Щ, Ң, ү. */
export const NUNITO_LINE_RATIO = ${lineRatio};

/** Середина строки над базовой линией, em: при высоте строки \`NUNITO_LINE_RATIO\` знак стоит в плитке вокруг неё. */
export const NUNITO_LINE_CENTER = ${lineCenter};
`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.stdout.write(emit());
