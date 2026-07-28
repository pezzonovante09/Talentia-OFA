/**
 * Spot fix meadow-sh-l2 (dedicated keys — do not touch meadow-sh-l1 shared keys).
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

const worldsPath = path.join(root, 'src/data/worlds.ts');
let worlds = fs.readFileSync(worldsPath, 'utf8');

const oldBlock = `    { id: 'mshl2-t1', type: 'multiple_choice', questionKey: 'data.tasks.pre_square_sides_count', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_three', correct: false }, { id: 'b', textKey: 'data.tasks.opt_four', correct: true }, { id: 'c', textKey: 'data.tasks.opt_five', correct: false }] },
    { id: 'mshl2-t2', type: 'multiple_choice', questionKey: 'data.tasks.pre_door_shape', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_circle', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_rectangle', correct: true }, { id: 'c', textKey: 'data.tasks.opt_triangle', correct: false }] },
    { id: 'mshl2-t3', type: 'multiple_choice', questionKey: 'data.tasks.pre_which_has_4_corners', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_circle', correct: false }, { id: 'b', textKey: 'data.tasks.opt_triangle', correct: false }, { id: 'c', textKey: 'data.tasks.opt_square', correct: true }] },
    { id: 'mshl2-t4', type: 'input', questionKey: 'data.tasks.pre_find_square_in_room', difficulty: 2, answer: "Игральная кость" },`;

const newBlock = `    { id: 'mshl2-t1', type: 'multiple_choice', questionKey: 'data.tasks.mshl2_triangle_sides_q', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_three', correct: true }, { id: 'b', textKey: 'data.tasks.opt_four', correct: false }, { id: 'c', textKey: 'data.tasks.opt_five', correct: false }] },
    { id: 'mshl2-t2', type: 'multiple_choice', questionKey: 'data.tasks.pre_door_shape', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_circle', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_rectangle', correct: true }, { id: 'c', textKey: 'data.tasks.opt_triangle', correct: false }] },
    { id: 'mshl2-t3', type: 'multiple_choice', questionKey: 'data.tasks.mshl2_four_corners_q', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_circle', correct: false }, { id: 'b', textKey: 'data.tasks.opt_triangle', correct: false }, { id: 'c', textKey: 'data.tasks.pre_opt_rectangle', correct: true }] },
    { id: 'mshl2-t4', type: 'input', questionKey: 'data.tasks.mshl2_rect_in_room_q', difficulty: 2, answer: "Книга" },`;

if (!worlds.includes(oldBlock)) {
  console.error('MISSING meadow-sh-l2 task block');
  process.exit(1);
}
worlds = worlds.replace(oldBlock, newBlock);
fs.writeFileSync(worldsPath, worlds, 'utf8');
console.log('OK worlds.ts meadow-sh-l2');

const patches = {
  ru: {
    mshl2_triangle_sides_q: 'Сколько сторон у треугольника?',
    mshl2_four_corners_q: 'У какой фигуры 4 угла?',
    mshl2_rect_in_room_q: 'Что больше всего похоже на прямоугольник: мяч, книга или дверь?',
  },
  en: {
    mshl2_triangle_sides_q: 'How many sides does a triangle have?',
    mshl2_four_corners_q: 'Which shape has 4 corners?',
    mshl2_rect_in_room_q: 'Which is most like a rectangle: a ball, a book, or a door?',
  },
  ky: {
    mshl2_triangle_sides_q: 'Үч бурчтуктун канча жагы бар?',
    mshl2_four_corners_q: 'Кайсы фигурада 4 бурч бар?',
    mshl2_rect_in_room_q: 'Кайсысы тик бурчтукка көбүрөөк окшош: топ, китеп же эшик?',
  },
};

const ru = load('ru.json');
const en = load('en.json');
const ky = load('ky.json');
const abaRu = load('abaTextOverrides.generated.json');
const abaEn = load('abaTextOverrides.en.generated.json');
const abaKy = load('abaTextOverrides.ky.generated.json');

for (const [lang, map] of Object.entries(patches)) {
  const doc = lang === 'ru' ? ru : lang === 'en' ? en : ky;
  Object.assign(doc.data.tasks, map);
}
for (const k of Object.keys(patches.ru)) {
  abaRu[`data.tasks.${k}`] = ru.data.tasks[k];
  abaEn[`data.tasks.${k}`] = en.data.tasks[k];
  abaKy[`data.tasks.${k}`] = ky.data.tasks[k];
}

save('ru.json', ru);
save('en.json', en);
save('ky.json', ky);
save('abaTextOverrides.generated.json', abaRu);
save('abaTextOverrides.en.generated.json', abaEn);
save('abaTextOverrides.ky.generated.json', abaKy);
console.log('OK locales + ABA');

// verify l1 untouched
if (!worlds.includes("id: 'mshl1-t3', type: 'multiple_choice', questionKey: 'data.tasks.pre_square_sides_count'")) {
  console.error('BROKE meadow-sh-l1');
  process.exit(1);
}
console.log('OK meadow-sh-l1 still uses shared square keys');
