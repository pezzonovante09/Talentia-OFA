// Phase 2 batch: mint dedicated keys for rewritten RU content that hijacked
// shared keys; restore shared keys to canonical values; fix correct flags.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const loc = (f) => path.join(root, 'src/i18n/locales', f);

// ---------- 1. New dedicated keys ----------
const newKeys = {
  // g2e-days-l3 (days of week)
  g2e_days3_q1: { ru: 'Суббота по-английски — это:', en: '“Суббота” (Saturday) in English is:', ky: 'Ишемби англисче — бул:' },
  g2e_days3_q2: { ru: 'Воскресенье по-английски — это:', en: '“Воскресенье” (Sunday) in English is:', ky: 'Жекшемби англисче — бул:' },
  g2e_days3_q3: { ru: 'Тали забыл! Какой день идёт перед пятницей?', en: 'Tali forgot! Which day comes before Friday?', ky: 'Тали унутуп калды! Жумадан мурун кайсы күн келет?' },
  g2e_days3_q4: { ru: 'Какой день идёт после среды?', en: 'Which day comes after Wednesday?', ky: 'Шаршембиден кийин кайсы күн келет?' },
  g2e_opt_day_monday: { ru: 'Monday', en: 'Monday', ky: 'Monday' },
  g2e_opt_day_thursday: { ru: 'Thursday', en: 'Thursday', ky: 'Thursday' },
  g2e_opt_day_friday: { ru: 'Friday', en: 'Friday', ky: 'Friday' },
  g2e_opt_day_saturday: { ru: 'Saturday', en: 'Saturday', ky: 'Saturday' },
  g2e_opt_day_sunday: { ru: 'Sunday', en: 'Sunday', ky: 'Sunday' },
  // g2e-phr-l2 (politeness)
  g2e_phr2_q1: { ru: '«Sorry» по-русски:', en: 'What does “Sorry” mean?', ky: '«Sorry» деген эмнени билдирет?' },
  g2e_phr2_q1_a: { ru: 'Прости / Извини', en: 'An apology (I am sorry)', ky: 'Кечир / Кечиресиз' },
  g2e_phr2_q1_b: { ru: 'Пожалуйста', en: 'Please', ky: 'Сураныч' },
  g2e_phr2_q1_c: { ru: 'Спасибо', en: 'Thank you', ky: 'Рахмат' },
  g2e_phr2_q2: { ru: 'Тали хочет пройти мимо Поли. Что он скажет?', en: 'Tali wants to walk past Polly. What will he say?', ky: 'Тали Полинин жанынан өткүсү келет. Ал эмне дейт?' },
  g2e_phr2_q2_a: { ru: 'Excuse me', en: 'Excuse me', ky: 'Excuse me' },
  g2e_phr2_q2_b: { ru: 'Sorry', en: 'Sorry', ky: 'Sorry' },
  g2e_phr2_q2_c: { ru: 'Please', en: 'Please', ky: 'Please' },
  g2e_phr2_q3: { ru: 'Как ответить на «Sorry»?', en: 'How do you reply to “Sorry”?', ky: '«Sorry» дегенге кантип жооп бересиң?' },
  g2e_phr2_q3_a: { ru: "It's OK / That's alright", en: "It's OK / That's alright", ky: "It's OK / That's alright" },
  g2e_phr2_q3_b: { ru: 'Please', en: 'Please', ky: 'Please' },
  g2e_phr2_q3_c: { ru: 'Thank you', en: 'Thank you', ky: 'Thank you' },
  // g2e-phr-l3 (Can I / You can't)
  g2e_phr3_q1: { ru: '«Can I…?» используют, чтобы:', en: '“Can I…?” is used to:', ky: '«Can I…?» эмне үчүн колдонулат:' },
  g2e_phr3_q1_a: { ru: 'Спросить разрешение', en: 'Ask for permission', ky: 'Уруксат суроо үчүн' },
  g2e_phr3_q1_b: { ru: 'Извиниться', en: 'Apologize', ky: 'Кечирим суроо үчүн' },
  g2e_phr3_q1_c: { ru: 'Попрощаться', en: 'Say goodbye', ky: 'Коштошуу үчүн' },
  g2e_phr3_q2: { ru: '«You can’t» по-русски:', en: 'What does “You can’t” mean?', ky: '«You can’t» эмнени билдирет?' },
  g2e_phr3_q2_a: { ru: 'Тебе нельзя', en: 'You are not allowed', ky: 'Сага болбойт' },
  g2e_phr3_q2_b: { ru: 'Можно мне?', en: 'May I?', ky: 'Мага болобу?' },
  g2e_phr3_q2_c: { ru: 'Спасибо', en: 'Thank you', ky: 'Рахмат' },
  g2e_phr3_q3: { ru: 'Тали хочет войти в комнату. Как он спросит?', en: 'Tali wants to enter the room. How will he ask?', ky: 'Тали бөлмөгө киргиси келет. Ал кантип сурайт?' },
  g2e_phr3_q3_a: { ru: 'Can I come in?', en: 'Can I come in?', ky: 'Can I come in?' },
  g2e_phr3_q3_b: { ru: "You can't come in", en: "You can't come in", ky: "You can't come in" },
  g2e_phr3_q3_c: { ru: 'Thank you for coming in', en: 'Thank you for coming in', ky: 'Thank you for coming in' },
  g2e_phr3_q4: { ru: 'Поли говорит Тали: «No, you can’t eat my sandwich!» Что это значит?', en: 'Polly tells Tali: “No, you can’t eat my sandwich!” What does it mean?', ky: 'Поли Талиге: «No, you can’t eat my sandwich!» — дейт. Бул эмнени билдирет?' },
  g2e_phr3_q4_a: { ru: 'Да, можешь есть мой бутерброд', en: 'Yes, you may eat my sandwich', ky: 'Ооба, менин бутербродумду жесең болот' },
  g2e_phr3_q4_b: { ru: 'Нет, тебе нельзя есть мой бутерброд', en: 'No, you may not eat my sandwich', ky: 'Жок, менин бутербродумду жегенге болбойт' },
  g2e_phr3_q4_c: { ru: 'Спасибо за бутерброд', en: 'Thank you for the sandwich', ky: 'Бутерброд үчүн рахмат' },
  // g2m math verify-tasks
  g2m_100l1_q1_a: { ru: '13', en: '13', ky: '13' },
  g2m_100l1_q1_c: { ru: 'Оба неправы', en: 'Both are wrong', ky: 'Экөө тең туура эмес' },
  g2m_100l2_q2_a: { ru: '8 десятков (Арчи прав)', en: '8 tens (Archie is right)', ky: '8 ондук (Арчи туура)' },
  g2m_100l2_q2_b: { ru: '4 десятка', en: '4 tens', ky: '4 ондук' },
  g2m_100l2_q2_c: { ru: '48 десятков', en: '48 tens', ky: '48 ондук' },
  g2m_add2l3_q3_c: { ru: '43', en: '43', ky: '43' },
  g2m_100l3_q2_a: { ru: 'Арчи нашёл больше (78 > 82)', en: 'Archie found more (78 > 82)', ky: 'Арчи көбүрөөк тапты (78 > 82)' },
  g2m_100l3_q2_b: { ru: 'Тали нашёл больше (82 > 78)', en: 'Tali found more (82 > 78)', ky: 'Тали көбүрөөк тапты (82 > 78)' },
  g2m_100l3_q2_c: { ru: 'У них поровну', en: 'They found the same amount', ky: 'Экөөндө бирдей' },
  g2m_timesl1_q4_a: { ru: 'Арчи прав: 2 × 6 = 14', en: 'Archie is right: 2 × 6 = 14', ky: 'Арчи туура: 2 × 6 = 14' },
  g2m_timesl1_q4_b: { ru: 'Тали прав, что не верит: 2 × 6 = 12', en: 'Tali is right to doubt: 2 × 6 = 12', ky: 'Тали туура шектенет: 2 × 6 = 12' },
  g2m_timesl1_q4_c: { ru: 'Оба ошибаются: 2 × 6 = 16', en: 'Both are wrong: 2 × 6 = 16', ky: 'Экөө тең жаңылышат: 2 × 6 = 16' },
  g2m_timesl2_q4_a: { ru: 'Тали прав, 46 — верно', en: 'Tali is right, 46 is correct', ky: 'Тали туура, 46 — туура' },
  g2m_timesl2_q4_b: { ru: 'Нет, 5 × 9 = 45, и это заканчивается на 5 — всё по правилу!', en: 'No, 5 × 9 = 45, and it ends in 5 — the rule works!', ky: 'Жок, 5 × 9 = 45, жана ал 5ке бүтөт — эреже иштейт!' },
  g2m_timesl2_q4_c: { ru: '5 × 9 = 50', en: '5 × 9 = 50', ky: '5 × 9 = 50' },
  g2m_timesl3_q4_a: { ru: 'Тали прав (26)', en: 'Tali is right (26)', ky: 'Тали туура (26)' },
  g2m_timesl3_q4_b: { ru: 'Арчи прав (24)', en: 'Archie is right (24)', ky: 'Арчи туура (24)' },
  g2m_timesl3_q4_c: { ru: 'Оба неправы', en: 'Both are wrong', ky: 'Экөө тең туура эмес' },
  g3m_tabl3_q4_a: { ru: 'Нет, 9 × 6 = 52', en: 'No, 9 × 6 = 52', ky: 'Жок, 9 × 6 = 52' },
  g3m_tabl3_q4_b: { ru: 'Да, 54 и 5+4=9 — всё верно', en: 'Yes, 54 and 5+4=9 — all correct', ky: 'Ооба, 54 жана 5+4=9 — баары туура' },
  g3m_tabl3_q4_c: { ru: 'Нет, 9 × 6 = 56', en: 'No, 9 × 6 = 56', ky: 'Жок, 9 × 6 = 56' },
};

