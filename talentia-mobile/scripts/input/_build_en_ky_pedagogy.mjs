/**
 * Builds en_ky_pedagogy_fix.json from RU sources + curated EN/KY pairs.
 * Run: node scripts/input/_build_en_ky_pedagogy.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ruTasks = JSON.parse(readFileSync(join(__dirname, "_ru_sync_keys.json"), "utf8"));
const ruDialog = JSON.parse(readFileSync(join(__dirname, "_ru_g4_dialogs.json"), "utf8"));

/** @type {Record<string, {en: string, ky: string}>} */
const tasks = {
  pre_birds_return_season: {
    en: "In which season do birds come back?",
    ky: "Куштар кайсы мезгилде кайтып келет?",
  },
  pre_birds_tree_vs_bush: {
    en: "There are 6 little birds in the tree and 4 on the bush. Tali thinks there are more on the bush, “because the bush is closer.” Is Tali right?",
    ky: "Даракта 6 кичинекей куш, бадалда — 4. Тали бадалда көбүрөөк деп ойлойт, «анткени бадал жакыныраак». Тали туурабы?",
  },
  pre_opt_tree_six_birds: {
    en: "Tali is right",
    ky: "Тали туура",
  },
  pre_opt_bush_four_birds: {
    en: "There are more in the tree (where there are 6)",
    ky: "Даракта (6 турган жерде) көбүрөөк",
  },
  pre_opt_birds_equal_spots: {
    en: "The same number",
    ky: "Тең",
  },

  // —— Math: multi-digit reading ——
  g4m_md_q1: {
    en: "Tali reads a label on the map: “3 475”. He’s out of breath and says: “That’s three thousand forty-seven thousand five!” Tali is clearly mixed up. How do you really read this number?",
    ky: "Тали картадагы жазууну окуп жатат: «3 475». Ал дем алуусун токтотуп айтат: «Бул үч миң кырк жети миң беш!» Тали ачык эле чаташып калды. Бул сан чындыгында кантип окулат?",
  },
  g4m_md_q1_a: {
    en: "Three hundred forty seventy-five",
    ky: "Үч жүз кырк жетимиш беш",
  },
  g4m_md_q1_b: {
    en: "Three thousand four hundred seventy-five",
    ky: "Үч миң төрт жүз жетимиш беш",
  },
  g4m_md_q1_c: {
    en: "Thirty-four thousand seventy-five",
    ky: "Отуз төрт миң жетимиш беш",
  },
  g4m_md_q2: {
    en: "In Digit’s warehouse there are 12 080 oranges for the dinosaur party. Tali wants to write “twelve thousand eighty” on the box, but he’s not sure how to name the number correctly. Help him: how many thousands and how many tens are here?",
    ky: "Digitтин кампасында динозаврлардын майрамы үчүн 12 080 апельсин жатат. Тали кутуга «он эки миң сексен» деп жазгысы келет, бирок бул санды туура кантип атоону билбейт. Ага жардам бер: бул жерде канча миң жана канча ондук бар?",
  },
  g4m_md_q2_a: {
    en: "12 thousand and 8 tens",
    ky: "12 миң 8 ондук",
  },
  g4m_md_q2_b: {
    en: "12 thousand and 8 hundreds",
    ky: "12 миң 8 жүздүк",
  },
  g4m_md_q2_c: {
    en: "120 thousand and 80 ones",
    ky: "120 миң 80 бирдик",
  },
  g4m_md_q3: {
    en: "Tali looks at Digit’s library: “7 304 books! I wonder — is the digit 3 three thousand?” Tali is wrong again. In which place value is the digit 3 in the number 7 304?",
    ky: "Тали Digitтин китепканасын карап турат: «7 304 китеп! Кызык, 3 цифрасы — үч миңби?» Тали дагы жаңылып жатат. 7 304 санында 3 цифрасы кайсы разрядда турат?",
  },
  g4m_md_q3_a: {
    en: "In the ones place",
    ky: "Бирдиктер разрядында",
  },
  g4m_md_q3_b: {
    en: "In the hundreds place",
    ky: "Жүздүктөр разрядында",
  },
  g4m_md_q3_c: {
    en: "In the thousands place",
    ky: "Миңдиктер разрядында",
  },
  g4m_md_q4: {
    en: "Tali’s expedition walked 25 600 steps in a week. The explorer wrote this number in the diary. How do you read it correctly?",
    ky: "Талинин экспедициясы бир аптада 25 600 кадам басты. Изилдөөчү бул санды күндөлүккө жазды. Аны кантип туура окуш керек?",
  },
  g4m_md_q4_a: {
    en: "Twenty-five thousand six hundred",
    ky: "Жыйырма беш миң алты жүз",
  },
  g4m_md_q4_b: {
    en: "Two million five hundred sixty",
    ky: "Эки миллион беш жүз алтымыш",
  },
  g4m_md_q4_c: {
    en: "Twenty-five thousand sixty",
    ky: "Жыйырма беш миң алтымыш",
  },

  g4m_md2_q1: {
    en: "Tali is entering the safe code: the number 6 253. He says: “The digit 2 here is 2 thousand!” The safe won’t open. What does the digit 2 really mean in 6 253?",
    ky: "Тали сейфтин кодун терүүдө: сан 6 253. Ал айтат: «Бул жердеги 2 цифрасы — 2 миң!» Сейф ачылбай жатат. 6 253 санында 2 цифрасы чындыгында эмнени билдирет?",
  },
  g4m_md2_q1_a: {
    en: "2 thousand",
    ky: "2 миң",
  },
  g4m_md2_q1_b: {
    en: "2 hundreds (hundreds place)",
    ky: "2 жүз (жүздүктөр разряды)",
  },
  g4m_md2_q1_c: {
    en: "20 ones",
    ky: "20 бирдик",
  },
  g4m_md2_q2: {
    en: "Digit broke the number 9 070 into place-value parts for Tali. Which way is correct?",
    ky: "Digit Тали үчүн 9 070 санын разряддык кошулуучуларга бөлдү. Кайсы жазуу туура?",
  },
  g4m_md2_q2_a: {
    en: "9 000 + 70",
    ky: "9 000 + 70",
  },
  g4m_md2_q2_b: {
    en: "9 000 + 700",
    ky: "9 000 + 700",
  },
  g4m_md2_q2_c: {
    en: "900 + 70",
    ky: "900 + 70",
  },
  g4m_md2_q3: {
    en: "In the number 4 816 Tali is looking for the digit 8. “It’s in the thousands place — the most important!” he decided. Correct Tali: in which place is the 8?",
    ky: "4 816 санында Тали 8 цифрасын издеп жатат. «Ал миңдиктер разрядында — эң маанилүү!» — деп чечти. Талини оңдо: 8 кайсы разрядда турат?",
  },
  g4m_md2_q3_a: {
    en: "In the ones place",
    ky: "Бирдиктер разрядында",
  },
  g4m_md2_q3_b: {
    en: "In the hundreds place",
    ky: "Жүздүктөр разрядында",
  },
  g4m_md2_q3_c: {
    en: "In the tens place",
    ky: "Ондуктар разрядында",
  },
  g4m_md2_q4: {
    en: "Cipher master Tali coded a number: “5 thousands, 0 hundreds, 3 tens, 9 ones.” Now it needs decoding. What number is it?",
    ky: "Шифрлөөчү Тали санды коддоду: «5 миң, 0 жүз, 3 ондук, 9 бирдик». Эми аны чечмелеш керек. Бул кайсы сан?",
  },
  g4m_md2_q4_a: {
    en: "5 309",
    ky: "5 309",
  },
  g4m_md2_q4_b: {
    en: "5 039",
    ky: "5 039",
  },
  g4m_md2_q4_c: {
    en: "5 390",
    ky: "5 390",
  },

  g4m_md3_q1: {
    en: "Tali looks at two treasures: 8 450 and 8 540 coins. He says: “They’re the same — both start with an eight!” Tali is rushing and isn’t looking carefully. Which treasure is actually bigger?",
    ky: "Тали эки кенчти карап турат: 8 450 жана 8 540 тыйын. Ал айтат: «Алар бирдей — экөөнүн тең башында сегиз!» Тали шашып, жакшылап карабай жатат. Чындыгында кайсы кенч чоңураак?",
  },
  g4m_md3_q1_a: {
    en: "The treasure with 8 540 coins",
    ky: "8 540 тыйыны бар кенч",
  },
  g4m_md3_q1_b: {
    en: "The treasure with 8 450 coins",
    ky: "8 450 тыйыны бар кенч",
  },
  g4m_md3_q1_c: {
    en: "They are equal",
    ky: "Алар барабар",
  },
  g4m_md3_q2: {
    en: "Digit asks to put the numbers in order — from smallest to largest: 3 099, 3 900, and 3 009. Tali tries, but gets lost in the zeros. Help him!",
    ky: "Digit сандарды тартипке коюуну суранат — эң кичинесинен чоңуна: 3 099, 3 900 жана 3 009. Тали аракет кылат, бирок нөлдөрдөн чаташып калды. Ага жардам бер!",
  },
  g4m_md3_q2_a: {
    en: "3 009, 3 099, 3 900",
    ky: "3 009, 3 099, 3 900",
  },
  g4m_md3_q2_b: {
    en: "3 900, 3 099, 3 009",
    ky: "3 900, 3 099, 3 009",
  },
  g4m_md3_q2_c: {
    en: "3 099, 3 009, 3 900",
    ky: "3 099, 3 009, 3 900",
  },
  g4m_md3_q3: {
    en: "Tali wrote in his diary: “5 008 > 5 080 — that’s true, because in the first number the eight stands near the start!” Is his reasoning correct?",
    ky: "Тали күндөлүккө жазды: «5 008 > 5 080 — бул чын, анткени биринчи санда сегиз башына жакын турат!» Анын ой жүгүртүүсү туурабы?",
  },
  g4m_md3_q3_a: {
    en: "Yes, Tali is right",
    ky: "Ооба, Тали туура",
  },
  g4m_md3_q3_b: {
    en: "No: 5 008 < 5 080",
    ky: "Жок: 5 008 < 5 080",
  },
  g4m_md3_q3_c: {
    en: "You can’t compare them",
    ky: "Салыштырууга болбойт",
  },
  g4m_md3_q4: {
    en: "Two trains race for the longer route: the first traveled 12 375 km, the second — 12 735 km. Tali cheers for the second. Is he right — did the second really go farther?",
    ky: "Эки поезд маршруттун узундугу боюнча мелдешет: биринчиси 12 375 км жүрду, экинчиси — 12 735 км. Тали экинчисин колдойт. Ал туурабы — экинчиси чын эле көбүрөөк жүрдубү?",
  },
  g4m_md3_q4_a: {
    en: "No, the first train went farther",
    ky: "Жок, биринчи поезд көбүрөөк жүрду",
  },
  g4m_md3_q4_b: {
    en: "Yes, the second train went farther",
    ky: "Ооба, экинчи поезд көбүрөөк жүрду",
  },
  g4m_md3_q4_c: {
    en: "They traveled the same distance",
    ky: "Алар бирдей аралык жүрүштү",
  },
};

