import fs from 'fs';
const j = JSON.parse(fs.readFileSync('scripts/_hijack_full_scan.json', 'utf8'));
const worlds = fs.readFileSync('src/data/worlds.ts', 'utf8');

function owns(id, key) {
  const needle = `id: '${id}'`;
  const idx = worlds.indexOf(needle);
  if (idx < 0) return false;
  const rest = worlds.slice(idx + needle.length);
  const next = rest.search(/\n\s{8}id: '/);
  const slice = worlds.slice(idx, idx + needle.length + (next > 0 ? next : 2000));
  return slice.includes(key);
}

const by = {};
for (const h of j.hits) {
  if (!h.key) continue;
  if (!owns(h.id, h.key)) continue;
  (by[h.id] ||= []).push(h);
}
console.log(JSON.stringify(by, null, 2));
