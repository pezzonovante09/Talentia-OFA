/**
 * Запуск всех проверок базы: каждый `tests/*.test.mjs` — отдельным процессом, по алфавиту.
 * Новый файл попадает в `npm run test:db` и CI сам — список в package.json не ведётся
 * (`qa-engineer`, раунд 2, В2: захардкоженный список молча пропускал новые тесты).
 *
 * Запуск: npm test --prefix supabase
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.test.mjs'))
  .sort();

if (files.length === 0) {
  console.error('нет ни одного tests/*.test.mjs');
  process.exit(1);
}

const failed = [];
for (const f of files) {
  console.log(`\n▶ ${f}`);
  const r = spawnSync(process.execPath, [join(dir, f)], { stdio: 'inherit' });
  if (r.status !== 0) failed.push(f);
}

console.log(`\nфайлов: ${files.length}, с провалами: ${failed.length}${failed.length ? ` (${failed.join(', ')})` : ''}`);
process.exit(failed.length ? 1 : 0);
