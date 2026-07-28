/**
 * Verify marked ✓ answers against computed/expected facts for g4 curriculum.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const lessons = JSON.parse(fs.readFileSync(path.join(root, 'scripts/_audit_g4_parsed.json'), 'utf8'));

const issues = [];

function add(id, n, issue) {
  issues.push({ id, n, issue });
}

for (const L of lessons) {
  for (const t of L._tasks || []) {
    const c = (t.options || []).find((o) => o.correct);
    const prompt = t.prompt || '';
    const opts = t.options || [];

    // Generic: extract A × B = ?
    const mul = prompt.match(/(\d[\d\s]*)\s*[×xX]\s*(\d[\d\s]*)/);
    if (mul && c) {
      const a = Number(mul[1].replace(/\s/g, ''));
      const b = Number(mul[2].replace(/\s/g, ''));
      if (Number.isFinite(a) && Number.isFinite(b)) {
        const expected = a * b;
        // find if any option equals expected
        const numOpts = opts.map((o) => ({
          ...o,
          num: Number(String(o.text).replace(/[^\d]/g, '')),
        }));
        const correctNum = Number(String(c.text).replace(/[^\d]/g, ''));
        const hasExpected = numOpts.find((o) => o.num === expected);
        if (hasExpected && correctNum !== expected && /=\s*\?|Помоги|Найди правильный|Сколько/.test(prompt)) {
          add(L.id, t.n, `Умножение ${a}×${b}=${expected}, но ✓ = «${c.text}» (число ${correctNum})`);
        }
      }
    }
  }
}

// Manual known checks from reading
const manual = [
  ['g4m-md-l1', 3, 'В 7304 цифра 3 — сотни, не тысячи'],
  ['g4m-md-l1', 4, '25600 читается «Двадцать пять тысяч шестьсот», не «Два миллиона…»'],
  ['g4m-md-l3', 1, '8540 > 8450, но ✓ на 8450'],
  ['g4m-md-l3', 3, '5008 < 5080; «Нельзя сравнить» неверно'],
  ['g4m-fr-l1', 2, 'Закрашено 3/8, не 8/3'],
  ['g4m-fr-l1', 3, 'Знаменатель = число равных частей целого, не «целых осталось»'],
  ['g4m-fr-l2', 1, 'Одна из четырёх = 1/4, не 4/1'],
  ['g4m-fr-l2', 3, '1/2 = 2/4 — поровну'],
  ['g4m-fr-l2', 4, 'Целый круг = 5 секторов из 5'],
  ['g4m-fr-l3', 2, '2/5 < 4/5, не >'],
  ['g4m-fr-l3', 3, 'Порядок от меньшей: 1/4, 2/4, 3/4'],
  ['g4r-conj-l1', 3, '«идёт» — 3-е лицо, не 1-е'],
  ['g4r-conj-l2', 2, 'Они → читают, не читает'],
  ['g4r-conj-l2', 3, 'Вы → знаете, не знают'],
  ['g4r-text-l3', 3, 'Описание камня — тип «описание», не «рассуждение»'],
];

for (const [id, n, issue] of manual) {
  const L = lessons.find((x) => x.id === id);
  const t = L?._tasks?.find((x) => x.n === n);
  const c = t?.options?.find((o) => o.correct);
  issues.push({ id, n, issue, marked: c?.text, prompt: t?.prompt?.slice(0, 100) });
}

// Speaker swap detection on _dialog
const speakerBugs = [];
for (const L of lessons) {
  const d = L._dialog || '';
  const lines = d.split('\n').filter((l) => l.startsWith('-'));
  for (const line of lines) {
    const sm = line.match(/\*\*([^*]+)\*\*:\s*(.*)/);
    if (!sm) continue;
    const sp = sm[1];
    const body = sm[2];
    // Character addresses self by name at start
    if (sp === 'Digit' && /^Digit,/.test(body)) speakerBugs.push({ id: L.id, issue: `Digit: «Digit,…» — ученик говорит от имени наставника` });
    if (sp === 'Слово' && /^Слово,/.test(body)) speakerBugs.push({ id: L.id, issue: `Слово: «Слово,…» — ученик в роли наставника` });
    if (sp === 'Spark' && /^Spark,/.test(body)) speakerBugs.push({ id: L.id, issue: `Spark: «Spark,…»` });
    if (sp === 'Тали' && /^(Тали,|Спокойно, Тали|Почти угадал, Тали)/.test(body)) {
      speakerBugs.push({ id: L.id, issue: `Тали говорит как наставник: «${body.slice(0, 70)}»` });
    }
  }
}

console.log('MUL / fact issues count', issues.length);
console.log(JSON.stringify(issues, null, 2));
console.log('\nSpeaker bugs:', speakerBugs.length);
console.log(JSON.stringify(speakerBugs, null, 2));

// Summarize per lesson wrong-key count
const byLesson = {};
for (const i of issues) {
  byLesson[i.id] = (byLesson[i.id] || 0) + 1;
}
console.log('\nWrong keys by lesson:', byLesson);
