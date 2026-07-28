import fs from 'fs';
const worlds = fs.readFileSync('src/data/worlds.ts', 'utf8');
const ru = JSON.parse(fs.readFileSync('src/i18n/locales/ru.json', 'utf8'));
function get(o, k) {
  let c = o;
  for (const p of k.split('.')) c = c?.[p];
  return c;
}
const g4 = JSON.parse(fs.readFileSync('scripts/_reaudit2_ids_g4.json', 'utf8'));
for (const m of g4) {
  const idx = worlds.indexOf(`id: '${m.id}'`);
  if (idx < 0) continue;
  let start = idx;
  while (start > 0 && worlds[start] !== '{') start--;
  let depth = 0;
  let end = start;
  for (let j = start; j < worlds.length; j++) {
    if (worlds[j] === '{') depth++;
    else if (worlds[j] === '}') {
      depth--;
      if (depth === 0) {
        end = j + 1;
        break;
      }
    }
  }
  const block = worlds.slice(start, end);
  for (const im of block.matchAll(
    /id: '([^']+)',\s*type: '(input|fill_blank)'[\s\S]{0,400}?(?:answer: ["']([^"']+)["']|correctAnswerKey: '([^']+)')/g
  )) {
    if (/special_aba/.test(im[0])) continue;
    const ans = im[3] || (im[4] ? get(ru, im[4]) : '?');
    const qk = (im[0].match(/questionKey: '([^']+)'/) || [])[1];
    console.log(`${m.id}\t${im[1]}\t${im[2]}\tA=${ans}\tQ=${String(get(ru, qk) || '').slice(0, 90)}`);
  }
}
