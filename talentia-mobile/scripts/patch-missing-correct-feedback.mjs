import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const corrects = {
  g4s_emo_l1_t1: {
    ru: 'Верно! Опущенные плечи и тихий голос чаще всего говорят о грусти.',
    en: 'Right! Slumped shoulders and a quiet voice usually mean sadness.',
    ky: 'Туура! Салбыраган ийиндер жана тынч үн көбүнчө кайгыны билдирет.',
  },
  mc10l2_t3: {
    ru: 'Да! Ты нашёл правило ряда — молодец!',
    en: 'Yes! You found the pattern — well done!',
    ky: 'Ооба! Сен катардын эрежесин таптың — жакшы!',
  },
};

for (const loc of ['ru', 'en', 'ky']) {
  const p = path.join(root, 'src', 'i18n', 'locales', `${loc}.json`);
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  for (const [k, langs] of Object.entries(corrects)) {
    data.data.taskFeedback.byTaskId[k] = {
      ...(data.data.taskFeedback.byTaskId[k] || {}),
      correct: langs[loc],
    };
  }
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
}
console.log('ok');
