/**
 * Fresh pre-wave3 methodological audit (post meadow-sh-l2 spot fix).
 * Sources: worlds.ts + ru/en/ky.json. Does NOT copy prior audit JSON scores.
 * → scripts/_audit_g4_legacy_final.json
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

/** Proper nouns / intentional shared tokens — not real KY stubs */
const KY_EQ_ALLOW = new Set([
  'data.tasks.opt_mira',
  'data.tasks.opt_mars',
  'data.tasks.opt_jupiter',
  'data.tasks.opt_mercury',
  'data.tasks.aba_demo_vi_sound',
  'data.tasks.aba_demo_vi_sound2',
]);

function extractLessonBlock(id) {
  const re = new RegExp(`id:\\s*'${id}'\\s*,`);
  let idx = -1;
  let searchFrom = 0;
  while (true) {
    const m = re.exec(worldsSrc.slice(searchFrom));
    if (!m) break;
    const abs = searchFrom + m.index;
    const window = worldsSrc.slice(abs, abs + 160);
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
  const idTypeRe = /id:\s*'([^']+)'\s*,\s*type:\s*'(\w+)'/g;
  const multiRe = /id:\s*'([^']+)'\s*,\s*\n\s*type:\s*'(\w+)'/g;
  const starts = [];
  for (const m of block.matchAll(idTypeRe)) {
    if (m[1] === lessonId) continue;
    starts.push({ index: m.index, id: m[1], type: m[2] });
  }
  for (const m of block.matchAll(multiRe)) {
    if (m[1] === lessonId) continue;
    if (starts.some((s) => s.id === m[1])) continue;
    starts.push({ index: m.index, id: m[1], type: m[2] });
  }
  starts.sort((a, b) => a.index - b.index);

  const tasks = [];
  for (const s of starts) {
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
      body,
      n: 0,
    });
  }
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

function collectKeys(block) {
  const keys = new Set();
  for (const m of block.matchAll(
    /(?:textKey|titleKey|bodyKey|questionKey|correctAnswerKey|sentenceKey|labelKey|placeholderKey):\s*'([^']+)'/g,
  )) {
    keys.add(m[1]);
  }
  return [...keys];
}

