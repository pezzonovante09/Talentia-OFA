/**
 * Ширина строки в em по файлу шрифта Nunito — для тестов, где важна настоящая ширина подписи, а не средний шаг знака
 * (этап F по аудиту 2026-11-09: средний шаг 0.56 занижал «Сопротивляется» в Nunito 700). Читает `cmap` (формат 4) и
 * `hmtx` прямо из TTF пакета `@expo-google-fonts/nunito`; кернинг не учитывается (у кириллицы Nunito он мал).
 */
import { readFileSync } from 'fs';
import { join } from 'path';

type Font = { buf: Buffer; upem: number; hmtx: number; hMetrics: number; cmap: number };

const cache = new Map<string, Font>();

function load(variant: '400Regular' | '700Bold' | '800ExtraBold'): Font {
  const hit = cache.get(variant);
  if (hit) return hit;
  const buf = readFileSync(join(process.cwd(), 'node_modules/@expo-google-fonts/nunito', variant, `Nunito_${variant}.ttf`));
  const table = (tag: string) => {
    for (let i = 0; i < buf.readUInt16BE(4); i += 1) {
      const e = 12 + i * 16;
      if (buf.toString('latin1', e, e + 4) === tag) return buf.readUInt32BE(e + 8);
    }
    throw new Error(`нет таблицы ${tag}`);
  };
  const hhea = table('hhea');
  const font = { buf, upem: buf.readUInt16BE(table('head') + 18), hmtx: table('hmtx'), hMetrics: buf.readUInt16BE(hhea + 34), cmap: table('cmap') };
  cache.set(variant, font);
  return font;
}

function glyphId(f: Font, cp: number): number {
  const { buf, cmap } = f;
  for (let i = 0; i < buf.readUInt16BE(cmap + 2); i += 1) {
    const off = cmap + buf.readUInt32BE(cmap + 8 + i * 8);
    if (buf.readUInt16BE(off) !== 4) continue;
    const segX2 = buf.readUInt16BE(off + 6);
    const ends = off + 14;
    const starts = ends + segX2 + 2;
    const deltas = starts + segX2;
    const ranges = deltas + segX2;
    for (let s = 0; s < segX2; s += 2) {
      if (cp > buf.readUInt16BE(ends + s)) continue;
      const start = buf.readUInt16BE(starts + s);
      if (cp < start) return 0;
      const delta = buf.readInt16BE(deltas + s);
      const range = buf.readUInt16BE(ranges + s);
      if (range === 0) return (cp + delta) & 0xffff;
      const g = buf.readUInt16BE(ranges + s + range + (cp - start) * 2);
      return g === 0 ? 0 : (g + delta) & 0xffff;
    }
  }
  return 0;
}

/** Ширина строки в em при кегле 1 (сумма продвижений глифов). */
export function textEm(variant: '400Regular' | '700Bold' | '800ExtraBold', text: string): number {
  const f = load(variant);
  return [...text].reduce((sum, ch) => {
    const g = glyphId(f, ch.codePointAt(0)!);
    if (g === 0) throw new Error(`в Nunito ${variant} нет знака «${ch}»`);
    return sum + f.buf.readUInt16BE(f.hmtx + Math.min(g, f.hMetrics - 1) * 4) / f.upem;
  }, 0);
}
