/**
 * Scope A pass 2: remaining EN stubs/mismatches + KY question ru-leaks.
 * Does not touch numeric ky=ru or Russian wordform answer-targets in RU lessons.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

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

const touched = { tasks: new Set(), dialog: new Set(), intro: new Set() };

function set(sec, lang, key, value) {
  const doc = lang === 'en' ? en : ky;
  if (doc.data[sec][key] === value) return;
  doc.data[sec][key] = value;
  touched[sec].add(key);
}
const setTask = (lang, key, value) => set('tasks', lang, key, value);
const setDialog = (lang, key, value) => set('dialog', lang, key, value);
const setIntro = (lang, key, value) => set('intro', lang, key, value);

/* ========== Phase 1 finish: KY dialogs for soft/hard ========== */
setDialog(
  'ky',
  'g2r_shl1_0',
  'Салам! Мен Машамын! Тали, сага катуу жана жумшак үнсүздөрдү үйрөткүм келет — бирок кээ бир сөздөрдө өзүм чаташам. Жардам бересиңби?',
);
setDialog(
  'ky',
  'g2r_shl1_1',
  'Албетте! Чындыгында мен «катуу» дегенди тамга таштан жасалган деп ойлогом. Ошентпейт экенби? Айтчы!',
);
setDialog(
  'ky',
  'g2r_shl2_0',
  'Маша, мен жазууга «КОН» деп жаздым. Маша күлүп, туура эмес деп жатат. Эмне туура эмес?',
);
setDialog(
  'ky',
  'g2r_shl2_1',
  'Тали, бул жерде жумшак белги керек! Ансыз «конь» башка нерсеге айланат. Досубузга түшүндүрөлүбү?',
);

/* ========== g2r-sh-l2 opts truncated ========== */
setTask('en', 'g2r_opt_softens', 'Softens the previous consonant');
setTask('en', 'g2r_opt_hardens', 'Makes the consonant hard');
setTask('en', 'g2r_opt_no_role', 'Does nothing');
setTask('ky', 'g2r_opt_softens', 'Мурунку үнсүздү жумшартат');
setTask('ky', 'g2r_opt_hardens', 'Үнсүздү катуу кылат');
setTask('ky', 'g2r_opt_no_role', 'Эч нерсе кылбайт');
setTask('en', 'g2r_opt_kon', 'КОН');
setTask('en', 'g2r_opt_konj', 'КОНЬ');
setTask('ky', 'g2r_opt_kon', 'КОН');
setTask('ky', 'g2r_opt_konj', 'КОНЬ');

/* ========== g2r-sh-l3 syllable EN + KY Q ========== */
setTask(
  'en',
  'g2r_lu_is_hard',
  'Tali reads: ЛУЖА. In the syllable ЛУ, is Л soft or hard?',
);
setTask(
  'en',
  'g2r_le_is_what',
  'Masha wrote: ЛЕТО. Does the syllable ЛЕ make Л soft or hard?',
);
setTask(
  'en',
  'g2r_la_is_what',
  'Tali reads ЛАМПА. In the syllable ЛА, is Л soft or hard?',
);
setTask('ky', 'g2r_le_is_what', 'Маша жазды: ЛЕТО. ЛЕ мууну Л тыбышын жумшакпы же катуубу кылат?');
setTask('ky', 'g2r_la_is_what', 'Тали ЛАМПАны окуйт. ЛА муунунда Л кандай — жумшакпы же катуубу?');
setDialog(
  'en',
  'g2r_shl3_0',
  'Masha, I read the word ЛИМОН and my tongue got tied in a knot! Is Л soft or hard here?',
);
setDialog(
  'en',
  'g2r_shl3_1',
  'Great question! In lemon, lion, people — Л is soft. But in ЛАМПА it’s hard. Can you feel the difference?',
);
setDialog(
  'ky',
  'g2r_shl3_0',
  'Маша, мен ЛИМОН сөзүн окуп, тилим түйүлүп калды! Бул жерде Л жумшакпы же катуубу?',
);
setDialog(
  'ky',
  'g2r_shl3_1',
  'Сонун суроо! Лимон, арстан, адамдар — бул жерде Л жумшак. Ал эми ЛАМПАда — катуу. Айырманы сезесиңби?',
);

/* ========== Math g2 dialogs + questions ========== */
setDialog(
  'en',
  'g2m_100l1_0',
  'Hi! I’m eagle Archie! I can count to a hundred, but today I’m mixed up about tens — can you help me figure it out?',
);
setDialog(
  'en',
  'g2m_100l1_1',
  'I’m a bit confused too! Archie, let’s ask our friend together. He definitely knows how to count by tens!',
);
setDialog(
  'ky',
  'g2m_100l1_0',
  'Салам! Мен бүркүт Арчимин! Жүзгө чейин санай алам, бирок бүгүн ондуктарда чаташтым — түшүнүүгө жардам бересиңби?',
);
setDialog(
  'ky',
  'g2m_100l1_1',
  'Мен да бир аз чаташам! Арчи, досубузга чогуу сурайлы. Ал ондоп саноону так билет!',
);
setIntro('ky', 'g2m_100l1_0_t', 'Ондуктар саноону жеңилдетет!');
setIntro('ky', 'g2m_100l1_1_t', 'Жүз — бул он ондук');
setIntro('ky', 'g2m_100l1_1_b', '100 — бул 10 × 10. Бул жүз — маанилүү сан!');

