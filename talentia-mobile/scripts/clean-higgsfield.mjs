#!/usr/bin/env node
/**
 * Чистка SVG из Higgsfield (Recraft V4.1 vector) под приёмку ASSETS.md — скилл `asset-pipeline`, решение №177.
 * Higgsfield отдаёт: блок <metadata> C2PA (~18 КБ), белую подложку путём на весь кадр, viewBox 2048 (иконки) или
 * 2560×1664 (панорамы), preserveAspectRatio="none", цвета в rgb(), контур почти чёрный вместо #2A1A12, иногда мелкие
 * градиенты. Скрипт снимает всё это, приводит кадр к сетке вида и ужимает svgo.
 *
 * Запуск: `node scripts/clean-higgsfield.mjs <карта.json> <папка-вход> <папка-выход>`
 * Карта: [{ "src": "hf_…svg", "name": "ui-check.svg", "kind": "icon" | "landmark" | "stimulus" | "panorama" }]
 * Цвета заливок у стимулов и панорам НЕ подгоняются к палитре (скилл: увела модель — перегенерация); только контур,
 * у которого все каналы < 60, становится #2A1A12, и чёрная заливка иконки — currentColor.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const [mapFile, inDir, outDir] = process.argv.slice(2);
if (!mapFile || !inDir || !outDir) {
  console.error('node scripts/clean-higgsfield.mjs <карта.json> <вход> <выход>');
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });
const map = JSON.parse(fs.readFileSync(mapFile, 'utf8'));

const GRID = { icon: 32, landmark: 64, stimulus: 512 };
const PANO = { w: 1264, h: 848 };
const hex = (r, g, b) => `#${[r, g, b].map((v) => Number(v).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
const isOutlineDark = (c) => {
  const [r, g, b] = [c.slice(1, 3), c.slice(3, 5), c.slice(5, 7)].map((h) => parseInt(h, 16));
  return r < 60 && g < 60 && b < 60;
};

/** Грубый bbox пути по всем точкам команд (контрольные точки кривых тоже входят — для вложенности этого хватает). */
function pathBBox(d) {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) || [];
  let cmd = '', x = 0, y = 0, sx = 0, sy = 0, i = 0;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const pt = (px, py) => { if (px < minX) minX = px; if (px > maxX) maxX = px; if (py < minY) minY = py; if (py > maxY) maxY = py; };
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    const t = tokens[i];
    if (/^[a-zA-Z]$/.test(t)) { cmd = t; i++; if (cmd === 'Z' || cmd === 'z') { x = sx; y = sy; } continue; }
    const rel = cmd === cmd.toLowerCase();
    switch (cmd.toUpperCase()) {
      case 'M': { const nx = num(), ny = num(); x = rel ? x + nx : nx; y = rel ? y + ny : ny; sx = x; sy = y; pt(x, y); cmd = rel ? 'l' : 'L'; break; }
      case 'L': { const nx = num(), ny = num(); x = rel ? x + nx : nx; y = rel ? y + ny : ny; pt(x, y); break; }
      case 'H': { const nx = num(); x = rel ? x + nx : nx; pt(x, y); break; }
      case 'V': { const ny = num(); y = rel ? y + ny : ny; pt(x, y); break; }
      case 'C': { let px = x, py = y; for (let k = 0; k < 3; k++) { const nx = num(), ny = num(); px = rel ? x + nx : nx; py = rel ? y + ny : ny; pt(px, py); } x = px; y = py; break; }
      case 'S': case 'Q': { let px = x, py = y; for (let k = 0; k < 2; k++) { const nx = num(), ny = num(); px = rel ? x + nx : nx; py = rel ? y + ny : ny; pt(px, py); } x = px; y = py; break; }
      case 'T': { const nx = num(), ny = num(); x = rel ? x + nx : nx; y = rel ? y + ny : ny; pt(x, y); break; }
      case 'A': { i += 5; const nx = num(), ny = num(); x = rel ? x + nx : nx; y = rel ? y + ny : ny; pt(x, y); break; }
      default: i++;
    }
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Иконка из Recraft — стопка залитых фигур: контур-силуэт, чёрный глиф, иногда коричневый ободок дырки и сверху
 * БЕЛАЯ фигура «дырки». На цветном фоне она так и останется белой. Делаем дырку сквозной: белый подпуть дописывается
 * в каждую фигуру ниже, которая целиком его содержит (по bbox), с `fill-rule="evenodd"`; белая фигура удаляется.
 * Фигура, уже лежащая целиком внутри прежней дырки того же хозяина, в него не дописывается (иначе evenodd вернёт заливку).
 * Белая фигура, которой не нашлось хозяина, остаётся и попадает в отчёт — такой файл смотреть глазами.
 */
