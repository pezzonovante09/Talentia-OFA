/**
 * Fix grade-3 residual wrong ✓ and EN/KY desync.
 * Writes unique keys to ru/en/ky.json, then rewires worlds.ts.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const locPath = (f) => path.join(root, 'src/i18n/locales', f);

/** @type {Record<string, {ru: string, en: string, ky: string}>} */
const keys = {
  // ── g3w-eco-l1: ecosystem pedagogy (unique keys) ──
  g3w_ecol1_q1: {
    ru: 'Если вырубить все деревья в лесу, что произойдёт с его жителями?',
    en: 'If all the trees in a forest are cut down, what happens to its inhabitants?',
    ky: 'Эгер токойдогу бардык дарактарды кыйса, анын тургундарына эмне болот?',
  },
  g3w_ecol1_q1_a: {
    ru: 'Ничего не изменится',
    en: 'Nothing will change',
    ky: 'Эч нерсе өзгөрбөйт',
  },
  g3w_ecol1_q1_b: {
    ru: 'Исчезнут животные, потеряется среда обитания',
    en: 'Animals will disappear and their habitat will be lost',
    ky: 'Жаныбарлар жок болот, жашоо чөйрөсү жоголот',
  },
  g3w_ecol1_q1_c: {
    ru: 'Появится больше животных',
    en: 'There will be more animals',
    ky: 'Жаныбарлар көбөйөт',
  },
  g3w_ecol1_q3: {
    ru: 'Если исчезнут пчёлы, что случится с растениями?',
    en: 'If bees disappear, what happens to plants?',
    ky: 'Эгер аарылар жок болсо, өсүмдүктөргө эмне болот?',
  },
  g3w_ecol1_q3_a: {
    ru: 'Ничего, пчёлы не важны',
    en: 'Nothing — bees are not important',
    ky: 'Эч нерсе, аарылар маанилүү эмес',
  },
  g3w_ecol1_q3_b: {
    ru: 'Многие растения не смогут опыляться и плодоносить',
    en: 'Many plants will not be able to pollinate and bear fruit',
    ky: 'Көп өсүмдүктөр чаңдашып, жемиш бере албай калат',
  },
  g3w_ecol1_q3_c: {
    ru: 'Растений станет больше',
    en: 'There will be more plants',
    ky: 'Өсүмдүктөр көбөйөт',
  },
  g3w_ecol1_q4: {
    ru: 'Что из перечисленного — экосистема? Библиотека, аквариум с рыбками, завод.',
    en: 'Which of these is an ecosystem? A library, a fish aquarium, a factory.',
    ky: 'Төмөнкүлөрдүн кайсынысы экосистема? Китепкана, балыктуу аквариум, завод.',
  },
  g3w_ecol1_q4_a: {
    ru: 'Библиотека',
    en: 'A library',
    ky: 'Китепкана',
  },
  g3w_ecol1_q4_b: {
    ru: 'Аквариум с рыбками',
    en: 'A fish aquarium',
    ky: 'Балыктуу аквариум',
  },
  g3w_ecol1_q4_c: {
    ru: 'Завод',
    en: 'A factory',
    ky: 'Завод',
  },

  // ── g3w-eco-l2: food chain (unique keys for hijacked opts) ──
  g3w_ecol2_q1: {
    ru: 'Трава → заяц → лиса. Как называется такая последовательность?',
    en: 'Grass → hare → fox. What is this sequence called?',
    ky: 'Чөп → коён → түлкү. Мындай ырааттуулук кандай аталат?',
  },
  g3w_ecol2_q1_a: {
    ru: 'Цепь питания',
    en: 'A food chain',
    ky: 'Тамак чынжыры',
  },
  g3w_ecol2_q1_b: {
    ru: 'Расписание',
    en: 'A timetable',
    ky: 'Расписание',
  },
  g3w_ecol2_q1_c: {
    ru: 'Карта',
    en: 'A map',
    ky: 'Карта',
  },
  g3w_ecol2_q2: {
    ru: 'Кто стоит в начале почти любой цепи питания?',
    en: 'Who is at the start of almost every food chain?',
    ky: 'Дээрлик ар бир тамак чынжырынын башында ким турат?',
  },
  g3w_ecol2_q2_a: {
    ru: 'Хищник',
    en: 'A predator',
    ky: 'Жырткыч',
  },
  g3w_ecol2_q2_b: {
    ru: 'Растение',
    en: 'A plant',
    ky: 'Өсүмдүк',
  },
  g3w_ecol2_q2_c: {
    ru: 'Гриб',
    en: 'A mushroom',
    ky: 'Козу карын',
  },

  // ── g3w-geo-l1: compass / directions ──
  g3w_compass_q1: {
    ru: 'Компас показывает четыре направления. Какие — основные?',
    en: 'A compass shows four directions. Which are the main ones?',
    ky: 'Компас төрт багытты көрсөтөт. Негизгилери кайсы?',
  },
  g3w_compass_q2: {
    ru: 'Тали идёт навстречу восходящему солнцу. В какую сторону он движется?',
    en: 'Tali walks toward the rising sun. Which way is he going?',
    ky: 'Тали чыгып келе жаткан күнгө карап басат. Ал кайсы тарапка баратат?',
  },
  g3w_compass_q3: {
    ru: 'На карте «север» сверху. Где находится «юг»?',
    en: 'On a map, “north” is at the top. Where is “south”?',
    ky: 'Картада «түндүк» жогоруда. «Түштүк» кайда?',
  },
  g3w_compass_q4: {
    ru: 'Тали встал лицом на север. Что справа?',
    en: 'Tali faces north. What is on his right?',
    ky: 'Тали түндүккө карап турду. Оң жагында эмне?',
  },

  // ── g3w-geo-l2: map / globe / continents ──
  g3w_map_q1: {
    ru: 'Тали спрашивает: чем карта отличается от глобуса?',
    en: 'Tali asks: how is a map different from a globe?',
    ky: 'Тали сурайт: карта глобустан эмнеси менен айырмаланат?',
  },
  g3w_map_q2: {
    ru: 'На карте синим обозначены моря и океаны, а зелёным — что?',
    en: 'On a map, blue marks seas and oceans. What does green mark?',
    ky: 'Картада көк түс деңиздерди жана океандарды белгилейт, жашыл болсо — эмнени?',
  },
  g3w_map_q3: {
    ru: 'Масштаб 1:100 000 означает:',
    en: 'A scale of 1:100 000 means:',
    ky: '1:100 000 масштабы эмнени билдирет:',
  },
  g3w_map_q4: {
    ru: 'Сколько материков на планете Земля?',
    en: 'How many continents are there on planet Earth?',
    ky: 'Жер планетасында канча материк бар?',
  },

  // ── g3r-gen-l2: neuter gender (unique Q keys) ──
  g3r_genl2_q1: {
    ru: 'Тали смотрит на слово ОКНО: «оно моё». Какой у ОКНО род?',
    en: 'Tali looks at the word ОКНО: “оно моё”. What gender is ОКНО?',
    ky: 'Тали ОКНО деген сөзгө карайт: «оно моё». ОКНО кандай род?',
  },
  g3r_genl2_q2: {
    ru: 'СОЛНЦЕ — какой род? Подставь местоимение: «___ моё»?',
    en: 'СОЛНЦЕ — what gender? Choose the pronoun: “___ моё”?',
    ky: 'СОЛНЦЕ — кандай род? Местоимениени кой: «___ моё»?',
  },
  g3r_genl2_q3: {
    ru: 'Среди слов МОЛОКО, КОШКА, СТОЛ найди слово среднего рода.',
    en: 'Among МОЛОКО, КОШКА, СТОЛ find the neuter-gender word.',
    ky: 'МОЛОКО, КОШКА, СТОЛ сөздөрүнүн ичинен орто роддогуну тап.',
  },
  g3r_genl2_q4: {
    ru: 'Какое местоимение «дружит» со словами среднего рода: ПОЛЕ, НЕБО, ДЕРЕВО?',
    en: 'Which pronoun goes with neuter words: ПОЛЕ, НЕБО, ДЕРЕВО?',
    ky: 'Орто роддогу сөздөр менен кайсы местоимение «дос»: ПОЛЕ, НЕБО, ДЕРЕВО?',
  },

  // ── g3r-gen-l3: adjective agreement ──
  g3r_genl3_q1: {
    ru: 'Тали пишет про ДОМ. «Высокий дом» или «Высокое дом»?',
    en: 'Tali writes about ДОМ. Is it «Высокий дом» or «Высокое дом»?',
    ky: 'Тали ДОМ жөнүндө жазат. «Высокий дом»би же «Высокое дом»би?',
  },
  g3r_genl3_q2: {
    ru: '«Синяя птица» или «Синий птица»? Птица — женский род, значит:',
    en: '«Синяя птица» or «Синий птица»? Птица is feminine, so:',
    ky: '«Синяя птица»би же «Синий птица»би? Птица — аял род, демек:',
  },
  g3r_genl3_q3: {
    ru: 'Тали пишет про МОЛОКО. «ТЁПЛОЕ молоко» — почему такое окончание?',
    en: 'Tali writes about МОЛОКО. Why «ТЁПЛОЕ молоко»?',
    ky: 'Тали МОЛОКО жөнүндө жазат. Эмне үчүн «ТЁПЛОЕ молоко»?',
  },
  g3r_genl3_q4: {
    ru: 'Подбери прилагательное к слову КНИГА: интересный, интересная или интересное?',
    en: 'Choose the adjective for КНИГА: интересный, интересная or интересное?',
    ky: 'КНИГА сөзүнө сын атоочту танда: интересный, интересная же интересное?',
  },

  // ── g3r-verb-l1: present tense ──
  g3r_verbl1_present_q: {
    ru: 'Глагол в настоящем времени отвечает на вопрос:',
    en: 'A present-tense verb answers the question:',
    ky: 'Азыркы замандын этиши кайсы суроого жооп берет:',
  },
  g3r_verbl1_present_input: {
    ru: 'Тали пишет дневник о событиях прямо сейчас. Какое слово он использует?',
    en: 'Tali is writing a diary about events right now. Which word does he use?',
    ky: 'Тали азыр эле болуп жаткан окуялар жөнүндө күндөлүк жазат. Ал кайсы сөздү колдонот?',
  },
  g3r_opt_chto_delal: {
    ru: 'Что делал?',
    en: 'What did he do?',
    ky: 'Эмне кылды?',
  },
  g3r_opt_chto_delaet: {
    ru: 'Что делает?',
    en: 'What is he doing?',
    ky: 'Эмне кылат?',
  },
  g3r_opt_chto_budet: {
    ru: 'Что будет делать?',
    en: 'What will he do?',
    ky: 'Эмне кыла турган?',
  },

  // ── g3r-verb-l3: person (лицо), not future ──
  g3r_person_q1: {
    ru: 'Тали мечтает: «Я ___ в космос!» Глагол в 1-м лице:',
    en: 'Tali dreams: “I ___ into space!” Verb in the 1st person:',
    ky: 'Тали кыялданат: «Мен космоско ___!» 1-жак этиш:',
  },
  g3r_person_q2: {
    ru: 'Слово «читаю» — какое лицо? Подсказка: «я читаю»',
    en: 'The word «читаю» — which person? Hint: «я читаю»',
    ky: '«Читаю» сөзү — кайсы жак? Кеңеш: «я читаю»',
  },
  g3r_person_q3: {
    ru: 'Учитель говорит ученику: «Ты ___ задачу». 2-е лицо глагола «решить»:',
    en: 'A teacher tells a student: “You ___ the problem.” 2nd person of «решить»:',
    ky: 'Мугалим окуучуга: «Сен маселени ___». «Решить» этишинин 2-жак:',
  },
  g3r_person_q4: {
    ru: '«Они ___ в парке» — 3-е лицо множественного числа глагола «гулять»:',
    en: '«Они ___ в парке» — 3rd person plural of «гулять»:',
    ky: '«Алар паркта ___» — «гулять» этишинин 3-жак көп түрү:',
  },

  // ── g3r-adj-l3: antonyms ──
  g3r_antonym_q1: {
    ru: 'Антоним к слову ВЕСЁЛЫЙ:',
    en: 'The antonym of ВЕСЁЛЫЙ is:',
    ky: 'ВЕСЁЛЫЙ сөзүнүн антоними:',
  },
  g3r_antonym_q2: {
    ru: 'Антоним к слову ТЁПЛЫЙ:',
    en: 'The antonym of ТЁПЛЫЙ is:',
    ky: 'ТЁПЛЫЙ сөзүнүн антоними:',
  },
  g3r_antonym_q2_a: {
    ru: 'Холодный',
    en: 'Холодный (cold)',
    ky: 'Холодный',
  },
  g3r_antonym_q2_b: {
    ru: 'Мягкий',
    en: 'Мягкий (soft)',
    ky: 'Мягкий',
  },
  g3r_antonym_q2_c: {
    ru: 'Сухой',
    en: 'Сухой (dry)',
    ky: 'Сухой',
  },
  g3r_antonym_q3: {
    ru: 'Пара антонимов — как день и ночь. Выбери настоящую пару:',
    en: 'An antonym pair is like day and night. Choose the real pair:',
    ky: 'Антоним жупу — күндөй жана түн. Чыныгы жупту танда:',
  },
  g3r_antonym_q4: {
    ru: '«Летом дни длинные, а зимой — ___»:',
    en: '“In summer the days are long, and in winter they are ___”:',
    ky: '«Жайында күндөр узун, кышында болсо ___»:',
  },

  // ── g3m-div-l2: remainder tasks ──
  g3m_div_l2_q3: {
    ru: 'Тали делит 7 яблок на 2 друзей поровну. Сколько получит каждый и сколько останется? 7 ÷ 2 = ? (частное и остаток)',
    en: 'Tali shares 7 apples between 2 friends equally. How many does each get, and what is left over? 7 ÷ 2 = ? (quotient and remainder)',
    ky: 'Тали 7 алманы 2 досторуна бирдей бөлөт. Ар бирине канча тийет жана канча калат? 7 ÷ 2 = ? (бөлүнмө жана калдык)',
  },
  g3m_div_l2_q4: {
    ru: '17 карандашей разложили по 5 в коробки. Сколько полных коробок и сколько карандашей останется? 17 ÷ 5 = ? (частное и остаток)',
    en: '17 pencils are packed 5 per box. How many full boxes, and how many pencils are left? 17 ÷ 5 = ? (quotient and remainder)',
    ky: '17 карандашты кутуга 5тен салышат. Канча толук куту жана канча карандаш калат? 17 ÷ 5 = ? (бөлүнмө жана калдык)',
  },
};

