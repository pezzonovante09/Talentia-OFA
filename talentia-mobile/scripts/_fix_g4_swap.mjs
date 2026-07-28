import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const wp = path.join(root, 'src/data/worlds.ts');
let src = fs.readFileSync(wp, 'utf8');

const swapIds = [
  'g4m-md-l1','g4m-md-l2','g4m-md-l3','g4m-cm-l1','g4m-cm-l2','g4m-cm-l3','g4m-fr-l1','g4m-fr-l2','g4m-fr-l3',
  'g4r-conj-l2','g4r-conj-l3','g4r-cases-l1','g4r-cases-l2','g4r-cases-l3','g4r-text-l1','g4r-text-l2','g4r-text-l3',
  'g4e-pres-l2','g4e-pres-l3','g4e-past-l1','g4e-past-l2','g4e-past-l3','g4e-quest-l1','g4e-quest-l2','g4e-quest-l3',
  'g4s-help-l2','g4s-help-l3','g4s-emo-l1','g4s-emo-l2','g4s-emo-l3','g4s-turn-l1','g4s-turn-l2','g4s-turn-l3',
];

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
console.log(`g4 speaker swap: ok=${ok} fail=${fail}`);
