/**
 * Метрики шрифта прямо из TTF пакетов `@expo-google-fonts/nunito` и `@expo-google-fonts/golos-text` — для тестов, где
 * важна настоящая ширина подписи и высота строки, а не средний шаг знака (этап F по аудиту 2026-11-09: средний шаг
 * 0.56 занижал «Сопротивляется» в Nunito 700; №203 — тот же замер для Golos Text). Читает `cmap` (формат 4), `hmtx`,
 * `hhea`, `head`, `loca` / `glyf`; кернинг не учитывается (у кириллицы он мал). Jest подменяет сами пакеты шрифтов
 * (`jest.setup.js`), а не файлы в них, поэтому файлы читаются по пути.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import type { LoadedFont } from '../ui/fonts';

type Font = { buf: Buffer; upem: number; hmtx: number; hMetrics: number; cmap: number; hhea: number; head: number; loca: number; glyf: number };

const cache = new Map<LoadedFont, Font>();

/** `Nunito_700Bold` → `node_modules/@expo-google-fonts/nunito/700Bold/Nunito_700Bold.ttf`; так же `GolosText_*`. */
export function fontFile(name: LoadedFont): string {
  const [prefix, variant] = name.split('_');
  const pkg = prefix === 'GolosText' ? 'golos-text' : 'nunito';
  return join(process.cwd(), 'node_modules/@expo-google-fonts', pkg, variant, `${name}.ttf`);
}

function load(name: LoadedFont): Font {
  const hit = cache.get(name);
  if (hit) return hit;
  const buf = readFileSync(fontFile(name));
  const table = (tag: string) => {
    for (let i = 0; i < buf.readUInt16BE(4); i += 1) {
      const e = 12 + i * 16;
      if (buf.toString('latin1', e, e + 4) === tag) return buf.readUInt32BE(e + 8);
    }
    throw new Error(`в ${name} нет таблицы ${tag}`);
  };
  const hhea = table('hhea');
  const head = table('head');
  const font = {
    buf,
    upem: buf.readUInt16BE(head + 18),
    hmtx: table('hmtx'),
    hMetrics: buf.readUInt16BE(hhea + 34),
    cmap: table('cmap'),
    hhea,
    head,
    loca: table('loca'),
    glyf: table('glyf'),
  };
  cache.set(name, font);
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

function glyphOf(name: LoadedFont, f: Font, ch: string): number {
  const g = glyphId(f, ch.codePointAt(0)!);
  if (g === 0) throw new Error(`в ${name} нет знака «${ch}»`);
  return g;
}

/** Есть ли знак в шрифте (без подстановки системным). */
export function hasGlyph(name: LoadedFont, ch: string): boolean {
  return glyphId(load(name), ch.codePointAt(0)!) !== 0;
}

/** Ширина строки в em при кегле 1 (сумма продвижений глифов). */
export function textEm(name: LoadedFont, text: string): number {
  const f = load(name);
  return [...text].reduce((sum, ch) => sum + f.buf.readUInt16BE(f.hmtx + Math.min(glyphOf(name, f, ch), f.hMetrics - 1) * 4) / f.upem, 0);
}

/** Вертикальные метрики строки из `hhea`, em: `ascender` > 0, `descender` > 0 (глубина под базовой линией). */
export function lineMetrics(name: LoadedFont): { ascender: number; descender: number } {
  const f = load(name);
  return { ascender: f.buf.readInt16BE(f.hhea + 4) / f.upem, descender: -f.buf.readInt16BE(f.hhea + 6) / f.upem };
}

/** Чернила знака по вертикали, em от базовой линии (рамка из `glyf`; у составных Й, Ё — рамка всего знака). */
export function inkBox(name: LoadedFont, ch: string): { yMin: number; yMax: number } {
  const f = load(name);
  const g = glyphOf(name, f, ch);
  const long = f.buf.readInt16BE(f.head + 50) === 1;
  const at = (i: number) => (long ? f.buf.readUInt32BE(f.loca + i * 4) : f.buf.readUInt16BE(f.loca + i * 2) * 2);
  const start = at(g);
  if (at(g + 1) === start) return { yMin: 0, yMax: 0 };
  return { yMin: f.buf.readInt16BE(f.glyf + start + 4) / f.upem, yMax: f.buf.readInt16BE(f.glyf + start + 8) / f.upem };
}

/**
 * Высота строки, при которой Android не срежет верх знаков `chars`, pt: строка ниже натуральной (`ascender +
 * descender`) теряет верх — `CustomLineHeightSpan` оставляет descender, а ascent ужимает до `lineHeight − descender`.
 * Поэтому нужно `lineHeight ≥ ceil(size × (верх чернил + descender))`.
 */
export function androidLineNeed(name: LoadedFont, size: number, chars: string): number {
  const top = Math.max(...[...chars].map((ch) => inkBox(name, ch).yMax));
  return Math.ceil(size * (top + lineMetrics(name).descender) - 1e-9);
}
