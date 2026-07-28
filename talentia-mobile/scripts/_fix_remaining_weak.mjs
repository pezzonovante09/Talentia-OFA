/**
 * Apply remaining weak-lesson locale fixes (g1e-grt-l2, g1e-num-l2, g1r-wrd-l1, g2r-sent-l3).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES = path.join(__dirname, '..', 'src', 'i18n', 'locales');

function load(name) {
  return JSON.parse(fs.readFileSync(path.join(LOCALES, name), 'utf8'));
}
function save(name, obj) {
  fs.writeFileSync(path.join(LOCALES, name), `${JSON.stringify(obj, null, 2)}\n`);
}

const ru = load('ru.json');
const en = load('en.json');
const ky = load('ky.json');

function setTask(key, vals) {
  if (vals.ru != null) ru.data.tasks[key] = vals.ru;
  if (vals.en != null) en.data.tasks[key] = vals.en;
  if (vals.ky != null) ky.data.tasks[key] = vals.ky;
}
function setIntro(key, vals) {
  if (vals.ru != null) ru.data.intro[key] = vals.ru;
  if (vals.en != null) en.data.intro[key] = vals.en;
  if (vals.ky != null) ky.data.intro[key] = vals.ky;
}
function setDialog(key, vals) {
  if (vals.ru != null) ru.data.dialog[key] = vals.ru;
  if (vals.en != null) en.data.dialog[key] = vals.en;
  if (vals.ky != null) ky.data.dialog[key] = vals.ky;
}

// --- g1e-grt-l2 ---
setTask('g1e_what_is_your_name', {
  ru: 'Как по-английски спросить «Как тебя зовут?»',
  en: 'How do you ask "What is your name?" in English?',
  ky: '«Атың ким?» деп англисче кантип сурайбыз?',
});
setTask('g1e_opt_what_is_your_name_en', {
  ru: 'What is your name?',
  en: 'What is your name?',
  ky: 'What is your name?',
});
setTask('g1e_opt_how_old_are_you_en', {
  ru: 'How old are you?',
  en: 'How old are you?',
  ky: 'How old are you?',
});
setIntro('g1e_grtl2_0_t', {
  ru: 'Меня зовут',
  en: 'My name is',
  ky: 'Менин атым',
});
setIntro('g1e_grtl2_0_b', {
  ru: 'My name is Polly. I am Tali. Так мы представляемся!',
  en: 'My name is Polly. I am Tali. That is how we introduce ourselves!',
  ky: 'My name is Polly. I am Tali. Ошентип таанышабыз!',
});

// --- g1e-num-l2 ---
setTask('g1e_vosem_en', {
  ru: 'Eight — это сколько? Тали думает: «Девять!»',
  en: 'Eight — how many is that? Tali thinks: "Nine!"',
  ky: 'Eight — бул канча? Тали ойлойт: «Тогуз!»',
});
setTask('g1e_vosem_opt_8', { ru: '8', en: '8', ky: '8' });
setTask('g1e_vosem_opt_9', { ru: '9', en: '9', ky: '9' });
setTask('g1e_vosem_opt_7', { ru: '7', en: '7', ky: '7' });

// --- g1r-wrd-l1: reading words (not syllable counting) ---
setTask('g1r_wrdl1_q1', {
  ru: 'Прочитай по буквам: К-О-Т. Какое это слово?',
  en: 'Read letter by letter: К-О-Т. Which word is it?',
  ky: 'Тамгалап оку: К-О-Т. Бул кайсы сөз?',
});
setTask('g1r_wrdl1_q1_a', { ru: 'ТОК', en: 'ТОК', ky: 'ТОК' });
setTask('g1r_wrdl1_q1_b', { ru: 'КОТ', en: 'КОТ', ky: 'КОТ' });
setTask('g1r_wrdl1_q2', {
  ru: 'Собери слово из букв: М-А-М-А',
  en: 'Build the word from letters: М-А-М-А',
  ky: 'Тамгалардан сөз чогулт: М-А-М-А',
});
setTask('g1r_wrdl1_q2_a', { ru: 'МАМ', en: 'МАМ', ky: 'МАМ' });
setTask('g1r_wrdl1_q2_b', { ru: 'МАМА', en: 'МАМА', ky: 'МАМА' });
setTask('g1r_wrdl1_q2_c', { ru: 'АМАМ', en: 'АМАМ', ky: 'АМАМ' });
setTask('g1r_wrdl1_q3', {
  ru: 'Д-О-М — это какое слово?',
  en: 'Д-О-М — which word is this?',
  ky: 'Д-О-М — бул кайсы сөз?',
});
setTask('g1r_wrdl1_q3_a', { ru: 'ДОМ', en: 'ДОМ', ky: 'ДОМ' });
setTask('g1r_wrdl1_q3_b', { ru: 'МОД', en: 'МОД', ky: 'МОД' });
setTask('g1r_wrdl1_q3_c', { ru: 'ОМД', en: 'ОМД', ky: 'ОМД' });
setTask('g1r_wrdl1_q4', {
  ru: 'Прочитай: Р-Ы-Б-А. Какое слово получилось?',
  en: 'Read: Р-Ы-Б-А. Which word did you get?',
  ky: 'Оку: Р-Ы-Б-А. Кандай сөз чыкты?',
});
setTask('g1r_wrdl1_q4_a', { ru: 'БАРЫ', en: 'БАРЫ', ky: 'БАРЫ' });
setTask('g1r_wrdl1_q4_b', { ru: 'РЫБА', en: 'РЫБА', ky: 'РЫБА' });
setTask('g1r_wrdl1_q5', {
  ru: 'Какое слово читается С-О-М?',
  en: 'Which word reads as С-О-М?',
  ky: 'Кайсы сөз С-О-М болуп окулат?',
});
setTask('g1r_wrdl1_q5_a', { ru: 'СОМ', en: 'СОМ', ky: 'СОМ' });
setTask('g1r_wrdl1_q5_b', { ru: 'МОС', en: 'МОС', ky: 'МОС' });
setDialog('g1r_wrdl1_1', {
  ru: 'К-О-Т — КОТ! Д-О-М — ДОМ! Читаю слова по буквам. Иногда путаю буквы местами — поможешь?',
  en: 'К-О-Т — КОТ! Д-О-М — ДОМ! I read words letter by letter. Sometimes I mix letters up — can you help?',
  ky: 'К-О-Т — КОТ! Д-О-М — ДОМ! Сөздөрдү тамгалап окуйм. Кээде тамгаларды чаташтырам — жардам бересиңби?',
});
setIntro('g1r_wrdl1_1_t', {
  ru: 'Читаем вместе',
  en: 'Reading together',
  ky: 'Бирге окуйбуз',
});
setIntro('g1r_wrdl1_1_b', {
  ru: 'С-О-М — СОМ. М-А-М-А — МАМА. Собери слово из букв!',
  en: 'С-О-М — СОМ. М-А-М-А — МАМА. Build the word from letters!',
  ky: 'С-О-М — СОМ. М-А-М-А — МАМА. Тамгалардан сөз чогулт!',
});

// --- g2r-sent-l3 agreement tasks ---
setTask('g2r_sentl3_q1', {
  ru: 'Тали написал: «Красивый бежит кот быстро». Как правильно?',
  en: 'Tali wrote: «Красивый бежит кот быстро». Which is correct?',
  ky: 'Тали жазды: «Красивый бежит кот быстро». Туурасы кайсы?',
});
setTask('g2r_sentl3_q1_a', {
  ru: 'Красивый кот бежит быстро',
  en: 'Красивый кот бежит быстро',
  ky: 'Красивый кот бежит быстро',
});
setTask('g2r_sentl3_q1_b', {
  ru: 'Красивый бежит кот быстро',
  en: 'Красивый бежит кот быстро',
  ky: 'Красивый бежит кот быстро',
});
setTask('g2r_sentl3_q1_c', {
  ru: 'Бежит красивый быстро кот',
  en: 'Бежит красивый быстро кот',
  ky: 'Бежит красивый быстро кот',
});
setTask('g2r_sentl3_q2', {
  ru: 'Выбери правильное сочетание:',
  en: 'Choose the correct combination:',
  ky: 'Туура айкашты танда:',
});
setTask('g2r_sentl3_opt_boy_go', {
  ru: 'мальчик идёт',
  en: 'мальчик идёт',
  ky: 'мальчик идёт',
});
setTask('g2r_sentl3_opt_boys_go_bad', {
  ru: 'мальчики идёт',
  en: 'мальчики идёт',
  ky: 'мальчики идёт',
});

save('ru.json', ru);
save('en.json', en);
save('ky.json', ky);
console.log('locale patches applied');
