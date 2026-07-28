// Apply high-impact curriculum locale fixes from reaudit2 worklist.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', 'src', 'i18n', 'locales');

function load(name) {
  return JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
}
function save(name, obj) {
  fs.writeFileSync(path.join(root, name), JSON.stringify(obj, null, 2) + '\n');
}

const ru = load('ru.json');
const en = load('en.json');
const ky = load('ky.json');
const fixes = [];

let leakCount = 0;
for (const [k, v] of Object.entries(ru.data.tasks)) {
  if (typeof v === 'string' && /_\(ответ[^)]*\)_/.test(v)) {
    ru.data.tasks[k] = v.replace(/\s*_\(ответ[^)]*\)_/g, '').trim();
    leakCount++;
  }
}
fixes.push(`ru.json: stripped _(ответ) leaks from ${leakCount} keys`);

for (const [k, v] of Object.entries(ru.data.tasks)) {
  if (typeof v === 'string' && /\*\(ответ[^)]*\)\*/.test(v)) {
    ru.data.tasks[k] = v.replace(/\s*\*\(ответ[^)]*\)\*/g, '').trim();
    fixes.push(`ru.json: stripped *(ответ) from ${k}`);
  }
}

function setTask(key, vals) {
  if (vals.ru != null) ru.data.tasks[key] = vals.ru;
  if (vals.en != null) en.data.tasks[key] = vals.en;
  if (vals.ky != null) ky.data.tasks[key] = vals.ky;
}
function setDialog(key, vals) {
  if (vals.ru != null) ru.data.dialog[key] = vals.ru;
  if (vals.en != null) en.data.dialog[key] = vals.en;
  if (vals.ky != null) ky.data.dialog[key] = vals.ky;
}

setDialog('g1m_c20l1_0', {
  ru: 'Привет! Я Лео из Города чисел — ворота откроются, если угадаем код из чисел 11–15. Поможешь?',
  en: 'Hi! I am Leo from Number City — the gate opens if we guess a code from numbers 11–15. Can you help?',
  ky: 'Салам! Мен Сандар шаарынан Лео — дарбаза 11–15 сандарынан кодду тапсак ачылат. Жардам бересиңби?',
});
setTask('g1m_c20l1_q2', {
  ru: 'Лео задаёт код: какое число стоит между 12 и 14?',
  en: 'Leo asks for the code: which number is between 12 and 14?',
  ky: 'Лео код берет: 12 менен 14дүн ортосунда кайсы сан?',
});
fixes.push('g1m-c20-l1: dialog + q2 format (no Правда? + numbers)');

setTask('g1m_subl3_q1', {
  ru: '5 + 4 − 3 = ? Сначала сложи, потом вычти!',
  en: '5 + 4 − 3 = ? First add, then subtract!',
  ky: '5 + 4 − 3 = ? Адегенде кош, андан кийин алып сал!',
});
setTask('g1m_subl3_q3', {
  ru: 'Проверка: 7 − 2 = 5, потому что 5 + 2 = 7. Верно?',
  en: 'Check: 7 − 2 = 5, because 5 + 2 = 7. Is that right?',
  ky: 'Текшерүү: 7 − 2 = 5, анткени 5 + 2 = 7. Туурабы?',
});
setTask('g1m_subl3_q3_a', {
  ru: 'Да, верно',
  en: 'Yes, that is correct',
  ky: 'Ооба, туура',
});
setTask('g1m_subl3_q3_b', {
  ru: 'Нет',
  en: 'No',
  ky: 'Жок',
});
fixes.push('g1m-sub-l3: q1 no wrong-method Правда?; q3 yes/no check');

setTask('q_missing_number', {
  ru: 'У Тали было 12 бананов, он отдал 7. Сколько осталось? 12 − 7 = ?',
  en: 'Tali had 12 bananas and gave away 7. How many are left? 12 − 7 = ?',
  ky: 'Талиде 12 банан болчу, ал 7син берди. Канча калды? 12 − 7 = ?',
});
fixes.push('jungle-sub-2: q_missing_number → subtraction 12-7');

setTask('lab_q_logic_pattern', {
  ru: 'Кто живёт в воде и плавает? Напиши животное.',
  en: 'Who lives in water and swims? Write the animal.',
  ky: 'Ким сууда жашап сүзөт? Жаныбарды жаз.',
});
fixes.push('lab-animals-2: pattern → water animal input');