// Continuations appended below via Object.assign in same file
Object.assign(tasks, {
  // —— Russian conjugation ——
  g4r_conj_q1: {
    en: "Tali wrote: “Я хожу в школу каждый день.” Word checks: is the verb form chosen correctly?",
    ky: "Тали жазды: «Я хожу в школу каждый день.» Сөз текшерет: этиштин формасы туура тандалдыбы?",
  },
  g4r_conj_q1_a: {
    en: "No, it should be «иду»",
    ky: "Жок, «иду» болушу керек",
  },
  g4r_conj_q1_b: {
    en: "Yes, the form is correct",
    ky: "Ооба, форма туура",
  },
  g4r_conj_q1_c: {
    en: "No, it should be «хожал»",
    ky: "Жок, «хожал» болушу керек",
  },
  g4r_conj_q2: {
    en: "Word asks Tali: what is the verb «читать» for «ты»? Tali is thinking… Help him!",
    ky: "Сөз Талиден сурайт: «читать» этиши «ты» үчүн кандай болот? Тали ойлонуп жатат… Ага жардам бер!",
  },
  g4r_conj_q2_a: {
    en: "читаешь",
    ky: "читаешь",
  },
  g4r_conj_q2_b: {
    en: "читает",
    ky: "читает",
  },
  g4r_conj_q2_c: {
    en: "читали",
    ky: "читали",
  },
  g4r_conj_q3: {
    en: "Tali reads aloud: “Мальчик идёт по улице.” Word wants to know — which person is the verb «идёт»? Tali says: “Second person!” Is Tali right?",
    ky: "Тали үн чыгарып окуйт: «Мальчик идёт по улице.» Сөз билгиси келет — «идёт» этиши кайсы жакта? Тали айтат: «Экинчи жакта!» Тали туурабы?",
  },
  g4r_conj_q3_a: {
    en: "Yes, Tali is right — it’s second person",
    ky: "Ооба, Тали туура — бул экинчи жак",
  },
  g4r_conj_q3_b: {
    en: "No, it’s third person singular",
    ky: "Жок, бул үчүнчү жак жекелик сан",
  },
  g4r_conj_q3_c: {
    en: "No, it’s first person",
    ky: "Жок, бул биринчи жак",
  },
  g4r_conj_q4: {
    en: "The grammar detective found a mistake: “Она пишет письмо и отправляю его.” What is wrong in this sentence?",
    ky: "Грамматика детективи ката тапты: «Она пишет письмо и отправляю его.» Бул сүйлөмдө эмне туура эмес?",
  },
  g4r_conj_q4_a: {
    en: "Wrong conjunction",
    ky: "Жалгаштыргыч туура эмес",
  },
  g4r_conj_q4_b: {
    en: "Wrong person on the second verb: it should be «отправляет»",
    ky: "Экинчи этиштин жагы туура эмес: «отправляет» болушу керек",
  },
  g4r_conj_q4_c: {
    en: "Wrong word order",
    ky: "Сөздөрдүн тартиби туура эмес",
  },

  g4r_conj2_q1: {
    en: "Tali wrote in his play: “Мы петь вместе на сцене!” Word says that isn’t a conjugated verb. What’s correct?",
    ky: "Тали пьесасына жазды: «Мы петь вместе на сцене!» Сөз бул жакталган этиш эмес дейт. Кантип туура?",
  },
  g4r_conj2_q1_a: {
    en: "Мы поём",
    ky: "Мы поём",
  },
  g4r_conj2_q1_b: {
    en: "Мы поёте",
    ky: "Мы поёте",
  },
  g4r_conj2_q1_c: {
    en: "Мы поют",
    ky: "Мы поют",
  },
  g4r_conj2_q2: {
    en: "Tali changes a line in the play: “Он читает книгу” → “Они ___ книгу.” What changes in the verb?",
    ky: "Тали пьесадагы репликаны өзгөртөт: «Он читает книгу» → «Они ___ книгу.» Этиште эмне өзгөрөт?",
  },
  g4r_conj2_q2_a: {
    en: "читают",
    ky: "читают",
  },
  g4r_conj2_q2_b: {
    en: "читает",
    ky: "читает",
  },
  g4r_conj2_q2_c: {
    en: "читали",
    ky: "читали",
  },
  g4r_conj2_q3: {
    en: "Word asks Tali a line for the play: “Вы ___ правильный ответ?” (verb «знать»). Tali wrote «знаешь». Is that correct?",
    ky: "Сөз Талиге пьеса үчүн суроо берет: «Вы ___ правильный ответ?» («знать» этиши). Тали «знаешь» деп жазды. Туурабы?",
  },
  g4r_conj2_q3_a: {
    en: "No, the correct form is «знаете»",
    ky: "Жок, туурасы «знаете»",
  },
  g4r_conj2_q3_b: {
    en: "Yes, «знаешь» is correct",
    ky: "Ооба, «знаешь» туура",
  },
  g4r_conj2_q3_c: {
    en: "No, the correct form is «знают»",
    ky: "Жок, туурасы «знают»",
  },
  g4r_conj2_q4: {
    en: "In Tali’s play, a squad of dinosaur knights set out on a hike. “Они ___ через лес.” Put the verb «идти» in the correct form.",
    ky: "Талинин пьесасында динозавр-рыцарлар отряды жортуулга чыкты. «Они ___ через лес.» «Идти» этишин туура формада кой.",
  },
  g4r_conj2_q4_a: {
    en: "идёт",
    ky: "идёт",
  },
  g4r_conj2_q4_b: {
    en: "идут",
    ky: "идут",
  },
  g4r_conj2_q4_c: {
    en: "идём",
    ky: "идём",
  },

  g4r_conj3_q1: {
    en: "Which conjugation does the verb «любить» belong to?",
    ky: "«Любить» этиши кайсы жакталууга кирет?",
  },
  g4r_conj3_q1_a: {
    en: "1st conjugation",
    ky: "I жакталуу",
  },
  g4r_conj3_q1_b: {
    en: "2nd conjugation",
    ky: "II жакталуу",
  },
  g4r_conj3_q1_c: {
    en: "both are possible",
    ky: "экөө тең мүмкүн",
  },
  g4r_conj3_q2: {
    en: "Word asks Tali to find a 2nd-conjugation verb: писать, говорить, читать, рисовать. Tali looks at the list… Which one do you choose?",
    ky: "Сөз Талиден II жакталуу этишти табууну суранат: писать, говорить, читать, рисовать. Тали тизмени карап турат… Сен кайсыны тандайсың?",
  },
  g4r_conj3_q2_a: {
    en: "говорить",
    ky: "говорить",
  },
  g4r_conj3_q2_b: {
    en: "писать",
    ky: "писать",
  },
  g4r_conj3_q2_c: {
    en: "читать",
    ky: "читать",
  },
  g4r_conj3_q3: {
    en: "Tali wrote the last line of the play: “Мы бежит к финишу!” Word says the verb form is wrong. Fix it for Tali!",
    ky: "Тали пьесанын акыркы репликасын жазды: «Мы бежит к финишу!» Сөз этиштин формасы туура эмес дейт. Тали үчүн оңдоп кой!",
  },
  g4r_conj3_q3_a: {
    en: "бежит",
    ky: "бежит",
  },
  g4r_conj3_q3_b: {
    en: "бежите",
    ky: "бежите",
  },
  g4r_conj3_q3_c: {
    en: "бежим",
    ky: "бежим",
  },
  g4r_conj3_q4: {
    en: "By what clue do we determine a verb’s conjugation in the infinitive form?",
    ky: "Белгисиз формадагы этиштин жакталуусун кайсы белги боюнча аныкташат?",
  },
  g4r_conj3_q4_a: {
    en: "By the gender of a nearby noun",
    ky: "Жанындагы зат атоочтун жынысы боюнча",
  },
  g4r_conj3_q4_b: {
    en: "By the infinitive ending and the personal endings",
    ky: "Инфинитивдин аягы жана жекече жакталуу аягы боюнча",
  },
  g4r_conj3_q4_c: {
    en: "Only by stress",
    ky: "Бир гана басым боюнча",
  },
});

