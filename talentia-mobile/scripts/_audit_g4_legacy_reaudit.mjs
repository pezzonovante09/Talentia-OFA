/**
 * Post Phase 1–7 re-audit: g4 (36) + legacy (15) → _audit_g4_legacy_final.json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const g4Parsed = JSON.parse(fs.readFileSync(path.join(root, 'scripts/_audit_g4_parsed.json'), 'utf8'));
const legacyParsed = JSON.parse(fs.readFileSync(path.join(root, 'scripts/_audit_legacy_parsed.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8'));
const inv = JSON.parse(fs.readFileSync(path.join(root, 'scripts/_curriculum_audit_inventory.json'), 'utf8'));

/** Verified wrong ✓ or input expected answers in CURRENT grade-4-curriculum-ru.md */
const WRONG = {
  'g4m-cm-l1': [
    { n: 2, ref: 'g4m-cm-l1 q2', issue: '124×4=496, ✓ на 486', fix: '✓ на 496' },
    { n: 3, ref: 'g4m-cm-l1 q3', issue: '312×3=936, ✓ на 956', fix: '✓ на 936' },
  ],
  'g4m-cm-l2': [
    { n: 1, ref: 'g4m-cm-l2 q1', issue: '1346×5=6730, ✓ на 5730', fix: '✓ на 6 730' },
    { n: 2, ref: 'g4m-cm-l2 q2', issue: '2417×3=7251, ✓ на 7351', fix: '✓ на 7 251' },
    {
      n: 3,
      ref: 'g4m-cm-l2 q3',
      issue: '3208×6=19248, ✓ на 20248 («вот это да!»)',
      fix: '✓ на 19 248; убрать эмоциональный хвост из опции',
    },
  ],
  'g4m-cm-l3': [
    { n: 1, ref: 'g4m-cm-l3 q1', issue: '236×12=2832 (так в интро!), ✓ на 2732', fix: '✓ на 2 832' },
    { n: 3, ref: 'g4m-cm-l3 q3', issue: '418×13=5434, ✓ на 5834', fix: '✓ на 5 434' },
  ],
  'g4m-fr-l1': [
    { n: 2, ref: 'g4m-fr-l1 q2', issue: 'Закрашено 3 из 8 → 3/8; ✓ на 8/3', fix: '✓ на 3/8' },
    {
      n: 3,
      ref: 'g4m-fr-l1 q3',
      issue: 'Знаменатель = число равных частей целого; ✓ на «Сколько целых осталось»',
      fix: '✓ на «Сколько равных частей содержит целое»',
    },
  ],
  'g4m-fr-l2': [
    { n: 1, ref: 'g4m-fr-l2 q1', issue: 'Одна из четырёх = 1/4; ✓ на 4/1', fix: '✓ на 1/4' },
    { n: 3, ref: 'g4m-fr-l2 q3', issue: '1/2 = 2/4 — поровну; ✓ «Digit получил больше»', fix: '✓ на «поровну, равные дроби»' },
    {
      n: 4,
      ref: 'g4m-fr-l2 q4 input',
      issue: 'Input-ответ «4» при 5 секторах из 5 для целого круга',
      fix: 'Ожидаемый ответ: 5',
    },
  ],
  'g4m-fr-l3': [
    { n: 2, ref: 'g4m-fr-l3 q2', issue: '2/5 < 4/5; ✓ на >', fix: '✓ на <' },
    { n: 3, ref: 'g4m-fr-l3 q3', issue: 'От меньшей: 1/4,2/4,3/4; ✓ на обратный порядок', fix: '✓ на 1/4, 2/4, 3/4' },
  ],
  'g4r-conj-l3': [
    {
      n: 4,
      ref: 'g4r-conj-l3 q4 input',
      issue: 'Input-ответ «По» — усечён, не отвечает на вопрос о признаке II спряжения',
      fix: 'Полный ответ: «По окончанию -ить» / «Неопределённая форма на -ить»',
    },
  ],
  'g4r-text-l3': [
    {
      n: 3,
      ref: 'g4r-text-l3 q3',
      issue: 'Описание камня = тип «описание»; ✓ «рассуждение»',
      fix: '✓ на «описание»',
    },
  ],
  'g4e-pres-l2': [
    { n: 2, ref: 'g4e-pres-l2 q2', issue: 'He → doesn\'t play; ✓ на don\'t play', fix: '✓ на doesn\'t play' },
    { n: 3, ref: 'g4e-pres-l2 q3', issue: 'She → doesn\'t like; ✓ на «not like»', fix: '✓ на doesn\'t like' },
  ],
  'g4e-quest-l2': [
    { n: 1, ref: 'g4e-quest-l2 q1', issue: 'Нужно Where (где шляпа); ✓ на When', fix: '✓ на Where (где)' },
  ],
  'g4s-help-l2': [
    {
      n: 4,
      ref: 'g4s-help-l2 q4 input',
      issue: '«Поправь Тали!» — input-ответ «сейчас же» (ошибка Тали), нужно «пожалуйста»',
      fix: 'Ожидаемый ответ: пожалуйста',
    },
  ],
  'g4s-emo-l2': [
    {
      n: 4,
      ref: 'g4s-emo-l2 q4 input',
      issue: 'Петя злится (крик/бросил тетрадь); input-ответ «Да, он был рад» — ложно',
      fix: 'Ожидаемый ответ: Нет / злость',
    },
  ],
  'g4s-emo-l3': [
    {
      n: 3,
      ref: 'g4s-emo-l3 q3',
      issue: 'Глубокое дыхание = успокоение; ✓ «убегает»',
      fix: '✓ на «пытается успокоиться»',
    },
    {
      n: 4,
      ref: 'g4s-emo-l3 q4 input',
      issue: 'Input-ответ «Удивление бывает только неприятным» — ложное обобщение',
      fix: 'Примеры приятного и неприятного удивления',
    },
  ],
  'g4s-turn-l3': [
    {
      n: 1,
      ref: 'g4s-turn-l3 q1',
      issue: 'Подглядывание: лучше спокойно назвать правило; ✓ «Молчать и терпеть»',
      fix: '✓ на «Спокойно сказать: давайте соблюдать правила»',
    },
    {
      n: 2,
      ref: 'g4s-turn-l3 q2',
      issue: 'Правила для честности/интереса; ✓ «чтобы кто-то проиграл»',
      fix: '✓ на «чтобы игра была честной и интересной»',
    },
  ],
};

