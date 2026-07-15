/**
 * Writes curricula/g34-mc-options-ru.json (flat keys data.tasks.*) for grade 3–4 MC options
 * after curriculum MD sync. Run: node scripts/build-g34-mc-options-ru.mjs
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const out = path.join(root, 'curricula', 'g34-mc-options-ru.json');

/** @type {Record<string, string>} */
const p = {};

function set(k, v) {
  p[`data.tasks.${k}`] = v;
}

// --- g3 divide (new keys from worlds.ts) ---
set('g3m_div_l1_q1_a', '2 монеты');
set('g3m_div_l1_q1_b', '3 монеты');
set('g3m_div_l1_q1_c', '4 монеты');
set('g3m_div_l1_q4_a', '2 матроса');
set('g3m_div_l1_q4_b', '3 матроса');
set('g3m_div_l1_q4_c', '4 матроса');
set('g3m_div_l3_q2_a', '7');
set('g3m_div_l3_q2_b', '9');
set('g3m_div_l3_q2_c', '5');

// --- g3w geo L1 (стороны света) ---
set('g3w_geol1t1_a', 'Только север и юг');
set('g3w_geol1t1_b', 'Север, юг, запад и восток');
set('g3w_geol1t1_c', 'Север и восток');
set('g3w_geol1t2_a', 'На восток');
set('g3w_geol1t2_b', 'На запад');
set('g3w_geol1t2_c', 'На юг');
set('g3w_geol1t3_a', 'Слева');
set('g3w_geol1t3_b', 'Снизу (внизу карты)');
set('g3w_geol1t3_c', 'Справа');
set('g3w_geol1t4_a', 'Восток');
set('g3w_geol1t4_b', 'Юг');
set('g3w_geol1t4_c', 'Запад');

// --- g3w geo L2 (карта и глобус) ---
set('g3w_geol2t1_a', 'Карта плоская, глобус объёмный');
set('g3w_geol2t1_b', 'Карта и глобус одинаковые');
set('g3w_geol2t1_c', 'Глобус плоский, карта объёмная');
set('g3w_geol2t2_a', 'Горы');
set('g3w_geol2t2_b', 'Суша (материки и острова)');
set('g3w_geol2t2_c', 'Только пустыни');
set('g3w_geol2t3_a', '1 см на карте — 100 000 см на местности');
set('g3w_geol2t3_b', 'На карте 100 000 материков');
set('g3w_geol2t3_c', 'Расстояние в километрах всегда 100 000');
set('g3w_geol2t4_a', '4');
set('g3w_geol2t4_b', '5');
set('g3w_geol2t4_c', '6');

// --- g4 math: multidigit (чтение и разряды) ---
set('g4m_md_q1_a', 'Триста сорок семьдесят пять');
set('g4m_md_q1_b', 'Три тысячи четыреста семьдесят пять');
set('g4m_md_q1_c', 'Три тысячи сорок семь тысяч пять');
set('g4m_md_q2_a', '12 тысяч 80 десятков');
set('g4m_md_q2_b', '12 тысяч 8 сотен');
set('g4m_md_q2_c', '12 тысяч 80 единиц');
set('g4m_md_q3_a', 'Цифра 0');
set('g4m_md_q3_b', 'Цифра 3');
set('g4m_md_q3_c', 'Цифра 7');
set('g4m_md_q4_a', 'Двадцать пять тысяч шестьсот');
set('g4m_md_q4_b', 'Два миллиона пятьсот шестьдесят тысяч');
set('g4m_md_q4_c', 'Двадцать пять тысяч шестьдесят');

set('g4m_md2_q1_a', '2 сотни (разряд сотен)');
set('g4m_md2_q1_b', '20 десятков');
set('g4m_md2_q1_c', '2 тысячи');
set('g4m_md2_q2_a', '9 000 + 70');
set('g4m_md2_q2_b', '9 000 + 700');
set('g4m_md2_q2_c', '900 + 70');
set('g4m_md2_q3_a', 'В разряде единиц');
set('g4m_md2_q3_b', 'В разряде сотен');
set('g4m_md2_q3_c', 'В разряде десятков');
set('g4m_md2_q4_a', '5 309');
set('g4m_md2_q4_b', '5 039');
set('g4m_md2_q4_c', '5 390');

