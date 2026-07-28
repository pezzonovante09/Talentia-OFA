import fs from 'fs';
const worlds = fs.readFileSync('src/data/worlds.ts', 'utf8');
const ids = [
  'g2r-sp-l1','g2s-bdy-l3','g3w-eco-l1','g1e-num-l2','g2s-ani-l3','g2e-phr-l3','g4m-cm-l2',
  'g3e-tobe-l3','g3w-nat-l3','g3r-adj-l2','g2m-100-l2','g2r-sh-l1','g2s-plt-l1','g2r-sent-l1','g2s-bdy-l2','g3e-tobe-l1',
];
for (const id of ids) {
  const needle = `id: '${id}'`;
  const idx = worlds.indexOf(needle);
  const rest = worlds.slice(idx + needle.length);
  const next = rest.search(/\n\s{8}id: '/);
  const slice = worlds.slice(idx, idx + needle.length + (next > 0 ? next : 2500));
  const types = [...slice.matchAll(/\{\s*id:\s*'([^']+)',\s*type:\s*'([^']+)'/g)]
    .filter((m) => m[1] !== id)
    .slice(0, 5)
    .map((m) => `${m[1]}:${m[2]}`);
  console.log(id, '→', types.join(' | '));
}
