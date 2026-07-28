/**
 * Parse grade-4 curriculum MD + legacy worlds for content audit.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function getNested(obj, dotted) {
  const parts = dotted.replace(/^data\./, '').split('.');
  // ru.json stores under nested keys; titleKey is like data.lessons.g4mMdL1
  // but in json file structure is { data: { lessons: ... } } OR flat under root?
  let cur = obj;
  const full = dotted.split('.');
  for (const p of full) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

function resolveKey(locales, key) {
  for (const loc of locales) {
    const v = getNested(loc, key);
    if (typeof v === 'string') return v;
  }
  // try without data. prefix if key starts with data.
  if (key.startsWith('data.')) {
    const alt = key.slice(5);
    for (const loc of locales) {
      // walk from root or from data
      let cur = loc.data ?? loc;
      for (const p of alt.split('.')) {
        if (cur == null || typeof cur !== 'object') {
          cur = undefined;
          break;
        }
        cur = cur[p];
      }
      if (typeof cur === 'string') return cur;
    }
  }
  return undefined;
}

// --- Parse MD ---
const md = fs.readFileSync(path.join(root, 'curricula/grade-4-curriculum-ru.md'), 'utf8');

const worldMeta = [];
let currentWorld = null;
let currentSubject = null;
let currentTheme = null;

const lines = md.split(/\r?\n/);
const lessons = [];
let i = 0;

function peekWorldFromHeader(line) {
  // ### Мастера математики
  return null;
}

while (i < lines.length) {
  const line = lines[i];

  if (line.startsWith('### ')) {
    const name = line.slice(4).trim();
    // next non-empty for world id
    let j = i + 1;
    while (j < lines.length && !lines[j].trim()) j++;
    const worldLine = lines[j] || '';
    const wm = worldLine.match(/\*\*Мир:\*\*\s*`([^`]+)`/);
    if (wm) {
      currentWorld = wm[1];
      const subjectMap = {
        g4math: 'math',
        g4rus: 'reading_ru',
        g4eng: 'english',
        g4social: 'social',
      };
      currentSubject = subjectMap[currentWorld] || 'unknown';
    }
  }

  if (line.startsWith('#### Тема:')) {
    currentTheme = line.slice('#### Тема:'.length).trim();
  }

  if (line.startsWith('##### Урок:')) {
    const title = line.slice('##### Урок:'.length).trim();
    i++;
    while (i < lines.length && !lines[i].trim()) i++;
    const idMatch = (lines[i] || '').match(/`([^`]+)`/);
    const id = idMatch ? idMatch[1] : null;
    i++;

    // collect until next ##### or #### or ###
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
    const dialogMatch = text.match(/\*\*Диалог:\*\*\n([\s\S]*?)(?=\n\*\*Интро|\n\*\*Задания:)/);
    const introMatch = text.match(/\*\*Интро[^*]*\*\*:\*\*\n([\s\S]*?)(?=\n\*\*Задания:)/);
    const tasksMatch = text.match(/\*\*Задания:\*\*\n([\s\S]*)$/);

    const dialog = dialogMatch ? dialogMatch[1].trim() : '';
    const intro = introMatch ? introMatch[1].trim() : '';
    const tasksRaw = tasksMatch ? tasksMatch[1].trim() : '';

    const tasks = [];
    const taskBlocks = tasksRaw.split(/(?=^\d+\. \*\*)/m).filter((t) => t.trim());
    for (const tb of taskBlocks) {
      const header = tb.match(/^(\d+)\. \*\*([^*]+)\*\*(?:\s*—\s*)?([^\n]*)/);
      if (!header) continue;
      const n = Number(header[1]);
      const type = header[2].trim();
      const aba = /\[ABA\]/.test(header[2]) || /\[ABA\]/.test(tb.slice(0, 80));
      const prompt = header[3].trim();
      const options = [];
      const optRe = /-\s*`([^`]+)`:\s*([^\n]+)/g;
      let om;
      while ((om = optRe.exec(tb))) {
        const raw = om[2].trim();
        const correct = raw.includes('✓');
        options.push({
          key: om[1],
          text: raw.replace(/\s*✓\s*$/, '').trim(),
          correct,
        });
      }
      tasks.push({ n, type: type.replace(/\s*\[ABA\]\s*/g, '').trim(), aba, prompt, options });
    }

    // speaker name bugs
    const dialogLines = dialog.split('\n').filter((l) => l.startsWith('-'));
    const speakerIssues = [];
    for (const dl of dialogLines) {
      const sm = dl.match(/-\s*\*\*([^*]+)\*\*:\s*(.*)/);
      if (!sm) continue;
      const speaker = sm[1].trim();
      const body = sm[2];
      // Digit addressing as Digit incorrectly, Tali speaking as Digit, etc.
      if (speaker === 'Digit' && /\bDigit,/.test(body)) {
        speakerIssues.push('Digit говорит «Digit,» — путаница имён');
      }
      if (speaker === 'Тали' && /\bТали,/.test(body) && !/поможем Тали|вместе с Тали/.test(body)) {
        // often mentor should speak
        if (/Спокойно, Тали|Тали, не волнуйся|Тали, сравнение/.test(body)) {
          speakerIssues.push(`Тали говорит как наставник: «${body.slice(0, 60)}…»`);
        }
      }
      if (speaker === 'Digit' && /Тали, не волнуйся|Спокойно, Тали/.test(body)) {
        speakerIssues.push('Digit говорит слова наставника');
      }
    }

    lessons.push({
      id,
      title,
      theme: currentTheme,
      world: currentWorld,
      subject: currentSubject,
      dialog,
      dialogLines,
      intro,
      tasks,
      speakerIssues,
      taskTypes: [...new Set(tasks.map((t) => t.type))],
    });
    continue;
  }
  i++;
}