set('g4m_md3_q1_a', 'Город с 8 540 жителями');
set('g4m_md3_q1_b', 'Города равны');
set('g4m_md3_q1_c', 'Город с 8 450 жителями');
set('g4m_md3_q2_a', '3 009, 3 099, 3 900');
set('g4m_md3_q2_b', '3 900, 3 099, 3 009');
set('g4m_md3_q2_c', '3 099, 3 009, 3 900');
set('g4m_md3_q3_a', 'Верно');
set('g4m_md3_q3_b', 'Неверно');
set('g4m_md3_q3_c', 'Нельзя сравнить');
set('g4m_md3_q4_a', 'Первый поезд');
set('g4m_md3_q4_b', 'Второй поезд');
set('g4m_md3_q4_c', 'Одинаково');

// --- g4 column multiply ---
set('g4m_cm_q1_a', '609');
set('g4m_cm_q1_b', '639');
set('g4m_cm_q1_c', '669');
set('g4m_cm_q2_a', '486');
set('g4m_cm_q2_b', '496');
set('g4m_cm_q2_c', '516');
set('g4m_cm_q3_a', '916');
set('g4m_cm_q3_b', '936');
set('g4m_cm_q3_c', '956');
set('g4m_cm_q4_a', '864');
set('g4m_cm_q4_b', '884');
set('g4m_cm_q4_c', '904');

set('g4m_cm2_q1_a', '5 730');
set('g4m_cm2_q1_b', '6 730');
set('g4m_cm2_q1_c', '7 230');
set('g4m_cm2_q2_a', '7 251');
set('g4m_cm2_q2_b', '7 351');
set('g4m_cm2_q2_c', '7 451');
set('g4m_cm2_q3_a', '18 248');
set('g4m_cm2_q3_b', '19 248');
set('g4m_cm2_q3_c', '20 248');
set('g4m_cm2_q4_a', '<');
set('g4m_cm2_q4_b', '=');
set('g4m_cm2_q4_c', '>');

set('g4m_cm3_q1_a', '2 732');
set('g4m_cm3_q1_b', '2 832');
set('g4m_cm3_q1_c', '3 032');
set('g4m_cm3_q2_a', '7 280');
set('g4m_cm3_q2_b', '8 280');
set('g4m_cm3_q2_c', '9 280');
set('g4m_cm3_q3_a', '5 034');
set('g4m_cm3_q3_b', '5 434');
set('g4m_cm3_q3_c', '5 834');
set('g4m_cm3_q4_a', 'Одно');
set('g4m_cm3_q4_b', 'Два');
set('g4m_cm3_q4_c', 'Три');

// --- g4 fractions ---
set('g4m_fr_q1_a', '1/4');
set('g4m_fr_q1_b', '1/3');
set('g4m_fr_q1_c', '4/1');
set('g4m_fr_q2_a', '3/8');
set('g4m_fr_q2_b', '8/3');
set('g4m_fr_q2_c', '3/11');
set('g4m_fr_q3_a', 'Сколько равных частей целого');
set('g4m_fr_q3_b', 'Сколько частей взяли');
set('g4m_fr_q3_c', 'Сколько целых из частей');
set('g4m_fr_q4_a', 'Неверно');
set('g4m_fr_q4_b', 'Верно');
set('g4m_fr_q4_c', 'Нельзя сказать');

set('g4m_fr2_q1_a', '1/4');
set('g4m_fr2_q1_b', '4/1');
set('g4m_fr2_q1_c', '1/2');
set('g4m_fr2_q2_a', '3/9');
set('g4m_fr2_q2_b', '9/3');
set('g4m_fr2_q2_c', '1/3');
set('g4m_fr2_q3_a', 'Нет');
set('g4m_fr2_q3_b', 'Да, это равные дроби');
set('g4m_fr2_q3_c', 'Только если торт разный');
set('g4m_fr2_q4_a', '3');
set('g4m_fr2_q4_b', '4');
set('g4m_fr2_q4_c', '5');

set('g4m_fr3_q1_a', 'Петя');
set('g4m_fr3_q1_b', 'Ваня');
set('g4m_fr3_q1_c', 'Одинаково');
set('g4m_fr3_q2_a', '<');
set('g4m_fr3_q2_b', '>');
set('g4m_fr3_q2_c', '=');
set('g4m_fr3_q3_a', '1/4, 2/4, 3/4');
set('g4m_fr3_q3_b', '1/4, 3/4, 2/4');
set('g4m_fr3_q3_c', '3/4, 2/4, 1/4');
set('g4m_fr3_q4_a', '3/7 больше, знаменатель меньше');
set('g4m_fr3_q4_b', '3/4 больше, числитель одинаковый');
set('g4m_fr3_q4_c', 'Дроби равны');