setTask(
  'en',
  'g2m_10x3',
  'Tali tries to help Archie: “Three boxes of 10 feathers — is that… 30? Or 13?” Tali is confused! Who is right?',
);
setTask(
  'ky',
  'g2m_10x3',
  'Тали Арчиге жардам берүүгө аракет кылат: «Үч кутуда ар биринде 10 жүн — бул… 30бу? Же 13пү?» Тали чаташты! Ким туура?',
);

// Need more 100-l1 task keys
const m100l1Keys = ['g2m_7x10', 'g2m_70_mice', 'g2m_archi_7stacks', 'g2m_100_is_tens', 'g2m_100_five_tens'];
for (const k of Object.keys(ru.data.tasks)) {
  if (
    (k.includes('100l1') || k.includes('7stog') || k.includes('five_tens') || k.includes('10_mice') || k === 'g2m_7x10') &&
    !m100l1Keys.includes(k)
  ) {
    /* collect below via dump */
  }
}

setDialog(
  'en',
  'g2m_100l3_0',
  'Now I want to learn to compare big numbers. Tali, you have 82 shells and I have 78 feathers. Who collected more?',
);
setDialog(
  'en',
  'g2m_100l3_1',
  'I think I did! But wait — let’s ask our friend to be sure. I feel a bit mixed up…',
);
setDialog(
  'ky',
  'g2m_100l3_0',
  'Эми мен чоң сандарды салыштырууну үйрөнгүм келет. Тали, сенде 82 кабыкча бар, менде 78 жүн. Кимибиз көбүрөөк чогултту?',
);
setDialog(
  'ky',
  'g2m_100l3_1',
  'Менимче мен! Бирок күт — так болуу үчүн досубузга сурайлы. Бир аз чаташкандаймын…',
);
setIntro('en', 'g2m_100l3_0_t', 'Comparing numbers up to 100!');
setIntro('ky', 'g2m_100l3_0_t', '100гө чейинки сандарды салыштырабыз!');
setIntro('ky', 'g2m_100l3_1_t', 'Сен эң жакшы!');
setIntro(
  'ky',
  'g2m_100l3_1_b',
  'Сен 100гө чейин санайсың жана разряддарды түшүнөсүң. Жарайсың!',
);

setTask(
  'en',
  'g2m_before_100',
  'Archie flies toward the biggest two-digit number. It stands right before 100. What number is that?',
);
setTask(
  'ky',
  'g2m_before_100',
  'Арчи эң чоң эки орундуу санга учат. Ал 100дүн алдында турат. Бул кайсы сан?',
);
setTask(
  'en',
  'g2m_smallest_78_82_91',
  'Tali found 82 shells, Archie — 78 feathers. Tali says “I found more!” Archie doesn’t believe him. Who is right?',
);
setTask(
  'ky',
  'g2m_smallest_78_82_91',
  'Тали 82 кабыкча тапты, Арчи — 78 жүн. Тали «мен көбүрөөк таптым!» дейт, Арчи ишенбейт. Ким туура?',
);
setTask(
  'en',
  'g2m_num_5tens_6units',
  'Tali wrote a number: “five tens and six ones.” What number is that?',
);
setTask(
  'ky',
  'g2m_num_5tens_6units',
  'Тали санды жазды: «беш ондук жана алты бирдик». Бул кайсы сан?',
);

setDialog(
  'en',
  'g2m_add2l1_0',
  'Archie, I need help! I want to buy 20 bananas and 30 more coconuts. Is that 50 pieces? Or 23? I’m totally mixed up with the zeros!',
);
setDialog(
  'en',
  'g2m_add2l1_1',
  'Hmm, it’s hard for me too! Let’s figure it out together — we have a smart friend!',
);
setDialog(
  'ky',
  'g2m_add2l1_0',
  'Арчи, мага жардам керек! Мен 20 банан жана дагы 30 кокос алгым келет. Бул 50бү? Же 23пү? Нөлдөр менен толук чаташтым!',
);
setDialog(
  'ky',
  'g2m_add2l1_1',
  'Хм, мага да кыйын! Чогуу түшүнөлу — бизде акылдуу дос бар!',
);
setIntro('ky', 'g2m_add2l1_0_t', 'Ондуктарды кошолу!');
setTask(
  'en',
  'g2m_20plus30',
  'Tali buys 20 bananas and 30 coconuts. He says: “That’s 23 pieces!” No, Tali! Count correctly: 20 + 30 = ?',
);
setTask(
  'ky',
  'g2m_20plus30',
  'Тали 20 банан жана 30 кокос алат. Ал: «Бул 23 даана!» дейт. Жок, Тали! Туура сана: 20 + 30 = ?',
);
setTask(
  'en',
  'g2m_30plus_eq100',
  'Archie flew 30 km in the morning and some more in the evening. Altogether it was 100 km. How far did he fly in the evening?',
);
setTask(
  'ky',
  'g2m_30plus_eq100',
  'Арчи эртең менен 30 км учуп, кечинде дагы учкан. Жалпысынан 100 км болду. Кечинде канча учкан?',
);