setTask('q_match_picture', {
  ru: 'Какое слово подходит к картинке 🐶?',
  en: 'Which word matches the picture 🐶?',
  ky: 'Кайсы сөз 🐶 сүрөтүнө туура келет?',
});
fixes.push('canyon-sent-1: q_match_picture includes dog emoji');

setTask('nrw_gcoll1_t1_q', {
  ru: 'Тали нашёл в саду маленькую красную ягоду. Что это?',
  en: 'Tali found a small red berry in the garden. What is it?',
  ky: 'Тали бакчадан кичинекей кызыл жемиш тапты. Бул эмне?',
});
setTask('nrw_gcoll1_t4_q', {
  ru: 'Тали смотрит на небо днём. Какого оно цвета? Тали говорит: «Красное!» Прав ли он?',
  en: 'Tali looks at the daytime sky. What color is it? Tali says: "Red!" Is he right?',
  ky: 'Тали күндүз асманга карайт. Ал кандай түстө? Тали: «Кызыл!» дейт. Туурабы?',
});
setTask('nrw_gcoll1_t4_a', {
  ru: 'Да, красное',
  en: 'Yes, red',
  ky: 'Ооба, кызыл',
});
setTask('nrw_gcoll1_t4_b', {
  ru: 'Нет — небо синее!',
  en: 'No — the sky is blue!',
  ky: 'Жок — асман көк!',
});
setTask('nrw_gcoll1_t4_c', {
  ru: 'Зелёное, как трава',
  en: 'Green like grass',
  ky: 'Чөптөй жашыл',
});
fixes.push('garden-col-l1: t1 no Правда?/fruit options; t4 blue sky not orange carrot');

setTask('nrw_iabcl1_t3_q', {
  ru: 'Шпион спрятался в слове, которое НЕ начинается на B. Найди его!',
  en: 'A spy hid a word that does NOT start with B. Find it!',
  ky: 'Шпион B менен башталбаган сөзгө жашынды. Тап!',
});
setTask('nrw_iabcl1_t3_a', { ru: 'Ball ⚽', en: 'Ball ⚽', ky: 'Ball ⚽' });
setTask('nrw_iabcl1_t3_b', { ru: 'Banana 🍌', en: 'Banana 🍌', ky: 'Banana 🍌' });
setTask('nrw_iabcl1_t3_c', { ru: 'Apple 🍎', en: 'Apple 🍎', ky: 'Apple 🍎' });
fixes.push('island-abc-l1: t3 NOT start with B (Apple ✓)');

setTask('nrw_iabcl2_t2_q', {
  ru: 'Тали говорит: «DINOSAUR начинается на C!» Прав ли он?',
  en: 'Tali says: "DINOSAUR starts with C!" Is he right?',
  ky: 'Тали дейт: «DINOSAUR C менен башталат!» Туурабы?',
});
setTask('nrw_iabcl2_t2_a', { ru: 'Да', en: 'Yes!', ky: 'Ооба' });
setTask('nrw_iabcl2_t2_b', { ru: 'Нет, на D', en: 'No, it starts with D', ky: 'Жок, D менен' });
setTask('nrw_iabcl2_t3_q', {
  ru: 'Шпион спрятал слово, которое НЕ начинается на D. Найди его!',
  en: 'A spy hid a word that does NOT start with D. Find it!',
  ky: 'Шпион D менен башталбаган сөздү жашырды. Тап!',
});
setTask('nrw_iabcl2_t3_a', { ru: 'Dog 🐶', en: 'Dog 🐶', ky: 'Dog 🐶' });
setTask('nrw_iabcl2_t3_b', { ru: 'Duck 🦆', en: 'Duck 🦆', ky: 'Duck 🦆' });
setTask('nrw_iabcl2_t3_c', { ru: 'Cat 🐱', en: 'Cat 🐱', ky: 'Cat 🐱' });
setTask('nrw_iabcl2_t4_q', {
  ru: 'Тали видит утку на пруду! Какая первая буква у DUCK?',
  en: 'Tali spots a duck on the pond! What is the first letter of DUCK?',
  ky: 'Тали көлдөгү өрдөктү көрдү! DUCK кайсы тамга менен башталат?',
});
setTask('nrw_iabcl2_a1_q', {
  ru: 'DOG — first letter?',
  en: 'DOG — first letter?',
  ky: 'DOG — first letter?',
});
setTask('nrw_iabcl2_a1_a', { ru: 'D', en: 'D', ky: 'D' });
setTask('nrw_iabcl2_a1_b', { ru: 'C', en: 'C', ky: 'C' });
fixes.push('island-abc-l2: t2 EN aligned; t3 NOT D; ABA DOG; t4 leak removed');

