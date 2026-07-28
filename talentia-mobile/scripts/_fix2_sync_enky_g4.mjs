/**
 * Sync EN/KY (and ABA EN/KY overrides) option/question text for fixed g4 lessons
 * to match RU meaning. Numeric options stay numeric.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const EN = {
  g4m_cm_q1: 'Tali’s bakery works three days in a row: 213 buns each day. Help him: 213 × 3 = ?',
  g4m_cm_q1_a: '609',
  g4m_cm_q1_b: '639',
  g4m_cm_q1_c: '669',
  g4m_cm_q2: 'Each pack has 124 pencils. Tali ordered 4 packs. How many pencils arrive? 124 × 4 = ?',
  g4m_cm_q2_a: '486',
  g4m_cm_q2_b: '496',
  g4m_cm_q2_c: '516',
  g4m_cm_q3: 'Tali sees 312 stars each night. For three nights he wrote “916”. Digit says he is wrong. Find the correct answer: 312 × 3 = ?',
  g4m_cm_q3_a: '916',
  g4m_cm_q3_b: '936',
  g4m_cm_q3_c: '956',
  g4m_cm_q4: 'Check the column example: 221 × 4. Tali already wrote “864”. Is he right?',
  g4m_cm2_q1: 'Tali orders bricks: 1,346 a day × 5 days. Help Tali: 1,346 × 5 = ?',
  g4m_cm2_q1_a: '5,730',
  g4m_cm2_q1_b: '6,730',
  g4m_cm2_q1_c: '7,230',
  g4m_cm2_q2: 'Tali picked 2,417 apples from one orchard. He has three such orchards. How many apples in total? 2,417 × 3 = ?',
  g4m_cm2_q2_a: '7,251',
  g4m_cm2_q2_b: '7,351',
  g4m_cm2_q2_c: '7,451',
  g4m_cm2_q3: 'Tali’s spaceship has 3,208 bolts. For the expedition he needs 6 more ships like this. Bolts needed: 3,208 × 6 = ?',
  g4m_cm2_q3_a: '18,248',
  g4m_cm2_q3_b: '19,248',
  g4m_cm2_q3_c: '20,248',
  g4m_cm2_q4: 'Digit gives Tali an estimate task: 4,135 × 7. Which sign: 4,135 × 7 ○ 29,000?',
  g4m_cm3_q1: 'Tali’s factory: 236 parts per hour × 12 hours. He got “2,732”. Find the correct answer: 236 × 12 = ?',
  g4m_cm3_q1_a: '2,732',
  g4m_cm3_q1_b: '2,832',
  g4m_cm3_q1_c: '3,032',
  g4m_cm3_q2: 'A dinosaur cinema has 345 seats. There were 24 full shows. How many viewers in total? 345 × 24 = ?',
  g4m_cm3_q2_a: '7,280',
  g4m_cm3_q2_b: '8,280',
  g4m_cm3_q2_c: '9,280',
  g4m_cm3_q3: 'Tali’s ship travels 418 km a day. In 13 days of the expedition it will cover… 418 × 13 = ?',
  g4m_cm3_q3_a: '5,034',
  g4m_cm3_q3_b: '5,434',
  g4m_cm3_q3_c: '5,834',
  g4m_cm3_q4: 'How many partial products appear in the column when multiplying 527 × 15?',
  g4m_fr_q1: 'Tali cut a pizza into 4 equal parts and ate one. What fraction of the pizza did he eat?',
  g4m_fr_q1_a: '1/4',
  g4m_fr_q1_b: '1/3',
  g4m_fr_q1_c: '4/1',
  g4m_fr_q2: 'Digit shaded 3 parts out of 8 and wrote “8/3”. Tali is right — that is wrong. How should the shaded part be written?',
  g4m_fr_q2_a: '3/8',
  g4m_fr_q2_b: '8/3',
  g4m_fr_q2_c: '3/11',
  g4m_fr_q3: 'Tali mixed up numerator and denominator. What does the denominator (bottom number) show?',
  g4m_fr_q3_a: 'How many equal parts the whole is divided into',
  g4m_fr_q3_b: 'How many parts were taken',
  g4m_fr_q3_c: 'How many wholes are left',
  g4m_fr_q4: 'Tali took 1 piece of a chocolate bar broken into 6 equal pieces. Is it true that he took 1/6 of the bar?',
  g4m_fr2_q1: 'Tali cut an apple into 4 parts and wrote “One part is 4/1”. How should one part out of four be written?',
  g4m_fr2_q1_a: '1/4',
  g4m_fr2_q1_b: '4/1',
  g4m_fr2_q1_c: '1/2',
  g4m_fr2_q2: 'Digit shaded 3 cells out of 9. Which fraction shows the shaded part?',
  g4m_fr2_q2_a: '3/9',
  g4m_fr2_q2_b: '9/3',
  g4m_fr2_q2_c: '1/3',
  g4m_fr2_q3: 'Tali took half a cake (1/2), Digit took two of four equal parts (2/4). Who got more cake?',
  g4m_fr2_q3_a: 'Tali got more',
  g4m_fr2_q3_b: 'They got the same — equal fractions',
  g4m_fr2_q3_c: 'Digit got more',
  g4m_fr2_q4: 'A circle is divided into 5 equal sectors. How many such sectors are needed to make the whole circle?',
  g4m_fr3_q1: 'Tali took 3/8 of a pizza, his friend took 5/8 of the same pizza. Who actually took more?',
  g4m_fr3_q1_a: 'Tali’s friend took more (5/8 > 3/8)',
  g4m_fr3_q1_b: 'Tali took more',
  g4m_fr3_q1_c: 'They took the same',
  g4m_fr3_q2: 'Digit wrote: 2/5 ○ 4/5. Which sign belongs there?',
  g4m_fr3_q2_a: '< (less)',
  g4m_fr3_q2_b: '> (greater)',
  g4m_fr3_q2_c: '= (equal)',
  g4m_fr3_q3: 'Put these fractions in order from smallest to largest: 1/4, 3/4, 2/4.',
  g4m_fr3_q3_a: '1/4, 2/4, 3/4',
  g4m_fr3_q3_b: '1/4, 3/4, 2/4',
  g4m_fr3_q3_c: '3/4, 2/4, 1/4',
  g4m_fr3_q4: 'Tali and Digit compare 3/4 and 3/7. Numerators are the same. Tali says the fractions are equal. Who is right?',
  g4e_pres2_q1: 'Tali wrote: “The cat not eats fish — only milk!” Spark says you need doesn’t. Fix Tali!',
  g4e_pres2_q1_a: 'The cat not eats fish',
  g4e_pres2_q1_b: "The cat doesn't eat fish",
  g4e_pres2_q1_c: 'The cat not eat fish',
  g4e_pres2_q2: '“He plays football.” → “He ___ football.” Which negative form is correct?',
  g4e_pres2_q2_a: "don't play",
  g4e_pres2_q2_b: "doesn't play",
  g4e_pres2_q2_c: 'not plays',
  g4e_pres2_q3: 'Tali wrote: “She don’t like cold weather.” Spark says: “With she you need…”',
  g4e_pres2_q3_a: "don't like (leave as is)",
  g4e_pres2_q3_b: "doesn't like",
  g4e_pres2_q3_c: 'not like',
  g4e_pres2_q4: '“They watch TV in the evening.” → Make it negative.',
  g4s_emo3_q1: 'Wide-open eyes and a slightly open mouth after a surprise — signs of which emotion?',
  g4s_emo3_q1_a: 'Surprise',
  g4s_emo3_q1_b: 'Anger',
  g4s_emo3_q1_c: 'Indifference',
  g4s_emo3_q2: 'What do people call “calm”?',
  g4s_emo3_q2_a: 'A steady, even inner state',
  g4s_emo3_q2_b: 'Feeling sleepy all the time',
  g4s_emo3_q2_c: 'Only the feeling of hunger',
  g4s_emo3_q3: 'In the middle of a talk Tali went quiet and started breathing deeply. Friendly asks: “What is he doing?” Tali says: “He wants to fall asleep!” Correct Tali.',
  g4s_emo3_q3_a: 'Yes, he’s falling asleep',
  g4s_emo3_q3_b: 'No — he’s trying to calm down and gather his thoughts',
  g4s_emo3_q3_c: 'No — he’s running away from the conversation',
  g4s_emo3_q4: 'Surprise can be pleasant or unpleasant. An example of each:',
  g4s_turn3_q1: 'Tali notices a player peeking at the cards. He wants to shout. Friendly stops him. What is better to do?',
  g4s_turn3_q1_a: 'Shout and flip the game over',
  g4s_turn3_q1_b: 'Stay silent and endure',
  g4s_turn3_q1_c: 'Calmly say: “Let’s follow the rules”',
  g4s_turn3_q2: 'Why do games need rules at all?',
  g4s_turn3_q2_a: 'So that someone must lose',
  g4s_turn3_q2_b: 'So the game is fair and fun for everyone',
  g4s_turn3_q2_c: 'So that nobody has fun',
  g4s_turn3_q3: 'Tali lost at chess and feels upset. Which reaction is respectful?',
  g4s_turn3_q3_a: 'Knock the pieces off the board',
  g4s_turn3_q3_b: 'Stay silent and sulk all day',
  g4s_turn3_q3_c: 'Shake the winner’s hand and ask what can be improved',
  g4s_turn3_q4: 'Tali wants a new rule for a known game to make it fairer. Friendly asks: “Where to start?” Tali says: “Just announce the new rule!” Why does Friendly disagree?',
};

const KY = {
  g4m_cm_q1: 'Талинин наабайканасы үч күн иштейт: ар бир күнү 213 булочка. Жардам бер: 213 × 3 = ?',
  g4m_cm_q1_a: '609',
  g4m_cm_q1_b: '639',
  g4m_cm_q1_c: '669',
  g4m_cm_q2: 'Ар бир пакетте 124 карандаш бар. Тали 4 пакетке заказ берди. Канча карандаш келет? 124 × 4 = ?',
  g4m_cm_q2_a: '486',
  g4m_cm_q2_b: '496',
  g4m_cm_q2_c: '516',
  g4m_cm_q3: 'Тали ар бир түнү 312 жылдыз көрөт. Үч түн үчүн ал «916» деп жазды. Digit анын катасын айтат. Туура жоопту тап: 312 × 3 = ?',
  g4m_cm_q3_a: '916',
  g4m_cm_q3_b: '936',
  g4m_cm_q3_c: '956',
  g4m_cm_q4: 'Мамычадагы мисалды текшер: 221 × 4. Тали «864» деп жазды. Туурабы?',
  g4m_cm2_q1: 'Тали кирпич заказ кылат: күнүнө 1 346 × 5 күн. Жардам бер: 1 346 × 5 = ?',
  g4m_cm2_q1_a: '5 730',
  g4m_cm2_q1_b: '6 730',
  g4m_cm2_q1_c: '7 230',
  g4m_cm2_q2: 'Тали бир бакчадан 2 417 алма жыйнады. Анын үч ушундай бакчасы бар. Жалпы канча алма? 2 417 × 3 = ?',
  g4m_cm2_q2_a: '7 251',
  g4m_cm2_q2_b: '7 351',
  g4m_cm2_q2_c: '7 451',
  g4m_cm2_q3: 'Талинин космос кемесинде 3 208 болт бар. Экспедиция үчүн дагы 6 ушундай кеме керек. Болт: 3 208 × 6 = ?',
  g4m_cm2_q3_a: '18 248',
  g4m_cm2_q3_b: '19 248',
  g4m_cm2_q3_c: '20 248',
  g4m_cm2_q4: 'Digit Талиге баалоо тапшырмасын берет: 4 135 × 7. Кайсы белги: 4 135 × 7 ○ 29 000?',
  g4m_cm3_q1: 'Талинин заводу: саатына 236 деталь × 12 саат. Ал «2 732» деп эсептеди. Туура жооп: 236 × 12 = ?',
  g4m_cm3_q1_a: '2 732',
  g4m_cm3_q1_b: '2 832',
  g4m_cm3_q1_c: '3 032',
  g4m_cm3_q2: 'Динозавр кинотеатрында 345 орун бар. 24 толук сеанс өттү. Жалпы канча көрүүчү? 345 × 24 = ?',
  g4m_cm3_q2_a: '7 280',
  g4m_cm3_q2_b: '8 280',
  g4m_cm3_q2_c: '9 280',
  g4m_cm3_q3: 'Талинин кемеси суткасына 418 км жүрөт. 13 күндө ал ... 418 × 13 = ?',
  g4m_cm3_q3_a: '5 034',
  g4m_cm3_q3_b: '5 434',
  g4m_cm3_q3_c: '5 834',
  g4m_cm3_q4: '527 × 15 мамычада канча аралык көбөйтүндү болот?',
  g4m_fr_q1: 'Тали пиццаны 4 тең бөлүккө бөлүп, бирөөнү жеди. Пиццанын кайсы бөлчөгүн жеди?',
  g4m_fr_q1_a: '1/4',
  g4m_fr_q1_b: '1/3',
  g4m_fr_q1_c: '4/1',
  g4m_fr_q2: 'Digit 8 бөлүктүн 3үн боёп, «8/3» деп жазды. Тали туура — бул ката. Боёлгон бөлүктү кантип туура жазуу керек?',
  g4m_fr_q2_a: '3/8',
  g4m_fr_q2_b: '8/3',
  g4m_fr_q2_c: '3/11',
  g4m_fr_q3: 'Тали санагыч менен бөлүүчүнү алмаштырып жиберди. Бөлүүчү (төмөнкү сан) эмнени көрсөтөт?',
  g4m_fr_q3_a: 'Бүтүндүн канча тең бөлүккө бөлүнгөнүн',
  g4m_fr_q3_b: 'Канча бөлүк алынганын',
  g4m_fr_q3_c: 'Канча бүтүн калганын',
  g4m_fr_q4: 'Тали 6 тең бөлүккө бөлүнгөн шоколаддан 1 бөлүк алды. Ал 1/6 алды деген туурабы?',
  g4m_fr2_q1: 'Тали алманы 4 бөлүккө бөлүп, «Бир бөлүк — бул 4/1» деп жазды. Төрттөн бирди кантип туура жазуу керек?',
  g4m_fr2_q1_a: '1/4',
  g4m_fr2_q1_b: '4/1',
  g4m_fr2_q1_c: '1/2',
  g4m_fr2_q2: 'Digit тик бурчтукта 9 клетканын 3үн боёду. Боёлгон бөлүктү кайсы бөлчөк көрсөтөт?',
  g4m_fr2_q2_a: '3/9',
  g4m_fr2_q2_b: '9/3',
  g4m_fr2_q2_c: '1/3',
  g4m_fr2_q3: 'Тали тортту жарымына бөлдү (1/2), Digit ошондой торттун төрт бөлүгүнүн экөөнү алды (2/4). Ким көбүрөөк алды?',
  g4m_fr2_q3_a: 'Тали көбүрөөк алды',
  g4m_fr2_q3_b: 'Алар тең алды — бул барабар бөлчөктөр',
  g4m_fr2_q3_c: 'Digit көбүрөөк алды',
  g4m_fr2_q4: 'Тегерек 5 тең секторго бөлүнгөн. Бүтүн тегеректи чогултуу үчүн канча сектор керек?',
  g4m_fr3_q1: 'Тали пиццанын 3/8ин алды, досу ошол пиццанын 5/8ин алды. Чындыгында ким көбүрөөк алды?',
  g4m_fr3_q1_a: 'Талинин досу көбүрөөк алды (5/8 > 3/8)',
  g4m_fr3_q1_b: 'Тали көбүрөөк алды',
  g4m_fr3_q1_c: 'Алар тең алды',
  g4m_fr3_q2: 'Digit жазды: 2/5 ○ 4/5. Кайсы белги керек?',
  g4m_fr3_q2_a: '< (кичине)',
  g4m_fr3_q2_b: '> (чоң)',
  g4m_fr3_q2_c: '= (тең)',
  g4m_fr3_q3: 'Бул бөлчөктөрдү кичинесинен чоңуна карай иретте: 1/4, 3/4, 2/4.',
  g4m_fr3_q3_a: '1/4, 2/4, 3/4',
  g4m_fr3_q3_b: '1/4, 3/4, 2/4',
  g4m_fr3_q3_c: '3/4, 2/4, 1/4',
  g4m_fr3_q4: 'Тали менен Digit 3/4 жана 3/7ни салыштырышат. Санагычтар бирдей. Тали бөлчөктөр тең дейт. Ким туура?',
  g4e_pres2_q1: 'Тали жазды: “The cat not eats fish — only milk!” Spark doesn’t керек дейт. Талини оңдо!',
  g4e_pres2_q1_a: 'The cat not eats fish',
  g4e_pres2_q1_b: "The cat doesn't eat fish",
  g4e_pres2_q1_c: 'The cat not eat fish',
  g4e_pres2_q2: '“He plays football.” → “He ___ football.” Кайсы терс форма туура?',
  g4e_pres2_q2_a: "don't play",
  g4e_pres2_q2_b: "doesn't play",
  g4e_pres2_q2_c: 'not plays',
  g4e_pres2_q3: 'Тали жазды: “She don’t like cold weather.” Spark: “she менен ... керек”',
  g4e_pres2_q3_a: "don't like (калтыр)",
  g4e_pres2_q3_b: "doesn't like",
  g4e_pres2_q3_c: 'not like',
  g4e_pres2_q4: '“They watch TV in the evening.” → Терс кылып жаз.',
  g4s_emo3_q1: 'Сюрпризден кийин кең ачылган көздөр жана ачык ооз — кайсы эмоциянын белгиси?',
  g4s_emo3_q1_a: 'Таң калуу',
  g4s_emo3_q1_b: 'Ачуулануу',
  g4s_emo3_q1_c: 'Кайдыгерлик',
  g4s_emo3_q2: '«Тынчтык» деп эмнени айтышат?',
  g4s_emo3_q2_a: 'Туруктуу, тең ички абал',
  g4s_emo3_q2_b: 'Ар дайым уйкусуроо',
  g4s_emo3_q2_c: 'Жалгыз гана ачкачылык сезими',
  g4s_emo3_q3: 'Тали сүйлөшүүнүн ортосунда үнсүз калып, терең дем ала баштады. Friendly: «Ал эмне кылып жатат?» Тали: «Уктагысы келет!» Талини оңдо.',
  g4s_emo3_q3_a: 'Ооба, ал уктап жатат',
  g4s_emo3_q3_b: 'Жок — ал тынчтанып, ойлорун чогултууга аракет кылууда',
  g4s_emo3_q3_c: 'Жок — ал сүйлөшүүдөн качып жатат',
  g4s_emo3_q4: 'Таң калуу жагымдуу же жагымсыз болушу мүмкүн. Ар бирине мисал:',
  g4s_turn3_q1: 'Тали оюнчу карталарга камылгандыгын байкайт. Ал кыйкыргысы келет. Friendly аны токтотот. Эмне кылуу жакшы?',
  g4s_turn3_q1_a: 'Кыйкырып, оюнду оодарып салуу',
  g4s_turn3_q1_b: 'Үнсүз чыдоо',
  g4s_turn3_q1_c: 'Тынч айтуу: «Келиңиздер, эрежелерди сактайлы»',
  g4s_turn3_q2: 'Оюндарда эрежелер эмне үчүн керек?',
  g4s_turn3_q2_a: 'Кимдир бирөө сөзсүз утулушу үчүн',
  g4s_turn3_q2_b: 'Оюн бардык үчүн адилет жана кызыктуу болушу үчүн',
  g4s_turn3_q2_c: 'Эч кимге кызык болбошу үчүн',
  g4s_turn3_q3: 'Тали шахматта утулуп, катуу капа болду. Кайсы реакция сыйлуу?',
  g4s_turn3_q3_a: 'Фигураларды тактадан шыпырып түшүрүү',
  g4s_turn3_q3_b: 'Бүт күн үнсүз тууралоо',
  g4s_turn3_q3_c: 'Жеңүүчүнүн колун кысып, эмнени жакшыртса болорун суроо',
  g4s_turn3_q4: 'Тали белгилүү оюнга жаңы эреже сунуштайт. Friendly: «Эмнеден баштоо керек?» Тали: «Жөн эле жаңы эрежени жарыяла!» Эмне үчүн Friendly макул эмес?',
};

function patchLocaleJson(file, map) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  let n = 0;
  for (const [k, v] of Object.entries(map)) {
    if (data.data?.tasks?.[k] !== undefined) {
      data.data.tasks[k] = v;
      n++;
    } else {
      console.warn('missing in', path.basename(file), k);
    }
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  return n;
}

function patchAba(file, map) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  let n = 0;
  for (const [k, v] of Object.entries(map)) {
    const full = `data.tasks.${k}`;
    if (data[full] !== undefined) {
      data[full] = v;
      n++;
    }
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  return n;
}

const enN = patchLocaleJson(path.join(root, 'src/i18n/locales/en.json'), EN);
const kyN = patchLocaleJson(path.join(root, 'src/i18n/locales/ky.json'), KY);
const abaEn = patchAba(path.join(root, 'src/i18n/locales/abaTextOverrides.en.generated.json'), EN);
const abaKy = patchAba(path.join(root, 'src/i18n/locales/abaTextOverrides.ky.generated.json'), KY);

// Also clean RU emotional distractor tail
const ruPath = path.join(root, 'src/i18n/locales/ru.json');
const ru = JSON.parse(fs.readFileSync(ruPath, 'utf8'));
if (ru.data.tasks.g4m_cm2_q3_c === '20 248 — вот это да!') {
  ru.data.tasks.g4m_cm2_q3_c = '20 248';
  fs.writeFileSync(ruPath, JSON.stringify(ru, null, 2) + '\n');
  console.log('cleaned RU g4m_cm2_q3_c');
}
const abaRuPath = path.join(root, 'src/i18n/locales/abaTextOverrides.generated.json');
const abaRu = JSON.parse(fs.readFileSync(abaRuPath, 'utf8'));
if (abaRu['data.tasks.g4m_cm2_q3_c']?.includes('вот это да')) {
  abaRu['data.tasks.g4m_cm2_q3_c'] = '20 248';
  fs.writeFileSync(abaRuPath, JSON.stringify(abaRu, null, 2) + '\n');
  console.log('cleaned ABA RU g4m_cm2_q3_c');
}

console.log({ enN, kyN, abaEn, abaKy });