function punchHoles(svg) {
  const re = /<path\b([^>]*?)\/>/g;
  const paths = [];
  let m;
  while ((m = re.exec(svg))) {
    const attrs = m[1];
    const fill = (/fill="([^"]+)"/.exec(attrs) || [])[1] || '';
    const d = (/\sd="([^"]+)"/.exec(attrs) || [])[1] || '';
    paths.push({ full: m[0], attrs, fill, d, bbox: pathBBox(d), extra: [], removed: false });
  }
  const isWhite = (c) => /^#[0-9A-F]{6}$/i.test(c) && [1, 3, 5].every((k) => parseInt(c.slice(k, k + 2), 16) >= 245);
  const inside = (a, b, tol) => a.minX >= b.minX - tol && a.minY >= b.minY - tol && a.maxX <= b.maxX + tol && a.maxY <= b.maxY + tol;
  const left = [];
  let merged = 0;
  for (let i = 0; i < paths.length; i++) {
    const w = paths[i];
    if (!isWhite(w.fill)) continue;
    const tol = Math.max(w.bbox.maxX - w.bbox.minX, w.bbox.maxY - w.bbox.minY) * 0.02;
    const hosts = paths.slice(0, i).filter((p) => !p.removed && !isWhite(p.fill) && inside(w.bbox, p.bbox, tol)
      && !p.extra.some((e) => inside(w.bbox, e.bbox, -tol)));
    if (!hosts.length) { left.push(w.fill); continue; }
    for (const h of hosts) h.extra.push({ d: w.d, bbox: w.bbox });
    w.removed = true;
    merged++;
  }
  let out = svg;
  for (const p of paths) {
    if (p.removed) { out = out.replace(p.full, ''); continue; }
    if (p.extra.length) {
      const attrs = p.attrs.replace(/\sd="[^"]+"/, ` fill-rule="evenodd" d="${p.d} ${p.extra.map((e) => e.d).join(' ')}"`);
      out = out.replace(p.full, `<path${attrs}/>`);
    }
  }
  return { svg: out, merged, left };
}

/** Палитра стимулов ABA (docs/assets/aba-match-stimuli.md): 10 цветов, без жёлтого и оранжевого. */
const STIMULUS_PALETTE = ['#2A1A12', '#3FC08A', '#2FA24E', '#0E8FBF', '#D93A1E', '#5A34C4', '#9671DB', '#E36A93', '#FFE6C7', '#FFFFFF'];
function toLab(hexc) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hexc.slice(i, i + 2), 16) / 255).map((v) => (v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92));
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
const PALETTE_LAB = STIMULUS_PALETTE.map((c) => ({ c, lab: toLab(c) }));
function nearestPalette(hexc) {
  const l = toLab(hexc);
  let best = null;
  for (const p of PALETTE_LAB) {
    const d = Math.hypot(l[0] - p.lab[0], l[1] - p.lab[1], l[2] - p.lab[2]);
    if (!best || d < best.d) best = { c: p.c, d };
  }
  return best.c;
}