setTask('g2s_sport_good', {
  ru: 'Арчи не хочет делать зарядку. Почему зарядка важна?',
  en: 'Archie does not want to exercise. Why is exercise important?',
  ky: 'Арчи зарядка кылгысы келбейт. Эмне үчүн зарядка маанилүү?',
});
setTask('g2s_sport_good_a', {
  ru: 'Укрепляет мышцы и сердце',
  en: 'It strengthens muscles and the heart',
  ky: 'Булчуңдарды жана жүрөктү бекемдейт',
});
setTask('g2s_sport_good_b', {
  ru: 'Чтобы есть больше печенья',
  en: 'So you can eat more cookies',
  ky: 'Көбүрөөк печенье жеш үчүн',
});
setTask('g2s_sport_good_c', {
  ru: 'Чтобы не пить воду',
  en: 'So you do not drink water',
  ky: 'Суу ичпөө үчүн',
});
fixes.push('g2s-bdy-l3: sport Q + MC options');

setTask('g2s_carrot_part', {
  ru: 'Тали купил морковь. Это овощ или фрукт?',
  en: 'Tali bought a carrot. Is it a vegetable or a fruit?',
  ky: 'Тали сабиз сатып алды. Бул жашылчабы же жемишби?',
});
setTask('g2s_opt_veg_cat', {
  ru: 'Овощ',
  en: 'Vegetable',
  ky: 'Жашылча',
});
setTask('g2s_opt_fruit_cat', {
  ru: 'Фрукт',
  en: 'Fruit',
  ky: 'Жемиш',
});
setTask('g2s_tomato_part', {
  ru: 'Арчи держит яблоко. Это овощ или фрукт?',
  en: 'Archie holds an apple. Is it a vegetable or a fruit?',
  ky: 'Арчи алма кармап турат. Бул жашылчабы же жемишби?',
});
fixes.push('g2s-plt-l3: t1/t2 vegetable vs fruit');

setTask('g4s_help2_q4', {
  ru: 'Тали спрашивает Friendly: «Какое слово делает просьбу вежливой почти как волшебство?» Friendly улыбается. Тали думает, что это «сейчас же». Поправь Тали!',
  en: 'Tali asks Friendly: "Which word makes a request polite, almost like magic?" Friendly smiles. Tali thinks it is "right now". Correct Tali!',
  ky: 'Тали Friendlyден сурайт: «Кайсы сөз өтүнүчтү сылык кылат?» Friendly жылмайат. Тали ойлонот: «азыр эле». Талини оңдо!',
});
setTask('g4s_help2_q4_a', { ru: 'пожалуйста', en: 'please', ky: 'сураныч' });
setTask('g4s_help2_q4_b', { ru: 'сейчас же', en: 'right now', ky: 'азыр эле' });
setTask('g4s_help2_q4_c', { ru: 'быстрее', en: 'faster', ky: 'тезирээк' });
fixes.push('g4s-help-l2: EN/KY aligned; answer пожалуйста');

// g2s-ani-l3: strengthen fish via clearer t4 prompt (yes/no already ok)
setTask('g2s_insect_is_butterfly', {
  ru: ru.data.tasks.g2s_insect_is_butterfly || 'Бабочка — это насекомое?',
});
// Use existing key if present; otherwise leave. Add fish-focused MC keys for t4 conversion in worlds.
setTask('g2s_anil3_q4', {
  ru: 'Рыба живёт в воде и дышит жабрами. Правда?',
  en: 'A fish lives in water and breathes with gills. True?',
  ky: 'Балык сууда жашап, жабры менен дем алат. Туурабы?',
});
fixes.push('g2s-ani-l3: fish yes/no t4 prompt keys');

save('ru.json', ru);
save('en.json', en);
save('ky.json', ky);
console.log(fixes.join('\n'));
