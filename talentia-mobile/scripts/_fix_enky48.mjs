/**
 * Fix ~48 EN/KY meaning-break lessons from reaudit #9 classification.
 * - Translate RW56 garden/forest stems+opts
 * - Fix wrong intros/dialogs
 * - Convert RU-locked inputs → MC with i18n options
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
  const p = path.join(root, 'src/i18n/locales', name);
  const body = `${JSON.stringify(doc, null, 2)}\n`;
  for (let i = 0; i < 5; i++) {
    try {
      fs.writeFileSync(p, body, 'utf8');
      return;
    } catch (e) {
      if (i === 4) throw e;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200 * (i + 1));
    }
  }
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
    // already converted?
    if (newStr && src.includes(newStr.slice(0, Math.min(80, newStr.length)))) {
      console.log('SKIP already', label);
      return src;
    }
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

function set(section, key, { ru: r, en: e, ky: y }) {
  if (r != null) ru.data[section][key] = r;
  if (e != null) en.data[section][key] = e;
  if (y != null) ky.data[section][key] = y;
}
function setTask(key, vals) {
  set('tasks', key, vals);
}
function setIntro(key, vals) {
  set('intro', key, vals);
}
function setDialog(key, vals) {
  set('dialog', key, vals);
}

/* ========================================================================
 * 1) RW56 translations (forest / garden)
 * ======================================================================== */
