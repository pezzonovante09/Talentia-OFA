import fs from 'fs';

const ru = JSON.parse(fs.readFileSync('src/i18n/locales/ru.json', 'utf8'));
const en = JSON.parse(fs.readFileSync('src/i18n/locales/en.json', 'utf8'));
const ky = JSON.parse(fs.readFileSync('src/i18n/locales/ky.json', 'utf8'));
const worlds = fs.readFileSync('src/data/worlds.ts', 'utf8');

function flatten(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, flatten(v, p));
    else out[p] = v;
  }
  return out;
}
const fru = flatten(ru), fen = flatten(en), fky = flatten(ky);

const taskInfo = {};
for (const tb of worlds.matchAll(
  /\{ id: '([^']+)', type: '[^']+', questionKey: '([^']+)'[\s\S]*?options: \[([\s\S]*?)\]\s*\}/g,
)) {
  const opts = [...tb[3].matchAll(/\{ id: '([^']+)', textKey: '([^']+)', correct: (true|false) \}/g)].map(
    (x) => ({ id: x[1], textKey: x[2].replace(/^data\.tasks\./, ''), correct: x[3] === 'true' }),
  );
  taskInfo[tb[2].replace(/^data\.tasks\./, '')] = { taskId: tb[1], options: opts };
}

function row(short) {
  const full = `data.tasks.${short}`;
  const info = taskInfo[short];
  const opts = (info?.options || []).map((o) => {
    const ok = `data.tasks.${o.textKey}`;
    return {
      id: o.id,
      correct: o.correct,
      RU: fru[ok],
      EN: fen[ok],
      KY: fky[ok],
    };
  });
  return {
    key: short,
    taskId: info?.taskId,
    correct: info?.options?.filter((o) => o.correct).map((o) => o.id).join(',') || null,
    RU: fru[full],
    EN: fen[full],
    KY: fky[full],
    options: opts,
  };
}

const prefixes = [
  'g4m_md_',
  'g4m_md2_',
  'g4m_md3_',
  'g4r_conj_',
  'g4r_conj2_',
  'g4r_conj3_',
  'g4r_cases_',
  'g4r_cases2_',
  'g4r_cases3_',
  'g4r_text_',
  'g4r_text2_',
  'g4r_text3_',
  'g4s_emo_',
  'g4s_emo2_',
  'g4s_emo3_',
];

const out = {};
for (const pref of prefixes) {
  const keys = Object.keys(fru)
    .filter((k) => k.startsWith(`data.tasks.${pref}`) && /_q\d+$/.test(k.replace('data.tasks.', '')))
    .map((k) => k.replace('data.tasks.', ''))
    .sort();
  out[pref] = keys.map(row);
}

// Detect wrong-skill: EN looks like different skill family than RU
function classify(r, e) {
  if (!r || !e) return null;
  const enMathOps = /[×xX÷]|Solve:|Decisions:|Decide:.*\d/.test(e);
  const ruPlace = /тысяч|разря|прочитать|читается|сравн.*числ|больше|меньше/i.test(r);
  const enConj = /alliance|union|___|conjunction|поэтому|хотя|или/i.test(e);
  const ruVerb = /спряж|глагол|поём|чита|идти|любит|окончан|I спряж|II спряж/i.test(r);
  const enEmoGeneric = /Think it through:|empathy|positive emotion|self-control|Better mood/i.test(e);
  const ruEmoStory = /Тали|Friendly|эмоц|злост|страх|радост|груст|удивлен|спокой/i.test(r);
  const enCaseStub = /case|падеж|nominative|винительн/i.test(e) === false && /Think/.test(e);
  if (enMathOps && ruPlace) return 'EN_math_ops_vs_RU_place_value';
  if (enConj && ruVerb) return 'EN_conjunctions_vs_RU_verb_conjugation';
  if (enEmoGeneric && ruEmoStory) return 'EN_generic_emo_stub_vs_RU_scenario';
  return null;
}

