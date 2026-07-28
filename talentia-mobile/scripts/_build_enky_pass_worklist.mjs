// Build concrete EN/KY fix worklist for scope-A phase 2+3 lessons.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'src/data/worlds.ts'), 'utf8');
const lines = src.split('\n');
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8'));
const ky = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ky.json'), 'utf8'));
const audit = JSON.parse(fs.readFileSync(path.join(root, 'scripts/_curriculum_audit_merged.json'), 'utf8'));
const byId = Object.fromEntries(audit.lessons.map((l) => [l.id, l]));

const IDS = [
  'g2r-sh-l2', 'g2r-sh-l3', 'g2m-100-l1', 'g2m-100-l3', 'g2m-add2-l1', 'g2m-add2-l3',
  'g2m-times-l1', 'g2m-times-l2', 'g2m-times-l3', 'g2e-sch-l1', 'g2e-phr-l1',
  'g3e-food-l2', 'g3e-daily-l3', 'g3m-1000-l1', 'g3r-adj-l3', 'g3r-gen-l3', 'g3r-verb-l3',
  'g2r-sp-l2', 'g2r-sp-l3', 'g2s-plt-l1', 'g2s-ani-l1', 'g2s-ani-l2', 'g2s-ani-l3',
  'g2s-bdy-l1', 'g2s-bdy-l2',
];

function get(obj, key) {
  if (!key) return undefined;
  let cur = obj;
  for (const p of key.split('.')) {
    cur = cur?.[p];
    if (cur === undefined) return undefined;
  }
  return cur;
}

function hasCyr(s) {
  return /[\u0400-\u04FF]/.test(String(s || ''));
}

function lessonBlock(id) {
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (new RegExp(`id: '${id}', topicId:`).test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/id: '[a-z0-9-]+', topicId:/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return { start, end, block: lines.slice(start, end).join('\n'), lines: lines.slice(start, end) };
}

function collectKeys(block) {
  const keys = new Set();
  for (const m of block.matchAll(/'(data\.(?:tasks|dialog|intro|lessons)\.[^']+)'/g)) {
    keys.add(m[1]);
  }
  return [...keys];
}

function parseTasks(blockLines) {
  const tasks = [];
  for (const ln of blockLines) {
    const tm = ln.match(/id: '([\w-]+)', type: '(\w+)'/);
    if (!tm || /topicId/.test(ln)) continue;
    const task = { id: tm[1], type: tm[2], questionKey: null, options: [], correctAnswerKey: null };
    const qm = ln.match(/questionKey: '([^']+)'/);
    if (qm) task.questionKey = qm[1];
    for (const om of ln.matchAll(/\{ id: '(\w+)', textKey: '([^']+)', correct: (true|false)[^}]*\}/g)) {
      task.options.push({ id: om[1], textKey: om[2], correct: om[3] === 'true' });
    }
    const cam = ln.match(/correctAnswerKey: '([^']+)'/);
    if (cam) task.correctAnswerKey = cam[1];
    tasks.push(task);
  }
  return tasks;
}

function parseDialog(block) {
  const out = [];
  for (const m of block.matchAll(/\{ speaker: '(\w+)', textKey: '([^']+)' \}/g)) {
    out.push({ speaker: m[1], textKey: m[2] });
  }
  return out;
}