let snapped = {};
function clean(src, kind, overrides = {}) {
  snapped = {};
  let s = fs.readFileSync(src, 'utf8');
  const vb = /viewBox="\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*"/.exec(s);
  if (!vb) throw new Error('нет viewBox');
  const W = Number(vb[1]);
  const H = Number(vb[2]);
  // 1. мусор обёртки
  s = s.replace(/<metadata>[\s\S]*?<\/metadata>/g, '');
  s = s.replace(/\s(style|width|height|preserveAspectRatio|version|xmlns:c2pa)="[^"]*"/g, '');
  // 2. градиенты → первый цвет стопа
  const stops = {};
  for (const m of s.matchAll(/<(?:linear|radial)Gradient[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/(?:linear|radial)Gradient>/g)) {
    const st = /stop-color="([^"]+)"/.exec(m[2]);
    if (st) stops[m[1]] = st[1];
  }
  s = s.replace(/<defs>[\s\S]*?<\/defs>/g, '').replace(/<(?:linear|radial)Gradient[\s\S]*?<\/(?:linear|radial)Gradient>/g, '');
  s = s.replace(/fill="url\(#([^)]+)\)"/g, (_, id) => (stops[id] ? `fill="${stops[id]}"` : 'fill="none"'));
  // 3. rgb() → HEX
  s = s.replace(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g, (_, r, g, b) => hex(r, g, b));
  s = s.replace(/#[0-9a-f]{6}\b/gi, (c) => c.toUpperCase());
  // 4. белая подложка во весь кадр
  const num = (v) => String(v).replace(/\.0+$/, '').replace(/\./g, '\\.');
  s = s.replace(new RegExp(`<path[^>]*fill="#FFFFFF"[^>]*d="\\s*M\\s*0\\s+0\\s+L\\s*${num(W)}\\s+0\\s+L\\s*${num(W)}\\s+${num(H)}[^"]*"[^>]*/>`, 'i'), '');
  // 5. цвета: контур → #2A1A12; у иконок чёрная заливка → currentColor
  if (kind === 'icon' || kind === 'landmark') {
    // Иконка — ровно два цвета: глиф currentColor и контур #2A1A12; белое — будущие дырки (шаг 5а), остальное — контур.
    // `glyph` в карте — цвет глифа, если модель нарисовала его не чистым чёрным (контурная «пауза» — тёмно-бурым)
    if (overrides.glyph) s = s.split(`fill="${overrides.glyph}"`).join('fill="#000000"');
    s = s.replace(/fill="#000000"/g, 'fill="currentColor"');
    const isWhiteish = (c) => [1, 3, 5].every((k) => parseInt(c.slice(k, k + 2), 16) >= 245);
    s = s.replace(/fill="(#[0-9A-F]{6})"/g, (m, c) => (isWhiteish(c) ? m : 'fill="#2A1A12"'));
  } else if (kind === 'stimulus') {
    // Решение владельца 2026-11-06: цвета стимулов подгоняются к палитре скриптом (ближайший по Lab), а не перегенерацией.
    s = s.replace(/fill="(#[0-9A-F]{6})"/g, (m, c) => {
      // `snap` в карте — ручная поправка там, где ближайший по Lab цвет не тот по смыслу (синий ключ ушёл бы в лиловый)
      const to = overrides[c] || (isOutlineDark(c) ? '#2A1A12' : nearestPalette(c));
      if (to !== c) snapped[`${c}→${to}`] = (snapped[`${c}→${to}`] || 0) + 1;
      return `fill="${to}"`;
    });
  } else {
    s = s.replace(/fill="(#[0-9A-F]{6})"/g, (m, c) => (isOutlineDark(c) ? 'fill="#2A1A12"' : m));
  }
  s = s.replace(/\s*transform="translate\(0,0\)"/g, '');
  // 5а. у иконок «дырки» нарисованы белыми фигурами поверх чёрных — делаем их сквозными
  let holes = null;
  if (kind === 'icon' || kind === 'landmark') {
    const r = punchHoles(s);
    s = r.svg;
    holes = r;
  }
  // 6. кадр
  let inner = s.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  let open;
  if (kind === 'panorama') {
    const k = PANO.h / H;
    const dx = (PANO.w - W * k) / 2;
    open = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PANO.w} ${PANO.h}"><g transform="translate(${dx.toFixed(3)} 0) scale(${k.toFixed(6)})">`;
  } else {
    const g = GRID[kind];
    const k = g / Math.max(W, H);
    open = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${g} ${g}"><g transform="scale(${k.toFixed(8)})">`;
  }
  return { svg: `${open}${inner}</g></svg>`, holes, snapped: { ...snapped } };
}

const svgoCfg = path.join(outDir, '.svgo.config.mjs');
fs.writeFileSync(svgoCfg, `export default { multipass: true, plugins: [{ name: 'preset-default', params: { overrides: { cleanupIds: false, convertColors: false } } }, 'removeDimensions'] };\n`);

const report = [];
for (const { src, name, kind, snap: overrides } of map) {
  const inFile = path.join(inDir, src);
  const outFile = path.join(outDir, name);
  try {
    const { svg: pre, holes, snapped: snap } = clean(inFile, kind, overrides);
    const tmp = outFile + '.tmp.svg';
    fs.writeFileSync(tmp, pre);
    const precision = kind === 'panorama' ? '1' : kind === 'stimulus' ? '1' : '2';
    execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['svgo', '-q', '--config', svgoCfg, '-p', precision, '-i', tmp, '-o', outFile], { stdio: 'inherit', shell: process.platform === 'win32' });
    fs.unlinkSync(tmp);
    const out = fs.readFileSync(outFile, 'utf8');
    report.push({ name, kind, kb: Math.round(fs.statSync(outFile).size / 1024), paths: (out.match(/<path/g) || []).length, transform: /transform=/.test(out), holes, snap });
  } catch (e) {
    report.push({ name, kind, error: e.message.split('\n')[0] });
  }
}
fs.unlinkSync(svgoCfg);
for (const r of report) {
  const h = r.holes ? `\tдырок: ${r.holes.merged}${r.holes.left.length ? `, БЕЛЫХ БЕЗ ХОЗЯИНА: ${r.holes.left.length}` : ''}` : r.snap && Object.keys(r.snap).length ? `\tподогнано: ${Object.keys(r.snap).join(' ')}` : '';
  console.log(r.error ? `✗ ${r.name}: ${r.error}` : `${r.name}\t${r.kind}\t${r.kb} КБ\t${r.paths} путей${r.transform ? '\tTRANSFORM ОСТАЛСЯ' : ''}${h}`);
}
