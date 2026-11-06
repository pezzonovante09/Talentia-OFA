/**
 * Кыргызский алфавит в шрифте приложения (REBUILD.md, шаг i18n): ң ө ү и их прописные лежат в cyrillic-ext,
 * которого нет во многих семействах. Без глифа буква молча подставится системным шрифтом, тестом такое
 * не увидеть. Читаем таблицу cmap прямо из файлов шрифта: Jest подменяет сам пакет, а не файлы в нём.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const KYRGYZ = [0x04a2, 0x04a3, 0x04e8, 0x04e9, 0x04ae, 0x04af];

function fontPath(variant: string) {
  return join(process.cwd(), 'node_modules/@expo-google-fonts/nunito', variant, `Nunito_${variant}.ttf`);
}

/** Минимальный разбор cmap: формат 4 (BMP) — для букв выше его достаточно. */
function hasGlyph(font: Buffer, codePoint: number): boolean {
  const tables = font.readUInt16BE(4);
  let cmap = -1;
  for (let i = 0; i < tables; i += 1) {
    const entry = 12 + i * 16;
    if (font.toString('latin1', entry, entry + 4) === 'cmap') cmap = font.readUInt32BE(entry + 8);
  }
  if (cmap < 0) throw new Error('в шрифте нет таблицы cmap');

  const subtables = font.readUInt16BE(cmap + 2);
  for (let i = 0; i < subtables; i += 1) {
    const offset = cmap + font.readUInt32BE(cmap + 4 + i * 8 + 4);
    if (font.readUInt16BE(offset) !== 4) continue;

    const segX2 = font.readUInt16BE(offset + 6);
    const ends = offset + 14;
    const starts = ends + segX2 + 2;
    const deltas = starts + segX2;
    const ranges = deltas + segX2;
    for (let s = 0; s < segX2; s += 2) {
      if (codePoint > font.readUInt16BE(ends + s)) continue;
      const start = font.readUInt16BE(starts + s);
      if (codePoint < start) return false;
      const range = font.readUInt16BE(ranges + s);
      if (range === 0) return true;
      return font.readUInt16BE(ranges + s + range + (codePoint - start) * 2) !== 0;
    }
    return false;
  }
  throw new Error('в шрифте нет подтаблицы cmap формата 4');
}

describe('кыргызские буквы в Nunito', () => {
  it.each(['400Regular', '700Bold', '800ExtraBold'])('%s содержит ң ө ү и прописные', (variant) => {
    const font = readFileSync(fontPath(variant));
    expect(KYRGYZ.filter((codePoint) => !hasGlyph(font, codePoint))).toEqual([]);
  });

  it('разбор различает букву, которой в шрифте нет', () => {
    const font = readFileSync(fontPath('800ExtraBold'));
    expect(hasGlyph(font, 0x0416)).toBe(true); // Ж
    expect(hasGlyph(font, 0x0e01)).toBe(false); // тайская буква
  });
});
