/**
 * Fresh methodological audit: g4 (36) + legacy (15) → _audit_g4_legacy_final.json
 * Do NOT copy old scores. Verify live EN stubs + arithmetic (cm/fr).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const md = fs.readFileSync(path.join(root, 'curricula/grade-4-curriculum-ru.md'), 'utf8');
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8'));
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));
const ky = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ky.json'), 'utf8'));
const g4Ids = JSON.parse(fs.readFileSync(path.join(root, 'scripts/_reaudit2_ids_g4.json'), 'utf8'));
const legIds = JSON.parse(fs.readFileSync(path.join(root, 'scripts/_reaudit2_ids_glegacy.json'), 'utf8'));
const worldsSrc = fs.readFileSync(path.join(root, 'src/data/worlds.ts'), 'utf8');

function getNested(obj, dotted) {
  let cur = obj;
  for (const p of dotted.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

function clamp(n) {
  return Math.max(1, Math.min(5, Math.round(n)));
}

function t(key) {
  if (!key) return '';
  return getNested(ru, key) ?? `<MISSING:${key}>`;
}

// ---- Parse g4 MD ----
const lines = md.split(/\r?\n/);
const lessons = [];
let currentWorld = null;
let currentSubject = null;
let currentTheme = null;
let i = 0;
const subjectMap = { g4math: 'math', g4rus: 'reading_ru', g4eng: 'english', g4social: 'social' };

while (i < lines.length) {
  const line = lines[i];
  if (line.startsWith('### ')) {
    let j = i + 1;
    while (j < lines.length && !lines[j].trim()) j++;
    const wm = (lines[j] || '').match(/\*\*Мир:\*\*\s*`([^`]+)`/);
    if (wm) {
      currentWorld = wm[1];
      currentSubject = subjectMap[currentWorld] || 'unknown';
    }
  }
  if (line.startsWith('#### Тема:')) currentTheme = line.slice('#### Тема:'.length).trim();
  if (line.startsWith('##### Урок:')) {
    const title = line.slice('##### Урок:'.length).trim();
    i++;
    while (i < lines.length && !lines[i].trim()) i++;
    const idMatch = (lines[i] || '').match(/`([^`]+)`/);
    const id = idMatch ? idMatch[1] : null;
    i++;
    const block = [];
    while (i < lines.length) {
      if (
        lines[i].startsWith('##### Урок:') ||
        lines[i].startsWith('#### Тема:') ||
        (lines[i].startsWith('### ') && !lines[i].startsWith('### Правка'))
      ) {
        break;
      }
      block.push(lines[i]);
      i++;
    }
    const text = block.join('\n');
    const dialog = (text.match(/\*\*Диалог:\*\*\n([\s\S]*?)(?=\n\*\*Интро|\n\*\*Задания:)/) || [])[1]?.trim() || '';
    const intro = (text.match(/\*\*Интро[^*]*\*\*:\*\*\n([\s\S]*?)(?=\n\*\*Задания:)/) || [])[1]?.trim() || '';
    const tasksRaw = (text.match(/\*\*Задания:\*\*\n([\s\S]*)$/) || [])[1]?.trim() || '';
    const tasks = [];
    for (const tb of tasksRaw.split(/(?=^\d+\. \*\*)/m).filter((x) => x.trim())) {
      const header = tb.match(/^(\d+)\. \*\*([^*]+)\*\*(?:\s*—\s*)?([^\n]*)/);
      if (!header) continue;
      const n = Number(header[1]);
      const type = header[2].replace(/\s*\[ABA\]\s*/g, '').trim();
      const prompt = header[3].trim();
      const options = [];
      const optRe = /-\s*`([^`]+)`:\s*([^\n]+)/g;
      let om;
      while ((om = optRe.exec(tb))) {
        const raw = om[2].trim();
        options.push({
          key: om[1],
          text: raw.replace(/\s*✓\s*$/, '').trim(),
          correct: raw.includes('✓'),
        });
      }
      const ansM = tb.match(/_\(ответ:\s*([^)]+)\)_/);
      tasks.push({ n, type, prompt, options, answerHint: ansM ? ansM[1].trim() : null });
    }
    lessons.push({
      id,
      title,
      theme: currentTheme,
      world: currentWorld,
      subject: currentSubject,
      dialog,
      intro,
      tasks,
    });
    continue;
  }
  i++;
}

const idSet = new Set(g4Ids.map((x) => x.id));
const g4Lessons = lessons.filter((L) => idSet.has(L.id));
if (g4Lessons.length !== 36) {
  console.warn('Expected 36 g4 lessons, got', g4Lessons.length);
}

// ---- Wrong-answer verification (strict, current MD) ----
const WRONG = {};
function addWrong(id, n, issue, fix) {
  if (!WRONG[id]) WRONG[id] = [];
  if (WRONG[id].some((w) => w.n === n && w.issue === issue)) return;
  WRONG[id].push({ n, ref: `${id} q${n}`, issue, fix });
}

function parseNum(s) {
  const m = String(s)
    .replace(/\s/g, '')
    .replace(/—.*$/, '')
    .match(/-?\d+/);
  return m ? Number(m[0]) : NaN;
}

for (const L of g4Lessons.filter((l) => l.world === 'g4math')) {
  for (const t of L.tasks) {
    if (t.type !== 'multiple_choice') continue;
    const correct = t.options.find((o) => o.correct);
    if (!correct) {
      addWrong(L.id, t.n, 'Нет отмеченного ✓', 'Отметить верный вариант');
      continue;
    }
    const mm = t.prompt.match(/(\d[\d\s]*)\s*[×xX]\s*(\d[\d\s]*)\s*=/);
    if (mm) {
      const a = parseNum(mm[1]);
      const b = parseNum(mm[2]);
      const exp = a * b;
      const got = parseNum(correct.text);
      if (!Number.isNaN(got) && got !== exp) {
        addWrong(L.id, t.n, `${a}×${b}=${exp}, ✓ на ${got}`, `✓ на ${exp.toLocaleString('ru-RU')}`);
      }
    }
  }
}

// Explicit conceptual / fraction / language wrongs verified against current MD
const explicitChecks = [
  // fractions
  ['g4m-fr-l1', 2, (t, c) => /8\/3/.test(c.text) && /3\s+части?\s+из\s+8|3 части из 8/i.test(t.prompt), 'Закрашено 3 из 8 → 3/8; ✓ на 8/3', '✓ на 3/8'],
  [
    'g4m-fr-l1',
    3,
    (t, c) => /Сколько целых осталось/i.test(c.text),
    'Знаменатель = число равных частей целого; ✓ на «Сколько целых осталось»',
    '✓ на «Сколько равных частей содержит целое»',
  ],
  ['g4m-fr-l2', 1, (t, c) => /^4\/1$/.test(c.text.trim()), 'Одна из четырёх = 1/4; ✓ на 4/1', '✓ на 1/4'],
  [
    'g4m-fr-l2',
    3,
    (t, c) => /Digit получил больше/i.test(c.text),
    '1/2 = 2/4 — поровну; ✓ «Digit получил больше»',
    '✓ на «поровну, равные дроби»',
  ],
  ['g4m-fr-l2', 4, (t) => t.type === 'input' && t.answerHint === '4', 'Input-ответ «4» при 5 секторах для целого круга', 'Ожидаемый ответ: 5'],
  ['g4m-fr-l3', 2, (t, c) => /^>\s*\(больше\)/.test(c.text) || c.text.trim() === '>', '2/5 < 4/5; ✓ на >', '✓ на <'],
  [
    'g4m-fr-l3',
    3,
    (t, c) => /^3\/4,\s*2\/4,\s*1\/4/.test(c.text.trim()),
    'От меньшей: 1/4,2/4,3/4; ✓ на обратный порядок',
    '✓ на 1/4, 2/4, 3/4',
  ],
];

for (const [id, n, pred, issue, fix] of explicitChecks) {
  const L = g4Lessons.find((x) => x.id === id);
  const task = L?.tasks.find((x) => x.n === n);
  if (!task) continue;
  const c = task.options.find((o) => o.correct) || { text: '' };
  if (pred(task, c)) addWrong(id, n, issue, fix);
}

// Broader content checks from MD prompts
for (const L of g4Lessons) {
  for (const task of L.tasks) {
    const c = task.options.find((o) => o.correct);
    const ans = task.answerHint || '';

    if (L.id === 'g4m-md-l1' && task.n === 3 && /7\s*304/.test(task.prompt) && c) {
      if (/тысяч/.test(c.text) && !/сотен/.test(c.text)) {
        addWrong(L.id, task.n, `В 7 304 цифра 3 — разряд сотен; ✓ «${c.text}»`, '✓ на «В разряде сотен»');
      }
    }
    if (L.id === 'g4m-md-l1' && task.n === 4 && /25\s*600/.test(task.prompt) && c) {
      if (!/Двадцать пять тысяч шестьсот/i.test(c.text)) {
        addWrong(L.id, task.n, `25 600: ✓ «${c.text}» вместо «Двадцать пять тысяч шестьсот»`, '✓ на правильное чтение');
      }
    }
    if (L.id === 'g4m-md-l3' && task.n === 1 && /8\s*450/.test(task.prompt) && /8\s*540/.test(task.prompt) && c) {
      if (/8\s*450/.test(c.text) && !/8\s*540/.test(c.text)) {
        addWrong(L.id, task.n, '8 540 > 8 450, но ✓ на клад с 8 450', '✓ на «Клад с 8 540»');
      }
    }
    if (L.id === 'g4m-md-l3' && task.n === 3 && /5\s*008/.test(task.prompt) && /5\s*080/.test(task.prompt) && c) {
      if (/Нельзя сравнить/i.test(c.text)) {
        addWrong(L.id, task.n, '✓ «Нельзя сравнить» — ложно; 5 008 < 5 080', '✓ на верное сравнение');
      }
    }

    if (L.id === 'g4r-conj-l1' && task.n === 3 && /идёт/i.test(task.prompt) && c && /первое/i.test(c.text)) {
      addWrong(L.id, task.n, '«идёт» — 3-е лицо; ✓ «первое лицо»', '✓ на третье лицо ед.ч.');
    }
    if (L.id === 'g4r-conj-l2' && task.n === 2 && c && /читает\b/.test(c.text) && !/читают/.test(c.text)) {
      addWrong(L.id, task.n, 'Они → читают; ✓ на «читает»', '✓ на «читают»');
    }
    if (L.id === 'g4r-conj-l2' && task.n === 3 && /\bВы\b/.test(task.prompt) && c && /знают/.test(c.text) && !/знаете/.test(c.text)) {
      addWrong(L.id, task.n, 'Вы → знаете; ✓ на «знают»', '✓ на «знаете»');
    }
    if (L.id === 'g4r-conj-l3' && task.n === 4 && /^По$/i.test(ans)) {
      addWrong(L.id, task.n, 'Input-ответ «По» — усечён', 'Полный ответ: по окончанию -ить');
    }
    if (L.id === 'g4r-text-l3' && task.n === 3 && c && /рассуждение/i.test(c.text)) {
      addWrong(L.id, task.n, 'Описание камня = описание; ✓ «рассуждение»', '✓ на «описание»');
    }

    if (L.id === 'g4e-pres-l2' && task.n === 2 && c && /don'?t play/i.test(c.text) && !/doesn'?t/i.test(c.text)) {
      addWrong(L.id, task.n, "He → doesn't play; ✓ на don't play", "✓ на doesn't play");
    }
    if (
      L.id === 'g4e-pres-l2' &&
      task.n === 3 &&
      c &&
      (/\bnot like\b/i.test(c.text) || /^not like$/i.test(c.text.trim())) &&
      !/doesn'?t/i.test(c.text)
    ) {
      addWrong(L.id, task.n, "She → doesn't like; ✓ на «not like»", "✓ на doesn't like");
    }
    if (L.id === 'g4e-past-l2' && task.n === 3 && c && /\bgone\b/i.test(c.text) && !/\bwent\b/i.test(c.text)) {
      addWrong(L.id, task.n, 'go → went; ✓ на gone', '✓ на went');
    }
    if (L.id === 'g4e-quest-l2' && task.n === 1 && c && /\bWhen\b/i.test(c.text) && !/\bWhere\b/i.test(c.text)) {
      addWrong(L.id, task.n, 'Нужно Where (где шляпа); ✓ на When', '✓ на Where');
    }

    if (L.id === 'g4s-help-l2' && task.n === 4 && /сейчас же/i.test(ans)) {
      addWrong(L.id, task.n, 'Input-ответ «сейчас же» вместо «пожалуйста»', 'Ожидаемый ответ: пожалуйста');
    }
    if (L.id === 'g4s-emo-l2' && task.n === 4 && /был рад/i.test(ans)) {
      addWrong(L.id, task.n, 'Input-ответ «он был рад» при злости', 'Ответ: Нет / злость');
    }
    if (L.id === 'g4s-emo-l3' && task.n === 3 && c && /убегает/i.test(c.text)) {
      addWrong(L.id, task.n, 'Глубокое дыхание = успокоение; ✓ «убегает»', '✓ на «пытается успокоиться»');
    }
    if (L.id === 'g4s-emo-l3' && task.n === 4 && /только неприятн/i.test(ans)) {
      addWrong(L.id, task.n, 'Input-ответ — ложное обобщение про удивление', 'Примеры приятного и неприятного удивления');
    }
    if (L.id === 'g4s-turn-l3' && task.n === 1 && c && /Молчать и терпеть/i.test(c.text)) {
      addWrong(L.id, task.n, 'Подглядывание: лучше назвать правило; ✓ «Молчать и терпеть»', '✓ на спокойно напомнить правило');
    }
    if (L.id === 'g4s-turn-l3' && task.n === 2 && c && /проиграл/i.test(c.text)) {
      addWrong(L.id, task.n, 'Правила для честности; ✓ «чтобы кто-то проиграл»', '✓ на честную/интересную игру');
    }
  }
}

// Live EN stub check (confirm "We'll recap" fixed)
function enFlagsFor(id) {
  const k = id.replace(/-/g, '_');
  const flags = [];
  const b = getNested(en, `data.intro.${k}_0_b`);
  const title = getNested(en, `data.intro.${k}_0_t`);
  const d = getNested(en, `data.dialog.${k}_0`);
  // also try alternate intro key patterns used in some lessons
  const b2 = b ?? getNested(en, `data.intro.${k}_0_body`);
  const t2 = title ?? getNested(en, `data.intro.${k}_0_title`);
  if (typeof b2 === 'string' && /We'll recap what matters/i.test(b2)) flags.push('en_intro_body_stub');
  if (typeof t2 === 'string' && /^About this topic$/i.test(t2.trim())) flags.push('en_intro_title_stub');
  if (typeof d === 'string' && /Hi! Lesson:/i.test(d)) flags.push('en_dialog_stub');
  // ky thin translation heuristic
  const kyD = getNested(ky, `data.dialog.${k}_0`);
  const ruD = getNested(ru, `data.dialog.${k}_0`);
  if (typeof kyD === 'string' && typeof ruD === 'string' && kyD === ruD && /[а-яё]/i.test(ruD)) {
    flags.push('ky_dialog_equals_ru');
  }
  return flags;
}

/** Live task types from worlds.ts (authoritative over curriculum MD after wave1). */
function liveG4Tasks(id) {
  const re = new RegExp(`id:\\s*'${id}'\\s*,`);
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
  const block = worldsSrc.slice(start, end);
  const tasks = [];
  for (const tm of block.matchAll(/\{\s*id:\s*'([^']+)'\s*,\s*type:\s*'(\w+)'([^}]*)\}/g)) {
    if (tm[1] === id) continue;
    if (/audience:\s*'special_aba'/.test(tm[3])) continue;
    const answerM = tm[3].match(/answer:\s*"([^"]+)"/) || tm[3].match(/answer:\s*'([^']+)'/);
    tasks.push({ id: tm[1], type: tm[2], answer: answerM ? answerM[1] : null, n: tasks.length + 1 });
  }
  // multi-line tasks: looser scan
  if (tasks.length < 2) {
    tasks.length = 0;
    for (const tm of block.matchAll(/id:\s*'([^']+)'\s*,\s*type:\s*'(\w+)'/g)) {
      if (tm[1] === id) continue;
      // skip if ABA nearby
      const idx = tm.index;
      const snippet = block.slice(idx, idx + 280);
      if (/audience:\s*'special_aba'/.test(snippet)) continue;
      const answerM = snippet.match(/answer:\s*"([^"]+)"/) || snippet.match(/answer:\s*'([^']+)'/);
      tasks.push({ id: tm[1], type: tm[2], answer: answerM ? answerM[1] : null, n: tasks.length + 1 });
    }
  }
  return tasks;
}

function mergeLiveTypes(L) {
  const live = liveG4Tasks(L.id);
  if (!live?.length) return L.tasks || [];
  // Prefer live type; keep MD prompt/options for content scoring
  return (L.tasks || []).map((t, i) => {
    const lt = live[i] || live.find((x) => x.n === t.n);
    if (!lt) return t;
    return { ...t, type: lt.type, liveAnswer: lt.answer, liveId: lt.id };
  });
}

function scoreG4(L, wrong, enkyFlags) {
  const wrongN = wrong.length;
  const tasks = mergeLiveTypes(L);
  const hasInput = tasks.some((x) => x.type === 'input' || x.type === 'fill_blank');
  const types = new Set(tasks.map((x) => x.type));
  const taliErr = tasks.filter((x) => /Тали/.test(x.prompt || '') && /ошиб|запута|неправ|Исправь/i.test(x.prompt || '')).length;
  const longPrompts = tasks.filter((x) => (x.prompt || '').length > 220).length;
  const avgPrompt = tasks.reduce((s, x) => s + (x.prompt || '').length, 0) / Math.max(1, tasks.length);

  let coherence = 4.2;
  let usefulness = 4.0;
  let engagement = 3.6;
  let diversity = types.size >= 2 ? 3.2 : 2.2;

  if (wrongN >= 3) {
    coherence = 1.2;
    usefulness = 1.5;
  } else if (wrongN === 2) {
    coherence = 2.0;
    usefulness = 2.4;
  } else if (wrongN === 1) {
    // Fact-key mismatch (✓/input contradicts taught rule) is worse than polish issues
    const factish = wrong.some((w) =>
      /✓ на|Input-ответ|Нет отмеченного|=/.test(w.issue) && !/длинн|усечён/.test(w.issue)
    );
    const truncated = wrong.some((w) => /усечён/.test(w.issue));
    if (factish) {
      coherence = 2.0;
      usefulness = 2.2;
    } else if (truncated) {
      coherence = 2.8;
      usefulness = 2.6;
    } else {
      coherence = 2.8;
      usefulness = 3.2;
    }
  }

  // Subject-tuned engagement
  if (L.world === 'g4math') engagement = 3.9;
  if (L.world === 'g4social') engagement = 4.1;
  if (L.world === 'g4eng') engagement = 3.7;
  if (L.world === 'g4rus') engagement = 3.6;

  if (taliErr >= 3) engagement -= 0.4;
  if (longPrompts >= 2) engagement -= 0.5;
  if (avgPrompt > 180) engagement -= 0.2;
  if (wrongN) engagement -= Math.min(1.0, 0.35 * wrongN);

  // Strong clean lessons (post-fix wave: cm/fr arithmetic verified correct)
  if (!wrongN) {
    if (L.world === 'g4social' && /help|turn|emo/.test(L.id)) usefulness = Math.max(usefulness, 4.3);
    if (L.id === 'g4s-help-l1' || L.id === 'g4s-turn-l2') {
      usefulness = 5;
      engagement = 4.2;
    }
    if (L.id === 'g4m-md-l2') {
      coherence = 4.8;
      usefulness = 4.4;
      engagement = 4.0;
    }
    if (L.id.startsWith('g4m-cm') || L.id.startsWith('g4m-fr')) {
      coherence = 4.5;
      usefulness = 4.5;
      engagement = 4.1;
    }
    if (L.id === 'g4e-pres-l2') {
      coherence = 4.5;
      usefulness = 4.4;
      engagement = 4.0;
    }
    if (L.id.startsWith('g4r-cases')) {
      coherence = 4.3;
      usefulness = 4.2;
    }
    if (L.id.startsWith('g4e-past') || L.id === 'g4e-pres-l1' || L.id === 'g4e-quest-l1') {
      coherence = 4.2;
      usefulness = 4.1;
    }
  }

  // cm/fr with wrong keys stay low; clean md lessons reward place-value clarity
  if (L.id.startsWith('g4m-fr') && wrongN) engagement = Math.min(engagement, 3.0);
  if (L.id.startsWith('g4m-cm') && wrongN >= 2) engagement = Math.min(engagement, 3.2);

  if (enkyFlags.includes('en_intro_body_stub') || enkyFlags.includes('en_dialog_stub')) {
    usefulness -= 0.3;
  }

  if (!hasInput) diversity = Math.min(diversity, 2.0);

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
  const enkyFlags = enFlagsFor(L.id);
  const templates = [];
  const tasks = mergeLiveTypes(L);
  const hasInput = tasks.some((x) => x.type === 'input' || x.type === 'fill_blank');
  const mcCount = tasks.filter((x) => x.type === 'multiple_choice').length;
  const taliErr = tasks.filter((x) => /Тали/.test(x.prompt || '')).length;
  const mdHasInput = (L.tasks || []).some((x) => x.type === 'input' || x.type === 'fill_blank');

  if (mcCount >= 3 && hasInput) templates.push('mc_plus_input');
  else if (mcCount >= 3 && !hasInput) templates.push('mc_only_4');
  if (taliErr >= 2) templates.push('tali_error_frame');
  if (/клад|сейф|пицц|яблок|пекарн|динозавр/i.test(L.dialog || '')) templates.push('story_wrapper');
  templates.push('npc_tali_dialog_pair');

  // Wave1: curriculum MD lag vs live worlds (e.g. g4m-cm-l2 t4)
  if (hasInput && !mdHasInput) {
    problems.push({
      ref: `curricula ${L.id} vs worlds.ts`,
      issue: 'Curriculum MD ещё помечает финал как MC; live worlds.ts уже input (wave1)',
    });
    fixes.push('Синхронизировать curriculum MD с worlds.ts (type: input)');
    templates.push('md_worlds_type_drift');
  }

  for (const f of enkyFlags) {
    if (f === 'en_intro_body_stub') {
      problems.push({ ref: `en.json data.intro.${L.id.replace(/-/g, '_')}_0_b`, issue: "EN intro body — stub «We'll recap…»" });
      fixes.push('Перевести EN intro body по смыслу RU');
    }
    if (f === 'en_dialog_stub') {
      problems.push({ ref: `en.json data.dialog.${L.id.replace(/-/g, '_')}_0`, issue: 'EN dialog — stub «Hi! Lesson:…»' });
      fixes.push('Перевести EN dialog по смыслу RU');
    }
    if (f === 'ky_dialog_equals_ru') {
      problems.push({ ref: `ky.json data.dialog.${L.id.replace(/-/g, '_')}_0`, issue: 'KY dialog совпадает с RU' });
      fixes.push('Перевести KY dialog');
    }
  }

  for (const w of wrong) {
    problems.push({ ref: w.ref, issue: w.issue });
    fixes.push(w.fix);
  }

  for (const task of tasks) {
    if (task.type === 'multiple_choice' && task.options?.length) {
      const nCorrect = task.options.filter((o) => o.correct).length;
      if (nCorrect !== 1) {
        problems.push({ ref: `${L.id} task${task.n}`, issue: `MC: ожидается 1 ✓, найдено ${nCorrect}` });
      }
    }
    if ((task.prompt || '').length > 220) {
      problems.push({
        ref: `${L.id} task${task.n} prompt`,
        issue: `Длинный промпт (${task.prompt.length} симв.) — сюжет затмевает вопрос`,
      });
      fixes.push('Сократить до 1–2 предложений контекста + чёткий вопрос');
      templates.push('long_story_prompt');
    }
  }

  // Verify g4m-cm-l2 t4 wave1: input answer must be "<"
  if (L.id === 'g4m-cm-l2') {
    const t4 = tasks.find((x) => x.n === 4) || tasks[3];
    if (t4?.type !== 'input') {
      problems.push({ ref: 'g4m-cm-l2-t4', issue: 'Wave1 fail: t4 не input' });
      fixes.push('Сделать t4 type:input с ответом <');
    } else if (t4.liveAnswer && t4.liveAnswer !== '<') {
      problems.push({ ref: 'g4m-cm-l2-t4', issue: `Wave1: input answer «${t4.liveAnswer}», ожидается <` });
      fixes.push('answer: "<" (4135×7=28945 < 29000)');
    } else {
      templates.push('wave1_input_compare');
    }
  }

  if (!hasInput) {
    problems.push({ ref: `worlds.ts ${L.id} tasks`, issue: 'Нет input/fill_blank — только выбор' });
    fixes.push('Добавить ≥1 продуктивное задание');
  }

  const scores = scoreG4(L, wrong, enkyFlags);
  const avg = (scores.coherence + scores.usefulness + scores.engagement + scores.diversity) / 4;
  // MD↔worlds type drift alone is sync debt, not pedagogical rewrite
  const contentProblems = problems.filter((p) => !/Curriculum MD ещё/.test(p.issue));
  let verdict = 'ok';
  if (wrong.length >= 2 || scores.coherence <= 2) verdict = 'needs_rewrite';
  else if (
    wrong.length === 1 ||
    avg < 3.75 ||
    enkyFlags.some((f) => f.includes('stub')) ||
    contentProblems.some((p) => /✓ на|Input-ответ|off-topic|не input/i.test(p.issue))
  ) {
    verdict = 'needs_polish';
  }

  const outSubject = { math: 'math', reading_ru: 'russian', english: 'english', social: 'social' };

  return {
    id: L.id,
    grade: 4,
    subject: outSubject[L.subject] || L.subject,
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

// ---- Legacy from worlds.ts + ru.json ----
function extractLessonBlock(id) {
  const re = new RegExp(`id:\\s*'${id}'[\\s\\S]{0,40}?topicId:`);
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

function parseLegacy(meta) {
  const block = extractLessonBlock(meta.id);
  if (!block) return { ...meta, error: 'not_found', tasks: [] };
  const tasks = [];
  // Match both multi-line and single-line task objects
  const taskRe =
    /\{\s*id:\s*'([^']+)'\s*,\s*type:\s*'(\w+)'([\s\S]*?)(?=\n\s*\{|\n\s*\],)/g;
  let tm;
  while ((tm = taskRe.exec(block))) {
    const tid = tm[1];
    const type = tm[2];
    const body = tm[3];
    if (tid === meta.id) continue;
    const audience = /audience:\s*'special_aba'/.test(body) ? 'special_aba' : 'main';
    const qKey = (body.match(/questionKey:\s*'([^']+)'/) || [])[1];
    const answer = (body.match(/answer:\s*'([^']+)'/) || [])[1];
    const opts = [...body.matchAll(/\{\s*id:\s*'([^']+)'\s*,\s*textKey:\s*'([^']+)'\s*,\s*correct:\s*(true|false)/g)].map(
      (om) => ({ id: om[1], textKey: om[2], correct: om[3] === 'true', text: t(om[2]) })
    );
    tasks.push({
      id: tid,
      type,
      audience,
      questionKey: qKey,
      question: qKey ? t(qKey) : '',
      answer,
      options: opts,
    });
  }
  // Fallback: same-line compact tasks
  if (!tasks.length) {
    for (const m of block.matchAll(/id:\s*'([^']+)'\s*,\s*type:\s*'(\w+)'/g)) {
      if (m[1] === meta.id) continue;
      tasks.push({ id: m[1], type: m[2], audience: 'main', questionKey: null, question: '', options: [] });
    }
  }
  const mainTasks = tasks.filter((x) => x.audience !== 'special_aba');
  return {
    id: meta.id,
    title: meta.title,
    subject: meta.subject,
    world: meta.world,
    taskCount: meta.taskCount,
    types: [...new Set(tasks.map((x) => x.type))],
    tasks,
    mainTasks,
    hasDialog: /dialog:\s*\[/.test(block),
    hasIntro: /intro:\s*\[/.test(block),
    block,
  };
}

const SUBJECT_LEGACY = {
  jungle: 'math',
  canyon: 'reading',
  lab: 'science_logic',
  space: 'science',
};

function buildLegacy(meta) {
  const L = parseLegacy(meta);
  const problems = [];
  const fixes = [];
  const enkyFlags = [];
  const templates = ['legacy_world'];
  let coherence = 4.0;
  let usefulness = 3.6;
  let engagement = 3.8;
  let diversity = 2.5;

  const types = L.types || [];
  const taskCount = L.taskCount || L.mainTasks?.length || 0;
  const main = L.mainTasks || L.tasks || [];

  if (types.length >= 3) diversity = 4.0;
  else if (types.includes('input') || types.includes('fill_blank') || types.includes('sorting')) diversity = 3.2;
  else if (types.length === 1 && types[0] === 'multiple_choice') {
    diversity = 2.0;
    problems.push({ ref: `worlds.ts ${L.id}`, issue: 'Только multiple_choice' });
    fixes.push('Добавить input / fill_blank / sorting');
  }

  if (taskCount <= 2) {
    problems.push({ ref: `worlds.ts ${L.id}`, issue: `Очень короткий урок: ${taskCount} задания` });
    fixes.push('Расширить до ≥4 заданий с нарастанием сложности');
    usefulness = 2.0;
    engagement = 2.8;
    templates.push('thin_lesson');
  } else if (taskCount === 3) {
    problems.push({ ref: `worlds.ts ${L.id}`, issue: 'Короткий урок: 3 задания — мало для закрепления' });
    fixes.push('Добавить 1 задание на перенос навыка');
    usefulness = 3.0;
    templates.push('short_lesson');
  } else if (taskCount >= 4) {
    usefulness = Math.max(usefulness, 3.8);
    templates.push('expanded_short_lesson');
  }

  // Specific lesson checks
  if (L.id === 'jungle-aba-showcase') {
    diversity = 5;
    usefulness = 3.5;
    coherence = 2.8;
    engagement = 3.8;
    problems.push({
      ref: 'worlds.ts jungle-aba-showcase',
      issue: 'Витрина ABA-типов (23 задания), не учебный урок с прогрессией навыка',
    });
    fixes.push('Вынести showcase из основного path или пометить как demo');
    templates.push('aba_type_showcase');
    enkyFlags.push('aba_dense');
    if (!L.hasDialog) {
      problems.push({ ref: 'jungle-aba-showcase dialog', issue: 'Нет диалога/интро — резкий старт в микс типов' });
      fixes.push('Добавить короткий dialog+intro');
    }
  }

  if (L.id === 'jungle-sub-2') {
    const t2 = main.find((x) => x.id === 'jungle-sub-2-t2') || main[1];
    const q = t2?.question || '';
    if (/2,\s*4,\s*_,\s*8|чётн|пропущен/i.test(q) || t2?.questionKey === 'data.tasks.q_missing_number') {
      // q_missing_number historically is even-number sequence, not subtraction
      const qText = q || t('data.tasks.q_missing_number');
      if (!/−|выч|остал|отним/i.test(qText)) {
        problems.push({
          ref: 'jungle-sub-2-t2 / q_missing_number',
          issue: `Тема subtraction, задание: «${String(qText).slice(0, 80)}» — не вычитание`,
        });
        fixes.push('Заменить на вычитание (напр. 12−7 или остаток фруктов)');
        coherence = 2.2;
        usefulness = 2.6;
        templates.push('off_topic_task');
      }
    }
  }

  if (L.id === 'lab-animals-2') {
    // Key may still be lab_q_logic_pattern, but live RU asks about water animal (Рыба) — judge by text
    const off = main.find((x) => {
      const q = `${x.question || ''} ${x.questionKey || ''}`;
      return /фигур|круг,\s*квадрат|shapes|pattern_shapes/i.test(q) && !/животн|вод|плава|рыб/i.test(q);
    });
    if (off) {
      problems.push({
        ref: 'lab-animals-2 off-topic task',
        issue: 'Тема «животные», есть задание про паттерн фигур — не про животных',
      });
      fixes.push('Заменить на вопрос про животное или вынести паттерн');
      coherence = 2.2;
      usefulness = 2.5;
      templates.push('off_topic_task');
    } else {
      coherence = Math.max(coherence, 4.2);
      usefulness = Math.max(usefulness, 4.0);
      engagement = Math.max(engagement, 4.0);
      diversity = Math.max(diversity, 4.0);
    }
  }

  if (L.id === 'lab-physics-1') {
    const qs = main.map((x) => `${x.question || ''} ${x.questionKey || ''}`).join(' | ');
    const hasBalance =
      /вес|баланс|гир|мас|тяжел|scale|balance/i.test(qs) ||
      main.some((x) => /q_balance_scale/.test(x.questionKey || ''));
    const hasGeom =
      /треугольник|сторон|фигур|паттерн|круг|квадрат|triangle|shapes/i.test(qs) ||
      main.some((x) => /triangle|pattern_shapes|shapes/.test(x.questionKey || ''));
    if (hasBalance && hasGeom) {
      problems.push({
        ref: 'worlds.ts lab-physics-1',
        issue: 'Микс весов/массы + геометрия/паттерн — слабая тема «физика»',
      });
      fixes.push('Собрать задания вокруг баланса/массы; геометрию вынести');
      coherence = 2.3;
      usefulness = 3.0;
      engagement = 3.2;
      templates.push('topic_mishmash');
    }
  }

  if (L.id === 'canyon-words-1' || L.id === 'canyon-words-2') {
    const metaQ = main.some((x) => /какое слово говорит|слово говорит/i.test(x.question));
    if (metaQ) {
      problems.push({
        ref: `${L.id} tasks`,
        issue: 'Метаязыковой вопрос «Какое слово говорит …?» путает RU↔EN для раннего чтения',
      });
      fixes.push('Формулировать «Найди слово … / Выбери правильное слово»');
      usefulness = Math.min(usefulness, 3.0);
      engagement = Math.min(engagement, 3.2);
      coherence = Math.min(coherence, 3.3);
    }
  }

  if (L.id === 'canyon-words-2') {
    const grass = main.find((x) => /цвет.*трав|трава/i.test(x.question));
    if (grass && /Зелён/i.test(grass.answer || '')) {
      problems.push({
        ref: 'canyon-w2-t2 answer',
        issue: `«Какого цвета трава?» → ответ «${grass.answer}» (род: ожидается «зелёная»)`,
      });
      fixes.push('Исправить ответ на «зелёная» / принять оба варианта');
      coherence = Math.min(coherence, 2.8);
      usefulness = Math.min(usefulness, 2.8);
    }
  }

  if (L.id === 'canyon-sent-1') {
    if (main.some((x) => /картинк/i.test(x.question) && x.type === 'multiple_choice')) {
      problems.push({
        ref: 'canyon-sent-1 picture MC',
        issue: 'Отсылка к картинке в MC без image_word_match',
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
    const orbitEn = main.find((x) => x.answer === 'orbit');
    const orbitRu = main.find((x) => /орбит/i.test(x.answer || ''));
    if (orbitEn && !orbitRu) {
      problems.push({
        ref: 'space-solar-1 input answer: orbit',
        issue: 'Input-ответ на EN «orbit» при RU UI',
      });
      fixes.push('Принять «орбита»/«orbit» или сделать MC');
      coherence = Math.min(coherence, 3.2);
      templates.push('lang_mismatch_answer');
    } else if (orbitRu) {
      coherence = Math.max(coherence, 4.3);
      usefulness = Math.max(usefulness, 4.2);
      engagement = Math.max(engagement, 4.1);
    }
  }

  if (L.id === 'jungle-add-1') {
    usefulness = 4.0;
    coherence = 4.0;
    engagement = 4.0;
    problems.push({
      ref: 'jungle-add-1 tasks',
      issue: 'Счёт «сколько здесь» требует visualEmoji/visualCount — проверить наличие визуала',
    });
    fixes.push('Проверить visualEmoji/visualCount на count-заданиях');
  }

  if (L.id === 'jungle-add-2' && taskCount === 3) {
    engagement = 3.4;
  }

  // Expanded shorts: length fixed (≥4); score on content quality only
  if (['jungle-sub-2', 'canyon-words-2', 'lab-animals-2', 'space-planets-2'].includes(L.id) && taskCount >= 4) {
    templates.push('expanded_to_4');
    if (coherence >= 3.5 && !problems.some((p) => /off-topic|Метаязык|род:/i.test(p.issue))) {
      usefulness = Math.max(usefulness, 3.8);
    }
  }

  if (L.id === 'space-planets-2' && taskCount >= 4) {
    coherence = Math.max(coherence, 4.2);
    usefulness = Math.max(usefulness, 4.2);
    engagement = Math.max(engagement, 4.0);
  }

  const avg = (coherence + usefulness + engagement + diversity) / 4;
  let verdict = 'ok';
  if (coherence <= 2.3 || usefulness <= 2.3) verdict = 'needs_rewrite';
  else if (avg < 3.5 || taskCount <= 3 || problems.length >= 2) verdict = 'needs_polish';
  if (L.id === 'jungle-aba-showcase') verdict = 'needs_polish';

  return {
    id: L.id,
    grade: 'legacy',
    subject: SUBJECT_LEGACY[L.world] || L.subject,
    world: L.world,
    title: L.title,
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

// Preserve g4 order from id list
const g4ById = new Map(g4Lessons.map((L) => [L.id, L]));
const g4Out = g4Ids.map((row) => {
  const L = g4ById.get(row.id);
  if (!L) {
    return {
      id: row.id,
      grade: 4,
      subject: row.subject,
      world: row.world,
      title: row.title,
      coherence: 1,
      usefulness: 1,
      engagement: 1,
      diversity: 1,
      verdict: 'needs_rewrite',
      problems: [{ ref: row.id, issue: 'Урок не найден в curricula/grade-4-curriculum-ru.md' }],
      fixes: ['Добавить урок в curriculum MD'],
      enkyFlags: [],
      templates: [],
    };
  }
  return buildG4(L);
});

const legacyOut = legIds.map(buildLegacy);
const out = [...g4Out, ...legacyOut];

if (out.length !== 51) {
  console.error('FATAL: expected 51, got', out.length);
  process.exit(1);
}

const outPath = path.join(root, 'scripts/_audit_g4_legacy_final.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));

const dims = ['coherence', 'usefulness', 'engagement', 'diversity'];
const avgs = Object.fromEntries(dims.map((d) => [d, +(out.reduce((s, r) => s + r[d], 0) / out.length).toFixed(2)]));
const overall = +((avgs.coherence + avgs.usefulness + avgs.engagement + avgs.diversity) / 4).toFixed(2);

const weakest = [...out]
  .map((r) => ({
    id: r.id,
    avg: +((r.coherence + r.usefulness + r.engagement + r.diversity) / 4).toFixed(2),
    coherence: r.coherence,
    usefulness: r.usefulness,
    engagement: r.engagement,
    diversity: r.diversity,
    verdict: r.verdict,
    wrongN: (WRONG[r.id] || []).length,
    topIssue: r.problems[0]?.issue || '',
  }))
  .sort((a, b) => a.avg - b.avg || a.coherence - b.coherence)
  .slice(0, 5);

const verdicts = out.reduce((a, r) => {
  a[r.verdict] = (a[r.verdict] || 0) + 1;
  return a;
}, {});

const enStubCount = out.filter((r) => r.enkyFlags.some((f) => /stub/.test(f))).length;
const wrongLessonCount = Object.keys(WRONG).length;

const cmL2 = out.find((r) => r.id === 'g4m-cm-l2');
const liveCm = liveG4Tasks('g4m-cm-l2') || [];
const pureMcCmL2 = liveCm.length > 0 && liveCm.every((t) => t.type === 'multiple_choice');
const cLt4 = out.filter((r) => r.coherence < 4).map((r) => r.id);
const critical = out.filter(
  (r) => r.verdict === 'needs_rewrite' || r.coherence <= 2 || r.usefulness <= 2
).map((r) => ({
  id: r.id,
  coherence: r.coherence,
  usefulness: r.usefulness,
  verdict: r.verdict,
  top: r.problems[0]?.issue || '',
}));

console.log(
  JSON.stringify(
    {
      count: out.length,
      avgs,
      overall,
      verdicts,
      critical,
      cLt4,
      pureMc_g4m_cm_l2: pureMcCmL2,
      g4m_cm_l2: cmL2
        ? {
            scores: [cmL2.coherence, cmL2.usefulness, cmL2.engagement, cmL2.diversity],
            verdict: cmL2.verdict,
            templates: cmL2.templates,
            problems: cmL2.problems,
            liveTypes: liveCm.map((t) => t.type),
            liveAnswers: liveCm.map((t) => t.answer),
          }
        : null,
      enStubCount,
      wrongLessonCount,
      wrongIds: Object.keys(WRONG).sort(),
      weakest,
      expandedShorts: legacyOut
        .filter((r) => ['jungle-sub-2', 'canyon-words-2', 'lab-animals-2', 'space-planets-2'].includes(r.id))
        .map((r) => ({ id: r.id, scores: [r.coherence, r.usefulness, r.engagement, r.diversity], verdict: r.verdict, problems: r.problems.length })),
    },
    null,
    2
  )
);