// ---------- 2. Restore hijacked keys to canonical values ----------
const numeric = {};
for (const n of [10, 11, 12, 14, 19, 20, 22, 24, 26, 29, 37, 40, 42, 45, 50, 52, 54, 56, 78, 82, 91]) {
  numeric['opt_' + n] = { ru: String(n), en: String(n), ky: String(n) };
}
const restores = {
  ...numeric,
  g2e_opt_january: { ru: 'January', en: 'January', ky: 'January' },
  g2e_opt_february: { ru: 'February', en: 'February', ky: 'February' },
  g2e_opt_march: { ru: 'March', en: 'March', ky: 'March' },
  g2e_opt_jun_aug: { ru: 'June, July, August', en: 'June, July, August', ky: 'June, July, August' },
  g2e_opt_dec_feb: { ru: 'December, January, February', en: 'December, January, February', ky: 'December, January, February' },
  g2e_opt_mar_may: { ru: 'March, April, May', en: 'March, April, May', ky: 'March, April, May' },
  g2e_opt_have: { ru: 'have', en: 'have', ky: 'have' },
  g2e_opt_has: { ru: 'has', en: 'has', ky: 'has' },
  g2e_opt_had: { ru: 'had', en: 'had', ky: 'had' },
  g2e_opt_where: { ru: 'where', en: 'where', ky: 'where' },
  g2e_opt_what: { ru: 'what', en: 'what', ky: 'what' },
  g2e_opt_who: { ru: 'who', en: 'who', ky: 'who' },
  g2e_opt_yes_he_is: { ru: 'Yes, he is.', en: 'Yes, he is.', ky: 'Yes, he is.' },
  g2e_opt_yes_he_are: { ru: 'Yes, he are.', en: 'Yes, he are.', ky: 'Yes, he are.' },
  g2e_opt_yes_he_am: { ru: 'Yes, he am.', en: 'Yes, he am.', ky: 'Yes, he am.' },
  // orphaned question keys — restore meaning to match EN so they are consistent
  g2e_january_ru: { ru: 'Январь по-английски:', en: 'January in English:', ky: 'Январь англисче:' },
  g2e_march_ru: { ru: 'Март по-английски:', en: 'March in English:', ky: 'Март англисче:' },
  g2e_months_in_year: { ru: 'Сколько месяцев в году?', en: 'How many months are there in a year?', ky: 'Бир жылда канча ай бар?' },
  g2e_summer_months: { ru: 'Летние месяцы:', en: 'Summer months:', ky: 'Жайкы айлар:' },
  g2e_i_have_blank_cat: { ru: 'I ___ a cat. Какое слово пропущено?', en: 'I ___ a cat. What word?', ky: 'I ___ a cat. Кайсы сөз?' },
  g2e_he_blank_dog: { ru: 'He ___ a dog. Какое слово пропущено?', en: 'He ___ a dog. What word?', ky: 'He ___ a dog. Кайсы сөз?' },
  g2e_she_blank_book: { ru: 'She ___ a book. Какое слово пропущено?', en: 'She ___ a book. What word?', ky: 'She ___ a book. Кайсы сөз?' },
  g2e_where_is_cat: { ru: 'Как спросить по-английски: «Где кошка?» Какое слово нужно?', en: '“Where is the cat?” he asks.', ky: '«Мышык кайда?» — англисче кайсы сөз керек?' },
  g2e_what_is_this: { ru: 'Как спросить по-английски: «Что это?» Какое слово нужно?', en: '“What is this?” he asks.', ky: '«Бул эмне?» — англисче кайсы сөз керек?' },
  g2e_who_is_this_person: { ru: 'Как спросить по-английски: «Кто это?» Какое слово нужно?', en: '“Who is this?” he asks.', ky: '«Бул ким?» — англисче кайсы сөз керек?' },
  g2e_is_he_student: { ru: 'Правильный ответ на «Is he a student?»:', en: '"Is he a student?" is the correct answer:', ky: '«Is he a student?» деген суроого туура жооп:' },
};