function getNested(obj, dotted) {
  let cur = obj;
  for (const p of dotted.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

function introKey(id, part) {
  return `data.intro.${id.replace(/-/g, '_')}_0_${part}`;
}

function dialogKey(id) {
  return `data.dialog.${id.replace(/-/g, '_')}_0`;
}

function clamp(n) {
  return Math.max(1, Math.min(5, Math.round(n)));
}

function scoreG4(L) {
  const wrong = WRONG[L.id] || [];
  const wrongN = wrong.length;
  const tasks = L._tasks || [];
  const hasInput = tasks.some((t) => t.type === 'input');
  const taliErr = tasks.filter((t) => /Тали/.test(t.prompt || '')).length;
  const longPrompts = tasks.filter((t) => (t.prompt || '').length > 220).length;

  let coherence = 4;
  let usefulness = 4;
  let engagement = 3.5;
  let diversity = hasInput ? 3 : 2;

  if (wrongN >= 3) {
    coherence = 1;
    usefulness = 2;
  } else if (wrongN === 2) {
    coherence = 2;
    usefulness = 3;
  } else if (wrongN === 1) {
    coherence = 3;
    usefulness = 3;
  }

  if (L.world === 'g4math') engagement = 4;
  if (L.world === 'g4social') engagement = 4;
  if (L.world === 'g4eng') engagement = 3.5;
  if (L.world === 'g4rus') engagement = 3.5;

  if (taliErr >= 3) engagement -= 0.5;
  if (longPrompts >= 2) engagement -= 0.5;
  if (wrongN) engagement -= 0.5;

  // Lessons with solid RU after fixes
  const strong = new Set([
    'g4m-md-l1',
    'g4m-md-l2',
    'g4m-md-l3',
    'g4r-conj-l1',
    'g4r-conj-l2',
    'g4r-cases-l1',
    'g4r-cases-l2',
    'g4r-cases-l3',
    'g4r-text-l1',
    'g4r-text-l2',
    'g4e-past-l1',
    'g4e-past-l2',
    'g4e-past-l3',
    'g4e-pres-l1',
    'g4e-pres-l3',
    'g4e-quest-l1',
    'g4e-quest-l3',
    'g4s-help-l1',
    'g4s-help-l3',
    'g4s-emo-l1',
    'g4s-turn-l1',
    'g4s-turn-l2',
  ]);
  if (!wrongN && strong.has(L.id)) {
    coherence = Math.max(coherence, 4);
    usefulness = Math.max(usefulness, 4);
  }
  if (!wrongN && L.id === 'g4m-md-l2') {
    coherence = 5;
    usefulness = 4;
    engagement = 4;
  }
  if (!wrongN && L.id === 'g4s-help-l1') {
    usefulness = 5;
    engagement = 4;
  }
  if (!wrongN && L.id === 'g4s-turn-l2') {
    usefulness = 5;
    engagement = 4;
  }
  if (L.id === 'g4m-cm-l2' || L.id === 'g4m-cm-l3') {
    engagement = 4;
  }
  if (L.id.startsWith('g4m-fr')) engagement += 0.2;

  return {
    coherence: clamp(coherence),
    usefulness: clamp(usefulness),
    engagement: clamp(engagement),
    diversity: clamp(diversity),
  };
}

function buildG4(L) {
  const wrong = WRONG[L.id] || [];
  const problems = [];
  const fixes = [];
  const enkyFlags = [];
  const templates = [];
  const tasks = L._tasks || [];
  const hasInput = tasks.some((t) => t.type === 'input');
  const mcCount = tasks.filter((t) => t.type === 'multiple_choice').length;
  const taliErr = tasks.filter((t) => /Тали/.test(t.prompt || '')).length;

  if (mcCount >= 3 && !hasInput) templates.push('mc_only_4');
  else if (hasInput && mcCount >= 2) templates.push('mc_plus_input');
  if (taliErr >= 2) templates.push('tali_error_frame');
  if (/клад|сейф|пицц|яблок|пекарн|динозавр/i.test(L._dialog || '')) templates.push('story_wrapper');
  templates.push('npc_tali_dialog_pair');

  const dk = dialogKey(L.id).replace(/^data\./, '');
  const enDialog = getNested(en, dialogKey(L.id));
  if (typeof enDialog === 'string' && /Hi! Lesson:/i.test(enDialog)) {
    enkyFlags.push('en_dialog_stub');
    problems.push({
      ref: `en.json ${dialogKey(L.id)}`,
      issue: 'EN-диалог — шаблон «Hi! Lesson: …»',
    });
    fixes.push('Перевести EN-диалог по смыслу RU (NPC-наставник + Tali-ученик)');
  }

  const enIntroBody = getNested(en, introKey(L.id, 'b'));
  const enIntroTitle = getNested(en, introKey(L.id, 't'));
  if (typeof enIntroBody === 'string' && /We'll recap what matters for «/i.test(enIntroBody)) {
    enkyFlags.push('en_intro_body_stub');
    problems.push({
      ref: `en.json ${introKey(L.id, 'b')}`,
      issue: 'EN intro body — шаблон «We\'ll recap what matters for «RU-title»» с RU-заголовком в кавычках',
    });
    fixes.push('Перевести EN intro body по смыслу RU-интро (2 карточки), без RU-заголовков');
  }
  if (typeof enIntroTitle === 'string' && /About this topic/i.test(enIntroTitle)) {
    enkyFlags.push('en_intro_title_stub');
    problems.push({
      ref: `en.json ${introKey(L.id, 't')}`,
      issue: 'EN intro title — шаблон «About this topic»',
    });
    fixes.push('Перевести EN intro title по смыслу RU');
  }

  for (const w of wrong) {
    problems.push({ ref: w.ref, issue: w.issue });
    fixes.push(w.fix);
  }

  for (const t of tasks) {
    if (t.options?.length) {
      const nCorrect = t.options.filter((o) => o.correct).length;
      if (nCorrect !== 1) {
        problems.push({
          ref: `${L.id} task${t.n}`,
          issue: `MC: ожидается 1 ✓, найдено ${nCorrect}`,
        });
      }
    }
    if ((t.prompt || '').length > 220) {
      problems.push({
        ref: `${L.id} task${t.n} prompt`,
        issue: `Длинный промпт (${t.prompt.length} симв.) — сюжетная обёртка затмевает вопрос`,
      });
      fixes.push('Сократить до 1–2 предложений контекста + чёткий вопрос');
      templates.push('long_story_prompt');
    }
  }

  if (!hasInput) {
    problems.push({
      ref: `worlds.ts ${L.id} tasks`,
      issue: 'Нет input/fill_blank — только выбор из готовых вариантов',
    });
    fixes.push('Добавить ≥1 продуктивное задание (input / fill_blank) на ключевой навык');
  }

  const scores = scoreG4(L);
  const avg = (scores.coherence + scores.usefulness + scores.engagement + scores.diversity) / 4;
  let verdict = 'ok';
  if (wrong.length >= 2 || scores.coherence <= 2) verdict = 'needs_rewrite';
  else if (wrong.length === 1 || avg < 3.75 || enkyFlags.length) verdict = 'needs_polish';

  const subjectMap = {
    math: 'math',
    reading_ru: 'russian',
    english: 'english',
    social: 'social',
  };

  return {
    id: L.id,
    grade: 4,
    subject: subjectMap[L.subject] || L.subject,
    world: L.world,
    title: L.title,
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

const SUBJECT_LEGACY = {
  jungle: 'math',
  canyon: 'reading',
  lab: 'science_logic',
  space: 'science',
};

function buildLegacy(L) {
  const invRow = inv.lessons.find((x) => x.id === L.id) || {};
  const problems = [];
  const fixes = [];
  const enkyFlags = invRow.enkyFlags || [];
  const templates = ['legacy_world', 'short_lesson'];
  let coherence = 4;
  let usefulness = 3;
  let engagement = 4;
  let diversity = 2;

  const types = L.uniqueTypes || [];
  const taskCount = L.taskCount || 0;

  if (types.length === 1 && types[0] === 'multiple_choice') {
    problems.push({ ref: `worlds.ts ${L.id}`, issue: 'Только multiple_choice' });
    fixes.push('Добавить input или image_point для разнообразия');
    diversity = 2;
  } else if (types.includes('input')) {
    diversity = 3;
  }

  if (taskCount <= 2) {
    problems.push({
      ref: `worlds.ts ${L.id}`,
      issue: `Очень короткий урок: ${taskCount} задания — мало для закрепления`,
    });
    fixes.push('Добавить 2–3 задания с нарастанием сложности');
    usefulness = 2;
    engagement = 3;
    templates.push('thin_lesson');
  }

  if (L.id === 'jungle-aba-showcase') {
    diversity = 5;
    usefulness = 4;
    coherence = 3;
    engagement = 4;
    problems.push({
      ref: 'worlds.ts jungle-aba-showcase',
      issue: 'Это витрина типов ABA (23 задания), не учебный урок с прогрессией навыка',
    });
    fixes.push('Вынести showcase из основного path или пометить как demo; для ученика — короткие skill-пакеты');
    templates.push('aba_type_showcase');
    enkyFlags.push('aba_dense');
    problems.push({
      ref: 'jungle-aba-showcase dialog',
      issue: 'Нет диалога/интро в данных — резкий старт в микс типов',
    });
    fixes.push('Добавить короткий dialog+intro: цель витрины ABA');
  }

  if (L.id === 'lab-animals-2') {
    problems.push({
      ref: 'data.tasks (lab-animals-2 t2) / q_logic_pattern_shapes',
      issue: 'Тема «животные», задание 2 — паттерн фигур (круг/квадрат), не про животных',
    });
    fixes.push('Заменить на вопрос про животное или вынести паттерн в lab-physics');
    coherence = 2;
    usefulness = 2;
    templates.push('off_topic_task');
  }

  if (L.id === 'lab-physics-1') {
    problems.push({
      ref: 'worlds.ts lab-physics-1',
      issue: 'Микс «весы» + «стороны треугольника» + «паттерн фигур» — слабая тема «физика/опыт»',
    });
    fixes.push('Собрать 3–4 задания вокруг баланса/массы; геометрию вынести отдельно');
    coherence = 2;
    usefulness = 3;
    engagement = 3;
    templates.push('topic_mishmash');
  }

  if (L.id === 'jungle-sub-2') {
    problems.push({
      ref: 'jungle-sub-2-t2',
      issue: 'Ряд 2,4,_,8 — это продолжение чётных/умножение, не вычитание (тема subtraction)',
    });
    fixes.push('Заменить на вычитание с переходом или сравнение остатков');
    coherence = 2;
    usefulness = 2;
    templates.push('off_topic_task');
  }

  if (L.id === 'canyon-words-1' || L.id === 'canyon-words-2') {
    problems.push({
      ref: `${L.id} tasks`,
      issue: 'Вопросы «Какое слово говорит „собака“?» при опциях dog/cat — путает метаязык (RU↔EN) для раннего чтения',
    });
    fixes.push('Формулировать «Найди слово … / Выбери правильное слово» + картинка');
    usefulness = taskCount <= 2 ? 2 : 3;
    engagement = 3;
  }

  if (L.id === 'canyon-sent-1') {
    problems.push({
      ref: 'data.tasks.q_match_picture',
      issue: 'Задание «картинка с собакой» без картинки в MC — опора на отсутствующий визуал',
    });
    fixes.push('Сделать image_word_match или убрать отсылку к картинке');
    coherence = 3;
  }

  if (L.id.startsWith('space-')) {
    usefulness = Math.max(usefulness, 4);
    engagement = 4;
    if (taskCount <= 2) usefulness = 3;
  }

  if (L.id === 'space-solar-1') {
    problems.push({
      ref: "space-sol-1-t3 answer: 'orbit'",
      issue: 'Input-ответ на английском «orbit» при RU UI — барьер для русскоязычного ребёнка',
    });
    fixes.push('Принять «орбита»/«orbit» или сделать MC');
    coherence = 3;
    templates.push('lang_mismatch_answer');
  }

  if (L.id === 'jungle-add-1') {
    usefulness = 4;
    coherence = 4;
    engagement = 4;
    problems.push({
      ref: 'jungle-add-1 tasks',
      issue: 'Счёт бананов/яблок без visualCount в части вопросов — вопрос «сколько здесь» требует визуала',
    });
    fixes.push('Проверить visualEmoji/visualCount на всех count-заданиях');
  }

  const avg = (coherence + usefulness + engagement + diversity) / 4;
  let verdict = 'ok';
  if (coherence <= 2 || usefulness <= 2) verdict = 'needs_rewrite';
  else if (avg < 3.5 || taskCount <= 2) verdict = 'needs_polish';
  if (L.id === 'jungle-aba-showcase') verdict = 'needs_polish';

  return {
    id: L.id,
    grade: 'legacy',
    subject: SUBJECT_LEGACY[L.world] || L.world,
    world: L.world,
    title: L.titleRu || invRow.title || L.id,
    coherence: clamp(coherence),
    usefulness: clamp(usefulness),
    engagement: clamp(engagement),
    diversity: clamp(diversity),
    verdict,
    problems,
    fixes: [...new Set(fixes)],
    enkyFlags: [...new Set(enkyFlags)],
    templates: [...new Set(templates)],
  };
}

const out = [...g4Parsed.map(buildG4), ...legacyParsed.map(buildLegacy)];

// Order: g4 first (as in curriculum), then legacy (inventory order)
const g4Order = g4Parsed.map((x) => x.id);
const legOrder = legacyParsed.map((x) => x.id);
const order = [...g4Order, ...legOrder];
out.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));

const outPath = path.join(root, 'scripts/_audit_g4_legacy_final.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));

const dims = ['coherence', 'usefulness', 'engagement', 'diversity'];
const avgs = Object.fromEntries(
  dims.map((d) => [d, +(out.reduce((s, r) => s + r[d], 0) / out.length).toFixed(2)])
);
const coherenceLt4 = out.filter((r) => r.coherence < 4).length;
const verdicts = out.reduce((a, r) => {
  a[r.verdict] = (a[r.verdict] || 0) + 1;
  return a;
}, {});

console.log(JSON.stringify({ count: out.length, avgs, coherenceLt4, verdicts }, null, 2));
