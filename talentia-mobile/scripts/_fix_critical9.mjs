/**
 * Fix all 15 reaudit #9 critical lessons.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const worldsPath = path.join(root, 'src/data/worlds.ts');

function load(name) {
  return JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales', name), 'utf8'));
}
function save(name, doc) {
  fs.writeFileSync(path.join(root, 'src/i18n/locales', name), `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
}

const ru = load('ru.json');
const en = load('en.json');
const ky = load('ky.json');
const abaRu = load('abaTextOverrides.generated.json');
const abaEn = load('abaTextOverrides.en.generated.json');
const abaKy = load('abaTextOverrides.ky.generated.json');

let worlds = fs.readFileSync(worldsPath, 'utf8');

function replaceOnce(src, oldStr, newStr, label) {
  if (!src.includes(oldStr)) {
    console.error('MISSING', label);
    process.exitCode = 1;
    return src;
  }
  const n = src.split(oldStr).length - 1;
  if (n !== 1) {
    console.error('COUNT', label, n);
    process.exitCode = 1;
    return src;
  }
  console.log('OK', label);
  return src.replace(oldStr, newStr);
}

function setTask(lang, key, value) {
  const doc = lang === 'ru' ? ru : lang === 'en' ? en : ky;
  doc.data.tasks[key] = value;
}
function setIntro(lang, key, value) {
  const doc = lang === 'ru' ? ru : lang === 'en' ? en : ky;
  doc.data.intro[key] = value;
}
function setDialog(lang, key, value) {
  const doc = lang === 'ru' ? ru : lang === 'en' ? en : ky;
  doc.data.dialog[key] = value;
}
function setLesson(lang, key, value) {
  const doc = lang === 'ru' ? ru : lang === 'en' ? en : ky;
  doc.data.lessons[key] = value;
}

/* ========== Option keys (reuse existing + fix EN/KY) ========== */
setTask('en', 'pre_opt_tali', 'Tali has more');
setTask('ky', 'pre_opt_tali', 'Талиде көбүрөөк');
setTask('en', 'pre_opt_hare', 'The hare has more');
setTask('ky', 'pre_opt_hare', 'Коёндо көбүрөөк');
setTask('en', 'pre_opt_equal_short', 'The same');
setTask('ky', 'pre_opt_equal_short', 'Бирдей');
setTask('en', 'opt_square', 'Square');
setTask('ky', 'opt_square', 'Чарчы');

setTask('ru', 'g3w_opt_kyrgyzstan', 'Кыргызстан');
setTask('en', 'g3w_opt_kyrgyzstan', 'Kyrgyzstan');
setTask('ky', 'g3w_opt_kyrgyzstan', 'Кыргызстан');
setTask('ru', 'g3w_opt_russia_country', 'Россия');
setTask('en', 'g3w_opt_russia_country', 'Russia');
setTask('ky', 'g3w_opt_russia_country', 'Россия');
setTask('ru', 'g3w_opt_france_country', 'Франция');
setTask('en', 'g3w_opt_france_country', 'France');
setTask('ky', 'g3w_opt_france_country', 'Франция');

/* ========== worlds.ts: meadow inputs → MC ========== */
worlds = replaceOnce(
  worlds,
  `{ id: 'mc5l1-t4', type: 'input', questionKey: 'data.tasks.pre_story_3apples_more_1', difficulty: 1, answer: "У Тали больше" },`,
  `{ id: 'mc5l1-t4', type: 'multiple_choice', questionKey: 'data.tasks.pre_story_3apples_more_1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_tali', correct: true }, { id: 'b', textKey: 'data.tasks.pre_opt_hare', correct: false }, { id: 'c', textKey: 'data.tasks.pre_opt_equal_short', correct: false }] },`,
  'meadow-c5-l1 t4→MC',
);
worlds = replaceOnce(
  worlds,
  `{ id: 'mc10l1-t4', type: 'input', questionKey: 'data.tasks.pre_story_6fish_7fish_which_more', difficulty: 1, answer: "В синем" },`,
  `{ id: 'mc10l1-t4', type: 'multiple_choice', questionKey: 'data.tasks.pre_story_6fish_7fish_which_more', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_red_tank', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_blue_tank', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_equal_fish', correct: false }] },`,
  'meadow-c10-l1 t4→MC',
);
worlds = replaceOnce(
  worlds,
  `{ id: 'mshl1-t4', type: 'input', questionKey: 'data.tasks.pre_which_has_4_corners', difficulty: 2, answer: "Квадрат" },`,
  `{ id: 'mshl1-t4', type: 'multiple_choice', questionKey: 'data.tasks.pre_which_has_4_corners', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_circle', correct: false }, { id: 'b', textKey: 'data.tasks.opt_square', correct: true }, { id: 'c', textKey: 'data.tasks.opt_triangle', correct: false }] },`,
  'meadow-sh-l1 t4→MC',
);
worlds = replaceOnce(
  worlds,
  `{ id: 'mshl2-t4', type: 'input', questionKey: 'data.tasks.mshl2_rect_in_room_q', difficulty: 2, answer: "Книга" },`,
  `{ id: 'mshl2-t4', type: 'multiple_choice', questionKey: 'data.tasks.mshl2_rect_in_room_q', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_ball', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_book', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_sun_ru', correct: false }] },`,
  'meadow-sh-l2 t4→MC unique',
);