const rw = {
  // forest-syl-l3 — keep syllable tokens; translate stems + yes/no style ABA Q
  nrw_fsyll3_t1_q: {
    en: 'Tali heard the syllable “Nn-Aa!” Which building block did he catch?',
    ky: 'Тали «Нн-Аа!» муунун укту. Кайсы кирпичти кармады?',
  },
  nrw_fsyll3_t3_q: {
    en: 'Tali launches the rocket РА-КЕ-ТА. Which syllable flies first?',
    ky: 'Тали РА-КЕ-ТА ракетасын учурат. Биринчи кайсы муун учуп кетет?',
  },
  nrw_fsyll3_a1_q: {
    en: 'Show the syllable НА:',
    ky: 'НА муунун көрсөт:',
  },

  // garden-col-l1
  nrw_gcoll1_t1_a: { en: 'Strawberry', ky: 'Кулпунай' },
  nrw_gcoll1_t1_b: { en: 'Blueberry', ky: 'Кара моюл' },
  nrw_gcoll1_t1_c: { en: 'Eggplant', ky: 'Баклажан' },
  nrw_gcoll1_t1_q: {
    en: 'Tali picks berries. Which one is usually red?',
    ky: 'Тали жемиш терүүт. Кайсысы адатта кызыл?',
  },
  nrw_gcoll1_t2_q: {
    en: 'Tali is painting and doesn’t want the wrong color. Which is NOT red?',
    ky: 'Тали сүрөт тартып жатат жана туура эмес түстү каалабайт. Кайсысы КЫЗЫЛ ЭМЕС?',
  },
  nrw_gcoll1_t2_a: { en: 'Apple', ky: 'Алма' },
  nrw_gcoll1_t2_b: { en: 'Tomato', ky: 'Помидор' },
  nrw_gcoll1_t2_c: { en: 'Sun', ky: 'Күн' },
  nrw_gcoll1_t3_q: {
    en: 'Tali jumps in the swamp and sees a green creature. Is a frog green?',
    ky: 'Тали сазда секирип, жашыл жандыкты көрөт. Бака жашылбы?',
  },
  nrw_gcoll1_a1_q: { en: 'What color is a strawberry?', ky: 'Кулпунай кандай түстө?' },
  nrw_gcoll1_a1_a: { en: 'Red', ky: 'Кызыл' },
  nrw_gcoll1_a1_b: { en: 'Blue', ky: 'Көк' },

  // garden-col-l2
  nrw_gcoll2_t1_a: { en: 'Red', ky: 'Кызыл' },
  nrw_gcoll2_t1_b: { en: 'Yellow', ky: 'Сары' },
  nrw_gcoll2_t1_c: { en: 'Blue', ky: 'Көк' },
  nrw_gcoll2_t2_q: {
    en: 'Tali is a young artist. He mixed red and yellow paint. What did he get?',
    ky: 'Тали жаш сүрөтчү. Ал кызыл менен сары боёкту аралаштырды. Эмне чыкты?',
  },
  nrw_gcoll2_t2_a: { en: 'Green', ky: 'Жашыл' },
  nrw_gcoll2_t2_b: { en: 'Orange', ky: 'Кызгылт сары' },
  nrw_gcoll2_t2_c: { en: 'Purple', ky: 'Кызгылт көк' },
  nrw_gcoll2_t3_q: {
    en: 'Tali picks a purple vegetable — an eggplant. Is an eggplant purple?',
    ky: 'Тали кызгылт көк жашылчаны — баклажанды алат. Баклажан кызгылт көкпү?',
  },
  nrw_gcoll2_t3_a: { en: 'Yes!', ky: 'Ооба!' },
  nrw_gcoll2_t3_b: { en: 'No', ky: 'Жок' },
  nrw_gcoll2_t4_q: {
    en: 'Tali paints the sky with a yellow brush. What is he drawing?',
    ky: 'Тали асманды сары бийик менен боёйт. Ал эмне тартып жатат?',
  },
  nrw_gcoll2_t4_a: { en: 'The sun', ky: 'Күндү' },
  nrw_gcoll2_t4_b: { en: 'Grass', ky: 'Чөптү' },
  nrw_gcoll2_t4_c: { en: 'A berry', ky: 'Жемишти' },
  nrw_gcoll2_a1_q: { en: 'What color is a sunflower?', ky: 'Күн карама кандай түстө?' },
  nrw_gcoll2_a1_a: { en: 'Yellow', ky: 'Сары' },
  nrw_gcoll2_a1_b: { en: 'Red', ky: 'Кызыл' },

  // garden-col-l3
  nrw_gcoll3_t1_q: {
    en: 'Tali watches a film about the Arctic. A huge white animal lives there. What color is a polar bear?',
    ky: 'Тали Арктика жөнүндө фильм көрөт. Ал жерде чоң ак айбан жашайт. Ак аю кандай түстө?',
  },
  nrw_gcoll3_t1_a: { en: 'White', ky: 'Ак' },
  nrw_gcoll3_t1_b: { en: 'Blue', ky: 'Көк' },
  nrw_gcoll3_t1_c: { en: 'Red', ky: 'Кызыл' },
  nrw_gcoll3_t2_q: {
    en: 'Tali is back in the paint lab! Blue + Yellow = ?',
    ky: 'Тали кайра боёк лабораториясында! Көк + Сары = ?',
  },
  nrw_gcoll3_t2_a: { en: 'Red', ky: 'Кызыл' },
  nrw_gcoll3_t2_b: { en: 'Green', ky: 'Жашыл' },
  nrw_gcoll3_t2_c: { en: 'Orange', ky: 'Кызгылт сары' },
  nrw_gcoll3_t3_q: {
    en: 'Tali makes a collage of black things. What does NOT belong?',
    ky: 'Тали кара нерселерден коллаж жасайт. Кайсысы КИРБЕЙТ?',
  },
  nrw_gcoll3_t3_a: { en: 'Coal', ky: 'Көмүр' },
  nrw_gcoll3_t3_b: { en: 'Night sky', ky: 'Түнкү асман' },
  nrw_gcoll3_t3_c: { en: 'Milk', ky: 'Сүт' },
  nrw_gcoll3_t4_q: {
    en: 'Tali’s riddle: “I am black and white, I live in Antarctica, and I swim well.” Who am I?',
    ky: 'Талинин табышмагы: «Мен кара-акмын, Антарктидада жашайм жана жакшы сүзөм». Бул ким?',
  },
  nrw_gcoll3_t4_a: { en: 'Dolphin', ky: 'Дельфин' },
  nrw_gcoll3_t4_b: { en: 'Penguin 🐧', ky: 'Пингвин 🐧' },
  nrw_gcoll3_t4_c: { en: 'Polar bear', ky: 'Ак аю' },
  nrw_gcoll3_a1_q: { en: 'Is a polar bear white or black?', ky: 'Ак аю акпы же карабы?' },
  nrw_gcoll3_a1_a: { en: 'White', ky: 'Ак' },
  nrw_gcoll3_a1_b: { en: 'Black', ky: 'Кара' },

  // garden-anim-l1
  nrw_ganiml1_t1_q: {
    en: 'Tali visits a farm and sees an animal with a big udder. Who gives milk?',
    ky: 'Тали фермага барып, чоң желиндуу жаныбарды көрөт. Ким сүт берет?',
  },
  nrw_ganiml1_t1_a: { en: 'Cat', ky: 'Мышык' },
  nrw_ganiml1_t1_b: { en: 'Cow', ky: 'Уй' },
  nrw_ganiml1_t1_c: { en: 'Dog', ky: 'Ит' },
  nrw_ganiml1_t2_a: { en: 'Yes, it lives in the forest', ky: 'Ооба, токойдо жашайт' },
  nrw_ganiml1_t2_b: { en: 'No, she is a pet!', ky: 'Жок, ал үй жаныбары!' },
  nrw_ganiml1_t3_q: {
    en: 'Tali got a voice message: “Purr… Meow! I caught a mouse!” Who sent it?',
    ky: 'Талиге үн билдирүү келди: «Мрр… Мяу! Мен чычканды кармадым!» Ким жиберди?',
  },
  nrw_ganiml1_t3_a: { en: 'Dog', ky: 'Ит' },
  nrw_ganiml1_t3_b: { en: 'Cat', ky: 'Мышык' },
  nrw_ganiml1_t3_c: { en: 'Cow', ky: 'Уй' },
  nrw_ganiml1_t4_q: {
    en: 'Tali makes a list of animals that live in his house. Who definitely belongs?',
    ky: 'Тали үйүндө жашаган жаныбарлардын тизмесин түзөт. Ким сөзсүз кирет?',
  },
  nrw_ganiml1_t4_a: { en: 'Wolf', ky: 'Карышкыр' },
  nrw_ganiml1_t4_b: { en: 'Cat', ky: 'Мышык' },
  nrw_ganiml1_t4_c: { en: 'Fox', ky: 'Түлкү' },
  nrw_ganiml1_a1_q: { en: 'Is a cat a pet?', ky: 'Мышык — үй жаныбарыбы?' },
  nrw_ganiml1_a1_a: { en: 'Yes', ky: 'Ооба' },
  nrw_ganiml1_a1_b: { en: 'No', ky: 'Жок' },

  // garden-seas-l2
  nrw_gseasl2_t1_q: {
    en: 'Tali hears drip-drip from the roof. Snow is melting. What season is it?',
    ky: 'Тали чатырдан тамчылакты угат. Кар эрийт. Кайсы мезгил?',
  },
  nrw_gseasl2_t1_a: { en: 'Winter', ky: 'Кыш' },
  nrw_gseasl2_t1_b: { en: 'Spring', ky: 'Жаз' },
  nrw_gseasl2_t1_c: { en: 'Autumn', ky: 'Күз' },
  nrw_gseasl2_t2_q: {
    en: 'Tali builds a chain: Autumn → Winter → ??? Which season is next?',
    ky: 'Тали чынжыр түзөт: Күз → Кыш → ??? Кийинки мезгил кайсы?',
  },
  nrw_gseasl2_t2_a: { en: 'Autumn', ky: 'Күз' },
  nrw_gseasl2_t2_b: { en: 'Spring', ky: 'Жаз' },
  nrw_gseasl2_t2_c: { en: 'Summer', ky: 'Жай' },
  nrw_gseasl2_t3_a: { en: 'Winter', ky: 'Кыш' },
  nrw_gseasl2_t3_b: { en: 'Spring', ky: 'Жаз' },
  nrw_gseasl2_t3_c: { en: 'Autumn', ky: 'Күз' },
  nrw_gseasl2_t4_q: {
    en: 'Tali continues: Winter → Spring → ??? What comes after spring?',
    ky: 'Тали улантат: Кыш → Жаз → ??? Жаздан кийин эмне?',
  },
  nrw_gseasl2_t4_a: { en: 'Autumn', ky: 'Күз' },
  nrw_gseasl2_t4_b: { en: 'Winter', ky: 'Кыш' },
  nrw_gseasl2_t4_c: { en: 'Summer', ky: 'Жай' },

  // garden-seas-l3
  nrw_gseasl3_t1_q: {
    en: 'Tali puts on shorts and goes swimming! Bright sun and heat. What season is it?',
    ky: 'Тали шорт кийип сууга сүзүүгө кетет! Жаркын күн, ысык. Кайсы мезгил?',
  },
  nrw_gseasl3_t1_a: { en: 'Winter', ky: 'Кыш' },
  nrw_gseasl3_t1_b: { en: 'Summer', ky: 'Жай' },
  nrw_gseasl3_t1_c: { en: 'Autumn', ky: 'Күз' },
  nrw_gseasl3_t2_a: { en: 'Winter', ky: 'Кыш' },
  nrw_gseasl3_t2_b: { en: 'Summer', ky: 'Жай' },
  nrw_gseasl3_t2_c: { en: 'Autumn', ky: 'Күз' },
  nrw_gseasl3_t3_q: {
    en: 'Tali spins the season wheel: Winter → Spring → Summer → Autumn → ??? What’s next?',
    ky: 'Тали мезгил дөңгөлөгүн айлантат: Кыш → Жаз → Жай → Күз → ??? Кийинки эмне?',
  },
  nrw_gseasl3_t3_a: { en: 'Winter', ky: 'Кыш' },
  nrw_gseasl3_t3_b: { en: 'Spring', ky: 'Жаз' },
  nrw_gseasl3_t3_c: { en: 'Summer', ky: 'Жай' },
  nrw_gseasl3_t4_a: { en: 'Spring', ky: 'Жаз' },
  nrw_gseasl3_t4_b: { en: 'Autumn', ky: 'Күз' },
  nrw_gseasl3_t4_c: { en: 'Winter', ky: 'Кыш' },
};