// Gender/option labels: keep Russian forms for RU lessons, but give EN glosses where still RU-only
const optionOverrides = {
  g3r_opt_muzhskoy: { ru: 'Мужской', en: 'Мужской (masculine)', ky: 'Мужской' },
  g3r_opt_zhenskiy: { ru: 'Женский', en: 'Женский (feminine)', ky: 'Женский' },
  g3r_opt_sredniy: { ru: 'Средний', en: 'Средний (neuter)', ky: 'Средний' },
  g3r_opt_on: { ru: 'Он', en: 'Он', ky: 'Он' },
  g3r_opt_ona: { ru: 'Она', en: 'Она', ky: 'Она' },
  g3r_opt_ono: { ru: 'Оно', en: 'Оно', ky: 'Оно' },
  g3r_genl2_q3_a: { ru: 'Молоко', en: 'Молоко', ky: 'Молоко' },
  g3r_genl2_q3_b: { ru: 'Кошка', en: 'Кошка', ky: 'Кошка' },
  g3r_genl2_q3_c: { ru: 'Стол', en: 'Стол', ky: 'Стол' },
  // Align existing geo option EN for scale (slightly clearer)
  g3w_geol2t3_a: {
    ru: '1 см на карте = 1 км на местности (100 000 см)',
    en: '1 cm on the map = 1 km on the ground (100 000 cm)',
    ky: 'Картада 1 см = жерде 1 км (100 000 см)',
  },
};

