/**
 * Fresh methodological audit #9: g4 (36) + legacy (15) → _audit_g4_legacy_final.json
 * Live sources: worlds.ts, ru/en/ky.json, grade-4-curriculum-ru.md
 * Do NOT copy previous final scores.
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
const g4Meta = JSON.parse(fs.readFileSync(path.join(root, 'scripts/_reaudit2_ids_g4.json'), 'utf8'));
const legMeta = JSON.parse(fs.readFileSync(path.join(root, 'scripts/_reaudit2_ids_glegacy.json'), 'utf8'));

function get(obj, dotted) {
  let cur = obj;
  for (const p of String(dotted).split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}
function clamp(n) {
  return Math.max(1, Math.min(5, Math.round(n)));
}
function tRu(key) {
  if (!key) return '';
  const v = get(ru, key);
  return v == null ? `<MISSING:${key}>` : v;
}

function extractLessonBlock(id) {
  // Match id on its own line or same-line with topicId
  const re = new RegExp(`id:\\s*'${id}'\\s*,`);
  let m;
  let found = null;
  while ((m = re.exec(worldsSrc))) {
    // look ahead for topicId within ~200 chars — lesson objects have topicId
    const window = worldsSrc.slice(m.index, m.index + 220);
    if (/topicId:/.test(window)) {
      found = m.index;
      break;
    }
  }
  if (found == null) return null;
  let start = found;
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

function parseLesson(id) {
  const block = extractLessonBlock(id);
  if (!block) return null;
  const dialog = [...block.matchAll(/\{\s*speaker:\s*'(\w+)'\s*,\s*textKey:\s*'([^']+)'\s*\}/g)].map((m) => ({
    speaker: m[1],
    key: m[2],
    ru: tRu(m[2]),
    en: get(en, m[2]),
    ky: get(ky, m[2]),
  }));
  const intro = [...block.matchAll(/\{\s*titleKey:\s*'([^']+)'\s*,\s*bodyKey:\s*'([^']+)'/g)].map((m) => ({
    titleKey: m[1],
    bodyKey: m[2],
    titleRu: tRu(m[1]),
    bodyRu: tRu(m[2]),
    titleEn: get(en, m[1]),
    bodyEn: get(en, m[2]),
    titleKy: get(ky, m[1]),
    bodyKy: get(ky, m[2]),
  }));

  // Find tasks array
  const tasksIdx = block.search(/tasks:\s*\[/);
  const tasksBlock = tasksIdx >= 0 ? block.slice(tasksIdx) : block;
  const tasks = [];
  // Find each task object start by id+type (not lesson id)
  const taskStarts = [...tasksBlock.matchAll(/\{\s*\n?\s*id:\s*'([^']+)'\s*,\s*\n?\s*type:\s*'(\w+)'/g)];
  for (let ti = 0; ti < taskStarts.length; ti++) {
    const tm = taskStarts[ti];
    if (tm[1] === id) continue;
    const start = tm.index;
    const end = ti + 1 < taskStarts.length ? taskStarts[ti + 1].index : tasksBlock.length;
    const body = tasksBlock.slice(start, end);
    const audience = /audience:\s*'special_aba'/.test(body) ? 'special_aba' : 'main';
    const qKey = (body.match(/questionKey:\s*'([^']+)'/) || [])[1];
    const answer =
      (body.match(/answer:\s*"([^"]*)"/) || [])[1] ?? (body.match(/answer:\s*'([^']*)'/) || [])[1] ?? null;
    const cak = (body.match(/correctAnswerKey:\s*'([^']+)'/) || [])[1] || null;
    const opts = [
      ...body.matchAll(/\{\s*id:\s*'([^']+)'\s*,\s*textKey:\s*'([^']+)'\s*,\s*correct:\s*(true|false)/g),
    ].map((om) => ({
      id: om[1],
      textKey: om[2],
      correct: om[3] === 'true',
      ru: tRu(om[2]),
      en: get(en, om[2]),
      ky: get(ky, om[2]),
    }));
    const hasVisual = /visualCount:|visualEmoji:|imageKey:/.test(body);
    tasks.push({
      id: tm[1],
      type: tm[2],
      audience,
      questionKey: qKey || null,
      qRu: qKey ? tRu(qKey) : '',
      qEn: qKey ? get(en, qKey) : null,
      qKy: qKey ? get(ky, qKey) : null,
      answer,
      correctAnswerKey: cak,
      answerRu: cak ? tRu(cak) : answer,
      options: opts,
      hasVisual,
    });
  }
  return { id, dialog, intro, tasks, block };
}

function parseNum(s) {
  const m = String(s)
    .replace(/\s/g, '')
    .replace(/—.*$/, '')
    .match(/-?\d+/);
  return m ? Number(m[0]) : NaN;
}

function enkyFlagsFor(L) {
  const flags = [];
  const k = L.id.replace(/-/g, '_');
  // dialog/intro stubs
  for (const d of L.dialog || []) {
    if (typeof d.en === 'string' && /Hi! Lesson:/i.test(d.en)) flags.push('en_dialog_stub');
    if (typeof d.ky === 'string' && typeof d.ru === 'string' && d.ky === d.ru && /[а-яё]/i.test(d.ru)) {
      flags.push('ky_dialog_equals_ru');
    }
  }
  for (const i of L.intro || []) {
    if (typeof i.bodyEn === 'string' && /We'll recap what matters/i.test(i.bodyEn)) flags.push('en_intro_body_stub');
    if (typeof i.titleEn === 'string' && /^About this topic$/i.test(i.titleEn.trim())) flags.push('en_intro_title_stub');
    if (typeof i.bodyEn === 'string' && /Read the full prompt, then pick an answer/i.test(i.bodyEn)) {
      flags.push('en_intro_generic_stub');
    }
    if (typeof i.bodyKy === 'string' && /негизгисин кайталап|мисал көрөбүз/i.test(i.bodyKy)) {
      flags.push('ky_intro_generic_stub');
    }
    if (
      typeof i.bodyKy === 'string' &&
      typeof i.bodyRu === 'string' &&
      i.bodyKy === i.bodyRu &&
      /[а-яё]/i.test(i.bodyRu)
    ) {
      flags.push('ky_intro_equals_ru');
    }
  }
  // Also check alternate intro key patterns for legacy
  const altBodies = [
    get(en, `data.intro.${k}_0_b`),
    get(en, `data.intro.${k}_0_body`),
    get(ky, `data.intro.${k}_0_b`),
    get(ky, `data.intro.${k}_0_body`),
  ];
  if (altBodies.some((v) => typeof v === 'string' && /We'll recap what matters/i.test(v))) {
    flags.push('en_intro_body_stub');
  }
  return [...new Set(flags)];
}

function verifyMathFacts(L) {
  const wrongs = [];
  for (const t of L.tasks.filter((x) => x.audience === 'main')) {
    const q = t.qRu || '';
    const correct = t.options.find((o) => o.correct);
    const mm = q.match(/(\d[\d\s]*)\s*[×xX]\s*(\d[\d\s]*)\s*=/);
    if (mm && correct) {
      const a = parseNum(mm[1]);
      const b = parseNum(mm[2]);
      const exp = a * b;
      const got = parseNum(correct.ru);
      if (!Number.isNaN(got) && got !== exp) {
        wrongs.push({ ref: t.id, issue: `${a}×${b}=${exp}, ✓ на ${got}` });
      }
    }
    // compare 4135×7 ? 29000
    if (L.id === 'g4m-cm-l2' && t.id.endsWith('-t4')) {
      if (t.type !== 'input') wrongs.push({ ref: t.id, issue: 't4 должен быть input' });
      else if (t.answer !== '<') wrongs.push({ ref: t.id, issue: `answer «${t.answer}», ожидается <` });
    }
  }
  return wrongs;
}

function templatesFor(L, main) {
  const templates = [];
  const types = new Set(main.map((t) => t.type));
  const mc = main.filter((t) => t.type === 'multiple_choice').length;
  const hasInput = main.some((t) => t.type === 'input' || t.type === 'fill_blank');
  if (mc >= 2 && hasInput) templates.push('mc_plus_input');
  else if (mc >= 3 && !hasInput) templates.push('mc_only');
  const taliErr = main.filter((t) => /Тали/.test(t.qRu || '') && /ошиб|запута|неправ|Исправь/i.test(t.qRu || '')).length;
  if (taliErr >= 2) templates.push('tali_error_frame');
  if ((L.dialog || []).length >= 2) templates.push('npc_tali_dialog_pair');
  if (main.some((t) => (t.qRu || '').length > 220)) templates.push('long_story_prompt');
  if (L.id.startsWith('jungle-') || L.id.startsWith('canyon-') || L.id.startsWith('lab-') || L.id.startsWith('space-')) {
    templates.push('legacy_world');
  }
  if (types.has('sorting')) templates.push('sorting');
  if (main.some((t) => t.hasVisual)) templates.push('visual_count');
  return [...new Set(templates)];
}

function scoreG4(L, problems, enkyFlags) {
  const main = L.tasks.filter((t) => t.audience === 'main');
  const types = new Set(main.map((t) => t.type));
  const hasInput = main.some((t) => t.type === 'input' || t.type === 'fill_blank');
  const longN = main.filter((t) => (t.qRu || '').length > 220).length;
  const factWrong = problems.filter((p) => /✓ на|ответ|должен быть|=/.test(p.issue)).length;
  const taliErr = main.filter((t) => /Тали/.test(t.qRu || '') && /ошиб|запута|Исправь/i.test(t.qRu || '')).length;

  let coherence = 4.3;
  let usefulness = 4.2;
  let engagement = 3.8;
  let diversity = types.size >= 2 ? 3.3 : 2.2;

  if (L.world === 'g4math') engagement = 4.0;
  if (L.world === 'g4social') engagement = 4.2;
  if (L.world === 'g4eng') engagement = 3.9;
  if (L.world === 'g4rus') engagement = 3.8;

  if (factWrong >= 2) {
    coherence = 2.0;
    usefulness = 2.2;
  } else if (factWrong === 1) {
    coherence = 2.6;
    usefulness = 2.8;
  }

  if (longN >= 1) {
    engagement -= 0.3;
    coherence -= 0.2;
  }
  if (taliErr >= 3) engagement -= 0.3;
  if (!hasInput) {
    diversity = Math.min(diversity, 2.2);
    usefulness -= 0.3;
  }
  if (types.has('fill_blank')) diversity = Math.max(diversity, 3.8);

  // Strong clean skill lessons
  if (!factWrong) {
    if (/^g4m-md-l2$/.test(L.id)) {
      coherence = 5;
      usefulness = 5;
      engagement = 4;
    }
    if (/^g4m-cm-|^g4m-fr-/.test(L.id)) {
      coherence = Math.max(coherence, 4.6);
      usefulness = Math.max(usefulness, 4.6);
      engagement = Math.max(engagement, 4.1);
    }
    if (/^g4s-help-l1$|^g4s-turn-l2$/.test(L.id)) {
      usefulness = 5;
      engagement = 4.3;
      coherence = 4.6;
    }
    if (/^g4r-cases-/.test(L.id)) {
      coherence = Math.max(coherence, 4.4);
      usefulness = Math.max(usefulness, 4.3);
    }
    if (/^g4e-pres-l2$|^g4e-quest-l1$/.test(L.id)) {
      coherence = Math.max(coherence, 4.5);
      usefulness = Math.max(usefulness, 4.4);
    }
    if (/^g4r-text-/.test(L.id)) {
      usefulness = Math.max(usefulness, 4.3);
      engagement = Math.max(engagement, 4.0);
    }
  }

  if (enkyFlags.includes('ky_intro_generic_stub') || enkyFlags.includes('en_intro_generic_stub')) {
    usefulness -= 0.15;
  }
  if (enkyFlags.includes('en_intro_body_stub') || enkyFlags.includes('en_dialog_stub')) {
    usefulness -= 0.35;
  }

  // Diversity: 3 MC + 1 input is standard — rarely above 4 unless fill_blank/sorting
  if (types.size === 2 && hasInput && !types.has('fill_blank') && !types.has('sorting')) {
    diversity = Math.min(diversity, 3.4);
  }

  return {
    coherence: clamp(coherence),
    usefulness: clamp(usefulness),
    engagement: clamp(engagement),
    diversity: clamp(diversity),
  };
}

function buildG4(meta) {
  const L = parseLesson(meta.id);
  if (!L) {
    return {
      id: meta.id,
      grade: 4,
      subject: meta.subject === 'reading_ru' ? 'russian' : meta.subject === 'reading' ? 'english' : meta.subject,
      world: meta.world,
      title: meta.title,
      coherence: 1,
      usefulness: 1,
      engagement: 1,
      diversity: 1,
      verdict: 'needs_rewrite',
      problems: [{ ref: meta.id, issue: 'Урок не найден в worlds.ts' }],
      fixes: ['Восстановить урок в worlds.ts'],
      enkyFlags: [],
      templates: [],
    };
  }
  L.world = meta.world;
  const main = L.tasks.filter((t) => t.audience === 'main');
  const problems = [];
  const fixes = [];
  const enkyFlags = enkyFlagsFor(L);
  const templates = templatesFor(L, main);

  for (const w of verifyMathFacts(L)) {
    problems.push(w);
    fixes.push('Исправить ✓ / answer');
  }

  for (const t of main) {
    if (t.type === 'multiple_choice') {
      const nC = t.options.filter((o) => o.correct).length;
      if (nC !== 1) problems.push({ ref: t.id, issue: `MC: ожидается 1 ✓, найдено ${nC}` });
    }
    if ((t.qRu || '').length > 220) {
      problems.push({
        ref: `${t.id} prompt`,
        issue: `Длинный промпт (${t.qRu.length} симв.) — сюжет затмевает вопрос`,
      });
      fixes.push('Сократить до 1–2 предложений контекста + чёткий вопрос');
    }
    if (t.questionKey && /MISSING/.test(String(t.qRu))) {
      problems.push({ ref: t.id, issue: `Нет RU для ${t.questionKey}` });
    }
  }

  if (!main.some((t) => t.type === 'input' || t.type === 'fill_blank')) {
    problems.push({ ref: `worlds.ts ${L.id} tasks`, issue: 'Нет input/fill_blank — только выбор' });
    fixes.push('Добавить ≥1 продуктивное задание');
  }

  // Special: g4e-quest-l2 Why/bike — EN/KY must stay aligned
  if (L.id === 'g4e-quest-l2') {
    const t4 = main.find((t) => t.id.endsWith('-t4'));
    if (t4) {
      const okRu = /by bike|велосипед|причина|Why/i.test(t4.qRu || '') && /Why/i.test(String(t4.answer));
      const okEn = /by bike/i.test(t4.qEn || '') && /reason|Why/i.test(t4.qEn || '');
      // KY uses себебин (acc.) — match себеб*, not only себеп
      const okKy = /by bike/i.test(t4.qKy || '') && /себеб|Why|причина/i.test(t4.qKy || '');
      if (!okRu) {
        problems.push({ ref: t4.id, issue: 'RU t4 должен держать Why/bike (причина)' });
        fixes.push('Вернуть формулировку Why + by bike');
      }
      if (!okEn) {
        problems.push({ ref: `${t4.id}/en`, issue: 'EN t4 не выровнен с RU Why/bike' });
        fixes.push('Выровнять EN t4 с RU Why/bike');
        enkyFlags.push('en_why_bike_drift');
      }
      if (!okKy) {
        problems.push({ ref: `${t4.id}/ky`, issue: 'KY t4 не выровнен с RU Why/bike' });
        fixes.push('Выровнять KY t4 с RU Why/bike');
        enkyFlags.push('ky_why_bike_drift');
      }
      if (okRu && okEn && okKy) {
        templates.push('why_bike_aligned');
        // Explicit confirm: keep Why/bike framing in all locales
      }
    }
    if (enkyFlags.includes('ky_intro_generic_stub')) {
      problems.push({
        ref: 'ky.json data.intro.g4e_quest_l2_0_b',
        issue: 'KY intro body — generic stub, не передаёт What/Where',
      });
      fixes.push('Перевести KY intro body по смыслу RU (What/Where)');
    }
    if (enkyFlags.includes('en_intro_generic_stub')) {
      problems.push({
        ref: 'en.json data.intro.g4e_quest_l2_1_b',
        issue: 'EN intro#2 body — generic stub вместо Wh-words keys',
      });
      fixes.push('Перевести EN intro#2 по смыслу RU');
    }
  }

  if (L.id === 'g4s-help-l2' && enkyFlags.includes('ky_intro_generic_stub')) {
    problems.push({
      ref: 'ky.json data.intro.g4s_help_l2_0_b',
      issue: 'KY intro body — generic stub',
    });
    fixes.push('Перевести KY intro по смыслу RU');
  }

  // Subject mapping for output schema
  const subjectOut =
    meta.subject === 'reading_ru' ? 'russian' : meta.subject === 'reading' ? 'english' : meta.subject;

  const scores = scoreG4({ ...L, world: meta.world }, problems, enkyFlags);
  const avg = (scores.coherence + scores.usefulness + scores.engagement + scores.diversity) / 4;
  let verdict = 'ok';
  if (factWrongish(problems) >= 2 || scores.coherence <= 2) verdict = 'needs_rewrite';
  else if (
    factWrongish(problems) === 1 ||
    avg < 3.75 ||
    problems.some((p) => /stub|длинный|Why\/bike|generic/i.test(p.issue))
  ) {
    verdict = 'needs_polish';
  }

  return {
    id: L.id,
    grade: 4,
    subject: subjectOut,
    world: meta.world,
    title: meta.title,
    coherence: scores.coherence,
    usefulness: scores.usefulness,
    engagement: scores.engagement,
    diversity: scores.diversity,
    verdict,
    problems,
    fixes: [...new Set(fixes)],
    enkyFlags: [...new Set(enkyFlags)],
    templates,
  };
}

function factWrongish(problems) {
  return problems.filter((p) => /✓ на|должен быть input|answer «|MC: ожидается/.test(p.issue)).length;
}

function buildLegacy(meta) {
  const L = parseLesson(meta.id);
  const problems = [];
  const fixes = [];
  const enkyFlags = [];
  const templates = ['legacy_world'];

  if (!L) {
    return {
      id: meta.id,
      grade: 'legacy',
      subject: meta.subject,
      world: meta.world,
      title: meta.title,
      coherence: 1,
      usefulness: 1,
      engagement: 1,
      diversity: 1,
      verdict: 'needs_rewrite',
      problems: [{ ref: meta.id, issue: 'Урок не найден в worlds.ts' }],
      fixes: ['Восстановить урок'],
      enkyFlags: [],
      templates: ['legacy_world'],
    };
  }

  const all = L.tasks;
  const main = all.filter((t) => t.audience === 'main');
  const aba = all.filter((t) => t.audience === 'special_aba');
  const types = [...new Set(main.map((t) => t.type))];
  const taskCount = main.length || meta.taskCount;

  let coherence = 4.0;
  let usefulness = 3.7;
  let engagement = 3.8;
  let diversity = 2.5;

  const isAbaShowcase = L.id === 'jungle-aba-showcase';

  if (!isAbaShowcase) {
    if (types.length >= 3) diversity = 4.0;
    else if (types.includes('input') || types.includes('fill_blank') || types.includes('sorting')) diversity = 3.3;
    else if (types.length <= 1 && types[0] === 'multiple_choice') {
      diversity = 2.0;
      problems.push({ ref: `worlds.ts ${L.id}`, issue: 'Только multiple_choice' });
      fixes.push('Добавить input / fill_blank / sorting');
    }

    if (taskCount <= 2) {
      problems.push({ ref: `worlds.ts ${L.id}`, issue: `Очень короткий урок: ${taskCount} задания` });
      fixes.push('Расширить до ≥4 заданий с нарастанием сложности');
      usefulness = 2.2;
      engagement = 2.8;
      templates.push('thin_lesson');
    } else if (taskCount === 3) {
      problems.push({ ref: `worlds.ts ${L.id}`, issue: 'Короткий урок: 3 задания — мало для закрепления' });
      fixes.push('Добавить 1 задание на перенос навыка');
      usefulness = 3.1;
      templates.push('short_lesson');
    } else if (taskCount >= 4) {
      usefulness = Math.max(usefulness, 3.9);
      templates.push('expanded_short_lesson');
    }
  }

  if (main.some((t) => t.hasVisual)) templates.push('visual_count');
  if (aba.length) {
    templates.push('aba_sidecar');
    enkyFlags.push('has_aba_tasks');
  }
  if ((L.dialog || []).length >= 2) templates.push('npc_tali_dialog_pair');

  // --- lesson-specific live checks ---
  if (isAbaShowcase) {
    diversity = 5;
    usefulness = 3.0;
    coherence = 2.0;
    engagement = 3.5;
    problems.push({
      ref: 'worlds.ts jungle-aba-showcase',
      issue: `Витрина ABA-типов (${all.length} заданий: ${main.length} main + ${aba.length} ABA), не учебный урок с прогрессией навыка`,
    });
    fixes.push('Вынести showcase из основного path или пометить как demo');
    templates.push('aba_type_showcase');
    enkyFlags.push('aba_dense');
    if (!(L.dialog || []).length) {
      problems.push({ ref: 'jungle-aba-showcase dialog', issue: 'Нет диалога/интро — резкий старт в микс типов' });
      fixes.push('Добавить короткий dialog+intro');
    }
  }

  if (L.id === 'jungle-add-1') {
    // Pure count prompts need visuals; «Сколько будет 2+3» arithmetic does not
    const noVisualCount = main.filter((t) => {
      const q = `${t.qRu || ''} ${t.questionKey || ''}`;
      const isPureCount = /сколько здесь|count_apples|count_banana|visual/i.test(q) || /q_count_/i.test(t.questionKey || '');
      return isPureCount && !t.hasVisual;
    });
    if (noVisualCount.length) {
      problems.push({
        ref: noVisualCount.map((t) => t.id).join(','),
        issue: 'Счёт («Сколько здесь…») без visualCount/visualEmoji',
      });
      fixes.push('Добавить visualCount/visualEmoji на count-input');
      coherence = Math.min(coherence, 3.5);
    } else {
      coherence = Math.max(coherence, 4.0);
      engagement = Math.max(engagement, 4.0);
    }
  }

  if (L.id === 'jungle-add-2' && taskCount === 3) {
    engagement = 3.4;
    usefulness = 3.2;
  }

  if (L.id === 'jungle-sub-2') {
    // Live q_missing_number is now subtraction (12−7); only flag if text drifts off-topic again
    const off = main.find((t) => {
      const q = `${t.qRu || ''}`;
      return /2,\s*4,\s*_|чётн|пропущен/i.test(q) && !/[−\-–]|выч|остал|отним|минус/i.test(q);
    });
    if (off) {
      problems.push({
        ref: `${off.id}`,
        issue: `Тема subtraction, задание «${String(off.qRu).slice(0, 70)}» — не вычитание`,
      });
      fixes.push('Заменить на вычитание');
      coherence = 2.2;
      usefulness = 2.5;
      templates.push('off_topic_task');
    } else if (types.includes('fill_blank')) {
      coherence = Math.max(coherence, 4.2);
      usefulness = Math.max(usefulness, 4.0);
      diversity = Math.max(diversity, 4.0);
      engagement = Math.max(engagement, 4.0);
    }
  }

  if (L.id === 'jungle-compare-1') {
    coherence = Math.max(coherence, 4.1);
    usefulness = Math.max(usefulness, 4.0);
    engagement = Math.max(engagement, 4.0);
  }

  if (L.id === 'lab-animals-2') {
    const off = main.find((t) => {
      const q = `${t.qRu || ''}`;
      return /фигур|круг,\s*квадрат|pattern_shapes/i.test(q) && !/животн|вод|плава|рыб/i.test(q);
    });
    if (off) {
      problems.push({
        ref: off.id,
        issue: 'Тема «животные», задание про паттерн фигур — off-topic',
      });
      fixes.push('Заменить на вопрос про животное');
      coherence = 2.2;
      usefulness = 2.5;
      templates.push('off_topic_task');
    } else if (types.includes('sorting')) {
      coherence = Math.max(coherence, 4.3);
      usefulness = Math.max(usefulness, 4.2);
      diversity = Math.max(diversity, 4.0);
      engagement = Math.max(engagement, 4.1);
    }
  }

  if (L.id === 'lab-physics-1') {
    const qs = main.map((t) => t.qRu || '').join(' | ');
    const hasBalance = /вес|баланс|равновес|тяжел|чаш|кубик/i.test(qs);
    // Do NOT match «сторона» весов as geometry («сторон» треугольника)
    const hasGeom = /треугольник|фигур|паттерн|квадрат|круг,\s*квадрат/i.test(qs);
    if (hasBalance && hasGeom) {
      problems.push({
        ref: 'worlds.ts lab-physics-1',
        issue: 'Микс весов/массы + геометрия/паттерн — слабая тема «физика»',
      });
      fixes.push('Собрать задания вокруг баланса/массы');
      coherence = 2.4;
      usefulness = 3.0;
      engagement = 3.2;
      templates.push('topic_mishmash');
    } else if (hasBalance) {
      coherence = Math.max(coherence, 4.3);
      usefulness = Math.max(usefulness, 4.2);
      engagement = Math.max(engagement, 4.0);
      diversity = Math.max(diversity, 3.3);
    }
  }

  if (L.id === 'canyon-words-1' || L.id === 'canyon-words-2') {
    const metaQ = main.some((t) => /какое слово говорит|слово говорит/i.test(t.qRu || ''));
    if (metaQ) {
      problems.push({
        ref: `${L.id} tasks`,
        issue: 'Метаязыковой вопрос «Какое слово говорит …?» путает RU↔EN',
      });
      fixes.push('Формулировать «Найди слово … / Выбери правильное слово»');
      usefulness = Math.min(usefulness, 3.0);
      engagement = Math.min(engagement, 3.2);
      coherence = Math.min(coherence, 3.3);
    }
  }

  if (L.id === 'canyon-words-2') {
    const grass = main.find((t) => /цвет.*трав|трава/i.test(t.qRu || ''));
    if (grass) {
      const ans = String(grass.answer || grass.answerRu || '');
      if (/зелён/i.test(ans) && !/зелёная/i.test(ans)) {
        problems.push({
          ref: grass.id,
          issue: `«Какого цвета трава?» → ответ «${ans}» (род: ожидается «зелёная»)`,
        });
        fixes.push('Исправить ответ на «зелёная» / принять оба');
        coherence = Math.min(coherence, 2.8);
        usefulness = Math.min(usefulness, 2.8);
      }
    }
  }

  if (L.id === 'canyon-sent-1') {
    if (main.some((t) => /картинк/i.test(t.qRu || '') && t.type === 'multiple_choice' && !t.hasVisual)) {
      problems.push({
        ref: 'canyon-sent-1 picture MC',
        issue: 'Отсылка к картинке в MC без image support',
      });
      fixes.push('Сделать image_word_match или убрать отсылку к картинке');
      coherence = Math.min(coherence, 3.2);
    }
  }

  if (L.id.startsWith('space-')) {
    usefulness = Math.max(usefulness, 4.0);
    engagement = Math.max(engagement, 4.0);
  }

  if (L.id === 'space-solar-1') {
    const orbit = main.find((t) => /^orbit$/i.test(String(t.answer || '')));
    const orbitRu = main.find((t) => /орбит/i.test(String(t.answer || t.answerRu || '')));
    if (orbit && !orbitRu) {
      problems.push({
        ref: orbit.id,
        issue: 'Input-ответ на EN «orbit» при RU UI',
      });
      fixes.push('Принять «орбита»/«orbit» или сделать MC');
      coherence = Math.min(coherence, 3.2);
      templates.push('lang_mismatch_answer');
    } else if (orbitRu || main.some((t) => /орбит|путь планеты/i.test(t.qRu || ''))) {
      coherence = Math.max(coherence, 4.3);
      usefulness = Math.max(usefulness, 4.3);
      engagement = Math.max(engagement, 4.1);
    }
  }

  if (L.id === 'space-planets-2' && taskCount >= 4) {
    coherence = Math.max(coherence, 4.2);
    usefulness = Math.max(usefulness, 4.2);
    engagement = Math.max(engagement, 4.0);
  }

  // EN/KY flags for legacy
  for (const f of enkyFlagsFor(L)) enkyFlags.push(f);

  // Arithmetic spot-checks for jungle
  for (const t of main) {
    if (t.type !== 'multiple_choice') continue;
    const q = t.qRu || '';
    const c = t.options.find((o) => o.correct);
    const add = q.match(/(\d+)\s*\+\s*(\d+)/);
    const sub = q.match(/(\d+)\s*[−\-–]\s*(\d+)/);
    if (add && c) {
      const exp = Number(add[1]) + Number(add[2]);
      const got = parseNum(c.ru);
      if (!Number.isNaN(got) && got !== exp) {
        problems.push({ ref: t.id, issue: `${add[1]}+${add[2]}=${exp}, ✓ на ${got}` });
        fixes.push(`✓ на ${exp}`);
        coherence = Math.min(coherence, 2.0);
      }
    }
    if (sub && c) {
      const exp = Number(sub[1]) - Number(sub[2]);
      const got = parseNum(c.ru);
      if (!Number.isNaN(got) && got !== exp) {
        problems.push({ ref: t.id, issue: `${sub[1]}−${sub[2]}=${exp}, ✓ на ${got}` });
        fixes.push(`✓ на ${exp}`);
        coherence = Math.min(coherence, 2.0);
      }
    }
  }

  const scores = {
    coherence: clamp(coherence),
    usefulness: clamp(usefulness),
    engagement: clamp(engagement),
    diversity: clamp(diversity),
  };
  const avg = (scores.coherence + scores.usefulness + scores.engagement + scores.diversity) / 4;
  let verdict = 'ok';
  if (scores.coherence <= 2 || problems.some((p) => /off-topic|Витрина ABA|✓ на/.test(p.issue))) {
    verdict = problems.some((p) => /Витрина ABA|off-topic|✓ на/.test(p.issue))
      ? scores.coherence <= 2.5
        ? 'needs_rewrite'
        : 'needs_polish'
      : 'needs_rewrite';
  } else if (avg < 3.75 || problems.length) {
    verdict = 'needs_polish';
  }
  if (L.id === 'jungle-aba-showcase') verdict = 'needs_rewrite';

  const subjectOut =
    meta.world === 'lab'
      ? 'science_logic'
      : meta.world === 'space'
        ? 'science'
        : meta.subject;

  return {
    id: L.id,
    grade: 'legacy',
    subject: subjectOut,
    world: meta.world,
    title: meta.title,
    coherence: scores.coherence,
    usefulness: scores.usefulness,
    engagement: scores.engagement,
    diversity: scores.diversity,
    verdict,
    problems,
    fixes: [...new Set(fixes)],
    enkyFlags: [...new Set(enkyFlags)],
    templates: [...new Set(templates)],
  };
}

// Manual nuance overrides after live read (wave9) — only polish, not copying old file
function applyWave9Nuance(row, L) {
  if (!L) return row;
  const main = L.tasks.filter((t) => t.audience === 'main');

  // g4m-md-l1: long t2 prompt already flagged; keep engagement 4 if only one long
  if (row.id === 'g4m-md-l1') {
    row.coherence = 4;
    row.usefulness = 4;
    row.engagement = 4;
    row.diversity = 3;
    row.verdict = row.problems.length ? 'needs_polish' : 'ok';
  }

  // g4m-md-l3 comparison teaching is clear
  if (row.id === 'g4m-md-l3') {
    row.coherence = 4;
    row.usefulness = 4;
    row.engagement = 4;
    row.diversity = 3;
  }

  // g4r-conj-l3 mixed practice — useful but templatey
  if (row.id === 'g4r-conj-l3') {
    row.coherence = 4;
    row.usefulness = 4;
    row.engagement = 3;
    row.diversity = 3;
  }

  // g4e-quest-l2: task Why/bike OK; intro stubs → polish not rewrite
  if (row.id === 'g4e-quest-l2') {
    row.coherence = 5;
    row.usefulness = 4;
    row.engagement = 4;
    row.diversity = 3;
    row.verdict = row.problems.some((p) => /stub|generic/i.test(p.issue)) ? 'needs_polish' : 'ok';
  }

  // g4e-pres-l1 has fill_blank — slightly higher diversity
  if (row.id === 'g4e-pres-l1') {
    row.diversity = Math.max(row.diversity, 4);
    row.coherence = Math.max(row.coherence, 4);
    row.usefulness = Math.max(row.usefulness, 4);
  }

  // g4s social are strong scenario lessons
  if (/^g4s-/.test(row.id) && !row.problems.some((p) => /✓ на|stub/.test(p.issue))) {
    row.coherence = Math.max(row.coherence, 4);
    row.usefulness = Math.max(row.usefulness, 4);
    row.engagement = Math.max(row.engagement, 4);
  }

  // Text comprehension progression
  if (/^g4r-text-/.test(row.id)) {
    row.coherence = Math.max(row.coherence, 4);
    row.usefulness = Math.max(row.usefulness, 4);
    row.engagement = Math.max(row.engagement, 4);
    row.diversity = 3;
  }

  // Legacy jungle-sub-1 solid subtraction story
  if (row.id === 'jungle-sub-1' && main.length >= 4) {
    row.coherence = Math.max(row.coherence, 4);
    row.usefulness = Math.max(row.usefulness, 4);
    row.engagement = Math.max(row.engagement, 4);
  }

  return row;
}

const results = [];
for (const meta of g4Meta) {
  const L = parseLesson(meta.id);
  results.push(applyWave9Nuance(buildG4(meta), L));
}
for (const meta of legMeta) {
  const L = parseLesson(meta.id);
  results.push(applyWave9Nuance(buildLegacy(meta), L));
}

if (results.length !== 51) {
  console.error('COUNT FAIL', results.length);
  process.exit(1);
}

const outPath = path.join(root, 'scripts/_audit_g4_legacy_final.json');
fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');

function avg(key) {
  return results.reduce((s, r) => s + r[key], 0) / results.length;
}
const withAvg = results.map((r) => ({
  ...r,
  avg: (r.coherence + r.usefulness + r.engagement + r.diversity) / 4,
}));
withAvg.sort((a, b) => a.avg - b.avg);
const weakest = withAvg.slice(0, 8).map((r) => ({
  id: r.id,
  avg: Number(r.avg.toFixed(2)),
  scores: `c${r.coherence}u${r.usefulness}e${r.engagement}d${r.diversity}`,
  verdict: r.verdict,
  problems: r.problems.slice(0, 2),
}));
const criticals = results.filter(
  (r) =>
    r.verdict === 'needs_rewrite' ||
    r.coherence <= 2 ||
    r.problems.some((p) => /✓ на|off-topic|Витрина ABA|не найден|Why\/bike drift/i.test(p.issue))
);

const summary = {
  count: results.length,
  averages: {
    coherence: Number(avg('coherence').toFixed(2)),
    usefulness: Number(avg('usefulness').toFixed(2)),
    engagement: Number(avg('engagement').toFixed(2)),
    diversity: Number(avg('diversity').toFixed(2)),
    overall: Number(((avg('coherence') + avg('usefulness') + avg('engagement') + avg('diversity')) / 4).toFixed(2)),
  },
  verdictCounts: results.reduce((a, r) => {
    a[r.verdict] = (a[r.verdict] || 0) + 1;
    return a;
  }, {}),
  weakest,
  criticals: criticals.map((r) => ({
    id: r.id,
    verdict: r.verdict,
    coherence: r.coherence,
    problems: r.problems,
  })),
  questL2: results.find((r) => r.id === 'g4e-quest-l2'),
};

fs.writeFileSync(path.join(root, 'scripts/_audit_g4_wave9_summary.json'), JSON.stringify(summary, null, 2), 'utf8');
console.log(JSON.stringify(summary, null, 2));