for (const [k, v] of Object.entries(rw)) {
  setTask(k, v);
  if (ru.data.tasks[k] != null) abaRu[`data.tasks.${k}`] = ru.data.tasks[k];
  if (v.en != null) abaEn[`data.tasks.${k}`] = v.en;
  if (v.ky != null) abaKy[`data.tasks.${k}`] = v.ky;
}
console.log('OK RW56 translations', Object.keys(rw).length);

/* Also fix remaining gcoll1 t1_q if Cyrillic in EN */
if (/[а-яА-ЯёЁ]/.test(en.data.tasks.nrw_gcoll1_t1_q || '')) {
  setTask('nrw_gcoll1_t1_q', {
    en: 'Tali picks berries. Which one is usually red?',
    ky: 'Тали жемиш терүүт. Кайсысы адатта кызыл?',
  });
}

/* ========================================================================
 * 2) Hard intros / dialogs / Q fixes
 * ======================================================================== */
setTask('g1w_schl1_q4_a', { ky: 'Бассейн (суу бассейни)' });
setTask('g1w_schl1_q4_c', { ky: 'Плита (меш)' });
// better pure KY:
setTask('g1w_schl1_q4_a', { ky: 'Суу бассейни' });
setTask('g1w_schl1_q4_c', { ky: 'Меш / плита' });