console.log('Parsed g4 lessons:', lessons.length);

// Fact-check math answers where possible
function checkMathFacts(lesson) {
  const issues = [];
  for (const t of lesson.tasks) {
    const correct = t.options.find((o) => o.correct);
    if (!correct) {
      issues.push({ ref: `${lesson.id} task${t.n}`, issue: 'Нет отмеченного верного ответа ✓' });
      continue;
    }
    // 25400 reading
    if (/25\s*600/.test(t.prompt) && /прочитать|прочесть/i.test(t.prompt)) {
      const expected = 'Двадцать пять тысяч шестьсот';
      if (correct.text !== expected) {
        issues.push({
          ref: `curricula/grade-4-curriculum-ru.md / ${lesson.id} q${t.n}`,
          issue: `Неверный ✓: отмечено «${correct.text}», должно быть «${expected}» (25 600)`,
        });
      }
    }
    // place value 7304 digit 3
    if (/7\s*304/.test(t.prompt) && /цифр[аеуы].*3|разряд.*3|3 в числе/i.test(t.prompt)) {
      // 7304: 3 is hundreds? 7 thousands, 3 hundreds, 0 tens, 4 ones — wait 7304 = 7 thousands, 3 hundreds, 0 tens, 4 ones. So 3 is hundreds.
      // But curriculum says correct is thousands - WRONG
      if (/тысяч/.test(correct.text)) {
        issues.push({
          ref: `curricula/grade-4-curriculum-ru.md / ${lesson.id} q${t.n}`,
          issue: `Неверный ✓: в 7 304 цифра 3 — сотни, не тысячи. Отмечено «${correct.text}»`,
        });
      }
    }
    // 8450 vs 8540
    if (/8\s*450/.test(t.prompt) && /8\s*540/.test(t.prompt) && /больше|клад/i.test(t.prompt)) {
      if (/8\s*450/.test(correct.text) && !/8\s*540/.test(correct.text)) {
        issues.push({
          ref: `curricula/grade-4-curriculum-ru.md / ${lesson.id} q${t.n}`,
          issue: `Неверный ✓: 8 540 > 8 450, но отмечен клад с 8 450`,
        });
      }
    }
    // 5008 > 5080 reasoning
    if (/5\s*008/.test(t.prompt) && /5\s*080/.test(t.prompt)) {
      if (/Нельзя сравнить/.test(correct.text)) {
        issues.push({
          ref: `curricula/grade-4-curriculum-ru.md / ${lesson.id} q${t.n}`,
          issue: `Неверный ✓: «Нельзя сравнить» — ложно; верно 5 008 < 5 080`,
        });
      }
    }
  }
  return issues;
}

const factIssues = {};
for (const L of lessons) {
  const fi = checkMathFacts(L);
  if (fi.length) factIssues[L.id] = fi;
}

// EN stubs
const stubs = loadJson(path.join(root, 'scripts/_dialog_stubs.json'));
const stubKeys = new Set(stubs.en_all_keys || []);