function applyLocale(lang) {
  const file = locPath(`${lang}.json`);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!data.data) data.data = {};
  if (!data.data.tasks) data.data.tasks = {};

  let added = 0;
  let updated = 0;
  for (const [k, tri] of Object.entries(keys)) {
    const v = tri[lang];
    if (data.data.tasks[k] === undefined) added++;
    else if (data.data.tasks[k] !== v) updated++;
    data.data.tasks[k] = v;
  }
  for (const [k, tri] of Object.entries(optionOverrides)) {
    const v = tri[lang];
    if (data.data.tasks[k] !== v) updated++;
    data.data.tasks[k] = v;
  }

  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`${lang}.json: +${added} new, ~${updated} updated task keys`);
}

for (const lang of ['ru', 'en', 'ky']) applyLocale(lang);

// ── worlds.ts rewires ──
const worldsFile = path.join(root, 'src/data/worlds.ts');
let worlds = fs.readFileSync(worldsFile, 'utf8');

const replacements = [
  // g3m-div-l2: remainder answers for t3/t4
  [
    `{ id: 'g3mdivl2t3', type: 'input', questionKey: 'data.tasks.g3m_div_l2_q3', difficulty: 2, answer: '7' },
            { id: 'g3mdivl2t4', type: 'input', questionKey: 'data.tasks.g3m_div_l2_q4', difficulty: 1, answer: '8' },`,
    `{ id: 'g3mdivl2t3', type: 'input', questionKey: 'data.tasks.g3m_div_l2_q3', difficulty: 2, answer: '3 остаток 1' },
            { id: 'g3mdivl2t4', type: 'input', questionKey: 'data.tasks.g3m_div_l2_q4', difficulty: 1, answer: '3 остаток 2' },`,
  ],

  // g3r-gen-l2
  [
    `{ id: 'g3rgenl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g3r_fem_question', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_muzhskoy', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_opt_zhenskiy', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_opt_sredniy', correct: true }] },
            { id: 'g3rgenl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g3r_koshka_gender', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_on', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_opt_ona', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_opt_ono', correct: true }] },
            { id: 'g3rgenl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g3r_kniga_gender', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_genl2_q3_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_genl2_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_genl2_q3_c', correct: false }] },
            { id: 'g3rgenl2t4', type: 'input', questionKey: 'data.tasks.g3r_devochka_gender', difficulty: 2, answer: "Оно" },`,
    `{ id: 'g3rgenl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g3r_genl2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_muzhskoy', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_opt_zhenskiy', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_opt_sredniy', correct: true }] },
            { id: 'g3rgenl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g3r_genl2_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_on', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_opt_ona', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_opt_ono', correct: true }] },
            { id: 'g3rgenl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g3r_genl2_q3', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_genl2_q3_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_genl2_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_genl2_q3_c', correct: false }] },
            { id: 'g3rgenl2t4', type: 'input', questionKey: 'data.tasks.g3r_genl2_q4', difficulty: 2, answer: "Оно" },`,
  ],

  // g3r-gen-l3
  [
    `{ id: 'g3rgenl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g3r_neut_question', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_genl3_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_genl3_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_genl3_q1_c', correct: false }] },
            { id: 'g3rgenl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g3r_okno_gender', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_genl3_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_genl3_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_genl3_q2_c', correct: false }] },
            { id: 'g3rgenl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g3r_solnce_gender', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3r_genl3_q3_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_genl3_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_genl3_q3_c', correct: false }] },
            { id: 'g3rgenl3t4', type: 'input', questionKey: 'data.tasks.g3r_moloko_gender', difficulty: 2, answer: "Интересная" },`,
    `{ id: 'g3rgenl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g3r_genl3_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_genl3_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_genl3_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_genl3_q1_c', correct: false }] },
            { id: 'g3rgenl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g3r_genl3_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_genl3_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_genl3_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_genl3_q2_c', correct: false }] },
            { id: 'g3rgenl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g3r_genl3_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3r_genl3_q3_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_genl3_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_genl3_q3_c', correct: false }] },
            { id: 'g3rgenl3t4', type: 'input', questionKey: 'data.tasks.g3r_genl3_q4', difficulty: 2, answer: "Интересная" },`,
  ],

  // g3r-verb-l1
  [
    `{ id: 'g3rverbl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g3r_present_question', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_chto_delal', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_opt_chto_delaet', correct: true }, { id: 'c', textKey: 'data.tasks.g3r_opt_chto_budet', correct: false }] },`,
    `{ id: 'g3rverbl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g3r_verbl1_present_q', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_chto_delal', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_opt_chto_delaet', correct: true }, { id: 'c', textKey: 'data.tasks.g3r_opt_chto_budet', correct: false }] },`,
  ],
  [
    `{ id: 'g3rverbl1t4', type: 'input', questionKey: 'data.tasks.g3r_which_present', difficulty: 2, answer: "Читает" },`,
    `{ id: 'g3rverbl1t4', type: 'input', questionKey: 'data.tasks.g3r_verbl1_present_input', difficulty: 2, answer: "Пишет" },`,
  ],

  // g3r-verb-l3
  [
    `{ id: 'g3rverbl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g3r_future_question', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_verbl3_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_verbl3_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_verbl3_q1_c', correct: false }] },
            { id: 'g3rverbl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g3r_which_future', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_verbl3_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_verbl3_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_verbl3_q2_c', correct: false }] },
            { id: 'g3rverbl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g3r_verbl3_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3r_verbl3_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_verbl3_q3_b', correct: true }, { id: 'c', textKey: 'data.tasks.g3r_verbl3_q3_c', correct: false }] },
            { id: 'g3rverbl3t4', type: 'input', questionKey: 'data.tasks.g3r_verbl3_q4', difficulty: 2, answer: "Гуляют (3-е лицо, мн.ч.)" },`,
    `{ id: 'g3rverbl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g3r_person_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_verbl3_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_verbl3_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_verbl3_q1_c', correct: false }] },
            { id: 'g3rverbl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g3r_person_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_verbl3_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_verbl3_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_verbl3_q2_c', correct: false }] },
            { id: 'g3rverbl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g3r_person_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3r_verbl3_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_verbl3_q3_b', correct: true }, { id: 'c', textKey: 'data.tasks.g3r_verbl3_q3_c', correct: false }] },
            { id: 'g3rverbl3t4', type: 'input', questionKey: 'data.tasks.g3r_person_q4', difficulty: 2, answer: "гуляют" },`,
  ],

  // g3r-adj-l3
  [
    `{ id: 'g3radjl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g3r_krasny_for_stol', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_adjl3_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_adjl3_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_adjl3_q1_c', correct: false }] },
            { id: 'g3radjl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g3r_krasnoe_for_okno', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_adjl3_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_adjl3_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_adjl3_q2_c', correct: false }] },
            { id: 'g3radjl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g3r_krasnaya_for_kniga', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3r_adjl3_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_adjl3_q3_b', correct: true }, { id: 'c', textKey: 'data.tasks.g3r_adjl3_q3_c', correct: false }] },
            { id: 'g3radjl3t4', type: 'input', questionKey: 'data.tasks.g3r_adjl3_q4', difficulty: 2, answer: "Короткие" },`,
    `{ id: 'g3radjl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g3r_antonym_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_adjl3_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_adjl3_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_adjl3_q1_c', correct: false }] },
            { id: 'g3radjl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g3r_antonym_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_antonym_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_antonym_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_antonym_q2_c', correct: false }] },
            { id: 'g3radjl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g3r_antonym_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3r_adjl3_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_adjl3_q3_b', correct: true }, { id: 'c', textKey: 'data.tasks.g3r_adjl3_q3_c', correct: false }] },
            { id: 'g3radjl3t4', type: 'input', questionKey: 'data.tasks.g3r_antonym_q4', difficulty: 2, answer: "короткие" },`,
  ],

  // g3w-geo-l1
  [
    `{ id: 'g3wgeol1t1', type: 'multiple_choice', questionKey: 'data.tasks.g3w_continents_count', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_geol1t1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3w_geol1t1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g3w_geol1t1_c', correct: false }] },
            { id: 'g3wgeol1t2', type: 'multiple_choice', questionKey: 'data.tasks.g3w_largest_continent', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_geol1t2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_geol1t2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_geol1t2_c', correct: false }] },
            { id: 'g3wgeol1t3', type: 'multiple_choice', questionKey: 'data.tasks.g3w_smallest_continent', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_geol1t3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3w_geol1t3_b', correct: true }, { id: 'c', textKey: 'data.tasks.g3w_geol1t3_c', correct: false }] },
            { id: 'g3wgeol1t4', type: 'input', questionKey: 'data.tasks.g3w_russia_on_continent', difficulty: 2, answer: "Восток" },`,
    `{ id: 'g3wgeol1t1', type: 'multiple_choice', questionKey: 'data.tasks.g3w_compass_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_geol1t1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3w_geol1t1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g3w_geol1t1_c', correct: false }] },
            { id: 'g3wgeol1t2', type: 'multiple_choice', questionKey: 'data.tasks.g3w_compass_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_geol1t2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_geol1t2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_geol1t2_c', correct: false }] },
            { id: 'g3wgeol1t3', type: 'multiple_choice', questionKey: 'data.tasks.g3w_compass_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_geol1t3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3w_geol1t3_b', correct: true }, { id: 'c', textKey: 'data.tasks.g3w_geol1t3_c', correct: false }] },
            { id: 'g3wgeol1t4', type: 'input', questionKey: 'data.tasks.g3w_compass_q4', difficulty: 2, answer: "Восток" },`,
  ],

  // g3w-geo-l2
  [
    `{ id: 'g3wgeol2t1', type: 'multiple_choice', questionKey: 'data.tasks.g3w_oceans_count', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_geol2t1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_geol2t1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_geol2t1_c', correct: false }] },
            { id: 'g3wgeol2t2', type: 'multiple_choice', questionKey: 'data.tasks.g3w_largest_ocean', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_geol2t2_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3w_geol2t2_b', correct: true }, { id: 'c', textKey: 'data.tasks.g3w_geol2t2_c', correct: false }] },
            { id: 'g3wgeol2t3', type: 'multiple_choice', questionKey: 'data.tasks.g3w_arctic_ocean', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_geol2t3_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_geol2t3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_geol2t3_c', correct: false }] },
            { id: 'g3wgeol2t4', type: 'input', questionKey: 'data.tasks.g3w_water_more', difficulty: 2, answer: "6" },`,
    `{ id: 'g3wgeol2t1', type: 'multiple_choice', questionKey: 'data.tasks.g3w_map_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_geol2t1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_geol2t1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_geol2t1_c', correct: false }] },
            { id: 'g3wgeol2t2', type: 'multiple_choice', questionKey: 'data.tasks.g3w_map_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_geol2t2_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3w_geol2t2_b', correct: true }, { id: 'c', textKey: 'data.tasks.g3w_geol2t2_c', correct: false }] },
            { id: 'g3wgeol2t3', type: 'multiple_choice', questionKey: 'data.tasks.g3w_map_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_geol2t3_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_geol2t3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_geol2t3_c', correct: false }] },
            { id: 'g3wgeol2t4', type: 'input', questionKey: 'data.tasks.g3w_map_q4', difficulty: 2, answer: "6" },`,
  ],

  // g3w-eco-l1
  [
    `{ id: 'g3wecol1t1', type: 'multiple_choice', questionKey: 'data.tasks.g3w_ecology_studies', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_nature_relations', correct: false }, { id: 'b', textKey: 'data.tasks.g3w_opt_math_calc', correct: true }, { id: 'c', textKey: 'data.tasks.g3w_opt_history', correct: false }] },
            { id: 'g3wecol1t2', type: 'multiple_choice', questionKey: 'data.tasks.g3w_ecol1_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_ecol1_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_ecol1_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_ecol1_q2_c', correct: false }] },
            { id: 'g3wecol1t3', type: 'multiple_choice', questionKey: 'data.tasks.g3w_save_water_how', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_turn_off_tap', correct: false }, { id: 'b', textKey: 'data.tasks.g3w_opt_leave_tap_on', correct: true }, { id: 'c', textKey: 'data.tasks.g3w_opt_bath_daily', correct: false }] },
            { id: 'g3wecol1t4', type: 'input', questionKey: 'data.tasks.g3w_nature_belongs_to', difficulty: 2, answer: "Аквариум с рыбками" },`,
    `{ id: 'g3wecol1t1', type: 'multiple_choice', questionKey: 'data.tasks.g3w_ecol1_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_ecol1_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3w_ecol1_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g3w_ecol1_q1_c', correct: false }] },
            { id: 'g3wecol1t2', type: 'multiple_choice', questionKey: 'data.tasks.g3w_ecol1_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_ecol1_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_ecol1_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_ecol1_q2_c', correct: false }] },
            { id: 'g3wecol1t3', type: 'multiple_choice', questionKey: 'data.tasks.g3w_ecol1_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_ecol1_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3w_ecol1_q3_b', correct: true }, { id: 'c', textKey: 'data.tasks.g3w_ecol1_q3_c', correct: false }] },
            { id: 'g3wecol1t4', type: 'multiple_choice', questionKey: 'data.tasks.g3w_ecol1_q4', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_ecol1_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3w_ecol1_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g3w_ecol1_q4_c', correct: false }] },`,
  ],

  // g3w-eco-l2
  [
    `{ id: 'g3wecol2t1', type: 'multiple_choice', questionKey: 'data.tasks.g3w_air_pollution_cause', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_factories', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_opt_trees', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_opt_rain', correct: false }] },
            { id: 'g3wecol2t2', type: 'multiple_choice', questionKey: 'data.tasks.g3w_forest_importance', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_makes_oxygen', correct: false }, { id: 'b', textKey: 'data.tasks.g3w_opt_pollutes_air', correct: true }, { id: 'c', textKey: 'data.tasks.g3w_opt_dries_rivers', correct: false }] },`,
    `{ id: 'g3wecol2t1', type: 'multiple_choice', questionKey: 'data.tasks.g3w_ecol2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_ecol2_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_ecol2_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_ecol2_q1_c', correct: false }] },
            { id: 'g3wecol2t2', type: 'multiple_choice', questionKey: 'data.tasks.g3w_ecol2_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_ecol2_q2_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3w_ecol2_q2_b', correct: true }, { id: 'c', textKey: 'data.tasks.g3w_ecol2_q2_c', correct: false }] },`,
  ],
];

let ok = 0;
let fail = 0;
for (const [from, to] of replacements) {
  if (!worlds.includes(from)) {
    console.error('MISS worlds replace:\n' + from.slice(0, 120) + '...');
    fail++;
    continue;
  }
  worlds = worlds.replace(from, to);
  ok++;
}

fs.writeFileSync(worldsFile, worlds, 'utf8');
console.log(`worlds.ts: ${ok} replacements applied, ${fail} missed`);
if (fail) process.exit(1);
