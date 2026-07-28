import fs from 'fs';

const p = String.raw`C:\Users\User\.cursor\projects\c-Users-User-Desktop-Talentia-v1-0\agent-transcripts\0c24ef64-c071-4749-829d-079da9b4ddfd\0c24ef64-c071-4749-829d-079da9b4ddfd.jsonl`;
const lines = fs.readFileSync(p, 'utf8').split(/\n/);
const line = lines.find((l) => l.includes('Reaudit g4+legacy') && l.includes('AFTER wave1'));
const j = JSON.parse(line);
const out = {};
for (const c of j.message.content) {
  if (c.type === 'tool_use' && c.name === 'Task') {
    out[c.input.description] = c.input.prompt;
  }
}
fs.writeFileSync('scripts/_wave1_reaudit_prompts.json', JSON.stringify(out, null, 2));
console.log(Object.keys(out));
for (const [k, v] of Object.entries(out)) console.log(k, v.length);
