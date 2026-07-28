import { G1M_C20_L1_TASKS, G1M_SUB_L3_TASKS } from '../src/data/g1mathBridgedTasks.ts';
import fs from 'fs';

const ru = JSON.parse(fs.readFileSync('src/i18n/locales/ru.json', 'utf8'));
function t(key) {
  let cur = ru;
  for (const p of String(key).replace(/^data\./, '').split('.')) cur = cur?.[p];
  // keys are like data.tasks.xxx — walk from root
  cur = ru;
  for (const p of String(key).split('.')) cur = cur?.[p];
  return cur;
}

function dump(name, tasks) {
  console.log('\n####', name);
  for (const task of tasks) {
    if (task.audience) continue;
    console.log(task.id, '<' + task.type + '>', 'Q:', t(task.questionKey));
    for (const o of task.options || []) {
      console.log('  ', o.correct ? '✓' : ' ', t(o.textKey));
    }
    if (task.answer != null) console.log('  answer:', task.answer);
  }
}

dump('g1m-c20-l1', G1M_C20_L1_TASKS);
dump('g1m-sub-l3', G1M_SUB_L3_TASKS);