setIntro('g2m_add2l3_0_t', {
  en: 'Two-digit subtraction by place!',
  ky: 'Эки орундуу азайтуу разряддар боюнча!',
});
setIntro('g2m_add2l1_0_b', {
  ky: '20 + 30: 2 ондук + 3 ондук = 5 ондук = 50.',
});
setIntro('g2m_timesl1_0_t', { ky: '2ге көбөйтүү — эки эсе!' });
setIntro('g2m_timesl1_0_b', {
  ky: '2 × 3 дегени 3 эки жолу: 3+3=6. 2ге көбөйтүү — санды эки эсе кылуу.',
});

setIntro('g2s_anil2_0_b', {
  en: 'Feathers, a beak, two wings — the main bird traits. Sparrow, eagle, penguin — all birds! (Not all birds fly.)',
  ky: 'Перье, тумшук, эки канат — куштун негизги белгилери. Чымчык, бүркүт, пингвин — баары куш! (Бардык куштар учушпайт.)',
});
setTask('g2s_opt_has_feathers', { ky: 'Перьеси бар' });
setTask('g2s_opt_has_fur', { ky: 'Жүнү (териси) бар' });

setIntro('g2s_bdyl1_1_t', { en: 'Muscles move the body', ky: 'Булчуңдар кыймылдайт' });
setIntro('g2s_bdyl1_1_b', {
  en: 'Muscles attach to bones and move them. Want to raise your arm — a muscle contracts!',
  ky: 'Булчуңдар сөөктөргө бекитилип, аларды кыймылдатат. Колуңду көтөргүң келсе — булчуң жыйрылат!',
});

setTask('g2s_bdyl2_q4', {
  en: 'What does the brain control?',
  ky: 'Мээ эмнени башкарат?',
});
setTask('g2s_photosyn_needs', {
  ky: 'Фотосинтез үчүн керек:',
});

setIntro('g2e_schl3_1_b', {
  en: 'I don’t understand — or ask: Can you help me?',
});
setDialog('g2e_schl3_1', {
  en: 'I don’t understand. Or you can ask: Can you help me?',
});

setIntro('g3m_1000l2_0_t', { ky: '247 санын бөлүп караңыз!' });
setIntro('g3m_1000l2_0_b', {
  ky: '247 = 200 + 40 + 7. Эки жүздүк, төрт ондук, жети бирдик.',
});
setIntro('g3m_1000l2_1_t', { ky: '356 саны' });
setIntro('g3m_1000l2_1_b', {
  ky: '356 = 300 + 50 + 6. Ар бир орунду кара!',
});
setTask('g3m_num_2h_3t_5u', {
  ky: 'Санды жаз: 2 жүздүк, 3 ондук, 5 бирдик',
});

setTask('g3e_tobel1_q4', {
  en: 'Write in English: “Я счастлив” (full phrase with am)',
  ky: 'Англисче жаз: «Мен бактылуумун» (толук фраза)',
});
setTask('g3e_i_blank_happy', {
  ky: 'I ___ happy. Кайсы сөз?',
});
setTask('g3e_am_used_with', {
  ky: 'Am ким менен колдонулат:',
});

// daily-l1: align KY to meaning-check; fix t4 stem
setTask('g3e_eat_breakfast_means', {
  en: '“Eat breakfast” means:',
  ky: '“Eat breakfast” дегени:',
});
setTask('g3e_wake_up_en', {
  ky: 'Ойготкуч саат 7де шалдырайт. “Wake up” дегени:',
});
setTask('g3e_brush_teeth_en', {
  ky: 'Эртең мененкиден кийин Том тишин тазалайт. “Brush teeth” дегени:',
});
setTask('g3e_opt_wake_up_f', { ky: 'Ойгонуу' });
setTask('g3e_opt_go_sleep', { ky: 'Уктоого жатуу' });
setTask('g3e_opt_have_lunch', { ky: 'Түшкү тамактануу' });
setTask('g3e_opt_brush_teeth', { ky: 'Тишти тазалоо' });
setTask('g3e_opt_eat_breakfast', { ky: 'Эртең мененки тамактануу' });
setTask('g3e_opt_take_shower', { ky: 'Душка түшүү' });

setDialog('g3e_dailyl2_1', {
  en: '“It’s seven o’clock” — 7:00. “Half past three” — 3:30. Let’s practice!',
  ky: '«It’s seven o’clock» — саат жети. «Half past three» — 3:30. Машыгалы!',
});

// plant parts: align EN/KY to 5 including fruit
setTask('g2s_plant_parts_count', {
  en: 'How many main parts does a plant have (root, stem, leaf, flower, fruit)?',
  ky: 'Өсүмдүктүн негизги бөлүктөрү канча (тамыр, сабак, жалбырак, гүл, мөмө)?',
});
// find actual key used by g2s-plt-l1 t4
const pltMatch = worlds.match(/g2spltl1t4[\s\S]{0,200}questionKey: '([^']+)'/);
if (pltMatch) {
  const qk = pltMatch[1].replace('data.tasks.', '');
  setTask(qk, {
    en: 'How many main parts does a plant have: root, stem, leaf, flower, fruit?',
    ky: 'Өсүмдүктүн негизги бөлүктөрү канча: тамыр, сабак, жалбырак, гүл, мөмө?',
  });
  console.log('OK plt-l1 q key', qk);
}

