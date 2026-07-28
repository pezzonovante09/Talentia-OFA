// Phase 2 batch B: g3e-food-l1/l2/l3, g3e-daily-l2/l3 — mint dedicated keys,
// restore hijacked keys, fix wrong correct-flags.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const loc = (f) => path.join(root, 'src/i18n/locales', f);

const newKeys = {
  // g3e-food-l1
  g3e_food1_q1: { ru: 'Juice — это:', en: '“Juice” means:', ky: '«Juice» — бул:' },
  g3e_food1_q1_a: { ru: 'Сок', en: 'Juice', ky: 'Шире' },
  g3e_food1_q1_b: { ru: 'Каша', en: 'Porridge', ky: 'Ботко' },
  g3e_food1_q1_c: { ru: 'Молоко', en: 'Milk', ky: 'Сүт' },
  g3e_food1_q2: { ru: 'Porridge — это:', en: '“Porridge” means:', ky: '«Porridge» — бул:' },
  g3e_food1_q2_a: { ru: 'Молоко', en: 'Milk', ky: 'Сүт' },
  g3e_food1_q2_b: { ru: 'Каша', en: 'Porridge', ky: 'Ботко' },
  g3e_food1_q2_c: { ru: 'Сок', en: 'Juice', ky: 'Шире' },
  g3e_food1_q4: { ru: '«I drink water every day» — что пьёт этот человек?', en: '“I drink water every day” — what does this person drink?', ky: '«I drink water every day» — бул адам эмне ичет?' },
  g3e_food1_q4_a: { ru: 'Молоко', en: 'Milk', ky: 'Сүт' },
  g3e_food1_q4_b: { ru: 'Сок', en: 'Juice', ky: 'Шире' },
  g3e_food1_q4_c: { ru: 'Воду', en: 'Water', ky: 'Суу' },
  // g3e-food-l2
  g3e_food2_q1: { ru: '«I like apples!» — Маша это говорит. Что это значит?', en: 'Masha says: “I like apples!” What does it mean?', ky: 'Маша: «I like apples!» — дейт. Бул эмнени билдирет?' },
  g3e_food2_q1_a: { ru: 'Мне нравятся яблоки', en: 'I like apples', ky: 'Мага алма жагат' },
  g3e_food2_q1_b: { ru: 'Я не люблю яблоки', en: 'I do not like apples', ky: 'Мен алманы жактырбайм' },
  g3e_food2_q1_c: { ru: 'Я — яблоко', en: 'I am an apple', ky: 'Мен — алмамын' },
  g3e_food2_q2: { ru: '«I don’t like onions» — Ваня морщится. Onions — это:', en: '“I don’t like onions” — Vanya frowns. “Onions” means:', ky: '«I don’t like onions» — Ваня кабагын бүркөйт. «Onions» — бул:' },
  g3e_food2_q2_a: { ru: 'Лук', en: 'Onions', ky: 'Пияз' },
  g3e_food2_q2_b: { ru: 'Суп', en: 'Soup', ky: 'Шорпо' },
  g3e_food2_q2_c: { ru: 'Яблоки', en: 'Apples', ky: 'Алмалар' },
  g3e_food2_q4: { ru: 'Другу не нравится суп. Как он скажет?', en: 'A friend does not like soup. What will he say?', ky: 'Досуна шорпо жакпайт. Ал эмне дейт?' },
  g3e_food2_q4_a: { ru: 'I like soup', en: 'I like soup', ky: 'I like soup' },
  g3e_food2_q4_b: { ru: "I don't like soup", en: "I don't like soup", ky: "I don't like soup" },
  g3e_food2_q4_c: { ru: 'I am soup', en: 'I am soup', ky: 'I am soup' },
  // g3e-food-l3
  g3e_food3_q1: { ru: '«Can I have some bread, please?» — о чём просит человек?', en: '“Can I have some bread, please?” — what is the person asking for?', ky: '«Can I have some bread, please?» — адам эмне сурап жатат?' },
  g3e_food3_q1_a: { ru: 'Немного хлеба', en: 'Some bread', ky: 'Бир аз нан' },
  g3e_food3_q1_b: { ru: 'Немного воды', en: 'Some water', ky: 'Бир аз суу' },
  g3e_food3_q1_c: { ru: 'Немного сока', en: 'Some juice', ky: 'Бир аз шире' },
  g3e_food3_q2: { ru: '«Pass me the salt, please» — о чём просит человек?', en: '“Pass me the salt, please” — what is the person asking?', ky: '«Pass me the salt, please» — адам эмне сурап жатат?' },
  g3e_food3_q2_a: { ru: 'Передать соль', en: 'To pass the salt', ky: 'Тузду узатууну' },
  g3e_food3_q2_b: { ru: 'Передать хлеб', en: 'To pass the bread', ky: 'Нанды узатууну' },
  g3e_food3_q2_c: { ru: 'Передать воду', en: 'To pass the water', ky: 'Сууну узатууну' },
  g3e_food3_q3: { ru: '«It’s delicious!» — гость говорит это про еду. Что он чувствует?', en: 'A guest says “It’s delicious!” about the food. What does he mean?', ky: 'Конок тамак жөнүндө «It’s delicious!» — дейт. Ал эмнени билдирет?' },
  g3e_food3_q3_a: { ru: 'Еда вкусная', en: 'The food is tasty', ky: 'Тамак даамдуу' },
  g3e_food3_q3_b: { ru: 'Еда невкусная', en: 'The food is not tasty', ky: 'Тамак даамсыз' },
  g3e_food3_q3_c: { ru: 'Он не голоден', en: 'He is not hungry', ky: 'Ал ток' },
  g3e_food3_q4: { ru: 'Как вежливо отказаться от добавки?', en: 'How do you politely refuse more food?', ky: 'Кошумча тамактан кантип сылык баш тартса болот?' },
  g3e_food3_q4_a: { ru: 'No, thank you', en: 'No, thank you', ky: 'No, thank you' },
  g3e_food3_q4_b: { ru: 'No, I hate it', en: 'No, I hate it', ky: 'No, I hate it' },
  g3e_food3_q4_c: { ru: "I don't want", en: "I don't want", ky: "I don't want" },
  // g3e-daily-l2
  g3e_daily2_q1: { ru: '«Half past three» — это:', en: '“Half past three” means:', ky: '«Half past three» — бул:' },
  g3e_daily2_q1_a: { ru: '3:30', en: '3:30', ky: '3:30' },
  g3e_daily2_q1_b: { ru: '3:15', en: '3:15', ky: '3:15' },
  g3e_daily2_q1_c: { ru: '3:45', en: '3:45', ky: '3:45' },
  g3e_daily2_q2: { ru: '«Quarter past eight» — это:', en: '“Quarter past eight” means:', ky: '«Quarter past eight» — бул:' },
  g3e_daily2_q2_a: { ru: '8:30', en: '8:30', ky: '8:30' },
  g3e_daily2_q2_b: { ru: '8:15', en: '8:15', ky: '8:15' },
  g3e_daily2_q2_c: { ru: '7:45', en: '7:45', ky: '7:45' },
  g3e_daily2_q3: { ru: '«It’s five o’clock» — который час?', en: '“It’s five o’clock” — what time is it?', ky: '«It’s five o’clock» — саат канча?' },
  g3e_daily2_q3_a: { ru: '5:00', en: '5:00', ky: '5:00' },
  g3e_daily2_q3_b: { ru: '5:30', en: '5:30', ky: '5:30' },
  g3e_daily2_q3_c: { ru: '4:00', en: '4:00', ky: '4:00' },
  g3e_daily2_q4: { ru: 'Как спросить «Который час?» по-английски?', en: 'How do you ask “What time is it?” in English?', ky: '«Саат канча?» деп англисче кантип суралат?' },
  g3e_daily2_q4_a: { ru: 'What time is it?', en: 'What time is it?', ky: 'What time is it?' },
  g3e_daily2_q4_b: { ru: 'Where is the time?', en: 'Where is the time?', ky: 'Where is the time?' },
  g3e_daily2_q4_c: { ru: 'Who has the time?', en: 'Who has the time?', ky: 'Who has the time?' },
  // g3e-daily-l3
  g3e_daily3_q1: { ru: '«I always brush my teeth» — «always» означает:', en: '“I always brush my teeth” — “always” means:', ky: '«I always brush my teeth» — «always» эмнени билдирет:' },
  g3e_daily3_q1_a: { ru: 'Всегда', en: 'Always', ky: 'Ар дайым' },
  g3e_daily3_q1_b: { ru: 'Иногда', en: 'Sometimes', ky: 'Кээде' },
  g3e_daily3_q1_c: { ru: 'Никогда', en: 'Never', ky: 'Эч качан' },
  g3e_daily3_q2: { ru: 'Расставь по убыванию частоты:', en: 'Put in order from most to least frequent:', ky: 'Жыштыгы боюнча кемүү тартибинде жайгаштыр:' },
  g3e_daily3_q2_a: { ru: 'Always, usually, sometimes, never', en: 'Always, usually, sometimes, never', ky: 'Always, usually, sometimes, never' },
  g3e_daily3_q2_b: { ru: 'Never, sometimes, usually, always', en: 'Never, sometimes, usually, always', ky: 'Never, sometimes, usually, always' },
  g3e_daily3_q2_c: { ru: 'Sometimes, always, never, usually', en: 'Sometimes, always, never, usually', ky: 'Sometimes, always, never, usually' },
  g3e_daily3_q3: { ru: '«She sometimes plays football» — как часто она играет?', en: '“She sometimes plays football” — how often does she play?', ky: '«She sometimes plays football» — ал канчалык көп ойнойт?' },
  g3e_daily3_q3_a: { ru: 'Всегда', en: 'Always', ky: 'Ар дайым' },
  g3e_daily3_q3_b: { ru: 'Иногда', en: 'Sometimes', ky: 'Кээде' },
  g3e_daily3_q3_c: { ru: 'Никогда', en: 'Never', ky: 'Эч качан' },
  g3e_daily3_q4: { ru: '«Я никогда не опаздываю» по-английски:', en: '“I am never late” in English is:', ky: '«Мен эч качан кечикпейм» англисче:' },
  g3e_daily3_q4_a: { ru: 'I am never late', en: 'I am never late', ky: 'I am never late' },
  g3e_daily3_q4_b: { ru: 'I am sometimes late', en: 'I am sometimes late', ky: 'I am sometimes late' },
  g3e_daily3_q4_c: { ru: 'I am always late', en: 'I am always late', ky: 'I am always late' },
};

