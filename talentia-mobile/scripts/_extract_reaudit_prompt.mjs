import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const p = String.raw`C:\Users\User\.cursor\projects\c-Users-User-Desktop-Talentia-v1-0\agent-transcripts\0c24ef64-c071-4749-829d-079da9b4ddfd\0c24ef64-c071-4749-829d-079da9b4ddfd.jsonl`;
const lines = fs.readFileSync(p, 'utf8').split(/\n/);
const line = lines.find((l) => l.includes('Reaudit grade 0') && l.includes('AFTER wave1'));
if (!line) {
  console.error('not found');
  process.exit(1);
}
const j = JSON.parse(line);
const t = j.message.content.find(
  (c) => c.type === 'tool_use' && c.name === 'Task' && c.input?.description === 'Reaudit grade 0',
);
fs.writeFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '_wave2_reaudit_prompt_g0.txt'),
  t.input.prompt,
);
console.log('len', t.input.prompt.length);
console.log(t.input.prompt.slice(0, 1200));
