import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else if (typeof v === 'string') out[key] = v;
  }
  return out;
}

const chk = spawnSync(process.execPath, [path.join(root, 'scripts/check-i18n.js'), '--json'], {
  encoding: 'utf8',
  maxBuffer: 50 * 1024 * 1024,
});
const report = JSON.parse(chk.stdout);
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));
const flat = flatten(ru);
const lines = report.missing_en.map((k) => `${k}\t${flat[k] ?? ''}`);
fs.writeFileSync(path.join(__dirname, 'missing-ru-lines.txt'), `${lines.join('\n')}\n`, 'utf8');
console.log('Wrote', lines.length, 'lines');