/* sh-l2: unique rectangle among ball/book/sun (door removed) */
setTask('ru', 'mshl2_rect_in_room_q', 'Что больше всего похоже на прямоугольник: мяч, книга или солнце?');
setTask('en', 'mshl2_rect_in_room_q', 'Which is most like a rectangle: a ball, a book, or the sun?');
setTask('ky', 'mshl2_rect_in_room_q', 'Кайсысы тик бурчтукка окшош: топ, китеп же күн?');

/* meadow-c10-l3 title/intro: not only compare */
setLesson('ru', 'meadowC10L3', 'Числа до десяти');
setLesson('en', 'meadowC10L3', 'Numbers to ten');
setLesson('ky', 'meadowC10L3', 'Онго чейинки сандар');
setIntro('ru', 'meadow_c10l3_0_t', 'До десяти: сравниваем и считаем!');
setIntro('en', 'meadow_c10l3_0_t', 'To ten: compare and count!');
setIntro('ky', 'meadow_c10l3_0_t', 'Онго чейин: салыштырып санайбыз!');
setIntro(
  'ru',
  'meadow_c10l3_0_b',
  '7 больше 3. Можно идти по два: 2, 4, 6, 8… И складывать: 6 + 4 = 10!',
);
setIntro(
  'en',
  'meadow_c10l3_0_b',
  '7 is greater than 3. You can skip-count by twos: 2, 4, 6, 8… And add: 6 + 4 = 10!',
);
setIntro(
  'ky',
  'meadow_c10l3_0_b',
  '7 чоң 3төн. Экиден санаса болот: 2, 4, 6, 8… Жана кош: 6 + 4 = 10!',
);

/* ========== island-abc ABA ELEPHANT → DOG ========== */
for (const aba of [abaRu, abaEn, abaKy]) {
  aba['data.tasks.nrw_iabcl2_a1_q'] = 'DOG — first letter?';
  aba['data.tasks.nrw_iabcl2_a1_a'] = 'D';
  aba['data.tasks.nrw_iabcl2_a1_b'] = 'C';
}
console.log('OK island-abc ABA a1 → DOG/D/C');

/* Also fix any ABA t3 asking F if present */
for (const k of Object.keys(abaEn)) {
  if (k.includes('nrw_iabcl2') && /first letter|\bF\b|ELEPHANT/i.test(String(abaEn[k]))) {
    console.log('aba iabcl2 leftover', k, abaEn[k]);
  }
}