setDialog(
  'en',
  'g2m_add2l3_0',
  'I had 65 shells. I gave 23 to Archie as a gift. Archie says I have 48 left. I think it’s 42. Who is right?!',
);
setDialog(
  'en',
  'g2m_add2l3_1',
  'I think I’m right! But let’s still check with our friend…',
);
setDialog(
  'ky',
  'g2m_add2l3_0',
  'Менде 65 кабыкча бар эле. Арчиге белекке 23үн бердим. Арчи менде 48 калды дейт. Мен 42 деп ойлойм. Ким туура?!',
);
setDialog(
  'ky',
  'g2m_add2l3_1',
  'Менимче мен туурамын! Бирок дагы деле досубуз менен текшерели…',
);
setTask(
  'en',
  'g2m_sub_65minus23',
  '65 − 23 = ? (Is Tali right?)',
);
setTask(
  'en',
  'g2m_word_apples_30_give_13',
  'There were 30 apples; Tali gave 13 to Archie. How many are left?',
);
setTask(
  'ky',
  'g2m_word_apples_30_give_13',
  '30 алма бар эле, Тали Арчиге 13үн берди. Канчасы калды?',
);
// t4 key is misleading name but answer 53 for 91-38 — leave formula as-is (already synced)

setDialog(
  'en',
  'g2m_timesl1_0',
  'Archie, I bought 4 pairs of socks (yes, dinosaurs wear socks!). How many socks is that? I think 6? No, 4+4=8? Help!',
);
setDialog(
  'en',
  'g2m_timesl1_1',
  'Multiplying by 2 is doubling! Four pairs is 4 × 2. Let’s count together with our friend!',
);
setDialog(
  'ky',
  'g2m_timesl1_0',
  'Арчи, мен 4 жуп байпак алдым (ооба, динозаврлар байпак кийет!). Бул канча байпак? Менимче 6бы? Жок, 4+4=8би? Жардам бер!',
);
setDialog(
  'ky',
  'g2m_timesl1_1',
  '2ге көбөйтүү — эки эсе кылуу! Төрт жуп — бул 4 × 2. Досубуз менен чогуу санайлы!',
);
setTask(
  'en',
  'g2m_2x4',
  'Tali bought 4 pairs of socks. 2 × 4 = ? How many socks in total?',
);
setTask(
  'ky',
  'g2m_2x4',
  'Тали 4 жуп байпак алды. 2 × 4 = ? Жалпы канча байпак?',
);

setDialog(
  'en',
  'g2m_timesl2_0',
  'I noticed something cool: answers when multiplying by 5 always end in 0 or 5! Is that true or did I make it up?',
);
setDialog(
  'en',
  'g2m_timesl2_1',
  'Hmm, interesting! Let’s check on the tasks — maybe Tali discovered a great math secret!',
);
setDialog(
  'ky',
  'g2m_timesl2_0',
  'Мен сонун нерсе байкадым: 5ке көбөйтүүдө жооп ар дайым 0 же 5 менен бүтөт! Бул чынбы же мен ойлоп таптымбы?',
);
setDialog(
  'ky',
  'g2m_timesl2_1',
  'Хм, кызык! Тапшырмаларда текшерели — балким Тали чоң математикалык сырды ачкандыр!',
);
setIntro(
  'en',
  'g2m_timesl2_0_b',
  '5 × 2 = 10, 5 × 3 = 15, 5 × 4 = 20. Tali is right — the answer always ends in 0 or 5! A real times-table secret.',
);
setIntro(
  'en',
  'g2m_timesl2_1_b',
  '5 × 6 = 30, 5 × 7 = 35. Check: last digit 0 or 5 — then it’s correct!',
);
setIntro(
  'ky',
  'g2m_timesl2_0_b',
  '5 × 2 = 10, 5 × 3 = 15, 5 × 4 = 20. Тали туура — жооп ар дайым 0 же 5 менен бүтөт! Чыныгы таблица сыры.',
);
setIntro(
  'ky',
  'g2m_timesl2_1_b',
  '5 × 6 = 30, 5 × 7 = 35. Текшер: акыркы цифра 0 же 5 — демек туура!',
);

setTask(
  'en',
  'g2m_3x7',
  '3 × 7 = ? (How many coins does Tali have?)',
);
setTask(
  'en',
  'g2m_3x4',
  'Tali has three pockets with 4 coins each. 3 × 4 = ?',
);
setTask(
  'ky',
  'g2m_3x7',
  '3 × 7 = ? (Талинин канча тыйыны бар?)',
);
setTask(
  'ky',
  'g2m_3x4',
  'Талинин үч чөнтөгүндө ар биринде 4 тыйын. 3 × 4 = ?',
);
setTask(
  'en',
  'g2m_3x8_check',
  'Archie counts: “3 × 8 = 24!” — Tali says: “No, 26!” Who is right?',
);
setTask(
  'ky',
  'g2m_3x8_check',
  'Арчи санайт: «3 × 8 = 24!» — Тали: «Жок, 26!» дейт. Ким туура?',
);

/* ========== Eng school / phrases ========== */
setTask('en', 'g2e_board_en', 'Board (classroom) in English:');
setDialog(
  'en',
  'g2e_schl1_0',
  'Polly, I want to describe our classroom in English, but I don’t know the words! What is a desk?',
);
setDialog(
  'en',
  'g2e_schl1_1',
  'Desk — парта! Chair — стул, board — доска, book — книга. Remember — I’ll help!',
);
setDialog(
  'ky',
  'g2e_schl1_0',
  'Поли, мен классыбызды англисче сүрөттөгүм келет, бирок сөздөрдү билбейм! Desk деген эмне?',
);
setDialog(
  'ky',
  'g2e_schl1_1',
  'Desk — парта! Chair — отургуч, board — такта, book — китеп. Эстеп кал — мен жардам берем!',
);
setIntro('en', 'g2e_schl1_1_b', 'Classroom — класс. School — школа. That’s our world in English!');
setIntro('ky', 'g2e_schl1_1_b', 'Classroom — класс. School — мектеп. Бул биздин дүйнө англисче!');

