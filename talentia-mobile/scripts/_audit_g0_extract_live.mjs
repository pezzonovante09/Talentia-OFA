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
const abaEn = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/abaTextOverrides.en.generated.json'), 'utf8'));
const abaKy = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/abaTextOverrides.ky.generated.json'), 'utf8'));
const abaRu = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/abaTextOverrides.generated.json'), 'utf8'));
const meta = JSON.parse(fs.readFileSync(path.join(__dirname, '_reaudit2_ids_g0.json'), 'utf8'));

// Inline task maps (rw56 etc.)
const rw56Path = path.join(root, 'src/data/rw56LessonTasks.ts');
const rw56 = fs.existsSync(rw56Path) ? fs.readFileSync(rw56Path, 'utf8') : '';

function t(obj, key) {
  if (!key) return '';
  let c = obj;
  for (const p of String(key).split('.')) {
    c = c?.[p];
    if (c === undefined) return null;
  }
  return c;
}
function short(k) {
  return String(k || '').replace(/^data\.tasks\./, '');
}
function isNumeric(s) {
  return /^[\d\s+\-×÷=<>,.]+$/.test(String(s || '').trim());
}

function findLessonBlock(id) {
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(`id: '${id}'`) && /topicId:/.test(lines[i + 1] || '')) {
      start = i;
      break;
    }
    if (new RegExp(`id: '${id}',\\s*topicId:`).test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/id: '[a-z0-9-]+',/.test(lines[i]) && /topicId:/.test(lines[i + 1] || '')) {
      end = i;
      break;
    }
  }
  return { start, end, block: lines.slice(start, end).join('\n') };
}

function parseTasksFromBlock(block) {
  const tasks = [];
  const blines = block.split('\n');
  const taskStarts = [];
  for (let i = 0; i < blines.length; i++) {
    // Single-line: id: 'x', type: 'y'
    let m = blines[i].match(/(?:^|\s)id:\s*'([\w-]+)',\s*type:\s*'(\w+)'/);
    if (m) {
      taskStarts.push({ i, id: m[1], type: m[2] });
      continue;
    }
    // Multi-line TS: id on one line, type on next
    m = blines[i].match(/^\s*id:\s*'([\w-]+)',\s*$/);
    if (m && /type:\s*'(\w+)'/.test(blines[i + 1] || '')) {
      const tm = blines[i + 1].match(/type:\s*'(\w+)'/);
      taskStarts.push({ i, id: m[1], type: tm[1] });
      continue;
    }
    // JSON-style in rw56: "id": "x", then "type": "y"
    m = blines[i].match(/"id":\s*"([\w-]+)"/);
    if (m) {
      // look ahead a few lines for type
      let typ = null;
      for (let j = i; j < Math.min(i + 4, blines.length); j++) {
        const tm = blines[j].match(/"type":\s*"(\w+)"/);
        if (tm) {
          typ = tm[1];
          break;
        }
      }
      if (typ) taskStarts.push({ i, id: m[1], type: typ });
    }
  }
  for (let ti = 0; ti < taskStarts.length; ti++) {
    const { i, id, type } = taskStarts[ti];
    if (type === 'undefined' || id.includes('topic')) continue;
    const end = ti + 1 < taskStarts.length ? taskStarts[ti + 1].i : blines.length;
    const chunk = blines.slice(i, end).join('\n');
    if (/topicId:/.test(chunk.split('\n').slice(0, 3).join('\n'))) continue;
    const qm =
      chunk.match(/questionKey:\s*'([^']+)'/) || chunk.match(/"questionKey":\s*"([^"]+)"/);
    const aud = /audience:\s*'special_aba'/.test(chunk) || /"audience":\s*"special_aba"/.test(chunk);
    const qk = qm ? qm[1] : null;
    const opts = [];
    for (const om of chunk.matchAll(
      /\{\s*id:\s*'([\w-]+)',\s*textKey:\s*'([^']+)',\s*correct:\s*(true|false)/g
    )) {
      opts.push({
        id: om[1],
        correct: om[3] === 'true',
        key: short(om[2]),
        ru: t(ru, om[2]),
        en: t(en, om[2]),
        ky: t(ky, om[2]),
      });
    }
    for (const om of chunk.matchAll(
      /\{\s*"id":\s*"([\w-]+)",\s*"textKey":\s*"([^"]+)",\s*"correct":\s*(true|false)/g
    )) {
      opts.push({
        id: om[1],
        correct: om[3] === 'true',
        key: short(om[2]),
        ru: t(ru, om[2]),
        en: t(en, om[2]),
        ky: t(ky, om[2]),
      });
    }
    // Multi-line JSON options
    if (opts.length === 0) {
      const optBlocks = [...chunk.matchAll(/"id":\s*"([\w-]+)"[\s\S]*?"textKey":\s*"([^"]+)"[\s\S]*?"correct":\s*(true|false)/g)];
      for (const om of optBlocks) {
        if (om[1] === id) continue; // skip task id itself if matched
        opts.push({
          id: om[1],
          correct: om[3] === 'true',
          key: short(om[2]),
          ru: t(ru, om[2]),
          en: t(en, om[2]),
          ky: t(ky, om[2]),
        });
      }
    }
    let answer = null;
    const cam =
      chunk.match(/correctAnswerKey:\s*'([^']+)'/) ||
      chunk.match(/"correctAnswerKey":\s*"([^"]+)"/);
    const lit = chunk.match(/answer:\s*"([^"]+)"/) || chunk.match(/answer:\s*'([^']+)'/);
    if (cam) {
      answer = { key: short(cam[1]), ru: t(ru, cam[1]), en: t(en, cam[1]), ky: t(ky, cam[1]) };
    } else if (lit) {
      answer = { literal: lit[1], ru: lit[1], en: lit[1], ky: lit[1] };
    }
    const vc = chunk.match(/visualCount:\s*(\d+)/) || chunk.match(/"visualCount":\s*(\d+)/);
    const ve = chunk.match(/visualEmoji:\s*'([^']+)'/) || chunk.match(/"visualEmoji":\s*"([^"]+)"/);
    tasks.push({
      id,
      type,
      aba: aud,
      qKey: qk,
      qRu: qk ? t(ru, qk) : null,
      qEn: qk ? t(en, qk) : null,
      qKy: qk ? t(ky, qk) : null,
      opts,
      answer,
      visualCount: vc ? Number(vc[1]) : null,
      visualEmoji: ve ? ve[1] : null,
    });
  }
  return tasks;
}

