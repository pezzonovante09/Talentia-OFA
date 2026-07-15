/**
 * One-off merge of hand-crafted EN/KY strings for keys reported missing by check-i18n.
 * Run from talentia-mobile: node scripts/apply-missing-en-ky-fill.mjs
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

/** @type {Record<string, { en: string; ky: string }>} */
const fill = {
  'data.dialog.g2e_phrl3_2': {
    en: "No, you can't — this is MY sandwich, Tali!",
    ky: 'Жок, болбойт — бул МЕНИН тостум, Тали!',
  },
  'data.dialog.g2r_sentl2_2': {
    en: 'Great comparison! Exactly!',
    ky: 'Сонун салыштыруу! Эле ушундай!',
  },
  'data.dialog.g2s_anil2_2': {
    en: 'Hmm… that’s a good question. Honestly, I’m a little unsure…',
    ky: 'Хм… бул жакшы суроо. Чындыгында, мен бир аз күмөн катары калдым…',
  },
  'data.tasks.g2e_phrl2_q4': {
    en: 'Tali stepped on Polly’s paw again — the second time! He asks if “I’m sorry” and “Sorry” mean the same thing.',
    ky: 'Тали Полинин бутун кайра басты — экинчи жолу! Ал «I’m sorry» менен «Sorry» бир эле деп сурайт.',
  },
  'data.tasks.g2e_phrl2_q4_a': {
    en: 'Yes — both mean “sorry”.',
    ky: 'Ооба — экөө тең «кечириңиз» дегенди билдирет.',
  },
  'data.tasks.g2e_phrl2_q4_b': {
    en: 'No — they’re different words with different meanings.',
    ky: 'Жок — бул башка сөздөр жана башка мааниге ээ.',
  },
  'data.tasks.g2r_sentl1_q2': {
    en: 'In “The cat is sitting”, find the subject. Tali thinks it’s “sitting”.',
    ky: '«Мышык отурат» деген сүйлөмдө теманы табыңыз. Тали бул «отурат» деп эсептейт.',
  },
  'data.tasks.g2r_sentl1_q2_a': {
    en: 'CAT is the subject.',
    ky: 'МЫШЫК — тема.',
  },
  'data.tasks.g2r_sentl1_q2_b': {
    en: 'SITTING is the subject (that’s what Tali thinks).',
    ky: 'ОТУРАТ — тема (Тали ошондой деп ойлойт).',
  },
  'data.tasks.g2s_anil1_q2': {
    en: 'Tali asks: “What’s the main sign of mammals?” Archie says: “They lay eggs!” Who is right?',
    ky: 'Тали сурайт: «Сүт эмүүчүлөрдүн негизги белгиси эмне?» Арчи: «Жумуртка туударат!» Ким туура?',
  },
  'data.tasks.g2s_anil1_q2_a': {
    en: 'Archie is right — they lay eggs.',
    ky: 'Арчи туура — алар жумуртка туударат.',
  },
  'data.tasks.g2s_anil1_q2_b': {
    en: 'Tali is right — they feed their babies milk.',
    ky: 'Тали туура — балдарына сүт менен тамактандырат.',
  },
  'data.tasks.g2s_anil3_q2': {
    en: 'Tali thinks insects have 6 legs. Archie says 8. Who is right?',
    ky: 'Тали жөрмөлүктөрдүн 6 буту бар деп ойлойт. Арчи 8 дейт. Ким туура?',
  },
  'data.tasks.g2s_anil3_q2_a': {
    en: 'Tali is right — insects have 6 legs.',
    ky: 'Тали туура — жөрмөлүктөрдүн 6 буту бар.',
  },
  'data.tasks.g2s_anil3_q2_b': {
    en: 'Archie is right — insects have 8 legs.',
    ky: 'Арчи туура — жөрмөлүктөрдүн 8 буту бар.',
  },
  'data.tasks.g2s_bdyl2_q3': {
    en: 'Archie thinks the stomach is for breathing. Tali disagrees. Who is right?',
    ky: 'Арчи аштын дем алуу үчүн экенин ойлойт. Тали макул эмес. Ким туура?',
  },
  'data.tasks.g2s_bdyl2_q3_a': {
    en: 'Archie is right.',
    ky: 'Арчи туура.',
  },
  'data.tasks.g2s_bdyl2_q3_b': {
    en: 'Tali is right — the stomach digests food.',
    ky: 'Тали туура — аш тамакты сиңирет.',
  },
  'data.tasks.g2s_bdyl2_q4': {
    en: 'What does the brain control?',
    ky: 'Мээнде кандай функция бар?',
  },
  'data.tasks.g2s_bdyl2_q4_a': {
    en: 'The whole body — movements, thoughts, senses.',
    ky: 'Бүт дене — кыймылдар, ойлор, сезүү.',
  },
  'data.tasks.g2s_bdyl2_q4_b': {
    en: 'Only movements.',
    ky: 'Гана кыймылдар.',
  },
  'data.tasks.g2s_bdyl2_q4_c': {
    en: 'Only thoughts.',
    ky: 'Гана ойлор.',
  },
  'data.tasks.g2s_pltl1_q3': {
    en: 'The stem is the plant’s “pipe”. What does it carry?',
    ky: 'Сабы өсүмдүктүн «түтүгү». Ал эмнени өткөрөт?',
  },
  'data.tasks.g2s_pltl1_q3_a': {
    en: 'Water and nutrients.',
    ky: 'Сууну жана заттарды.',
  },
  'data.tasks.g2s_pltl1_q3_b': {
    en: 'Only air.',
    ky: 'Гана абаны.',
  },
  'data.tasks.g2s_pltl1_q3_c': {
    en: 'Nothing special.',
    ky: 'Эч нерсе өзгөчө эмес.',
  },
  'data.tasks.g2s_pltl2_q1': {
    en: 'Tali put a flower in a dark cupboard. Archie says: “Bad idea!” Why?',
    ky: 'Тали гүлдү караңгы шкафка койду. Арчи: «Жаман идея!» — эмнеге?',
  },
  'data.tasks.g2s_pltl2_q1_a': {
    en: 'In the dark there’s no photosynthesis — the plant can’t feed itself.',
    ky: 'Караңгуда фотосинтез болбойт — өсүмдүк өзүн багып албайт.',
  },
  'data.tasks.g2s_pltl2_q1_b': {
    en: 'It’s too warm in the cupboard.',
    ky: 'Шкафта өтө ысык.',
  },
  'data.tasks.g2s_pltl2_q1_c': {
    en: 'It’s fine — plants don’t need light.',
    ky: 'Бардыгы жакшы — өсүмдүккө жарык керек эмес.',
  },
  'data.tasks.g3e_foodl1_q3': {
    en: 'Tea, coffee, milk — these words are all:',
    ky: 'Tea, coffee, milk — бул сөздөрдүн баары:',
  },
  'data.tasks.g3e_foodl1_q3_a': {
    en: 'Drinks.',
    ky: 'Ичкиликтер.',
  },
  'data.tasks.g3e_foodl1_q3_b': {
    en: 'Food.',
    ky: 'Тамак.',
  },
  'data.tasks.g3e_foodl1_q3_c': {
    en: 'Fruits.',
    ky: 'Жемиштер.',
  },
  'data.tasks.g3e_foodl2_q3': {
    en: 'How do you say “I like chocolate” in English?',
    ky: '«Мага шоколад жагат» деп англисче кантип айтылат?',
  },
  'data.tasks.g3e_foodl2_q3_a': {
    en: 'I like chocolate',
    ky: 'I like chocolate',
  },
  'data.tasks.g3e_foodl2_q3_b': {
    en: "I don't like chocolate",
    ky: "I don't like chocolate",
  },
  'data.tasks.g3e_foodl2_q3_c': {
    en: 'I am chocolate',
    ky: 'I am chocolate',
  },
  'data.tasks.g3r_adjl2_q1': {
    en: 'Elephant: “I’m big!” Giraffe: “And I’m ___ you!” Comparative degree:',
    ky: 'Пил: «Мен чоңмун!» Жираф: «А мен сенен ___!» Салыштырма даража:',
  },
  'data.tasks.g3r_adjl2_q1_a': {
    en: 'bigger (bigger than)',
    ky: 'чоңураак',
  },
  'data.tasks.g3r_adjl2_q1_b': {
    en: 'more',
    ky: 'көбүрөөк',
  },
  'data.tasks.g3r_adjl2_q1_c': {
    en: 'the biggest',
    ky: 'эң чоң',
  },
  'data.tasks.g3r_adjl2_q3': {
    en: '“This is the most interesting book” — pick the superlative:',
    ky: '«Бул эң кызыктуу китеп» — эң жогорку даражаны танда:',
  },
  'data.tasks.g3r_adjl2_q3_a': {
    en: 'the most interesting',
    ky: 'эң кызыктуу',
  },
  'data.tasks.g3r_adjl2_q3_b': {
    en: 'interesting',
    ky: 'ызыктуу',
  },
  'data.tasks.g3r_adjl2_q3_c': {
    en: 'more interesting',
    ky: 'ызыктыураак',
  },
  'data.tasks.g3r_adjl3_q4': {
    en: '“In summer the days are long, and in winter they are ___”:',
    ky: '«Жайында күндөр узун, кышында болсо ___»:',
  },
  'data.tasks.g3r_adjl3_q4_a': {
    en: 'long (the same)',
    ky: 'узун (окшош)',
  },
  'data.tasks.g3r_adjl3_q4_b': {
    en: 'short',
    ky: 'кыска',
  },
  'data.tasks.g3r_adjl3_q4_c': {
    en: 'medium',
    ky: 'орточо',
  },
  'data.tasks.g3r_verbl1_q1': {
    en: 'A reporter is live on air. “The boy ___ along the street.” Which verb form?',
    ky: 'Репортер түз эфирде. «Бала көчө боюнча ___». Кайсы форма?',
  },
  'data.tasks.g3r_verbl1_q1_a': {
    en: 'walked (past)',
    ky: 'басып кетти (өткөн)',
  },
  'data.tasks.g3r_verbl1_q1_b': {
    en: 'walks / is walking (present)',
    ky: 'басат / жүрөт (азыркы)',
  },
  'data.tasks.g3r_verbl1_q1_c': {
    en: 'will walk (future)',
    ky: 'басат (келечек)',
  },
  'data.tasks.g3r_verbl1_q3': {
    en: 'Find the “spy” — the present-tense verb among: CHITAL, CHITAET, PROCHITAET.',
    ky: '«Шпионду» тап — азыркы замандын этиши кайсы: ЧИТАЛ, ЧИТАЕТ, ПРОЧИТАЕТ.',
  },
  'data.tasks.g3r_verbl1_q3_a': {
    en: 'CHITAL — past tense',
    ky: 'ЧИТАЛ — өткөн заман',
  },
  'data.tasks.g3r_verbl1_q3_b': {
    en: 'CHITAET — present tense',
    ky: 'ЧИТАЕТ — азыркы заман',
  },
  'data.tasks.g3r_verbl1_q3_c': {
    en: 'PROCHITAET — future tense',
    ky: 'ПРОЧИТАЕТ — келечек заман',
  },
  'data.tasks.g3r_verbl2_q2': {
    en: 'READ (past form) — which tense is it?',
    ky: 'ОКУДУ — кайсы заман?',
  },
  'data.tasks.g3r_verbl2_q2_a': {
    en: 'Present',
    ky: 'Азыркы',
  },
  'data.tasks.g3r_verbl2_q2_b': {
    en: 'Past',
    ky: 'Өткөн',
  },
  'data.tasks.g3r_verbl2_q2_c': {
    en: 'Future',
    ky: 'Келечек',
  },
  'data.tasks.g3r_verbl2_q4': {
    en: 'Tali learned: in the past tense the verb changes by gender. How do we say it about a girl?',
    ky: 'Тали билди: өткөн заманда этиш жыныска жараша өзгөрөт. Кыз жөнүндө кантип айтасың?',
  },
  'data.tasks.g3r_verbl2_q4_a': {
    en: 'She read (wrong gender form)',
    ky: 'Ал окуду (туура эмес форма)',
  },
  'data.tasks.g3r_verbl2_q4_b': {
    en: 'She read (correct feminine past)',
    ky: 'Ал окуду (туура аял форма)',
  },
  'data.tasks.g3r_verbl2_q4_c': {
    en: 'She reads (present)',
    ky: 'Ал окуйт (азыркы)',
  },
  'data.tasks.g3r_verbl3_q3': {
    en: 'Teacher to a student: “You ___ the problem.” 2nd person of “solve”:',
    ky: 'Мугалим окуучуга: «Сен маселени ___». «Чечүү» этишинин 2-жак:',
  },
  'data.tasks.g3r_verbl3_q3_a': {
    en: 'I will solve (1st person)',
    ky: 'Мен чечем (1-жак)',
  },
  'data.tasks.g3r_verbl3_q3_b': {
    en: 'You will solve (2nd person)',
    ky: 'Сен чечесиң (2-жак)',
  },
  'data.tasks.g3r_verbl3_q3_c': {
    en: 'He/she will solve (3rd person)',
    ky: 'Ал чечет (3-жак)',
  },
  'data.tasks.g3r_verbl3_q4': {
    en: '“They ___ in the park” — 3rd person plural of “walk”:',
    ky: '«Алар паркта ___» — «сейилдөө» этишинин 3-жак көп түрү:',
  },
  'data.tasks.g3r_verbl3_q4_a': {
    en: 'walks (3rd singular)',
    ky: 'басат (3-жак жалгыз)',
  },
  'data.tasks.g3r_verbl3_q4_b': {
    en: 'I walk (1st person)',
    ky: 'мен басам (1-жак)',
  },
  'data.tasks.g3r_verbl3_q4_c': {
    en: 'they walk (3rd plural)',
    ky: 'алар басышат (3-жак көп)',
  },
  'data.tasks.g3w_ecol1_q2': {
    en: 'Fish, frogs and algae in a pond depend on each other. What is this called?',
    ky: 'Көлмөдөгү балыктар, баакалар жана суу өсүмдүктөрү бири-бирине көз каранды. Буга кандай деп айтышат?',
  },
  'data.tasks.g3w_ecol1_q2_a': {
    en: 'Ecosystem',
    ky: 'Экосистема',
  },
  'data.tasks.g3w_ecol1_q2_b': {
    en: 'Library',
    ky: 'Китепкана',
  },
  'data.tasks.g3w_ecol1_q2_c': {
    en: 'Factory',
    ky: 'Завод',
  },
  'data.tasks.g3w_ecol2_q3': {
    en: 'If all hares disappear from the forest, what happens to foxes?',
    ky: 'Эгер токойдогу бардык коёндор жок болсо, түлкүлөргө эмне болот?',
  },
  'data.tasks.g3w_ecol2_q3_a': {
    en: 'Foxes will do better.',
    ky: 'Түлкүлөргө жакшы болот.',
  },
  'data.tasks.g3w_ecol2_q3_b': {
    en: 'Foxes won’t have enough food.',
    ky: 'Түлкүлөргө тамак жетишпейт.',
  },
  'data.tasks.g3w_ecol2_q3_c': {
    en: 'Nothing will change.',
    ky: 'Эч нерсе өзгөрбөйт.',
  },
  'data.tasks.g3w_ecol2_q4': {
    en: 'Food chain: oak → caterpillar → tit → hawk. Who is the producer?',
    ky: 'Тамак чынжыры: эмен → гусеница → чымчык → лачын. Ким өндүрүүчү?',
  },
  'data.tasks.g3w_ecol2_q4_a': {
    en: 'Oak',
    ky: 'Эмен',
  },
  'data.tasks.g3w_ecol2_q4_b': {
    en: 'Caterpillar',
    ky: 'Гусеница',
  },
  'data.tasks.g3w_ecol2_q4_c': {
    en: 'Hawk',
    ky: 'Лачын',
  },
  'data.tasks.g3w_ecol3_q1': {
    en: 'The Amur tiger is in the Red Book. What does “rare species” mean?',
    ky: 'Амур жолборсу Кызыл китепте. «Сейрек түр» деген эмне?',
  },
  'data.tasks.g3w_ecol3_q1_a': {
    en: 'A species threatened with extinction.',
    ky: 'Жок болуу коркунучундагы түр.',
  },
  'data.tasks.g3w_ecol3_q1_b': {
    en: 'A very beautiful species.',
    ky: 'Өтө кооз түр.',
  },
  'data.tasks.g3w_ecol3_q1_c': {
    en: 'The most dangerous species.',
    ky: 'Эң коркунучтуу түр.',
  },
  'data.tasks.g3w_ecol3_q3': {
    en: 'Children planted flowers and built bird feeders. What do we call such actions?',
    ky: 'Балдар гүл отургузуп, канаттуулар үчүн тамак қутусун жасашты. Бул кандай аракет?',
  },
  'data.tasks.g3w_ecol3_q3_a': {
    en: 'Nature conservation.',
    ky: 'Жаратылышты коргоо.',
  },
  'data.tasks.g3w_ecol3_q3_b': {
    en: 'Poaching.',
    ky: 'Браконьердик.',
  },
  'data.tasks.g3w_ecol3_q3_c': {
    en: 'Pollution.',
    ky: 'Булгануу.',
  },
  'data.tasks.g3w_ecol3_q4': {
    en: 'A factory pours waste into a river. Who suffers first?',
    ky: 'Завод көлмөгө ағын төгөт. Эң биринчи ким зыян көрөт?',
  },
  'data.tasks.g3w_ecol3_q4_a': {
    en: 'Fish and river animals.',
    ky: 'Балыктар жана суу жандыктары.',
  },
  'data.tasks.g3w_ecol3_q4_b': {
    en: 'Birds in the sky.',
    ky: 'Асмандагы канаттуулар.',
  },
  'data.tasks.g3w_ecol3_q4_c': {
    en: 'Mountain animals.',
    ky: 'Тоодогу жаныктар.',
  },
  'data.tasks.g3w_natl1_q4': {
    en: 'Water flowed into the river and was heated by the sun again. Which step repeats?',
    ky: 'Суу дарыяга агып, кайра күндүн жылытуусуна учурады. Кайсы кадам кайталанат?',
  },
  'data.tasks.g3w_natl1_q4_a': {
    en: 'Evaporation.',
    ky: 'Паарылашы (уулануу).',
  },
  'data.tasks.g3w_natl1_q4_b': {
    en: 'Freezing.',
    ky: 'Тоңдуруу.',
  },
  'data.tasks.g3w_natl1_q4_c': {
    en: 'Rain.',
    ky: 'Жамгыр.',
  },
  'data.tasks.g3w_natl3_q2': {
    en: 'In a reserve you can’t hunt or cut trees. Why do we need reserves?',
    ky: 'Заповедникте атууга жана дарактарды кесүүгө болбойт. Заповедниктер эмне үчүн керек?',
  },
  'data.tasks.g3w_natl3_q2_a': {
    en: 'To preserve natural ecosystems.',
    ky: 'Жаратылыш экосистемаларын сактоо үчүн.',
  },
  'data.tasks.g3w_natl3_q2_b': {
    en: 'So tourists can relax.',
    ky: 'Туристтер эс алышы үчүн.',
  },
  'data.tasks.g3w_natl3_q2_c': {
    en: 'To extract resources.',
    ky: 'Ресурстарды алуу үчүн.',
  },
  'data.tasks.g3w_natl3_q4': {
    en: 'Which action does NOT help protect nature?',
    ky: 'Кайсы аракет жаратылышты коргоого жардам бербейт?',
  },
  'data.tasks.g3w_natl3_q4_a': {
    en: 'Sorting trash.',
    ky: 'Таштандыны сорттоо.',
  },
  'data.tasks.g3w_natl3_q4_b': {
    en: 'Saving water.',
    ky: 'Сууну үнөмдөө.',
  },
  'data.tasks.g3w_natl3_q4_c': {
    en: 'Dumping garbage in the forest.',
    ky: 'Токойго таштанды таштоо.',
  },
  'data.tasks.pre_opt_equal_short': {
    en: 'Equal',
    ky: 'Барабар',
  },
};

