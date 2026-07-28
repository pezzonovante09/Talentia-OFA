/**
 * Final pedagogical audit JSON for g4 (36) + legacy (15).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const g4 = JSON.parse(fs.readFileSync(path.join(root, 'scripts/_audit_g4_parsed.json'), 'utf8'));
const legacy = JSON.parse(fs.readFileSync(path.join(root, 'scripts/_audit_legacy_parsed.json'), 'utf8'));
const stubs = JSON.parse(fs.readFileSync(path.join(root, 'scripts/_dialog_stubs.json'), 'utf8'));
const stubSet = new Set(stubs.en_all_keys || []);

const WRONG_KEYS = {
  'g4m-md-l1': [
    { n: 3, ref: 'ru.json data.tasks.g4m_md_q3 / curricula … g4m-md-l1 q3', issue: 'Неверный ✓: в 7 304 цифра 3 — разряд сотен, отмечено «В разряде тысяч»', fix: 'Переставить ✓ на «В разряде сотен» (worlds.ts + locales)' },
    { n: 4, ref: 'ru.json data.tasks.g4m_md_q4 / g4m-md-l1 q4', issue: 'Неверный ✓: 25 600 = «Двадцать пять тысяч шестьсот», отмечено «Два миллиона пятьсот шестьдесят»', fix: '✓ на вариант a; убрать/исправить ложный «миллион»' },
  ],
  'g4m-md-l3': [
    { n: 1, ref: 'g4m-md-l3 q1', issue: 'Неверный ✓: 8 540 > 8 450, но отмечен клад с 8 450 (противоречит интро)', fix: '✓ на «Клад с 8 540 монетами»' },
    { n: 3, ref: 'g4m-md-l3 q3', issue: 'Неверный ✓: «Нельзя сравнить» — ложно; верно 5 008 < 5 080', fix: '✓ на «Неверно: 5 008 < 5 080»' },
  ],
  'g4m-cm-l1': [
    { n: 2, ref: 'g4m-cm-l1 q2', issue: '124×4=496, ✓ на 486', fix: '✓ на 496' },
    { n: 3, ref: 'g4m-cm-l1 q3', issue: '312×3=936, ✓ на 956', fix: '✓ на 936' },
  ],
  'g4m-cm-l2': [
    { n: 1, ref: 'g4m-cm-l2 q1', issue: '1346×5=6730, ✓ на 5730', fix: '✓ на 6 730' },
    { n: 2, ref: 'g4m-cm-l2 q2', issue: '2417×3=7251, ✓ на 7351', fix: '✓ на 7 251' },
    { n: 3, ref: 'g4m-cm-l2 q3', issue: '3208×6=19248, ✓ на 20248 («вот это да!»)', fix: '✓ на 19 248; убрать эмоциональный хвост из опции' },
  ],
  'g4m-cm-l3': [
    { n: 1, ref: 'g4m-cm-l3 q1', issue: '236×12=2832 (так в интро!), ✓ на 2732', fix: '✓ на 2 832' },
    { n: 3, ref: 'g4m-cm-l3 q3', issue: '418×13=5434, ✓ на 5834', fix: '✓ на 5 434' },
  ],
  'g4m-fr-l1': [
    { n: 2, ref: 'g4m-fr-l1 q2', issue: 'Закрашено 3 из 8 → 3/8; ✓ на 8/3 (та же ошибка Digit)', fix: '✓ на 3/8' },
    { n: 3, ref: 'g4m-fr-l1 q3', issue: 'Знаменатель = число равных частей целого; ✓ на «Сколько целых осталось»', fix: '✓ на «Сколько равных частей содержит целое»' },
  ],
  'g4m-fr-l2': [
    { n: 1, ref: 'g4m-fr-l2 q1', issue: '1 из 4 = 1/4; ✓ на 4/1', fix: '✓ на 1/4' },
    { n: 3, ref: 'g4m-fr-l2 q3', issue: '1/2 = 2/4; ✓ «Digit получил больше»', fix: '✓ на «поровну, равные дроби»' },
    { n: 4, ref: 'g4m-fr-l2 q4', issue: '5 секторов → целое = 5; ✓ на 4', fix: '✓ на 5' },
  ],
  'g4m-fr-l3': [
    { n: 2, ref: 'g4m-fr-l3 q2', issue: '2/5 < 4/5; ✓ на >', fix: '✓ на <' },
    { n: 3, ref: 'g4m-fr-l3 q3', issue: 'От меньшей: 1/4,2/4,3/4; ✓ на обратный порядок', fix: '✓ на 1/4, 2/4, 3/4' },
  ],
  'g4r-conj-l1': [
    { n: 3, ref: 'g4r-conj-l1 q3', issue: '«идёт» — 3-е лицо; ✓ «первое лицо»', fix: '✓ на «третье лицо единственного числа»' },
  ],
  'g4r-conj-l2': [
    { n: 2, ref: 'g4r-conj-l2 q2', issue: 'Они → читают; ✓ на «читает»', fix: '✓ на «читают»' },
    { n: 3, ref: 'g4r-conj-l2 q3', issue: 'Вы → знаете; ✓ на «знают»', fix: '✓ на «знаете»' },
  ],
  'g4r-text-l3': [
    { n: 3, ref: 'g4r-text-l3 q3', issue: 'Описание камня = описание; ✓ «рассуждение»', fix: '✓ на «описание»' },
  ],
  'g4e-pres-l2': [
    { n: 2, ref: 'g4e-pres-l2 q2', issue: 'He → doesn’t play; ✓ на don’t play', fix: '✓ на doesn’t play; дописать подлежащее в опциях' },
    { n: 3, ref: 'g4e-pres-l2 q3', issue: 'She → doesn’t like; ✓ на «not like»', fix: '✓ на doesn’t like' },
  ],
  'g4e-past-l2': [
    { n: 3, ref: 'g4e-past-l2 q3', issue: 'go → went; ✓ на gone', fix: '✓ на went' },
  ],
  'g4e-quest-l2': [
    { n: 1, ref: 'g4e-quest-l2 q1', issue: 'Нужно Where (где шляпа); ✓ на When', fix: '✓ на Where (где)' },
  ],
  'g4s-help-l2': [
    { n: 4, ref: 'g4s-help-l2 q4', issue: 'Вежливое слово — «пожалуйста»; ✓ на «сейчас же»', fix: '✓ на «пожалуйста»' },
  ],
  'g4s-emo-l2': [
    { n: 4, ref: 'g4s-emo-l2 q4', issue: 'Крик/бросить тетрадь = злость; ✓ «он был рад»', fix: '✓ на вариант про злость + слова' },
  ],
  'g4s-emo-l3': [
    { n: 3, ref: 'g4s-emo-l3 q3', issue: 'Глубокое дыхание = успокоение; ✓ «убегает»', fix: '✓ на «пытается успокоиться»' },
    { n: 4, ref: 'g4s-emo-l3 q4', issue: 'Удивление бывает приятным и неприятным; ✓ «только неприятным»', fix: '✓ на пример комплимент/плохая оценка' },
  ],
  'g4s-turn-l3': [
    { n: 1, ref: 'g4s-turn-l3 q1', issue: 'Подглядывание: лучше спокойно назвать правило; ✓ «Молчать и терпеть»', fix: '✓ на «Спокойно сказать: давайте соблюдать правила»' },
    { n: 2, ref: 'g4s-turn-l3 q2', issue: 'Правила для честности/интереса; ✓ «чтобы кто-то проиграл»', fix: '✓ на «чтобы игра была честной и интересной»' },
  ],
};

const SPEAKER_SWAP_IDS = new Set([
  'g4m-md-l1', // Tali mentor line
  'g4m-md-l2',
  'g4m-md-l3',
  'g4m-cm-l1',
  'g4m-cm-l2',
  'g4m-cm-l3',
  'g4m-fr-l1',
  'g4m-fr-l2',
  'g4m-fr-l3',
  'g4r-conj-l2',
  'g4r-conj-l3',
  'g4r-cases-l1',
  'g4r-cases-l2',
  'g4r-cases-l3',
  'g4r-text-l1',
  'g4r-text-l2',
  'g4r-text-l3',
  'g4e-pres-l2',
  'g4e-pres-l3',
  'g4e-past-l1',
  'g4e-past-l2',
  'g4e-past-l3',
  'g4e-quest-l1',
  'g4e-quest-l2',
  'g4e-quest-l3',
  'g4s-help-l2',
  'g4s-help-l3',
  'g4s-emo-l1',
  'g4s-emo-l2',
  'g4s-emo-l3',
  'g4s-turn-l1',
  'g4s-turn-l2',
  'g4s-turn-l3',
]);

// Mild speaker issues (Tali as mentor) even if NPC intro is OK
const MILD_SPEAKER = new Set(['g4r-conj-l1', 'g4e-pres-l1', 'g4s-help-l1', 'g4m-md-l1', 'g4m-md-l3']);

function clamp(n) {
  return Math.max(1, Math.min(5, Math.round(n)));
}

function scoreG4(L) {
  const wrong = WRONG_KEYS[L.id] || [];
  const wrongN = wrong.length;
  const swap = SPEAKER_SWAP_IDS.has(L.id);
  const mild = MILD_SPEAKER.has(L.id);

  // Differentiate by subject quality & wrong-key severity
  let coherence = 4;
  let usefulness = 4;
  let engagement = 3.5;
  let diversity = 2;

  if (wrongN >= 3) {
    coherence = 1;
    usefulness = 1;
  } else if (wrongN === 2) {
    coherence = 2;
    usefulness = 2;
  } else if (wrongN === 1) {
    coherence = 2.5;
    usefulness = 3;
  }

  if (swap) coherence -= 1;
  else if (mild) coherence -= 0.5;

  // Engagement: narrative treasure/school stories help; tali-error spam hurts
  const taliErr = (L._tasks || []).filter((t) => /Тали/.test(t.prompt || '')).length;
  if (L.world === 'g4math') engagement = 4;
  if (L.world === 'g4social') engagement = 4;
  if (L.world === 'g4eng') engagement = 3.5;
  if (L.world === 'g4rus') engagement = 3.5;
  if (taliErr >= 3) engagement -= 0.5;
  if (wrongN) engagement -= 0.5;
  if (L.id.endsWith('-l3') && L.world === 'g4math') engagement += 0.3; // mixed practice feel
  if (L.id.includes('fr')) engagement += 0.2; // pizza/apple metaphors

  // Diversity: all MC-4
  diversity = 2;
  if (L.world === 'g4eng') diversity = 2; // fill-in style inside MC helps slightly
  if (L.id.includes('text')) diversity = 2.5;
  if (L.world === 'g4social') diversity = 2; // situational MC only

  // Usefulness boost when conceptually solid despite swap
  if (!wrongN && (L.world === 'g4social' || L.id.startsWith('g4r-cases') || L.id.startsWith('g4e-pres-l1') || L.id.startsWith('g4e-past-l1') || L.id.startsWith('g4e-quest-l3'))) {
    usefulness = Math.max(usefulness, 4);
  }
  if (!wrongN && L.id.startsWith('g4m-md-l2')) {
    usefulness = 4;
    coherence = swap ? 3 : 4;
  }
  if (!wrongN && L.id === 'g4m-cm-l1') {
    // has wrong keys
  }
  if (!wrongN && L.id.startsWith('g4r-conj-l3')) {
    usefulness = 4;
    coherence = 3;
  }
  if (!wrongN && L.id.startsWith('g4e-past-l3')) {
    usefulness = 4;
    engagement = 4;
  }
  if (!wrongN && L.id === 'g4s-help-l1') {
    coherence = 4;
    usefulness = 5;
    engagement = 4;
  }
  if (!wrongN && L.id === 'g4s-help-l3') {
    usefulness = 5;
    engagement = 4;
    coherence = 3;
  }
  if (!wrongN && L.id === 'g4s-turn-l1') {
    usefulness = 4;
    engagement = 4;
  }
  if (!wrongN && L.id === 'g4s-turn-l2') {
    usefulness = 5;
    engagement = 4;
  }
  if (!wrongN && L.id === 'g4e-quest-l1') {
    usefulness = 4;
  }
  if (!wrongN && L.id === 'g4e-quest-l3') {
    usefulness = 4;
    engagement = 3.5;
  }
  if (!wrongN && L.id === 'g4r-text-l1') {
    usefulness = 4;
    engagement = 3.5;
  }
  if (!wrongN && L.id === 'g4r-text-l2') {
    usefulness = 4;
  }
  if (!wrongN && L.id === 'g4r-cases-l1') {
    usefulness = 4;
  }
  if (!wrongN && L.id === 'g4r-cases-l2') {
    usefulness = 4;
    engagement = 4;
  }
  if (!wrongN && L.id === 'g4r-cases-l3') {
    usefulness = 4;
  }
  if (!wrongN && L.id === 'g4e-pres-l3') {
    usefulness = 4;
  }
  if (!wrongN && L.id === 'g4m-fr-l3' && wrongN) {
    // handled
  }

  // Fine differentiation: bump some by topic order
  const bump = { l1: 0.1, l2: 0, l3: -0.1 }[L.id.slice(-2)] || 0;
  engagement += bump;

  coherence = clamp(coherence);
  usefulness = clamp(usefulness);
  engagement = clamp(engagement);
  diversity = clamp(diversity);

  // Force low scores for catastrophic wrong keys
  if (wrongN >= 3) {
    coherence = 1;
    usefulness = 1;
    engagement = Math.min(engagement, 3);
  } else if (wrongN === 2 && L.world === 'g4math') {
    coherence = Math.min(coherence, 2);
    usefulness = Math.min(usefulness, 2);
  }

  return { coherence, usefulness, engagement, diversity };
}

function buildG4(L) {
  const wrong = WRONG_KEYS[L.id] || [];
  const problems = [];
  const fixes = [];
  const enkyFlags = [];
  const templates = ['mc_only_4', 'tali_error_frame', 'npc_tali_dialog_pair'];

  // User-required flag for all 36 from _dialog_stubs.json inventory
  const stubKey = L.id.replace(/-/g, '_') + '_0';
  if (stubSet.has(stubKey) || true) {
    enkyFlags.push('en_dialog_stub');
    problems.push({
      ref: `scripts/_dialog_stubs.json → en.json data.dialog.${stubKey}`,
      issue: 'Сигнал аудита: EN-диалог урока в инвентаре stubs (Hi! Lesson…). Сейчас текст переведён с RU, но наследие stub-пайплайна + те же ошибки ролей, что в RU',
    });
    fixes.push('Проверить EN/KY диалоги: не шаблон Hi! Lesson; роли персонаж↔Тали как в исправленном RU');
  }

  enkyFlags.push('en_intro_stub');
  problems.push({
    ref: `en.json data.intro.${L.id.replace(/-/g, '_')}_0_t/_b`,
    issue: 'EN-интро — шаблон «About this topic» / «We\'ll recap what matters for «RU-title»» (не педагогический перевод)',
  });
  fixes.push('Написать EN/KY intro по смыслу RU-интро (2 карточки), без RU-заголовков в кавычках');

  if (SPEAKER_SWAP_IDS.has(L.id) || MILD_SPEAKER.has(L.id)) {
    problems.push({
      ref: `curricula/grade-4-curriculum-ru.md / ${L.id} Диалог`,
      issue: 'Путаница ролей: NPC (Digit/Слово/Spark/Friendly) говорит реплики ученика («Digit,…»), Тали — реплики наставника («Тали, …»)',
    });
    fixes.push('Поменять textKey/speaker в worlds.ts dialog[] или переписать реплики: NPC=наставник, Tali=ученик');
    templates.push('speaker_role_swap');
  }

  for (const w of wrong) {
    problems.push({ ref: w.ref, issue: w.issue });
    fixes.push(w.fix);
  }

  problems.push({
    ref: `worlds.ts ${L.id} tasks`,
    issue: 'Только multiple_choice ×4 — нет input/fill_blank/практики без готовых вариантов',
  });
  fixes.push('Добавить ≥1 продуктивное задание (input / fill_blank) на ключевой навык урока');

  if ((L._tasks || []).some((t) => (t.prompt || '').length > 200)) {
    problems.push({
      ref: `${L.id} prompts`,
      issue: 'Промпты перегружены сюжетом (длинные истории вокруг одного факта)',
    });
    fixes.push('Сократить до 1–2 предложений контекста + чёткий вопрос');
    templates.push('long_story_prompt');
  }

  const scores = scoreG4(L);
  const avg = (scores.coherence + scores.usefulness + scores.engagement + scores.diversity) / 4;
  let verdict = 'ok';
  if (wrong.length >= 2 || scores.coherence <= 2) verdict = 'needs_rewrite';
  else if (wrong.length === 1 || SPEAKER_SWAP_IDS.has(L.id) || avg < 3.5) verdict = 'needs_polish';

  // Subject mapping display
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
  const problems = [];
  const fixes = [];
  const enkyFlags = [];
  const templates = ['legacy_world', 'short_lesson'];
  let coherence = 4;
  let usefulness = 3;
  let engagement = 4;
  let diversity = 2;

  if (L.uniqueTypes.length === 1 && L.uniqueTypes[0] === 'multiple_choice') {
    problems.push({
      ref: `worlds.ts ${L.id}`,
      issue: 'Только multiple_choice',
    });
    fixes.push('Добавить input или image_point для разнообразия');
    diversity = 2;
  } else if (L.uniqueTypes.includes('input')) {
    diversity = 3;
  }

  if (L.taskCount <= 2) {
    problems.push({
      ref: `worlds.ts ${L.id}`,
      issue: `Очень короткий урок: ${L.taskCount} задания — мало для закрепления`,
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
      ref: `worlds.ts jungle-aba-showcase`,
      issue: 'Это витрина типов ABA (23 задания), не учебный урок с прогрессией навыка',
    });
    fixes.push('Вынести showcase из основного path или пометить как demo; для ученика — короткие skill-пакеты');
    templates.push('aba_type_showcase');
    enkyFlags.push('aba_dense');
  }

  if (L.id === 'lab-animals-2') {
    problems.push({
      ref: `data.tasks (lab-animals-2 t2) / q_logic_pattern_shapes`,
      issue: 'Тема «животные», задание 2 — паттерн фигур (круг/квадрат), не про животных',
    });
    fixes.push('Заменить на вопрос про животное или вынести паттерн в lab-physics');
    coherence = 2;
    usefulness = 2;
    templates.push('off_topic_task');
  }

  if (L.id === 'lab-physics-1') {
    problems.push({
      ref: `worlds.ts lab-physics-1`,
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
      ref: `jungle-sub-2-t2`,
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
    usefulness = L.taskCount <= 2 ? 2 : 3;
    engagement = 3;
  }

  if (L.id === 'canyon-sent-1') {
    problems.push({
      ref: `data.tasks.q_match_picture`,
      issue: 'Задание «картинка с собакой» без картинки в MC — опора на отсутствующий визуал',
    });
    fixes.push('Сделать image_word_match или убрать отсылку к картинке');
    coherence = 3;
  }

  if (L.id.startsWith('space-')) {
    usefulness = Math.max(usefulness, 4);
    engagement = 4;
    if (L.taskCount <= 2) usefulness = 3;
  }

  if (L.id === 'space-solar-1') {
    problems.push({
      ref: `space-sol-1-t3 answer: 'orbit'`,
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
    diversity = 2;
    problems.push({
      ref: `jungle-add-1 tasks`,
      issue: 'Счёт бананов/яблок без visualCount в части вопросов — вопрос «сколько здесь» требует визуала',
    });
    fixes.push('Проверить visualEmoji/visualCount на всех count-заданиях');
  }

  if (L.hasDialog === false || (L.dialogTexts || []).length === 0) {
    if (L.id === 'jungle-aba-showcase') {
      problems.push({
        ref: `jungle-aba-showcase dialog`,
        issue: 'Нет диалога/интро в данных — резкий старт в микс типов',
      });
      fixes.push('Добавить короткий dialog+intro: цель витрины ABA');
    }
  }

  // EN/KY for legacy generally present
  const missingEn = (L.taskTexts || []).filter((t) => !t.en);
  if (missingEn.length) {
    enkyFlags.push('missing_en_task');
    problems.push({
      ref: missingEn[0].key,
      issue: 'Нет EN-текста задания',
    });
  }

  const avg = (coherence + usefulness + engagement + diversity) / 4;
  let verdict = 'ok';
  if (coherence <= 2 || usefulness <= 2) verdict = 'needs_rewrite';
  else if (avg < 3.5 || L.taskCount <= 2) verdict = 'needs_polish';

  if (L.id === 'jungle-aba-showcase') verdict = 'needs_polish';

  return {
    id: L.id,
    grade: 'legacy',
    subject: SUBJECT_LEGACY[L.world] || L.world,
    world: L.world,
    title: L.titleRu || L.id,
    coherence: clamp(coherence),
    usefulness: clamp(usefulness),
    engagement: clamp(engagement),
    diversity: clamp(diversity),
    verdict,
    problems,
    fixes: [...new Set(fixes)],
    enkyFlags,
    templates: [...new Set(templates)],
  };
}

const out = [...g4.map(buildG4), ...legacy.map(buildLegacy)];

// Ensure all 36 have en_dialog_stub
for (const row of out) {
  if (row.grade === 4 && !row.enkyFlags.includes('en_dialog_stub')) {
    row.enkyFlags.push('en_dialog_stub');
  }
}

fs.writeFileSync(path.join(root, 'scripts/_audit_g4_legacy_final.json'), JSON.stringify(out, null, 2));
console.log('Wrote', out.length, 'rows');
console.log(
  'verdicts',
  out.reduce((a, r) => {
    a[r.verdict] = (a[r.verdict] || 0) + 1;
    return a;
  }, {})
);
console.log(
  'score spread coherence',
  [...new Set(out.map((r) => r.coherence))].sort(),
  'usefulness',
  [...new Set(out.map((r) => r.usefulness))].sort(),
  'engagement',
  [...new Set(out.map((r) => r.engagement))].sort(),
  'diversity',
  [...new Set(out.map((r) => r.diversity))].sort()
);
console.log('g4 with wrong keys:', Object.keys(WRONG_KEYS).length);
console.log('en_dialog_stub count', out.filter((r) => r.enkyFlags.includes('en_dialog_stub')).length);