setTask('pre_which_is_round', {
  ky: 'Мунун кайсысы тегерек?',
});

/* New option keys for MC conversions */
const opts = {
  g2s_opt_in_leaves: { ru: 'В листьях', en: 'In the leaves', ky: 'Жалбырактарда' },
  g2s_opt_in_roots: { ru: 'В корнях', en: 'In the roots', ky: 'Тамырларда' },
  g2s_opt_in_flower: { ru: 'В цветке', en: 'In the flower', ky: 'Гүлдө' },
  g2s_opt_femur: { ru: 'Бедренная', en: 'Femur (thigh bone)', ky: 'Жамбаш сөөгү (бедренная)' },
  g2s_opt_rib: { ru: 'Ребро', en: 'Rib', ky: 'Кабырга' },
  g2s_opt_skull: { ru: 'Череп', en: 'Skull', ky: 'Баш сөөк' },
  g2s_opt_brain_all: { ru: 'Всё', en: 'Everything', ky: 'Баарын' },
  g2s_opt_brain_heart: { ru: 'Только сердце', en: 'Only the heart', ky: 'Жүрөктү гана' },
  g2s_opt_brain_legs: { ru: 'Только ноги', en: 'Only the legs', ky: 'Буттарды гана' },
  g2s_opt_muscles: { ru: 'мышцы', en: 'muscles', ky: 'булчуңдар' },
  g2s_opt_bones_only: { ru: 'только кости', en: 'bones only', ky: 'сөөктөр гана' },
  g2s_opt_skin_only: { ru: 'только кожа', en: 'skin only', ky: 'тери гана' },
  g2r_opt_priznak: { ru: 'Признак предмета', en: 'A quality of a thing', ky: 'Нерсенин белгиси' },
  g2r_opt_action: { ru: 'Действие', en: 'An action', ky: 'Аракет' },
  g2r_opt_place: { ru: 'Место', en: 'A place', ky: 'Жер' },
  g3m_opt_rem_3_1: { ru: '3 остаток 1', en: '3 remainder 1', ky: '3 калдык 1' },
  g3m_opt_rem_3_0: { ru: '3 остаток 0', en: '3 remainder 0', ky: '3 калдык 0' },
  g3m_opt_rem_4_1: { ru: '4 остаток 1', en: '4 remainder 1', ky: '4 калдык 1' },
  g3m_opt_rem_3_2: { ru: '3 остаток 2', en: '3 remainder 2', ky: '3 калдык 2' },
  g3m_opt_rem_2_3: { ru: '2 остаток 3', en: '2 remainder 3', ky: '2 калдык 3' },
  g3m_opt_rem_4_2: { ru: '4 остаток 2', en: '4 remainder 2', ky: '4 калдык 2' },
  g3w_opt_east: { ru: 'Восток', en: 'East', ky: 'Чыгыш' },
  g3w_opt_west: { ru: 'Запад', en: 'West', ky: 'Батыш' },
  g3w_opt_south: { ru: 'Юг', en: 'South', ky: 'Түштүк' },
  g3w_opt_oak: { ru: 'Дуб', en: 'Oak', ky: 'Эмен' },
  g3w_opt_caterpillar: { ru: 'Гусеница', en: 'Caterpillar', ky: 'Курт' },
  g3w_opt_hawk: { ru: 'Ястреб', en: 'Hawk', ky: 'Карчыга' },
  g3e_opt_water_drink: { ru: 'Воду', en: 'Water', ky: 'Суу' },
  g3e_opt_juice_drink: { ru: 'Сок', en: 'Juice', ky: 'Шире' },
  g3e_opt_milk_drink: { ru: 'Молоко', en: 'Milk', ky: 'Сүт' },
  g3e_opt_i_am_happy: { ru: 'I am happy', en: 'I am happy', ky: 'I am happy' },
  g3e_opt_i_is_happy: { ru: 'I is happy', en: 'I is happy', ky: 'I is happy' },
  g3e_opt_i_are_happy: { ru: 'I are happy', en: 'I are happy', ky: 'I are happy' },
  g2e_opt_thanks_alot: { ru: 'Большое спасибо', en: 'Thanks a lot', ky: 'Чоң рахмат' },
  g2e_opt_youre_welcome: { ru: 'Пожалуйста', en: 'You’re welcome', ky: 'Өтүнөмүн / сураныч' },
  g2e_opt_hello_phr: { ru: 'Привет', en: 'Hello', ky: 'Салам' },
  g2e_opt_no_sandwich_ru: {
    ru: 'Нет, тебе нельзя есть мой бутерброд',
    en: 'No, you can’t eat my sandwich (RU: «Нет, тебе нельзя…»)',
    ky: 'Жок, сен менин сэндвичимди жей албайсың',
  },
  g2e_opt_yes_sandwich_ru: {
    ru: 'Да, ешь мой бутерброд',
    en: 'Yes, eat my sandwich',
    ky: 'Ооба, сэндвичимди же',
  },
  g2e_opt_hello_sandwich_ru: {
    ru: 'Привет, бутерброд',
    en: 'Hello, sandwich',
    ky: 'Салам, сэндвич',
  },
  // gloss Russian grammar targets for EN/KY
  g2r_opt_sidit: { en: 'Сидит (sits — predicate)', ky: 'Сидит (оттурат — баяндооч)' },
  g2r_opt_koshka: { en: 'Кошка (cat — subject)', ky: 'Кошка (мышык — ээ)' },
  g2r_opt_krasivyi: { en: 'Красивый (beautiful — adjective)', ky: 'Красивый (сулуу — сын атооч)' },
  g2r_opt_obst: { en: 'Обстоятельство (adverbial — how?/where?)', ky: 'Обстоятельство (быстро — кандай?/кайда?)' },
  g2r_opt_opred: { en: 'Определение (attribute)', ky: 'Определение (аныктооч)' },
  g2r_opt_dopol: { en: 'Дополнение (object)', ky: 'Дополнение (толуктооч)' },
  g2s_opt_gills: { en: 'Gills', ky: 'Желбезек (жабры)' },
  g2s_opt_lungs: { en: 'Lungs', ky: 'Өпкө' },
  g2s_opt_skin: { en: 'Skin', ky: 'Тери' },
  g3w_opt_evaporation: { en: 'Evaporation', ky: 'Буулануу' },
  g3w_min_opt_build: { en: 'Building materials', ky: 'Курулуш' },
  g3w_min_opt_burn: { en: 'Fuel', ky: 'Отун' },
  g3w_min_opt_metalz: { en: 'Metal ores', ky: 'Металл кендери' },
  g3e_opt_breakfast_ru: { en: 'To have breakfast', ky: 'Эртең мененки тамактануу' },
  g3e_opt_dinner_ru: { en: 'To have lunch/dinner', ky: 'Түшкү тамактануу' },
  g3e_opt_supper_ru: { en: 'To have supper', ky: 'Кечки тамактануу' },
};

