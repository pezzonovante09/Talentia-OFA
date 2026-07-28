import fs from 'fs';
const lines = fs.readFileSync('src/data/worlds.ts', 'utf8').split('\n');
const ids = JSON.parse(fs.readFileSync('scripts/_reaudit2_ids_g3.json', 'utf8')).map((x) => x.id);
for (const id of ids) {
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (new RegExp(`id: '${id}', topicId:`).test(lines[i])) {
      start = i;
      break;
    }
  }
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/id: '[a-z0-9-]+', topicId:/.test(lines[i])) {
      end = i;
      break;
    }
  }
  console.log('\n##' + id);
  for (let i = start; i < end; i++) {
    const ln = lines[i];
    const tm = ln.match(/id: '([\w-]+)', type: '(\w+)'/);
    if (!tm || /topicId/.test(ln)) continue;
    const ans = ln.match(/answer: '([^']*)'/);
    const ansKey = ln.match(/correctAnswerKey: '([^']+)'/);
    const acc = ln.match(/acceptedAnswers:\s*\[([^\]]*)\]/);
    console.log(
      ' ',
      tm[1],
      tm[2],
      ans ? `answer=${ans[1]}` : '',
      ansKey ? `key=${ansKey[1]}` : '',
      acc ? `accepted=[${acc[1].slice(0, 80)}]` : '',
    );
  }
}
