/**
 * Add incorrect-feedback strings for high-value misconception tasks.
 * Run: node scripts/patch-incorrect-feedback.mjs
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const entries = {
  mc10l1_t2: {
    ru: 'Попробуй ещё! На дереве 6 птичек, на кустике — 4. Где число больше? 6 больше 4, даже если куст ближе.',
    en: 'Try again! There are 6 birds in the tree and 4 on the bush. Which number is bigger? 6 is more than 4 — even if the bush looks closer.',
    ky: 'Кайра аракет кыл! Даракта 6 куш, бадалда — 4. Кайсы сан чоңураак? 6 саны 4төн чоң — бадал жакын көрүнгөнү менен.',
  },
  g4m_md_l1_t3: {
    ru: 'Подумай ещё: в числе 7 304 разряды — тысячи, сотни, десятки, единицы. Цифра 3 стоит в разряде сотен.',
    en: 'Think again: in 7 304 the places are thousands, hundreds, tens, ones. The digit 3 is in the hundreds place.',
    ky: 'Дагы ойлон: 7 304 санында миңдик, жүздүк, ондук, бирдик. 3 саны жүздүк разрядында турат.',
  },
  g4m_md_l1_t1: {
    ru: 'Прочитай по разрядам: 3 тысячи, 4 сотни, 7 десятков, 5 единиц — три тысячи четыреста семьдесят пять.',
    en: 'Read by place value: 3 thousands, 4 hundreds, 7 tens, 5 ones — three thousand four hundred seventy-five.',
    ky: 'Разряд боюнча оку: 3 миң, 4 жүз, 7 он, 5 бирдик — үч миң төрт жүз жетимиш беш.',
  },
  g4m_md_l3_t1: {
    ru: 'Сравни поразрядно: 8 540 и 8 450. Тысячи одинаковые, а сотни: 5 больше 4 — значит 8 540 больше.',
    en: 'Compare place by place: 8 540 and 8 450. Thousands match, but hundreds: 5 is more than 4 — so 8 540 is larger.',
    ky: 'Разряд боюнча салыштыр: 8 540 жана 8 450. Миңдиктер бирдей, ал эми жүздүк: 5 > 4 — демек 8 540 чоңураак.',
  },
  g4s_emo_l1_t1: {
    ru: 'Посмотри на признаки: опущенные плечи и тихий голос чаще всего говорят о грусти, а не о радости.',
    en: 'Look at the clues: slumped shoulders and a quiet voice usually mean sadness, not joy.',
    ky: 'Белгилерге кара: салбыраган ийиндер жана тынч үн көбүнчө кайгыны билдирет, кубанычты эмес.',
  },
  g4s_emo_l1_t3: {
    ru: 'Фраза «Не грусти!» иногда звучит как приказ. Часто лучше просто побыть рядом и поддержать.',
    en: 'Saying “Don’t be sad!” can feel like an order. Often it’s kinder to stay close and support quietly.',
    ky: '«Капа болбо!» деген сөз буйруктай угулушу мүмкүн. Көп учурда жанында болуп, тынч колдоо жакшыраак.',
  },
  g4r_conj_l1_t3: {
    ru: '«Идёт» — это он/она/оно (третье лицо), не «ты» (второе). Пример: мальчик идёт.',
    en: '“Идёт” is he/she/it (3rd person), not “you” (2nd). Example: the boy is walking — мальчик идёт.',
    ky: '«Идёт» — ал/ал (үчүнчү жак), «сен» (экинчи жак) эмес. Мисалы: мальчик идёт.',
  },
  mc5l3_t1: {
    ru: 'Давай сравним: где предметов больше? Посчитай ещё раз в каждой группе.',
    en: 'Let’s compare: which group has more? Count each group again carefully.',
    ky: 'Салыштыралы: кайсы топто көбүрөөк? Ар бир топту дагы бир жолу сана.',
  },
  mc10l2_t3: {
    ru: 'Посмотри на ряд чисел и найди правило — на сколько увеличивается каждый раз?',
    en: 'Look at the number pattern — how much does it grow each time?',
    ky: 'Сандардын катарына кара — ар жолу канчага өсүп жатат?',
  },
};

const taskIdMap = {
  mc10l1_t2: 'mc10l1-t2',
  g4m_md_l1_t3: 'g4m-md-l1-t3',
  g4m_md_l1_t1: 'g4m-md-l1-t1',
  g4m_md_l3_t1: 'g4m-md-l3-t1',
  g4s_emo_l1_t1: 'g4s-emo-l1-t1',
  g4s_emo_l1_t3: 'g4s-emo-l1-t3',
  g4r_conj_l1_t3: 'g4r-conj-l1-t3',
  mc5l3_t1: 'mc5l3-t1',
  mc10l2_t3: 'mc10l2-t3',
};

const defaults = {
  ru: 'Пока не так. Давай подумаем ещё раз — что в задании самое важное?',
  en: 'Not quite. Let’s think again — what is the most important clue in the question?',
  ky: 'Азырынча туура эмес. Дагы ойлонуп көрөлү — суроодогу эң маанилүү белги кайсы?',
};

for (const loc of /** @type {const} */ (['ru', 'en', 'ky'])) {
  const p = path.join(root, 'src', 'i18n', 'locales', `${loc}.json`);
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  data.data.taskFeedback ??= {};
  data.data.taskFeedback.byTaskId ??= {};
  for (const [key, langs] of Object.entries(entries)) {
    const cur = data.data.taskFeedback.byTaskId[key] || {};
    data.data.taskFeedback.byTaskId[key] = { ...cur, incorrect: langs[loc] };
  }
  data.lesson.standardIncorrect = defaults[loc];
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

const tfPath = path.join(root, 'src', 'data', 'taskFeedbackKeys.generated.ts');
let tf = fs.readFileSync(tfPath, 'utf8');

for (const [fbKey, taskId] of Object.entries(taskIdMap)) {
  const incorrectRef = `incorrectFeedbackKey: 'data.taskFeedback.byTaskId.${fbKey}.incorrect'`;
  if (tf.includes(`'${taskId}'`)) {
    tf = tf.replace(new RegExp(`('${taskId}'\\s*:\\s*\\{[^}]*)(\\})`), (m, a, b) => {
      if (a.includes('incorrectFeedbackKey')) return m;
      return `${a.trimEnd()}, ${incorrectRef} ${b}`;
    });
  } else {
    tf = tf.replace(
      /\n\};\s*$/,
      `\n  '${taskId}': { correctFeedbackKey: 'data.taskFeedback.byTaskId.${fbKey}.correct', ${incorrectRef} },\n};\n`,
    );
  }
}

fs.writeFileSync(tfPath, tf, 'utf8');
console.log('Patched incorrect feedback for', Object.keys(taskIdMap).length, 'tasks');
