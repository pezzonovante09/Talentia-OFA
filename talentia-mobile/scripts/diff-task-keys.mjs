import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const w = fs.readFileSync(path.join(root, 'src/data/worlds.ts'), 'utf8');
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8'));
const start = w.indexOf("id: 'meadow'");
const end = w.indexOf("id: 'g1math'");
const slice = w.slice(start, end);
const re = /data\.tasks\.([a-zA-Z0-9_]+)/g;
const keys = new Set();
let m;
while ((m = re.exec(slice))) keys.add(m[1]);
const have = new Set(Object.keys(en.data.tasks || {}));
const miss = [...keys].filter((k) => !have.has(k)).sort();
console.log('missing', miss.length);
for (const k of miss) console.log(k);