/* ========== g1w-nat-l2 / nrw_ganiml2 EN+KY translate ========== */
const ganiml2 = {
  nrw_ganiml2_t1_q: {
    en: 'Tali sees bear tracks. “The bear lives in the sea!” he says. Where does it really live?',
    ky: 'Тали аюнун изин көрөт. «Аю деңизде жашайт!» дейт. Чындыгында кайда жашайт?',
  },
  nrw_ganiml2_t1_a: { en: 'In a house', ky: 'Үйдө' },
  nrw_ganiml2_t1_b: { en: 'In the forest', ky: 'Токойдо' },
  nrw_ganiml2_t1_c: { en: 'In the sea', ky: 'Деңизде' },
  nrw_ganiml2_t2_q: {
    en: 'Tali thinks: “A lion looks like a cat — so it must be a pet!” Is Tali right?',
    ky: 'Тали ойлойт: «Арстан мышыкка окшош — демек үй жаныбары!» Тали туурабы?',
  },
  nrw_ganiml2_t2_a: { en: 'Yes, a lion is a pet', ky: 'Ооба, арстан — үй жаныбары' },
  nrw_ganiml2_t2_b: { en: 'No, a lion is wild!', ky: 'Жок, арстан — жапайы!' },
  nrw_ganiml2_t3_q: {
    en: 'Tali found a fluffy red trail in the forest. Who was it?',
    ky: 'Тали токойдон кызыл түктүү из тапты. Бул ким болду?',
  },
  nrw_ganiml2_t3_a: { en: 'Wolf', ky: 'Карышкыр' },
  nrw_ganiml2_t3_b: { en: 'Fox', ky: 'Түлкү' },
  nrw_ganiml2_t3_c: { en: 'Bear', ky: 'Аю' },
  nrw_ganiml2_t4_q: {
    en: 'Tali makes a team of wild animals. Who does not belong: wolf, fox, bear, cow?',
    ky: 'Тали жапайы жаныбарлар тобун түзөт. Ким лишний: карышкыр, түлкү, аю, уй?',
  },
  nrw_ganiml2_t4_a: { en: 'Wolf', ky: 'Карышкыр' },
  nrw_ganiml2_t4_b: { en: 'Fox', ky: 'Түлкү' },
  nrw_ganiml2_t4_c: { en: 'Cow', ky: 'Уй' },
  nrw_ganiml2_a1_q: { en: 'Is a fox a wild animal?', ky: 'Түлкү — жапайы жаныбарбы?' },
  nrw_ganiml2_a1_a: { en: 'Yes', ky: 'Ооба' },
  nrw_ganiml2_a1_b: { en: 'No', ky: 'Жок' },
};
for (const [k, v] of Object.entries(ganiml2)) {
  setTask('en', k, v.en);
  setTask('ky', k, v.ky);
  abaEn[`data.tasks.${k}`] = v.en;
  abaKy[`data.tasks.${k}`] = v.ky;
  if (ru.data.tasks[k] != null) abaRu[`data.tasks.${k}`] = ru.data.tasks[k];
}
// fix KY t4 "лишний" leftover
setTask('ky', 'nrw_ganiml2_t4_q', 'Тали жапайы жаныбарлар тобун түзөт. Ким ашык: карышкыр, түлкү, аю, уй?');
abaKy['data.tasks.nrw_ganiml2_t4_q'] = ky.data.tasks.nrw_ganiml2_t4_q;
console.log('OK ganiml2 EN/KY');

/* ========== g2r-sp-l3 intro EN/KY → adjectives ========== */
setIntro('en', 'g2r_spl3_0_t', 'An adjective is a quality!');
setIntro(
  'en',
  'g2r_spl3_0_b',
  'A RED ball, a BIG elephant, a CHEERFUL Tali. It answers what kind? which? what?',
);
setIntro('en', 'g2r_spl3_1_t', 'Adjectives make speech brighter!');
setIntro(
  'en',
  'g2r_spl3_1_b',
  'Without adjectives everything is grey and dull. With them — bright and lively!',
);
setIntro('ky', 'g2r_spl3_0_t', 'Сын атооч — белги!');
setIntro(
  'ky',
  'g2r_spl3_0_b',
  'КЫЗЫЛ топ, ЧОҢ пил, ШАЙЫР Тали. Кандай? деген суроого жооп берет.',
);
setIntro('ky', 'g2r_spl3_1_t', 'Сын атооч жасалгалайт!');
setIntro(
  'ky',
  'g2r_spl3_1_b',
  'Сын атоочсуз баары боз жана кызыксыз. Алар менен — жаркын жана жандуу!',
);