// Map lesson id to dialog stub key pattern: g4m-md-l1 -> g4m_md_l1_0
function stubKeyFor(lessonId) {
  return lessonId.replace(/-/g, '_') + '_0';
}

// Load locales for titles and EN dialog check
const ru = loadJson(path.join(root, 'src/i18n/locales/ru.json'));
const en = loadJson(path.join(root, 'src/i18n/locales/en.json'));

function lessonTitle(id, titleFromMd) {
  return titleFromMd;
}

// Template detection: all MC, 4 tasks, similar dialog structure
function detectTemplates(L) {
  const t = [];
  if (L.tasks.every((x) => x.type === 'multiple_choice') && L.tasks.length === 4) {
    t.push('mc_only_4');
  }
  if (L.tasks.every((x) => x.type === 'multiple_choice')) {
    t.push('all_multiple_choice');
  }
  // "Tali is wrong" pattern
  const taliWrong = L.tasks.filter((x) => /Тали.*(ошиб|запута|неправ|думает|говорит)/i.test(x.prompt) || /Исправь Тали|Прав ли он|Правда\?/i.test(x.prompt)).length;
  if (taliWrong >= 2) t.push('tali_error_frame');
  // Digit/Tali treasure framing
  if (/клад|сейф|сокровищ|карту/i.test(L.dialog)) t.push('treasure_narrative');
  // EN stub
  const sk = stubKeyFor(L.id);
  if (stubKeys.has(sk)) t.push('en_dialog_stub_template');
  return t;
}

const g4Out = lessons.map((L) => {
  const problems = [];
  const fixes = [];
  const enkyFlags = [];
  const templates = detectTemplates(L);

  const sk = stubKeyFor(L.id);
  if (stubKeys.has(sk)) {
    enkyFlags.push('en_dialog_stub');
    problems.push({
      ref: `en.json data.dialog.${sk.replace(/_0$/, '')} / ${sk}`,
      issue: 'EN-диалог — заглушка «Hi! Lesson: «…»». We’ll review the key idea, then practice.»',
    });
    fixes.push('Написать полноценный EN-диалог по смыслу RU (персонаж + Tali), без шаблона Hi! Lesson');
  }

  for (const si of L.speakerIssues) {
    problems.push({ ref: `curricula/grade-4-curriculum-ru.md / ${L.id} dialog`, issue: si });
    fixes.push('Поменять говорящих: наставник (Digit/персонаж мира) vs Тали-ученик; согласовать имена в репликах');
  }

  if (factIssues[L.id]) {
    for (const fi of factIssues[L.id]) {
      problems.push(fi);
      fixes.push(`Исправить ✓ в worlds.ts + ru.json (+en/ky) для ${fi.ref}`);
    }
  }

  // Wrong correct count
  for (const t of L.tasks) {
    const nCorrect = t.options.filter((o) => o.correct).length;
    if (t.options.length && nCorrect !== 1) {
      problems.push({
        ref: `${L.id} task${t.n}`,
        issue: `Ожидается 1 ✓, найдено ${nCorrect}`,
      });
    }
    // long prompts
    if (t.prompt.length > 220) {
      problems.push({
        ref: `${L.id} task${t.n} prompt`,
        issue: `Слишком длинный промпт (${t.prompt.length} символов) для 9–10 лет`,
      });
      fixes.push('Сократить сюжетную обёртку, оставить 1 вопрос + 1 контекст');
    }
  }

  if (L.taskTypes.length === 1 && L.taskTypes[0] === 'multiple_choice') {
    problems.push({
      ref: `worlds.ts ${L.id} tasks`,
      issue: 'Все задания только multiple_choice — низкое разнообразие форматов',
    });
    fixes.push('Добавить input / fill_blank / sorting для практики навыка');
  }

  // Scoring heuristic (will refine manually in output)
  let coherence = 4;
  let usefulness = 4;
  let engagement = 4;
  let diversity = 2;

  if (L.speakerIssues.length) coherence -= 1;
  if (factIssues[L.id]?.length) {
    coherence -= 2;
    usefulness -= 2;
  }
  if (enkyFlags.includes('en_dialog_stub')) {
    coherence -= 0; // RU may be fine
    usefulness -= 0;
  }
  if (templates.includes('tali_error_frame')) engagement -= 1;
  if (templates.includes('treasure_narrative') && L.world === 'g4math') engagement += 0;
  if (L.taskTypes.length === 1) diversity = 2;
  if (L.tasks.some((t) => t.prompt.length > 220)) engagement -= 1;

  coherence = Math.max(1, Math.min(5, coherence));
  usefulness = Math.max(1, Math.min(5, usefulness));
  engagement = Math.max(1, Math.min(5, engagement));
  diversity = Math.max(1, Math.min(5, diversity));

  const avg = (coherence + usefulness + engagement + diversity) / 4;
  let verdict = 'ok';
  if (avg < 2.5 || (factIssues[L.id]?.length >= 1)) verdict = 'needs_rewrite';
  else if (avg < 3.5 || enkyFlags.length) verdict = 'needs_polish';

  return {
    id: L.id,
    grade: 4,
    subject: L.subject,
    world: L.world,
    title: L.title,
    theme: L.theme,
    coherence,
    usefulness,
    engagement,
    diversity,
    verdict,
    problems,
    fixes: [...new Set(fixes)],
    enkyFlags,
    templates,
    _tasks: L.tasks,
    _dialog: L.dialog,
    _intro: L.intro,
  };
});

