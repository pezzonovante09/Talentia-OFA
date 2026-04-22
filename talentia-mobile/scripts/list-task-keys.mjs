import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const w = fs.readFileSync(path.join(__dirname, '../src/data/worlds.ts'), 'utf8');
const start = w.indexOf("id: 'meadow',");
const end = w.indexOf("id: 'g1math',");
const slice = w.slice(start, end);
const re = /data\.tasks\.([a-zA-Z0-9_]+)/g;
const set = new Set();
let m;
while ((m = re.exec(slice))) set.add(m[1]);
console.log([...set].sort().join('\n'));