setDialog(
  'en',
  'g2e_phrl1_0',
  'Please and Thank you are the most important words! Tali, do you know them?',
);
setDialog(
  'en',
  'g2e_phrl1_1',
  'Please — пожалуйста! Thank you — спасибо! But I sometimes mix up when to say which. Help me!',
);
setDialog(
  'ky',
  'g2e_phrl1_0',
  'Please жана Thank you — эң маанилүү сөздөр! Тали, сен билесиңби?',
);
setDialog(
  'ky',
  'g2e_phrl1_1',
  'Please — сураныч! Thank you — рахмат! Бирок качан кайсыны айтууну кээде чаташтырам. Жардам бер!',
);
setIntro(
  'en',
  'g2e_phrl1_1_b',
  'Polite words matter in any language!',
);
setIntro('ky', 'g2e_phrl1_1_b', 'Сылык сөздөр кайсы тилде болбосун маанилүү!');
// RU answer targets stay Спасибо/Пожалуйста for phr opts (intentional)

/* ========== Food tautology already done; daily dialog ========== */
setDialog(
  'en',
  'g3e_dailyl3_0',
  'I always eat breakfast. I never wake up early. I sometimes do homework. Are these frequency adverbs?',
);
setDialog(
  'en',
  'g3e_dailyl3_1',
  'Exactly! Always — всегда, usually — обычно, sometimes — иногда, never — никогда. Tali, you already know them!',
);
setDialog(
  'ky',
  'g3e_dailyl3_0',
  'I always eat breakfast. I never wake up early. I sometimes do homework. Бул жыштык тактоочторубу?',
);
setDialog(
  'ky',
  'g3e_dailyl3_1',
  'Так ошондой! Always — ар дайым, usually — адатта, sometimes — кээде, never — эч качан. Тали, сен буларды билесиң!',
);

/* ========== g3m-1000 ========== */
setDialog(
  'en',
  'g3m_1000l1_0',
  'I want to count how many scales the dragon in the picture has! Clearly more than a hundred… maybe a thousand?',
);
setDialog(
  'en',
  'g3m_1000l1_1',
  'A thousand is a huge number! But together we’ll figure it out: 100, 200, 300… heading to a thousand!',
);
setDialog(
  'ky',
  'g3m_1000l1_0',
  'Сүрөттөгү ажыдаардын канча кабырчыгы бар экенин санагым келет! Ачык жүздөн көп… балким миңби?',
);
setDialog(
  'ky',
  'g3m_1000l1_1',
  'Миң — абдан чоң сан! Бирок чогуу түшүнөбүз: 100, 200, 300… миңге барабыз!',
);
setIntro('ky', 'g3m_1000l1_0_t', '1000гө чейинки сандар!');
setIntro(
  'ky',
  'g3m_1000l1_0_b',
  'Жүздүктөр: 100, 200, 300… 1000 — миң. Үч орундуу санда жүздүк разряды бар: 347 = 3 жүздүк + 4 ондук + 7 бирдик.',
);
setIntro('ky', 'g3m_1000l1_1_t', 'Сандагы үч разряд');
setTask(
  'en',
  'g3m_3hundreds',
  'Tali counts scales in blocks of 100. He has 3 blocks. How many scales?',
);
setTask(
  'ky',
  'g3m_3hundreds',
  'Тали кабырчыктарды 100дөн турган блок менен санайт. Анын 3 блогу бар. Канча кабырчык?',
);

/* ========== g3r adj glosses / gen explanations / verb person labels ========== */
setTask('en', 'g3r_adjl3_q1_a', 'Грустный (sad)');
setTask('en', 'g3r_adjl3_q1_b', 'Радостный (joyful)');
setTask('en', 'g3r_adjl3_q1_c', 'Смешной (funny)');
setTask('en', 'g3r_adjl3_q2_a', 'Холодный (cold)');
setTask('en', 'g3r_adjl3_q2_b', 'Горячий (hot)');
setTask('en', 'g3r_adjl3_q2_c', 'Мягкий (soft)');
setTask('en', 'g3r_adjl3_q3_a', 'Высокий – длинный (tall – long)');
setTask('en', 'g3r_adjl3_q3_b', 'Широкий – узкий (wide – narrow)');
setTask('en', 'g3r_adjl3_q3_c', 'Старый – взрослый (old – adult)');

setTask('en', 'g3r_genl3_q3_a', 'Because МОЛОКО is neuter');
setTask('en', 'g3r_genl3_q3_b', 'Because МОЛОКО is masculine');
setTask('en', 'g3r_genl3_q3_c', 'Just because it sounds nicer');
setTask('ky', 'g3r_genl3_q3_a', 'Анткени МОЛОКО — орто род');
setTask('ky', 'g3r_genl3_q3_b', 'Анткени МОЛОКО — эркек род');
setTask('ky', 'g3r_genl3_q3_c', 'Жөн гана сулуураак угулат');

