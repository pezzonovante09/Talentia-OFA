/**
 * Dump G1 live lesson content using curriculum + ru.json bridged keys.
 * RW56 tasks are multi-line JSON — we reconstruct from bridge prefix keys in ru.json
 * and curriculum task structure, plus rewritten/inline banks.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8'));
const ky = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ky.json'), 'utf8'));
const worlds = fs.readFileSync(path.join(root, 'src/data/worlds.ts'), 'utf8');
const rwSrc = fs.readFileSync(path.join(root, 'src/data/rw56LessonTasks.ts'), 'utf8');
const g1mSrc = fs.readFileSync(path.join(root, 'src/data/g1mathBridgedTasks.ts'), 'utf8');
const g1rSrc = fs.readFileSync(path.join(root, 'src/data/g1rusBridgedTasks.ts'), 'utf8');
const g1wSrc = fs.readFileSync(path.join(root, 'src/data/g1worldRewrittenTasks.ts'), 'utf8');
const curriculum = fs.readFileSync(path.join(root, 'curricula/grade-1-curriculum-ru.md'), 'utf8');
const IDS = JSON.parse(fs.readFileSync(path.join(__dirname, '_reaudit2_ids_g1.json'), 'utf8'));

function t(obj, key) {
  if (!key) return null;
  let cur = obj;
  for (const p of String(key).split('.')) {
    cur = cur?.[p];
    if (cur === undefined) return null;
  }
  return cur;
}
function tr(key) {
  return t(ru, key) ?? `<MISSING:${key}>`;
}

function parseRw56Json(key) {
  const start = rwSrc.indexOf(`'${key}': [`);
  if (start < 0) return [];
  let i = rwSrc.indexOf('[', start);
  let depth = 0;
  let end = -1;
  for (let j = i; j < rwSrc.length; j++) {
    const c = rwSrc[j];
    if (c === '[') depth++;
    else if (c === ']') {
      depth--;
      if (depth === 0) {
        end = j;
        break;
      }
    }
  }
  if (end < 0) return [];
  const jsonish = rwSrc.slice(i, end + 1);
  try {
    return JSON.parse(jsonish);
  } catch (e) {
    console.error('parse fail', key, e.message);
    return [];
  }
}

function setOnlyCorrect(task, correctId) {
  for (const o of task.options || []) o.correct = o.id === correctId;
}
function expandToThreeMc(task, prefix, n) {
  const qk = `data.tasks.${prefix}_q${n}`;
  task.type = 'multiple_choice';
  task.questionKey = qk;
  delete task.answer;
  task.options = ['a', 'b', 'c'].map((id) => ({
    id,
    textKey: `${qk}_${id}`,
    correct: false,
  }));
}
function shrinkToTwoMc(task, prefix, n) {
  const qk = `data.tasks.${prefix}_q${n}`;
  task.type = 'multiple_choice';
  task.questionKey = qk;
  delete task.answer;
  task.options = ['a', 'b'].map((id) => ({
    id,
    textKey: `${qk}_${id}`,
    correct: false,
  }));
}
function replaceWithMc3(task, prefix, n, difficulty, correctId) {
  const qk = `data.tasks.${prefix}_q${n}`;
  Object.assign(task, {
    id: `${prefix}_t${n}`,
    type: 'multiple_choice',
    questionKey: qk,
    difficulty,
    options: ['a', 'b', 'c'].map((id) => ({
      id,
      textKey: `${qk}_${id}`,
      correct: id === correctId,
    })),
  });
  delete task.answer;
}

function bridgeMcTasks(source, prefix) {
  return JSON.parse(JSON.stringify(source)).map((task, i) => {
    const qi = i + 1;
    task.id = `${prefix}_t${qi}`;
    if (task.type === 'multiple_choice' && task.options) {
      task.questionKey = `data.tasks.${prefix}_q${qi}`;
      for (const o of task.options) o.textKey = `data.tasks.${prefix}_q${qi}_${o.id}`;
    } else if (task.type === 'input') {
      task.questionKey = `data.tasks.${prefix}_q${qi}`;
    }
    return task;
  });
}

const PATCH = {
  patchG1mC20L1: (t) => {
    const p = 'g1m_c20l1';
    setOnlyCorrect(t[0], 'b');
    expandToThreeMc(t[1], p, 2);
    setOnlyCorrect(t[1], 'b');
    setOnlyCorrect(t[2], 'b');
    setOnlyCorrect(t[3], 'a');
    setOnlyCorrect(t[4], 'b');
    return t;
  },
  patchG1mC20L2: (t) => {
    setOnlyCorrect(t[2], 'b');
    setOnlyCorrect(t[3], 'b');
    setOnlyCorrect(t[4], 'b');
    return t;
  },
  patchG1mC20L3: (t) => {
    const p = 'g1m_c20l3';
    setOnlyCorrect(t[0], 'b');
    setOnlyCorrect(t[1], 'a');
    shrinkToTwoMc(t[2], p, 3);
    setOnlyCorrect(t[2], 'b');
    return t;
  },
  patchG1mAddL1: (t) => {
    const p = 'g1m_addl1';
    setOnlyCorrect(t[0], 'b');
    expandToThreeMc(t[1], p, 2);
    setOnlyCorrect(t[1], 'b');
    setOnlyCorrect(t[3], 'b');
    setOnlyCorrect(t[4], 'b');
    return t;
  },
  patchG1mAddL2: (t) => {
    const p = 'g1m_addl2';
    setOnlyCorrect(t[0], 'b');
    expandToThreeMc(t[1], p, 2);
    setOnlyCorrect(t[1], 'b');
    replaceWithMc3(t[3], p, 4, 2, 'b');
    setOnlyCorrect(t[4], 'a');
    return t;
  },
  patchG1mAddL3: (t) => {
    const p = 'g1m_addl3';
    setOnlyCorrect(t[0], 'b');
    expandToThreeMc(t[1], p, 2);
    setOnlyCorrect(t[1], 'b');
    setOnlyCorrect(t[2], 'b');
    setOnlyCorrect(t[3], 'b');
    setOnlyCorrect(t[4], 'b');
    return t;
  },
  patchG1mSubL1: (t) => {
    setOnlyCorrect(t[0], 'b');
    setOnlyCorrect(t[3], 'b');
    setOnlyCorrect(t[4], 'b');
    return t;
  },
  patchG1mSubL2: (t) => {
    setOnlyCorrect(t[3], 'b');
    setOnlyCorrect(t[4], 'b');
    return t;
  },
  patchG1mSubL3: (t) => {
    const p = 'g1m_subl3';
    shrinkToTwoMc(t[2], p, 3);
    setOnlyCorrect(t[2], 'a');
    setOnlyCorrect(t[3], 'b');
    setOnlyCorrect(t[4], 'b');
    return t;
  },
  patchG1rVowL1: (t) => {
    const p = 'g1r_vowl1';
    shrinkToTwoMc(t[0], p, 1);
    setOnlyCorrect(t[0], 'b');
    setOnlyCorrect(t[1], 'b');
    setOnlyCorrect(t[2], 'b');
    shrinkToTwoMc(t[3], p, 4);
    setOnlyCorrect(t[3], 'b');
    setOnlyCorrect(t[4], 'a');
    return t;
  },
  patchG1rVowL2: (t) => {
    const p = 'g1r_vowl2';
    setOnlyCorrect(t[0], 'b');
    setOnlyCorrect(t[1], 'b');
    setOnlyCorrect(t[2], 'b');
    replaceWithMc3(t[3], p, 4, 2, 'b');
    setOnlyCorrect(t[4], 'a');
    return t;
  },
  patchG1rVowL3: (t) => {
    const p = 'g1r_vowl3';
    shrinkToTwoMc(t[0], p, 1);
    setOnlyCorrect(t[0], 'b');
    expandToThreeMc(t[1], p, 2);
    setOnlyCorrect(t[1], 'b');
    shrinkToTwoMc(t[2], p, 3);
    setOnlyCorrect(t[2], 'b');
    setOnlyCorrect(t[3], 'b');
    setOnlyCorrect(t[4], 'a');
    return t;
  },
  patchG1rWrdL1: (t) => {
    const p = 'g1r_wrdl1';
    shrinkToTwoMc(t[0], p, 1);
    setOnlyCorrect(t[0], 'b');
    setOnlyCorrect(t[1], 'b');
    expandToThreeMc(t[2], p, 3);
    setOnlyCorrect(t[2], 'a');
    shrinkToTwoMc(t[3], p, 4);
    setOnlyCorrect(t[3], 'b');
    setOnlyCorrect(t[4], 'a');
    return t;
  },
  patchG1rWrdL2: (t) => {
    const p = 'g1r_wrdl2';
    shrinkToTwoMc(t[0], p, 1);
    setOnlyCorrect(t[0], 'b');
    setOnlyCorrect(t[1], 'b');
    setOnlyCorrect(t[2], 'b');
    expandToThreeMc(t[3], p, 4);
    setOnlyCorrect(t[3], 'b');
    setOnlyCorrect(t[4], 'b');
    return t;
  },
  patchG1rWrdL3: (t) => {
    const p = 'g1r_wrdl3';
    shrinkToTwoMc(t[0], p, 1);
    setOnlyCorrect(t[0], 'b');
    shrinkToTwoMc(t[1], p, 2);
    setOnlyCorrect(t[1], 'b');
    setOnlyCorrect(t[2], 'b');
    shrinkToTwoMc(t[3], p, 4);
    setOnlyCorrect(t[3], 'b');
    return t;
  },
  patchG1rGrmL1: (t) => {
    const p = 'g1r_grml1';
    shrinkToTwoMc(t[0], p, 1);
    setOnlyCorrect(t[0], 'b');
    expandToThreeMc(t[1], p, 2);
    setOnlyCorrect(t[1], 'b');
    shrinkToTwoMc(t[2], p, 3);
    setOnlyCorrect(t[2], 'b');
    shrinkToTwoMc(t[3], p, 4);
    setOnlyCorrect(t[3], 'b');
    setOnlyCorrect(t[4], 'a');
    return t;
  },
  patchG1rGrmL2: (t) => {
    const p = 'g1r_grml2';
    shrinkToTwoMc(t[0], p, 1);
    setOnlyCorrect(t[0], 'b');
    setOnlyCorrect(t[1], 'b');
    setOnlyCorrect(t[2], 'c');
    expandToThreeMc(t[3], p, 4);
    setOnlyCorrect(t[3], 'b');
    setOnlyCorrect(t[4], 'a');
    return t;
  },
  patchG1rGrmL3: (t) => {
    const p = 'g1r_grml3';
    shrinkToTwoMc(t[0], p, 1);
    setOnlyCorrect(t[0], 'b');
    shrinkToTwoMc(t[1], p, 2);
    setOnlyCorrect(t[1], 'b');
    setOnlyCorrect(t[2], 'b');
    shrinkToTwoMc(t[3], p, 4);
    setOnlyCorrect(t[3], 'b');
    return t;
  },
  patchG1wSchL1: (t) => {
    const p = 'g1w_schl1';
    shrinkToTwoMc(t[0], p, 1);
    setOnlyCorrect(t[0], 'b');
    setOnlyCorrect(t[1], 'b');
    expandToThreeMc(t[2], p, 3);
    setOnlyCorrect(t[2], 'b');
    setOnlyCorrect(t[3], 'b');
    setOnlyCorrect(t[4], 'a');
    return t;
  },
  patchG1wSchL2: (t) => {
    const p = 'g1w_schl2';
    shrinkToTwoMc(t[0], p, 1);
    setOnlyCorrect(t[0], 'b');
    setOnlyCorrect(t[1], 'b');
    expandToThreeMc(t[2], p, 3);
    setOnlyCorrect(t[2], 'a');
    setOnlyCorrect(t[3], 'b');
    setOnlyCorrect(t[4], 'a');
    return t;
  },
};

function resolveExport(constName) {
  for (const src of [g1mSrc, g1rSrc]) {
    const m = src.match(
      new RegExp(
        `export const ${constName} = (\\w+)\\(\\s*bridgeMcTasks\\(RW56_LESSON_TASKS\\['([^']+)'\\][\\s\\S]*?,\\s*'([^']+)'\\)\\s*,?\\s*\\);`,
      ),
    );
    if (m) {
      const [, patchName, rwKey, prefix] = m;
      let tasks = bridgeMcTasks(parseRw56Json(rwKey), prefix);
      if (PATCH[patchName]) tasks = PATCH[patchName](tasks);
      return { source: `${constName}←${rwKey}`, tasks };
    }
  }
  // rewritten array
  for (const src of [g1wSrc]) {
    const m = src.match(new RegExp(`export const ${constName}: LessonTask\\[] = \\[([\\s\\S]*?)\\];`));
    if (m) {
      const tasks = [];
      const taskRe =
        /\{\s*id:\s*'([^']+)',\s*type:\s*'([^']+)',(?:\s*audience:\s*'([^']+)',)?\s*questionKey:\s*'([^']+)',\s*difficulty:\s*(\d+),(?:\s*answer:\s*"([^"]*)",)?(?:\s*options:\s*\[([\s\S]*?)\n\s*\])?/g;
      let tm;
      while ((tm = taskRe.exec(m[1]))) {
        const options = [];
        if (tm[7]) {
          for (const om of tm[7].matchAll(/textKey:\s*'([^']+)',\s*correct:\s*(true|false)/g)) {
            options.push({ id: '?', textKey: om[1], correct: om[2] === 'true' });
          }
        }
        tasks.push({
          id: tm[1],
          type: tm[2],
          audience: tm[3],
          questionKey: tm[4],
          answer: tm[6],
          options,
        });
      }
      return { source: constName, tasks };
    }
  }
  return null;
}

function resolveTexts(tasks) {
  return (tasks || []).map((task) => ({
    id: task.id,
    type: task.type,
    audience: task.audience || null,
    q: tr(task.questionKey),
    qKey: task.questionKey,
    answer: task.answer ?? null,
    options: (task.options || []).map((o) => ({
      id: o.id,
      text: tr(o.textKey),
      key: o.textKey,
      correct: !!o.correct,
    })),
  }));
}

function lessonBlock(id) {
  // Include through next lesson start / topic end, so tasks: [ ... ] stays balanced.
  const startRe = new RegExp(`\\{ id: '${id}', topicId:`);
  const start = worlds.search(startRe);
  if (start < 0) return null;
  const rest = worlds.slice(start + 1);
  const nextLesson = rest.search(/\n\s*\{ id: '[a-z0-9-]+', topicId:/);
  const topicEnd = rest.search(/\n\s*\] \},\s*\n\s*\{ id: '/); // end of lessons array item cluster — fallback
  let endRel = rest.length;
  if (nextLesson >= 0) endRel = Math.min(endRel, nextLesson);
  // If last lesson in topic, stop before `] },` that closes lessons array (preceded by lesson close)
  // Find the closing of this lesson object by brace depth from start.
  let depth = 0;
  let end = start;
  for (let j = start; j < worlds.length; j++) {
    const c = worlds[j];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        end = j + 1;
        break;
      }
    }
  }
  return worlds.slice(start, end);
}

function extractBracketArray(block, marker) {
  const start = block.indexOf(marker);
  if (start < 0) return null;
  const i = block.indexOf('[', start);
  if (i < 0) return null;
  let depth = 0;
  for (let j = i; j < block.length; j++) {
    if (block[j] === '[') depth++;
    else if (block[j] === ']') {
      depth--;
      if (depth === 0) return block.slice(i + 1, j);
    }
  }
  return null;
}

function parseInline(block) {
  const body = extractBracketArray(block, 'tasks:');
  if (!body) return null;
  if (/G1[MRW]_|RW56_/.test(body) && !/type:\s*'/.test(body)) return null;
  if (!/type:\s*'/.test(body)) return null;
  const tasks = [];
  for (const line of body.split('\n')) {
    const idm = line.match(/id:\s*'([^']+)',\s*type:\s*'([^']+)'/);
    if (!idm) continue;
    const aud = line.match(/audience:\s*'([^']+)'/);
    const qm = line.match(/questionKey:\s*'([^']+)'/);
    const ans = line.match(/answer:\s*"([^"]*)"/);
    const options = [];
    for (const om of line.matchAll(/\{\s*id:\s*'([^']+)',\s*textKey:\s*'([^']+)',\s*correct:\s*(true|false)/g)) {
      options.push({ id: om[1], textKey: om[2], correct: om[3] === 'true' });
    }
    tasks.push({
      id: idm[1],
      type: idm[2],
      audience: aud?.[1],
      questionKey: qm?.[1],
      answer: ans?.[1],
      options,
    });
  }
  return tasks.length ? tasks : null;
}

function curriculumSlice(id) {
  const idx = curriculum.indexOf('`' + id + '`');
  if (idx < 0) return null;
  const next = curriculum.indexOf('\n`g1', idx + 5);
  const end = next > 0 ? next : Math.min(curriculum.length, idx + 2500);
  return curriculum.slice(idx, end);
}

function enkyFlagsForTasks(tasks) {
  const flags = [];
  for (const task of tasks) {
    if (!task.qKey) continue;
    const ruV = t(ru, task.qKey);
    const enV = t(en, task.qKey);
    const kyV = t(ky, task.qKey);
    if (enV == null) flags.push(`en missing: ${task.qKey}`);
    else if (ruV && enV === ruV && /[А-Яа-яЁё]/.test(enV)) flags.push(`en=ru Cyrillic: ${task.qKey}`);
    if (kyV == null) flags.push(`ky missing: ${task.qKey}`);
    else if (ruV && kyV === ruV) flags.push(`ky=ru stub: ${task.qKey}`);
    for (const o of task.options || []) {
      if (!o.key) continue;
      const r = t(ru, o.key);
      const e = t(en, o.key);
      const k = t(ky, o.key);
      if (e == null) flags.push(`en missing: ${o.key}`);
      else if (r && e === r && /[А-Яа-яЁё]/.test(e)) flags.push(`en=ru Cyrillic: ${o.key}`);
      if (k == null) flags.push(`ky missing: ${o.key}`);
      else if (r && k === r) flags.push(`ky=ru stub: ${o.key}`);
    }
  }
  return [...new Set(flags)];
}

const out = [];
for (const meta of IDS) {
  const block = lessonBlock(meta.id);
  if (!block) {
    out.push({ id: meta.id, error: 'missing block' });
    continue;
  }
  const dialog = [...block.matchAll(/speaker: '(\w+)', textKey: '([^']+)'/g)].map((x) => ({
    speaker: x[1],
    text: tr(x[2]),
  }));
  const intro = [...block.matchAll(/titleKey: '([^']+)', bodyKey: '([^']+)'/g)].map((x) => ({
    title: tr(x[1]),
    body: tr(x[2]),
  }));

  let source = 'inline';
  let rawTasks = parseInline(block);
  if (!rawTasks) {
    const rwM = block.match(/tasks:\s*RW56_LESSON_TASKS\['([^']+)'\]/);
    const cM = block.match(/tasks:\s*([A-Z0-9_]+)/);
    if (rwM) {
      rawTasks = parseRw56Json(rwM[1]);
      source = `RW56:${rwM[1]}`;
    } else if (cM) {
      const resolved = resolveExport(cM[1]);
      rawTasks = resolved?.tasks || [];
      source = resolved?.source || cM[1];
    }
  }

  const tasks = resolveTexts(rawTasks);
  const types = [...new Set(tasks.map((x) => x.type))];
  const missing = [];
  for (const task of tasks) {
    if (String(task.q).startsWith('<MISSING')) missing.push(task.qKey);
    for (const o of task.options) if (String(o.text).startsWith('<MISSING')) missing.push(o.key);
  }

  out.push({
    id: meta.id,
    title: meta.title,
    subject: meta.subject,
    world: meta.world,
    source,
    dialog,
    intro,
    types,
    taskCount: tasks.length,
    missing,
    enkyFlags: enkyFlagsForTasks(tasks),
    curriculum: curriculumSlice(meta.id)?.slice(0, 1800) || null,
    tasks,
  });
}

fs.writeFileSync(path.join(__dirname, '_audit_g1_live.json'), JSON.stringify(out, null, 2), 'utf8');

// compact readable dump
let txt = '';
for (const L of out) {
  txt += `\n======== ${L.id} | ${L.title} | ${L.source} | n=${L.taskCount} types=${L.types.join(',')}\n`;
  for (const d of L.dialog || []) txt += `  [${d.speaker}] ${d.text}\n`;
  for (const i of L.intro || []) txt += `  [intro] ${i.title} :: ${String(i.body).slice(0, 160)}\n`;
  for (const task of L.tasks || []) {
    const aud = task.audience ? ` [${task.audience}]` : '';
    txt += `  ${task.id} <${task.type}>${aud} Q: ${task.q}\n`;
    for (const o of task.options || []) {
      txt += `      ${o.id}${o.correct ? ' [✓]' : '    '} ${o.text}\n`;
    }
    if (task.answer != null) txt += `      answer: ${task.answer}\n`;
  }
  if (L.missing?.length) txt += `  MISSING KEYS: ${L.missing.join(', ')}\n`;
  if (L.enkyFlags?.length) txt += `  ENKY (${L.enkyFlags.length}): ${L.enkyFlags.slice(0, 8).join(' | ')}\n`;
}
fs.writeFileSync(path.join(__dirname, '_audit_g1_live.txt'), txt, 'utf8');
console.log('lessons', out.length);
for (const L of out) {
  console.log(
    L.id,
    L.source,
    'n=' + L.taskCount,
    L.types.join('+'),
    L.missing.length ? 'MISS=' + L.missing.length : 'ok',
    'enky=' + L.enkyFlags.length,
  );
}
