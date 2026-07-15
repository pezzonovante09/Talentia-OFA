import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const t = fs.readFileSync(path.join(__dirname, '../src/data/worlds.ts'), 'utf8');
const set = new Set();
const re = /textKey: '(data\.tasks\.[^']+)'/g;
let m;
while ((m = re.exec(t))) {
  if (/data\.tasks\.g[34]/.test(m[1])) set.add(m[1]);
}
console.log([...set].sort().join('\n'));
