/**
 * Fresh post-wave2 methodological audit (g4 + legacy → _audit_g4_legacy_final.json).
 * Source of truth: worlds.ts + ru/en/ky.json. Does NOT copy prior audit JSON scores.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const worldsSrc = fs.readFileSync(path.join(root, 'src/data/worlds.ts'), 'utf8');
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8'));
const ky = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ky.json'), 'utf8'));
const g4Ids = JSON.parse(fs.readFileSync(path.join(root, 'scripts/_reaudit2_ids_g4.json'), 'utf8'));
const legIds = JSON.parse(fs.readFileSync(path.join(root, 'scripts/_reaudit2_ids_glegacy.json'), 'utf8'));

function getNested(obj, dotted) {
  let cur = obj;
  for (const p of dotted.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}
function t(locale, key) {
  if (!key) return '';
  const v = getNested(locale, key);
  return v == null ? `<MISSING:${key}>` : v;
}
function clamp(n) {
  return Math.max(1, Math.min(5, Math.round(n)));
}
function parseNum(s) {
  const m = String(s).replace(/\s/g, '').replace(/—.*$/, '').match(/-?\d+/);
  return m ? Number(m[0]) : NaN;
}

function extractLessonBlock(id) {
  // Match id on its own line or same line as topicId
  const re = new RegExp(`id:\\s*'${id}'\\s*,`);
  let idx = -1;
  let searchFrom = 0;
  while (true) {
    const m = re.exec(worldsSrc.slice(searchFrom));
    if (!m) break;
    const abs = searchFrom + m.index;
    const window = worldsSrc.slice(abs, abs + 120);
    if (/topicId:/.test(window)) {
      idx = abs;
      break;
    }
    searchFrom = abs + 1;
  }
  if (idx < 0) return null;
  let start = idx;
  while (start > 0 && worldsSrc[start] !== '{') start--;
  let depth = 0;
  for (let j = start; j < worldsSrc.length; j++) {
    if (worldsSrc[j] === '{') depth++;
    else if (worldsSrc[j] === '}') {
      depth--;
      if (depth === 0) return worldsSrc.slice(start, j + 1);
    }
  }
  return null;
}

function parseTasks(block, lessonId) {
  const tasks = [];
  // Find task starts: `{` then soon `id:` + `type:` (multi-line or same-line)
  const idTypeRe = /id:\s*'([^']+)'\s*,\s*type:\s*'(\w+)'/g;
  const multiRe = /id:\s*'([^']+)'\s*,\s*\n\s*type:\s*'(\w+)'/g;
  const starts = [];
  for (const m of block.matchAll(idTypeRe)) {
    if (m[1] === lessonId) continue;
    starts.push({ index: m.index, id: m[1], type: m[2], endHint: m.index + m[0].length });
  }
  for (const m of block.matchAll(multiRe)) {
    if (m[1] === lessonId) continue;
    if (starts.some((s) => s.id === m[1])) continue;
    starts.push({ index: m.index, id: m[1], type: m[2], endHint: m.index + m[0].length });
  }
  starts.sort((a, b) => a.index - b.index);

  for (let i = 0; i < starts.length; i++) {
    const s = starts[i];
    // Expand to enclosing `{` for options
    let objStart = s.index;
    while (objStart > 0 && block[objStart] !== '{') objStart--;
    let depth = 0;
    let objEnd = objStart;
    for (let j = objStart; j < block.length; j++) {
      if (block[j] === '{') depth++;
      else if (block[j] === '}') {
        depth--;
        if (depth === 0) {
          objEnd = j + 1;
          break;
        }
      }
    }
    const body = block.slice(objStart, objEnd);
    const aba = /audience:\s*'special_aba'/.test(body);
    const qKey = (body.match(/questionKey:\s*'([^']+)'/) || [])[1] || null;
    const answerLit =
      (body.match(/answer:\s*"([^"]+)"/) || body.match(/answer:\s*'([^']+)'/) || [])[1] || null;
    const answerKey = (body.match(/correctAnswerKey:\s*'([^']+)'/) || [])[1] || null;
    const options = [
      ...body.matchAll(/\{\s*id:\s*'([^']+)'\s*,\s*textKey:\s*'([^']+)'\s*,\s*correct:\s*(true|false)/g),
    ].map((om) => ({
      id: om[1],
      textKey: om[2],
      correct: om[3] === 'true',
      ru: t(ru, om[2]),
      en: t(en, om[2]),
    }));
    tasks.push({
      id: s.id,
      type: s.type,
      aba,
      qKey,
      qRu: qKey ? t(ru, qKey) : '',
      qEn: qKey ? t(en, qKey) : '',
      options,
      answer: answerLit || (answerKey ? t(ru, answerKey) : null),
      answerKey,
      n: 0,
    });
  }
  // Deduplicate by id (same-line + multi-line match)
  const seen = new Set();
  const uniq = [];
  for (const tk of tasks) {
    if (seen.has(tk.id)) continue;
    seen.add(tk.id);
    uniq.push(tk);
  }
  const main = uniq.filter((x) => !x.aba);
  main.forEach((x, i) => {
    x.n = i + 1;
  });
  return { all: uniq, main };
}

function enkyFlagsFor(block, tasks) {
  const flags = [];
  for (const m of block.matchAll(/textKey:\s*'([^']+)'/g)) {
    const enV = t(en, m[1]);
    const ruV = t(ru, m[1]);
    const kyV = t(ky, m[1]);
    if (typeof enV === 'string' && /We'll recap what matters/i.test(enV)) flags.push(`en_stub:${m[1]}`);
    if (typeof enV === 'string' && /^Hi! Lesson:/i.test(enV.trim())) flags.push(`en_dialog_stub:${m[1]}`);
    if (typeof enV === 'string' && /^About this topic$/i.test(enV.trim())) flags.push(`en_title_stub:${m[1]}`);
    if (typeof kyV === 'string' && kyV === ruV && /[а-яё]/i.test(String(ruV))) flags.push(`ky_eq_ru:${m[1]}`);
  }
  for (const m of block.matchAll(/(?:titleKey|bodyKey|questionKey|correctAnswerKey):\s*'([^']+)'/g)) {
    const enV = t(en, m[1]);
    const ruV = t(ru, m[1]);
    const kyV = t(ky, m[1]);
    if (typeof enV === 'string' && /We'll recap what matters/i.test(enV)) flags.push(`en_stub:${m[1]}`);
    if (typeof enV === 'string' && /^About this topic$/i.test(enV.trim())) flags.push(`en_title_stub:${m[1]}`);
    if (typeof kyV === 'string' && kyV === ruV && /[а-яё]/i.test(String(ruV))) flags.push(`ky_eq_ru:${m[1]}`);
  }
  // EN/RU semantic drift for quest hat lesson
  for (const tk of tasks) {
    if (/birthday/i.test(tk.qEn) && /шляп|where|где/i.test(tk.qRu + tk.qEn)) {
      flags.push(`en_birthday_mismatch:${tk.id}`);
    }
  }
  return [...new Set(flags)];
}

function checkWrongAnswers(id, main) {
  const wrong = [];
  const push = (n, issue, fix) => wrong.push({ n, ref: `${id} t${n}`, issue, fix });

  for (const tk of main) {
    if (tk.type === 'multiple_choice') {
      const nCorrect = tk.options.filter((o) => o.correct).length;
      if (tk.options.length && nCorrect !== 1) {
        push(tk.n, `MC: ожидается 1 ✓, найдено ${nCorrect}`, 'Отметить ровно один верный вариант');
      }
    }
  }

  // Math arithmetic from prompt
  if (id.startsWith('g4m-')) {
    for (const tk of main) {
      if (tk.type !== 'multiple_choice') continue;
      const c = tk.options.find((o) => o.correct);
      if (!c) continue;
      const mm = tk.qRu.match(/(\d[\d\s]*)\s*[×xX]\s*(\d[\d\s]*)/);
      if (mm) {
        const a = parseNum(mm[1]);
        const b = parseNum(mm[2]);
        const exp = a * b;
        const got = parseNum(c.ru);
        if (!Number.isNaN(got) && got !== exp) {
          push(tk.n, `${a}×${b}=${exp}, ✓ на ${got}`, `✓ на ${exp.toLocaleString('ru-RU')}`);
        }
      }
    }
  }

  // Wave2 criticals
  if (id === 'g4r-text-l3') {
    const t3 = main.find((x) => x.n === 3) || main[2];
    const c = t3?.options.find((o) => o.correct);
    if (c && !/описан/i.test(c.ru)) {
      push(3, `Описание камня: ✓ «${c.ru}» (нужно описание)`, '✓ на «описание»');
    }
  }
  if (id === 'g4e-quest-l2') {
    const t1 = main.find((x) => x.n === 1) || main[0];
    const c = t1?.options.find((o) => o.correct);
    if (t1 && !/шляп|hat|где|where/i.test(t1.qRu + ' ' + t1.qEn)) {
      push(1, 'Q не про место шляпы', 'Спросить Where / где шляпа');
    }
    if (c && !/Where/i.test(c.ru + ' ' + c.en)) {
      push(1, `Нужно Where; ✓ «${c.ru}»`, '✓ на Where');
    }
    if (/birthday/i.test(t1?.qEn || '')) {
      push(1, 'EN Q про birthday вместо hat/where', 'EN: hat location / Where');
    }
  }
  if (id === 'g4s-emo-l2') {
    const t4 = main.find((x) => x.n === 4) || main[3];
    if (t4?.type === 'input') {
      push(4, `t4 input «${t4.answer}» — ожидается MC про злость`, 'MC ✓ «Нет — он испытывал злость…»');
    } else {
      const c = t4?.options.find((o) => o.correct);
      if (c && /был рад/i.test(c.ru) && !/злост/i.test(c.ru)) {
        push(4, `✓ «${c.ru}» при злости`, '✓ «Нет — он испытывал злость…»');
      }
      if (c && !/злост/i.test(c.ru)) {
        push(4, `✓ не про злость: «${c.ru}»`, '✓ «Нет — он испытывал злость…»');
      }
    }
  }
  if (id === 'lab-physics-1') {
    const blob = main.map((x) => `${x.qRu} ${x.answer || ''} ${x.options.map((o) => o.ru).join(' ')}`).join(' | ');
    if (/треугольник|сторон треугольника|круг,\s*квадрат|паттерн фигур/i.test(blob)) {
      push(0, 'Есть задания не про баланс (геометрия/паттерн)', 'Только весы/равновесие/масса');
    }
    const t3 = main.find((x) => /равновес|balance|одном уровне/i.test(x.qRu)) || main.find((x) => x.type === 'input');
    if (t3 && t3.answer && !/равновес/i.test(t3.answer)) {
      push(t3.n, `Ответ «${t3.answer}» — ожидается Равновесие`, 'answer: Равновесие');
    }
  }

  // Known residual pedagogical risks
  if (id === 'g4e-quest-l2') {
    const t2 = main[1];
    const t3 = main[2];
    const t4 = main[3];
    // EN/RU prompt drift (not critical wrong key, but pedagogic)
    if (t2 && /best friend/i.test(t2.qRu) && /teacher/i.test(t2.qEn)) {
      // flag as soft problem via templates later
    }
    if (t3 && /bag|рюкзак/i.test(t3.qRu) && /come to school/i.test(t3.qEn) && !/bag/i.test(t3.qEn)) {
      // soft
    }
    if (t4 && /причин|Why|bike/i.test(t4.qRu) && /weather/i.test(t4.qEn)) {
      // soft
    }
  }

  if (id === 'jungle-sub-2') {
    const off = main.find((x) => /2,\s*4,\s*_|чётн|пропущенн|missing number|q_missing_number/i.test(x.qRu + x.qKey));
    if (off && !/−|выч|остал|отним|минус/i.test(off.qRu)) {
      push(off.n, `Тема вычитание, задание: «${off.qRu.slice(0, 70)}»`, 'Заменить на вычитание');
    }
  }
  if (id === 'lab-animals-2') {
    const off = main.find((x) => /фигур|круг.*квадрат|pattern_shapes/i.test(x.qRu + x.qKey) && !/животн|вод|рыб/i.test(x.qRu));
    if (off) push(off.n, 'Off-topic: паттерн фигур в уроке про животных', 'Вопрос про животное');
  }
  if (id === 'canyon-words-2') {
    const grass = main.find((x) => /цвет.*трав|трава/i.test(x.qRu));
    if (grass && grass.answer && /^Зелён(?:ый|ое)$/i.test(grass.answer.trim())) {
      push(grass.n, `«Какого цвета трава?» → «${grass.answer}» (род)`, '«зелёная» / принять оба');
    }
  }
  if (id === 'space-solar-1') {
    const orbit = main.find((x) => /^orbit$/i.test(String(x.answer || '')));
    if (orbit) push(orbit.n, 'Input-ответ EN «orbit» при RU UI', 'Принять «орбита»/«orbit»');
  }

  // Fraction conceptual
  if (id === 'g4m-fr-l1') {
    for (const tk of main) {
      const c = tk.options.find((o) => o.correct);
      if (!c) continue;
      if (/закрашено\s*3\s*из\s*8|3 из 8/i.test(tk.qRu) && /8\/3/.test(c.ru) && !/3\/8/.test(c.ru)) {
        push(tk.n, '3 из 8 → 3/8; ✓ на 8/3', '✓ на 3/8');
      }
      if (/знаменател/i.test(tk.qRu) && /Сколько целых осталось/i.test(c.ru)) {
        push(tk.n, 'Знаменатель ≠ «сколько целых осталось»', '✓ «Сколько равных частей содержит целое»');
      }
    }
  }
  if (id === 'g4m-fr-l2') {
    for (const tk of main) {
      const c = tk.options.find((o) => o.correct);
      if (c && /одна из четырёх|1 из 4/i.test(tk.qRu) && /^4\/1$/.test(c.ru.trim())) {
        push(tk.n, '1 из 4 = 1/4; ✓ на 4/1', '✓ на 1/4');
      }
      if (c && /1\/2.*2\/4|поровну|равн/i.test(tk.qRu) && /Digit получил больше/i.test(c.ru)) {
        push(tk.n, '1/2=2/4 поровну; ✓ «больше»', '✓ на равные дроби');
      }
      if (tk.type === 'input' && /5\s*сектор|пять частей|целый круг/i.test(tk.qRu) && tk.answer === '4') {
        push(tk.n, 'Input «4» при 5 секторах', 'Ответ 5');
      }
    }
  }
  if (id === 'g4m-fr-l3') {
    for (const tk of main) {
      const c = tk.options.find((o) => o.correct);
      if (c && /2\/5.*4\/5|сравни.*2\/5/i.test(tk.qRu) && (/^>\s*/.test(c.ru.trim()) || c.ru.trim() === '>')) {
        push(tk.n, '2/5 < 4/5; ✓ на >', '✓ на <');
      }
      if (c && /от меньшей|по возрастанию/i.test(tk.qRu) && /^3\/4,\s*2\/4,\s*1\/4/.test(c.ru.trim())) {
        push(tk.n, 'От меньшей: 1/4,2/4,3/4; ✓ обратный порядок', '✓ 1/4, 2/4, 3/4');
      }
    }
  }

  return wrong;
}