/* ========== g2s-bdy-l3 nutrition intro + water Q ========== */
setIntro('en', 'g2s_bdyl3_0_t', 'Food fuels the body!');
setIntro(
  'en',
  'g2s_bdyl3_0_b',
  'Veggies and fruit give vitamins. Meat and eggs — protein (building material). Porridge — energy. Sweets — only sometimes!',
);
setIntro('en', 'g2s_bdyl3_1_t', 'Sport is strength!');
setIntro(
  'en',
  'g2s_bdyl3_1_b',
  'Exercises, running, swimming strengthen muscles and the heart. Movement is life!',
);
setIntro('ky', 'g2s_bdyl3_0_t', 'Тамактануу — дене үчүн отун!');
setIntro(
  'ky',
  'g2s_bdyl3_0_b',
  'Жашылча жана мөмө витамин берет. Эт жана жумуртка — белоктор. Ботко — энергия. Таттуу — кээде гана!',
);
setIntro('ky', 'g2s_bdyl3_1_t', 'Спорт — күч!');
setIntro(
  'ky',
  'g2s_bdyl3_1_b',
  'Зарядка, чуркоо, сүзүү булчуңдарды жана жүрөктү чыңайт. Кыймыл — жашоо!',
);
setTask('en', 'g2s_water_daily', 'Tali asks: “Do I need to drink water every day?”');
setTask('ky', 'g2s_water_daily', 'Тали сурайт: «Ар күнү суу ичүү керекпи?»');
setTask(
  'en',
  'g2s_vitamins_in',
  'Tali ate only cookies. Which foods have the most vitamins he is missing?',
);
setTask(
  'ky',
  'g2s_vitamins_in',
  'Тали печенье гана жеди. Кайсы азыктарда ага жетишпеген витаминдер көп?',
);
setTask('en', 'g2s_protein_in', 'Archie wants to get stronger. Which foods have the most protein?');
setTask('ky', 'g2s_protein_in', 'Арчи күчтүүргө каалайт. Кайсы азыктарда белоктор көп?');

/* ========== g3m-1000-l3 wrong tip ========== */
setDialog(
  'en',
  'g3m_1000l3_1',
  'Haha! No, Tali. First look at the hundreds — 3 is greater than 2, so 356 is greater. Let’s practice!',
);
setDialog(
  'ky',
  'g3m_1000l3_1',
  'Хаха! Жок, Тали. Адегенде жүздүктөрдү кара — 3 чоң 2ден, демек 356 чоңураак. Машыгалы!',
);
setIntro('en', 'g3m_1000l3_1_t', 'Compare hundreds first');
setIntro(
  'en',
  'g3m_1000l3_1_b',
  'A three-digit number is always greater than a two-digit one. Among three-digit numbers, compare hundreds, then tens.',
);
setIntro('ky', 'g3m_1000l3_1_t', 'Адегенде жүздүктөрдү салыштыр');
setIntro(
  'ky',
  'g3m_1000l3_1_b',
  'Үч орундуу ар дайым эки орундуудан чоң. Үч орундуулардын арасында адегенде жүздүк, анан ондук.',
);

/* ========== g3e-food-l2 ========== */
setDialog(
  'en',
  'g3e_foodl2_0',
  'I like pizza! I don’t like broccoli! These are the most important food phrases!',
);
setDialog(
  'en',
  'g3e_foodl2_1',
  'Haha, Tali! And I like broccoli. Tastes differ! Do you like…? Yes, I do! No, I don’t!',
);
setDialog(
  'ky',
  'g3e_foodl2_0',
  'I like pizza! I don’t like broccoli! Бул тамак жөнүндөгү эң маанилүү фразалар!',
);
setDialog(
  'ky',
  'g3e_foodl2_1',
  'Хаха, Тали! Мен болсо брокколи жактырам. Даамдар ар түрдүү! Do you like…? Yes, I do! No, I don’t!',
);
setTask('en', 'g3e_food2_q1_a', 'Apples are pleasing to me');
setTask('en', 'g3e_food2_q1_b', 'I dislike apples');
setTask('en', 'g3e_food2_q1_c', 'I am an apple');
setTask('en', 'g3e_foodl2_q3', 'How do you say “Мне нравится шоколад” in English?');
setTask('ky', 'g3e_foodl2_q3', '«Мага шоколад жагат» деп англисче кантип айтылат?');
setDialog(
  'en',
  'g2r_spl3_1',
  'Tali is a GREEN, CHEERFUL, SMART dinosaur! An adjective answers “what kind?” Shall we try together?',
);
setDialog(
  'ky',
  'g2r_spl3_1',
  'Тали — ЖАШЫЛ, ШАЙЫР, АКЫЛДУУ динозавр! Сын атооч «кандай?» суроосуна жооп берет. Чогуу аракет кылалыбы?',
);