// --- g4 Russian: verb forms / conjunctions (keys match worlds.ts correct slots) ---
set('g4r_conj_q1_a', 'иду');
set('g4r_conj_q1_b', 'хожу');
set('g4r_conj_q1_c', 'шёл');
set('g4r_conj_q2_a', 'читаешь');
set('g4r_conj_q2_b', 'читает');
set('g4r_conj_q2_c', 'читали');
set('g4r_conj_q3_a', 'Мы гуляем в парке.');
set('g4r_conj_q3_b', 'Ребята строят снежную крепость.');
set('g4r_conj_q3_c', 'Он читает сказку вслух.');
set('g4r_conj_q4_a', 'Неверный союз');
set('g4r_conj_q4_b', 'Неверное лицо у второго глагола');
set('g4r_conj_q4_c', 'Неверный порядок слов');

set('g4r_conj2_q1_a', 'поём');
set('g4r_conj2_q1_b', 'поёте');
set('g4r_conj2_q1_c', 'поют');
set('g4r_conj2_q2_a', 'читают');
set('g4r_conj2_q2_b', 'читает');
set('g4r_conj2_q2_c', 'читали');
set('g4r_conj2_q3_a', 'знаешь');
set('g4r_conj2_q3_b', 'знаете');
set('g4r_conj2_q3_c', 'знают');
set('g4r_conj2_q4_a', 'идёт');
set('g4r_conj2_q4_b', 'идут');
set('g4r_conj2_q4_c', 'идём');

set('g4r_conj3_q1_a', 'I спряжение');
set('g4r_conj3_q1_b', 'II спряжение');
set('g4r_conj3_q1_c', 'оба возможны');
set('g4r_conj3_q2_a', 'говорить');
set('g4r_conj3_q2_b', 'писать');
set('g4r_conj3_q2_c', 'читать');
set('g4r_conj3_q3_a', 'бежит');
set('g4r_conj3_q3_b', 'бежите');
set('g4r_conj3_q3_c', 'бежим');
set('g4r_conj3_q4_a', 'по роду существительного');
set('g4r_conj3_q4_b', 'по окончанию инфинитива и личным окончаниям');
set('g4r_conj3_q4_c', 'только по ударению');

// --- g4 Russian: падежи ---
set('g4r_cases_q1_a', 'Именительный');
set('g4r_cases_q1_b', 'Винительный');
set('g4r_cases_q1_c', 'Дательный');
set('g4r_cases_q2_a', 'Именительный (подлежащее «книга»)');
set('g4r_cases_q2_b', 'Винительный');
set('g4r_cases_q2_c', 'Дательный');
set('g4r_cases_q3_a', 'именительный («книга»)');
set('g4r_cases_q3_b', 'родительный («книги»)');
set('g4r_cases_q3_c', 'винительный («книгу»)');
set('g4r_cases_q4_a', 'Они всегда совпадают по форме');
set('g4r_cases_q4_b', 'Винительный обозначает объект действия, именительный — «кто? что?»');
set('g4r_cases_q4_c', 'Именительный всегда с предлогом');

set('g4r_cases2_q1_a', 'Кто? Что?');
set('g4r_cases2_q1_b', 'Кого? Чего?');
set('g4r_cases2_q1_c', 'Кому? Чему?');
set('g4r_cases2_q2_a', 'Дательный');
set('g4r_cases2_q2_b', 'Винительный');
set('g4r_cases2_q2_c', 'Родительный');
set('g4r_cases2_q3_a', 'друг');
set('g4r_cases2_q3_b', 'друга');
set('g4r_cases2_q3_c', 'другу');
set('g4r_cases2_q4_a', 'маме');
set('g4r_cases2_q4_b', 'маму');
set('g4r_cases2_q4_c', 'мамы');

set('g4r_cases3_q1_a', 'Предложный');
set('g4r_cases3_q1_b', 'Винительный');
set('g4r_cases3_q1_c', 'Дательный');
set('g4r_cases3_q2_a', 'художник');
set('g4r_cases3_q2_b', 'художником');
set('g4r_cases3_q2_c', 'художнику');
set('g4r_cases3_q3_a', 'Именительный');
set('g4r_cases3_q3_b', 'Предложный');
set('g4r_cases3_q3_c', 'Дательный');
set('g4r_cases3_q4_a', 'Дательный');
set('g4r_cases3_q4_b', 'Предложный');
set('g4r_cases3_q4_c', 'Творительный');

