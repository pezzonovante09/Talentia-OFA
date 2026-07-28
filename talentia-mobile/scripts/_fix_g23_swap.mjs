import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const wp = path.join(root, 'src/data/worlds.ts');
let src = fs.readFileSync(wp, 'utf8');
const swapIds = JSON.parse(fs.readFileSync(path.join(root, 'scripts/_g23_swap_list.json'), 'utf8'));

let ok = 0, fail = 0;
for (const id of swapIds) {
  const idIdx = src.indexOf(`id: '${id}',`);
  if (idIdx < 0) { console.log('FAIL not found: ' + id); fail++; continue; }
  const dlgStart = src.indexOf('dialog: [', idIdx);
  if (dlgStart < 0 || dlgStart > idIdx + 2000) { console.log('FAIL no dialog: ' + id); fail++; continue; }
  const arrStart = src.indexOf('[', dlgStart);
  const arrEnd = src.indexOf(']', arrStart);
  const before = src.slice(0, arrStart);
  let block = src.slice(arrStart, arrEnd + 1);
  const after = src.slice(arrEnd + 1);
  const npcCount = (block.match(/speaker: 'npc'/g) || []).length;
  const taliCount = (block.match(/speaker: 'tali'/g) || []).length;
  if (npcCount !== 1 || taliCount !== 1) { console.log(`FAIL counts ${id} npc=${npcCount} tali=${taliCount}`); fail++; continue; }
  block = block.replace(/speaker: 'npc'/g, "speaker: '__TMP__'").replace(/speaker: 'tali'/g, "speaker: 'npc'").replace(/speaker: '__TMP__'/g, "speaker: 'tali'");
  src = before + block + after;
  ok++;
}
fs.writeFileSync(wp, src);
console.log(`g2/g3 speaker swap: ok=${ok} fail=${fail}`);
