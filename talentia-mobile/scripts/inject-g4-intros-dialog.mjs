/**
 * Добавляет в worlds.ts для каждого урока g4* поля dialog и intro с ключами
 * data.dialog.<slug>_0|1 и data.intro.<slug>_0_t|0_b|1_t|1_b, где slug = lessonId с '-' → '_'.
 *
 * Идемпотентно: если вставка уже была (после `reward` идут `dialog` / `intro`), совпадений не будет —
 * скрипт завершится с кодом 0 и подсказкой. Повторный запуск не портит файл.
 *
 * Запуск (из talentia-mobile): node scripts/inject-g4-intros-dialog.mjs
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const worldsPath = path.join(__dirname, '..', 'src', 'data', 'worlds.ts');
let src = fs.readFileSync(worldsPath, 'utf8');

const re =
  /\{ id: '(g4[^']+)', (topicId: '[^']+'), (titleKey: '[^']+'), reward: \{ xp: 30 \}, tasks: \[/g;

let n = 0;
src = src.replace(re, (full, lessonId, topicId, titleKey) => {
  const slug = lessonId.replace(/-/g, '_');
  n += 1;
  return `{ id: '${lessonId}', ${topicId}, ${titleKey}, reward: { xp: 30 },
          dialog: [
            { speaker: 'npc', textKey: 'data.dialog.${slug}_0' },
            { speaker: 'tali', textKey: 'data.dialog.${slug}_1' },
          ],
          intro: [
            { titleKey: 'data.intro.${slug}_0_t', bodyKey: 'data.intro.${slug}_0_b', emoji: '' },
            { titleKey: 'data.intro.${slug}_1_t', bodyKey: 'data.intro.${slug}_1_b', emoji: '' },
          ],
          tasks: [`;
});

if (!n) {
  const already =
    /data\.dialog\.g4m_md_l1_0/.test(src) ||
    (/id: 'g4m-md-l1'/.test(src) && /dialog:\s*\[/.test(src));
  if (already) {
    console.log(
      'Нечего вставлять: уроки g4 уже содержат dialog/intro (или тот же формат). Повторный запуск не нужен.',
    );
    process.exit(0);
  }
  console.error(
    'Не найдено ни одного блока вида `{ id: \'g4…\', …, reward: { xp: 30 }, tasks: [` — проверьте формат worlds.ts.',
  );
  process.exit(1);
}
fs.writeFileSync(worldsPath, src, 'utf8');
console.log(`Injected dialog+intro into ${n} g4 lessons → ${worldsPath}`);
