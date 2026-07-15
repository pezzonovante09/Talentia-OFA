/**
 * Заполняет ru/en/ky строки для data.dialog.* и data.intro.* всех уроков g4
 * (после inject-g4-intros-dialog.mjs). Тексты привязаны к названию урока из локали.
 *
 *   npx tsx scripts/seed-g4-dialog-intro-locales.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { worlds } from '../src/data/worlds';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function getByKey(doc: Record<string, unknown>, dotted: string): string | undefined {
  const parts = dotted.split('.');
  let cur: unknown = doc;
  for (const p of parts) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === 'string' ? cur : undefined;
}

function setDeep(
  doc: Record<string, unknown>,
  dotted: string,
  value: string,
): void {
  const parts = dotted.split('.');
  let cur: unknown = doc;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur === null || typeof cur !== 'object') throw new Error(dotted);
    const o = cur as Record<string, unknown>;
    if (!(p in o)) o[p] = {};
    cur = o[p];
  }
  const last = parts[parts.length - 1];
  (cur as Record<string, unknown>)[last] = value;
}

function kyCopy(ru: string): string {
  return ru;
}

function main() {
  const ruPath = path.join(root, 'src', 'i18n', 'locales', 'ru.json');
  const enPath = path.join(root, 'src', 'i18n', 'locales', 'en.json');
  const kyPath = path.join(root, 'src', 'i18n', 'locales', 'ky.json');
  const ru = JSON.parse(fs.readFileSync(ruPath, 'utf8')) as Record<string, unknown>;
  const en = JSON.parse(fs.readFileSync(enPath, 'utf8')) as Record<string, unknown>;
  const ky = JSON.parse(fs.readFileSync(kyPath, 'utf8')) as Record<string, unknown>;

  let count = 0;
  for (const world of worlds) {
    if (!world.id.startsWith('g4')) continue;
    for (const topic of world.topics) {
      for (const lesson of topic.lessons) {
        if (!lesson.id.startsWith('g4') || !lesson.dialog?.length || !lesson.intro?.length) continue;
        const title = getByKey(ru, lesson.titleKey) ?? lesson.titleKey;
        const slug = lesson.id.replace(/-/g, '_');

        const ruD0 = `Привет! Урок «${title}». Сейчас коротко вспомним правило — и к заданиям.`;
        const ruD1 = `Я Тали: читай задания внимательно, можно проговаривать вслух.`;
        const ruI0t = `Коротко о теме`;
        const ruI0b = `Мы повторим главное для урока «${title}» и посмотрим на типичный пример.`;
        const ruI1t = `Как проходить задания`;
        const ruI1b = `Читай условие до конца, выбери ответ. Если что-то непонятно — нажми «Помощь».`;

        setDeep(ru, `data.dialog.${slug}_0`, ruD0);
        setDeep(ru, `data.dialog.${slug}_1`, ruD1);
        setDeep(ru, `data.intro.${slug}_0_t`, ruI0t);
        setDeep(ru, `data.intro.${slug}_0_b`, ruI0b);
        setDeep(ru, `data.intro.${slug}_1_t`, ruI1t);
        setDeep(ru, `data.intro.${slug}_1_b`, ruI1b);

        const enD0 = `Hi! Lesson: «${title}». We'll review the key idea, then practice.`;
        const enD1 = `I'm Tali: read each task carefully. You can say the words out loud.`;
        const enI0t = `About this topic`;
        const enI0b = `We'll recap what matters for «${title}» and look at a quick example.`;
        const enI1t = `How the tasks work`;
        const enI1b = `Read the full prompt, then pick an answer. Tap Help if you need a hint.`;

        setDeep(en, `data.dialog.${slug}_0`, enD0);
        setDeep(en, `data.dialog.${slug}_1`, enD1);
        setDeep(en, `data.intro.${slug}_0_t`, enI0t);
        setDeep(en, `data.intro.${slug}_0_b`, enI0b);
        setDeep(en, `data.intro.${slug}_1_t`, enI1t);
        setDeep(en, `data.intro.${slug}_1_b`, enI1b);

        setDeep(ky, `data.dialog.${slug}_0`, kyCopy(ruD0));
        setDeep(ky, `data.dialog.${slug}_1`, kyCopy(ruD1));
        setDeep(ky, `data.intro.${slug}_0_t`, kyCopy(ruI0t));
        setDeep(ky, `data.intro.${slug}_0_b`, kyCopy(ruI0b));
        setDeep(ky, `data.intro.${slug}_1_t`, kyCopy(ruI1t));
        setDeep(ky, `data.intro.${slug}_1_b`, kyCopy(ruI1b));

        count += 1;
      }
    }
  }

  fs.writeFileSync(ruPath, `${JSON.stringify(ru, null, 2)}\n`, 'utf8');
  fs.writeFileSync(enPath, `${JSON.stringify(en, null, 2)}\n`, 'utf8');
  fs.writeFileSync(kyPath, `${JSON.stringify(ky, null, 2)}\n`, 'utf8');
  console.log(`Seeded dialog+intro for ${count} g4 lessons in ru, en, ky`);
}

main();
