#!/usr/bin/env node
/**
 * Озвучка ABA (№195): файлы `assets/audio/aba/<ключ>.m4a` (или `.mp3`, `.wav`) → `src/services/soundFiles.ts` —
 * статические import, которые Metro кладёт в сборку. Имя файла — ключ реплики: `abaSession.sound.praise.m4a`.
 * Запуск: `npm run audio:register`, затем новая сборка (файлы входят в apk). Ключ без файла молчит, как раньше.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'assets', 'audio', 'aba');
const out = path.join(root, 'src', 'services', 'soundFiles.ts');

const all = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
// Metro сравнивает расширение с учётом регистра: `.M4A` сломал бы сборку
for (const f of all) if (/\.(m4a|mp3|wav)$/i.test(f) && !/\.(m4a|mp3|wav)$/.test(f)) console.warn(`пропущен ${f}: расширение маленькими буквами (.m4a)`);
const files = all.filter((f) => /\.(m4a|mp3|wav)$/.test(f)).sort();

// ключ, которого нет в коде, — скорее всего опечатка в имени файла (свой прошлый вывод не считается)
let code = '';
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === '__tests__' || e.name === 'node_modules' || path.join(d, e.name) === out) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.tsx?$/.test(e.name)) code += fs.readFileSync(p, 'utf8');
  }
};
walk(path.join(root, 'app'));
walk(path.join(root, 'src'));

const seen = new Map();
for (const f of files) {
  const key = f.replace(/\.(m4a|mp3|wav)$/, '');
  if (!/^[\w.-]+$/.test(key)) throw new Error(`имя файла ${f}: только латиница, цифры, точка, дефис`);
  if (seen.has(key)) throw new Error(`два файла на ключ ${key}: ${seen.get(key)} и ${f}`);
  seen.set(key, f);
  if (!code.includes(`'${key}'`)) console.warn(`внимание: ключа ${key} нет в коде — проверьте имя файла ${f}`);
}

const entries = [...seen.entries()];
const text = [
  '/**',
  ' * Записанная озвучка по ключу (№195). Файл создаёт `npm run audio:register` из `assets/audio/aba/`; руками не править.',
  ' */',
  ...entries.map(([, f], i) => `import s${i} from '../../assets/audio/aba/${f}';`),
  ...(entries.length ? [''] : []),
  entries.length
    ? `export const RECORDED_SOUND_FILES: Readonly<Record<string, number>> = {\n${entries.map(([k], i) => `  '${k}': s${i},`).join('\n')}\n};`
    : 'export const RECORDED_SOUND_FILES: Readonly<Record<string, number>> = {};',
  '',
].join('\n');
fs.writeFileSync(out, text);
console.log(`озвучка: ${entries.length} файл(ов) → src/services/soundFiles.ts`);
