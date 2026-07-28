import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'src/data/worlds.ts'), 'utf8');
const lines = src.split('\n');
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));
const t = (key) => { const parts = key.replace(/^data\./, '').split('.'); let cur = ru.data; for (const p of parts) { cur = cur?.[p]; if (cur === undefined) return '<MISS>'; } return cur; };

const ids = process.argv.slice(2);
const result = [];
for (const id of ids) {
  const li = lines.findIndex((l) => l.includes(`id: '${id}',`));
  if (li < 0) { console.log('!! not found ' + id); continue; }
  let block = '';
  for (let i = li; i < li + 14 && i < lines.length; i++) block += lines[i] + '\n';
  const dlgMatch = block.match(/dialog:\s*\[([\s\S]*?)\]/);
  if (!dlgMatch) { console.log(id + ': NO DIALOG'); continue; }
  const entries = [...dlgMatch[1].matchAll(/speaker:\s*'(\w+)',\s*textKey:\s*'([^']+)'/g)].map((m) => ({ speaker: m[1], key: m[2], txt: t(m[2]) }));
  // detection: a 'tali'-labeled line that addresses Тали (mentor mislabeled) OR
  // an 'npc'-labeled line that is student self-speech (rare)
  const taliAddressesTali = entries.some((e) => e.speaker === 'tali' && /(^|["«\s])Тали[,!.\s]/.test(e.txt));
  const npcAddressesTali = entries.some((e) => e.speaker === 'npc' && /(^|["«\s])Тали[,!.\s]/.test(e.txt));
  const swap = taliAddressesTali && !npcAddressesTali;
  result.push({ id, n: entries.length, swap, taliAddressesTali, npcAddressesTali });
  console.log(`${id} entries=${entries.length} swap=${swap ? 'YES' : 'no'}${entries.length !== 2 ? ' [NON2]' : ''}`);
  for (const e of entries) console.log(`   [${e.speaker}] ${e.txt.slice(0, 90)}`);
}
const need = result.filter((r) => r.swap).map((r) => r.id);
const non2 = result.filter((r) => r.n !== 2).map((r) => r.id);
console.log('\nSWAP (' + need.length + '): ' + need.join(' '));
console.log('NON-2-ENTRY (' + non2.length + '): ' + non2.join(' '));
console.log('NO-SWAP (' + result.filter((r) => !r.swap).map((r) => r.id).join(' ') + ')');
fs.writeFileSync(path.join(root, 'scripts/_g4_swap_list.json'), JSON.stringify(need, null, 2));