// ---------- 3. worlds.ts replacements ----------
const worldsEdits = [
  // g2m-100-l1 t1: 13 / 30(✓) / both-wrong
  ["textKey: 'data.tasks.opt_20', correct: false }, { id: 'b', textKey: 'data.tasks.opt_30', correct: true }, { id: 'c', textKey: 'data.tasks.opt_40', correct: false }",
   "textKey: 'data.tasks.g2m_100l1_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.opt_30', correct: true }, { id: 'c', textKey: 'data.tasks.g2m_100l1_q1_c', correct: false }"],
  // g2m-100-l2 t2
  ["textKey: 'data.tasks.opt_37', correct: false }, { id: 'b', textKey: 'data.tasks.opt_42', correct: true }, { id: 'c', textKey: 'data.tasks.opt_29', correct: false }",
   "textKey: 'data.tasks.g2m_100l2_q2_a', correct: false }, { id: 'b', textKey: 'data.tasks.g2m_100l2_q2_b', correct: true }, { id: 'c', textKey: 'data.tasks.g2m_100l2_q2_c', correct: false }"],
  // g2m-add2-l3 t3: distractor 43
  ["textKey: 'data.tasks.opt_19', correct: false }",
   "textKey: 'data.tasks.g2m_add2l3_q3_c', correct: false }"],
  // g2m-100-l3 t2: fix inversion, Tali is right (82 > 78)
  ["textKey: 'data.tasks.opt_78', correct: true }, { id: 'b', textKey: 'data.tasks.opt_82', correct: false }, { id: 'c', textKey: 'data.tasks.opt_91', correct: false }",
   "textKey: 'data.tasks.g2m_100l3_q2_a', correct: false }, { id: 'b', textKey: 'data.tasks.g2m_100l3_q2_b', correct: true }, { id: 'c', textKey: 'data.tasks.g2m_100l3_q2_c', correct: false }"],
  // g2m-times-l1 t4
  ["textKey: 'data.tasks.opt_10', correct: false }, { id: 'b', textKey: 'data.tasks.opt_12', correct: true }, { id: 'c', textKey: 'data.tasks.opt_14', correct: false }",
   "textKey: 'data.tasks.g2m_timesl1_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g2m_timesl1_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g2m_timesl1_q4_c', correct: false }"],
  // g2m-times-l2 t4
  ["textKey: 'data.tasks.opt_40', correct: false }, { id: 'b', textKey: 'data.tasks.opt_45', correct: true }, { id: 'c', textKey: 'data.tasks.opt_50', correct: false }",
   "textKey: 'data.tasks.g2m_timesl2_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g2m_timesl2_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g2m_timesl2_q4_c', correct: false }"],
  // g2m-times-l3 t4
  ["textKey: 'data.tasks.opt_22', correct: false }, { id: 'b', textKey: 'data.tasks.opt_24', correct: true }, { id: 'c', textKey: 'data.tasks.opt_26', correct: false }",
   "textKey: 'data.tasks.g2m_timesl3_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g2m_timesl3_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g2m_timesl3_q4_c', correct: false }"],
  // g3m-tab-l3 t4
  ["textKey: 'data.tasks.opt_52', correct: false }, { id: 'b', textKey: 'data.tasks.opt_54', correct: true }, { id: 'c', textKey: 'data.tasks.opt_56', correct: false }",
   "textKey: 'data.tasks.g3m_tabl3_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3m_tabl3_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g3m_tabl3_q4_c', correct: false }"],
  // g2e-days-l3 t1: Saturday(✓)/Sunday/Monday
  ["questionKey: 'data.tasks.g2e_january_ru', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_january', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_february', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_march', correct: false }]",
   "questionKey: 'data.tasks.g2e_days3_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_day_saturday', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_day_sunday', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_day_monday', correct: false }]"],
  // g2e-days-l3 t2: Sunday is correct (was ✓ on Monday)
  ["questionKey: 'data.tasks.g2e_march_ru', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_january', correct: false }, { id: 'b', textKey: 'data.tasks.g2e_opt_february', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_march', correct: true }]",
   "questionKey: 'data.tasks.g2e_days3_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_day_saturday', correct: false }, { id: 'b', textKey: 'data.tasks.g2e_opt_day_sunday', correct: true }, { id: 'c', textKey: 'data.tasks.g2e_opt_day_monday', correct: false }]"],
  // g2e-days-l3 t3: before Friday = Thursday (✓ was on 12/Saturday)
  ["questionKey: 'data.tasks.g2e_months_in_year', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_ten', correct: false }, { id: 'b', textKey: 'data.tasks.opt_11', correct: false }, { id: 'c', textKey: 'data.tasks.opt_12', correct: true }]",
   "questionKey: 'data.tasks.g2e_days3_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_day_thursday', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_day_saturday', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_day_sunday', correct: false }]"],
  // g2e-days-l3 t4: after Wednesday = Thursday (✓ was on jun_aug/Wednesday text)
  ["questionKey: 'data.tasks.g2e_summer_months', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_jun_aug', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_dec_feb', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_mar_may', correct: false }]",
   "questionKey: 'data.tasks.g2e_days3_q4', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_day_thursday', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_day_friday', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_day_monday', correct: false }]"],
  // g2e-phr-l2 t1: перевод Sorry (✓ a)
  ["questionKey: 'data.tasks.g2e_i_have_blank_cat', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_have', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_has', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_had', correct: false }]",
   "questionKey: 'data.tasks.g2e_phr2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_phr2_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_phr2_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_phr2_q1_c', correct: false }]"],
  // g2e-phr-l2 t2: пройти мимо = Excuse me (✓ was on b)
  ["questionKey: 'data.tasks.g2e_he_blank_dog', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_have', correct: false }, { id: 'b', textKey: 'data.tasks.g2e_opt_has', correct: true }, { id: 'c', textKey: 'data.tasks.g2e_opt_had', correct: false }]",
   "questionKey: 'data.tasks.g2e_phr2_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_phr2_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_phr2_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_phr2_q2_c', correct: false }]"],
  // g2e-phr-l2 t3: ответ на Sorry = It's OK (✓ was on b/Please)
  ["questionKey: 'data.tasks.g2e_she_blank_book', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_have', correct: false }, { id: 'b', textKey: 'data.tasks.g2e_opt_has', correct: true }, { id: 'c', textKey: 'data.tasks.g2e_opt_had', correct: false }]",
   "questionKey: 'data.tasks.g2e_phr2_q3', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_phr2_q3_a', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_phr2_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_phr2_q3_c', correct: false }]"],
  // g2e-phr-l3 t1: функция Can I = спросить разрешение
  ["questionKey: 'data.tasks.g2e_where_is_cat', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_where', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_what', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_who', correct: false }]",
   "questionKey: 'data.tasks.g2e_phr3_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_phr3_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_phr3_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_phr3_q1_c', correct: false }]"],
  // g2e-phr-l3 t2: You can't = тебе нельзя (✓ was on b)
  ["questionKey: 'data.tasks.g2e_what_is_this', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_where', correct: false }, { id: 'b', textKey: 'data.tasks.g2e_opt_what', correct: true }, { id: 'c', textKey: 'data.tasks.g2e_opt_who', correct: false }]",
   "questionKey: 'data.tasks.g2e_phr3_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_phr3_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_phr3_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_phr3_q2_c', correct: false }]"],
  // g2e-phr-l3 t3: как спросить = Can I come in? (✓ was on c/Thank you)
  ["questionKey: 'data.tasks.g2e_who_is_this_person', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_where', correct: false }, { id: 'b', textKey: 'data.tasks.g2e_opt_what', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_who', correct: true }]",
   "questionKey: 'data.tasks.g2e_phr3_q3', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_phr3_q3_a', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_phr3_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_phr3_q3_c', correct: false }]"],
  // g2e-phr-l3 t4: No you can't = нельзя (✓ was on a/«Да, можешь»)
  ["questionKey: 'data.tasks.g2e_is_he_student', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_yes_he_is', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_yes_he_are', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_yes_he_am', correct: false }]",
   "questionKey: 'data.tasks.g2e_phr3_q4', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2e_phr3_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g2e_phr3_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g2e_phr3_q4_c', correct: false }]"],
];

