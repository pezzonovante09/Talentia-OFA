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

function findLessonId(lineIdx) {
  for (let j = lineIdx; j >= 0; j--) {
    const m = lines[j].match(/id:\s*'([a-z0-9-]+)',\s*topicId:/);
    if (m) return m[1];
  }
  return '?';
}

function usages(key) {
  const out = [];
  const needle = `data.tasks.${key}'`;
  for (let i = 0; i < lines.length; i++) {
    let idx = 0;
    while ((idx = lines[i].indexOf(needle, idx)) !== -1) {
      let q = null;
      for (let j = i; j >= Math.max(0, i - 8); j--) {
        const m = lines[j].match(/questionKey:\s*'([^']+)'/);
        if (m) { q = m[1]; break; }
      }
      const seg = lines[i].slice(idx, idx + 120);
      const cm = seg.match(/correct:\s*(true|false)/);
      out.push({
        line: i + 1,
        lesson: findLessonId(i),
        question: q,
        qText: q ? (ru.data.tasks[q.replace('data.tasks.', '')] || '').slice(0, 90) : '',
        correct: cm ? cm[1] : '?',
      });
      idx += needle.length;
    }
  }
  return out;
}

const keys = ['opt_two', 'opt_yes', 'opt_no', 'g1e_opt_am', 'g1e_opt_is', 'g1e_opt_are'];
const report = {};
for (const k of keys) {
  report[k] = {
    ru: ru.data.tasks[k],
    en: en.data.tasks[k],
    ky: ky.data.tasks[k],
    usages: usages(k),
  };
}
fs.writeFileSync(path.join(__dirname, '_fix_phase1_report.json'), JSON.stringify(report, null, 2));
for (const k of keys) {
  console.log('###', k, '| RU=', JSON.stringify(report[k].ru), '| KY=', JSON.stringify(report[k].ky));
  for (const u of report[k].usages) {
    console.log(' ', u.lesson, 'correct=' + u.correct, '|', u.qText);
  }
}