function parseRw56Lesson(id) {
  // Find RW56_LESSON_TASKS['id'] = [ ... ];
  const re = new RegExp(`['\"]${id}['\"]\\s*:\\s*\\[`);
  const m = re.exec(rw56);
  if (!m) return null;
  let i = m.index + m[0].length;
  let depth = 1;
  const start = i - 1;
  while (i < rw56.length && depth > 0) {
    const ch = rw56[i++];
    if (ch === '[') depth++;
    else if (ch === ']') depth--;
  }
  const block = rw56.slice(start, i);
  return parseTasksFromBlock(block);
}

const out = [];
const enky = [];

for (const item of meta) {
  const found = findLessonBlock(item.id);
  if (!found) {
    out.push({ id: item.id, error: 'not found in worlds.ts' });
    continue;
  }
  const { start, end, block } = found;
  const dialog = [];
  for (const dm of block.matchAll(/\{ speaker: '(\w+)', textKey: '([^']+)' \}/g)) {
    dialog.push({
      sp: dm[1],
      key: dm[2],
      ru: t(ru, dm[2]),
      en: t(en, dm[2]),
      ky: t(ky, dm[2]),
    });
  }
  const intros = [];
  for (const im of block.matchAll(/\{ titleKey: '([^']+)', bodyKey: '([^']+)'/g)) {
    intros.push({ title: t(ru, im[1]), body: String(t(ru, im[2]) || '').slice(0, 200) });
  }

  let tasks = parseTasksFromBlock(block);
  const rwRef = block.match(/RW56_LESSON_TASKS\[['\"]([^'\"]+)['\"]\]/);
  if (rwRef) {
    const fromMap = parseRw56Lesson(rwRef[1]);
    if (fromMap && fromMap.length) tasks = fromMap;
  }

  const title = t(ru, block.match(/titleKey: '([^']+)'/)?.[1]) || item.title;

  const lesson = {
    id: item.id,
    title,
    subject: item.subject,
    world: item.world,
    lines: `${start + 1}-${end}`,
    dialog,
    intros,
    tasks,
  };
  out.push(lesson);

  // EN/KY flags (real only)
  const flags = [];
  for (const d of dialog) {
    if (!d.en || /TODO|FIXME|\[EN\]|lorem|stub/i.test(String(d.en))) {
      flags.push({ ref: 'dialog', issue: 'en_stub_or_missing', text: String(d.en).slice(0, 80) });
    }
    if (!d.ky || /TODO|FIXME|\[KY\]|lorem|stub/i.test(String(d.ky))) {
      flags.push({ ref: 'dialog', issue: 'ky_stub_or_missing', text: String(d.ky).slice(0, 80) });
    }
    if (d.ky && d.ru && d.ky === d.ru && String(d.ru).length > 25) {
      flags.push({ ref: 'dialog', issue: 'ky_eq_ru_dialog', text: String(d.ru).slice(0, 80) });
    }
    if (d.en && d.ru && d.en === d.ru && /[А-Яа-яЁё]{5,}/.test(String(d.en))) {
      flags.push({ ref: 'dialog', issue: 'en_eq_ru_dialog', text: String(d.en).slice(0, 80) });
    }
  }
  for (const task of tasks) {
    const r = task.qRu;
    const e = task.qEn;
    const k = task.qKy;
    if (!e) flags.push({ ref: task.id, issue: 'en_missing_q' });
    if (!k) flags.push({ ref: task.id, issue: 'ky_missing_q' });

    // Whitelist: intentional RU letter/syllable/wordform targets
    const intentionalRuTarget =
      item.subject === 'reading_ru' ||
      /первая буква|покажи слог|слог |букв/i.test(String(r || '')) ||
      /^[А-ЯЁA-Z]{1,8}( — | - )/.test(String(r || '').trim());

    if (k && r && k === r && !isNumeric(r) && String(r).length > 12 && !intentionalRuTarget) {
      const pureTarget =
        /^[А-Яа-яЁёA-Za-z]{1,6}$/.test(String(r).trim()) ||
        /^(МА|МО|МУ|СА|СО|СУ|НА|НО|РА)([-\s]|$)/.test(String(r).trim());
      if (!pureTarget) {
        flags.push({ ref: task.id, issue: 'ky_eq_ru_question', text: String(r).slice(0, 100) });
      }
    }

    if (e && item.subject !== 'reading_ru' && /[А-Яа-яЁё]{8,}/.test(String(e)) && e === r) {
      flags.push({ ref: task.id, issue: 'en_eq_ru_question', text: String(e).slice(0, 100) });
    }

    // Options EN/KY
    for (const o of task.opts) {
      if (o.ky && o.ru && o.ky === o.ru && !isNumeric(o.ru) && String(o.ru).length > 15 && item.subject !== 'reading_ru') {
        // cognate/short whitelist skip; long prose options matter
        flags.push({ ref: `${task.id}.${o.id}`, issue: 'ky_eq_ru_option', text: String(o.ru).slice(0, 80) });
      }
      if (o.en && o.ru && o.en === o.ru && /[А-Яа-яЁё]{6,}/.test(String(o.en)) && item.subject !== 'reading_ru') {
        flags.push({ ref: `${task.id}.${o.id}`, issue: 'en_eq_ru_option', text: String(o.en).slice(0, 80) });
      }
    }

    if (task.aba) {
      const sh = short(task.qKey);
      const aEn = abaEn[sh] || abaEn[task.qKey] || e;
      const aKy = abaKy[sh] || abaKy[task.qKey] || k;
      const aRu = abaRu[sh] || abaRu[task.qKey] || r;
      if (aKy && aRu && aKy === aRu && !isNumeric(aRu) && String(aRu).length > 8 && !intentionalRuTarget) {
        flags.push({ ref: task.id, issue: 'aba_ky_eq_ru', text: String(aKy).slice(0, 80) });
      }
      if (aEn && aRu && aEn === aRu && /[А-Яа-яЁё]{4,}/.test(String(aEn)) && item.subject !== 'reading_ru') {
        flags.push({ ref: task.id, issue: 'aba_en_eq_ru', text: String(aEn).slice(0, 80) });
      }
    }
  }
  if (flags.length) enky.push({ id: item.id, world: item.world, subject: item.subject, flags });
}

fs.writeFileSync(path.join(__dirname, '_audit_g0_live.json'), JSON.stringify(out, null, 2));
fs.writeFileSync(path.join(__dirname, '_audit_g0_enky_scan.json'), JSON.stringify(enky, null, 2));
console.log('lessons', out.length);
console.log(
  'task counts:',
  out.map((l) => `${l.id}:${l.tasks?.length || 0}`).join(' ')
);
console.log('enky flagged lessons', enky.length);
for (const r of enky) {
  console.log(r.id, r.flags.map((f) => f.issue).join(','));
}