Object.assign(tasks, {
  // —— Russian cases ——
  g4r_cases_q1: {
    en: "In the sentence “Кот лежит на коврике” — which case is the word «кот» in?",
    ky: "«Кот лежит на коврике» сүйлөмүндө «кот» сөзү кайсы жөндөмөдө турат?",
  },
  g4r_cases_q1_a: {
    en: "Nominative (именительный)",
    ky: "Именительный (атооч)",
  },
  g4r_cases_q1_b: {
    en: "Accusative (винительный)",
    ky: "Винительный (табыш)",
  },
  g4r_cases_q1_c: {
    en: "Dative (дательный)",
    ky: "Дательный (барыш)",
  },
  g4r_cases_q2: {
    en: "Word asks to find the subject in “Книга лежит на столе.” Tali answers: “The subject is «столе»!” Is that correct?",
    ky: "Сөз «Книга лежит на столе» сүйлөмүнөн ээни табууну суранат. Тали жооп берет: «Ээ — «столе»!» Туурабы?",
  },
  g4r_cases_q2_a: {
    en: "No, the subject is «книга» — it’s in the nominative",
    ky: "Жок, ээ — «книга», ал именительный жөндөмөдө",
  },
  g4r_cases_q2_b: {
    en: "Yes, Tali is right",
    ky: "Ооба, Тали туура",
  },
  g4r_cases_q2_c: {
    en: "There is no subject",
    ky: "Ээ жок",
  },
  g4r_cases_q3: {
    en: "Tali makes a sentence: “Я вижу книга.” Word says the case is wrong. Which form should be used?",
    ky: "Тали сүйлөм түзөт: «Я вижу книга.» Сөз жөндөмө туура эмес дейт. Кайсы форманы колдонуш керек?",
  },
  g4r_cases_q3_a: {
    en: "nominative: «книга»",
    ky: "именительный: «книга»",
  },
  g4r_cases_q3_b: {
    en: "genitive: «книги»",
    ky: "родительный: «книги»",
  },
  g4r_cases_q3_c: {
    en: "accusative: «книгу»",
    ky: "винительный: «книгу»",
  },
  g4r_cases_q4: {
    en: "How is the nominative different from the accusative? Choose the correct explanation.",
    ky: "Именительный жөндөмө винительныйден эмнеси менен айырмаланат? Туура түшүндүрмөнү танда.",
  },
  g4r_cases_q4_a: {
    en: "They always look the same",
    ky: "Алар ар дайым формасы боюнча дал келет",
  },
  g4r_cases_q4_b: {
    en: "Accusative is the object of the action (кого? что?), nominative is the “owner” of the sentence (кто? что?)",
    ky: "Винительный — аракеттин объектиси (кого? что?), именительный — сүйлөмдүн «ээси» (кто? что?)",
  },
  g4r_cases_q4_c: {
    en: "Nominative always comes with a preposition",
    ky: "Именительный ар дайым предлог менен турат",
  },

  g4r_cases2_q1: {
    en: "Which question does a word in the genitive case answer?",
    ky: "Родительный жөндөмөдөгү сөз кайсы суроого жооп берет?",
  },
  g4r_cases2_q1_a: {
    en: "Кто? Что?",
    ky: "Кто? Что?",
  },
  g4r_cases2_q1_b: {
    en: "Кого? Чего?",
    ky: "Кого? Чего?",
  },
  g4r_cases2_q1_c: {
    en: "Кому? Чему?",
    ky: "Кому? Чему?",
  },
  g4r_cases2_q2: {
    en: "Tali wrote a letter: “Я дал корм собака.” Word says the case is wrong. “Дал кому?” — so you need…",
    ky: "Тали кат жазды: «Я дал корм собака.» Сөз жөндөмө туура эмес дейт. «Дал кому?» — демек керек…",
  },
  g4r_cases2_q2_a: {
    en: "Dative: «собаке»",
    ky: "Дательный: «собаке»",
  },
  g4r_cases2_q2_b: {
    en: "Nominative: «собака»",
    ky: "Именительный: «собака»",
  },
  g4r_cases2_q2_c: {
    en: "Genitive: «собаки»",
    ky: "Родительный: «собаки»",
  },
  g4r_cases2_q3: {
    en: "Tali didn’t wait for his friend and wrote: “Подожди — не хватает ___ (друг).” Which case is needed?",
    ky: "Тали досун күтпөй калып жазды: «Подожди — не хватает ___ (друг).» Кайсы жөндөмө керек?",
  },
  g4r_cases2_q3_a: {
    en: "друг (nominative)",
    ky: "друг (именительный)",
  },
  g4r_cases2_q3_b: {
    en: "друга (genitive)",
    ky: "друга (родительный)",
  },
  g4r_cases2_q3_c: {
    en: "другу (dative)",
    ky: "другу (дательный)",
  },
  g4r_cases2_q4: {
    en: "The dinosaur mail carrier delivers letters: “Отправить письмо ___ (мама).” Put the word in the correct case.",
    ky: "Динозавр-почтальон каттарды таратат: «Отправить письмо ___ (мама).» Сөздү туура жөндөмөгө кой.",
  },
  g4r_cases2_q4_a: {
    en: "маме",
    ky: "маме",
  },
  g4r_cases2_q4_b: {
    en: "маму",
    ky: "маму",
  },
  g4r_cases2_q4_c: {
    en: "мамы",
    ky: "мамы",
  },

  g4r_cases3_q1: {
    en: "Tali wrote: “Мы говорили о лес.” Word looks and says: “Tali, here you need the prepositional case — it always comes with a preposition!” What’s correct?",
    ky: "Тали жазды: «Мы говорили о лес.» Сөз карап айтат: «Тали, бул жерде предложный жөндөмө керек — ал ар дайым предлог менен!» Кантип туура?",
  },
  g4r_cases3_q1_a: {
    en: "Prepositional: «о лесе»",
    ky: "Предложный: «о лесе»",
  },
  g4r_cases3_q1_b: {
    en: "Accusative: «о лес»",
    ky: "Винительный: «о лес»",
  },
  g4r_cases3_q1_c: {
    en: "Dative: «о лесу»",
    ky: "Дательный: «о лесу»",
  },
  g4r_cases3_q2: {
    en: "Tali draws a self-portrait and writes a caption: “Я стал ___ (художник).” Which case is needed after «стал»?",
    ky: "Тали автопортрет тартып, колтамга жазат: «Я стал ___ (художник).» «Стал» сөзүнөн кийин кайсы жөндөмө керек?",
  },
  g4r_cases3_q2_a: {
    en: "художник (nominative)",
    ky: "художник (именительный)",
  },
  g4r_cases3_q2_b: {
    en: "художником (instrumental)",
    ky: "художником (творительный)",
  },
  g4r_cases3_q2_c: {
    en: "художнику (dative)",
    ky: "художнику (дательный)",
  },
  g4r_cases3_q3: {
    en: "Word asks Tali: “Which case is never used without a preposition?” Tali thinks and says: “Dative!” Is Tali right?",
    ky: "Сөз Талиден сурайт: «Кайсы жөндөмө эч качан предлогсуз колдонулбайт?» Тали ойлонуп айтат: «Дательный!» Тали туурабы?",
  },
  g4r_cases3_q3_a: {
    en: "Yes, Tali is right — dative",
    ky: "Ооба, Тали туура — дательный",
  },
  g4r_cases3_q3_b: {
    en: "No, it’s prepositional — only that one always takes a preposition",
    ky: "Жок, бул предложный — бир гана ал ар дайым предлог менен",
  },
  g4r_cases3_q3_c: {
    en: "No, it’s instrumental",
    ky: "Жок, бул творительный",
  },
  g4r_cases3_q4: {
    en: "Name all 6 cases of Russian in order. Which one is in fifth place?",
    ky: "Орус тилинин 6 жөндөмөсүн тартип менен ата. Бешинчи орунда кайсысы турат?",
  },
  g4r_cases3_q4_a: {
    en: "Dative (4th)",
    ky: "Дательный (4-чү)",
  },
  g4r_cases3_q4_b: {
    en: "Prepositional (6th)",
    ky: "Предложный (6-чы)",
  },
  g4r_cases3_q4_c: {
    en: "Instrumental (5th)",
    ky: "Творительный (5-чи)",
  },
});