setTask('en', 'g3r_verbl3_q2_a', '1st person (я / I)');
setTask('en', 'g3r_verbl3_q2_b', '2nd person (ты / you)');
setTask('en', 'g3r_verbl3_q2_c', '3rd person (он / he)');
setTask('ky', 'g3r_verbl3_q2_a', '1-жак (я / мен)');
setTask('ky', 'g3r_verbl3_q2_b', '2-жак (ты / сен)');
setTask('ky', 'g3r_verbl3_q2_c', '3-жак (он / ал)');

setDialog(
  'en',
  'g3r_adjl3_0',
  'ВЕСЁЛЫЙ — ГРУСТНЫЙ. БОЛЬШОЙ — МАЛЕНЬКИЙ. Those are antonyms — opposite words! Tali discovered this at five!',
);
setDialog(
  'ky',
  'g3r_adjl3_0',
  'ВЕСЁЛЫЙ — ГРУСТНЫЙ. БОЛЬШОЙ — МАЛЕНЬКИЙ. Бул антонимдер — карама-каршы сөздөр! Тали муну беш жашында ачкан!',
);

/* ========== Phase 3: KY science + speech Q leaks + remaining tasks ========== */
setTask(
  'ky',
  'g2s_root_function',
  'Тали гүлдү сугарат, бирок суу жерге сиңип кетет. «Бекер куюп жатам!» дейт ал. Тамыр сууну эмне үчүн сиңирет?',
);
setTask(
  'en',
  'g2s_root_function',
  'Tali waters a flower, but the water sinks into the ground. “I’m pouring for nothing!” he says. Why does the root take in water?',
);
setTask('en', 'g2s_opt_water_food', 'For water and nutrients');
setTask('en', 'g2s_opt_photosyn', 'For photosynthesis');
setTask('en', 'g2s_opt_flowers', 'Only for beauty');

setTask(
  'ky',
  'g2s_leaf_function',
  'Арчи жалбырактарды көрүп сурайт: алар эмне үчүн керек?',
);
setTask(
  'en',
  'g2s_leaf_function',
  'Archie sees the leaves and asks: what are they for?',
);

setTask('ky', 'g2s_mammal_is', 'Тизмедегилердин кайсынысы — сүт эмүүчү?');
setTask(
  'ky',
  'g2s_anil1_q2',
  'Тали сурайт: «Сүт эмүүчүлөрдүн негизги белгиси — эмне?» Арчи: «Жумуртка туушат!» дейт. Тали ишенбейт. Ким туура?',
);
setTask('ky', 'g2s_bat_mammal', 'Жаргалак — сүт эмүүчүбү?');
setTask('ky', 'g2s_bird_is', 'Тизмедегилердин кайсынысы — куш?');
setTask('ky', 'g2s_bird_feature', 'Куштардын негизги белгиси:');
setTask(
  'ky',
  'g2s_penguin_bird',
  'Тали сурайт: «Пингвин — кушпу же жокпу?» Арчи күмөн санап жатат. Аларга жардам бер!',
);
setTask('ky', 'g2s_all_birds_fly', 'Бардык куштар учабы?');
setTask('ky', 'g2s_fish_breathes', 'Балык эмненин жардамы менен дем алат:');
setTask(
  'ky',
  'g2s_anil3_q2',
  'Тали курт-кумурсканын 6 буту бар деп ойлойт. Арчи 8 дейт. Ким туура?',
);
setTask(
  'ky',
  'g2s_spider_insect',
  'Тали ырастоодо: «Жөргөмүш — курт-кумурска!» Арчи эми жоопту билет. Тали туурабы?',
);
setTask('ky', 'g2s_anil3_q4', 'Балыктар эмне менен дем алат? (бир сөз)');

setDialog(
  'en',
  'g2s_anil3_0',
  'Archie, how many legs does a spider have? I think six — like all insects!',
);
setDialog(
  'en',
  'g2s_anil3_1',
  'Hmm, wait. Is a spider really an insect? I’m not sure either. Let’s check!',
);
setDialog(
  'ky',
  'g2s_anil3_0',
  'Арчи, жөргөмүштүн канча буту бар? Менимче алты — бардык курт-кумурскалардай!',
);
setDialog(
  'ky',
  'g2s_anil3_1',
  'Хм, күт. Жөргөмүш чын эле курт-кумурскабы? Мен да ишенбейм. Текшерели!',
);
setIntro(
  'en',
  'g2s_anil3_0_b',
  'Fish breathe with gills and live in water. Insects have 6 legs (not 8!). A spider is not an insect — it has 8 legs.',
);
setIntro(
  'ky',
  'g2s_anil3_0_b',
  'Балыктар желбезек менен дем алып, сууда жашайт. Курт-кумурскалардын 6 буту бар (8 эмес!). Жөргөмүш — курт-кумурска эмес, анын 8 буту бар.',
);

setDialog(
  'en',
  'g2s_anil1_0',
  'Archie, am I a mammal?',
);
setDialog(
  'en',
  'g2s_anil1_1',
  'Hmm, Tali — you’re a dinosaur. And dinosaurs laid eggs! But I’m not sure which group you belong to. Tell us about mammals — we’ll figure it out!',
);
setDialog(
  'ky',
  'g2s_anil1_0',
  'Арчи, мен сүт эмүүчүмүнбү?',
);
setDialog(
  'ky',
  'g2s_anil1_1',
  'Хм, Тали — сен динозаврсың. Ал эми динозаврлар жумуртка туушкан! Бирок сен кайсы топко кирериңе ишенбейм. Бизге сүт эмүүчүлөр жөнүндө айт — түшүнөбүз!',
);