const mismatches = [];
for (const [pref, rows] of Object.entries(out)) {
  for (const r of rows) {
    const kind = classify(r.RU, r.EN);
    const enCyrOpt = r.options.some((o) => /[А-Яа-яЁё]/.test(o.EN || ''));
    const kyCyrOpt = r.options.some((o) => /[А-Яа-яЁё]/.test(o.KY || '') && !/[әөүңҗ]/.test(o.KY || ''));
    // option meaning mismatch: EN option text != translation of RU (semantic) — flag if EN is numeric while RU is words, or different topic
    const optSkillBreak = r.options.some((o) => {
      const ruWordy = /[А-Яа-я]/.test(o.RU || '') && !/^\d+$/.test((o.RU || '').trim());
      const enNum = /^\d+$/.test((o.EN || '').trim());
      return ruWordy && enNum;
    });
    if (kind || optSkillBreak || (r.EN && r.RU && classify(r.RU, r.EN))) {
      mismatches.push({ ...r, kind: kind || (optSkillBreak ? 'EN_options_numeric_vs_RU_text' : 'other'), enCyrOpt, kyCyrOpt });
    } else if (r.EN !== r.RU && /Think it through|Think and choose|Choose an alliance|Ойлонуп/.test(r.EN + r.KY)) {
      mismatches.push({ ...r, kind: 'stub_prefix_likely_wrong_skill', enCyrOpt, kyCyrOpt });
    }
  }
}

// Broader: all g2-g4 question keys where EN has Think it through / Solve × while RU doesn't match
const broad = [];
for (const full of Object.keys(fru)) {
  if (!/^data\.tasks\.g[234]/.test(full)) continue;
  if (!/_q\d+$/.test(full.replace('data.tasks.', ''))) continue;
  const short = full.replace('data.tasks.', '');
  const r = fru[full], e = fen[full], y = fky[full];
  const kind = classify(r, e);
  if (kind) broad.push({ key: short, kind, correct: taskInfo[short]?.options?.filter((o) => o.correct).map((o) => o.id).join(','), RU: r, EN: e, KY: y });
}

// Dialog
function dialogCount(flat, re) {
  return Object.entries(flat)
    .filter(([k, v]) => k.startsWith('data.dialog.') && /data\.dialog\.g[234]/.test(k) && typeof v === 'string' && re.test(v))
    .map(([k, v]) => ({ key: k.replace('data.dialog.', ''), text: v }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

const report = {
  focused: out,
  mismatchQuestions: mismatches,
  broadWrongSkill: broad,
  dialogs: {
    en_HiLesson: dialogCount(fen, /Hi! Lesson:/),
    ky_Privet: dialogCount(fky, /Привет! Урок/),
    ky_Salam: dialogCount(fky, /Салам! Сабак/),
    en_ImTali: dialogCount(fen, /I'm Tali: read each/),
    ky_YaTali: dialogCount(fky, /Я Тали:/),
  },
};

fs.writeFileSync('scripts/_audit_focused.json', JSON.stringify(report, null, 2), 'utf8');

// compact TSV for human
const lines = ['key\ttaskId\tcorrect\tkind\tRU\tEN\tKY\toptA_RU|EN|KY\toptB\toptC'];
for (const m of mismatches) {
  const oa = m.options.map((o) => `${o.id}:${o.correct?'Y':'N'} RU=${o.RU} || EN=${o.EN} || KY=${o.KY}`).join(' ;; ');
  lines.push([m.key, m.taskId, m.correct, m.kind, m.RU, m.EN, m.KY, oa].join('\t'));
}
fs.writeFileSync('scripts/_audit_focused.tsv', lines.join('\n'), 'utf8');

console.log('mismatchQuestions', mismatches.length);
console.log('broadWrongSkill', broad.length);
console.log('by kind', broad.reduce((a, x) => ((a[x.kind] = (a[x.kind] || 0) + 1), a), {}));
console.log('dialogs EN Hi', report.dialogs.en_HiLesson.length, 'KY Privet', report.dialogs.ky_Privet.length, 'KY Salam', report.dialogs.ky_Salam.length);
console.log('broad keys:', broad.map((b) => b.key).join(', '));