/* ========== g3e-daily-l3: fix EN stem + convert t4 to MC ========== */
setTask('en', 'g3e_daily3_q4', '«Я никогда не опаздываю» in English:');
setTask('ky', 'g3e_daily3_q4', '«Мен эч качан кечикпейм» англисче:');
worlds = replaceOnce(
  worlds,
  `{ id: 'g3edailyl3t4', type: 'input', questionKey: 'data.tasks.g3e_daily3_q4', difficulty: 2, answer: "I am never late" },`,
  `{ id: 'g3edailyl3t4', type: 'multiple_choice', questionKey: 'data.tasks.g3e_daily3_q4', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3e_daily3_q4_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_daily3_q4_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_daily3_q4_c', correct: false }] },`,
  'g3e-daily-l3 t4→MC',
);

/* ========== g3w-geo-l3: fix Q + convert to MC ========== */
setTask('en', 'g3w_kyrgyzstan_capital', 'Tali lives in Bishkek. Bishkek is the capital of which country?');
setTask('ky', 'g3w_kyrgyzstan_capital', 'Тали Бишкекте жашайт. Бишкек кайсы өлкөнүн борбору?');
worlds = replaceOnce(
  worlds,
  `{ id: 'g3wgeol3t4', type: 'input', questionKey: 'data.tasks.g3w_kyrgyzstan_capital', difficulty: 2, answer: "Кыргызстана" },`,
  `{ id: 'g3wgeol3t4', type: 'multiple_choice', questionKey: 'data.tasks.g3w_kyrgyzstan_capital', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_kyrgyzstan', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_opt_russia_country', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_opt_france_country', correct: false }] },`,
  'g3w-geo-l3 t4→MC',
);

/* KY geo stems that were RU */
for (const k of ['g3w_russia_capital', 'g3w_france_capital', 'g3w_uk_capital']) {
  const map = {
    g3w_russia_capital: { en: 'The capital of Russia:', ky: 'Россиянын борбору:' },
    g3w_france_capital: {
      en: 'The Eiffel Tower stands in the capital of France. It is:',
      ky: 'Эйфел мунарасы Франциянын борборунда турат. Бул:',
    },
    g3w_uk_capital: { en: 'The capital of the United Kingdom:', ky: 'Улуу Британиянын борбору:' },
  };
  setTask('en', k, map[k].en);
  setTask('ky', k, map[k].ky);
}

/* ========== g3r-adj-l1: keep ending contrast in EN/KY ========== */
setTask('en', 'g3r_adjl1_q3_a', 'Высокое дерево (neuter — «-ое»)');
setTask('en', 'g3r_adjl1_q3_b', 'Высокий дерево (wrong masculine ending)');
setTask('ky', 'g3r_adjl1_q3_a', 'Высокое дерево (орто род — «-ое»)');
setTask('ky', 'g3r_adjl1_q3_b', 'Высокий дерево (туура эмес эркек род)');

/* ========== jungle-aba-showcase: add dialog+intro ========== */
worlds = replaceOnce(
  worlds,
  `          {
            id: 'jungle-aba-showcase',
            topicId: 'jungle-addition',
            titleKey: 'data.lessons.jungleAbaShowcase',
            reward: { xp: 25 },
            abaTokensPerPiece: 5,
            tasks: [`,
  `          {
            id: 'jungle-aba-showcase',
            topicId: 'jungle-addition',
            titleKey: 'data.lessons.jungleAbaShowcase',
            reward: { xp: 25 },
            abaTokensPerPiece: 5,
            dialog: [{ speaker: 'npc', textKey: 'data.dialog.jungle_aba_0' }, { speaker: 'tali', textKey: 'data.dialog.jungle_aba_1' }],
            intro: [{ titleKey: 'data.intro.jungle_aba_0_t', bodyKey: 'data.intro.jungle_aba_0_b', emoji: '' }, { titleKey: 'data.intro.jungle_aba_1_t', bodyKey: 'data.intro.jungle_aba_1_b', emoji: '' }],
            tasks: [`,
  'jungle-aba dialog+intro',
);
setDialog(
  'ru',
  'jungle_aba_0',
  'Тали, сегодня потренируем разные виды заданий — указывай, повторяй, выбирай. Готов?',
);
setDialog('ru', 'jungle_aba_1', 'Готов! Я люблю, когда задания разные. Начнём с простого счёта!');
setDialog(
  'en',
  'jungle_aba_0',
  'Tali, today we’ll practice different task types — point, repeat, choose. Ready?',
);
setDialog('en', 'jungle_aba_1', 'Ready! I like when tasks are different. Let’s start with simple counting!');
setDialog(
  'ky',
  'jungle_aba_0',
  'Тали, бүгүн ар кандай тапшырмаларды машыктырабыз — көрсөт, кайтала, танда. Даярсыңбы?',
);
setDialog('ky', 'jungle_aba_1', 'Даярмын! Ар кандай тапшырмаларды жактырам. Жөнөкөй саноодон баштайлы!');
setIntro('ru', 'jungle_aba_0_t', 'Тренировка форматов!');
setIntro(
  'ru',
  'jungle_aba_0_b',
  'Здесь много коротких заданий разных типов. Сначала обычный счёт, потом — специальные ABA-форматы.',
);
setIntro('ru', 'jungle_aba_1_t', 'Считай и выбирай');
setIntro('ru', 'jungle_aba_1_b', 'Смотри на картинку, слушай вопрос и выбирай верный ответ.');
setIntro('en', 'jungle_aba_0_t', 'Format practice!');
setIntro(
  'en',
  'jungle_aba_0_b',
  'Lots of short tasks of different types. First a normal count, then special ABA formats.',
);
setIntro('en', 'jungle_aba_1_t', 'Count and choose');
setIntro('en', 'jungle_aba_1_b', 'Look at the picture, listen to the question, and pick the right answer.');
setIntro('ky', 'jungle_aba_0_t', 'Формат машыгуусу!');
setIntro(
  'ky',
  'jungle_aba_0_b',
  'Бул жерде ар кандай кыска тапшырмалар көп. Адегенде жөнөкөй саноо, анан атайын ABA форматтары.',
);
setIntro('ky', 'jungle_aba_1_t', 'Сана жана танда');
setIntro('ky', 'jungle_aba_1_b', 'Сүрөттү кара, суроону угуп, туура жоопту танда.');

