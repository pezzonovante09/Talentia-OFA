import fs from 'fs';

const p =
  'C:/Users/User/.cursor/projects/c-Users-User-Desktop-Talentia-v1-0/agent-transcripts/0c24ef64-c071-4749-829d-079da9b4ddfd/0c24ef64-c071-4749-829d-079da9b4ddfd.jsonl';
const lines = fs.readFileSync(p, 'utf8').split(/\n/);
for (const line of lines) {
  if (!line.includes('Reaudit tails fix')) continue;
  const o = JSON.parse(line);
  const tu = (o.message?.content || []).find((c) => c.name === 'CreatePlan');
  if (!tu) continue;
  fs.writeFileSync(
    new URL('./_reaudit_tails_plan_extract.json', import.meta.url),
    JSON.stringify(tu.input, null, 2),
  );
  console.log('wrote plan extract, plan length', (tu.input.plan || '').length);
  console.log('todos', tu.input.todos?.map((t) => t.id));
  break;
}
