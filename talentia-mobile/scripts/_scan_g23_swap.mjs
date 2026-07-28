import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'src/data/worlds.ts'), 'utf8');
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));
const t = (key) => { const parts = key.replace(/^data\./, '').split('.'); let cur = ru.data; for (const p of parts) { cur = cur?.[p]; if (cur === undefined) return null; } return cur; };

const lessonRe = /id: '([\w-]+)',\s*(?:topicId|titleKey)/g;
let m; const idxs = [];
while ((m = lessonRe.exec(src))) idxs.push({ id: m[1], idx: m.index });

// vocative address (comma/exclaim/dash right after Тали) but NOT narration verbs
const vocative = (txt) => {
  if (!txt) return false;
  // exclude self-intro and narration
  if (/Я Тали/.test(txt)) return false;
  // match "Тали," or "Тали!" or "Тали —" possibly after Да,/Хм,/Хаха!/etc at start
  return /(^|[«"\s(])Тали\s*[,!.—:-]/.test(txt) && !/Тали\s+(говорит|считает|спрашивает|пишет|открыл|думает|нашёл|решил|получает|видит|читает)/.test(txt);
};

const swaps = [];
for (let i = 0; i < idxs.length; i++) {
  const id = idxs[i].id;
  if (!/^g[23]/.test(id)) continue; // only grade 2 and 3
  const start = idxs[i].idx;
  const end = i + 1 < idxs.length ? idxs[i + 1].idx : src.length;
  const seg = src.slice(start, end);
  const dlg = seg.match(/dialog:\s*\[([\s\S]*?)\]/);
  if (!dlg) continue;
  const entries = [...dlg[1].matchAll(/speaker:\s*'(\w+)',\s*textKey:\s*'([^']+)'/g)].map((e) => ({ sp: e[1], key: e[2], txt: t(e[2]) }));
  if (entries.length !== 2) { console.log('NON2 ' + id + ' n=' + entries.length); continue; }
  const taliE = entries.find((e) => e.sp === 'tali');
  const npcE = entries.find((e) => e.sp === 'npc');
  if (!taliE || !npcE) continue;
  const taliVoc = vocative(taliE.txt);
  const npcVoc = vocative(npcE.txt);
  if (taliVoc && !npcVoc) {
    swaps.push(id);
    console.log(`\nSWAP ${id}`);
    console.log(`  [npc ] ${npcE.txt.slice(0, 100)}`);
    console.log(`  [tali] ${taliE.txt.slice(0, 100)}`);
  }
}
console.log('\n\nSWAP LIST (' + swaps.length + '):');
console.log(JSON.stringify(swaps));
fs.writeFileSync(path.join(root, 'scripts/_g23_swap_list.json'), JSON.stringify(swaps, null, 2));