Object.assign(tasks, {
  // —— Russian text structure ——
  g4r_text_q1: {
    en: "Tali reads: “Солнце зашло. Стало темно. Птицы умолкли.” He says: “This text is about birds!” But Word disagrees. What is the text really about?",
    ky: "Тали окуйт: «Солнце зашло. Стало темно. Птицы умолкли.» Ал айтат: «Бул текст куштар жөнүндө!» Бирок Сөз макул эмес. Бул текст чындыгында эмне жөнүндө?",
  },
  g4r_text_q1_a: {
    en: "About evening and the quiet after sunset",
    ky: "Кеч жана күндүн батышынан кийинки тынчтык жөнүндө",
  },
  g4r_text_q1_b: {
    en: "About birds that stay silent",
    ky: "Үнсүз турган куштар жөнүндө",
  },
  g4r_text_q1_c: {
    en: "About the school timetable",
    ky: "Мектеп сабактарынын тизмеси жөнүндө",
  },
  g4r_text_q2: {
    en: "What is the last part of a text with three parts called?",
    ky: "Үч бөлүктөн турган тексттин акыркы бөлүгү кандай аталат?",
  },
  g4r_text_q2_a: {
    en: "the beginning (завязка)",
    ky: "завязка (башы)",
  },
  g4r_text_q2_b: {
    en: "the ending (концовка)",
    ky: "концовка (аягы)",
  },
  g4r_text_q2_c: {
    en: "the title page",
    ky: "титулдук барак",
  },
  g4r_text_q3: {
    en: "Tali reads: “Дождь шёл всю ночь, поэтому утром лужи блестели.” What connection is there between the parts of the sentence?",
    ky: "Тали окуйт: «Дождь шёл всю ночь, поэтому утром лужи блестели.» Сүйлөмдүн бөлүктөрүнүн ортосунда кандай байланыш бар?",
  },
  g4r_text_q3_a: {
    en: "only a list",
    ky: "жөн гана санап чыгуу",
  },
  g4r_text_q3_b: {
    en: "only a description",
    ky: "жөн гана сүрөттөө",
  },
  g4r_text_q3_c: {
    en: "cause and effect",
    ky: "себеп жана натыйжа",
  },
  g4r_text_q4: {
    en: "Tali writes a story about a kitten. He calls the first part “table of contents.” Word says that name is wrong. What is the first part of a story really called?",
    ky: "Тали мышык баласы жөнүндө аңгеме жазат. Биринчи бөлүктү «мазмуну» деп атат. Сөз ат туура эмес дейт. Аңгеменин биринчи бөлүгү чындыгында кандай аталат?",
  },
  g4r_text_q4_a: {
    en: "a magazine table of contents",
    ky: "журналдын мазмуну",
  },
  g4r_text_q4_b: {
    en: "the beginning / setup (завязка)",
    ky: "завязка (башы)",
  },
  g4r_text_q4_c: {
    en: "the ending",
    ky: "концовка",
  },

  g4r_text2_q1: {
    en: "Text: “Ёж свернулся в клубок. Иголки торчат во все стороны. Никто не тронет ежа.” The main idea is…",
    ky: "Текст: «Ёж свернулся в клубок. Иголки торчат во все стороны. Никто не тронет ежа.» Негизги ой — бул…",
  },
  g4r_text2_q1_a: {
    en: "The hedgehog protects itself with its spines",
    ky: "Кирпи өзүн ийнелери менен коргойт",
  },
  g4r_text2_q1_b: {
    en: "The hedgehog is always angry and doesn’t want to talk",
    ky: "Кирпи ар дайым ачуулуу жана сүйлөшкүсү келбейт",
  },
  g4r_text2_q1_c: {
    en: "The spines are a separate character",
    ky: "Ийнелер — өзүнчө каарман",
  },
  g4r_text2_q2: {
    en: "What do we call the sentence that states the main idea of the whole text?",
    ky: "Бүт тексттин негизги оюн билдирген сүйлөм кандай аталат?",
  },
  g4r_text2_q2_a: {
    en: "any sentence from the text",
    ky: "тексттен каалаган сүйлөм",
  },
  g4r_text2_q2_b: {
    en: "a thesis — the main idea in one sentence",
    ky: "тезис — негизги ой бир сүйлөмдө",
  },
  g4r_text2_q2_c: {
    en: "the last word of the text",
    ky: "тексттин акыркы сөзү",
  },
  g4r_text2_q3: {
    en: "Tali mixed up the sentences of his rain story. Which should come first so the text makes sense?",
    ky: "Тали жамгыр жөнүндөгү аңгемесинин сүйлөмдөрүн аралаштырып жиберди. Текст байланыштуу болушу үчүн кайсыны биринчи коюш керек?",
  },
  g4r_text2_q3_a: {
    en: "First it started to rain.",
    ky: "Адегенде жамгыр жаады.",
  },
  g4r_text2_q3_b: {
    en: "That’s why the puddles sparkled.",
    ky: "Ошондуктан көлчүктөр жылтырады.",
  },
  g4r_text2_q3_c: {
    en: "At last it grew dark.",
    ky: "Акыры караңгы болду.",
  },
  g4r_text2_q4: {
    en: "Word asks Tali: “Where does the main idea of a story most often hide?” Tali says: “Only in the middle!” Is that true?",
    ky: "Сөз Талиден сурайт: «Аңгеменин негизги ою көбүнчө кайда жашынат?» Тали айтат: «Бир гана ортосунда!» Туурабы?",
  },
  g4r_text2_q4_a: {
    en: "Yes, only in the middle",
    ky: "Ооба, бир гана ортосунда",
  },
  g4r_text2_q4_b: {
    en: "No — most often at the beginning or at the end",
    ky: "Жок — көбүнчө башында же аягында",
  },
  g4r_text2_q4_c: {
    en: "No, only in the title",
    ky: "Жок, бир гана аталышта",
  },

  g4r_text3_q1: {
    en: "Tali read: “Сначала Маша нашла гриб. Потом позвала сестру. Наконец они набрали полную корзину.” He thinks “позвала сестру” came first. Correct Tali — what happened first?",
    ky: "Тали окуду: «Сначала Маша нашла гриб. Потом позвала сестру. Наконец они набрали полную корзину.» Ал «позвала сестру» биринчи болду деп ойлойт. Талини оңдо — эң биринчи эмне болду?",
  },
  g4r_text3_q1_a: {
    en: "they filled the basket",
    ky: "себетти толтурушту",
  },
  g4r_text3_q1_b: {
    en: "she called her sister",
    ky: "эжесин чакырды",
  },
  g4r_text3_q1_c: {
    en: "she found a mushroom",
    ky: "козу карын тапты",
  },
  g4r_text3_q2: {
    en: "Word asks to find the “beacon” word that points to the last event in the chain. Which word is it?",
    ky: "Сөз чынжырдагы акыркы окуяны көрсөткөн «маяк» сөздү табууну суранат. Бул кайсы сөз?",
  },
  g4r_text3_q2_a: {
    en: "сначала",
    ky: "сначала",
  },
  g4r_text3_q2_b: {
    en: "наконец",
    ky: "наконец",
  },
  g4r_text3_q2_c: {
    en: "потом",
    ky: "потом",
  },
  g4r_text3_q3: {
    en: "Tali describes his favorite stone: “Он гладкий, серый, тёплый на ощупь и пахнет дождём.” What type of text is this?",
    ky: "Тали сүйүктүү ташын сүрөттөйт: «Он гладкий, серый, тёплый на ощупь и пахнет дождём.» Бул кандай типтеги текст?",
  },
  g4r_text3_q3_a: {
    en: "description",
    ky: "сүрөттөө",
  },
  g4r_text3_q3_b: {
    en: "narration",
    ky: "баяндоо",
  },
  g4r_text3_q3_c: {
    en: "reasoning / argument",
    ky: "ой жүгүртүү",
  },
  g4r_text3_q4: {
    en: "Tali writes instructions for a friend: “Потом налей воду. Сначала возьми стакан. Наконец размешай.” Word says the steps are mixed up. Which word shows that a step is NOT first?",
    ky: "Тали досу үчүн нускама жазат: «Потом налей воду. Сначала возьми стакан. Наконец размешай.» Сөз кадамдар аралашкан дейт. Кайсы сөз кадам БИРИНЧИ ЭМЕС экенин көрсөтөт?",
  },
  g4r_text3_q4_a: {
    en: "«Сначала…»",
    ky: "«Сначала…»",
  },
  g4r_text3_q4_b: {
    en: "«Потом…»",
    ky: "«Потом…»",
  },
  g4r_text3_q4_c: {
    en: "«Наконец…»",
    ky: "«Наконец…»",
  },
});

