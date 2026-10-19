#!/usr/bin/env node
/**
 * CI: ворота аудита для всего, что вошло в PR или пуш любым путём (решение №76). Хук Claude Code
 * (`audit-gate.js`) видит только инструменты сессии; правка из терминала, чужого редактора или
 * другой ветки его обходит. Здесь проверяется результат.
 *
 * Использование: `node .claude/hooks/check-pr.js <base> [head=HEAD]`.
 *
 * Состояние ворот берётся из **базовой** ветки (`git show <base>:.claude/audit-gate.json`), а не из
 * PR: иначе PR сам записал бы себе чистый раунд и прошёл. Чистый раунд сначала попадает в базу, потом
 * по нему открываются экраны и контент. Закрыто — падает, если в diff есть:
 * - добавление или правка файла в `talentia-mobile/app/`, `src/screens/`, `src/components/`
 *   (удаление — чистка прежнего приложения — не в счёт);
 * - новый файл в `talentia-mobile/src/content/` (кроме `__tests__`).
 */
const { execFileSync } = require('child_process');
const { classifyPath, gateStateFromText } = require('./gate-core');

const root = process.env.GITHUB_WORKSPACE || process.cwd();
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

function resolveBase(arg) {
  const zero = /^0+$/;
  if (arg && !zero.test(arg)) {
    try {
      git('rev-parse', '--verify', `${arg}^{commit}`);
      return arg;
    } catch {
      /* ниже — запасной вариант */
    }
  }
  for (const ref of ['origin/master', 'master']) {
    try {
      return git('merge-base', 'HEAD', ref).trim();
    } catch {
      /* следующий */
    }
  }
  return null;
}

/**
 * Нарушения по выводу `git diff --name-status -z --no-renames`: записи `статус\0путь\0`. Разбор по
 * NUL, а не по строкам: с `-z` git не экранирует имена (кириллица, пробел, табуляция, перевод строки),
 * а прежний построчный разбор пропускал `"talentia-mobile/app/\320\255..."` (раунд 4, В1).
 */
function violations(diff) {
  const bad = [];
  const fields = diff.split('\0');
  for (let i = 0; i + 1 < fields.length; i += 2) {
    const status = fields[i].trim();
    const file = fields[i + 1];
    if (!status) continue;
    const kind = classifyPath(file);
    // удаление экранного кода (чистка прежнего приложения) ворота не трогают: закрыт новый код
    if (kind === 'screens' && status !== 'D') bad.push(`${status}\t${file}\tэкранный код`);
    else if (kind === 'content' && status === 'A') bad.push(`${status}\t${file}\tновый файл контента`);
  }
  return bad;
}

function main() {
  const base = resolveBase(process.argv[2]);
  const head = process.argv[3] || 'HEAD';
  if (!base) {
    console.log('Ворота аудита: базу для сравнения определить не удалось — проверка пропущена.');
    return 0;
  }
  let gateJson = '';
  try {
    gateJson = git('show', `${base}:.claude/audit-gate.json`);
  } catch {
    gateJson = '';
  }
  const gate = gateStateFromText(gateJson);
  if (gate.open) {
    console.log(`Ворота аудита открыты (${gate.last.date}, блокеров 0): проверка пройдена.`);
    return 0;
  }
  const diff = git('-c', 'core.quotePath=false', 'diff', '--name-status', '-z', '--no-renames', `${base}...${head}`);
  const bad = violations(diff);
  if (bad.length === 0) {
    console.log(`Ворота аудита закрыты (${gate.state}), но экранного кода и новых файлов контента в изменениях нет.`);
    return 0;
  }
  console.error(`Ворота аудита закрыты (${gate.state}).`);
  console.error('Решение владельца 2026-10-09: экраны и новый контент — только после раунда аудита без блокеров');
  console.error('(.claude/audit-gate.json в базовой ветке). В изменениях запрещённое:');
  for (const b of bad) console.error(`  ${b}`);
  return 1;
}

if (require.main === module) process.exit(main());

module.exports = { violations };
