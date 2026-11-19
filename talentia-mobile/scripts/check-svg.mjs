#!/usr/bin/env node
/**
 * Приёмка SVG-ассетов (скилл `asset-pipeline`, ASSETS.md «Приёмка»): размер ≤ 300 КБ, есть viewBox,
 * нет текста, растра, градиентов, фильтров и белой подложки во весь кадр; цвета — из палитры.
 * Запуск: `npm run assets:check -- <файл.svg | папка> [...]`. Код выхода 1 — есть замечания.
 */
import fs from 'node:fs';
import path from 'node:path';

const MAX_BYTES = 300 * 1024;
/** Палитра ASSETS.md «Цвета бренда» плюс цвета-стимулы ABA (Ц2.12, Окабе–Ито без жёлтого и оранжевого). */
export const PALETTE = new Set(
  [
    '#2A1A12', '#FFF3E3', '#FFFFFF', '#FFE6C7', '#3FC08A', '#2FA24E', '#FFC42E', '#0E8FBF', '#D93A1E',
    '#5A34C4', '#F2B705', '#9671DB', '#E36A93', '#12855A', '#0072B2', '#D55E00', '#009E73', '#CC79A7',
  ].map((c) => c.toUpperCase()),
);

const expandHex = (h) => (h.length === 4 ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}` : h).toUpperCase();

export function checkSvg(text, bytes = Buffer.byteLength(text)) {
  const problems = [];
  if (bytes > MAX_BYTES) problems.push(`размер ${Math.round(bytes / 1024)} КБ > 300 КБ`);
  if (!/<svg[^>]*\bviewBox=/i.test(text)) problems.push('нет viewBox');
  if (/<text[\s>]/i.test(text)) problems.push('текст внутри картинки — надписи только из локалей');
  if (/<image[\s>]/i.test(text) || /data:image\//i.test(text)) problems.push('растр внутри SVG');
  if (/<(linear|radial)Gradient/i.test(text)) problems.push('градиент');
  if (/<filter[\s>]/i.test(text)) problems.push('фильтр (тень, размытие)');
  if (/<rect[^>]*width="100%"[^>]*fill="#?(fff|ffffff|white)"/i.test(text)) problems.push('белая подложка во весь кадр — фон должен быть прозрачным');
  if (/<metadata[\s>]/i.test(text)) problems.push('блок <metadata> (C2PA-подпись генератора) — удалить, это мёртвый вес');
  if (/preserveAspectRatio="none"/i.test(text)) problems.push('preserveAspectRatio="none" — убрать, иначе картинка растягивается');
  // Подложка во весь кадр, нарисованная путём: Higgsfield/Recraft отдают `<path fill="rgb(255,255,255)" d="M 0 0 L W 0 L W H L 0 H ...">`.
  const vb = /viewBox="\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*"/i.exec(text);
  if (vb) {
    const [, w, h] = vb;
    const num = (v) => v.replace(/\.0+$/, '').replace(/\\/g, '\\\\').replace(/\./g, '\\.');
    const full = new RegExp(`<path[^>]*fill="(?:#?(?:fff|ffffff|white)|rgb\\(\\s*255\\s*,\\s*255\\s*,\\s*255\\s*\\))"[^>]*d="\\s*M\\s*0\\s+0\\s+L\\s*${num(w)}\\s+0\\s+L\\s*${num(w)}\\s+${num(h)}`, 'i');
    // та же подложка в короткой записи после svgo: `M0 0h512v512H0z` (2026-11-12, вертушка партии наград)
    const short = new RegExp(`<path[^>]*fill="(?:#?(?:fff|ffffff|white)|rgb\\(\\s*255\\s*,\\s*255\\s*,\\s*255\\s*\\))"[^>]*d="\\s*M\\s*0[\\s,]+0\\s*h\\s*${num(w)}\\s*v\\s*${num(h)}\\s*H\\s*0\\s*z`, 'i');
    if (full.test(text) || short.test(text)) problems.push('белая подложка во весь кадр (путём) — удалить, фон должен быть прозрачным');
  }
  const off = new Set();
  for (const m of text.matchAll(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi)) {
    const c = expandHex(m[0]);
    if (!PALETTE.has(c)) off.add(c);
  }
  // Цвета в записи rgb(r,g,b) — так их пишет Higgsfield; чёрный #000000 допустим только как заливка иконки под `currentColor`.
  for (const m of text.matchAll(/rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)/gi)) {
    const c = `#${[m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
    if (!PALETTE.has(c) && c !== '#000000') off.add(`${c} (${m[0]})`);
  }
  if (off.size) problems.push(`цвета вне палитры: ${[...off].join(', ')}`);
  return problems;
}

function files(p) {
  const st = fs.statSync(p);
  if (st.isDirectory()) return fs.readdirSync(p).flatMap((f) => files(path.join(p, f)));
  return p.toLowerCase().endsWith('.svg') ? [p] : [];
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('check-svg.mjs')) {
  const targets = process.argv.slice(2);
  if (!targets.length) {
    console.error('Укажите файлы или папки: npm run assets:check -- assets/images/aba');
    process.exit(2);
  }
  let bad = 0;
  for (const f of targets.flatMap(files)) {
    const text = fs.readFileSync(f, 'utf8');
    const problems = checkSvg(text, fs.statSync(f).size);
    if (problems.length) {
      bad += 1;
      console.log(`✗ ${f}\n  - ${problems.join('\n  - ')}`);
    } else console.log(`✓ ${f}`);
  }
  process.exit(bad ? 1 : 0);
}