Object.assign(tasks, {
  // —— Social emotions ——
  g4s_emo_q1: {
    en: "Tali’s friend came with slumped shoulders and a quiet voice. What emotion is he most likely feeling?",
    ky: "Талинин досу ийиндери салбырап, үнү тынч келди. Ал кайсы сезимди башынан кечирип жатканы мүмкүн?",
  },
  g4s_emo_q1_a: {
    en: "Sadness",
    ky: "Кайгы",
  },
  g4s_emo_q1_b: {
    en: "Joy",
    ky: "Кубаныч",
  },
  g4s_emo_q1_c: {
    en: "Anger",
    ky: "Ачуулануу",
  },
  g4s_emo_q2: {
    en: "What usually brings people real joy?",
    ky: "Көпчүлүк адамдарда чыныгы кубанычты эмне пайда кылат?",
  },
  g4s_emo_q2_a: {
    en: "Getting an unexpected gift",
    ky: "Күтүлбөгөн белек алуу",
  },
  g4s_emo_q2_b: {
    en: "Losing a favorite thing",
    ky: "Сүйүктүү нерсени жоготуу",
  },
  g4s_emo_q2_c: {
    en: "Being bored in a line",
    ky: "Кезекте зеригүү",
  },
  g4s_emo_q3: {
    en: "Tali sees a sad friend and says: “Don’t be sad!” Friendly shakes their head. Why isn’t that the best support, and what is better to do?",
    ky: "Тали кайгырган досун көрүп айтат: «Капаланба!» Friendly башын чайкайт. Эмне үчүн бул эң жакшы колдоо эмес жана эмне кылган оң?",
  },
  g4s_emo_q3_a: {
    en: "It’s the best support — words always help",
    ky: "Бул эң жакшы колдоо — сөздөр жардам берет",
  },
  g4s_emo_q3_b: {
    en: "It’s better to stay nearby and support with quiet presence or a gentle word",
    ky: "Жакында болуп, унчукпай же тынч сөз менен колдогон жакшыраак",
  },
  g4s_emo_q3_c: {
    en: "It’s better to leave — so you don’t bother them",
    ky: "Кеткен жакшыраак — тоскоол болбоо үчүн",
  },
  g4s_emo_q4: {
    en: "Raised corners of the mouth and a sparkle in the eyes — what emotion is that?",
    ky: "Ооздун бурчтары көтөрүлүп, көздөр жалтырап турат — бул кайсы сезим?",
  },
  g4s_emo_q4_a: {
    en: "Anger",
    ky: "Ачуулануу",
  },
  g4s_emo_q4_b: {
    en: "Joy",
    ky: "Кубаныч",
  },
  g4s_emo_q4_c: {
    en: "Fear",
    ky: "Коркуу",
  },

  g4s_emo2_q1: {
    en: "Tali is angry at his brother and wants to throw something. Friendly stops him. Which way of showing anger is safe for both of them?",
    ky: "Тали бир тууганына ачууланып, бир нерсе ыргыткысы келет. Friendly аны токтотот. Ачууну экөө үчүн да коопсуз кантип билдирсе болот?",
  },
  g4s_emo2_q1_a: {
    en: "Hit his brother",
    ky: "Бир тууганын уруу",
  },
  g4s_emo2_q1_b: {
    en: "Say that it hurts and offer to fix it together",
    ky: "Таарынганын айтып, чогуу оңдоону сунуштоо",
  },
  g4s_emo2_q1_c: {
    en: "Break his toy in return",
    ky: "Жооп кылып анын оюнчугун сындыруу",
  },
  g4s_emo2_q2: {
    en: "Before going on stage, your heart beats fast and you want to run away. What is this emotion called?",
    ky: "Сахнага чыгардан мурун жүрөк тез согуп, качып кеткиң келет. Бул сезим кандай аталат?",
  },
  g4s_emo2_q2_a: {
    en: "Joy",
    ky: "Кубаныч",
  },
  g4s_emo2_q2_b: {
    en: "Excitement and fear",
    ky: "Толкундануу жана коркуу",
  },
  g4s_emo2_q2_c: {
    en: "Boredom",
    ky: "Зеригүү",
  },
  g4s_emo2_q3: {
    en: "How is anger different from fear?",
    ky: "Ачуулануу коркуудан эмнеси менен айырмаланат?",
  },
  g4s_emo2_q3_a: {
    en: "Fear is a reaction to danger — wanting to avoid it; anger is a reaction to unfairness — wanting to change something",
    ky: "Коркуу — коркунучка реакция, андан качуу каалоо; ачуу — адилетсиздикке реакция, өзгөртүү каалоо",
  },
  g4s_emo2_q3_b: {
    en: "They are the same feeling",
    ky: "Бул бир эле сезим",
  },
  g4s_emo2_q3_c: {
    en: "Anger is always pleasant",
    ky: "Ачуу ар дайым жагымдуу",
  },
  g4s_emo2_q4: {
    en: "Tali read: “Петя закричал и бросил тетрадь.” Friendly asks: “Tali, what was Petya feeling, and what would have been better to do?” Tali says: “He was happy!” Is that right?",
    ky: "Тали окуду: «Петя закричал и бросил тетрадь.» Friendly сурайт: «Тали, Петя эмне сезди жана ага эмне кылган жакшыраак болмок?» Тали айтат: «Ал кубанды!» Бул туурабы?",
  },
  g4s_emo2_q4_a: {
    en: "Yes, he was happy",
    ky: "Ооба, ал кубанды",
  },
  g4s_emo2_q4_b: {
    en: "No — he was angry; better to stop and explain with words",
    ky: "Жок — ал ачууланган; токтоп, сөз менен түшүндүргөн жакшыраак",
  },
  g4s_emo2_q4_c: {
    en: "No — he was scared",
    ky: "Жок — ал корккон",
  },

  g4s_emo3_q1: {
    en: "Wide-open eyes and a slightly open mouth after a surprise — signs of which emotion?",
    ky: "Сюрпризден кийин кең ачылган көздөр жана бир аз ачылган ооз — кайсы сезимдин белгилери?",
  },
  g4s_emo3_q1_a: {
    en: "Surprise",
    ky: "Таң калуу",
  },
  g4s_emo3_q1_b: {
    en: "Anger",
    ky: "Ачуулануу",
  },
  g4s_emo3_q1_c: {
    en: "Indifference",
    ky: "Кайдыгерлик",
  },
  g4s_emo3_q2: {
    en: "What do people call “calm”?",
    ky: "«Тынчтык / сабырдуулук» деп эмнени айтышат?",
  },
  g4s_emo3_q2_a: {
    en: "A steady, even inner state",
    ky: "Тегиз, туруктуу ички абал",
  },
  g4s_emo3_q2_b: {
    en: "Feeling sleepy all the time",
    ky: "Ар дайым уйкусуроо",
  },
  g4s_emo3_q2_c: {
    en: "Only the feeling of hunger",
    ky: "Бир гана ачкалык сезими",
  },
  g4s_emo3_q3: {
    en: "In the middle of a talk Tali went quiet and started breathing deeply. Friendly asks: “What is he doing?” Tali says: “He wants to fall asleep!” Correct Tali.",
    ky: "Сүйлөшүүнүн ортосунда Тали унчукпай калып, терең дем ала баштады. Friendly сурайт: «Ал эмне кылып жатат?» Тали айтат: «Уктагысы келет!» Талини оңдо.",
  },
  g4s_emo3_q3_a: {
    en: "Yes, he’s falling asleep",
    ky: "Ооба, ал уктап жатат",
  },
  g4s_emo3_q3_b: {
    en: "No — he’s trying to calm down and gather his thoughts",
    ky: "Жок — ал өзүн тынчтандырып, ойлорун чогултууга аракет кылып жатат",
  },
  g4s_emo3_q3_c: {
    en: "No — he’s running away from the conversation",
    ky: "Жок — ал сүйлөшүүдөн качып жатат",
  },
  g4s_emo3_q4: {
    en: "Surprise can be pleasant or unpleasant. An example of each:",
    ky: "Таң калуу жагымдуу да, жагымсыз да болот. Ар бирине мисал:",
  },
  g4s_emo3_q4_a: {
    en: "Pleasant: an unexpected compliment; unpleasant: a bad grade you didn’t expect",
    ky: "Жагымдуу: күтүлбөгөн мактоо; жагымсыз: күтүлбөгөн жаман баа",
  },
  g4s_emo3_q4_b: {
    en: "Surprise is only ever unpleasant",
    ky: "Таң калуу бир гана жагымсыз болот",
  },
  g4s_emo3_q4_c: {
    en: "Surprise doesn’t exist",
    ky: "Таң калуу деген жок",
  },
});

