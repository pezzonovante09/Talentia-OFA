/**
 * Карточка-символ для буквы и слога (`design-lead`, этап D2 по аудиту 2026-11-09).
 *
 * 1. Таблица ширин `GLYPH_ADVANCE_800` и высота строки — те, что в файле шрифта. Разбор `cmap` / `hmtx` / `hhea`
 *    написан здесь заново, независимо от генератора `scripts/glyph-metrics.mjs`: поменялся шрифт — тест красный,
 *    таблицу перегенерировать (`node scripts/glyph-metrics.mjs > src/design/glyphMetrics.ts`).
 * 2. Кегль `symbolFontSize`: ступень по числу знаков или меньше — по ширине и по общим чернилам знаков задания в
 *    высоте плитки (`child-ux-specialist` после D2; общие чернила и сдвиг — №192); замеры в самой малой зоне 288×172.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import {
  glyphEm,
  glyphInk,
  hasTwinDetail,
  narrowTileW,
  symbolField,
  symbolFontSize,
  symbolInkGaps,
  symbolMinSize,
  symbolShift,
} from '../glyphFit';
import { GLYPH_ADVANCE_800, GLYPH_INK_800, NUNITO_LINE_CENTER, NUNITO_LINE_RATIO } from '../glyphMetrics';
import { chooseTile, matchTile, NARROW_TASK_ZONE, orderTile } from '../taskTiles';
import { glyphCard, stroke, symbolGlyph } from '../tokens';

const FONT = join(process.cwd(), 'node_modules/@expo-google-fonts/nunito/800ExtraBold/Nunito_800ExtraBold.ttf');

function table(font: Buffer, tag: string): number {
  for (let i = 0; i < font.readUInt16BE(4); i += 1) {
    const e = 12 + i * 16;
    if (font.toString('latin1', e, e + 4) === tag) return font.readUInt32BE(e + 8);
  }
  throw new Error(`нет таблицы ${tag}`);
}

/** Индекс глифа по cmap формата 4 (с idDelta и idRangeOffset). */
function glyphId(font: Buffer, cp: number): number {
  const cmap = table(font, 'cmap');
  for (let i = 0; i < font.readUInt16BE(cmap + 2); i += 1) {
    const off = cmap + font.readUInt32BE(cmap + 8 + i * 8);
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
  }
  return 0;
}

describe('ширины Nunito 800 — из файла шрифта', () => {
  const font = readFileSync(FONT);
  const upem = font.readUInt16BE(table(font, 'head') + 18);
  const hhea = table(font, 'hhea');
  const hmtx = table(font, 'hmtx');
  const hMetrics = font.readUInt16BE(hhea + 34);
  const advance = (ch: string) => {
    const g = glyphId(font, ch.codePointAt(0)!);
    expect(g).toBeGreaterThan(0);
    return font.readUInt16BE(hmtx + Math.min(g, hMetrics - 1) * 4) / upem;
  };

  it('в таблице кириллица ru и ky в обоих регистрах, латиница и цифры', () => {
    const need = [...'АЁЯҢӨҮаёяңөүAZaz09'];
    expect(need.filter((ch) => GLYPH_ADVANCE_800[ch] === undefined)).toEqual([]);
    expect(Object.keys(GLYPH_ADVANCE_800)).toHaveLength(33 + 3 + 33 + 3 + 26 + 26 + 10);
  });

  it('каждая ширина совпадает с hmtx до 0.001 em', () => {
    const off = Object.entries(GLYPH_ADVANCE_800).filter(([ch, w]) => Math.abs(advance(ch) - w) > 0.0006);
    expect(off).toEqual([]);
  });

  it('высота строки = (ascender − descender) / unitsPerEm из hhea', () => {
    const ratio = (font.readInt16BE(hhea + 4) - font.readInt16BE(hhea + 6)) / upem;
    expect(NUNITO_LINE_RATIO).toBeCloseTo(ratio, 3);
    expect(glyphCard.lineHeightRatio).toBe(NUNITO_LINE_RATIO);
    // при 1.15 (прежнее) у Й, Ё и хвоста Ң не было запаса
    expect(NUNITO_LINE_RATIO).toBeGreaterThan(1.3);
  });

  it('чернила каждого знака совпадают с рамкой глифа в glyf до 0.001 em; середина строки — из hhea', () => {
    const loca = table(font, 'loca');
    const glyf = table(font, 'glyf');
    const long = font.readInt16BE(table(font, 'head') + 50) === 1;
    const at = (i: number) => (long ? font.readUInt32BE(loca + i * 4) : font.readUInt16BE(loca + i * 2) * 2);
    const off = Object.entries(GLYPH_INK_800).filter(([ch, [lo, hi]]) => {
      const g = glyphId(font, ch.codePointAt(0)!);
      const start = glyf + at(g);
      return Math.abs(font.readInt16BE(start + 4) / upem - lo) > 0.0006 || Math.abs(font.readInt16BE(start + 8) / upem - hi) > 0.0006;
    });
    expect(off).toEqual([]);
    expect(NUNITO_LINE_CENTER).toBeCloseTo((font.readInt16BE(hhea + 4) + font.readInt16BE(hhea + 6)) / 2 / upem, 3);
    // бреве Й выше прописной, хвост Щ и Ң ниже строки — то, что раньше ложилось на контур
    expect(GLYPH_INK_800['Й'][1]).toBeGreaterThan(GLYPH_INK_800['И'][1]);
    expect(GLYPH_INK_800['Щ'][0]).toBeLessThan(GLYPH_INK_800['Ш'][0]);
    expect(GLYPH_INK_800['Ң'][0]).toBeLessThan(GLYPH_INK_800['Н'][0]);
  });

  it('разбор различает знаки: Ш шире И, латинская A и кириллическая А — разные записи', () => {
    expect(GLYPH_ADVANCE_800['Ш']).toBeGreaterThan(GLYPH_ADVANCE_800['И']);
    expect('A').not.toBe('А');
    expect(GLYPH_ADVANCE_800.A).toBeDefined();
    expect(GLYPH_ADVANCE_800['А']).toBeDefined();
  });
});

