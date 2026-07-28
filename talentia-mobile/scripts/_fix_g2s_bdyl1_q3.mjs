import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src/i18n/locales');
const texts = {
  ru: 'Тали задаёт провокационный вопрос: «Без мышц человек мог бы двигаться?»',
  en: 'Tali asks a tricky question: "Could a person move without muscles?"',
  ky: 'Тали кызык суроо берет: «Булчуңсуз адам кыймылдай алабы?»',
};
for (const [loc, text] of Object.entries(texts)) {
  const p = path.join(dir, `${loc}.json`);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  j.data.tasks.g2s_bdyl1_q3 = text;
  fs.writeFileSync(p, `${JSON.stringify(j, null, 2)}\n`);
  console.log(loc, 'ok');
}