// --- g4 Russian: текст / чтение ---
set('g4r_text_q1_a', 'О вечере и тишине после заката');
set('g4r_text_q1_b', 'О правилах дорожного движения');
set('g4r_text_q1_c', 'О школьном расписании');
set('g4r_text_q2_a', 'завязка');
set('g4r_text_q2_b', 'концовка');
set('g4r_text_q2_c', 'титульный лист');
set('g4r_text_q3_a', 'только перечисление');
set('g4r_text_q3_b', 'только описание');
set('g4r_text_q3_c', 'причина и следствие');
set('g4r_text_q4_a', 'заголовок журнала');
set('g4r_text_q4_b', 'завязка (начало)');
set('g4r_text_q4_c', 'оглавление');

set('g4r_text2_q1_a', 'Ёж защищается иголками');
set('g4r_text2_q1_b', 'Ёж всегда злой');
set('g4r_text2_q1_c', 'Иголки — это отдельный персонаж');
set('g4r_text2_q2_a', 'любое предложение из текста');
set('g4r_text2_q2_b', 'тезис / главная мысль в одном предложении');
set('g4r_text2_q2_c', 'последнее слово текста');
set('g4r_text2_q3_a', 'Сначала пошёл дождь.');
set('g4r_text2_q3_b', 'Поэтому лужи блестели.');
set('g4r_text2_q3_c', 'Наконец стало темно.');
set('g4r_text2_q4_a', 'только в заголовке');
set('g4r_text2_q4_b', 'часто в начале или в конце');
set('g4r_text2_q4_c', 'только в середине');

set('g4r_text3_q1_a', 'набрали корзину');
set('g4r_text3_q1_b', 'позвала сестру');
set('g4r_text3_q1_c', 'нашла гриб');
set('g4r_text3_q2_a', 'сначала');
set('g4r_text3_q2_b', 'наконец');
set('g4r_text3_q2_c', 'потом');
set('g4r_text3_q3_a', 'описание');
set('g4r_text3_q3_b', 'повествование');
set('g4r_text3_q3_c', 'рассуждение');
set('g4r_text3_q4_a', '«Сначала…»');
set('g4r_text3_q4_b', '«Потом…»');
set('g4r_text3_q4_c', '«Наконец…»');

// --- g4 English MC (option text aligned to question; letters match worlds.ts) ---
set('g4e_pres_q1_a', 'go');
set('g4e_pres_q1_b', 'goes');
set('g4e_pres_q1_c', 'is go');
set('g4e_pres_q2_a', 'do');
set('g4e_pres_q2_b', 'does');
set('g4e_pres_q2_c', 'doing');
set('g4e_pres_q3_a', 'love');
set('g4e_pres_q3_b', 'loves');
set('g4e_pres_q3_c', 'is loves');
set('g4e_pres_q4_a', 'I');
set('g4e_pres_q4_b', 'he');
set('g4e_pres_q4_c', 'she');

set('g4e_pres2_q1_a', "don't play");
set('g4e_pres2_q1_b', "doesn't play");
set('g4e_pres2_q1_c', 'not plays');
set('g4e_pres2_q2_a', "doesn't eat");
set('g4e_pres2_q2_b', 'eats');
set('g4e_pres2_q2_c', 'eat');
set('g4e_pres2_q3_a', "don't like");
set('g4e_pres2_q3_b', "doesn't like");
set('g4e_pres2_q3_c', 'not like');
set('g4e_pres2_q4_a', "don't watch");
set('g4e_pres2_q4_b', "doesn't watch");
set('g4e_pres2_q4_c', 'not watch');

set('g4e_pres3_q1_a', 'Do');
set('g4e_pres3_q1_b', 'Does');
set('g4e_pres3_q1_c', 'Is');
set('g4e_pres3_q2_a', 'Does Tom read books?');
set('g4e_pres3_q2_b', 'Do Tom reads books?');
set('g4e_pres3_q2_c', 'Tom reads books?');
set('g4e_pres3_q3_a', 'Do');
set('g4e_pres3_q3_b', 'Does');
set('g4e_pres3_q3_c', 'Are');
set('g4e_pres3_q4_a', 'Is');
set('g4e_pres3_q4_b', 'Does');
set('g4e_pres3_q4_c', 'Do');

set('g4e_past_q1_a', 'climb');
set('g4e_past_q1_b', 'climbed');
set('g4e_past_q1_c', 'was climb');
set('g4e_past_q2_a', 'clean');
set('g4e_past_q2_b', 'cleaned');
set('g4e_past_q2_c', 'cleans');
set('g4e_past_q3_a', 'opened');
set('g4e_past_q3_b', 'openned');
set('g4e_past_q3_c', 'did opened');
set('g4e_past_q4_a', 'play');
set('g4e_past_q4_b', 'played');
set('g4e_past_q4_c', 'plays');