/** @type {Record<string, {en: string, ky: string}>} */
const dialog = {
  g4m_md_l1_0: {
    en: "Hi! I just found an old treasure map. It says: “The treasure is buried 3 475 steps from the oak.” I’ve already walked three thousand steps and I can’t tell — how far is left? Help me figure out big numbers!",
    ky: "Салам! Мен эски кенч картасын таптым. Анда жазылган: «Кенч эменден 3 475 кадам алыстыкта көмүлгөн.» Мен үч миң кадам басып койдум да, канча калганын түшүнбөй жатам. Чоң сандарды түшүнүүгө жардам бер!",
  },
  g4m_md_l1_1: {
    en: "Tali, don’t worry. Big numbers are like a layered cake: first thousands, then hundreds, then tens, then ones. Let’s show Tali together!",
    ky: "Тали, кабатырланба. Чоң сандар — катмарлуу торт сыяктуу: адегенде миңдер, андан соң жүздөр, андан соң ондуктар, андан соң бирдиктер. Кел, Талиге чогуу көрсөтөлү!",
  },
  g4m_md_l2_0: {
    en: "Digit, I need help! I wrote down the treasure safe number: 6 253. But I forgot what each digit means. If I enter it wrong — the safe won’t open!",
    ky: "Digit, мага жардам керек! Мен кенч сейфинин номерин жаздым: 6 253. Бирок ар бир цифра эмнени билдирерин унутуп калдым. Туура эмес терсем — сейф ачылбайт!",
  },
  g4m_md_l2_1: {
    en: "Easy, Tali. Place values are like a keyhole: each digit has its own spot and its own job. Let’s help Tali open the safe together!",
    ky: "Тынч бол, Тали. Разряддар — ачкыч тешиги сыяктуу: ар бир цифранын өз орду жана өз ролу бар. Кел, Талиге сейфти чогуу ачууга жардам берели!",
  },
  g4m_md_l3_0: {
    en: "I found two treasures! The first has 8 450 coins, the second — 8 540. I want the bigger one, but I can’t decide — they look so alike!",
    ky: "Мен эки кенч таптым! Биринчисинде 8 450 тыйын, экинчисинде — 8 540. Мен чоңураагын алгым келет, бирок чече албай жатам — алар абдан окшош!",
  },
  g4m_md_l3_1: {
    en: "Tali, comparing numbers is like a race: you look at thousands first, then hundreds, and so on. The first one that “runs ahead” is the bigger number!",
    ky: "Тали, сандарды салыштыруу — жарыш сыяктуу: адегенде миңдерге, андан соң жүздөргө жана ушинтип карайсың. Ким «алдыга чуркаса» — ошол чоңураак сан!",
  },
  g4m_cm_l1_0: {
    en: "Digit, I opened a bakery for dinosaurs! Today I baked 213 buns. Tomorrow — the same, and the day after too. But I don’t know how many that makes in three days. Multiplying in columns feels too scary!",
    ky: "Digit, мен динозаврлар үчүн нанкана ачтым! Бүгүн 213 булочка бышырдым. Эртең — ошончо, эртеңки күнү да. Бирок үч күндө жалпысы канча болорун билбейм. Мамычага көбөйтүү абдан коркунучтуу көрүнөт!",
  },
  g4m_cm_l1_1: {
    en: "Tali, let me show you a trick: multiply each place separately, from the bottom up. It’s like stacking floors of a house — one by one, and it’s not scary!",
    ky: "Тали, мен сага бир амал көрсөтөйүн: ар бир разрядды өзүнчө, ылдыйдан өйдө көбөйтөбүз. Бул үйдүн кабаттарын койгондой — бирден, коркпой!",
  },
  g4m_cm_l2_0: {
    en: "The dinosaur building crew lays 1 346 bricks a day. I need to order bricks for 5 days, but the numbers are so big… Digit, I’m scared I’ll mess up and order too few!",
    ky: "Динозаврлардын курулуш бригадасы күнүнө 1 346 кирпич коёт. Мага 5 күнгө кирпич заказ кылыш керек, бирок сандар өтө чоң… Digit, жаңылып, аз заказ кылып коём деп коркуп жатам!",
  },
  g4m_cm_l2_1: {
    en: "Tali, for big numbers the column method is your best friend. Multiply each place and don’t forget to carry. Let’s go together!",
    ky: "Тали, чоң сандар үчүн мамыча — эң жакшы дос. Ар бир разрядды көбөйтүп, көчүрүүнү унутпа. Кел, чогуу кетели!",
  },
  g4m_cm_l3_0: {
    en: "This is really scary — multiplying a big number by a big number! 236 × 12… I don’t even know where to start. Digit, are you sure I can do this?",
    ky: "Бул энди чындап коркунучтуу — чоңду чоңго көбөйтүү! 236 × 12… Кайдан баштоону да билбейм. Digit, мен аныктай алам деп чын эле ишенесиңби?",
  },
  g4m_cm_l3_1: {
    en: "Tali, the main secret: multiply by the ones first, then by the tens — and shift the second result one step to the left. Two lines, then add. You’ve got this — I believe in you!",
    ky: "Тали, негизги сыр: адегенде бирдиктерге, андан соң ондуктарга көбөйтөбүз — экинчи жыйынтыкты бир кадам солго жылдырабыз. Эки сап, андан соң кошуп. Сен жасай аласың, мен сага ишенем!",
  },
  g4m_fr_l1_0: {
    en: "Digit, I have a problem! I cut a pizza for the party into 4 pieces. I ate one. How do I write how much I ate? A whole pizza — no, but zero — also no…",
    ky: "Digit, мага көйгөй бар! Мен кече үчүн пиццаны 4 бөлүккө бөлдүм. Бирин жедим. Канча жегенимди кантип жазам? Бүтүн пицца — жок, бирок нөл — да жок…",
  },
  g4m_fr_l1_1: {
    en: "Tali, you just discovered fractions! “One part out of four” is the fraction 1/4. The numerator is how many you took, the denominator is how many equal parts you cut!",
    ky: "Тали, сен жаңы эле бөлчөктөрдү ачтың! «Төрттөн бир бөлүк» — бул 1/4 бөлчөгү. Алымы — канча алганың, бөлүмү — канча бөлүккө бөлгөнүң!",
  },
  g4m_fr_l2_0: {
    en: "Digit, I’m cutting an apple into 4 parts. But… one piece came out bigger than the others. Is that still the fraction 1/4?",
    ky: "Digit, мен алманы 4 бөлүккө бөлүп жатам. Бирок… бир бөлүк калгандарынан чоңураак чыкты. Бул дагы эле 1/4 бөлчөгүбү?",
  },
  g4m_fr_l2_1: {
    en: "No, Tali! That’s the most important rule of fractions: the parts must be EQUAL. Otherwise the fraction just doesn’t work. Let’s cut it again — carefully!",
    ky: "Жок, Тали! Бул бөлчөктөрдүн эң маанилүү эрежеси: бөлүктөр ТЕҢ болушу керек. Болбосо бөлчөк иштебейт. Кел, кайра кылдаттык менен кесели!",
  },
  g4m_fr_l3_0: {
    en: "My friend and I shared a pizza: I took 3/8, he took 5/8. He says he has more. I don’t believe it — the numbers look the same, only 3 and 5 are different!",
    ky: "Досум менен пиццаны бөлдүк: мен 3/8 алдым, ал 5/8 алды. Ал өзүндө көбүрөөк дейт. Мен ишенбейм — сандар бирдей көрүнөт, тек 3 менен 5 башкача!",
  },
  g4m_fr_l3_1: {
    en: "Tali, you almost cracked the rule! When the denominators are the same — just look at the numerators: whoever has the bigger numerator has the bigger fraction. It’s like a contest!",
    ky: "Тали, сен эрежени дээрлик таптың! Бөлүмдөр бирдей болсо — жөн гана алымдарга кара: кимдин алымы чоң болсо, ошонун бөлчөгү чоң. Бул мелдеш сыяктуу!",
  },
};

