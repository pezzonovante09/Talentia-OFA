/**
 * Phase 4 remaining content: non-g1world fixes + locale keys for g1world rewrites.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const loc = (f) => path.join(root, 'src/i18n/locales', f);
const same = (v) => ({ ru: v, en: v, ky: v });

const newTaskKeys = {
  g3m_cmp_q1: { ru: 'Какое число больше: 356 или 298?', en: 'Which number is greater: 356 or 298?', ky: 'Кайсы сан чоңураак: 356 же 298?' },
  g3m_cmp_q2: { ru: 'Сравни: 450 ___ 405', en: 'Compare: 450 ___ 405', ky: 'Салыштыр: 450 ___ 405' },
  g3m_cmp_q3: { ru: 'Тали говорит: «512 = 521». Прав ли он?', en: 'Tali says: "512 = 521". Is he right?', ky: 'Тали айтат: «512 = 521». Ал туурабы?' },
  g3m_cmp_q4: { ru: 'Какое число меньше: 703 или 730?', en: 'Which number is smaller: 703 or 730?', ky: 'Кайсы сан кичирээк: 703 же 730?' },
  g3m_cmp_opt_356: same('356'),
  g3m_cmp_opt_298: same('298'),
  g3m_cmp_opt_gt: same('>'),
  g3m_cmp_opt_lt: same('<'),
  g3m_cmp_opt_eq: same('='),
  g3m_cmp_opt_703: same('703'),
  g3m_cmp_opt_730: same('730'),

  g2e_yd_q1: { ru: 'Today is Monday. Yesterday was…', en: 'Today is Monday. Yesterday was…', ky: 'Today is Monday. Yesterday was…' },
  g2e_yd_q2: { ru: 'Today is Monday. Tomorrow is…', en: 'Today is Monday. Tomorrow is…', ky: 'Today is Monday. Tomorrow is…' },
  g2e_yd_q3: { ru: '«Yesterday» по-русски:', en: '"Yesterday" in Russian:', ky: '«Yesterday» орусча:' },
  g2e_yd_q4: { ru: '«Tomorrow» по-русски:', en: '"Tomorrow" in Russian:', ky: '«Tomorrow» орусча:' },
  g2e_yd_opt_sunday: same('Sunday'),
  g2e_yd_opt_tuesday: same('Tuesday'),
  g2e_yd_opt_monday: same('Monday'),
  g2e_yd_opt_vchera: same('Вчера'),
  g2e_yd_opt_segodnya: same('Сегодня'),
  g2e_yd_opt_zavtra: same('Завтра'),

  g2e_sch3_q1: { ru: '«Я не понимаю» по-английски:', en: '"I don\'t understand" in English:', ky: '«Мен түшүнбөйм» англисче:' },
  g2e_sch3_q2: { ru: '«Можешь помочь?» по-английски:', en: '"Can you help me?" in English:', ky: '«Жардам бересиңби?» англисче:' },
  g2e_sch3_q3: { ru: '«Можно войти?» по-английски:', en: '"May I come in?" in English:', ky: '«Кирсем болобу?» англисче:' },
  g2e_sch3_q4: { ru: 'Учитель спросил, а Тали не понял. Что сказать?', en: 'The teacher asked, and Tali didn\'t understand. What should he say?', ky: 'Мугалим сурады, Тали түшүнгөн жок. Эмне деш керек?' },
  g2e_sch3_opt_idont: same("I don't understand"),
  g2e_sch3_opt_help: same('Can you help me?'),
  g2e_sch3_opt_may: same('May I come in?'),
  g2e_sch3_opt_hello: same('Hello!'),
  g2e_sch3_opt_bye: same('Goodbye!'),
  g2e_sch3_opt_thanks: same('Thank you!'),

  g1e_opt_K: same('K'),
  g1e_opt_L: same('L'),
  g1e_opt_M: same('M'),
  g1e_opt_N: same('N'),
  g1e_opt_O: same('O'),
  g1e_opt_P: same('P'),
  g1e_opt_Q: same('Q'),
  g1e_opt_R: same('R'),

  g1w_schl3_q1: { ru: 'На физкультуре Тали обычно…', en: 'In PE Tali usually…', ky: 'Дене тарбияда Тали адатта…' },
  g1w_schl3_q2: { ru: 'На рисовании Тали…', en: 'In art class Tali…', ky: 'Сүрөт сабагында Тали…' },
  g1w_schl3_q3: { ru: 'Что нужно для игры в мяч на физкультуре?', en: 'What do you need for a ball game in PE?', ky: 'Дене тарбияда топ оюну үчүн эмне керек?' },
  g1w_schl3_q4: { ru: 'Тали говорит: «На рисовании мы бегаем!» Правда?', en: 'Tali says: "In art we run!" Is that true?', ky: 'Тали айтат: «Сүрөт сабагында чуркайбыз!» Чынбы?' },
  g1w_schl3_opt_run: { ru: 'Бегает и прыгает', en: 'Runs and jumps', ky: 'Чуркай жана секирет' },
  g1w_schl3_opt_read: { ru: 'Читает учебник', en: 'Reads a textbook', ky: 'Окуу китебин окуйт' },
  g1w_schl3_opt_sleep: { ru: 'Спит', en: 'Sleeps', ky: 'Уктайт' },
  g1w_schl3_opt_paint: { ru: 'Рисует красками', en: 'Paints with paints', ky: 'Боёктор менен сүрөт тартат' },
  g1w_schl3_opt_jump: { ru: 'Прыгает через скакалку', en: 'Jumps rope', ky: 'Секиргич менен секирет' },
  g1w_schl3_opt_count: { ru: 'Считает примеры', en: 'Solves math problems', ky: 'Мисалдарды чыгарат' },
  g1w_schl3_opt_ball: { ru: 'Мяч', en: 'A ball', ky: 'Топ' },
  g1w_schl3_opt_brush: { ru: 'Кисть', en: 'A paintbrush', ky: 'Кисть' },
  g1w_schl3_opt_book: { ru: 'Книга', en: 'A book', ky: 'Китеп' },

  g1w_natl1_q1: { ru: 'Какое из этих — дерево?', en: 'Which of these is a tree?', ky: 'Мунун кайсысы — дарак?' },
  g1w_natl1_q2: { ru: 'Толстая «нога» дерева — это…', en: 'The thick "leg" of a tree is…', ky: 'Дарактын жоон «буту» — бул…' },
  g1w_natl1_q3: { ru: 'Какое дерево хвойное (с иголками)?', en: 'Which tree is coniferous (with needles)?', ky: 'Кайсы дарак ийне жалбырактуу?' },
  g1w_natl1_q4: { ru: 'У берёзы летом на ветках…', en: 'In summer a birch has… on its branches', ky: 'Кайыңдын жайында бутактарында…' },
  g1w_natl1_opt_oak: { ru: 'Дуб', en: 'Oak', ky: 'Эмен' },
  g1w_natl1_opt_rose: { ru: 'Роза', en: 'Rose', ky: 'Роза' },
  g1w_natl1_opt_mushroom: { ru: 'Гриб', en: 'Mushroom', ky: 'Козу карын' },
  g1w_natl1_opt_trunk: { ru: 'Ствол', en: 'Trunk', ky: 'Сөңгөк' },
  g1w_natl1_opt_root: { ru: 'Корень (под землёй)', en: 'Root (underground)', ky: 'Тамыр (жер астында)' },
  g1w_natl1_opt_flower: { ru: 'Цветок', en: 'Flower', ky: 'Гүл' },
  g1w_natl1_opt_fir: { ru: 'Ель', en: 'Fir / spruce', ky: 'Карагай' },
  g1w_natl1_opt_birch: { ru: 'Берёза', en: 'Birch', ky: 'Кайың' },
  g1w_natl1_opt_maple: { ru: 'Клён', en: 'Maple', ky: 'Клён' },
  g1w_natl1_opt_leaves: { ru: 'Листья', en: 'Leaves', ky: 'Жалбырактар' },
  g1w_natl1_opt_needles: { ru: 'Иголки', en: 'Needles', ky: 'Ийнелер' },

  g1w_natl3_q1: { ru: 'Какая погода тёплая и яркая?', en: 'Which weather is warm and bright?', ky: 'Кайсы аба ырайы жылуу жана жарык?' },
  g1w_natl3_q2: { ru: 'На улице снег. Что надеть?', en: 'It is snowing outside. What should you wear?', ky: 'Сыртта кар жаап жатат. Эмне кийүү керек?' },
  g1w_natl3_q3: { ru: 'Идёт дождь. Что взять с собой?', en: 'It is raining. What should you take?', ky: 'Жамгыр жаап жатат. Эмне алуу керек?' },
  g1w_natl3_q4: { ru: 'Нужно ли беречь природу — не мусорить в лесу?', en: 'Should we care for nature — not litter in the forest?', ky: 'Жаратылышты коргоо керекпи — токойго таштанды таштабоо?' },
  g1w_natl3_opt_sun: { ru: 'Солнечно', en: 'Sunny', ky: 'Күндүү' },
  g1w_natl3_opt_snow: { ru: 'Снег', en: 'Snow', ky: 'Кар' },
  g1w_natl3_opt_rain: { ru: 'Дождь', en: 'Rain', ky: 'Жамгыр' },
  g1w_natl3_opt_coat: { ru: 'Тёплую куртку', en: 'A warm coat', ky: 'Жылуу куртка' },
  g1w_natl3_opt_swimsuit: { ru: 'Купальник', en: 'A swimsuit', ky: 'Сууда сүзүү кийими' },
  g1w_natl3_opt_sandals: { ru: 'Сандалии', en: 'Sandals', ky: 'Сандал' },
  g1w_natl3_opt_umbrella: { ru: 'Зонт', en: 'An umbrella', ky: 'Колчатыр' },
  g1w_natl3_opt_sled: { ru: 'Санки', en: 'A sled', ky: 'Чаңа' },
  g1w_natl3_opt_fan: { ru: 'Веер', en: 'A fan', ky: 'Желпүүр' },

  g1w_bdy_opt_eyes: { ru: 'Глаза', en: 'Eyes', ky: 'Көздөр' },
  g1w_bdy_opt_ears: { ru: 'Уши', en: 'Ears', ky: 'Кулактар' },
  g1w_bdy_opt_nose: { ru: 'Нос', en: 'Nose', ky: 'Мурун' },
  g1w_bdy_opt_tongue: { ru: 'Язык', en: 'Tongue', ky: 'Тил' },
  g1w_bdy_opt_hands: { ru: 'Руки', en: 'Hands', ky: 'Колдор' },
  g1w_bdyl1_q1: { ru: 'Чем мы видим?', en: 'What do we see with?', ky: 'Биз эмне менен көрөбүз?' },
  g1w_bdyl1_q2: { ru: 'Чем мы слышим?', en: 'What do we hear with?', ky: 'Биз эмне менен угабыз?' },
  g1w_bdyl1_q3: { ru: 'Чем мы нюхаем?', en: 'What do we smell with?', ky: 'Биз эмне менен жыттайбыз?' },
  g1w_bdyl1_q4: { ru: 'Чем мы пробуем на вкус?', en: 'What do we taste with?', ky: 'Биз эмне менен даамдайбыз?' },
  g1w_bdyl1_a1: { ru: 'Чем смотрим на картинку?', en: 'What do we look at a picture with?', ky: 'Сүрөттү эмне менен карайбыз?' },

  g1w_bdyl2_q1: { ru: 'Что помогает мышцам быть сильными?', en: 'What helps muscles get strong?', ky: 'Булчуңдарды күчтүү кылууга эмне жардам берет?' },
  g1w_bdyl2_q2: { ru: 'Какая еда полезная?', en: 'Which food is healthy?', ky: 'Кайсы тамак пайдалуу?' },
  g1w_bdyl2_q3: { ru: 'Сколько примерно нужно спать школьнику?', en: 'About how much sleep does a schoolchild need?', ky: 'Окуучуга болжол менен канча уктоо керек?' },
  g1w_bdyl2_q4: { ru: 'Что держит тело прямо, как опора?', en: 'What holds the body upright like a support?', ky: 'Денени тик кармап турган опора эмне?' },
  g1w_bdyl2_a1: { ru: 'Нужно ли делать зарядку?', en: 'Is it good to do morning exercise?', ky: 'Машыгуу жасаш керекпи?' },
  g1w_bdyl2_opt_exercise: { ru: 'Зарядка и спорт', en: 'Exercise and sport', ky: 'Машыгуу жана спорт' },
  g1w_bdyl2_opt_candy: { ru: 'Только конфеты', en: 'Only candy', ky: 'Жалаң конфет' },
  g1w_bdyl2_opt_tv: { ru: 'Сидеть у телевизора', en: 'Sitting by the TV', ky: 'Телевизор алдында отуруу' },
  g1w_bdyl2_opt_fruit: { ru: 'Фрукты и овощи', en: 'Fruit and vegetables', ky: 'Жемиш жана жашылча' },
  g1w_bdyl2_opt_chips: { ru: 'Чипсы', en: 'Chips', ky: 'Чипсы' },
  g1w_bdyl2_opt_soda: { ru: 'Газировка', en: 'Soda', ky: 'Газдалган суусундук' },
  g1w_bdyl2_opt_sleep: { ru: 'Около 9–10 часов', en: 'About 9–10 hours', ky: 'Болжол менен 9–10 саат' },
  g1w_bdyl2_opt_2h: { ru: '2 часа', en: '2 hours', ky: '2 саат' },
  g1w_bdyl2_opt_allnight: { ru: 'Не спать всю ночь', en: 'Stay up all night', ky: 'Түнү бою уктабоо' },
  g1w_bdyl2_opt_bones: { ru: 'Скелет (кости)', en: 'Skeleton (bones)', ky: 'Скелет (сөөктөр)' },
  g1w_bdyl2_opt_hair: { ru: 'Волосы', en: 'Hair', ky: 'Чач' },
  g1w_bdyl2_opt_nails: { ru: 'Ногти', en: 'Nails', ky: 'Тырмак' },

  g1w_bdyl3_q1: { ru: 'На какой сигнал светофора можно переходить дорогу?', en: 'Which traffic light colour means you can cross?', ky: 'Жол белгисинин кайсы түсүндө жолдон өтсө болот?' },
  g1w_bdyl3_q2: { ru: 'Незнакомый человек у двери. Что делать?', en: 'A stranger is at the door. What should you do?', ky: 'Эшикте тааныш эмес адам. Эмне кылуу керек?' },
  g1w_bdyl3_q3: { ru: 'Ты потерялся в магазине. К кому обратиться?', en: 'You got lost in a shop. Who should you ask?', ky: 'Дүкөндө адашып калдың. Кимге кайрылуу керек?' },
  g1w_bdyl3_q4: { ru: 'Перед переходом дороги нужно…', en: 'Before crossing the road you should…', ky: 'Жолдон өтүүдөн мурун…' },
  g1w_bdyl3_a1: { ru: 'Зелёный свет — можно идти?', en: 'Green light — can you go?', ky: 'Жашыл жарык — жүрүүгө болобу?' },
  g1w_bdyl3_opt_green: { ru: 'Зелёный', en: 'Green', ky: 'Жашыл' },
  g1w_bdyl3_opt_red: { ru: 'Красный', en: 'Red', ky: 'Кызыл' },
  g1w_bdyl3_opt_yellow: { ru: 'Жёлтый', en: 'Yellow', ky: 'Сары' },
  g1w_bdyl3_opt_parent: { ru: 'Позвать взрослого / не открывать', en: 'Call an adult / do not open', ky: 'Чоң кишини чакыруу / ачпоо' },
  g1w_bdyl3_opt_open: { ru: 'Сразу открыть дверь', en: 'Open the door right away', ky: 'Дароо эшикти ачуу' },
  g1w_bdyl3_opt_hide: { ru: 'Спрятаться под кровать', en: 'Hide under the bed', ky: 'Керебеттин астына жашынуу' },
  g1w_bdyl3_opt_police: { ru: 'К продавцу или охране', en: 'A shop worker or security', ky: 'Сатуучуга же коопсуздукка' },
  g1w_bdyl3_opt_stranger: { ru: 'К любому незнакомцу', en: 'Any stranger', ky: 'Каалаган тааныш эмеске' },
  g1w_bdyl3_opt_alone: { ru: 'Искать выход одному', en: 'Look for the exit alone', ky: 'Жалгыз чыгууну издеш' },
  g1w_bdyl3_opt_look: { ru: 'Посмотреть налево и направо', en: 'Look left and right', ky: 'Солго жана оңго караш' },
  g1w_bdyl3_opt_run: { ru: 'Бежать, не глядя', en: 'Run without looking', ky: 'Карабай чуркоо' },
  g1w_bdyl3_opt_phone: { ru: 'Смотреть в телефон', en: 'Look at your phone', ky: 'Телефонго караш' },
};

const overridesBySection = {
  lessons: {
    ru: { g1eGrtL2: 'Меня зовут' },
    en: { g1eGrtL2: 'My name is' },
    ky: { g1eGrtL2: 'Менин атым' },
  },
  dialog: {
    ru: {
      g1e_grtl2_0: 'My name is Polly! What is your name?',
      g1e_grtl2_1: 'My name is Tali! А ещё можно сказать: I am Tali. Как правильно спросить имя?',
      g1e_abcl2_1: 'M — moon (луна), N — night (ночь). С какой буквы начинается MOON?',
      g1w_schl3_0: 'На физкультуре бегаем, на рисовании рисуем! Что тебе нравится больше?',
      g1w_schl3_1: 'Я люблю и то и другое! На физкультуре прыгаю, а на рисовании — рисую динозавров. Помоги разобраться!',
      g1w_natl2_0: 'Животные бывают домашние и дикие. Корова — домашняя, а медведь — дикий!',
      g1w_natl2_1: 'Домашние живут рядом с людьми. Дикие — в лесу и саванне. Давай проверим!',
      g1w_natl3_0: 'Погода бывает разная: солнце, дождь, снег! Что надеть — зависит от погоды.',
      g1w_natl3_1: 'В дождь — зонт, в снег — куртку. И природу береги: не мусори в лесу!',
    },
    en: {
      g1e_grtl2_0: 'My name is Polly! What is your name?',
      g1e_grtl2_1: 'My name is Tali! You can also say: I am Tali. How do we ask for a name?',
      g1e_abcl2_1: 'M — moon, N — night. What letter does MOON start with?',
      g1w_schl3_0: 'In PE we run, in art we draw! Which do you like more?',
      g1w_schl3_1: 'I like both! In PE I jump, in art I draw dinosaurs. Help me!',
      g1w_natl2_0: 'Animals can be domestic or wild. A cow is domestic, a bear is wild!',
      g1w_natl2_1: 'Domestic animals live near people. Wild ones live in forests. Let’s check!',
      g1w_natl3_0: 'Weather can be sun, rain or snow! What to wear depends on the weather.',
      g1w_natl3_1: 'In rain — an umbrella, in snow — a coat. And care for nature!',
    },
    ky: {
      g1e_grtl2_0: 'My name is Polly! What is your name?',
      g1e_grtl2_1: 'My name is Tali! Дагы: I am Tali. Атын кантип сурайбыз?',
      g1e_abcl2_1: 'M — moon, N — night. MOON кайсы тамгадан башталат?',
      g1w_schl3_0: 'Дене тарбияда чуркайбыз, сүрөт сабагында тартабыз! Сага кайсысы жагат?',
      g1w_schl3_1: 'Экөө тең жагат! Дене тарбияда секирем, сүрөттө динозавр тартам. Жардам бер!',
      g1w_natl2_0: 'Жаныбарлар үй жана жапайы болот. Уй — үй, аюу — жапайы!',
      g1w_natl2_1: 'Үй жаныбарлары адамдын жанында. Жапайылары токойдо. Текшерели!',
      g1w_natl3_0: 'Аба ырайы ар кандай: күн, жамгыр, кар! Эмне кийүү — аба ырайына жараша.',
      g1w_natl3_1: 'Жамгырда — колчатыр, карда — куртка. Жаратылышты да корго!',
    },
  },
  intro: {
    ru: {
      g1e_grtl3_0_t: 'Thank you и Please',
      g1e_grtl3_0_b: 'Thank you — спасибо! Please — пожалуйста!',
      g1e_grtl3_1_t: 'How are you?',
      g1e_grtl3_1_b: 'How are you? — Как дела? Fine, thanks! — Хорошо, спасибо!',
      g1w_schl3_0_t: 'Физкультура',
      g1w_schl3_0_b: 'На физкультуре мы бегаем, прыгаем и играем в мяч. Это спорт в школе!',
      g1w_schl3_1_t: 'Рисование',
      g1w_schl3_1_b: 'На рисовании мы рисуем красками и карандашами. Тут нужна кисть, а не мяч!',
      g1w_natl2_0_t: 'Домашние и дикие',
      g1w_natl2_0_b: 'Домашние: корова, собака, кот. Дикие: медведь, лев, лиса.',
      g1w_natl2_1_t: 'Где живут?',
      g1w_natl2_1_b: 'Дикие животные живут в лесу и саванне. Домашние — рядом с человеком.',
      g1w_natl3_0_t: 'Погода',
      g1w_natl3_0_b: 'Солнце, дождь, снег, ветер — это погода. От неё зависит, что надеть.',
      g1w_natl3_1_t: 'Береги природу',
      g1w_natl3_1_b: 'Не мусори в лесу и парке. Природа — наш общий дом!',
      g1w_bdyl1_1_t: 'Вкус и язык',
      g1w_bdyl1_1_b: 'Языком мы пробуем на вкус: сладкое, кислое, солёное. Это тоже орган чувств!',
    },
    en: {
      g1e_grtl3_0_t: 'Thank you and Please',
      g1e_grtl3_0_b: 'Thank you means thanks! Please is a polite word.',
      g1e_grtl3_1_t: 'How are you?',
      g1e_grtl3_1_b: 'How are you? — Fine, thanks!',
      g1w_schl3_0_t: 'PE',
      g1w_schl3_0_b: 'In PE we run, jump and play ball.',
      g1w_schl3_1_t: 'Art',
      g1w_schl3_1_b: 'In art we paint. You need a brush, not a ball!',
      g1w_natl2_0_t: 'Domestic and wild',
      g1w_natl2_0_b: 'Domestic: cow, dog, cat. Wild: bear, lion, fox.',
      g1w_natl2_1_t: 'Where do they live?',
      g1w_natl2_1_b: 'Wild animals live in forests. Domestic ones live near people.',
      g1w_natl3_0_t: 'Weather',
      g1w_natl3_0_b: 'Sun, rain, snow, wind — that is weather.',
      g1w_natl3_1_t: 'Care for nature',
      g1w_natl3_1_b: 'Do not litter in the forest. Nature is our home!',
      g1w_bdyl1_1_t: 'Taste and tongue',
      g1w_bdyl1_1_b: 'With the tongue we taste sweet, sour, salty.',
    },
    ky: {
      g1e_grtl3_0_t: 'Thank you жана Please',
      g1e_grtl3_0_b: 'Thank you — рахмат! Please — өтүнөмүн!',
      g1e_grtl3_1_t: 'How are you?',
      g1e_grtl3_1_b: 'How are you? — Кандайсың? Fine, thanks!',
      g1w_schl3_0_t: 'Дене тарбия',
      g1w_schl3_0_b: 'Дене тарбияда чуркайбыз, секиребиз жана топ ойнойбуз!',
      g1w_schl3_1_t: 'Сүрөт',
      g1w_schl3_1_b: 'Сүрөт сабагында боёктор менен тартабыз. Кисть керек!',
      g1w_natl2_0_t: 'Үй жана жапайы',
      g1w_natl2_0_b: 'Үй: уй, ит, мышык. Жапайы: аюу, арстан, түлкү.',
      g1w_natl2_1_t: 'Кайда жашашат?',
      g1w_natl2_1_b: 'Жапайылар токойдо. Үйлөрү адамдын жанында.',
      g1w_natl3_0_t: 'Аба ырайы',
      g1w_natl3_0_b: 'Күн, жамгыр, кар, шамал — бул аба ырайы.',
      g1w_natl3_1_t: 'Жаратылышты корго',
      g1w_natl3_1_b: 'Токойго таштанды таштаба!',
      g1w_bdyl1_1_t: 'Даам жана тил',
      g1w_bdyl1_1_b: 'Тил менен даамдайбыз: таттуу, кычкыл, туздуу.',
    },
  },
  tasks: {
    ru: {
      g1e_G_for: 'С какой буквы начинается GOAT?',
      g1e_J_for: 'С какой буквы начинается JELLY? Тали говорит: «С G!»',
      g1e_K_for: 'С какой буквы начинается KITE?',
      g1e_M_for: 'С какой буквы начинается MOON?',
      g1e_N_for: 'С какой буквы начинается NOSE? Тали говорит: «С M!»',
      g1m_addl1_q1: 'У Тали 2 яблока, Лео дал ещё 3. Сколько всего?',
      g1m_addl1_q1_a: '4', g1m_addl1_q1_b: '5', g1m_addl1_q1_c: '6',
      g1m_addl1_q2: 'В кармане 3 монеты, нашёл ещё 3. Сколько стало?',
      g1m_addl1_q2_a: '5', g1m_addl1_q2_b: '6', g1m_addl1_q2_c: '7',
      g1m_addl1_q3: '4 + 3 = ?',
      g1m_addl1_q3_a: '6', g1m_addl1_q3_b: '7', g1m_addl1_q3_c: '8',
      g1m_addl1_q4: 'На лавочке 5 птиц. Прилетели ещё 3. Сколько стало?',
      g1m_addl1_q4_a: '7', g1m_addl1_q4_b: '8', g1m_addl1_q4_c: '9',
      g1m_addl1_q5: '1 + 4 = ?',
      g1m_addl1_q5_a: '4', g1m_addl1_q5_b: '5',
    },
    en: {
      g1e_G_for: 'What letter does GOAT start with?',
      g1e_J_for: 'What letter does JELLY start with? Tali says: "G!"',
      g1e_K_for: 'What letter does KITE start with?',
      g1e_M_for: 'What letter does MOON start with?',
      g1e_N_for: 'What letter does NOSE start with? Tali says: "M!"',
      g1m_addl1_q1: 'Tali has 2 apples, Leo gave 3 more. How many?',
      g1m_addl1_q1_a: '4', g1m_addl1_q1_b: '5', g1m_addl1_q1_c: '6',
      g1m_addl1_q2: '3 coins, found 3 more. How many now?',
      g1m_addl1_q2_a: '5', g1m_addl1_q2_b: '6', g1m_addl1_q2_c: '7',
      g1m_addl1_q3: '4 + 3 = ?',
      g1m_addl1_q3_a: '6', g1m_addl1_q3_b: '7', g1m_addl1_q3_c: '8',
      g1m_addl1_q4: '5 birds, 3 more arrive. How many?',
      g1m_addl1_q4_a: '7', g1m_addl1_q4_b: '8', g1m_addl1_q4_c: '9',
      g1m_addl1_q5: '1 + 4 = ?',
      g1m_addl1_q5_a: '4', g1m_addl1_q5_b: '5',
    },
    ky: {
      g1e_G_for: 'GOAT кайсы тамгадан башталат?',
      g1e_J_for: 'JELLY кайсы тамгадан башталат? Тали: «G!»',
      g1e_K_for: 'KITE кайсы тамгадан башталат?',
      g1e_M_for: 'MOON кайсы тамгадан башталат?',
      g1e_N_for: 'NOSE кайсы тамгадан башталат? Тали: «M!»',
      g1m_addl1_q1: 'Талиде 2 алма, Лео дагы 3 берди. Канча?',
      g1m_addl1_q1_a: '4', g1m_addl1_q1_b: '5', g1m_addl1_q1_c: '6',
      g1m_addl1_q2: '3 тыйын, дагы 3 тапты. Канча?',
      g1m_addl1_q2_a: '5', g1m_addl1_q2_b: '6', g1m_addl1_q2_c: '7',
      g1m_addl1_q3: '4 + 3 = ?',
      g1m_addl1_q3_a: '6', g1m_addl1_q3_b: '7', g1m_addl1_q3_c: '8',
      g1m_addl1_q4: '5 канаттуу, дагы 3 келди. Канча?',
      g1m_addl1_q4_a: '7', g1m_addl1_q4_b: '8', g1m_addl1_q4_c: '9',
      g1m_addl1_q5: '1 + 4 = ?',
      g1m_addl1_q5_a: '4', g1m_addl1_q5_b: '5',
    },
  },
};

const worldsEdits = [
  [`tasks: [
            { id: 'g3m1000l3t1', type: 'input', questionKey: 'data.tasks.g3m_200plus350', difficulty: 1, answer: '550' },
            { id: 'g3m1000l3t2', type: 'input', questionKey: 'data.tasks.g3m_600minus240', difficulty: 1, answer: '360' },
            { id: 'g3m1000l3t3', type: 'input', questionKey: 'data.tasks.g3m_450plus275', difficulty: 2, answer: '725' },
            { id: 'g3m1000l3t4', type: 'input', questionKey: 'data.tasks.g3m_800minus356', difficulty: 3, answer: '444' },
          ] }`,
   `tasks: [
            { id: 'g3m1000l3t1', type: 'multiple_choice', questionKey: 'data.tasks.g3m_cmp_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3m_cmp_opt_356', correct: true }, { id: 'b', textKey: 'data.tasks.g3m_cmp_opt_298', correct: false }] },
            { id: 'g3m1000l3t2', type: 'multiple_choice', questionKey: 'data.tasks.g3m_cmp_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3m_cmp_opt_gt', correct: true }, { id: 'b', textKey: 'data.tasks.g3m_cmp_opt_lt', correct: false }, { id: 'c', textKey: 'data.tasks.g3m_cmp_opt_eq', correct: false }] },
            { id: 'g3m1000l3t3', type: 'multiple_choice', questionKey: 'data.tasks.g3m_cmp_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: false }, { id: 'b', textKey: 'data.tasks.opt_no', correct: true }] },
            { id: 'g3m1000l3t4', type: 'multiple_choice', questionKey: 'data.tasks.g3m_cmp_q4', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3m_cmp_opt_703', correct: true }, { id: 'b', textKey: 'data.tasks.g3m_cmp_opt_730', correct: false }] },
          ] }`],

  [`{ id: 'g2edaysl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g2e_thursday_ru', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_thursday', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_friday', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_saturday', correct: false }] },
            { id: 'g2edaysl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g2e_friday_ru', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_thursday', correct: false }, { id: 'b', textKey: 'data.tasks.g2e_opt_friday', correct: true }, { id: 'c', textKey: 'data.tasks.g2e_opt_sunday', correct: false }] },
            { id: 'g2edaysl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g2e_weekend_days', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_sat_sun', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_mon_fri', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_thu_fri', correct: false }] },
            { id: 'g2edaysl2t4', type: 'multiple_choice', questionKey: 'data.tasks.g2e_days_in_week', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_five', correct: false }, { id: 'b', textKey: 'data.tasks.opt_six', correct: false }, { id: 'c', textKey: 'data.tasks.opt_seven', correct: true }] },`,
   `{ id: 'g2edaysl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g2e_yd_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_yd_opt_sunday', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_yd_opt_tuesday', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_yd_opt_monday', correct: false }] },
            { id: 'g2edaysl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g2e_yd_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_yd_opt_sunday', correct: false }, { id: 'b', textKey: 'data.tasks.g2e_yd_opt_tuesday', correct: true }, { id: 'c', textKey: 'data.tasks.g2e_yd_opt_monday', correct: false }] },
            { id: 'g2edaysl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g2e_yd_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2e_yd_opt_vchera', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_yd_opt_segodnya', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_yd_opt_zavtra', correct: false }] },
            { id: 'g2edaysl2t4', type: 'multiple_choice', questionKey: 'data.tasks.g2e_yd_q4', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2e_yd_opt_vchera', correct: false }, { id: 'b', textKey: 'data.tasks.g2e_yd_opt_segodnya', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_yd_opt_zavtra', correct: true }] },`],

  [`{ id: 'g2eschl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g2e_wake_up_means', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_wake_up', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_go_to_bed', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_eat_lunch', correct: false }] },
            { id: 'g2eschl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g2e_go_to_school', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_wake_up', correct: false }, { id: 'b', textKey: 'data.tasks.g2e_opt_go_school', correct: true }, { id: 'c', textKey: 'data.tasks.g2e_opt_go_to_bed', correct: false }] },
            { id: 'g2eschl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g2e_go_home_after', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_go_home', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_go_school', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_wake_up', correct: false }] },
            { id: 'g2eschl3t4', type: 'multiple_choice', questionKey: 'data.tasks.g2e_do_homework_means', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_do_hw', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_play_games', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_go_to_bed', correct: false }] },`,
   `{ id: 'g2eschl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g2e_sch3_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_sch3_opt_idont', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_sch3_opt_help', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_sch3_opt_hello', correct: false }] },
            { id: 'g2eschl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g2e_sch3_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_sch3_opt_idont', correct: false }, { id: 'b', textKey: 'data.tasks.g2e_sch3_opt_help', correct: true }, { id: 'c', textKey: 'data.tasks.g2e_sch3_opt_bye', correct: false }] },
            { id: 'g2eschl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g2e_sch3_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2e_sch3_opt_may', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_sch3_opt_thanks', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_sch3_opt_hello', correct: false }] },
            { id: 'g2eschl3t4', type: 'multiple_choice', questionKey: 'data.tasks.g2e_sch3_q4', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2e_sch3_opt_idont', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_sch3_opt_bye', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_sch3_opt_thanks', correct: false }] },`],

  [`{ id: 'g1eabcl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g1e_G_for', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_bear', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_goat', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_apple', correct: false }] },
            { id: 'g1eabcl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g1e_happy_starts', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_G', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_H', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_I', correct: false }] },
            { id: 'g1eabcl1t3', type: 'multiple_choice', questionKey: 'data.tasks.g1e_ice_starts', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_H', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_I', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_J', correct: false }] },
            { id: 'g1eabcl1t4', type: 'multiple_choice', questionKey: 'data.tasks.g1e_J_for', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_jelly', correct: true }, { id: 'b', textKey: 'data.tasks.g1e_opt_kite', correct: false }, { id: 'c', textKey: 'data.tasks.g1e_opt_lamp', correct: false }] },`,
   `{ id: 'g1eabcl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g1e_G_for', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_G', correct: true }, { id: 'b', textKey: 'data.tasks.g1e_opt_H', correct: false }, { id: 'c', textKey: 'data.tasks.g1e_opt_I', correct: false }] },
            { id: 'g1eabcl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g1e_happy_starts', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_G', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_H', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_I', correct: false }] },
            { id: 'g1eabcl1t3', type: 'multiple_choice', questionKey: 'data.tasks.g1e_ice_starts', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_H', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_I', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_J', correct: false }] },
            { id: 'g1eabcl1t4', type: 'multiple_choice', questionKey: 'data.tasks.g1e_J_for', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_G', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_J', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_H', correct: false }] },`],

  [`{ id: 'g1eabcl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g1e_K_for', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_kite', correct: true }, { id: 'b', textKey: 'data.tasks.g1e_opt_lamp', correct: false }, { id: 'c', textKey: 'data.tasks.g1e_opt_moon', correct: false }] },
            { id: 'g1eabcl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g1e_starts_with_L', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_kite', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_lamp', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_nose', correct: false }] },
            { id: 'g1eabcl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g1e_M_for', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_kite', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_moon', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_nose', correct: false }] },
            { id: 'g1eabcl2t4', type: 'multiple_choice', questionKey: 'data.tasks.g1e_N_for', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_moon', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_nose', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_orange', correct: false }] },`,
   `{ id: 'g1eabcl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g1e_K_for', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_K', correct: true }, { id: 'b', textKey: 'data.tasks.g1e_opt_L', correct: false }, { id: 'c', textKey: 'data.tasks.g1e_opt_M', correct: false }] },
            { id: 'g1eabcl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g1e_starts_with_L', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_K', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_L', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_N', correct: false }] },
            { id: 'g1eabcl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g1e_M_for', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_K', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_M', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_N', correct: false }] },
            { id: 'g1eabcl2t4', type: 'multiple_choice', questionKey: 'data.tasks.g1e_N_for', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_M', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_N', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_L', correct: false }] },`],

  [`tasks: RW56_LESSON_TASKS['garden-col-l3'], },`, `tasks: G1W_SCH_L3_TASKS, },`],
  [`tasks: RW56_LESSON_TASKS['garden-anim-l1'], },`, `tasks: G1W_NAT_L1_TASKS, },`],
  [`tasks: RW56_LESSON_TASKS['garden-anim-l3'], },`, `tasks: G1W_NAT_L3_TASKS, },`],
  [`tasks: RW56_LESSON_TASKS['garden-seas-l1'], },`, `tasks: G1W_BDY_L1_TASKS, },`],
  [`tasks: RW56_LESSON_TASKS['garden-seas-l2'], },`, `tasks: G1W_BDY_L2_TASKS, },`],
  [`tasks: RW56_LESSON_TASKS['garden-seas-l3'], },`, `tasks: G1W_BDY_L3_TASKS, },`],
];

const files = { ru: 'ru.json', en: 'en.json', ky: 'ky.json' };
for (const [lng, file] of Object.entries(files)) {
  const p = loc(file);
  const json = JSON.parse(fs.readFileSync(p, 'utf8'));
  for (const [key, vals] of Object.entries(newTaskKeys)) json.data.tasks[key] = vals[lng];
  for (const [section, byLng] of Object.entries(overridesBySection)) {
    for (const [key, val] of Object.entries(byLng[lng] || {})) {
      json.data[section][key] = val;
    }
  }
  fs.writeFileSync(p, JSON.stringify(json, null, 2) + '\n');
  console.log('locale ' + lng + ' ok');
}

const wp = path.join(root, 'src/data/worlds.ts');
let src = fs.readFileSync(wp, 'utf8');
if (!src.includes('g1worldRewrittenTasks')) {
  src = src.replace(
    "} from './g1rusBridgedTasks';",
    `} from './g1rusBridgedTasks';
import {
  G1W_BDY_L1_TASKS,
  G1W_BDY_L2_TASKS,
  G1W_BDY_L3_TASKS,
  G1W_NAT_L1_TASKS,
  G1W_NAT_L3_TASKS,
  G1W_SCH_L3_TASKS,
} from './g1worldRewrittenTasks';`
  );
}

let ok = 0, fail = 0;
for (const [oldS, newS] of worldsEdits) {
  const count = src.split(oldS).length - 1;
  if (count !== 1) {
    console.log('WORLDS FAIL (' + count + '): ' + oldS.slice(0, 100).replace(/\n/g, ' | '));
    fail++;
    continue;
  }
  src = src.replace(oldS, newS);
  ok++;
}
fs.writeFileSync(wp, src);
console.log('worlds.ts ok=' + ok + ' fail=' + fail);

// Ensure g1m-add-l1 t2 (index 2) correct is b
const gp = path.join(root, 'src/data/g1mathBridgedTasks.ts');
let gsrc = fs.readFileSync(gp, 'utf8');
if (!gsrc.includes("setOnlyCorrect(t[2], 'b');\n  setOnlyCorrect(t[3], 'b');")) {
  gsrc = gsrc.replace(
    "setOnlyCorrect(t[1], 'b');\n  setOnlyCorrect(t[3], 'b');",
    "setOnlyCorrect(t[1], 'b');\n  setOnlyCorrect(t[2], 'b');\n  setOnlyCorrect(t[3], 'b');"
  );
  fs.writeFileSync(gp, gsrc);
  console.log('g1mathBridgedTasks patched');
}
console.log('done');