setTask(
  'ky',
  'g2s_skeleton_function',
  'Тали түшүнгүсү келет: скелет эмне үчүн керек?',
);
setTask(
  'en',
  'g2s_skeleton_function',
  'Tali wants to understand: what is the skeleton for?',
);
setTask('en', 'g2s_opt_support', 'Body support and organ protection');
setTask('ky', 'g2s_opt_support', 'Дененин таянычы жана органдарды коргоо');
setTask(
  'ky',
  'g2s_muscles_do',
  'Арчи сурайт: булчуңдар эмне үчүн керек…',
);
setTask(
  'en',
  'g2s_muscles_do',
  'Archie asks: muscles are needed so that…',
);
setTask(
  'ky',
  'g2s_bdyl1_q3',
  'Тали арандаткыч суроо берет: «Булчуңсуз адам кыймылдай алабы?»',
);
setTask('ky', 'g2s_biggest_bone', 'Адамдын эң чоң сөөгү кайсы?');

setTask(
  'ky',
  'g2s_heart_does',
  'Тали сурайт: жүрөк эмне кылат?',
);
setTask('ky', 'g2s_lungs_do', 'Өпкө эмне үчүн керек?');
setTask(
  'ky',
  'g2s_bdyl2_q3',
  'Арчи ашказан дем алууга жооптуу деп ойлойт. Тали макул эмес. Ким туура?',
);
setTask('ky', 'g2s_bdyl2_q4', 'Денедеги органдардын кайсынысы маанилүү?');

setDialog(
  'en',
  'g2s_bdyl2_0',
  'Archie, what does the heart do? I hear “boom-boom” in my chest!',
);
setDialog(
  'en',
  'g2s_bdyl2_1',
  'Oh, that’s interesting! I know the heart is important, but I don’t remember exactly why. Tell us!',
);
setDialog(
  'ky',
  'g2s_bdyl2_0',
  'Арчи, жүрөк эмне кылат? Мен көкүрөгүмдөн «бум-бум» угам!',
);
setDialog(
  'ky',
  'g2s_bdyl2_1',
  'Оо, бул кызык! Жүрөк маанилүү экенин билем, бирок эмне үчүн экенин так эстебейм. Айтып бер!',
);
setIntro('en', 'g2s_bdyl2_0_t', 'Organs — each in its place!');
setIntro(
  'en',
  'g2s_bdyl2_0_b',
  'Heart, lungs, stomach — each organ has its own job inside the body.',
);
setIntro('ky', 'g2s_bdyl2_0_t', 'Органдар — ар бири өз ордунда!');
setIntro(
  'ky',
  'g2s_bdyl2_0_b',
  'Жүрөк, өпкө, ашказан — ар бир органдын денеде өз иши бар.',
);
setIntro('en', 'g2s_bdyl2_1_t', 'Each organ’s job');
setIntro(
  'en',
  'g2s_bdyl2_1_b',
  'The heart pumps blood, lungs help us breathe, the stomach digests food.',
);
setIntro('ky', 'g2s_bdyl2_1_t', 'Ар бир органдын иши');
setIntro(
  'ky',
  'g2s_bdyl2_1_b',
  'Жүрөк кан айдатат, өпкө дем алууга жардам берет, ашказан тамакты сиңирет.',
);

/* speech parts remaining Q */
setTask(
  'ky',
  'g2r_idet_verb',
  'Тали дейт: «ИДЁТ — бул этиш!» Ал туурабы?',
);
setTask(
  'en',
  'g2r_idet_verb',
  'Tali says: “ИДЁТ is a verb!” Is he right?',
);
setTask(
  'ky',
  'g2r_krasivyi_adj',
  'Тали дейт: «КРАСИВЫЙ — бул сын атооч!» Ал туурабы?',
);
setTask(
  'en',
  'g2r_krasivyi_adj',
  'Tali says: “КРАСИВЫЙ is an adjective!” Is he right?',
);

// Find which_verb / which_adj keys from RU if present
for (const k of Object.keys(ru.data.tasks)) {
  if (/g2r_.*verb|g2r_.*adj|g2r_which|g2r_spl2|g2r_spl3|g2r_opt_kras/.test(k)) {
    // handled selectively below
  }
}

setTask('ky', 'g2r_opt_krasivyi', 'КРАСИВЫЙ'); // Russian target word stays
setTask('en', 'g2r_opt_krasivyi', 'КРАСИВЫЙ');

setIntro('en', 'g2r_spl2_0_t', 'A verb is an action!');
setIntro('en', 'g2r_spl3_0_t', 'An adjective is a quality!');
setIntro('ky', 'g2r_spl3_0_t', 'Сын атооч — белги!');
// Fix wrong KY intro for spl3 if body is about sentence members
if ((ru.data.intro.g2r_spl3_0_b || '').includes('прилагатель')) {
  setIntro(
    'en',
    'g2r_spl3_0_b',
    'An adjective answers the question what kind? Red, big, cheerful!',
  );
  setIntro(
    'ky',
    'g2r_spl3_0_b',
    'Сын атооч кандай? деген суроого жооп берет. Кызыл, чоң, шайыр!',
  );
}