function setByPath(doc, dotted, value) {
  const parts = dotted.split('.');
  let cur = doc;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur[p] === undefined || typeof cur[p] !== 'object' || Array.isArray(cur[p])) cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

function main() {
  const chkPath = path.join(root, 'scripts/check-i18n.js');
  const out = spawnSync(process.execPath, [chkPath, '--json'], {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });
  const wantKeys = JSON.parse(out.stdout).missing_en;

  const missingFill = wantKeys.filter((k) => !fill[k]);
  if (missingFill.length) {
    console.error('Fill map missing keys:', missingFill);
    process.exit(1);
  }

  const extra = Object.keys(fill).filter((k) => !wantKeys.includes(k));
  if (extra.length) console.warn('Fill map has unused keys:', extra);

  const enPath = path.join(root, 'src/i18n/locales/en.json');
  const kyPath = path.join(root, 'src/i18n/locales/ky.json');
  const enDoc = JSON.parse(fs.readFileSync(enPath, 'utf8'));
  const kyDoc = JSON.parse(fs.readFileSync(kyPath, 'utf8'));

  for (const k of wantKeys) {
    setByPath(enDoc, k, fill[k].en);
    setByPath(kyDoc, k, fill[k].ky);
  }

  fs.writeFileSync(enPath, `${JSON.stringify(enDoc, null, 2)}\n`, 'utf8');
  fs.writeFileSync(kyPath, `${JSON.stringify(kyDoc, null, 2)}\n`, 'utf8');
  console.log('Updated en.json and ky.json for', wantKeys.length, 'keys.');
}

main();
