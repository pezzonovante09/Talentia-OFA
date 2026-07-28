/** Dump all g4+legacy lesson tasks (RU resolved) for methodological audit. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'src/data/worlds.ts'), 'utf8');
const lines = src.split(/\r?\n/);
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8'));
const ky = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ky.json'), 'utf8'));
const g4 = JSON.parse(fs.readFileSync(path.join(root, 'scripts/_reaudit2_ids_g4.json'), 'utf8'));
const leg = JSON.parse(fs.readFileSync(path.join(root, 'scripts/_reaudit2_ids_glegacy.json'), 'utf8'));

function getNested(obj, dotted) {
  let cur = obj;
  for (const p of dotted.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}
function t(key) {
  if (!key) return '';
  return getNested(ru, key) ?? `<MISSING:${key}>`;
}
function te(key) {
  if (!key) return '';
  return getNested(en, key) ?? '';
}

const out = [];
const ids = [...g4, ...leg];

for (const meta of ids) {
  const id = meta.id;
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    // g4 often: id+topicId same line; legacy: id then topicId on next line
    const same = lines[i].includes(`id: '${id}'`) && lines[i].includes('topicId:');
    const split =
      lines[i].match(new RegExp(`^\\s*id:\\s*'${id}'\\s*,\\s*$`)) &&
      /topicId:/.test(lines[i + 1] || '');
    if (same || split) {
      start = i;
      break;
    }
  }
  if (start < 0) {
    out.push({ id, error: 'not found' });
    continue;
  }
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/id: '[a-z0-9-]+', topicId:/.test(lines[i])) {
      end = i;
      break;
    }
    if (/^\s*\]\s*\},?\s*$/.test(lines[i]) && i > start + 5) {
      // possible end of lessons array — keep going until next lesson or topics close
    }
  }
  // better: brace-depth from lesson `{`
  let braceStart = start;
  while (braceStart > 0 && !lines[braceStart].trim().startsWith('{')) braceStart--;
  let depth = 0;
  let endLine = start;
  for (let i = braceStart; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
    }
    if (depth === 0 && i > braceStart) {
      endLine = i;
      break;
    }
  }
  end = endLine + 1;

  const block = lines.slice(start, end).join('\n');
  const dialog = [];
  for (const m of block.matchAll(/\{ speaker: '(\w+)', textKey: '([^']+)' \}/g)) {
    dialog.push({ speaker: m[1], ru: t(m[2]), en: te(m[2]), key: m[2] });
  }
  const intro = [];
  for (const m of block.matchAll(/\{ titleKey: '([^']+)', bodyKey: '([^']+)'/g)) {
    intro.push({
      titleRu: t(m[1]),
      bodyRu: t(m[2]),
      titleEn: te(m[1]),
      bodyEn: te(m[2]),
      titleKey: m[1],
      bodyKey: m[2],
    });
  }
  const tasks = [];
  // Multi-line aware: find each task by id/type then scan following lines until next task or end
  const taskStarts = [];
  for (let i = start; i < end; i++) {
    const tm = lines[i].match(/id: '([\w-]+)', type: '(\w+)'/);
    if (!tm || /topicId/.test(lines[i])) continue;
    taskStarts.push({ line: i, tid: tm[1], type: tm[2], aba: /audience: 'special_aba'/.test(lines[i]) });
  }
  for (let ti = 0; ti < taskStarts.length; ti++) {
    const ts = taskStarts[ti];
    const tEnd = ti + 1 < taskStarts.length ? taskStarts[ti + 1].line : end;
    const chunk = lines.slice(ts.line, tEnd).join('\n');
    const qm = chunk.match(/questionKey: '([^']+)'/);
    const options = [];
    for (const om of chunk.matchAll(/\{ id: '(\w+)', textKey: '([^']+)', correct: (true|false)/g)) {
      options.push({ id: om[1], correct: om[3] === 'true', ru: t(om[2]), en: te(om[2]), key: om[2] });
    }
    const cam = chunk.match(/correctAnswerKey: '([^']+)'/);
    const ansLit = chunk.match(/answer:\s*"([^"]+)"/) || chunk.match(/answer:\s*'([^']+)'/);
    tasks.push({
      id: ts.tid,
      type: ts.type,
      aba: ts.aba,
      qRu: qm ? t(qm[1]) : '',
      qEn: qm ? te(qm[1]) : '',
      qKey: qm ? qm[1] : '',
      options,
      answer: cam ? t(cam[1]) : ansLit ? ansLit[1] : null,
      answerEn: cam ? te(cam[1]) : null,
    });
  }

  // en/ky flags
  const enkyFlags = [];
  for (const d of dialog) {
    if (/We'll recap|Hi! Lesson:|About this topic/i.test(d.en)) enkyFlags.push(`dialog_stub:${d.key}`);
    if (/We'll recap what matters/i.test(d.en)) enkyFlags.push(`en_dialog_stub:${d.key}`);
  }
  for (const inn of intro) {
    if (/We'll recap what matters/i.test(inn.bodyEn)) enkyFlags.push(`en_intro_stub:${inn.bodyKey}`);
    if (/^About this topic$/i.test(String(inn.titleEn).trim())) enkyFlags.push(`en_intro_title_stub:${inn.titleKey}`);
  }
  for (const tk of tasks) {
    if (/We'll recap|TODO|FIXME|placeholder/i.test(tk.qEn)) enkyFlags.push(`en_q_stub:${tk.qKey}`);
    if (/birthday/i.test(tk.qEn) && /hat|where|шляп/i.test(tk.qRu)) enkyFlags.push(`en_birthday_mismatch:${tk.id}`);
    for (const o of tk.options) {
      if (/We'll recap|TODO|placeholder/i.test(o.en)) enkyFlags.push(`en_opt_stub:${o.key}`);
    }
  }
  // ky equals ru
  for (const d of dialog) {
    const kyV = getNested(ky, d.key.replace(/^data\./, 'data.') === d.key ? d.key : d.key);
    const kyDirect = getNested(ky, d.key);
    if (typeof kyDirect === 'string' && kyDirect === d.ru && /[а-яё]/i.test(d.ru)) {
      enkyFlags.push(`ky_eq_ru:${d.key}`);
    }
  }

  out.push({
    id,
    title: meta.title,
    subject: meta.subject,
    world: meta.world,
    grade: g4.some((x) => x.id === id) ? 4 : 'legacy',
    types: meta.types,
    taskCount: meta.taskCount,
    dialog,
    intro,
    tasks: tasks.filter((x) => !x.aba),
    abaTasks: tasks.filter((x) => x.aba),
    enkyFlags: [...new Set(enkyFlags)],
  });
}

const outPath = path.join(root, 'scripts/_audit_g4_legacy_dump.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log('Wrote', out.length, 'lessons to', outPath);
console.log('Errors:', out.filter((x) => x.error).map((x) => x.id));
console.log('Wave2 checks:');
for (const id of ['g4r-text-l3', 'g4e-quest-l2', 'g4s-emo-l2', 'lab-physics-1']) {
  const L = out.find((x) => x.id === id);
  if (!L || L.error) {
    console.log(id, 'MISSING');
    continue;
  }
  console.log('\n===', id, '===');
  L.tasks.forEach((tk, i) => {
    const correct = tk.options.filter((o) => o.correct).map((o) => o.ru).join(' | ');
    console.log(`t${i + 1} <${tk.type}> Q: ${tk.qRu.slice(0, 120)}`);
    console.log(`   EN: ${String(tk.qEn).slice(0, 120)}`);
    if (correct) console.log(`   ✓ ${correct}`);
    if (tk.answer) console.log(`   answer: ${tk.answer}`);
  });
}
