/**
 * Wave9 verify helpers: live answer checks + EN/KY scan for g4+legacy.
 * Prints JSON report to stdout; does not write final audit.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8'));
const ky = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ky.json'), 'utf8'));
const worldsSrc = fs.readFileSync(path.join(root, 'src/data/worlds.ts'), 'utf8');
const md = fs.readFileSync(path.join(root, 'curricula/grade-4-curriculum-ru.md'), 'utf8');
const g4Ids = JSON.parse(fs.readFileSync(path.join(root, 'scripts/_reaudit2_ids_g4.json'), 'utf8'));
const legIds = JSON.parse(fs.readFileSync(path.join(root, 'scripts/_reaudit2_ids_glegacy.json'), 'utf8'));

function get(obj, dotted) {
  let cur = obj;
  for (const p of dotted.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

function extractLessonBlock(id) {
  const re = new RegExp(`id:\\s*'${id}'[\\s\\S]{0,80}?topicId:`);
  const m = re.exec(worldsSrc);
  if (!m) return null;
  let start = m.index;
  while (start > 0 && worldsSrc[start] !== '{') start--;
  let depth = 0;
  let end = start;
  for (let j = start; j < worldsSrc.length; j++) {
    if (worldsSrc[j] === '{') depth++;
    else if (worldsSrc[j] === '}') {
      depth--;
      if (depth === 0) {
        end = j + 1;
        break;
      }
    }
  }
  return worldsSrc.slice(start, end);
}

function parseTasks(id) {
  const block = extractLessonBlock(id);
  if (!block) return { error: 'not_found', tasks: [], dialogKeys: [], introKeys: [] };
  const dialogKeys = [...block.matchAll(/textKey:\s*'([^']+)'/g)].map((x) => x[1]);
  const introKeys = [
    ...block.matchAll(/titleKey:\s*'([^']+)'/g),
    ...block.matchAll(/bodyKey:\s*'([^']+)'/g),
  ].map((x) => x[1]);
  const tasks = [];
  // line-oriented: each task starts with id: 'xxx', type:
  const lines = block.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const tm = lines[i].match(/id:\s*'([^']+)'\s*,\s*type:\s*'(\w+)'/);
    if (!tm || tm[1] === id) continue;
    // gather until next task or end of tasks array-ish
    let body = lines[i];
    let j = i + 1;
    while (j < lines.length) {
      if (/id:\s*'[^']+'\s*,\s*type:\s*'/.test(lines[j])) break;
      if (/^\s*\]\s*,?\s*$/.test(lines[j]) && j > i + 1) {
        body += '\n' + lines[j];
        break;
      }
      body += '\n' + lines[j];
      j++;
    }
    const audience = /audience:\s*'special_aba'/.test(body) ? 'special_aba' : 'main';
    const qKey = (body.match(/questionKey:\s*'([^']+)'/) || [])[1];
    const answerRaw =
      (body.match(/answer:\s*"([^"]*)"/) || [])[1] ?? (body.match(/answer:\s*'([^']*)'/) || [])[1];
    const cak = (body.match(/correctAnswerKey:\s*'([^']+)'/) || [])[1];
    const opts = [
      ...body.matchAll(/\{\s*id:\s*'([^']+)'\s*,\s*textKey:\s*'([^']+)'\s*,\s*correct:\s*(true|false)/g),
    ].map((om) => ({
      id: om[1],
      textKey: om[2],
      correct: om[3] === 'true',
      ru: get(ru, om[2]),
      en: get(en, om[2]),
      ky: get(ky, om[2]),
    }));
    tasks.push({
      id: tm[1],
      type: tm[2],
      audience,
      questionKey: qKey,
      qRu: qKey ? get(ru, qKey) : null,
      qEn: qKey ? get(en, qKey) : null,
      qKy: qKey ? get(ky, qKey) : null,
      answer: answerRaw ?? null,
      correctAnswerKey: cak || null,
      answerRu: cak ? get(ru, cak) : answerRaw,
      answerEn: cak ? get(en, cak) : null,
      answerKy: cak ? get(ky, cak) : null,
      options: opts,
    });
  }
  return { tasks, dialogKeys, introKeys, blockLen: block.length };
}

function stubFlags(id) {
  const k = id.replace(/-/g, '_');
  const flags = [];
  const pairs = [
    [`data.intro.${k}_0_b`, 'en_intro_body_stub', /We'll recap what matters/i],
    [`data.intro.${k}_0_t`, 'en_intro_title_stub', /^About this topic$/i],
    [`data.dialog.${k}_0`, 'en_dialog_stub', /Hi! Lesson:/i],
  ];
  for (const [key, flag, re] of pairs) {
    const v = get(en, key);
    if (typeof v === 'string' && re.test(v)) flags.push(flag);
  }
  // KY equals RU (cyrillic reuse)
  for (const suffix of [`dialog.${k}_0`, `intro.${k}_0_b`, `intro.${k}_0_t`]) {
    const r = get(ru, `data.${suffix}`);
    const y = get(ky, `data.${suffix}`);
    if (typeof r === 'string' && typeof y === 'string' && r === y && /[а-яё]/i.test(r)) {
      flags.push(`ky_eq_ru:${suffix}`);
    }
  }
  // KY generic stub patterns
  const kyIntro = get(ky, `data.intro.${k}_0_b`);
  if (typeof kyIntro === 'string' && /негизгисин кайталап|мисал көрөбүз/i.test(kyIntro)) {
    flags.push('ky_intro_generic_stub');
  }
  const enIntro = get(en, `data.intro.${k}_0_b`);
  if (typeof enIntro === 'string' && /We'll practice|Recap the idea/i.test(enIntro)) {
    flags.push('en_intro_thin');
  }
  return flags;
}

function parseNum(s) {
  const m = String(s)
    .replace(/\s/g, '')
    .replace(/—.*$/, '')
    .match(/-?\d+/);
  return m ? Number(m[0]) : NaN;
}

const issues = [];
function issue(id, ref, msg) {
  issues.push({ id, ref, issue: msg });
}

// --- Math arithmetic from live Q ---
for (const meta of g4Ids.filter((x) => x.world === 'g4math')) {
  const { tasks } = parseTasks(meta.id);
  for (const t of tasks.filter((x) => x.audience === 'main')) {
    const q = t.qRu || '';
    const correct = t.options.find((o) => o.correct);
    const mm = q.match(/(\d[\d\s]*)\s*[×xX]\s*(\d[\d\s]*)\s*=/);
    if (mm && correct) {
      const a = parseNum(mm[1]);
      const b = parseNum(mm[2]);
      const exp = a * b;
      const got = parseNum(correct.ru);
      if (!Number.isNaN(got) && got !== exp) {
        issue(meta.id, t.id, `${a}×${b}=${exp}, ✓=${got}`);
      }
    }
  }
}

// --- g4e-quest-l2 Why/bike alignment ---
{
  const id = 'g4e-quest-l2';
  const { tasks, dialogKeys, introKeys } = parseTasks(id);
  const t4 = tasks.find((x) => x.id.includes('t4')) || tasks.filter((x) => x.audience === 'main')[3];
  const report = {
    id,
    dialogRu: dialogKeys.map((k) => get(ru, k)),
    dialogEn: dialogKeys.map((k) => get(en, k)),
    dialogKy: dialogKeys.map((k) => get(ky, k)),
    introRu: introKeys.map((k) => get(ru, k)),
    introEn: introKeys.map((k) => get(en, k)),
    introKy: introKeys.map((k) => get(ky, k)),
    t4,
    mainTasks: tasks
      .filter((x) => x.audience === 'main')
      .map((t) => ({
        id: t.id,
        type: t.type,
        qRu: t.qRu,
        qEn: t.qEn,
        qKy: t.qKy,
        answer: t.answer,
        answerRu: t.answerRu,
        answerEn: t.answerEn,
        answerKy: t.answerKy,
        correctOpts: t.options.filter((o) => o.correct).map((o) => ({ ru: o.ru, en: o.en, ky: o.ky })),
      })),
    flags: stubFlags(id),
  };
  // Semantic checks
  if (t4) {
    const wantsWhy =
      /Why|почему|себеп|причина/i.test(`${t4.qRu} ${t4.qEn} ${t4.qKy}`) ||
      /bike|велосипед|велосипед/i.test(`${t4.qRu} ${t4.qEn} ${t4.qKy}`);
    const ansWhy = /Why/i.test(String(t4.answer || t4.answerRu || ''));
    if (!wantsWhy) issue(id, t4.id, 't4 should ask Why/bike reason');
    if (!ansWhy) issue(id, t4.id, `t4 answer should be Why, got ${t4.answer || t4.answerRu}`);
    // EN/KY must keep Why+bike framing
    if (t4.qEn && !/Why|bike|reason|why/i.test(t4.qEn)) {
      issue(id, t4.id + '/en', `EN t4 not aligned with Why/bike: ${t4.qEn}`);
    }
    if (t4.qKy && !/Why|себеп|велосипед|bike/i.test(t4.qKy)) {
      issue(id, t4.id + '/ky', `KY t4 not aligned with Why/bike: ${t4.qKy}`);
    }
  }
  fs.writeFileSync(path.join(root, 'scripts/_audit_g4_quest_l2_live.json'), JSON.stringify(report, null, 2), 'utf8');
}

// --- Broad EN/KY stub scan all 51 ---
const enkyScan = [];
for (const meta of [...g4Ids, ...legIds]) {
  const flags = stubFlags(meta.id);
  const { tasks } = parseTasks(meta.id);
  const main = tasks.filter((x) => x.audience === 'main');
  // missing translations
  for (const t of main) {
    if (t.questionKey) {
      if (t.qEn == null || /MISSING|We'll recap/i.test(String(t.qEn))) flags.push(`en_missing_q:${t.id}`);
      if (t.qKy == null) flags.push(`ky_missing_q:${t.id}`);
    }
    for (const o of t.options) {
      if (o.en == null) flags.push(`en_missing_opt:${o.textKey}`);
      if (o.ky == null) flags.push(`ky_missing_opt:${o.textKey}`);
    }
  }
  // long prompts
  const long = main.filter((t) => (t.qRu || '').length > 220);
  const types = [...new Set(main.map((t) => t.type))];
  const hasProductive = main.some((t) => t.type === 'input' || t.type === 'fill_blank');
  enkyScan.push({
    id: meta.id,
    title: meta.title,
    world: meta.world,
    taskCount: main.length,
    types,
    hasProductive,
    longPromptCount: long.length,
    longIds: long.map((t) => t.id),
    flags: [...new Set(flags)],
    answers: main
      .filter((t) => t.type === 'input' || t.type === 'fill_blank')
      .map((t) => ({ id: t.id, answer: t.answer, answerRu: t.answerRu, q: String(t.qRu || '').slice(0, 120) })),
  });
}

// Curriculum MD vs live for known wrong-answer patterns (sanity)
const mdChecks = [];
for (const id of ['g4m-fr-l1', 'g4m-fr-l2', 'g4m-fr-l3', 'g4m-cm-l2', 'g4e-quest-l2', 'g4s-help-l2', 'g4s-emo-l2']) {
  const { tasks } = parseTasks(id);
  mdChecks.push({
    id,
    tasks: tasks
      .filter((t) => t.audience === 'main')
      .map((t) => ({
        id: t.id,
        type: t.type,
        q: String(t.qRu || '').slice(0, 160),
        correct: t.options.filter((o) => o.correct).map((o) => o.ru),
        answer: t.answer || t.answerRu,
      })),
  });
}

const out = {
  g4Count: g4Ids.length,
  legacyCount: legIds.length,
  total: g4Ids.length + legIds.length,
  factIssues: issues,
  enkyScan,
  mdChecks,
  mdHasQuestL2: md.includes('g4e-quest-l2') && /by bike|велосипед|Why/i.test(md),
};

fs.writeFileSync(path.join(root, 'scripts/_audit_g4_wave9_verify.json'), JSON.stringify(out, null, 2), 'utf8');
console.log(
  JSON.stringify(
    {
      total: out.total,
      factIssues: issues.length,
      flaggedLessons: enkyScan.filter((x) => x.flags.length).map((x) => ({ id: x.id, flags: x.flags })),
      noProductive: enkyScan.filter((x) => !x.hasProductive && x.id !== 'jungle-aba-showcase').map((x) => x.id),
      longPrompts: enkyScan.filter((x) => x.longPromptCount).map((x) => ({ id: x.id, n: x.longPromptCount })),
    },
    null,
    2
  )
);