setDialog(
  'en',
  'g2r_spl2_0',
  'Tali, a verb is an action word! БЕЖИТ, ЧИТАЕТ, СПИТ. What does the cat do?',
);
setDialog(
  'en',
  'g2r_spl2_1',
  'It meows! Is that a verb? Wait — is МЯУКАНЬЕ also a verb? I’m confused…',
);
setDialog(
  'ky',
  'g2r_spl2_0',
  'Тали, этиш — иш-аракет сөзү! БЕЖИТ, ЧИТАЕТ, СПИТ. Мышык эмне кылат?',
);
setDialog(
  'ky',
  'g2r_spl2_1',
  'Мяулайт! Бул этишпи? Күт — МЯУКАНЬЕ да этишпи? Мен чаташтым…',
);
setDialog(
  'en',
  'g2r_spl3_0',
  'Masha, I wrote in my essay: “Tali is a dinosaur.” Masha says that’s boring. We need to add an adjective!',
);
setDialog(
  'en',
  'g2r_spl3_1',
  'Tali is a ЗЕЛЁНЫЙ, ВЕСЁЛЫЙ, УМНЫЙ dinosaur! An adjective answers КАКОЙ? Shall we try together?',
);
setDialog(
  'ky',
  'g2r_spl3_0',
  'Маша, мен сочинениеге жаздым: «Тали — динозавр». Маша бул кызыксыз дейт. Сын атооч кошуу керек!',
);
setDialog(
  'ky',
  'g2r_spl3_1',
  'Тали — ЗЕЛЁНЫЙ, ВЕСЁЛЫЙ, УМНЫЙ динозавр! Сын атооч КАКОЙ? суроосуна жооп берет. Чогуу аракет кылалыбы?',
);

/* Sync remaining RU-story EN for plant dialog */
setDialog(
  'en',
  'g2s_pltl1_0',
  'I planted a seed, but it won’t grow! Maybe I’m doing something wrong? Tell me about plants — I know nothing!',
);
setDialog(
  'en',
  'g2s_pltl1_1',
  'Tali, a plant needs a root, a stem, leaves and water. I’ve seen many plants from above, but I don’t know the details. Explain to us!',
);
setDialog(
  'ky',
  'g2s_pltl1_0',
  'Мен үрөн отургуздум, бирок өспөй жатат! Балким бирдеме туура эмес кылып жатам? Өсүмдүктөр жөнүндө айт — эч нерсе билбейм!',
);
setDialog(
  'ky',
  'g2s_pltl1_1',
  'Тали, өсүмдүккө тамыр, сабак, жалбырактар жана суу керек. Мен бийиктиктен көп өсүмдүктөрдү көрдүм, бирок майда-чүйдөсүн билбейм. Бизге түшүндүр!',
);

setDialog(
  'en',
  'g2s_bdyl1_0',
  'Archie, why do people need bones? I’d rather be soft like a pillow!',
);
setDialog(
  'en',
  'g2s_bdyl1_1',
  'Tali, without bones you’d melt onto the floor! Bones are support. Tell us how the skeleton works!',
);
setDialog(
  'ky',
  'g2s_bdyl1_0',
  'Арчи, адамдарга сөөк эмне үчүн керек? Мен жаздыктай жумшак болгум келет!',
);
setDialog(
  'ky',
  'g2s_bdyl1_1',
  'Тали, сөөксүз жерге жайылып калат элең! Сөөктөр — таяныч. Скелет кандай иштээрин айт!',
);

/* Fill any remaining KY question keys that still equal RU for science/math */
const forceKyQuestions = {
  g2s_pltl1_fb_sent: 'Өсүмдүктүн өсүү тартиби: үрөн → ___ → өсүмдүк → гүл',
  g2s_plant_parts_count: 'Өсүмдүктүн негизги бөлүктөрү канча?',
  g2s_anil1_sort_q: 'Жаныбарларды топторго бөл:',
  g2s_anil1_sort_mammal: 'Сүт эмүүчүлөр',
  g2s_anil1_sort_other: 'Башкалар',
  g2s_anil1_q2_a: 'Арчи туура (жумуртка туушат)',
  g2s_anil1_q2_b: 'Тали туура шектенет (сүт менен багышат)',
  g2s_anil3_q2_a: 'Тали туура (6 бут)',
  g2s_anil3_q2_b: 'Арчи туура (8 бут)',
  g2s_bdyl2_q3_a: 'Арчи туура',
  g2s_bdyl2_q3_b: 'Тали туура',
  g2s_opt_move_body: 'Денени кыймылдатүү үчүн',
  g2s_opt_digest: 'Тамак сиңирүү үчүн',
  g2s_opt_breathe: 'Дем алуу үчүн',
  g2s_opt_see_f: 'Көрүү үчүн',
  g2s_opt_breathe_f: 'Дем алуу үчүн',
  g2s_opt_digest_f: 'Тамак сиңирүү үчүн',
  g2s_opt_has_feathers: 'Жүнү бар',
  g2s_opt_has_fur: 'Жүнү (териси) бар',
  g2s_opt_has_scales: 'Кабырчыгы бар',
  g2m_tens_in_90: '90 санында канча ондук бар?',
};

for (const [k, v] of Object.entries(forceKyQuestions)) {
  if (ru.data.tasks[k] != null) setTask('ky', k, v);
}

