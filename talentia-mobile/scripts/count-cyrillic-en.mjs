import fs from 'fs';
const j = JSON.parse(fs.readFileSync('../src/i18n/locales/en.json', 'utf8'));
const t = j.data.tasks;
const re = /[\u0400-\u04FF]/;
let n = 0;
const keys = [];
for (const [k, v] of Object.entries(t)) {
  if (typeof v === 'string' && re.test(v) && /^g[1-4]/.test(k)) {
    n++;
    if (keys.length < 40) keys.push(k);
  }
}
console.log({ n, keys });
