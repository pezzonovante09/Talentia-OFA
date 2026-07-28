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

const fru = flatten(ru);
const fen = flatten(en);
const fky = flatten(ky);

const taskBlocks = [
  ...worlds.matchAll(
    /\{ id: '([^']+)', type: '[^']+', questionKey: '([^']+)'[\s\S]*?options: \[([\s\S]*?)\]\s*\}/g,
  ),
];
const taskInfo = {};
for (const tb of taskBlocks) {
  const taskId = tb[1];
  const qKey = tb[2];
  const opts = [
    ...tb[3].matchAll(/\{ id: '([^']+)', textKey: '([^']+)', correct: (true|false) \}/g),
  ].map((x) => ({ id: x[1], textKey: x[2].replace(/^data\.tasks\./, ''), correct: x[3] === 'true' }));
  taskInfo[qKey.replace(/^data\.tasks\./, '')] = { taskId, options: opts };
}

function pack(shortKey) {
  const full = `data.tasks.${shortKey}`;
  const info = taskInfo[shortKey];
  return {
    key: shortKey,
    taskId: info?.taskId ?? null,
    correctOptionIds: info?.options?.filter((o) => o.correct).map((o) => o.id) ?? [],
    options: info?.options ?? null,
    RU: fru[full] ?? null,
    EN: fen[full] ?? null,
    KY: fky[full] ?? null,
  };
}

function groupKeys(pred) {
  return Object.keys(fru)
    .filter((k) => k.startsWith('data.tasks.') && pred(k.replace('data.tasks.', '')))
    .map((k) => k.replace('data.tasks.', ''))
    .sort();
}

const result = {
  birds: groupKeys((k) =>
    /pre_birds_tree_vs_bush|pre_opt_tree_six_birds|pre_opt_bush_four_birds|pre_opt_birds_equal/.test(k),
  ).map(pack),
  g4s_emo: groupKeys((k) => /^g4s_emo/.test(k)).map(pack),
  g4m_md: groupKeys((k) => /^g4m_md_/.test(k)).map(pack),
  g4r_conj: groupKeys((k) => /^g4r_conj/.test(k)).map(pack),
  g4r_other_questions: groupKeys((k) => /^g4r_/.test(k) && !/^g4r_conj/.test(k) && !/_[abc]$/.test(k)).map(pack),
};