/* Sync ABA mirrors for touched keys */
function syncTouchedAba(section, keys) {
  for (const k of keys) {
    const full = `data.${section}.${k}`;
    if (ru.data[section]?.[k] != null) abaRu[full] = ru.data[section][k];
    if (en.data[section]?.[k] != null) abaEn[full] = en.data[section][k];
    if (ky.data[section]?.[k] != null) abaKy[full] = ky.data[section][k];
  }
}
syncTouchedAba('tasks', [
  'pre_opt_tali',
  'pre_opt_hare',
  'pre_opt_equal_short',
  'opt_square',
  'mshl2_rect_in_room_q',
  'g3w_opt_kyrgyzstan',
  'g3w_opt_russia_country',
  'g3w_opt_france_country',
  'g3w_kyrgyzstan_capital',
  'g3w_russia_capital',
  'g3w_france_capital',
  'g3w_uk_capital',
  'g3e_daily3_q4',
  'g3e_food2_q1_a',
  'g3e_food2_q1_b',
  'g3e_food2_q1_c',
  'g2s_water_daily',
  'g2s_vitamins_in',
  'g2s_protein_in',
  'g3r_adjl1_q3_a',
  'g3r_adjl1_q3_b',
  'nrw_iabcl2_a1_q',
  'nrw_iabcl2_a1_a',
  'nrw_iabcl2_a1_b',
]);
syncTouchedAba('intro', [
  'meadow_c10l3_0_t',
  'meadow_c10l3_0_b',
  'g2r_spl3_0_t',
  'g2r_spl3_0_b',
  'g2r_spl3_1_t',
  'g2r_spl3_1_b',
  'g2s_bdyl3_0_t',
  'g2s_bdyl3_0_b',
  'g2s_bdyl3_1_t',
  'g2s_bdyl3_1_b',
  'g3m_1000l3_1_t',
  'g3m_1000l3_1_b',
  'jungle_aba_0_t',
  'jungle_aba_0_b',
  'jungle_aba_1_t',
  'jungle_aba_1_b',
]);
syncTouchedAba('dialog', [
  'g3m_1000l3_1',
  'g3e_foodl2_0',
  'g3e_foodl2_1',
  'g2r_spl3_1',
  'jungle_aba_0',
  'jungle_aba_1',
]);
syncTouchedAba('tasks', ['g3e_foodl2_q3']);
syncTouchedAba('lessons', ['meadowC10L3']);

fs.writeFileSync(worldsPath, worlds, 'utf8');
save('ru.json', ru);
save('en.json', en);
save('ky.json', ky);
save('abaTextOverrides.generated.json', abaRu);
save('abaTextOverrides.en.generated.json', abaEn);
save('abaTextOverrides.ky.generated.json', abaKy);
console.log('DONE critical #9 fixes');