Object.assign(dialog, {
  g4r_conj_l1_0: {
    en: "Hi, I’m Word! Today Tali wrote in his diary: “Я хожу в школу. Ты ходишь в школу. Он ходить в школу.” Something’s wrong in the third sentence — Tali didn’t notice the mistake!",
    ky: "Салам, мен Сөз! Бүгүн Тали күндөлүгүнө жазды: «Я хожу в школу. Ты ходишь в школу. Он ходить в школу.» Үчүнчү сүйлөмдө бир нерсе туура эмес — Тали катаны байкаган жок!",
  },
  g4r_conj_l1_1: {
    en: "Really? I thought everything was fine… Please explain!",
    ky: "Чынындабы? Мага баары туура көрүнгөн… Түшүндүрүп коёсуңарбы!",
  },
  g4r_conj_l2_0: {
    en: "Word, I’m writing a play about dinosaurs! There’s a line like this: “Мы петь вместе!” Sounds beautiful, right?",
    ky: "Сөз, мен динозаврлар жөнүндө пьеса жазып жатам! Мындай реплика бар: «Мы петь вместе!» Кооз угулат, туурабы?",
  },
  g4r_conj_l2_1: {
    en: "Tali, “мы петь” isn’t conjugation! You need to change the verb by person. “Мы поём” — that’s how it should sound. Let’s fix the play together!",
    ky: "Тали, «мы петь» — бул жакталуу эмес! Этишти жак боюнча өзгөртүш керек. «Мы поём» — туура ушундай угулат. Кел, пьесаны чогуу оңдойлу!",
  },
  g4r_conj_l3_0: {
    en: "Word, I’m almost done with the play! But the last line won’t come out: “Мы бежит к финишу!” Something sounds off…",
    ky: "Сөз, мен пьесаны дээрлик бүтүрдүм! Бирок акыркы реплика чыкпай жатат: «Мы бежит к финишу!» Бир нерсе туура эмес угулат…",
  },
  g4r_conj_l3_1: {
    en: "Tali, you can feel the mistake — that’s a good sign! Now we need to find the verb’s conjugation and pick the right ending. You already know almost everything!",
    ky: "Тали, сен катаны сезип жатасың — бул жакшы белги! Эми этиштин жакталуусун аныктап, туура аягын тандаш керек. Сен дээрлик баарын билесиң!",
  },
  g4r_cases_l1_0: {
    en: "Word, I’m lost in cases! “Кот лежит” and “Я вижу кота” — why is it «кот» in one place and «кота» in the other?",
    ky: "Сөз, мен жөндөмөлөрдөн чаташып калдым! «Кот лежит» жана «Я вижу кота» — эмне үчүн бир жерде «кот», экинчисинде «кота»?",
  },
  g4r_cases_l1_1: {
    en: "Tali, those are two different cases! Nominative answers “кто?” — it’s the subject, the owner of the sentence. Accusative — “кого? что?” — is the object of the action. Let’s figure it out!",
    ky: "Тали, бул эки башка жөндөмө! Именительный «кто?» дегенге жооп берет — бул ээ, сүйлөмдүн ээси. Винительный — «кого? что?» — аракеттин объектиси. Кел, чогуу түшүнөлү!",
  },
  g4r_cases_l2_0: {
    en: "Word, I need to write a letter to a friend! “Я отправил письмо мама” — is that right? Something sounds weird…",
    ky: "Сөз, мага досума кат жазыш керек! «Я отправил письмо мама» — туурабы? Бир нерсе кулакка тийип жатат…",
  },
  g4r_cases_l2_1: {
    en: "Tali, you can feel it — «мама» doesn’t fit here! After “отправил кому?” you need dative: «маме». And “не хватает кого?” — genitive: «мамы». Let’s look at both!",
    ky: "Тали, сен сезип жатасың — бул жерде «мама» туура келбейт! «Отправил кому?» дегенден кийин дательный керек: «маме». Ал эми «не хватает кого?» — родительный: «мамы». Кел, экөөнү тең карап чыгалы!",
  },
  g4r_cases_l3_0: {
    en: "Word, the last two cases! Instrumental and prepositional — the most mysterious names. Is “instrumental” because you create something?",
    ky: "Сөз, акыркы эки жөндөмө! Творительный жана предложный — эң сырдуу аттар. «Творительный» — анткени бир нерсе жаратасыңбы?",
  },
  g4r_cases_l3_1: {
    en: "You almost guessed, Tali! Instrumental is “creating with the help of something.” “Пишу карандашом” — instrumental. And prepositional — because it is always used WITH a preposition. Never without one!",
    ky: "Дээрлик таптың, Тали! Творительный — «бир нерсенин жардамы менен жаратуу». «Пишу карандашом» — творительный. Ал эми предложный — анткени ал ар дайым ПРЕДЛОГ МЕНЕН колдонулат. Эч качан андан тышкары!",
  },
  g4r_text_l1_0: {
    en: "Word, I read the story “Солнце зашло. Стало темно. Птицы умолкли.” It’s very short. What’s it even about? I don’t get it!",
    ky: "Сөз, мен «Солнце зашло. Стало темно. Птицы умолкли» деген аңгемени окудум. Абдан кыска. Ал эмне жөнүндө эле? Түшүнбөйм!",
  },
  g4r_text_l1_1: {
    en: "Tali, even a short text has a topic! These three sentences together paint a picture. Close your eyes — what do you see? That’s the topic!",
    ky: "Тали, кыска тексттин да темасы бар! Бул үч сүйлөм чогуу сүрөт тартат. Көзүңдү жум — эмнени көрөсүң? Ошол эле тема!",
  },
  g4r_text_l2_0: {
    en: "I read a text about a hedgehog: “Ёж свернулся в клубок. Иголки торчат во все стороны. Никто не тронет ежа.” Word, what’s the main idea here? There are three sentences — and each one matters!",
    ky: "Мен кирпи жөнүндө текст окудум: «Ёж свернулся в клубок. Иголки торчат во все стороны. Никто не тронет ежа.» Сөз, бул жерде негизги ой кайсы? Үч сүйлөм бар — ар бири маанилүү!",
  },
  g4r_text_l2_1: {
    en: "Tali, the main idea isn’t one of the sentences — it’s what the author wanted to say with the whole text. Why was this text written? What should the reader understand?",
    ky: "Тали, негизги ой — сүйлөмдөрдүн бири эмес, автор бүт текст менен эмне айткысы келгени. Бул текст эмне үчүн жазылган? Окурман эмнени түшүнүшү керек?",
  },
  g4r_text_l3_0: {
    en: "Word, I read about Masha looking for mushrooms. “Потом позвала сестру. Наконец набрали корзину. Сначала нашла гриб.” Something’s wrong with the order — my head is spinning!",
    ky: "Сөз, мен козу карын издеген Маша жөнүндө окудум. «Потом позвала сестру. Наконец набрали корзину. Сначала нашла гриб.» Тартиби менен бир нерсе туура эмес — башым айланып жатат!",
  },
  g4r_text_l3_1: {
    en: "Tali, the order of events in a text is sequence! Words like “сначала”, “потом”, “наконец” are beacons that show what comes after what. Let’s put the order back!",
    ky: "Тали, тексттеги окуялардын тартиби — бул ырааттуулук! «Сначала», «потом», «наконец» сыяктуу сөздөр — эмненин артынан эмне келерин көрсөткөн маяктар. Кел, тартипти калыбына келтирели!",
  },
});

Object.assign(dialog, {
  g4e_pres_l1_0: {
    en: "Hi! I’m Spark — Tali’s new friend on English Island! Tali just wrote in English: “She go to school every day.” I can tell something’s wrong — but I can’t explain why!",
    ky: "Салам! Мен Spark — Талинин Англис аралындагы жаңы досу! Тали англисче жазды: «She go to school every day.» Бир нерсе туура эмес экенин түшүндүм — бирок эмне үчүн экенин түшүндүрө албайм!",
  },
  g4e_pres_l1_1: {
    en: "I tried my best! Isn’t “go” okay?",
    ky: "Мен аракет кылдым! «Go» туура эмеспи?",
  },
  g4e_pres_l2_0: {
    en: "Spark, I need to say that the cat doesn’t eat fish. I wrote: “The cat not eats fish.” Is that right?",
    ky: "Spark, мышык балык жебейт деп айтышым керек. Мен жаздым: «The cat not eats fish.» Туурабы?",
  },
  g4e_pres_l2_1: {
    en: "Tali, almost! In Present Simple, negation uses don’t or doesn’t — not just “not.” With he/she/it — doesn’t, with the others — don’t. Shall we try again?",
    ky: "Тали, дээрлик! Present Simple терс формасында don’t же doesn’t колдонулат — жөн гана «not» эмес. He/she/it менен — doesn’t, калгандары менен — don’t. Кайра аракет кылалыбы?",
  },
  g4e_pres_l3_0: {
    en: "Spark, how do I ask in English: “Does she speak French?” I wrote: “She speak French?” It sounds a bit short…",
    ky: "Spark, англисче кантип сурайм: «Ал французча сүйлөйбү?» Мен жаздым: «She speak French?» Бир аз кыска угулат…",
  },
  g4e_pres_l3_1: {
    en: "Tali, for a question we need a helping verb — Does! It “jumps” to the front. “Does she speak French?” Let’s try!",
    ky: "Тали, суроо үчүн бизге жардамчы этиш керек — Does! Ал башына «секирет». «Does she speak French?» Аракет кылалы!",
  },
  g4e_past_l1_0: {
    en: "Spark, yesterday I climbed a mountain. How do I say that in English? “Yesterday we climb the mountain.”",
    ky: "Spark, кечээ мен тоого чыктым. Муну англисче кантип айтам? «Yesterday we climb the mountain.»",
  },
  g4e_past_l1_1: {
    en: "Tali, that’s the past tense — Past Simple! Regular verbs get the ending -ed. “We climbed” — that’s how!",
    ky: "Тали, бул өткөн чак — Past Simple! Туура этиштерге -ed аягы кошулат. «We climbed» — мына ошондой!",
  },
  g4e_past_l2_0: {
    en: "Spark, I wrote in my diary: “Last night I haved a strange dream.” Is that right?",
    ky: "Spark, мен күндөлүккө жаздым: «Last night I haved a strange dream.» Туурабы?",
  },
  g4e_past_l2_1: {
    en: "Tali, “have” is an irregular verb! It has a special past form — “had.” These verbs you learn by heart; they don’t add -ed!",
    ky: "Тали, «have» — туура эмес этиш! Анын өзгөчө өткөн формасы бар — «had». Мындай этиштерди жатташ керек, аларга -ed кошулбайт!",
  },
  g4e_past_l3_0: {
    en: "Spark, I’m writing a story about Anna: “Last Saturday, Anna meet her friends and they watch a film.” Is that right?",
    ky: "Spark, мен Анна жөнүндө аңгеме жазып жатам: «Last Saturday, Anna meet her friends and they watch a film.» Туурабы?",
  },
  g4e_past_l3_1: {
    en: "Tali, two verbs — and both in the wrong form! Meet is irregular, watch is regular. Let’s fix them together — and your story will be great!",
    ky: "Тали, эки этиш — экөө тең туура эмес формада! Meet — туура эмес, watch — туура. Кел, чогуу оңдойлу — аңгемең сонун болот!",
  },
  g4e_quest_l1_0: {
    en: "Spark, I want to ask you: do you like ice cream? I wrote: “You like ice cream?” Is that right?",
    ky: "Spark, сага сурагым келет: балмуздакты жактырасыңбы? Мен жаздым: «You like ice cream?» Туурабы?",
  },
  g4e_quest_l1_1: {
    en: "Tali, you’re missing the helping verb! “Do you like ice cream?” — that’s a question you can answer with “Yes” or “No.” We’ll have lots of those today!",
    ky: "Тали, жардамчы этиш жетишпей жатат! «Do you like ice cream?» — бул «Yes» же «No» деп жооп берүүгө боло турган суроо. Бүгүн бизде мындайлар көп!",
  },
  g4e_quest_l2_0: {
    en: "Spark, I lost my hat! How do I ask where it is? I wrote “What is my hat?” — but that’s not about place…",
    ky: "Spark, мен шляпамды жоготуп алдым! Ал кайда экенин кантип сурайм? «What is my hat?» деп жаздым — бирок бул жер жөнүндө эмес…",
  },
  g4e_quest_l2_1: {
    en: "Tali, “What” means “what,” but you need “where” — that’s “Where”! Question words are like keys: each opens its own lock. Let’s look at them all!",
    ky: "Тали, «What» — бул «эмне», сага болсо «кайда» керек — бул «Where»! Суроо сөздөрү — ачкычтай: ар бири өз кулпусун ачат. Кел, баарын карап чыгалы!",
  },
  g4e_quest_l3_0: {
    en: "Spark, you asked: “Do you like cats?” I answered: “Yes, I likes.” Is that right?",
    ky: "Spark, сен сурадың: «Do you like cats?» Мен жооп бердим: «Yes, I likes.» Туурабы?",
  },
  g4e_quest_l3_1: {
    en: "Tali, in a short answer we repeat the helping verb — do or does, did! “Yes, I do.” Short, clear, correct!",
    ky: "Тали, кыска жоопта биз жардамчы этишти кайталайбыз — do же does, did! «Yes, I do.» Кыска, так, туура!",
  },
});

