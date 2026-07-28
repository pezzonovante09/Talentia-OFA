import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'src/data/worlds.ts'), 'utf8');
const lines = src.split('\n');
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));
const t = (key) => { const parts = key.replace(/^data\./, '').split('.'); let cur = ru.data; for (const p of parts) { cur = cur?.[p]; if (cur === undefined) return '<MISS>'; } return cur; };

for (const id of process.argv.slice(2)) {
  const li = lines.findIndex((l) => l.includes(`id: '${id}',`));
  if (li < 0) { console.log('!! ' + id); continue; }
  // capture dialog array on this or next lines until intro
  let block = '';
  for (let i = li; i < li + 12 && i < lines.length; i++) block += lines[i] + '\n';
  console.log('\n### ' + id + ' (L' + (li + 1) + ')');
  const dlgMatch = block.match(/dialog:\s*\[([\s\S]*?)\]/);
  if (!dlgMatch) { console.log('  no dialog'); continue; }
  for (const m of dlgMatch[1].matchAll(/speaker:\s*'(\w+)',\s*textKey:\s*'([^']+)'/g)) {
    console.log('  [' + m[1] + '] ' + t(m[2]));
  }
}