fs.writeFileSync(path.join(root, 'scripts/_audit_g4_parsed.json'), JSON.stringify(g4Out, null, 2));
console.log('Wrote _audit_g4_parsed.json');
console.log('Fact issues:', Object.keys(factIssues));
console.log(
  'Speaker issues lessons:',
  g4Out.filter((x) => x.problems.some((p) => /путаница|наставник|говорящ/i.test(p.issue))).map((x) => x.id)
);

// --- Legacy worlds scrape ---
const worldsSrc = fs.readFileSync(path.join(root, 'src/data/worlds.ts'), 'utf8');

// Find legacy world sections by id
const legacyWorldIds = ['jungle', 'canyon', 'lab', 'space'];
const legacyLessons = [];

const lessonIdRe =
  /\{\s*id:\s*'([^']+)',\s*topicId:\s*'([^']+)',\s*titleKey:\s*'([^']+)'/g;
let m;
while ((m = lessonIdRe.exec(worldsSrc))) {
  const id = m[1];
  const topicId = m[2];
  const titleKey = m[3];
  if (!legacyWorldIds.some((w) => id.startsWith(w + '-') || id === w)) continue;
  // also match jungle-add-1 etc
  const world = legacyWorldIds.find((w) => id.startsWith(w));
  if (!world) continue;

  const start = m.index;
  const next = worldsSrc.slice(start + 1).search(/\{\s*id:\s*'[^']+',\s*topicId:/);
  const end = next === -1 ? Math.min(worldsSrc.length, start + 30000) : start + 1 + next;
  const block = worldsSrc.slice(start, end);

  const types = [...block.matchAll(/type:\s*'([a-z_]+)'/g)].map((x) => x[1]);
  const abaTaskCount = (block.match(/audience:\s*'special_aba'/g) || []).length;
  const questionKeys = [...block.matchAll(/questionKey:\s*'([^']+)'/g)].map((x) => x[1]);
  const dialogKeys = [...block.matchAll(/textKey:\s*'([^']+)'/g)]
    .map((x) => x[1])
    .filter((k) => k.includes('dialog') || k.includes('Dialog'));
  const hasDialog = /dialog:\s*\[/.test(block);
  const hasIntro = /intro:\s*\[/.test(block);

  const titleRu = resolveKey([ru], titleKey) || resolveKey([ru], titleKey.replace(/^data\./, '')) || id;
  const titleEn = resolveKey([en], titleKey);

  // Resolve task questions
  const taskTexts = questionKeys.map((k) => ({
    key: k,
    ru: resolveKey([ru], k),
    en: resolveKey([en], k),
  }));

  const dialogTexts = dialogKeys.map((k) => ({
    key: k,
    ru: resolveKey([ru], k),
    en: resolveKey([en], k),
  }));

  legacyLessons.push({
    id,
    topicId,
    titleKey,
    world,
    titleRu,
    titleEn,
    types,
    uniqueTypes: [...new Set(types)],
    taskCount: types.length,
    abaTaskCount,
    hasDialog,
    hasIntro,
    questionKeys,
    taskTexts,
    dialogKeys,
    dialogTexts,
    blockPreview: block.slice(0, 500),
  });
}

fs.writeFileSync(path.join(root, 'scripts/_audit_legacy_parsed.json'), JSON.stringify(legacyLessons, null, 2));
console.log(
  'Legacy lessons:',
  legacyLessons.length,
  legacyLessons.map((l) => l.id)
);
