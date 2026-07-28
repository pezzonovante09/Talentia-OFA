// UTF-8 dump of all G2 reaudit lessons with RU/EN/KY
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'src/data/worlds.ts'), 'utf8');
const lines = src.split('\n');
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8'));
const ky = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ky.json'), 'utf8'));
const ids = JSON.parse(fs.readFileSync(path.join(__dirname, '_reaudit2_ids_g2.json'), 'utf8')).map((x) => x.id);

function t(obj, key) {
  if (!key) return '';
  let cur = obj;
  for (const p of key.split('.')) {
    cur = cur?.[p];
    if (cur === undefined) return '<MISSING:' + key + '>';
  }
  return cur;
}

let out = '';
const enkyIssues = [];

for (const id of ids) {
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (new RegExp(`id: '${id}', topicId:`).test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start < 0) {
    out += '!!! not found ' + id + '\n';
    continue;
  }
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (
      /id: '[a-z0-9-]+', topicId:/.test(lines[i]) ||
      (/^\s*\] \},\s*$/.test(lines[i]) && /topic|world/.test(lines[i + 1] || ''))
    ) {
      end = i;
      break;
    }
  }
  out += `\n######## ${id} (worlds.ts ${start + 1}-${end})\n`;
  const block = lines.slice(start, end).join('\n');
  const keys = new Set();
  for (const m of block.matchAll(/textKey: '([^']+)'/g)) keys.add(m[1]);
  for (const m of block.matchAll(/questionKey: '([^']+)'/g)) keys.add(m[1]);
  for (const m of block.matchAll(/correctAnswerKey: '([^']+)'/g)) keys.add(m[1]);
  for (const m of block.matchAll(/titleKey: '([^']+)'/g)) keys.add(m[1]);
  for (const m of block.matchAll(/bodyKey: '([^']+)'/g)) keys.add(m[1]);

  for (const m of block.matchAll(/\{ speaker: '(\w+)', textKey: '([^']+)' \}/g)) {
    out += `  [dialog ${m[1]}] RU: ${t(ru, m[2])}\n`;
    out += `             EN: ${t(en, m[2])}\n`;
    out += `             KY: ${t(ky, m[2])}\n`;
  }
  for (const m of block.matchAll(/\{ titleKey: '([^']+)', bodyKey: '([^']+)'/g)) {
    out += `  [intro] ${t(ru, m[1])} :: ${String(t(ru, m[2])).slice(0, 200)}\n`;
  }
  for (let i = start; i < end; i++) {
    const ln = lines[i];
    const tm = ln.match(/id: '([\w-]+)', type: '(\w+)'/);
    if (!tm || /topicId/.test(ln)) continue;
    const qm = ln.match(/questionKey: '([^']+)'/);
    out += `  L${i + 1} ${tm[1]} <${tm[2]}> Q: ${qm ? t(ru, qm[1]) : '?'}\n`;
    if (qm) {
      out += `      EN-Q: ${String(t(en, qm[1])).slice(0, 160)}\n`;
      out += `      KY-Q: ${String(t(ky, qm[1])).slice(0, 160)}\n`;
    }
    for (const om of ln.matchAll(/\{ id: '([^']+)', textKey: '([^']+)', correct: (true|false)[^}]*\}/g)) {
      out += `      ${om[1]}${om[3] === 'true' ? ' [✓] ' : '     '}${t(ru, om[2])} | EN: ${t(en, om[2])} | KY: ${t(ky, om[2])}\n`;
    }
    const cam = ln.match(/correctAnswerKey: '([^']+)'/);
    if (cam) {
      out += `      answer RU: ${t(ru, cam[1])} | EN: ${t(en, cam[1])} | KY: ${t(ky, cam[1])}\n`;
    }
  }

  for (const key of keys) {
    const rv = t(ru, key);
    const ev = t(en, key);
    const kv = t(ky, key);
    const miss = [];
    if (String(ev).startsWith('<MISSING')) miss.push('EN');
    if (String(kv).startsWith('<MISSING')) miss.push('KY');
    // EN identical to RU for non-numeric content that should differ (heuristic for dialogs)
    if (!String(ev).startsWith('<MISSING') && ev === rv && /[А-Яа-яЁё]/.test(String(rv)) && String(rv).length > 8) {
      enkyIssues.push({ id, key, issue: 'EN==RU cyrillic' });
    }
    if (!String(kv).startsWith('<MISSING') && kv === rv && /[А-Яа-яЁё]/.test(String(rv)) && String(rv).length > 8) {
      enkyIssues.push({ id, key, issue: 'KY==RU' });
    }
    if (miss.length) enkyIssues.push({ id, key, issue: 'missing ' + miss.join('+') });
  }
}

fs.writeFileSync(path.join(__dirname, '_reaudit2_dump_g2_utf8.txt'), out, 'utf8');
fs.writeFileSync(path.join(__dirname, '_reaudit2_g2_enky_flags.json'), JSON.stringify(enkyIssues, null, 2), 'utf8');
console.log('wrote dump', out.length, 'chars;', enkyIssues.length, 'enky flags');