for (const [k, v] of Object.entries(opts)) {
  setTask(k, v);
}

/* Fix daily-l1 KY flipped tasks if present */
const dailyKeys = Object.keys(ru.data.tasks).filter((k) => k.startsWith('g3e_daily1') || k.includes('wake_up') || k.includes('get_up'));
console.log('daily-related keys sample', dailyKeys.slice(0, 20));

/* ========================================================================
 * 3) worlds.ts input → MC
 * ======================================================================== */
const mc = (id, qKey, opts3, label) => {
  if (worlds.includes(`id: '${id}', type: 'multiple_choice'`)) {
    console.log('SKIP already MC', label);
    return;
  }
  const [a, b, c] = opts3;
  const oldRe = new RegExp(
    `\\{ id: '${id}', type: 'input', questionKey: '${qKey.replace(/\./g, '\\.')}', difficulty: (\\d+), answer: "[^"]*" \\}`,
  );
  const m = worlds.match(oldRe);
  if (!m) {
    const oldRe2 = new RegExp(
      `\\{ id: '${id}', type: 'input', questionKey: '${qKey.replace(/\./g, '\\.')}', difficulty: (\\d+), answer: '[^']*' \\}`,
    );
    const m2 = worlds.match(oldRe2);
    if (!m2) {
      console.error('MISSING MC', label, id);
      process.exitCode = 1;
      return;
    }
    worlds = worlds.replace(
      m2[0],
      `{ id: '${id}', type: 'multiple_choice', questionKey: '${qKey}', difficulty: ${m2[1]}, options: [{ id: 'a', textKey: 'data.tasks.${a.key}', correct: ${a.ok} }, { id: 'b', textKey: 'data.tasks.${b.key}', correct: ${b.ok} }, { id: 'c', textKey: 'data.tasks.${c.key}', correct: ${c.ok} }] }`,
    );
    console.log('OK', label);
    return;
  }
  worlds = worlds.replace(
    m[0],
    `{ id: '${id}', type: 'multiple_choice', questionKey: '${qKey}', difficulty: ${m[1]}, options: [{ id: 'a', textKey: 'data.tasks.${a.key}', correct: ${a.ok} }, { id: 'b', textKey: 'data.tasks.${b.key}', correct: ${b.ok} }, { id: 'c', textKey: 'data.tasks.${c.key}', correct: ${c.ok} }] }`,
  );
  console.log('OK', label);
};