Object.assign(dialog, {
  g4s_help_l1_0: {
    en: "Hi! I’m Friendly — your guide in the City of Social Skills. Today Tali is trying to open a heavy door with bags in his paws — and he just can’t. He’s been standing there five minutes and turning red. What does he need to do?",
    ky: "Салам! Мен Friendly — Социалдык көндүмдөр шаарынын жол көрсөтүүчүсү. Бүгүн Тали тамандарында пакеттер менен оор эшикти ачууга аракет кылып жатат — бирок мүмкүн эмес. Ал беш мүнөттөн бери турат да, кызарып жатат. Ага эмне кылыш керек?",
  },
  g4s_help_l1_1: {
    en: "I don’t want to ask for help — it’s awkward…",
    ky: "Жардам сурагым келбейт — ыңгайсыз…",
  },
  g4s_help_l2_0: {
    en: "Friendly, I need an eraser from the kid next to me. I said: “Give me the eraser!” He gave it, but looked kind of grumpy… Why?",
    ky: "Friendly, мага парталаштан өчүргүч керек. Мен айттым: «Өчүргүчтү бер!» Ал берди, бирок кабагы түйүлгөндөй… Эмне үчүн?",
  },
  g4s_help_l2_1: {
    en: "Tali, “Give me the eraser” is an order, not a request! The word “please” and a friendly tone turn a demand into an invitation to cooperate. Shall we try another way?",
    ky: "Тали, «Өчүргүчтү бер» — бул буйрук, өтүнүч эмес! «Сураныч» деген сөз жана туура интонация талапты кызматташууга чакырууга айлантат. Башкача аракет кылалыбы?",
  },
  g4s_help_l3_0: {
    en: "Friendly, today I had three situations where I needed help. I didn’t know how to handle each one… Walk through them with me?",
    ky: "Friendly, бүгүн жардам керек болгон үч кырдаал болду. Ар бири менен кантип күрөшөөрүмдү билбедим… Мен менен чогуу карап чыгасыңбы?",
  },
  g4s_help_l3_1: {
    en: "Of course! Looking at real situations is the best way to learn. Let’s go!",
    ky: "Албетте! Чыныгы кырдаалдарды талдоо — үйрөнүүнүн эң жакшы жолу. Кеттик!",
  },
  g4s_emo_l1_0: {
    en: "Friendly, today my friend came to school with slumped shoulders and a quiet voice. I didn’t know what to say… Is that sadness?",
    ky: "Friendly, бүгүн досум мектепке ийиндери салбырап, үнү тынч келди. Эмне айтарымды билбедим… Бул кайгыбы?",
  },
  g4s_emo_l1_1: {
    en: "Tali, you already know how to read emotions from outer signs — that’s an important skill! Slumped shoulders, a quiet voice — yes, those are signs of sadness. Let’s look at how to respond well.",
    ky: "Тали, сен сырткы белгилерден сезимдерди окуй билесиң — бул маанилүү көндүм! Салбыраган ийиндер, тынч үн — ооба, бул кайгынын белгилери. Кел, кантип туура жооп берүүнү карап чыгалы.",
  },
  g4s_emo_l2_0: {
    en: "Friendly, my brother broke my dinosaur model! I’m so angry I want to throw something. How do I deal with this?",
    ky: "Friendly, бир тууганым менин динозавр моделимди сындырды! Мен ушунчалык ачууланып, бир нерсе ыргыткым келет. Муну менен кантип күрөшөм?",
  },
  g4s_emo_l2_1: {
    en: "Tali, anger is a normal emotion! But it’s important to show it safely. Tell your brother in words how much it hurts — that’s much better than throwing things.",
    ky: "Тали, ачуу — кадимки сезим! Бирок аны коопсуз билдирүү маанилүү. Бир тууганыңа сөз менен канчалык таарынганыңды айт — бул нерсе ыргыткандан алда канча жакшыраак.",
  },
  g4s_emo_l3_0: {
    en: "Friendly, I walked into class and saw a surprise on my desk! My eyes went wide, my mouth opened a little… What was that?",
    ky: "Friendly, мен класска кирип, партамда сюрприз көрдүм! Көздөрүм кең ачылды, оозум бир аз ачылды… Бул эмне болду?",
  },
  g4s_emo_l3_1: {
    en: "Tali, that’s surprise! It can be pleasant (like your surprise) or unpleasant. And calm is the opposite: even breathing, relaxed shoulders, thoughts without panic.",
    ky: "Тали, бул таң калуу! Ал жагымдуу (сенин сюрпризиңдей) жана жагымсыз болот. Ал эми тынчтык — тескериси: тегиз дем алуу, бош ийиндер, дүрбөлөңсүз ойлор.",
  },
  g4s_turn_l1_0: {
    en: "Friendly, there’s a long line in the cafeteria. A friend waves from the middle of the line and calls me forward. Everyone’s looking…",
    ky: "Friendly, ашканада узун кезек. Досум кезектин ортосунан кол булуп, мени алдыга чакырып жатат. Баары карап турат…",
  },
  g4s_turn_l1_1: {
    en: "Tali, this is a tricky moment! Your friend wants to help, but cutting the line hurts the rights of people who are waiting. Respect for the line is respect for people. What should you do?",
    ky: "Тали, бул оңой эмес учур! Досуң жардам бергиси келет, бирок алдыга өтүү күтүп тургандардын укугун бузат. Кезекке урмат — адамдарга урмат. Кантип кылыш керек?",
  },
  g4s_turn_l2_0: {
    en: "Friendly, three of my friends all want to ride my scooter at the same time. I don’t know how to share fairly — someone will get upset!",
    ky: "Friendly, үч досум бир убакта менин самокатымда тебүүнү каалайт. Адилет бөлүштүрүүнү билбейм — кимдир бирөө таарынат!",
  },
  g4s_turn_l2_1: {
    en: "Tali, fairness isn’t always “exactly equal” — it’s when everyone understands the rules and agrees with them. Let’s invent a solution together!",
    ky: "Тали, адилеттик ар дайым «так тең» эмес — бул баарына эрежелер түшүнүктүү жана баары макул болгондо. Кел, чогуу чечим ойлоп табалы!",
  },
  g4s_turn_l3_0: {
    en: "Friendly, during a board game I noticed one player peeking at the cards! What should I do — yell or stay quiet?",
    ky: "Friendly, үстөл оюнунда бир оюнчу карталарга карай кагып жатканын байкадым! Эмне кылыш керек — урушуубу же унчукпообу?",
  },
  g4s_turn_l3_1: {
    en: "Tali, game rules are an agreement between everyone playing. Breaking the rules is called unfair play. You don’t need to yell — calmly name the problem and suggest a fix.",
    ky: "Тали, оюн эрежелери — бардык катышуучулардын ортосундагы келишим. Эрежени бузуу адилетсиз оюн деп аталат. Урушуунун кереги жок — көйгөйдү тынч атап, чечим сунушта.",
  },
});

// —— Write + validate ——
const out = { tasks, dialog };
const outPath = join(__dirname, "en_ky_pedagogy_fix.json");

const missingTasks = Object.keys(ruTasks).filter((k) => !tasks[k]);
const extraTasks = Object.keys(tasks).filter((k) => !ruTasks[k]);
const missingDialog = Object.keys(ruDialog).filter((k) => !dialog[k]);
const extraDialog = Object.keys(dialog).filter((k) => !ruDialog[k]);

const bad = [];
for (const [section, bag] of [
  ["tasks", tasks],
  ["dialog", dialog],
]) {
  for (const [k, v] of Object.entries(bag)) {
    if (!v?.en?.trim() || !v?.ky?.trim()) bad.push(`${section}.${k}: empty`);
    if (/Think it through|Choose an alliance|Hi! Lesson:|Ойлонуп көр:/i.test(v.en + " " + v.ky)) {
      bad.push(`${section}.${k}: stub pattern`);
    }
  }
}

const birds = [
  "pre_birds_tree_vs_bush",
  "pre_opt_tree_six_birds",
  "pre_opt_bush_four_birds",
  "pre_opt_birds_equal_spots",
];
for (const k of birds) {
  if (!tasks[k]) bad.push(`missing bird key ${k}`);
}

if (missingTasks.length || missingDialog.length || bad.length) {
  console.error("VALIDATION FAILED");
  if (missingTasks.length) console.error("missing tasks", missingTasks);
  if (missingDialog.length) console.error("missing dialog", missingDialog);
  if (extraTasks.length) console.error("extra tasks (ok if intentional)", extraTasks);
  if (extraDialog.length) console.error("extra dialog", extraDialog);
  if (bad.length) console.error("bad", bad);
  process.exit(1);
}

writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");
console.log(
  JSON.stringify({
    ok: true,
    path: outPath,
    tasks: Object.keys(tasks).length,
    dialog: Object.keys(dialog).length,
    extraTasks,
  })
);
