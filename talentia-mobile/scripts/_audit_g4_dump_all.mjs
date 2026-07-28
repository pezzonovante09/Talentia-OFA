/**
 * Dump all g4+legacy lessons with RU texts + EN/KY equality scan → UTF-8 files.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const worldsSrc = fs.readFileSync(path.join(root, 'src/data/worlds.ts'), 'utf8');
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8'));
const ky = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ky.json'), 'utf8'));
const g4Ids = JSON.parse(fs.readFileSync(path.join(root, 'scripts/_reaudit2_ids_g4.json'), 'utf8'));
const legIds = JSON.parse(fs.readFileSync(path.join(root, 'scripts/_reaudit2_ids_glegacy.json'), 'utf8'));

function getNested(obj, dotted) {
  let cur = obj;
  for (const p of dotted.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}
function t(locale, key) {
  if (!key) return '';
  const v = getNested(locale, key);
  return v == null ? `<MISSING:${key}>` : v;
}

function extractLessonBlock(id) {
  const re = new RegExp(`id:\\s*'${id}'\\s*,`);
  let idx = -1;
  let searchFrom = 0;
  while (true) {
    const m = re.exec(worldsSrc.slice(searchFrom));
    if (!m) break;
    const abs = searchFrom + m.index;
    const window = worldsSrc.slice(abs, abs + 160);
    if (/topicId:/.test(window)) {
      idx = abs;
      break;
    }
    searchFrom = abs + 1;
  }
  if (idx < 0) return null;
  let start = idx;
  while (start > 0 && worldsSrc[start] !== '{') start--;
  let depth = 0;
  for (let j = start; j < worldsSrc.length; j++) {
    if (worldsSrc[j] === '{') depth++;
    else if (worldsSrc[j] === '}') {
      depth--;
      if (depth === 0) return worldsSrc.slice(start, j + 1);
    }
  }
  return null;
}

function dumpLesson(id) {
  const block = extractLessonBlock(id);
  if (!block) return `!!! not found: ${id}\n`;
  const out = [];
  out.push(`\n######## ${id}`);
  for (const m of block.matchAll(/\{\s*speaker:\s*'(\w+)'\s*,\s*textKey:\s*'([^']+)'\s*\}/g)) {
    out.push(`  [dialog ${m[1]}] ${t(ru, m[2])}`);
  }
  for (const m of block.matchAll(/\{\s*titleKey:\s*'([^']+)'\s*,\s*bodyKey:\s*'([^']+)'/g)) {
    out.push(`  [intro] ${t(ru, m[1])} :: ${String(t(ru, m[2])).slice(0, 220)}`);
  }
  const idTypeRe = /id:\s*'([^']+)'\s*,\s*type:\s*'(\w+)'/g;
  const multiRe = /id:\s*'([^']+)'\s*,\s*\n\s*type:\s*'(\w+)'/g;
  const starts = [];
  for (const m of block.matchAll(idTypeRe)) {
    if (m[1] === id) continue;
    starts.push({ index: m.index, id: m[1], type: m[2] });
  }
  for (const m of block.matchAll(multiRe)) {
    if (m[1] === id) continue;
    if (starts.some((s) => s.id === m[1])) continue;
    starts.push({ index: m.index, id: m[1], type: m[2] });
  }
  starts.sort((a, b) => a.index - b.index);
  const seen = new Set();
  for (const s of starts) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    let objStart = s.index;
    while (objStart > 0 && block[objStart] !== '{') objStart--;
    let depth = 0;
    let objEnd = objStart;
    for (let j = objStart; j < block.length; j++) {
      if (block[j] === '{') depth++;
      else if (block[j] === '}') {
        depth--;
        if (depth === 0) {
          objEnd = j + 1;
          break;
        }
      }
    }
    const body = block.slice(objStart, objEnd);
    const aba = /audience:\s*'special_aba'/.test(body);
    const qKey = (body.match(/questionKey:\s*'([^']+)'/) || [])[1];
    const answerLit =
      (body.match(/answer:\s*"([^"]+)"/) || body.match(/answer:\s*'([^']+)'/) || [])[1] || null;
    const answerKey = (body.match(/correctAnswerKey:\s*'([^']+)'/) || [])[1] || null;
    out.push(
      `  ${s.id} <${s.type}>${aba ? ' [ABA]' : ''} Q: ${qKey ? t(ru, qKey) : '?'}`,
    );
    for (const om of body.matchAll(
      /\{\s*id:\s*'([^']+)'\s*,\s*textKey:\s*'([^']+)'\s*,\s*correct:\s*(true|false)/g,
    )) {
      out.push(
        `      ${om[1]}${om[3] === 'true' ? ' [✓] ' : '     '}${t(ru, om[2])}   {${om[2].replace('data.tasks.', '')}}`,
      );
    }
    if (answerLit) out.push(`      answer: ${answerLit}`);
    if (answerKey) out.push(`      answerKey: ${t(ru, answerKey)}   {${answerKey.replace('data.tasks.', '')}}`);
  }

  // enky scan
  const flags = [];
  const keyRe =
    /(?:textKey|titleKey|bodyKey|questionKey|correctAnswerKey):\s*'([^']+)'/g;
  for (const m of block.matchAll(keyRe)) {
    const k = m[1];
    const ruV = t(ru, k);
    const enV = t(en, k);
    const kyV = t(ky, k);
    if (typeof kyV === 'string' && kyV === ruV && /[а-яё]/i.test(String(ruV))) {
      flags.push(`ky_eq_ru:${k}`);
    }
    if (typeof enV === 'string' && /We'll recap what matters/i.test(enV)) flags.push(`en_stub:${k}`);
    if (typeof enV === 'string' && /^Hi! Lesson:/i.test(String(enV).trim())) flags.push(`en_dialog_stub:${k}`);
    if (typeof enV === 'string' && /^About this topic$/i.test(String(enV).trim())) flags.push(`en_title_stub:${k}`);
    if (typeof enV === 'string' && enV === ruV && /[а-яё]/i.test(String(ruV))) flags.push(`en_eq_ru:${k}`);
  }
  if (flags.length) {
    out.push(`  ENKY: ${[...new Set(flags)].join(' | ')}`);
  } else {
    out.push('  ENKY: (none)');
  }
  return out.join('\n') + '\n';
}

const all = [...g4Ids, ...legIds];
let text = `Audit dump ${new Date().toISOString()} count=${all.length}\n`;
const enkyMap = {};
for (const meta of all) {
  const d = dumpLesson(meta.id);
  text += d;
  const m = d.match(/ENKY: (.+)/);
  enkyMap[meta.id] = m && m[1] !== '(none)' ? m[1].split(' | ') : [];
}
fs.writeFileSync(path.join(root, 'scripts/_audit_g4_legacy_dump_utf8.txt'), text, 'utf8');
fs.writeFileSync(path.join(root, 'scripts/_audit_g4_enky_scan.json'), JSON.stringify(enkyMap, null, 2), 'utf8');
const withFlags = Object.entries(enkyMap).filter(([, f]) => f.length);
console.log('dumped', all.length, 'lessons; with enky flags:', withFlags.length);
for (const [id, f] of withFlags) {
  console.log(id, f.length, f.slice(0, 5).join('; '));
}