const mc2 = (id, qKey, opts2, label) => {
  if (worlds.includes(`id: '${id}', type: 'multiple_choice'`)) {
    console.log('SKIP already MC', label);
    return;
  }
  const [a, b] = opts2;
  const oldRe = new RegExp(
    `\\{ id: '${id}', type: 'input', questionKey: '${qKey.replace(/\./g, '\\.')}', difficulty: (\\d+), answer: "[^"]*" \\}`,
  );
  const m = worlds.match(oldRe);
  if (!m) {
    console.error('MISSING MC2', label, id);
    process.exitCode = 1;
    return;
  }
  worlds = worlds.replace(
    m[0],
    `{ id: '${id}', type: 'multiple_choice', questionKey: '${qKey}', difficulty: ${m[1]}, options: [{ id: 'a', textKey: 'data.tasks.${a.key}', correct: ${a.ok} }, { id: 'b', textKey: 'data.tasks.${b.key}', correct: ${b.ok} }] }`,
  );
  console.log('OK', label);
};

mc(
  'mshl3-t4',
  'data.tasks.pre_which_shape_no_corners',
  [
    { key: 'opt_circle', ok: true },
    { key: 'opt_square', ok: false },
    { key: 'opt_triangle', ok: false },
  ],
  'meadow-sh-l3 t4',
);
mc2(
  'g2rspl2t4',
  'data.tasks.g2r_verb_changes_time',
  [
    { key: 'opt_yes', ok: true },
    { key: 'opt_no', ok: false },
  ],
  'g2r-sp-l2 t4',
);
mc(
  'g2rspl3t4',
  'data.tasks.g2r_adj_describes',
  [
    { key: 'g2r_opt_priznak', ok: true },
    { key: 'g2r_opt_action', ok: false },
    { key: 'g2r_opt_place', ok: false },
  ],
  'g2r-sp-l3 t4',
);
mc(
  'g2rsentl1t4',
  'data.tasks.g2r_sentl1_predicate_q',
  [
    { key: 'g2r_opt_sidit', ok: true },
    { key: 'g2r_opt_koshka', ok: false },
    { key: 'g2r_opt_krasivyi', ok: false },
  ],
  'g2r-sent-l1 t4',
);
mc(
  'g2rsentl2t4',
  'data.tasks.g2r_sentl2_q4',
  [
    { key: 'g2r_opt_obst', ok: true },
    { key: 'g2r_opt_opred', ok: false },
    { key: 'g2r_opt_dopol', ok: false },
  ],
  'g2r-sent-l2 t4',
);
mc(
  'g2spltl2t4',
  'data.tasks.g2s_seed_grows_into',
  [
    { key: 'g2s_opt_in_leaves', ok: true },
    { key: 'g2s_opt_in_roots', ok: false },
    { key: 'g2s_opt_in_flower', ok: false },
  ],
  'g2s-plt-l2 t4',
);
mc2(
  'g2sanil1t4',
  'data.tasks.g2s_bat_mammal',
  [
    { key: 'opt_yes', ok: true },
    { key: 'opt_no', ok: false },
  ],
  'g2s-ani-l1 t4',
);
mc2(
  'g2sanil2t4',
  'data.tasks.g2s_all_birds_fly',
  [
    { key: 'opt_yes', ok: false },
    { key: 'opt_no', ok: true },
  ],
  'g2s-ani-l2 t4',
);
mc(
  'g2sanil3t4',
  'data.tasks.g2s_anil3_q4',
  [
    { key: 'g2s_opt_gills', ok: true },
    { key: 'g2s_opt_lungs', ok: false },
    { key: 'g2s_opt_skin', ok: false },
  ],
  'g2s-ani-l3 t4',
);
mc(
  'g2sbdyl1t4',
  'data.tasks.g2s_biggest_bone',
  [
    { key: 'g2s_opt_femur', ok: true },
    { key: 'g2s_opt_rib', ok: false },
    { key: 'g2s_opt_skull', ok: false },
  ],
  'g2s-bdy-l1 t4',
);
mc(
  'g2sbdyl2t4',
  'data.tasks.g2s_bdyl2_q4',
  [
    { key: 'g2s_opt_brain_all', ok: true },
    { key: 'g2s_opt_brain_heart', ok: false },
    { key: 'g2s_opt_brain_legs', ok: false },
  ],
  'g2s-bdy-l2 t4',
);
mc(
  'g2sbdyl3t4',
  'data.tasks.g2s_sport_good',
  [
    { key: 'g2s_opt_muscles', ok: true },
    { key: 'g2s_opt_bones_only', ok: false },
    { key: 'g2s_opt_skin_only', ok: false },
  ],
  'g2s-bdy-l3 t4',
);
mc(
  'g2ephrl1t4',
  'data.tasks.g2e_phrl1_q4',
  [
    { key: 'g2e_opt_thanks_alot', ok: true },
    { key: 'g2e_opt_youre_welcome', ok: false },
    { key: 'g2e_opt_hello_phr', ok: false },
  ],
  'g2e-phr-l1 t4',
);
mc(
  'g2ephrl3t4',
  'data.tasks.g2e_phr3_q4',
  [
    { key: 'g2e_opt_no_sandwich_ru', ok: true },
    { key: 'g2e_opt_yes_sandwich_ru', ok: false },
    { key: 'g2e_opt_hello_sandwich_ru', ok: false },
  ],
  'g2e-phr-l3 t4',
);
mc(
  'g3mdivl2t3',
  'data.tasks.g3m_div_l2_q3',
  [
    { key: 'g3m_opt_rem_3_1', ok: true },
    { key: 'g3m_opt_rem_3_0', ok: false },
    { key: 'g3m_opt_rem_4_1', ok: false },
  ],
  'g3m-div-l2 t3',
);
mc(
  'g3mdivl2t4',
  'data.tasks.g3m_div_l2_q4',
  [
    { key: 'g3m_opt_rem_3_2', ok: true },
    { key: 'g3m_opt_rem_2_3', ok: false },
    { key: 'g3m_opt_rem_4_2', ok: false },
  ],
  'g3m-div-l2 t4',
);
mc(
  'g3wgeol1t4',
  'data.tasks.g3w_compass_q4',
  [
    { key: 'g3w_opt_east', ok: true },
    { key: 'g3w_opt_west', ok: false },
    { key: 'g3w_opt_south', ok: false },
  ],
  'g3w-geo-l1 t4',
);
mc(
  'g3wnatl1t4',
  'data.tasks.g3w_natl1_q4',
  [
    { key: 'g3w_opt_evaporation', ok: true },
    { key: 'g3w_opt_explosion', ok: false },
    { key: 'g3w_opt_erosion', ok: false },
  ],
  'g3w-nat-l1 t4',
);
mc(
  'g3wnatl2t4',
  'data.tasks.g3w_min_q4',
  [
    { key: 'g3w_min_opt_build', ok: true },
    { key: 'g3w_min_opt_burn', ok: false },
    { key: 'g3w_min_opt_metalz', ok: false },
  ],
  'g3w-nat-l2 t4',
);
mc(
  'g3wecol2t4',
  'data.tasks.g3w_ecol2_q4',
  [
    { key: 'g3w_opt_oak', ok: true },
    { key: 'g3w_opt_caterpillar', ok: false },
    { key: 'g3w_opt_hawk', ok: false },
  ],
  'g3w-eco-l2 t4',
);
mc(
  'g3efoodl1t4',
  'data.tasks.g3e_food1_q4',
  [
    { key: 'g3e_opt_water_drink', ok: true },
    { key: 'g3e_opt_juice_drink', ok: false },
    { key: 'g3e_opt_milk_drink', ok: false },
  ],
  'g3e-food-l1 t4',
);
mc(
  'g3etobel1t4',
  'data.tasks.g3e_tobel1_q4',
  [
    { key: 'g3e_opt_i_am_happy', ok: true },
    { key: 'g3e_opt_i_is_happy', ok: false },
    { key: 'g3e_opt_i_are_happy', ok: false },
  ],
  'g3e-tobe-l1 t4',
);
mc(
  'g3edailyl1t4',
  'data.tasks.g3e_eat_breakfast_means',
  [
    { key: 'g3e_opt_breakfast_ru', ok: true },
    { key: 'g3e_opt_dinner_ru', ok: false },
    { key: 'g3e_opt_supper_ru', ok: false },
  ],
  'g3e-daily-l1 t4',
);