set('g4e_past2_q1_a', 'maked');
set('g4e_past2_q1_b', 'made');
set('g4e_past2_q1_c', 'make');
set('g4e_past2_q2_a', 'goed');
set('g4e_past2_q2_b', 'went');
set('g4e_past2_q2_c', 'gone');
set('g4e_past2_q3_a', 'have');
set('g4e_past2_q3_b', 'had');
set('g4e_past2_q3_c', 'haved');
set('g4e_past2_q4_a', 'walk');
set('g4e_past2_q4_b', 'bring');
set('g4e_past2_q4_c', 'think');

set('g4e_past3_q1_a', 'meet / watched');
set('g4e_past3_q1_b', 'met / watched');
set('g4e_past3_q1_c', 'met / watch');
set('g4e_past3_q2_a', 'wrong verb ending (need bought)');
set('g4e_past3_q2_b', 'wrong article');
set('g4e_past3_q2_c', 'wrong preposition');
set('g4e_past3_q3_a', 'enter / find');
set('g4e_past3_q3_b', 'entered / find');
set('g4e_past3_q3_c', 'entered / found');
set('g4e_past3_q4_a', 'wrote not');
set('g4e_past3_q4_b', "didn't write");
set('g4e_past3_q4_c', "doesn't write");

set('g4e_quest_q1_a', 'Are');
set('g4e_quest_q1_b', 'Do');
set('g4e_quest_q1_c', 'Does');
set('g4e_quest_q2_a', 'Do you like ice cream?');
set('g4e_quest_q2_b', 'What you like ice cream?');
set('g4e_quest_q2_c', 'Where you like ice cream?');
set('g4e_quest_q3_a', 'Do');
set('g4e_quest_q3_b', 'Are');
set('g4e_quest_q3_c', 'Does');
set('g4e_quest_q4_a', 'Are');
set('g4e_quest_q4_b', 'Do');
set('g4e_quest_q4_c', 'Is');

set('g4e_quest2_q1_a', 'What');
set('g4e_quest2_q1_b', 'When');
set('g4e_quest2_q1_c', 'Where');
set('g4e_quest2_q2_a', 'Who');
set('g4e_quest2_q2_b', 'Where');
set('g4e_quest2_q2_c', 'What');
set('g4e_quest2_q3_a', 'What');
set('g4e_quest2_q3_b', 'Who');
set('g4e_quest2_q3_c', 'Where');
set('g4e_quest2_q4_a', 'Who');
set('g4e_quest2_q4_b', 'Why');
set('g4e_quest2_q4_c', 'What');

set('g4e_quest3_q1_a', 'Yes, I does.');
set('g4e_quest3_q1_b', 'Yes, I do.');
set('g4e_quest3_q1_c', 'Yes, I am.');
set('g4e_quest3_q2_a', "No, he doesn't.");
set('g4e_quest3_q2_b', "No, he don't.");
set('g4e_quest3_q2_c', 'No, he not.');
set('g4e_quest3_q3_a', 'Yes, they is.');
set('g4e_quest3_q3_b', 'Yes, they are.');
set('g4e_quest3_q3_c', 'Yes, they did.');
set('g4e_quest3_q4_a', 'Yes, they can.');
set('g4e_quest3_q4_b', 'Yes, they do.');
set('g4e_quest3_q4_c', 'Yes, they are.');

// --- g4 social / SEL (RU) — варианты под смысл вопроса ---
set('g4s_help_q1_a', 'Толкать дверь ногой');
set('g4s_help_q1_b', 'Попросить кого-то придержать дверь или помочь');
set('g4s_help_q1_c', 'Бросить пакеты и уйти');
set('g4s_help_q2_a', 'Когда задача слишком сложна или есть опасность');
set('g4s_help_q2_b', 'Когда просто скучно');
set('g4s_help_q2_c', 'Когда хочешь похвастаться');
set('g4s_help_q3_a', 'Молчать и злиться');
set('g4s_help_q3_b', 'Смеяться над ошибкой');
set('g4s_help_q3_c', 'Сказать учителю, что непонятно, или попросить одноклассника');
set('g4s_help_q4_a', 'Кричать всем подряд');
set('g4s_help_q4_b', 'Спокойно спросить взрослого (например, водителя) и назвать адрес');
set('g4s_help_q4_c', 'Ехать наугад');

