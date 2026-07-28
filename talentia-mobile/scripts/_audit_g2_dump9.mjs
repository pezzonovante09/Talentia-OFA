// Dump all G2 lessons with RU/EN/KY for audit #9
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

function t(obj, key) {
  if (!key) return '';
  const parts = key.split('.');
  let cur = obj;
  for (const p of parts) {
    cur = cur?.[p];
    if (cur === undefined) return '<MISSING:' + key + '>';
  }
  return cur;
}

const ids = JSON.parse(fs.readFileSync(path.join(__dirname, '_reaudit2_ids_g2.json'), 'utf8')).map((x) => x.id);
let out = '';
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
    if (/id: '[a-z0-9-]+', topicId:/.test(lines[i])) {
      end = i;
      break;
    }
  }
  out += '\n######## ' + id + ' (L' + (start + 1) + '-' + end + ')\n';
  const block = lines.slice(start, end).join('\n');
  for (const m of block.matchAll(/\{ speaker: '(\w+)', textKey: '([^']+)' \}/g)) {
    out += '  [dialog ' + m[1] + '] RU: ' + t(ru, m[2]) + '\n';
    out += '             EN: ' + t(en, m[2]) + '\n';
    out += '             KY: ' + t(ky, m[2]) + '\n';
  }
  for (const m of block.matchAll(/\{ titleKey: '([^']+)', bodyKey: '([^']+)'/g)) {
    out += '  [intro] RU: ' + t(ru, m[1]) + ' :: ' + String(t(ru, m[2])).slice(0, 180) + '\n';
    out += '          EN: ' + t(en, m[1]) + ' :: ' + String(t(en, m[2])).slice(0, 180) + '\n';
    out += '          KY: ' + t(ky, m[1]) + ' :: ' + String(t(ky, m[2])).slice(0, 180) + '\n';
  }
  for (let i = start; i < end; i++) {
    const ln = lines[i];
    const tm = ln.match(/id: '([\w-]+)', type: '(\w+)'/);
    if (!tm || /topicId/.test(ln)) continue;
    const qm = ln.match(/questionKey: '([^']+)'/);
    const aud = /audience: 'special_aba'/.test(ln) ? ' [ABA]' : '';
    out += '  L' + (i + 1) + ' ' + tm[1] + ' <' + tm[2] + '>' + aud + '\n';
    if (qm) {
      out += '    Q RU: ' + t(ru, qm[1]) + '\n';
      out += '    Q EN: ' + t(en, qm[1]) + '\n';
      out += '    Q KY: ' + t(ky, qm[1]) + '\n';
    }
    for (const om of ln.matchAll(/\{ id: '(\w+)', textKey: '([^']+)', correct: (true|false)[^}]*\}/g)) {
      out +=
        '      ' +
        om[1] +
        (om[3] === 'true' ? ' [✓] ' : '     ') +
        'RU:' +
        t(ru, om[2]) +
        ' | EN:' +
        t(en, om[2]) +
        ' | KY:' +
        t(ky, om[2]) +
        '\n';
    }
    const cam = ln.match(/correctAnswerKey: '([^']+)'/);
    if (cam)
      out +=
        '      answer RU:' +
        t(ru, cam[1]) +
        ' | EN:' +
        t(en, cam[1]) +
        ' | KY:' +
        t(ky, cam[1]) +
        '\n';
    // options arrays for sorting / routine / fill
    for (const om of ln.matchAll(/textKey: '([^']+)'/g)) {
      // skip ones already printed via option objects above if duplicated - keep simple
    }
    const opts = ln.match(/options:\s*\[([^\]]+)\]/);
    if (opts && /'data\./.test(opts[1])) {
      for (const km of opts[1].matchAll(/'([^']+)'/g)) {
        out +=
          '      opt RU:' +
          t(ru, km[1]) +
          ' | EN:' +
          t(en, km[1]) +
          ' | KY:' +
          t(ky, km[1]) +
          '\n';
      }
    }
    const items = ln.match(/items:\s*\[([^\]]+)\]/);
    if (items && /textKey|labelKey/.test(items[1])) {
      for (const km of items[1].matchAll(/(?:textKey|labelKey):\s*'([^']+)'/g)) {
        out +=
          '      item RU:' +
          t(ru, km[1]) +
          ' | EN:' +
          t(en, km[1]) +
          ' | KY:' +
          t(ky, km[1]) +
          '\n';
      }
    }
  }
}
const outPath = path.join(__dirname, '_audit_g2_dump9.txt');
fs.writeFileSync(outPath, out, 'utf8');
console.log('wrote', outPath, 'chars', out.length, 'lessons', ids.length);