/* Ensure g3w explosion/erosion distractors stay as curriculum wrong-answers (do not rename). */
/* Soften sport_good question for MC */
setTask('g2s_sport_good', {
  ru: 'Арчи не хочет делать зарядку. Зачем нужны зарядка и спорт?',
  en: 'Archie doesn’t want to exercise. Why do we need exercise and sport?',
  ky: 'Арчи зарядка кылгысы келбейт. Зарядка жана спорт эмне үчүн керек?',
});

/* g2e phr questions clearer for localized options */
setTask('g2e_phrl1_q4', {
  en: '“Thank you very much” means:',
  ky: '“Thank you very much” дегени:',
});
setTask('g2e_phr3_q4', {
  en: 'Translate: “No, you can’t eat my sandwich!”',
  ky: 'Котор: “No, you can’t eat my sandwich!”',
});

/* Sync ABA for new/changed common keys */
function syncAba(section, keys) {
  for (const k of keys) {
    const full = `data.${section}.${k}`;
    if (ru.data[section]?.[k] != null) abaRu[full] = ru.data[section][k];
    if (en.data[section]?.[k] != null) abaEn[full] = en.data[section][k];
    if (ky.data[section]?.[k] != null) abaKy[full] = ky.data[section][k];
  }
}
syncAba('tasks', Object.keys(opts));
syncAba('intro', [
  'g2m_add2l3_0_t',
  'g2m_add2l1_0_b',
  'g2m_timesl1_0_t',
  'g2m_timesl1_0_b',
  'g2s_anil2_0_b',
  'g2s_bdyl1_1_t',
  'g2s_bdyl1_1_b',
  'g2e_schl3_1_b',
  'g3m_1000l2_0_t',
  'g3m_1000l2_0_b',
  'g3m_1000l2_1_t',
  'g3m_1000l2_1_b',
]);
syncAba('dialog', ['g2e_schl3_1', 'g3e_dailyl2_1']);

fs.writeFileSync(worldsPath, worlds, 'utf8');
save('ru.json', ru);
save('en.json', en);
save('ky.json', ky);
save('abaTextOverrides.generated.json', abaRu);
save('abaTextOverrides.en.generated.json', abaEn);
save('abaTextOverrides.ky.generated.json', abaKy);
console.log('DONE enky48 pass');