set('g4s_help2_q1_a', 'Первый звучит грубо, второй — вежливо');
set('g4s_help2_q1_b', 'Оба одинаково грубые');
set('g4s_help2_q1_c', 'Вежливее первый');
set('g4s_help2_q2_a', 'Извините, не подскажете…');
set('g4s_help2_q2_b', 'Эй, ты! Сделай!');
set('g4s_help2_q2_c', 'Молча тянуть за рукав');
set('g4s_help2_q3_a', 'Сделать вид, что не заметил');
set('g4s_help2_q3_b', 'Ничего не говорить');
set('g4s_help2_q3_c', 'Поблагодарить');
set('g4s_help2_q4_a', 'пожалуйста');
set('g4s_help2_q4_b', 'сейчас же');
set('g4s_help2_q4_c', 'быстрее');

set('g4s_help3_q1_a', 'Сначала к одноклассникам и спорить');
set('g4s_help3_q1_b', 'Сначала к учителю или в учительскую, потом по указанию взрослых');
set('g4s_help3_q1_c', 'Никуда не обращаться');
set('g4s_help3_q2_a', 'Кричать: «Говори!»');
set('g4s_help3_q2_b', 'Спокойно спросить и выслушать');
set('g4s_help3_q2_c', 'Отвернуться');
set('g4s_help3_q3_a', '«Дай я сам — ты слабый»');
set('g4s_help3_q3_b', '«Мне не нужна твоя помощь»');
set('g4s_help3_q3_c', '«Могу помочь донести?»');
set('g4s_help3_q4_a', 'Перебивать с места');
set('g4s_help3_q4_b', 'Подойти после урока или поднять руку');
set('g4s_help3_q4_c', 'Шептать на всю комнату');

set('g4s_emo_q1_a', 'Грусть');
set('g4s_emo_q1_b', 'Радость');
set('g4s_emo_q1_c', 'Злость');
set('g4s_emo_q2_a', 'Получить неожиданный подарок');
set('g4s_emo_q2_b', 'Потерять любимую вещь');
set('g4s_emo_q2_c', 'Скучать в очереди');
set('g4s_emo_q3_a', 'Крикнуть: «Не грусти!»');
set('g4s_emo_q3_b', 'Просто побыть рядом и поддержать');
set('g4s_emo_q3_c', 'Сразу уйти');
set('g4s_emo_q4_a', 'Злость');
set('g4s_emo_q4_b', 'Радость');
set('g4s_emo_q4_c', 'Страх');

set('g4s_emo2_q1_a', 'Ударить брата');
set('g4s_emo2_q1_b', 'Сказать, что обидно, и предложить исправить вместе');
set('g4s_emo2_q1_c', 'Сломать его игрушку в ответ');
set('g4s_emo2_q2_a', 'Радость');
set('g4s_emo2_q2_b', 'Волнение / страх');
set('g4s_emo2_q2_c', 'Скука');
set('g4s_emo2_q3_a', 'Страх — избегание опасности; злость — реакция на несправедливость');
set('g4s_emo2_q3_b', 'Это одно и то же чувство');
set('g4s_emo2_q3_c', 'Злость всегда приятная');
set('g4s_emo2_q4_a', 'Злость; лучше остановиться и объяснить');
set('g4s_emo2_q4_b', 'Радость; можно кричать всегда');
set('g4s_emo2_q4_c', 'Скука; нужно спать');

set('g4s_emo3_q1_a', 'Удивление');
set('g4s_emo3_q1_b', 'Злость');
set('g4s_emo3_q1_c', 'Равнодушие');
set('g4s_emo3_q2_a', 'Спокойное и ровное состояние');
set('g4s_emo3_q2_b', 'Постоянная сонливость');
set('g4s_emo3_q2_c', 'Только голод');
set('g4s_emo3_q3_a', 'Уснуть');
set('g4s_emo3_q3_b', 'Убежать из класса');
set('g4s_emo3_q3_c', 'Успокоиться и перевести дыхание');
set('g4s_emo3_q4_a', 'Приятное: неожиданный комплимент; неприятное: плохая оценка');
set('g4s_emo3_q4_b', 'Удивление бывает только плохим');
set('g4s_emo3_q4_c', 'Удивления не бывает');

fs.writeFileSync(out, JSON.stringify(p, null, 2), 'utf8');
console.log('Wrote', Object.keys(p).length, 'keys to', path.relative(root, out));