const forceEnQuestions = {
  g2s_anil1_q2:
    'Tali asks: “The main feature of mammals is what?” Archie says: “They lay eggs!” Tali doesn’t believe it. Who is right?',
  g2s_bat_mammal: 'Is a bat a mammal?',
  g2s_bird_feature: 'The main feature of birds is:',
  g2s_penguin_bird: 'Tali asks: “Is a penguin a bird or not?” Archie is unsure. Help them!',
  g2s_all_birds_fly: 'Do all birds fly?',
  g2s_anil3_q2: 'Tali thinks an insect has 6 legs. Archie says 8. Who is right?',
  g2s_spider_insect: 'Tali claims: “A spider is an insect!” Archie now knows the answer. Is Tali right?',
  g2s_anil3_q4: 'What do fish breathe with? (one word)',
  g2s_bdyl1_q3: 'Tali asks a tricky question: “Could a person move without muscles?”',
  g2s_biggest_bone: 'What is the biggest bone in the human body?',
  g2s_lungs_do: 'What are the lungs for?',
  g2s_bdyl2_q3: 'Archie thinks the stomach is responsible for breathing. Tali disagrees. Who is right?',
  g2s_bdyl2_q4: 'Which organs in the body are important?',
  g2s_pltl1_fb_sent: 'Plant growth order: seed → ___ → plant → flower',
  g2s_plant_parts_count: 'How many main parts does a plant have?',
  g2s_anil1_q2_a: 'Archie is right (they lay eggs)',
  g2s_anil1_q2_b: 'Tali is right to doubt (they feed with milk)',
  g2s_anil3_q2_a: 'Tali is right (6 legs)',
  g2s_anil3_q2_b: 'Archie is right (8 legs)',
  g2s_bdyl2_q3_a: 'Archie is right',
  g2s_bdyl2_q3_b: 'Tali is right',
  g2s_opt_move_body: 'To move the body',
  g2s_opt_digest: 'For digestion',
  g2s_opt_breathe: 'For breathing',
  g2s_opt_see_f: 'For seeing',
  g2s_opt_breathe_f: 'For breathing',
  g2s_opt_digest_f: 'For digestion',
  g2s_opt_has_feathers: 'Has feathers',
  g2s_opt_has_fur: 'Has fur',
  g2s_opt_has_scales: 'Has scales',
  g2m_tens_in_90: 'How many tens are in the number 90?',
};

for (const [k, v] of Object.entries(forceEnQuestions)) {
  if (ru.data.tasks[k] != null) setTask('en', k, v);
}

/* Patch remaining 100-l1 / 1000 tasks from RU keys */
function syncStory(enMap, kyMap) {
  for (const [k, v] of Object.entries(enMap)) if (ru.data.tasks[k] != null) setTask('en', k, v);
  for (const [k, v] of Object.entries(kyMap)) if (ru.data.tasks[k] != null) setTask('ky', k, v);
}

// Discover 100-l1 remaining question keys
const q100 = Object.keys(ru.data.tasks).filter(
  (k) =>
    /g2m_.*(stog|mice|five_tens|100_is|archi.*100|tens_in_100|7.*10)/i.test(k) ||
    k.startsWith('g2m_100l1'),
);
console.log('100-l1 related keys', q100);

const q1000 = Object.keys(ru.data.tasks).filter(
  (k) => k.startsWith('g3m_') && /100|box|stack|thousand|сот|ящик/i.test(k + (ru.data.tasks[k] || '')),
);
console.log(
  '1000 keys sample',
  q1000.slice(0, 20).map((k) => k + '=' + String(ru.data.tasks[k]).slice(0, 40)),
);

/* Also pull speech which-word keys */
for (const k of ['g2r_which_verb', 'g2r_which_adj', 'g2r_spl2_q3', 'g2r_spl3_q3', 'g2r_verb_is', 'g2r_adj_is']) {
  if (ru.data.tasks[k]) console.log('speech', k, ru.data.tasks[k].slice(0, 60));
}

function syncAba() {
  for (const k of touched.tasks) {
    const full = `data.tasks.${k}`;
    if (ru.data.tasks[k] != null) abaRu[full] = ru.data.tasks[k];
    if (en.data.tasks[k] != null) abaEn[full] = en.data.tasks[k];
    if (ky.data.tasks[k] != null) abaKy[full] = ky.data.tasks[k];
  }
  for (const k of touched.dialog) {
    const full = `data.dialog.${k}`;
    if (ru.data.dialog[k] != null) abaRu[full] = ru.data.dialog[k];
    if (en.data.dialog[k] != null) abaEn[full] = en.data.dialog[k];
    if (ky.data.dialog[k] != null) abaKy[full] = ky.data.dialog[k];
  }
  for (const k of touched.intro) {
    const full = `data.intro.${k}`;
    if (ru.data.intro[k] != null) abaRu[full] = ru.data.intro[k];
    if (en.data.intro[k] != null) abaEn[full] = en.data.intro[k];
    if (ky.data.intro[k] != null) abaKy[full] = ky.data.intro[k];
  }
}

syncAba();
save('en.json', en);
save('ky.json', ky);
save('abaTextOverrides.generated.json', abaRu);
save('abaTextOverrides.en.generated.json', abaEn);
save('abaTextOverrides.ky.generated.json', abaKy);
console.log('OK pass2 touched', {
  tasks: touched.tasks.size,
  dialog: touched.dialog.size,
  intro: touched.intro.size,
});