// ---------- apply ----------
const files = { ru: 'ru.json', en: 'en.json', ky: 'ky.json' };
for (const [lng, file] of Object.entries(files)) {
  const p = loc(file);
  const json = JSON.parse(fs.readFileSync(p, 'utf8'));
  const tasks = json.data.tasks;
  for (const [key, vals] of Object.entries(newKeys)) tasks[key] = vals[lng];
  for (const [key, vals] of Object.entries(restores)) {
    if (!(key in tasks)) console.log('WARN restore key missing in ' + lng + ': ' + key);
    tasks[key] = vals[lng];
  }
  fs.writeFileSync(p, JSON.stringify(json, null, 2) + '\n');
}

// ABA overrides: restore hijacked keys if present
const abaFiles = { ru: 'abaTextOverrides.generated.json', en: 'abaTextOverrides.en.generated.json', ky: 'abaTextOverrides.ky.generated.json' };
for (const [lng, file] of Object.entries(abaFiles)) {
  const p = loc(file);
  const json = JSON.parse(fs.readFileSync(p, 'utf8'));
  let n = 0;
  for (const [key, vals] of Object.entries(restores)) {
    const flat = 'data.tasks.' + key;
    if (flat in json) { json[flat] = vals[lng]; n++; }
  }
  fs.writeFileSync(p, JSON.stringify(json, null, 2) + '\n');
  console.log('ABA ' + lng + ': restored ' + n + ' keys');
}

// worlds.ts
const wp = path.join(root, 'src/data/worlds.ts');
let src = fs.readFileSync(wp, 'utf8');
let ok = 0, fail = 0;
for (const [oldS, newS] of worldsEdits) {
  const count = src.split(oldS).length - 1;
  if (count !== 1) { console.log('EDIT FAIL (found ' + count + '): ' + oldS.slice(0, 90)); fail++; continue; }
  src = src.replace(oldS, newS);
  ok++;
}
fs.writeFileSync(wp, src);
console.log('worlds.ts edits: ok=' + ok + ' fail=' + fail);