describe('кегль карточки-символа', () => {
  const tile3 = narrowTileW(3);

  it('320 pt: три плитки в ряд по 85, поле под знак = плитка − 2 × stroke.bold − 2 × inset', () => {
    expect(tile3).toBeCloseTo(85.33, 1);
    expect(symbolField(tile3)).toBeCloseTo(tile3 - 2 * stroke.bold - 2 * glyphCard.inset, 5);
    expect(narrowTileW(2)).toBeCloseTo(136, 0);
  });

  it.each([
    ['А', 64],
    ['МА', 40],
    ['ЖИ', 36],
    ['көл', 36],
  ])('«%s» в плитке 85 — %i pt, проходит', (text, size) => {
    expect(symbolFontSize([text], tile3)).toBe(size);
    expect(size).toBeGreaterThanOrEqual(glyphCard.minSize);
  });

  it.each(['КӨЛ', 'МАШ', 'маш'])('«%s» в плитке 85 — меньше 32: только в раскладке шире (гард glyphFit)', (text) => {
    expect(symbolFontSize([text], tile3)).toBeLessThan(glyphCard.minSize);
    expect(symbolFontSize([text], narrowTileW(2))).toBeGreaterThanOrEqual(glyphCard.minSize);
  });

  it('один кегль на задание — по самому широкому знаку', () => {
    expect(symbolFontSize(['А', 'МА'], tile3)).toBe(symbolFontSize(['МА'], tile3));
    expect(glyphEm('МА')).toBeCloseTo(GLYPH_ADVANCE_800['М'] + GLYPH_ADVANCE_800['А'], 5);
  });

  it('цифры — как раньше: ступень symbolGlyph, ширина не меньше', () => {
    expect(symbolFontSize(['7'], tile3)).toBe(symbolGlyph[1]);
    expect(symbolFontSize(['10', '9'], tile3)).toBe(symbolGlyph[2]);
    // 4 пары match на 320 (плитка 60): «10» ещё ≥ 32
    expect(symbolFontSize(['10'], narrowTileW(4))).toBeGreaterThanOrEqual(glyphCard.minSize);
  });

  it('самая малая зона задания: 288×172 (ширина SE, высота Android 360×640 с тремя кнопками)', () => {
    expect(NARROW_TASK_ZONE).toEqual({ width: 288, height: 172 });
  });

  // Общие чернила задания в плитке не выходят за поле (плитка минус контур «выбрано» и отступ) ни вверх, ни вниз: бреве Й,
  // точки Ё, хвосты Щ, Ң, Д — тот различающий признак, который раньше сливался с контуром (`child-ux-specialist`).
  const inkFits = (texts: string[], tile: { w: number; h: number }) => {
    const size = symbolFontSize(texts, tile.w, tile.h);
    const [lo, hi] = glyphInk(texts);
    return (hi - lo) * size <= symbolField(tile.h) + 1e-9;
  };
  const { width, height } = NARROW_TASK_ZONE;
  const TWINS = [['И', 'Й'], ['Е', 'Ё'], ['Ш', 'Щ'], ['Н', 'Ң'], ['П', 'Ц'], ['О', 'Ө'], ['У', 'Ү']];

  it.each([
    ['match, 3 пары', matchTile(width, height, 3)],
    ['order, 3 места', orderTile(width, height, 3)],
    ['choose без стимула', chooseTile(width, height, 3, false)],
    ['choose со стимулом', chooseTile(width, height, 3, true)],
  ])('%s в зоне 288×172: чернила Й, Ё, Щ, Ң, Д и ц внутри поля; без Й кегль ≥ 32', (_name, tile) => {
    for (const set of [['Й', 'Щ'], ['Ё', 'Ң'], ['Д', 'Ц'], ['й', 'ц', 'у'], ...TWINS]) expect(inkFits(set, tile)).toBe(true);
    for (const set of [['Д', 'Ц'], ['й', 'ц', 'у']]) expect(symbolFontSize(set, tile.w, tile.h)).toBeGreaterThanOrEqual(glyphCard.minSize);
  });

  it('буквы с мелкой деталью (№192): Й, Ё, Щ, Ц, Ң, Ө, Ү в обоих регистрах — порог 40, без них — 32', () => {
    expect(glyphCard.twinMinSize).toBe(40);
    for (const ch of 'ЙЁЩЦҢӨҮйёщцңөү') expect([ch, hasTwinDetail(['А', ch])]).toEqual([ch, true]);
    for (const ch of 'ИЕШПНОУиешпноу') expect([ch, hasTwinDetail([ch])]).toEqual([ch, false]);
    expect(symbolMinSize(['И', 'Й'])).toBe(40);
    expect(symbolMinSize(['И', 'Ш', '7'])).toBe(glyphCard.minSize);
  });

  it.each([
    ['И', 'Й', 40],
    ['Е', 'Ё', 41],
    ['Ш', 'Щ', 42],
    ['Н', 'Ң', 42],
    ['П', 'Ц', 42],
    ['О', 'Ө', 52],
    ['У', 'Ү', 52],
  ])('пара %s/%s в match и order самой малой зоны — %i pt, не меньше порога 40 (было 31 для Й)', (a, b, size) => {
    for (const tile of [matchTile(width, height, 3), orderTile(width, height, 3)]) {
      expect(symbolFontSize([a, b], tile.w, tile.h)).toBe(size);
      expect(size).toBeGreaterThanOrEqual(symbolMinSize([a, b]));
    }
  });

  it('детали и сверху, и снизу (Й с Щ, Ё с Ң) — 34 pt в match: ниже 40, только choose без стимула', () => {
    const m = matchTile(width, height, 3);
    const choose = chooseTile(width, height, 3, false);
    for (const set of [['Й', 'Щ'], ['Ё', 'Ң']]) {
      expect(symbolFontSize(set, m.w, m.h)).toBe(34);
      expect(symbolFontSize(set, m.w, m.h)).toBeLessThan(symbolMinSize(set));
      expect(symbolFontSize(set, choose.w, choose.h)).toBeGreaterThanOrEqual(symbolMinSize(set));
    }
  });

  it('сдвиг один на все знаки задания: середина общих чернил — в середине карточки, базовая линия общая', () => {
    const size = 40;
    // бреве Й поднимает чернила — знаки опускаются; хвост Щ опускает — поднимаются
    expect(symbolShift(['И', 'Й'], size)).toBeGreaterThan(0);
    expect(symbolShift(['Ш', 'Щ'], size)).toBeLessThan(0);
    const [lo, hi] = glyphInk(['И', 'Й']);
    expect(lo).toBe(Math.min(GLYPH_INK_800['И'][0], GLYPH_INK_800['Й'][0]));
    expect(hi).toBe(GLYPH_INK_800['Й'][1]);
    expect(symbolShift(['И', 'Й'], size)).toBeCloseTo(((lo + hi) / 2 - NUNITO_LINE_CENTER) * size, 9);
    // у цифр сдвиг мал: не больше 1.5 pt
    expect(Math.abs(symbolShift(['1', '2', '3'], 52))).toBeLessThanOrEqual(1.5);
  });

  it('сдвиг уравнивает зазоры сверху и снизу, и оба не меньше inset 4 pt (child-ux, №192; округление Android — К2 5.1д)', () => {
    const tiles = [matchTile(width, height, 3), orderTile(width, height, 3), chooseTile(width, height, 3, false), chooseTile(width, height, 3, true)];
    for (const tile of tiles) {
      for (const set of [...TWINS, ['Й', 'Щ'], ['Ё', 'Ң'], ['1', '2', '3'], ['7']]) {
        const size = symbolFontSize(set, tile.w, tile.h);
        const [top, bottom] = symbolInkGaps(set, tile.h, size);
        // без сдвига у И/Й зазор сверху был бы на 2 × shift меньше нижнего — бреве у рамки
        expect([set.join(''), tile.h, Math.abs(top - bottom) < 1e-9, Math.min(top, bottom) >= glyphCard.inset - 1e-9]).toEqual([set.join(''), tile.h, true, true]);
      }
    }
  });

  it('в плитке match 85×58 высота режет кегль буквы: без высоты он вышел бы за поле', () => {
    const tile = matchTile(width, height, 3);
    expect(tile.h).toBe(58);
    const byWidth = symbolFontSize(['Й'], tile.w);
    const [lo, hi] = glyphInk(['Й']);
    expect((hi - lo) * byWidth).toBeGreaterThan(symbolField(tile.h));
    expect(symbolFontSize(['Й'], tile.w, tile.h)).toBeLessThan(byWidth);
  });

  it('цифры в плитке match 85×58 — кегль по высоте не ниже 32', () => {
    const tile = matchTile(width, height, 3);
    expect(symbolFontSize(['1', '2', '3'], tile.w, tile.h)).toBeGreaterThanOrEqual(glyphCard.minSize);
  });
});
