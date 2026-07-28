import fs from 'fs';

const p = String.raw`C:\Users\User\.cursor\projects\c-Users-User-Desktop-Talentia-v1-0\agent-transcripts\0c24ef64-c071-4749-829d-079da9b4ddfd\0c24ef64-c071-4749-829d-079da9b4ddfd.jsonl`;
const lines = fs.readFileSync(p, 'utf8').split(/\n/);
const line = lines.find((l) => l.includes('Reaudit grade 4') && l.includes('AFTER wave1'));
if (!line) {
  // try alternate
  const alts = lines.filter((l) => l.includes('wave1') && l.includes('_audit_g4'));
  console.log('alts', alts.length);
  for (const a of alts.slice(0, 3)) {
    const j = JSON.parse(a);
    for (const c of j.message?.content || []) {
      if (c.type === 'tool_use' && c.name === 'Task') {
        console.log('desc', c.input.description);
        console.log(c.input.prompt.slice(0, 500));
        console.log('---');
      }
    }
  }
  process.exit(0);
}
const j = JSON.parse(line);
for (const c of j.message.content) {
  if (c.type === 'tool_use' && c.name === 'Task') {
    console.log('DESC', c.input.description);
    console.log(c.input.prompt);
    console.log('\n====\n');
  }
}