// Restore orphaned hijacked keys to match EN semantics
const restores = {
  g3e_apple_en: { ru: '«Яблоко» по-английски:', en: 'Apple in English:', ky: '«Алма» англисче:' },
  g3e_orange_en: { ru: '«Апельсин» по-английски:', en: 'Orange in English:', ky: '«Апельсин» англисче:' },
  g3e_what_fruit_grape: { ru: 'Какой фрукт — «grape»?', en: 'Which fruit is grape?', ky: '«Grape» — кайсы жемиш?' },
  g3e_carrot_en: { ru: '«Морковь» по-английски:', en: 'Carrots in English:', ky: '«Сабиз» англисче:' },
  g3e_tomato_en: { ru: '«Помидор» по-английски:', en: 'Tomato in English:', ky: '«Помидор» англисче:' },
  g3e_potato_en: { ru: '«Картофель» по-английски:', en: 'Potatoes in English:', ky: '«Картошка» англисче:' },
  g3e_i_like_apples: { ru: '«Мне нравятся яблоки» по-английски:', en: '"I like apples" in English:', ky: '«Мага алма жагат» англисче:' },
  g3e_i_dont_like_means: { ru: '«I don’t like» — это:', en: "I don't like is:", ky: '«I don’t like» — бул:' },
  g3e_do_you_like_pizza: { ru: 'Правильный ответ на «Do you like pizza?»:', en: '"Do you like pizza?" is the correct answer:', ky: '«Do you like pizza?» деген суроого туура жооп:' },
  g3e_she_likes_pasta: { ru: '«Она любит пасту» по-английски:', en: '"She likes pasta" in English:', ky: '«Ал пастаны жакшы көрөт» англисче:' },
  g3e_study_en: { ru: '«Учиться» по-английски:', en: '“Learn” English:', ky: '«Окуу» англисче:' },
  g3e_write_en: { ru: '«Писать» по-английски:', en: '"Write" in English:', ky: '«Жазуу» англисче:' },
  g3e_i_study_math: { ru: '«I ___ math» — какое слово пропущено?', en: '"I ___ math" — what word?', ky: '«I ___ math» — кайсы сөз?' },
  g3e_he_studies: { ru: '«He ___ math» — какая форма глагола?', en: '"He ___" — what form?', ky: '«He ___ math» — кайсы форма?' },
  g3e_play_football_en: { ru: '«Играть в футбол» по-английски:', en: '"Play Football" in English:', ky: '«Футбол ойноо» англисче:' },
  g3e_watch_tv_means: { ru: '«Watch TV» — это смотреть:', en: 'Watch TV is:', ky: '«Watch TV» — бул көрүү:' },
  g3e_what_do_you_like: { ru: 'Правильный ответ на «What do you like?»:', en: '"What do you like?" is the correct answer:', ky: '«What do you like?» деген суроого туура жооп:' },
  g3e_hobbies_question: { ru: 'Как спросить о хобби?', en: 'Hobby question:', ky: 'Хобби жөнүндө кантип суралат?' },
  g3e_opt_apple: { ru: 'apple', en: 'apple', ky: 'apple' },
  g3e_opt_orange: { ru: 'orange', en: 'orange', ky: 'orange' },
  g3e_opt_banana: { ru: 'banana', en: 'banana', ky: 'banana' },
  g3e_opt_grape: { ru: 'grape', en: 'grape', ky: 'grape' },
  g3e_opt_carrot: { ru: 'carrot', en: 'carrot', ky: 'carrot' },
  g3e_opt_potato: { ru: 'potato', en: 'potato', ky: 'potato' },
  g3e_opt_tomato: { ru: 'tomato', en: 'tomato', ky: 'tomato' },
  g3e_opt_i_like: { ru: 'I like', en: 'I like', ky: 'I like' },
  g3e_opt_i_dont_like: { ru: "I don't like", en: "I don't like", ky: "I don't like" },
  g3e_opt_i_eat: { ru: 'I eat', en: 'I eat', ky: 'I eat' },
  g3e_opt_i_like_ru: { ru: 'Мне нравится', en: 'I like', ky: 'Мага жагат' },
  g3e_opt_i_dont_like_ru: { ru: 'Мне не нравится', en: "I don't like", ky: 'Мага жакпайт' },
  g3e_opt_i_eat_ru: { ru: 'Я ем', en: 'I eat', ky: 'Мен жейм' },
  g3e_opt_yes_i_like: { ru: 'Yes, I like.', en: 'Yes, I like.', ky: 'Yes, I like.' },
  g3e_opt_yes_he_like: { ru: 'Yes, he like.', en: 'Yes, he like.', ky: 'Yes, he like.' },
  g3e_opt_yes_i_likes: { ru: 'Yes, I likes.', en: 'Yes, I likes.', ky: 'Yes, I likes.' },
  g3e_opt_she_like: { ru: 'she like', en: 'she like', ky: 'she like' },
  g3e_opt_she_likes: { ru: 'she likes', en: 'she likes', ky: 'she likes' },
  g3e_opt_she_liked: { ru: 'she liked', en: 'she liked', ky: 'she liked' },
  g3e_opt_study: { ru: 'study', en: 'study', ky: 'study' },
  g3e_opt_studies: { ru: 'studies', en: 'studies', ky: 'studies' },
  g3e_opt_studied: { ru: 'studied', en: 'studied', ky: 'studied' },
  g3e_opt_studying: { ru: 'studying', en: 'studying', ky: 'studying' },
  g3e_opt_play: { ru: 'play', en: 'play', ky: 'play' },
  g3e_opt_sleep: { ru: 'sleep', en: 'sleep', ky: 'sleep' },
  g3e_opt_read_w: { ru: 'read', en: 'read', ky: 'read' },
  g3e_opt_write_w: { ru: 'write', en: 'write', ky: 'write' },
  g3e_opt_count_w: { ru: 'count', en: 'count', ky: 'count' },
  g3e_opt_play_football: { ru: 'play football', en: 'play football', ky: 'play football' },
  g3e_opt_watch_tv: { ru: 'watch TV', en: 'watch TV', ky: 'watch TV' },
  g3e_opt_read_book: { ru: 'read a book', en: 'read a book', ky: 'read a book' },
  g3e_opt_tv_ru: { ru: 'Телевизор', en: 'TV', ky: 'Телевизор' },
  g3e_opt_football_ru: { ru: 'Футбол', en: 'football', ky: 'Футбол' },
  g3e_opt_book_ru: { ru: 'Книгу', en: 'book', ky: 'Китеп' },
  g3e_opt_i_like_reading: { ru: 'I like reading.', en: 'I like reading.', ky: 'I like reading.' },
  g3e_opt_he_like_reading: { ru: 'He like reading.', en: 'He like reading.', ky: 'He like reading.' },
  g3e_opt_i_likes_reading: { ru: 'I likes reading.', en: 'I likes reading.', ky: 'I likes reading.' },
  g3e_opt_what_hobby: { ru: 'What do you like?', en: 'What do you like?', ky: 'What do you like?' },
  g3e_opt_where_hobby: { ru: 'Where do you go?', en: 'Where do you go?', ky: 'Where do you go?' },
  g3e_opt_when_hobby: { ru: 'When do you play?', en: 'When do you play?', ky: 'When do you play?' },
};