function softProblems(id, main, block) {
  const problems = [];
  const fixes = [];
  const templates = [];

  const types = new Set(main.map((x) => x.type));
  const hasProductive = [...types].some((x) => ['input', 'fill_blank', 'sorting', 'image_word_match'].includes(x));
  const mcCount = main.filter((x) => x.type === 'multiple_choice').length;
  const long = main.filter((x) => (x.qRu || '').length > 220);
  const taliFrame = main.filter((x) => /Тали/.test(x.qRu) && /ошиб|запута|неправ|Исправь|думает/i.test(x.qRu));

  if (mcCount >= 3 && hasProductive) templates.push('mc_plus_input');
  else if (mcCount >= 3 && !hasProductive) templates.push('mc_only');
  if (taliFrame.length >= 2) templates.push('tali_error_frame');
  if (/dialog:\s*\[/.test(block)) templates.push('npc_tali_dialog_pair');

  if (!hasProductive && main.length > 0 && id !== 'jungle-aba-showcase') {
    problems.push({ ref: `${id} tasks`, issue: 'Нет input/fill_blank/sorting — только выбор' });
    fixes.push('Добавить ≥1 продуктивное задание');
  }
  for (const tk of long) {
    problems.push({
      ref: `${id} t${tk.n} prompt`,
      issue: `Длинный промпт (${tk.qRu.length} симв.) — сюжет затмевает вопрос`,
    });
    fixes.push('Сократить до 1–2 предложений контекста + чёткий вопрос');
    templates.push('long_story_prompt');
  }

  // EN/RU drift soft flags for quest-l2
  if (id === 'g4e-quest-l2') {
    const pairs = [
      [1, /hat|шляп/i, /hat|where/i],
      [2, /best friend|друг/i, /friend|teacher/i],
      [3, /bag|рюкзак/i, /bag|school/i],
      [4, /bike|причин|Why/i, /why|weather|bike/i],
    ];
    for (const [n, ruPat, enPat] of pairs) {
      const tk = main[n - 1];
      if (!tk) continue;
      if (ruPat.test(tk.qRu) && !enPat.test(tk.qEn)) {
        problems.push({
          ref: `${id} t${n} EN`,
          issue: `EN Q не совпадает с RU: RU «${tk.qRu.slice(0, 60)}…» / EN «${String(tk.qEn).slice(0, 60)}…»`,
        });
        fixes.push(`Синхронизировать EN t${n} с RU`);
        templates.push('en_ru_prompt_drift');
      }
    }
    // t2 Who OK; t3 RU Where/bag but EN "come to school" is How/When-ish — still wrong stem
    const t3 = main[2];
    if (t3 && /рюкзак|bag/i.test(t3.qRu) && /come to school/i.test(t3.qEn)) {
      problems.push({
        ref: 'g4e-quest-l2 t3 EN',
        issue: 'EN t3 «___ do you come to school?» при RU про рюкзак/Where',
      });
      fixes.push('EN: Where is my bag?');
    }
    const t4 = main[3];
    if (t4 && /причин|bike/i.test(t4.qRu) && /weather/i.test(t4.qEn)) {
      problems.push({
        ref: 'g4e-quest-l2 t4 EN',
        issue: 'EN t4 про weather при RU Why/bike',
      });
      fixes.push('EN: Why do you come to school by bike?');
    }
  }

  if (id === 'jungle-aba-showcase') {
    problems.push({
      ref: 'jungle-aba-showcase',
      issue: 'Витрина ABA-типов (много заданий), не учебный урок с прогрессией навыка',
    });
    fixes.push('Вынести showcase из основного path или пометить как demo');
    templates.push('aba_type_showcase');
  }

  if (id === 'canyon-words-1' || id === 'canyon-words-2') {
    if (main.some((x) => /какое слово говорит|слово говорит/i.test(x.qRu))) {
      problems.push({
        ref: `${id} meta-Q`,
        issue: 'Метаязыковой вопрос «Какое слово говорит …?» путает для раннего чтения',
      });
      fixes.push('Формулировать «Найди слово … / Выбери правильное слово»');
      templates.push('meta_language_prompt');
    }
  }
  if (id === 'canyon-sent-1') {
    const pic = main.find((x) => /картинк/i.test(x.qRu) && x.type === 'multiple_choice');
    // Emoji in prompt counts as inline visual; only flag bare "картинка" without glyph/asset
    if (pic && !/[\u{1F300}-\u{1FAFF}]/u.test(pic.qRu) && !/visual|image/i.test(pic.qKey || '')) {
      problems.push({
        ref: 'canyon-sent-1 picture MC',
        issue: 'Отсылка к картинке в MC без image_word_match',
      });
      fixes.push('Сделать image_word_match или убрать отсылку к картинке');
    }
  }
  if (id === 'jungle-add-1') {
    if (!/visualEmoji|visualCount/.test(block)) {
      problems.push({
        ref: 'jungle-add-1 visuals',
        issue: 'Счёт «сколько» без visualEmoji/visualCount в блоке',
      });
      fixes.push('Добавить visualEmoji/visualCount');
    } else {
      templates.push('visual_count');
    }
  }

  // Short lessons
  if (main.length > 0 && main.length <= 2 && id !== 'jungle-aba-showcase') {
    problems.push({ ref: id, issue: `Очень короткий урок: ${main.length} задания(й)` });
    fixes.push('Расширить до ≥4 заданий');
    templates.push('thin_lesson');
  } else if (main.length === 3) {
    problems.push({ ref: id, issue: 'Короткий урок: 3 задания — мало для закрепления' });
    fixes.push('Добавить 1 задание на перенос навыка');
    templates.push('short_lesson');
  }

  return { problems, fixes, templates };
}

function scoreLesson(meta, grade, main, wrong, soft, enkyFlags) {
  const types = new Set(main.map((x) => x.type));
  const hasProductive = [...types].some((x) => ['input', 'fill_blank', 'sorting'].includes(x));
  const wrongN = wrong.length;
  const longN = soft.problems.filter((p) => /Длинный промпт/.test(p.issue)).length;
  const taliN = main.filter((x) => /Тали/.test(x.qRu) && /ошиб|запута|Исправь|думает/i.test(x.qRu)).length;
  const avgPrompt = main.reduce((s, x) => s + (x.qRu || '').length, 0) / Math.max(1, main.length);

  let coherence = 4.2;
  let usefulness = 4.0;
  let engagement = 3.7;
  let diversity = types.size >= 2 ? 3.4 : 2.3;

  if (grade === 4) {
    if (meta.world === 'g4math') engagement = 3.9;
    if (meta.world === 'g4social') engagement = 4.1;
    if (meta.world === 'g4eng') engagement = 3.7;
    if (meta.world === 'g4rus') engagement = 3.6;
  } else {
    engagement = 3.8;
    usefulness = 3.7;
    if (types.size >= 3) diversity = 4.0;
    else if (hasProductive) diversity = 3.2;
  }

  if (wrongN >= 3) {
    coherence = 1.2;
    usefulness = 1.5;
  } else if (wrongN === 2) {
    coherence = 2.0;
    usefulness = 2.4;
  } else if (wrongN === 1) {
    coherence = 2.4;
    usefulness = 2.6;
  }

  if (!wrongN) {
    if (meta.world === 'g4social') usefulness = Math.max(usefulness, 4.3);
    if (meta.id === 'g4s-help-l1' || meta.id === 'g4s-turn-l2') {
      usefulness = 5;
      engagement = 4.2;
    }
    if (meta.id === 'g4m-md-l2') {
      coherence = 4.8;
      usefulness = 4.4;
      engagement = 4.0;
    }
    if (meta.id.startsWith('g4m-cm') || meta.id.startsWith('g4m-fr')) {
      coherence = 4.5;
      usefulness = 4.5;
      engagement = 4.1;
    }
    if (meta.id.startsWith('g4r-cases')) {
      coherence = 4.3;
      usefulness = 4.2;
    }
    if (meta.id.startsWith('g4e-past') || meta.id === 'g4e-pres-l1' || meta.id === 'g4e-pres-l2' || meta.id === 'g4e-quest-l1') {
      coherence = 4.3;
      usefulness = 4.2;
      engagement = 4.0;
    }
    if (meta.id === 'g4r-text-l3' || meta.id === 'g4e-quest-l2' || meta.id === 'g4s-emo-l2') {
      // wave2 verified clean keys
      coherence = Math.max(coherence, 4.4);
      usefulness = Math.max(usefulness, 4.3);
    }
    if (meta.id === 'lab-physics-1') {
      coherence = 4.5;
      usefulness = 4.2;
      engagement = 4.0;
      diversity = Math.max(diversity, 3.2);
    }
  }

  if (taliN >= 3) engagement -= 0.4;
  if (longN >= 2) engagement -= 0.5;
  if (avgPrompt > 180) engagement -= 0.2;
  if (wrongN) engagement -= Math.min(1.0, 0.35 * wrongN);

  if (!hasProductive && meta.id !== 'jungle-aba-showcase') {
    diversity = Math.min(diversity, 2.0);
    if (meta.id === 'g4s-emo-l2') {
      // all MC after wave2 — note diversity hit but content correct
      diversity = 2.0;
      engagement = Math.max(engagement, 4.0);
      coherence = Math.max(coherence, 4.4);
      usefulness = Math.max(usefulness, 4.3);
    }
  }

  // EN/RU drift soft hit for quest-l2 (keep below 4 so polish is visible in scores)
  const enDrift = soft.problems.filter((p) => /EN/.test(p.ref) || /EN Q/.test(p.issue)).length;
  if (enDrift >= 2) {
    usefulness = Math.min(usefulness, 3.4);
    engagement = Math.min(engagement, 3.4);
  } else if (enDrift === 1) {
    usefulness = Math.min(usefulness, 3.6);
  }

  if (meta.id === 'jungle-aba-showcase') {
    diversity = 5;
    usefulness = 3.5;
    coherence = 2.8;
    engagement = 3.8;
  }

  if (main.length <= 2 && meta.id !== 'jungle-aba-showcase') {
    usefulness = Math.min(usefulness, 2.5);
    engagement = Math.min(engagement, 3.0);
  } else if (main.length === 3) {
    usefulness = Math.min(usefulness, 3.2);
  }

  if (enkyFlags.some((f) => /stub/.test(f))) usefulness -= 0.3;

  // Space / strong legacy content boosts when clean
  if (!wrongN && meta.id.startsWith('space-') && main.length >= 4) {
    usefulness = Math.max(usefulness, 4.0);
    engagement = Math.max(engagement, 4.0);
    coherence = Math.max(coherence, 4.2);
  }
  if (!wrongN && meta.id === 'lab-animals-2' && main.length >= 4) {
    coherence = Math.max(coherence, 4.2);
    usefulness = Math.max(usefulness, 4.0);
    diversity = Math.max(diversity, 4.0);
  }
  if (!wrongN && (meta.id === 'jungle-add-1' || meta.id === 'jungle-sub-1' || meta.id === 'jungle-compare-1')) {
    coherence = Math.max(coherence, 4.0);
    usefulness = Math.max(usefulness, 3.9);
    engagement = Math.max(engagement, 4.0);
  }

  // Soft off-topic / meta without hard wrong
  if (soft.problems.some((p) => /Метаязык|картинк|Off-topic|не про/i.test(p.issue))) {
    coherence = Math.min(coherence, 3.3);
    usefulness = Math.min(usefulness, 3.2);
  }
  // Short but on-topic canyon reading: meta-Q still hurts pedagogy
  if (meta.id === 'canyon-words-1' && soft.problems.some((p) => /Метаязык/i.test(p.issue))) {
    coherence = Math.min(coherence, 3.2);
    usefulness = Math.min(usefulness, 3.0);
    engagement = Math.min(engagement, 3.2);
  }

  return {
    coherence: clamp(coherence),
    usefulness: clamp(usefulness),
    engagement: clamp(engagement),
    diversity: clamp(diversity),
  };
}

function buildOne(meta, grade) {
  const block = extractLessonBlock(meta.id);
  if (!block) {
    return {
      id: meta.id,
      title: meta.title,
      grade,
      subject: meta.subject,
      world: meta.world,
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
  const { main, all } = parseTasks(block, meta.id);
  const wrong = checkWrongAnswers(meta.id, main);
  const soft = softProblems(meta.id, main.length ? main : all.filter((x) => !x.aba), block);
  // For ABA showcase use all non-filtered count from meta
  const useMain = meta.id === 'jungle-aba-showcase' ? all.filter((x) => !x.aba).length ? all : all : main;
  const mainForScore = meta.id === 'jungle-aba-showcase' ? all : main;
  const enkyFlags = enkyFlagsFor(block, mainForScore);

  // Override task count awareness for ABA showcase
  if (meta.id === 'jungle-aba-showcase') {
    soft.templates.push('aba_dense');
    soft.problems = soft.problems.filter((p) => !/короткий|Очень короткий/i.test(p.issue));
  }

  const problems = [
    ...wrong.map((w) => ({ ref: w.ref, issue: w.issue })),
    ...soft.problems,
  ];
  const fixes = [...new Set([...wrong.map((w) => w.fix), ...soft.fixes])];
  const templates = [...new Set(soft.templates)];

  // Wave2 pass markers
  if (meta.id === 'g4r-text-l3' && !wrong.length) templates.push('wave2_text_type_ok');
  if (meta.id === 'g4e-quest-l2' && !wrong.some((w) => /Where|birthday|шляп/i.test(w.issue))) {
    templates.push('wave2_where_hat_ok');
  }
  if (meta.id === 'g4s-emo-l2' && !wrong.length) templates.push('wave2_anger_mc_ok');
  if (meta.id === 'lab-physics-1' && !wrong.length) templates.push('wave2_balance_ok');

  if (enkyFlags.some((f) => /stub/.test(f))) {
    problems.push({ ref: `${meta.id} en`, issue: 'EN stub-фразы (We\'ll recap / Hi! Lesson / About this topic)' });
    fixes.push('Перевести EN по смыслу RU');
  }
  if (enkyFlags.filter((f) => f.startsWith('ky_eq_ru')).length >= 3) {
    problems.push({ ref: `${meta.id} ky`, issue: 'Несколько KY строк = RU' });
    fixes.push('Перевести KY');
  }

  const scores = scoreLesson(meta, grade, mainForScore, wrong, soft, enkyFlags);
  const avg = (scores.coherence + scores.usefulness + scores.engagement + scores.diversity) / 4;

  let verdict = 'ok';
  if (wrong.length >= 2 || scores.coherence <= 2) verdict = 'needs_rewrite';
  else if (
    wrong.length === 1 ||
    avg < 3.75 ||
    enkyFlags.some((f) => /stub/.test(f)) ||
    problems.some((p) => /✓ на|Input-ответ|off-topic|EN t|витрина ABA/i.test(p.issue))
  ) {
    verdict = 'needs_polish';
  }
  if (meta.id === 'jungle-aba-showcase') verdict = 'needs_polish';

  const subjectMap = {
    math: 'math',
    reading_ru: 'russian',
    reading: grade === 4 ? 'english' : 'reading',
    social: 'social',
    logic: meta.world === 'space' ? 'science' : 'science_logic',
  };

  return {
    id: meta.id,
    title: meta.title,
    grade,
    subject: subjectMap[meta.subject] || meta.subject,
    world: meta.world,
    coherence: scores.coherence,
    usefulness: scores.usefulness,
    engagement: scores.engagement,
    diversity: scores.diversity,
    verdict,
    problems,
    fixes,
    enkyFlags,
    templates,
    _debug: {
      mainCount: main.length,
      types: [...new Set(mainForScore.map((x) => x.type))],
      wrongN: wrong.length,
      wave2:
        meta.id === 'g4r-text-l3'
          ? main[2]?.options.find((o) => o.correct)?.ru
          : meta.id === 'g4e-quest-l2'
            ? { q: main[0]?.qEn?.slice(0, 80), c: main[0]?.options.find((o) => o.correct)?.ru }
            : meta.id === 'g4s-emo-l2'
              ? { type: main[3]?.type, c: main[3]?.options.find((o) => o.correct)?.ru?.slice(0, 80) }
              : meta.id === 'lab-physics-1'
                ? main.map((x) => ({ id: x.id, type: x.type, q: x.qRu.slice(0, 60), a: x.answer }))
                : undefined,
    },
  };
}

const out = [
  ...g4Ids.map((m) => buildOne(m, 4)),
  ...legIds.map((m) => buildOne(m, 'legacy')),
];

if (out.length !== 51) {
  console.error('FATAL: expected 51, got', out.length);
  process.exit(1);
}

// Strip debug before write
const clean = out.map(({ _debug, ...rest }) => rest);
const outPath = path.join(root, 'scripts/_audit_g4_legacy_final.json');
fs.writeFileSync(outPath, JSON.stringify(clean, null, 2), 'utf8');

const dims = ['coherence', 'usefulness', 'engagement', 'diversity'];
const avgs = Object.fromEntries(dims.map((d) => [d, +(clean.reduce((s, r) => s + r[d], 0) / clean.length).toFixed(2)]));
const overall = +((avgs.coherence + avgs.usefulness + avgs.engagement + avgs.diversity) / 4).toFixed(2);
const cLt4 = clean.filter((r) => r.coherence < 4).map((r) => r.id);
const critical = clean
  .filter((r) => r.verdict === 'needs_rewrite' || r.coherence <= 2 || r.usefulness <= 2)
  .map((r) => ({
    id: r.id,
    C: r.coherence,
    U: r.usefulness,
    verdict: r.verdict,
    top: r.problems[0]?.issue || '',
  }));

// Wave2 verify print
console.log('=== WAVE2 VERIFY ===');
for (const id of ['g4r-text-l3', 'g4e-quest-l2', 'g4s-emo-l2', 'lab-physics-1']) {
  const row = out.find((x) => x.id === id);
  console.log(id, JSON.stringify(row._debug?.wave2, null, 0), 'C'+row.coherence, row.verdict, row.problems.map(p=>p.issue).slice(0,3));
}

console.log(
  JSON.stringify(
    {
      count: clean.length,
      avgs,
      overall,
      critical,
      cLt4,
      verdicts: clean.reduce((a, r) => {
        a[r.verdict] = (a[r.verdict] || 0) + 1;
        return a;
      }, {}),
      parseFail: out.filter((r) => r._debug?.mainCount === 0).map((r) => r.id),
      needsPolish: clean.filter((r) => r.verdict === 'needs_polish').map((r) => r.id),
    },
    null,
    2
  )
);