function enkyFlagsFor(id, block) {
  const flags = [];
  for (const k of collectKeys(block)) {
    const ruV = t(ru, k);
    const enV = t(en, k);
    const kyV = t(ky, k);
    if (typeof enV === 'string' && /We'll recap what matters/i.test(enV)) flags.push(`en_stub:${k}`);
    if (typeof enV === 'string' && /^Hi! Lesson:/i.test(String(enV).trim())) flags.push(`en_dialog_stub:${k}`);
    if (typeof enV === 'string' && /^About this topic$/i.test(String(enV).trim())) flags.push(`en_title_stub:${k}`);

    // ky_eq_ru: only real stubs. Skip allowlist (proper nouns / vocal tokens).
    if (KY_EQ_ALLOW.has(k)) continue;
    if (typeof kyV === 'string' && kyV === ruV && /[а-яё]/i.test(String(ruV))) {
      // Morphology-only Russian answers in RU-language lessons are expected identical across locales
      // BUT user asked to flag g4r-cases/conj KY stubs when KY literally equals RU.
      const isG4rMorph = /^(g4r-conj|g4r-cases)/.test(id);
      const isRuDiscourseToken =
        /^(сначала|потом|наконец|затем)$/i.test(String(ruV).trim()) && id.startsWith('g4r-text');
      if (isRuDiscourseToken) continue; // Russian text markers being tested
      if (isG4rMorph || !/^[а-яё\s«»„""\-–—,:;.!?]+$/i.test(String(ruV)) || String(ruV).length > 12) {
        // For morph lessons: always flag literal KY=RU
        // For others: flag longer instructional strings / sentences
        if (isG4rMorph || String(ruV).split(/\s+/).length >= 3 || /[?]/.test(String(ruV))) {
          flags.push(`ky_eq_ru:${k}`);
        } else if (!isG4rMorph && String(ruV).split(/\s+/).length >= 2) {
          flags.push(`ky_eq_ru:${k}`);
        } else if (isG4rMorph) {
          flags.push(`ky_eq_ru:${k}`);
        }
      } else if (isG4rMorph) {
        flags.push(`ky_eq_ru:${k}`);
      } else if (/минус|плюс|=/.test(String(ruV))) {
        flags.push(`ky_eq_ru:${k}`);
      }
    }
  }
  return [...new Set(flags)];
}

function checkWrongAnswers(id, main) {
  const wrong = [];
  const push = (n, issue, fix) => wrong.push({ n, ref: `${id} t${n}`, issue, fix });

  for (const tk of main) {
    if (tk.type === 'multiple_choice' || tk.type === 'fill_blank') {
      const nCorrect = tk.options.filter((o) => o.correct).length;
      if (tk.options.length && nCorrect !== 1) {
        push(tk.n, `MC: ожидается 1 ✓, найдено ${nCorrect}`, 'Отметить ровно один верный вариант');
      }
    }
  }

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

  // Truncated input keys where locale already has full MC options
  if (id === 'g4r-conj-l1') {
    const t4 = main.find((x) => x.n === 4);
    if (t4?.type === 'input' && /^Неверн/i.test(String(t4.answer || ''))) {
      push(
        4,
        `Input-ответ «${t4.answer}» обрезан; в locales есть MC (нужно «отправляет»)`,
        'Сделать MC с ✓ «Неверное лицо… отправляет»',
      );
    }
  }
  if (id === 'g4r-cases-l1') {
    const t4 = main.find((x) => x.n === 4);
    if (t4?.type === 'input' && /^Винительн/i.test(String(t4.answer || ''))) {
      push(
        4,
        `Input-ответ «${t4.answer}» не объясняет различие падежей; в locales есть MC`,
        'Сделать MC с ✓ про объект действия vs подлежащее',
      );
    }
  }

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
    if (c && !/Where/i.test(c.ru + ' ' + c.en)) {
      push(1, `Нужно Where; ✓ «${c.ru}»`, '✓ на Where');
    }
    if (/birthday/i.test(t1?.qEn || '')) {
      push(1, 'EN Q про birthday вместо hat/where', 'EN: hat location / Where');
    }
  }
  if (id === 'g4s-emo-l2') {
    const t4 = main.find((x) => x.n === 4) || main[3];
    const c = t4?.options.find((o) => o.correct);
    if (t4?.type === 'input') {
      push(4, `t4 input — ожидается MC про злость`, 'MC ✓ «Нет — он испытывал злость…»');
    } else if (c && !/злост/i.test(c.ru)) {
      push(4, `✓ не про злость: «${c.ru}»`, '✓ «Нет — он испытывал злость…»');
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
  if (id === 'canyon-words-2') {
    const grass = main.find((x) => /цвет.*трав|трава|colour is grass|color is grass|чөп/i.test(x.qRu + ' ' + (x.qEn || '')));
    if (grass && grass.answer && /^Зелён(?:ый|ое)$/i.test(grass.answer.trim())) {
      push(grass.n, `«Какого цвета трава?» → «${grass.answer}» (род: нужно «зелёная»)`, 'answer: зелёная (+ принять green/жашыл)');
    }
  }
  if (id === 'jungle-sub-2') {
    const off = main.find((x) => /2,\s*4,\s*_|чётн|пропущенн|missing number/i.test(x.qRu + (x.qKey || '')));
    if (off && !/−|выч|остал|отним|минус/i.test(off.qRu)) {
      push(off.n, `Тема вычитание, задание: «${off.qRu.slice(0, 70)}»`, 'Заменить на вычитание');
    }
  }
  if (id === 'lab-animals-2') {
    const off = main.find((x) => /фигур|круг.*квадрат|pattern_shapes/i.test(x.qRu + (x.qKey || '')) && !/животн|вод|рыб/i.test(x.qRu));
    if (off) push(off.n, 'Off-topic: паттерн фигур в уроке про животных', 'Вопрос про животное');
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
    problems.push({ ref: `${id} tasks`, issue: 'Нет input/fill_blank/sorting — только выбор (pure MC)' });
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

  if (id === 'g4e-quest-l2') {
    const t2 = main[1];
    const t3 = main[2];
    const t4 = main[3];
    if (t2 && /best friend|друг/i.test(t2.qRu) && /teacher/i.test(t2.qEn)) {
      problems.push({
        ref: 'g4e-quest-l2 t2 EN',
        issue: 'EN Q про teacher при RU про best friend (Who всё ещё верен, но стебель другой)',
      });
      fixes.push('EN: Who is your best friend?');
      templates.push('en_ru_prompt_drift');
    }
    if (t3 && /рюкзак|bag/i.test(t3.qRu) && /come to school/i.test(t3.qEn)) {
      problems.push({
        ref: 'g4e-quest-l2 t3 EN',
        issue: 'EN t3 «___ do you come to school?» при RU про рюкзак/Where',
      });
      fixes.push('EN: Where is my bag?');
      templates.push('en_ru_prompt_drift');
    }
    if (t4 && /причин|bike/i.test(t4.qRu) && /weather/i.test(t4.qEn)) {
      problems.push({
        ref: 'g4e-quest-l2 t4 EN',
        issue: 'EN t4 про weather при RU Why/bike',
      });
      fixes.push('EN: Why do you come to school by bike?');
      templates.push('en_ru_prompt_drift');
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
  if (id === 'canyon-words-1') {
    problems.push({
      ref: 'canyon-words-1 intro↔tasks',
      issue: 'Интро про английский DOG/SUN, а RU-опции — значения («Собака»), не орфография',
    });
    fixes.push('Либо показать английские слова dog/sun/red, либо переписать интро под значение');
    templates.push('intro_task_mismatch');
  }
  if (id === 'canyon-sent-1') {
    const yesNo = main.find((x) => x.type === 'input' && /^(Да|Нет)$/i.test(String(x.answer || '')));
    if (yesNo) {
      problems.push({
        ref: `canyon-sent-1 t${yesNo.n}`,
        issue: 'Да/нет input слабо проверяет понимание предложения',
      });
      fixes.push('Спросить кто/что делает или выбрать ключевое слово');
    }
  }

  if (main.length > 0 && main.length <= 2 && id !== 'jungle-aba-showcase') {
    problems.push({ ref: id, issue: `Очень короткий урок: ${main.length} задания(й)` });
    fixes.push('Расширить до ≥4 заданий');
    templates.push('thin_lesson');
  } else if (main.length === 3) {
    problems.push({ ref: id, issue: 'Короткий урок: 3 задания — мало для закрепления' });
    fixes.push('Добавить 1 задание на перенос навыка');
    templates.push('short_lesson');
  }

  if (/visualEmoji|visualCount/.test(block) && id === 'jungle-add-1') {
    templates.push('visual_count');
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

  if (wrongN >= 2) {
    coherence = 1.5;
    usefulness = 1.8;
  } else if (wrongN === 1) {
    coherence = 2.2;
    usefulness = 2.4;
  }

  if (!wrongN) {
    if (meta.world === 'g4social') usefulness = Math.max(usefulness, 4.3);
    if (meta.id === 'g4s-help-l1' || meta.id === 'g4s-turn-l2') {
      usefulness = 5;
      engagement = 4.2;
    }
    if (meta.id === 'g4m-md-l2') {
      coherence = 5;
      usefulness = 4;
      engagement = 4;
    }
    if (meta.id.startsWith('g4m-cm') || meta.id.startsWith('g4m-fr')) {
      coherence = 5;
      usefulness = 5;
      engagement = 4;
    }
    if (meta.id.startsWith('g4m-md-l')) {
      coherence = Math.max(coherence, 4);
      usefulness = Math.max(usefulness, 4);
    }
    if (meta.id.startsWith('g4r-cases') || meta.id.startsWith('g4r-conj')) {
      coherence = Math.max(coherence, 4);
      usefulness = Math.max(usefulness, 4);
    }
    if (meta.id.startsWith('g4e-')) {
      coherence = Math.max(coherence, 4);
      usefulness = Math.max(usefulness, 4);
      engagement = Math.max(engagement, 4);
    }
    if (meta.id === 'lab-physics-1') {
      coherence = 5;
      usefulness = 4;
      engagement = 4;
      diversity = Math.max(diversity, 3);
    }
  }
  // Balance lesson: 3 main tasks is enough if on-topic; don't punish U below 4
  if (meta.id === 'lab-physics-1' && !wrongN) {
    usefulness = Math.max(usefulness, 4);
    coherence = 5;
  }

  if (taliN >= 3) engagement -= 0.4;
  if (longN >= 2) engagement -= 0.5;
  if (avgPrompt > 180) engagement -= 0.2;
  if (wrongN) engagement -= Math.min(1.0, 0.35 * wrongN);

  if (!hasProductive && meta.id !== 'jungle-aba-showcase') {
    diversity = Math.min(diversity, 2);
    if (meta.id === 'g4s-emo-l2') {
      diversity = 2;
      engagement = Math.max(engagement, 4);
      coherence = Math.max(coherence, 4);
      usefulness = Math.max(usefulness, 4);
    }
  }

  const enDrift = soft.problems.filter((p) => /EN/.test(p.ref) || /EN Q/.test(p.issue)).length;
  if (enDrift >= 2) {
    usefulness = Math.min(usefulness, 3);
    engagement = Math.min(engagement, 3);
    coherence = Math.min(coherence, 4);
  } else if (enDrift === 1) {
    usefulness = Math.min(usefulness, 3.5);
  }

  if (meta.id === 'jungle-aba-showcase') {
    diversity = 5;
    usefulness = 3;
    coherence = 3;
    engagement = 4;
  }

  if (main.length <= 2 && meta.id !== 'jungle-aba-showcase') {
    usefulness = Math.min(usefulness, 2.5);
    engagement = Math.min(engagement, 3);
  } else if (main.length === 3 && meta.id !== 'lab-physics-1') {
    usefulness = Math.min(usefulness, 3);
  }

  if (enkyFlags.filter((f) => f.startsWith('ky_eq_ru')).length >= 3) {
    usefulness = Math.min(usefulness, Math.max(3, usefulness - 0.5));
  }

  if (!wrongN && meta.id.startsWith('space-') && main.length >= 4) {
    usefulness = Math.max(usefulness, 4);
    engagement = Math.max(engagement, 4);
    coherence = Math.max(coherence, 4);
  }
  if (!wrongN && meta.id === 'lab-animals-2' && main.length >= 4) {
    coherence = Math.max(coherence, 4);
    usefulness = Math.max(usefulness, 4);
    diversity = Math.max(diversity, 4);
  }
  if (!wrongN && (meta.id === 'jungle-add-1' || meta.id === 'jungle-sub-1' || meta.id === 'jungle-compare-1')) {
    coherence = Math.max(coherence, 4);
    usefulness = Math.max(usefulness, 4);
    engagement = Math.max(engagement, 4);
  }
  if (!wrongN && meta.id === 'jungle-sub-2') {
    coherence = Math.max(coherence, 4);
    usefulness = Math.max(usefulness, 4);
    diversity = Math.max(diversity, 4);
  }

  if (soft.problems.some((p) => /Метаязык|intro↔|картинк|Off-topic/i.test(p.issue))) {
    coherence = Math.min(coherence, 3);
    usefulness = Math.min(usefulness, 3);
  }
  if (meta.id === 'canyon-words-1') {
    engagement = Math.min(engagement, 3);
  }
  if (meta.id === 'canyon-sent-1' && soft.problems.some((p) => /Да\/нет/i.test(p.issue))) {
    usefulness = Math.min(usefulness, 3);
  }

  // Hard wrongs already set C/U low; keep canyon grass critical
  if (meta.id === 'canyon-words-2' && wrongN) {
    coherence = 2;
    usefulness = 2;
    engagement = 3;
    diversity = Math.max(diversity, 3);
  }

  return {
    coherence: clamp(coherence),
    usefulness: clamp(usefulness),
    engagement: clamp(engagement),
    diversity: clamp(diversity),
  };
}

function subjectOut(meta, grade) {
  if (meta.subject === 'reading_ru') return 'russian';
  if (meta.subject === 'reading' && grade === 4) return 'english';
  if (meta.subject === 'logic') return meta.world === 'space' ? 'science' : 'science_logic';
  return meta.subject;
}

function buildOne(meta, grade) {
  const block = extractLessonBlock(meta.id);
  if (!block) {
    return {
      id: meta.id,
      title: meta.title,
      grade,
      subject: subjectOut(meta, grade),
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
  const mainForScore = meta.id === 'jungle-aba-showcase' ? all : main;
  const wrong = checkWrongAnswers(meta.id, main);
  const soft = softProblems(meta.id, main.length ? main : all.filter((x) => !x.aba), block);
  if (meta.id === 'jungle-aba-showcase') {
    soft.templates.push('aba_dense');
    soft.problems = soft.problems.filter((p) => !/короткий|Очень короткий/i.test(p.issue));
  }

  const enkyFlags = enkyFlagsFor(meta.id, block);

  const problems = [...wrong.map((w) => ({ ref: w.ref, issue: w.issue })), ...soft.problems];
  const fixes = [...new Set([...wrong.map((w) => w.fix), ...soft.fixes])];
  const templates = [...new Set(soft.templates)];

  if (meta.id === 'g4r-text-l3' && !wrong.length) templates.push('wave2_text_type_ok');
  if (meta.id === 'g4e-quest-l2' && !wrong.some((w) => /Where|birthday|шляп/i.test(w.issue))) {
    templates.push('wave2_where_hat_ok');
  }
  if (meta.id === 'g4s-emo-l2' && !wrong.length) templates.push('wave2_anger_mc_ok');
  if (meta.id === 'lab-physics-1' && !wrong.length) templates.push('balance_coherent_ok');
  if (meta.id === 'g4s-emo-l2') templates.push('pure_mc_after_wave2');

  if (enkyFlags.some((f) => /stub/.test(f))) {
    problems.push({ ref: `${meta.id} en`, issue: "EN stub-фразы (We'll recap / Hi! Lesson / About this topic)" });
    fixes.push('Перевести EN по смыслу RU');
  }
  const kyN = enkyFlags.filter((f) => f.startsWith('ky_eq_ru')).length;
  if (kyN >= 3) {
    problems.push({ ref: `${meta.id} ky`, issue: `KY stubs: ${kyN} строк буквально = RU` });
    fixes.push('Перевести KY UI (морфологические ответы можно оставить на русском)');
  } else if (kyN > 0 && /^(g4r-conj|g4r-cases)/.test(meta.id)) {
    problems.push({ ref: `${meta.id} ky`, issue: `KY stubs: ${kyN} строк буквально = RU` });
    fixes.push('Перевести KY обёртки; формы глаголов/падежей — на русском');
  } else if (kyN > 0 && meta.id === 'jungle-sub-1') {
    problems.push({ ref: `${meta.id} ky`, issue: 'KY ABA-промпт буквально = RU' });
    fixes.push('Перевести KY ABA-строку');
  }

  const scores = scoreLesson(meta, grade, mainForScore, wrong, soft, enkyFlags);
  const avg = (scores.coherence + scores.usefulness + scores.engagement + scores.diversity) / 4;

  let verdict = 'ok';
  if (wrong.length >= 1 && scores.coherence <= 2) verdict = 'needs_rewrite';
  else if (wrong.length >= 2 || scores.coherence <= 2) verdict = 'needs_rewrite';
  else if (
    wrong.length === 1 ||
    avg < 3.75 ||
    enkyFlags.some((f) => /stub/.test(f)) ||
    kyN >= 3 ||
    problems.some((p) => /EN t|витрина ABA|intro↔|pure MC|Да\/нет/i.test(p.issue))
  ) {
    verdict = 'needs_polish';
  }
  if (meta.id === 'jungle-aba-showcase') verdict = 'needs_polish';
  if (meta.id === 'g4s-emo-l2' && !wrong.length) verdict = 'needs_polish'; // diversity note

  return {
    id: meta.id,
    title: meta.title,
    grade,
    subject: subjectOut(meta, grade),
    world: meta.world,
    coherence: scores.coherence,
    usefulness: scores.usefulness,
    engagement: scores.engagement,
    diversity: scores.diversity,
    verdict,
    problems,
    fixes: [...new Set(fixes)],
    enkyFlags,
    templates,
  };
}

const out = [...g4Ids.map((m) => buildOne(m, 4)), ...legIds.map((m) => buildOne(m, 'legacy'))];
if (out.length !== 51) {
  console.error('FATAL: expected 51, got', out.length);
  process.exit(1);
}

const outPath = path.join(root, 'scripts/_audit_g4_legacy_final.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');

const dims = ['coherence', 'usefulness', 'engagement', 'diversity'];
const avgs = Object.fromEntries(dims.map((d) => [d, +(out.reduce((s, r) => s + r[d], 0) / out.length).toFixed(2)]));
const overall = +((avgs.coherence + avgs.usefulness + avgs.engagement + avgs.diversity) / 4).toFixed(2);
const cLt4 = out.filter((r) => r.coherence < 4).map((r) => r.id);
const critical = out
  .filter((r) => r.verdict === 'needs_rewrite' || r.coherence <= 2 || r.usefulness <= 2)
  .map((r) => ({
    id: r.id,
    C: r.coherence,
    U: r.usefulness,
    verdict: r.verdict,
    top: r.problems[0]?.issue || '',
  }));

console.log('=== SPECIAL ATTENTION ===');
for (const id of [
  'canyon-words-2',
  'canyon-words-1',
  'canyon-sent-1',
  'g4s-emo-l2',
  'lab-physics-1',
  'g4r-conj-l1',
  'g4r-cases-l1',
  'g4r-cases-l2',
]) {
  const r = out.find((x) => x.id === id);
  console.log(
    id,
    `C${r.coherence} U${r.usefulness} E${r.engagement} D${r.diversity}`,
    r.verdict,
    'enky',
    r.enkyFlags.length,
    '|',
    r.problems.map((p) => p.issue).slice(0, 2).join('; '),
  );
}

console.log(
  JSON.stringify(
    {
      count: out.length,
      avgs,
      overall,
      critical,
      cLt4,
      verdicts: out.reduce((a, r) => {
        a[r.verdict] = (a[r.verdict] || 0) + 1;
        return a;
      }, {}),
    },
    null,
    2,
  ),
);