function parseIntro(block) {
  const out = [];
  for (const m of block.matchAll(/\{ titleKey: '([^']+)', bodyKey: '([^']+)'/g)) {
    out.push({ titleKey: m[1], bodyKey: m[2] });
  }
  return out;
}

/** Detect KY that is still Russian (same as RU, or starts with Russian Q patterns while EN is Latin). */
function isKyRuLeak(kyT, ruT, enT) {
  if (kyT == null || ruT == null) return false;
  const k = String(kyT).trim();
  const r = String(ruT).trim();
  if (!hasCyr(k)) return false;
  if (k === r) return true;
  // Russian question starters that are not Kyrgyz
  if (
    enT &&
    !hasCyr(enT) &&
    /^(Какое|Какой|Какая|Какие|Что |Кто |Сколько|Запиши|Найди|Выбери|Поставь|Сравни|Напиши|Верно ли|Где |Чем |Как |Почему|Каким|У кого|Сколько)/i.test(k)
  ) {
    return true;
  }
  return false;
}

function isDialogStub(enT, ruT) {
  if (!enT || !ruT) return false;
  const e = String(enT).trim();
  const r = String(ruT).trim();
  if (/^[0-9+\-×xX*/=?\s]+$/.test(e) && r.length > 20) return true;
  if (e.length <= 24 && r.length >= 50 && !hasCyr(e)) return true;
  if (/^(What is|How much is|Solve|Find)\s*\d/i.test(e) && r.length > 40) return true;
  return false;
}

function row(type, key, proposedEn, proposedKy) {
  return {
    type,
    key,
    ru: get(ru, key) ?? null,
    en: get(en, key) ?? null,
    ky: get(ky, key) ?? null,
    ...(proposedEn ? { proposedEn } : {}),
    ...(proposedKy ? { proposedKy } : {}),
  };
}

/** Lesson-specific priority picks based on audit flags + concrete text. */
function pickIssues(id, lb, flags) {
  const issues = [];
  const tasks = parseTasks(lb.lines);
  const dialog = parseDialog(lb.block);
  const intro = parseIntro(lb.block);
  const flagStr = (flags || []).join(' ');

  const push = (iss) => {
    if (!iss?.key) return;
    // dedupe by type+key
    if (issues.some((x) => x.type === iss.type && x.key === iss.key)) return;
    issues.push(iss);
  };

  // --- dialog stubs / mismatch ---
  if (/dialog_en_stub|dialog_en_generic|dialog_en_off_topic|dialog_en_theme_shift|dialog_enky_wrong|dialog_en_stub_vs_ru/i.test(flagStr)) {
    for (const d of dialog) {
      const r = get(ru, d.textKey);
      const e = get(en, d.textKey);
      const k = get(ky, d.textKey);
      if (isDialogStub(e, r) || String(e) !== String(r) && (e?.length ?? 0) < (r?.length ?? 0) * 0.45) {
        push(row(/wrong_operation/i.test(flagStr) ? 'dialog_wrong_op' : 'dialog_stub', d.textKey));
      } else if (/off_topic|theme_shift/i.test(flagStr) && d.speaker === 'tali') {
        push(row('dialog_en_mismatch', d.textKey));
      } else if (/wrong_operation/i.test(flagStr)) {
        push(row('dialog_wrong_op', d.textKey));
      }
    }
    // if none matched heuristics, still take first tali + first npc
    if (!issues.some((x) => x.type.startsWith('dialog'))) {
      for (const d of dialog.slice(0, 2)) push(row('dialog_stub', d.textKey));
    }
  }

  // --- KY ru leak on question keys ---
  if (/ky_q_ru_leak/i.test(flagStr)) {
    for (const t of tasks) {
      if (!t.questionKey) continue;
      const r = get(ru, t.questionKey);
      const e = get(en, t.questionKey);
      const k = get(ky, t.questionKey);
      if (isKyRuLeak(k, r, e)) {
        push(row('ky_ru_leak', t.questionKey));
      }
    }
  }

  // --- title / intro eq ru ---
  if (/title_enky_eq_ru/i.test(flagStr)) {
    const titleKeys = collectKeys(lb.block).filter((k) => k.includes('data.lessons.'));
    for (const k of titleKeys) {
      const r = get(ru, k);
      const e = get(en, k);
      if (e === r && hasCyr(r)) push(row('en_eq_ru', k));
      const kyT = get(ky, k);
      if (kyT === r && hasCyr(r)) push(row('ky_eq_ru', k));
    }
  }
  if (/intro_title_enky_eq_ru/i.test(flagStr)) {
    for (const i of intro) {
      const r = get(ru, i.titleKey);
      const e = get(en, i.titleKey);
      if (e === r && hasCyr(r)) push(row('en_eq_ru', i.titleKey));
      const kyT = get(ky, i.titleKey);
      if (kyT === r && hasCyr(r)) push(row('ky_eq_ru', i.titleKey));
    }
  }

  // --- KY intro == RU ---
  if (/KY intro0\.title === RU/i.test(flagStr)) {
    for (const i of intro.slice(0, 1)) {
      push(row('ky_eq_ru', i.titleKey));
    }
  }

  // --- bare formula EN questions ---
  if (/en_bare_formula|bare_equation/i.test(flagStr)) {
    for (const t of tasks) {
      if (!t.questionKey) continue;
      const e = get(en, t.questionKey);
      const r = get(ru, t.questionKey);
      if (e && r && (/^[0-9+\-×xX*/=?\s]+$/.test(String(e).trim()) || (String(e).length < 18 && String(r).length > 25))) {
        push(row('en_bare_formula', t.questionKey));
      }
    }
  }

  // --- EN q mismatch / wrong syllable / ambiguous / simplified ---
  if (/en_q_mismatch|en_q_wrong|en_q_ambiguous|en_q_simplified|opts_en_truncated|misleading_task/i.test(flagStr)) {
    // Prefer task indices mentioned in flags
    const idxs = [...flagStr.matchAll(/:t(\d)/g)].map((m) => Number(m[1]) - 1);
    const targets = idxs.length ? idxs.map((i) => tasks[i]).filter(Boolean) : tasks;
    for (const t of targets) {
      if (t?.questionKey) {
        const type = /ambiguous/i.test(flagStr)
          ? 'en_q_ambiguous'
          : /wrong_syllable|mismatch|simplified|misleading/i.test(flagStr)
            ? 'en_mismatch'
            : 'en_mismatch';
        push(row(type, t.questionKey));
      }
      if (/opts_en_truncated/i.test(flagStr)) {
        for (const o of t.options) push(row('en_opt_truncated', o.textKey));
      }
    }
  }

  // --- tautology (EN option equals stem word) ---
  if (/tautolog/i.test(flagStr)) {
    for (const t of tasks) {
      if (!t.questionKey) continue;
      const qEn = String(get(en, t.questionKey) || '');
      for (const o of t.options) {
        const oEn = String(get(en, o.textKey) || '');
        if (!oEn) continue;
        // e.g. "Onions means" -> option "Onions"; "always" -> "Always"
        const qWords = qEn.toLowerCase().match(/[a-z']+/g) || [];
        if (qWords.includes(oEn.toLowerCase()) && o.correct) {
          push(row('tautology', o.textKey));
        }
      }
    }
  }

  // --- opts_enky_eq_ru / EN options === RU / labels ---
  if (/opts_enky_eq_ru|option explanations === RU|labels === RU|options без gloss|EN t1\/t3 options|opt_ky_untranslated/i.test(flagStr)) {
    for (const t of tasks) {
      for (const o of t.options) {
        const r = get(ru, o.textKey);
        const e = get(en, o.textKey);
        const k = get(ky, o.textKey);
        if (e != null && r != null && String(e) === String(r) && hasCyr(r)) {
          push(row('en_eq_ru', o.textKey));
        }
        if (k != null && r != null && String(k) === String(r) && hasCyr(r)) {
          push(row('ky_eq_ru', o.textKey));
        }
        if (/opt_ky_untranslated/i.test(flagStr) && k && hasCyr(k) && /красив|хорош|плох/i.test(String(k))) {
          push(row('ky_ru_leak', o.textKey));
        }
      }
    }
  }

  // --- stems flattened (g3m-1000) ---
  if (/сплющены|stems/i.test(flagStr)) {
    for (const t of tasks.slice(0, 2)) {
      if (t.questionKey) push(row('en_mismatch', t.questionKey));
    }
  }

  // --- EN dialog/intro topic mismatch (g3e-daily-l3) ---
  if (/topic mismatch|frequency/i.test(flagStr)) {
    for (const d of dialog.slice(0, 2)) push(row('dialog_en_mismatch', d.textKey));
    for (const i of intro.slice(0, 1)) {
      push(row('en_mismatch', i.titleKey));
      push(row('en_mismatch', i.bodyKey));
    }
  }

  // --- board ambiguous ---
  if (/en_q_ambiguous:board/i.test(flagStr)) {
    for (const t of tasks) {
      const e = String(get(en, t.questionKey) || '');
      if (/board/i.test(e)) push(row('en_q_ambiguous', t.questionKey));
    }
  }

  // --- forward_ref / trivia / vague — only if also locale issue; skip pure pedagogy unless key is wrong locale ---
  // Still capture KY leaks already handled.

  // Catch remaining KY==RU on task questions even if flag didn't name them
  if (/ky_q_ru_leak/i.test(flagStr)) {
    for (const t of tasks) {
      if (!t.questionKey) continue;
      const r = get(ru, t.questionKey);
      const e = get(en, t.questionKey);
      const k = get(ky, t.questionKey);
      if (k != null && r != null && String(k) === String(r) && hasCyr(r) && e && !hasCyr(e)) {
        push(row('ky_ru_leak', t.questionKey));
      }
    }
  }

  // For g2e-phr dialog stub
  if (id === 'g2e-phr-l1' && /dialog_en_stub/i.test(flagStr)) {
    for (const d of dialog) {
      const e = get(en, d.textKey);
      const r = get(ru, d.textKey);
      if (isDialogStub(e, r) || (e && r && String(e).length < String(r).length * 0.5)) {
        push(row('dialog_stub', d.textKey));
      }
    }
  }

  return { issues, tasks, dialog, intro };
}

// Manual proposed text for highest-value bugs (RU-faithful).
const PROPOSALS = {
  // filled after dump inspection in second pass via inline map below
};

const worklist = [];
const rawDump = [];

for (const id of IDS) {
  const L = byId[id];
  const lb = lessonBlock(id);
  if (!lb) {
    worklist.push({ lessonId: id, issues: [], error: 'not found in worlds.ts' });
    continue;
  }
  const flags = L?.enkyFlags || [];
  const { issues, tasks, dialog, intro } = pickIssues(id, lb, flags);

  // Enrich with proposals where we can derive from RU meaning briefly
  for (const iss of issues) {
    const p = PROPOSALS[iss.key];
    if (p?.proposedEn) iss.proposedEn = p.proposedEn;
    if (p?.proposedKy) iss.proposedKy = p.proposedKy;
  }

  rawDump.push({
    lessonId: id,
    flags,
    problems: (L?.problems || []).map((p) => `${p.ref}: ${p.issue}`),
    dialog: dialog.map((d) => ({
      speaker: d.speaker,
      key: d.textKey,
      ru: get(ru, d.textKey),
      en: get(en, d.textKey),
      ky: get(ky, d.textKey),
    })),
    intro: intro.map((i) => ({
      titleKey: i.titleKey,
      bodyKey: i.bodyKey,
      title: { ru: get(ru, i.titleKey), en: get(en, i.titleKey), ky: get(ky, i.titleKey) },
      body: { ru: get(ru, i.bodyKey), en: get(en, i.bodyKey), ky: get(ky, i.bodyKey) },
    })),
    tasks: tasks.map((t) => ({
      id: t.id,
      type: t.type,
      q: t.questionKey
        ? { key: t.questionKey, ru: get(ru, t.questionKey), en: get(en, t.questionKey), ky: get(ky, t.questionKey) }
        : null,
      options: t.options.map((o) => ({
        id: o.id,
        correct: o.correct,
        key: o.textKey,
        ru: get(ru, o.textKey),
        en: get(en, o.textKey),
        ky: get(ky, o.textKey),
      })),
      answer: t.correctAnswerKey
        ? { key: t.correctAnswerKey, ru: get(ru, t.correctAnswerKey), en: get(en, t.correctAnswerKey), ky: get(ky, t.correctAnswerKey) }
        : null,
    })),
    autoIssues: issues,
  });

  worklist.push({ lessonId: id, issues });
}

fs.writeFileSync(path.join(root, 'scripts/_enky_pass_raw.json'), JSON.stringify(rawDump, null, 2) + '\n');
console.log('raw written');
for (const w of worklist) {
  console.log(`\n${w.lessonId} (${w.issues.length})`);
  for (const i of w.issues.slice(0, 8)) {
    console.log(`  [${i.type}] ${i.key}`);
    console.log(`    RU: ${String(i.ru).slice(0, 70)}`);
    console.log(`    EN: ${String(i.en).slice(0, 70)}`);
    console.log(`    KY: ${String(i.ky).slice(0, 70)}`);
  }
}
const total = worklist.reduce((a, w) => a + w.issues.length, 0);
console.log('\nTOTAL ISSUES', total);
fs.writeFileSync(path.join(root, 'scripts/_enky_pass_worklist.auto.json'), JSON.stringify(worklist, null, 2) + '\n');
