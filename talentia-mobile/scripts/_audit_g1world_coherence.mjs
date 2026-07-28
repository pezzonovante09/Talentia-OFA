/**
 * Dedicated coherence audit for 9 g1world lessons (dialog → intro → tasks).
 * Scores are assigned by explicit rubric checks in this script + manual notes.
 *
 * Rubric (same as original curriculum audit):
 * 5 = dialog, intro, tasks share one topic/terms; tasks train announced skill
 * 4 = minor skew (e.g. intro card order) but tasks still train the lesson topic
 * 3 = partial mismatch (one block off-topic)
 * 1–2 = tasks train a different lesson than dialog/intro
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const require = createRequire(import.meta.url);

// Load compiled-ish via ts-node? Use dynamic import of worlds after reading JSON locales + task banks as text.
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));
const g1 = fs.readFileSync(path.join(root, 'src/data/g1worldRewrittenTasks.ts'), 'utf8');
const worlds = fs.readFileSync(path.join(root, 'src/data/worlds.ts'), 'utf8');
const rw56 = JSON.parse(
  // rw56 is TS with JSON-like objects — use require via a small eval of known bank keys from dump
  'null',
);

function t(key) {
  const parts = key.split('.');
  let cur = ru;
  for (const p of parts) cur = cur?.[p];
  return typeof cur === 'string' ? cur : `<MISSING:${key}>`;
}

function parseExportTasks(name) {
  const re = new RegExp(`export const ${name}: LessonTask\\[] = \\[([\\s\\S]*?)\\];`);
  const m = g1.match(re);
  if (!m) return [];
  const body = m[1];
  const tasks = [];
  const taskRe =
    /\{\s*id:\s*'([^']+)',\s*type:\s*'([^']+)',(?:\s*audience:\s*'([^']+)',)?\s*questionKey:\s*'([^']+)',\s*difficulty:\s*(\d+),(?:\s*answer:\s*"([^"]*)",)?(?:\s*options:\s*\[([\s\S]*?)\n\s*\])?/g;
  let tm;
  while ((tm = taskRe.exec(body))) {
    const opts = [];
    if (tm[7]) {
      for (const om of tm[7].matchAll(/textKey:\s*'([^']+)',\s*correct:\s*(true|false)/g)) {
        opts.push({ textKey: om[1], text: t(om[1]), correct: om[2] === 'true' });
      }
    }
    tasks.push({
      id: tm[1],
      type: tm[2],
      audience: tm[3],
      questionKey: tm[4],
      question: t(tm[4]),
      answer: tm[6],
      options: opts,
    });
  }
  return tasks;
}

function lessonMeta(id) {
  const re = new RegExp(
    `\\{\\s*id:\\s*'${id}',[\\s\\S]*?tasks:\\s*([^,}]+)[,\\s]*\\}`,
  );
  const m = worlds.match(re);
  if (!m) return null;
  const block = m[0];
  const titleKey = block.match(/titleKey:\s*'([^']+)'/)?.[1];
  const dialog = [...block.matchAll(/speaker:\s*'(\w+)',\s*textKey:\s*'([^']+)'/g)].map((x) => ({
    speaker: x[1],
    text: t(x[2]),
  }));
  const intro = [...block.matchAll(/titleKey:\s*'([^']+)',\s*bodyKey:\s*'([^']+)'/g)].map((x) => ({
    title: t(x[1]),
    body: t(x[2]),
  }));
  const tasksRef = m[1].trim();
  return { titleKey, title: titleKey ? t(titleKey) : id, dialog, intro, tasksRef };
}

// garden-anim-l2 tasks from rw56LessonTasks — parse JSON-ish block
function parseRw56(key) {
  const src = fs.readFileSync(path.join(root, 'src/data/rw56LessonTasks.ts'), 'utf8');
  const start = src.indexOf(`'${key}':`);
  if (start < 0) return [];
  const arrStart = src.indexOf('[', start);
  let depth = 0;
  let i = arrStart;
  for (; i < src.length; i++) {
    if (src[i] === '[') depth++;
    else if (src[i] === ']') {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
  }
  const chunk = src.slice(arrStart, i);
  // extract questionKey / correct options roughly
  const tasks = [];
  for (const tm of chunk.matchAll(/"id":\s*"([^"]+)"[\s\S]*?"type":\s*"([^"]+)"[\s\S]*?"questionKey":\s*"([^"]+)"/g)) {
    const id = tm[1];
    const type = tm[2];
    const qk = tm[3];
    const segStart = tm.index;
    const next = chunk.slice(segStart + 1).search(/\n  \{\n    "id":/);
    const seg = next < 0 ? chunk.slice(segStart) : chunk.slice(segStart, segStart + 1 + next);
    const opts = [];
    for (const om of seg.matchAll(/"textKey":\s*"([^"]+)",\s*"correct":\s*(true|false)/g)) {
      opts.push({ textKey: om[1], text: t(om[1]), correct: om[2] === 'true' });
    }
    const ans = seg.match(/"answer":\s*"([^"]*)"/)?.[1];
    tasks.push({ id, type, questionKey: qk, question: t(qk), options: opts, answer: ans });
  }
  return tasks;
}

const PLAN = {
  'g1w-sch-l1': {
    plan: 'Не в объёме переписывания Фазы 4 (только полировка). Диалог/интро/задания по школьным принадлежностям — оставить.',
    rewrite: 'none',
  },
  'g1w-sch-l2': {
    plan: 'Не в объёме переписывания Фазы 4. Тема «Класс и уроки» — оставить.',
    rewrite: 'none',
  },
  'g1w-sch-l3': {
    plan: 'Переписать ВСЁ: диалог + интро + задания (вместо garden-col-l3).',
    rewrite: 'all',
  },
  'g1w-nat-l1': {
    plan: 'Переписать ВСЁ: диалог + интро + задания про деревья (вместо garden-anim-l1).',
    rewrite: 'all',
  },
  'g1w-nat-l2': {
    plan: 'Оставить задания (дикие животные); переписать диалог + интро-2 с погоды на животных.',
    rewrite: 'dialog_intro',
  },
  'g1w-nat-l3': {
    plan: 'Переписать диалог + задания про погоду; интро сезонов частично; береги природу — финал.',
    rewrite: 'all',
  },
  'g1w-bdy-l1': {
    plan: 'Оставить диалог; переписать интро-2 (вкус) + задания + ABA.',
    rewrite: 'intro2_tasks',
  },
  'g1w-bdy-l2': {
    plan: 'Оставить диалог; переписать задания (+ скелет из intro-1) + ABA.',
    rewrite: 'tasks',
  },
  'g1w-bdy-l3': {
    plan: 'Оставить диалог/интро; переписать задания + ABA.',
    rewrite: 'tasks',
  },
};

const EXPORT_MAP = {
  'g1w-sch-l3': 'G1W_SCH_L3_TASKS',
  'g1w-nat-l1': 'G1W_NAT_L1_TASKS',
  'g1w-nat-l3': 'G1W_NAT_L3_TASKS',
  'g1w-bdy-l1': 'G1W_BDY_L1_TASKS',
  'g1w-bdy-l2': 'G1W_BDY_L2_TASKS',
  'g1w-bdy-l3': 'G1W_BDY_L3_TASKS',
};

function topicTokens(text) {
  return (text || '').toLowerCase();
}

function scoreLesson(id, meta, tasks) {
  const dialogTxt = meta.dialog.map((d) => d.text).join(' ');
  const introTxt = meta.intro.map((i) => `${i.title} ${i.body}`).join(' ');
  const taskTxt = tasks
    .map((tk) => [tk.question, ...tk.options.map((o) => o.text), tk.answer].filter(Boolean).join(' '))
    .join(' ');
  const all = `${dialogTxt} ${introTxt} ${taskTxt}`;

  const checks = {
    sch_l3: /физкультур|рисован|мяч|кисть|прыга/i,
    nat_l1: /дерев|дуб|берёз|ель|ствол|лист|хвойн/i,
    nat_l2: /животн|домашн|дик|медвед|лев|лиса|коров/i,
    nat_l3: /погод|дожд|снег|солнц|зонт|куртк|мусор|природ/i,
    bdy_l1: /глаз|уш|нос|язык|вкус|чувств/i,
    bdy_l2: /здоров|зарядк|спорт|фрукт|сон|скелет|кост/i,
    bdy_l3: /безопас|незнаком|зелён|дорог|полиц/i,
    sch_l1: /принадлеж|ручк|тетрад|учебник|пенал|портфел/i,
    sch_l2: /урок|математик|физкультур|рисован|класс/i,
  };

  const map = {
    'g1w-sch-l1': checks.sch_l1,
    'g1w-sch-l2': checks.sch_l2,
    'g1w-sch-l3': checks.sch_l3,
    'g1w-nat-l1': checks.nat_l1,
    'g1w-nat-l2': checks.nat_l2,
    'g1w-nat-l3': checks.nat_l3,
    'g1w-bdy-l1': checks.bdy_l1,
    'g1w-bdy-l2': checks.bdy_l2,
    'g1w-bdy-l3': checks.bdy_l3,
  };
  const re = map[id];
  const dOk = re.test(dialogTxt);
  const iOk = re.test(introTxt);
  const tOk = re.test(taskTxt) && tasks.length >= 3;

  // garden leftovers in rewritten lessons
  const gardenLeak =
    /полярн|пингвин|капель.*весна|снеговик|купаться летом|корова даёт молоко/i.test(taskTxt) &&
    !id.includes('nat-l2');

  let score = 5;
  let notes = [];
  if (!dOk) {
    score = Math.min(score, 2);
    notes.push('Диалог не по теме урока');
  }
  if (!iOk) {
    score = Math.min(score, 3);
    notes.push('Интро слабо связано с темой');
  }
  if (!tOk) {
    score = Math.min(score, 2);
    notes.push('Задания не тренируют тему');
  }
  if (gardenLeak) {
    score = Math.min(score, 2);
    notes.push('В заданиях остатки garden-* контента');
  }

  // bdy-l2: intro-1 skeleton while dialog is sport — intentional per plan; t4 trains skeleton
  if (id === 'g1w-bdy-l2' && /скелет|мышц/i.test(meta.intro[0]?.title || '') && /спорт|питан/i.test(dialogTxt)) {
    score = Math.min(score, 4);
    notes.push('Intro-1 про скелет при диалоге про спорт/питание — допустимо: t4 тренирует скелет (план Фазы 4)');
  }

  if (id.startsWith('g1w-bdy') && !tasks.some((x) => x.audience === 'special_aba')) {
    score = Math.min(score, 3);
    notes.push('Нет special_aba задания');
  }

  if (!notes.length) notes.push('Диалог, интро и задания на одной теме; термины совпадают');

  // sch-l1/l2: load tasks from bridged exports if present
  return { score, accepted: score >= 4, notes: notes.join('; '), dOk, iOk, tOk, taskCount: tasks.length };
}

// G1W_SCH_L1/L2 may live in another file
const schBridged = fs.existsSync(path.join(root, 'src/data/g1worldBridgedTasks.ts'))
  ? fs.readFileSync(path.join(root, 'src/data/g1worldBridgedTasks.ts'), 'utf8')
  : '';

function parseNamedTasksFrom(src, name) {
  if (!src) return [];
  const re = new RegExp(`export const ${name}[^=]*=\\s*\\[([\\s\\S]*?)\\];`);
  const m = src.match(re);
  if (!m) return [];
  // reuse simple parser on temporary
  const tmp = `export const ${name}: LessonTask[] = [${m[1]}];`;
  const prev = g1;
  // inline mini parse
  const tasks = [];
  for (const tm of m[1].matchAll(/id:\s*'([^']+)'[\s\S]*?type:\s*'([^']+)'[\s\S]*?questionKey:\s*'([^']+)'/g)) {
    tasks.push({ id: tm[1], type: tm[2], questionKey: tm[3], question: t(tm[3]), options: [], answer: undefined });
  }
  return tasks;
}

const lessons = [];
for (const id of Object.keys(PLAN)) {
  const meta = lessonMeta(id);
  if (!meta) {
    lessons.push({ lessonId: id, error: 'not found', score: 0, accepted: false });
    continue;
  }
  let tasks = [];
  if (EXPORT_MAP[id]) tasks = parseExportTasks(EXPORT_MAP[id]);
  else if (id === 'g1w-nat-l2') tasks = parseRw56('garden-anim-l2');
  else if (id === 'g1w-sch-l1') {
    tasks = parseExportTasks('G1W_SCH_L1_TASKS');
    if (!tasks.length) {
      // try worlds import file g1worldBridged or similar
      const files = fs.readdirSync(path.join(root, 'src/data')).filter((f) => /g1w|world/i.test(f));
      for (const f of files) {
        const src = fs.readFileSync(path.join(root, 'src/data', f), 'utf8');
        if (src.includes('G1W_SCH_L1_TASKS')) {
          const m = src.match(/export const G1W_SCH_L1_TASKS[\s\S]*?= \[([\s\S]*?)\];/);
          if (m) {
            for (const tm of m[1].matchAll(/questionKey:\s*'([^']+)'/g)) {
              tasks.push({ id: 'x', type: 'multiple_choice', questionKey: tm[1], question: t(tm[1]), options: [] });
            }
          }
          break;
        }
      }
    }
  } else if (id === 'g1w-sch-l2') {
    const files = fs.readdirSync(path.join(root, 'src/data')).filter((f) => /g1w|world/i.test(f));
    for (const f of files) {
      const src = fs.readFileSync(path.join(root, 'src/data', f), 'utf8');
      if (src.includes('G1W_SCH_L2_TASKS')) {
        const m = src.match(/export const G1W_SCH_L2_TASKS[\s\S]*?= \[([\s\S]*?)\];/);
        if (m) {
          for (const tm of m[1].matchAll(/questionKey:\s*'([^']+)'/g)) {
            tasks.push({ id: 'x', type: 'multiple_choice', questionKey: tm[1], question: t(tm[1]), options: [] });
          }
        }
        break;
      }
    }
  }

  const scored = scoreLesson(id, meta, tasks);
  lessons.push({
    lessonId: id,
    title: meta.title,
    plan: PLAN[id].plan,
    rewrite: PLAN[id].rewrite,
    tasksRef: meta.tasksRef,
    dialog: meta.dialog,
    intro: meta.intro,
    tasks: tasks.map((tk) => ({
      id: tk.id,
      type: tk.type,
      audience: tk.audience,
      question: tk.question,
      correct: tk.options.filter((o) => o.correct).map((o) => o.text),
      answer: tk.answer,
    })),
    score: scored.score,
    accepted: scored.accepted,
    notes: scored.notes,
  });
}

const accepted = lessons.filter((l) => l.accepted).length;
const avg = lessons.reduce((s, l) => s + (l.score || 0), 0) / lessons.length;
const out = {
  meta: {
    generatedAt: new Date().toISOString(),
    rubric:
      '5=full topic lock dialog→intro→tasks; 4=minor skew; 3=one block off; 1–2=wrong topic. Accept ≥4. Scoring: keyword topic locks + garden-leak checks + ABA presence for bdy; human-readable notes.',
    lessonCount: lessons.length,
    accepted,
    rejected: lessons.length - accepted,
    averageScore: Number(avg.toFixed(2)),
  },
  lessons,
};

fs.writeFileSync(path.join(__dirname, '_audit_g1world_coherence.json'), JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out.meta, null, 2));
for (const l of lessons) {
  console.log(`${l.lessonId} score=${l.score} accepted=${l.accepted} rewrite=${l.rewrite} — ${l.notes}`);
}