// Dialog stubs g2-g4
function dialogHits(flat, re) {
  return Object.entries(flat)
    .filter(([k, v]) => k.startsWith('data.dialog.') && typeof v === 'string' && re.test(v) && /data\.dialog\.g[234]/.test(k))
    .map(([k, v]) => ({ key: k.replace('data.dialog.', ''), text: v }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

result.dialogs = {
  en_HiLesson: (() => {
    const hits = dialogHits(fen, /Hi! Lesson:/);
    return { count: hits.length, sample20: hits.slice(0, 20), allKeys: hits.map((h) => h.key) };
  })(),
  ky_PrivetUrok: (() => {
    const hits = dialogHits(fky, /Привет! Урок/);
    return { count: hits.length, sample20: hits.slice(0, 20), allKeys: hits.map((h) => h.key) };
  })(),
  ky_SalamSabak: (() => {
    const hits = dialogHits(fky, /Салам! Сабак/);
    return { count: hits.length, sample20: hits.slice(0, 20), allKeys: hits.map((h) => h.key) };
  })(),
  en_ImTaliStub: (() => {
    const hits = dialogHits(fen, /I'm Tali: read each/);
    return { count: hits.length, sample20: hits.slice(0, 20) };
  })(),
};

// Systematic: EN questions that look like wrong-skill stubs vs RU
const qKeys = Object.keys(fru).filter((k) => /^data\.tasks\.(g[234]|pre_)/.test(k) && !/_[abc]$/.test(k) && !/_opt_/.test(k) && !/^data\.tasks\.opt_/.test(k));
const systematic = [];
for (const full of qKeys) {
  const short = full.replace('data.tasks.', '');
  const r = fru[full];
  const e = fen[full];
  const y = fky[full];
  if (!r || !e) continue;
  const enLooksStub =
    /Think it through:|Think and choose:|Choose an alliance:/.test(e) ||
    (/Solve:.*[×xX]|Decisions:|Decide:/.test(e) && !/умнож|множ|÷|×|умножить|разделить/i.test(r));
  const enCyrillicHeavy = (e.match(/[А-Яа-яЁё]/g) || []).length > 8;
  const kyIsRussianCopy = y && y === r;
  const kyHasRussianStub = y && /Привет! Урок|Ойлонуп көр:|Think it through/.test(y);
  // Heuristic: question text skill mismatch markers
  const skillMismatch =
    enLooksStub ||
    (e.includes('Where are more') && r.includes('Прав?')) ||
    (e.includes('empathy') && /злост|страх|радост/i.test(r)) ||
    (/×|÷/.test(e) && /разря|тысяч|сравн|числ/i.test(r)) ||
    (/alliance|conjunction|поэтому|хотя/i.test(e) && /спряж|я\/ты|он\/она|окончан/i.test(r));

  if (skillMismatch || (enLooksStub && short.startsWith('g4'))) {
    systematic.push({
      key: short,
      ...pack(short),
      flags: { enLooksStub, enCyrillicHeavy, kyIsRussianCopy, skillMismatch },
    });
  }
}
result.systematicFlagged = systematic;

fs.writeFileSync('scripts/_audit_mismatches.json', JSON.stringify(result, null, 2), 'utf8');

// Also write a readable markdown report with proper UTF-8
const lines = [];
function dumpPack(p) {
  lines.push(`### ${p.key}`);
  if (p.taskId) lines.push(`- taskId: \`${p.taskId}\` correct: **${p.correctOptionIds.join(',') || '(n/a)'}**`);
  if (p.options) {
    lines.push(
      `- options: ${p.options.map((o) => `${o.id}(${o.correct ? 'Y' : 'N'}:${o.textKey})`).join(', ')}`,
    );
  }
  lines.push(`- RU: ${p.RU}`);
  lines.push(`- EN: ${p.EN}`);
  lines.push(`- KY: ${p.KY}`);
  lines.push('');
}

lines.push('# Locale semantic mismatch audit');
lines.push('');
lines.push('## 1. Birds / mc10l1-t2');
result.birds.forEach(dumpPack);

lines.push('## 2. g4s_emo*');
result.g4s_emo.forEach(dumpPack);

lines.push('## 3. g4m_md_*');
result.g4m_md.forEach(dumpPack);

lines.push('## 4. g4r_conj*');
result.g4r_conj.forEach(dumpPack);

lines.push('## 5. Other g4r question keys (questions only)');
result.g4r_other_questions.forEach(dumpPack);

lines.push('## 6. Dialog stubs');
lines.push(`EN Hi! Lesson g2-4: ${result.dialogs.en_HiLesson.count}`);
result.dialogs.en_HiLesson.sample20.forEach((h) => lines.push(`- ${h.key}: ${h.text}`));
lines.push(`KY Привет! Урок g2-4: ${result.dialogs.ky_PrivetUrok.count}`);
result.dialogs.ky_PrivetUrok.sample20.forEach((h) => lines.push(`- ${h.key}: ${h.text}`));
lines.push(`KY Салам! Сабак g2-4: ${result.dialogs.ky_SalamSabak.count}`);
result.dialogs.ky_SalamSabak.sample20.forEach((h) => lines.push(`- ${h.key}: ${h.text}`));

lines.push('');
lines.push(`## 7. Systematic flagged (${result.systematicFlagged.length})`);
for (const p of result.systematicFlagged) {
  dumpPack(p);
}

fs.writeFileSync('scripts/_audit_mismatches.md', lines.join('\n'), 'utf8');
console.log('Wrote JSON+MD. birds', result.birds.length, 'emo', result.g4s_emo.length, 'md', result.g4m_md.length, 'conj', result.g4r_conj.length, 'g4rQ', result.g4r_other_questions.length);
console.log('dialogs EN Hi', result.dialogs.en_HiLesson.count, 'KY Privet', result.dialogs.ky_PrivetUrok.count, 'KY Salam', result.dialogs.ky_SalamSabak.count);
console.log('systematic', result.systematicFlagged.length);