const worldsEdits = [
  // g3e-food-l1 t1 (juice = сок)
  ["questionKey: 'data.tasks.g3e_apple_en', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_apple', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_opt_orange', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_opt_banana', correct: false }]",
   "questionKey: 'data.tasks.g3e_food1_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_food1_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_food1_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_food1_q1_c', correct: false }]"],
  // g3e-food-l1 t2 (porridge = каша)
  ["questionKey: 'data.tasks.g3e_orange_en', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_apple', correct: false }, { id: 'b', textKey: 'data.tasks.g3e_opt_orange', correct: true }, { id: 'c', textKey: 'data.tasks.g3e_opt_grape', correct: false }]",
   "questionKey: 'data.tasks.g3e_food1_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_food1_q2_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3e_food1_q2_b', correct: true }, { id: 'c', textKey: 'data.tasks.g3e_food1_q2_c', correct: false }]"],
  // g3e-food-l1 t4 (drink water = воду; ✓ was on b/сок)
  ["questionKey: 'data.tasks.g3e_what_fruit_grape', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_apple', correct: false }, { id: 'b', textKey: 'data.tasks.g3e_opt_grape', correct: true }, { id: 'c', textKey: 'data.tasks.g3e_opt_banana', correct: false }]",
   "questionKey: 'data.tasks.g3e_food1_q4', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3e_food1_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3e_food1_q4_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_food1_q4_c', correct: true }]"],
  // g3e-food-l2 t1 (I like apples = мне нравятся яблоки)
  ["questionKey: 'data.tasks.g3e_carrot_en', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_carrot', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_opt_potato', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_opt_tomato', correct: false }]",
   "questionKey: 'data.tasks.g3e_food2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_food2_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_food2_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_food2_q1_c', correct: false }]"],
  // g3e-food-l2 t2 (onions = лук; ✓ was on c/«I am soup»)
  ["questionKey: 'data.tasks.g3e_tomato_en', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_carrot', correct: false }, { id: 'b', textKey: 'data.tasks.g3e_opt_potato', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_opt_tomato', correct: true }]",
   "questionKey: 'data.tasks.g3e_food2_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_food2_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_food2_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_food2_q2_c', correct: false }]"],
  // g3e-food-l2 t4 (I don't like soup ✓ stays b)
  ["questionKey: 'data.tasks.g3e_potato_en', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_carrot', correct: false }, { id: 'b', textKey: 'data.tasks.g3e_opt_potato', correct: true }, { id: 'c', textKey: 'data.tasks.g3e_opt_tomato', correct: false }]",
   "questionKey: 'data.tasks.g3e_food2_q4', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3e_food2_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3e_food2_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g3e_food2_q4_c', correct: false }]"],
  // g3e-food-l3 t1 (some bread ✓ stays a)
  ["questionKey: 'data.tasks.g3e_i_like_apples', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_i_like', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_opt_i_dont_like', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_opt_i_eat', correct: false }]",
   "questionKey: 'data.tasks.g3e_food3_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_food3_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_food3_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_food3_q1_c', correct: false }]"],
  // g3e-food-l3 t2 (pass the salt = передать соль; ✓ was on b/хлеб)
  ["questionKey: 'data.tasks.g3e_i_dont_like_means', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_i_like_ru', correct: false }, { id: 'b', textKey: 'data.tasks.g3e_opt_i_dont_like_ru', correct: true }, { id: 'c', textKey: 'data.tasks.g3e_opt_i_eat_ru', correct: false }]",
   "questionKey: 'data.tasks.g3e_food3_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_food3_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_food3_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_food3_q2_c', correct: false }]"],
  // g3e-food-l3 t3 (delicious = еда вкусная ✓ stays a)
  ["questionKey: 'data.tasks.g3e_do_you_like_pizza', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_yes_i_like', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_opt_yes_he_like', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_opt_yes_i_likes', correct: false }]",
   "questionKey: 'data.tasks.g3e_food3_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3e_food3_q3_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_food3_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_food3_q3_c', correct: false }]"],
  // g3e-food-l3 t4 (вежливый отказ = No, thank you; ✓ was on b/«No, I hate it»)
  ["questionKey: 'data.tasks.g3e_she_likes_pasta', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_she_like', correct: false }, { id: 'b', textKey: 'data.tasks.g3e_opt_she_likes', correct: true }, { id: 'c', textKey: 'data.tasks.g3e_opt_she_liked', correct: false }]",
   "questionKey: 'data.tasks.g3e_food3_q4', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3e_food3_q4_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_food3_q4_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_food3_q4_c', correct: false }]"],
  // g3e-daily-l2 t1 (half past three = 3:30; ✓ was on hijacked «What time is it?»)
  ["questionKey: 'data.tasks.g3e_study_en', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_study', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_opt_play', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_opt_sleep', correct: false }]",
   "questionKey: 'data.tasks.g3e_daily2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_daily2_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_daily2_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_daily2_q1_c', correct: false }]"],
  // g3e-daily-l2 t2 (quarter past eight = 8:15 ✓ stays b)
  ["questionKey: 'data.tasks.g3e_write_en', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_read_w', correct: false }, { id: 'b', textKey: 'data.tasks.g3e_opt_write_w', correct: true }, { id: 'c', textKey: 'data.tasks.g3e_opt_count_w', correct: false }]",
   "questionKey: 'data.tasks.g3e_daily2_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_daily2_q2_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3e_daily2_q2_b', correct: true }, { id: 'c', textKey: 'data.tasks.g3e_daily2_q2_c', correct: false }]"],
  // g3e-daily-l2 t3 (five o'clock = 5:00)
  ["questionKey: 'data.tasks.g3e_i_study_math', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_study', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_opt_studies', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_opt_studied', correct: false }]",
   "questionKey: 'data.tasks.g3e_daily2_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3e_daily2_q3_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_daily2_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_daily2_q3_c', correct: false }]"],
  // g3e-daily-l2 t4 (как спросить время = What time is it?; ✓ was on b/«Where is the time?»)
  ["questionKey: 'data.tasks.g3e_he_studies', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_study', correct: false }, { id: 'b', textKey: 'data.tasks.g3e_opt_studies', correct: true }, { id: 'c', textKey: 'data.tasks.g3e_opt_studying', correct: false }]",
   "questionKey: 'data.tasks.g3e_daily2_q4', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3e_daily2_q4_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_daily2_q4_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_daily2_q4_c', correct: false }]"],
  // g3e-daily-l3 t1 (always = всегда ✓ stays a)
  ["questionKey: 'data.tasks.g3e_play_football_en', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_play_football', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_opt_watch_tv', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_opt_read_book', correct: false }]",
   "questionKey: 'data.tasks.g3e_daily3_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_daily3_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_daily3_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_daily3_q1_c', correct: false }]"],
  // g3e-daily-l3 t2 (порядок частот ✓ stays a)
  ["questionKey: 'data.tasks.g3e_watch_tv_means', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_tv_ru', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_opt_football_ru', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_opt_book_ru', correct: false }]",
   "questionKey: 'data.tasks.g3e_daily3_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_daily3_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_daily3_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_daily3_q2_c', correct: false }]"],
  // g3e-daily-l3 t3 (sometimes = иногда; ✓ was on a/«Всегда»)
  ["questionKey: 'data.tasks.g3e_what_do_you_like', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_i_like_reading', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_opt_he_like_reading', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_opt_i_likes_reading', correct: false }]",
   "questionKey: 'data.tasks.g3e_daily3_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3e_daily3_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3e_daily3_q3_b', correct: true }, { id: 'c', textKey: 'data.tasks.g3e_daily3_q3_c', correct: false }]"],
  // g3e-daily-l3 t4 (I am never late — грамматически верные опции)
  ["questionKey: 'data.tasks.g3e_hobbies_question', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_what_hobby', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_opt_where_hobby', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_opt_when_hobby', correct: false }]",
   "questionKey: 'data.tasks.g3e_daily3_q4', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3e_daily3_q4_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_daily3_q4_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_daily3_q4_c', correct: false }]"],
];

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
  console.log('ABA ' + lng + ': restored ' + n);
}

const wp = path.join(root, 'src/data/worlds.ts');
let src = fs.readFileSync(wp, 'utf8');
let ok = 0, fail = 0;
for (const [oldS, newS] of worldsEdits) {
  const count = src.split(oldS).length - 1;
  if (count !== 1) { console.log('EDIT FAIL (found ' + count + '): ' + oldS.slice(0, 100)); fail++; continue; }
  src = src.replace(oldS, newS);
  ok++;
}
fs.writeFileSync(wp, src);
console.log('worlds.ts edits: ok=' + ok + ' fail=' + fail);
