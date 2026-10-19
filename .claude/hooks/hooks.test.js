/**
 * Тесты ворот аудита: хук Claude Code (`audit-gate.js`) и проверка CI (`check-pr.js`).
 * Запуск: `node --test .claude/hooks` (npm run test:hooks). Без зависимостей — встроенный раннер.
 *
 * Обходы из отчёта `qa-engineer` (раунд 3): псевдонимы PowerShell, `robocopy` / `xcopy`,
 * `perl -pi`, шаблоны в пути, двухшаговый `cd` + запись голым именем, относительный путь в Edit.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { shellWritesGuarded } = require('./audit-gate');
const { classifyPath, classifyRealPath, realPathOf } = require('./gate-core');
const { violations } = require('./check-pr');

const M = 'talentia-mobile';
const CWD_ROOT = 'C:/Users/User/Desktop/Talentia-v1.0';
const CWD_MOBILE = `${CWD_ROOT}/${M}`;

// ---------------------------------------------------------------------------
// classifyPath
// ---------------------------------------------------------------------------

test('classifyPath: закрытые папки, исключения и шаблоны', () => {
  const k = classifyPath;
  assert.equal(k(`${CWD_MOBILE}/app/index.tsx`), 'screens');
  assert.equal(k(`${M}/src/screens/A.tsx`), 'screens');
  assert.equal(k(`${M}\\src\\components\\B.tsx`), 'screens');
  assert.equal(k(`${M}/src/content/numbers.ts`), 'content');
  assert.equal(k(`${M}/src/content/__tests__/x.test.ts`), null, 'тесты контента не закрыты');
  assert.equal(k(`${M}/app.json`), null, 'app.json — не папка app');
  assert.equal(k(`${M}/src/domain/x.ts`), null);
  assert.equal(k(`${M}/TALENTIA-MOBILE/APP/X.tsx`.replace(M, 'TALENTIA-MOBILE')), 'screens', 'без учёта регистра');
  assert.equal(k(`${M}/ap*/q.tsx`), 'screens', 'шаблон ap* может быть app');
  assert.equal(k(`${M}/{app,src}/x`), 'screens', 'фигурные скобки');
  assert.equal(k(`${M}/*/x`), 'screens', 'звёздочка вместо папки');
  assert.equal(k(`${M}/src/domain/../components/x.tsx`), 'screens', '.. разрешается');
  assert.equal(k(M, { ancestors: true }), 'screens', 'выше закрытой папки — для разрушающих команд');
  assert.equal(k(`${M}/src`, { ancestors: true }), 'screens');
  assert.equal(k(M), null, 'без ancestors родитель не закрыт');
});

// ---------------------------------------------------------------------------
// shellWritesGuarded: таблица
// ---------------------------------------------------------------------------

const BLOCKED = [
  ['перенаправление', `echo hi > ${M}/app/x.tsx`],
  ['cp в components', `cp a.txt ${M}/src/components/b.tsx`],
  ['PowerShell copy', `copy a.txt ${M}\\app\\b.tsx`],
  ['PowerShell ni', `ni ${M}\\app\\b.tsx`],
  ['PowerShell sc', `sc ${M}\\app\\b.tsx hi`],
  ['PowerShell ac', `ac ${M}\\app\\b.tsx hi`],
  ['PowerShell move', `move x ${M}\\app\\y`],
  ['PowerShell del', `del ${M}\\app\\y.tsx`],
  ['PowerShell Clear-Content', `Clear-Content ${M}\\app\\y.tsx`],
  ['robocopy', `robocopy src ${M}\\app /E`],
  ['xcopy', `xcopy a ${M}\\app\\ /Y`],
  ['perl -pi', `perl -pi -e 's/a/b/' ${M}/app/x.tsx`],
  ['awk inplace', `awk -i inplace '{print}' ${M}/app/x.tsx`],
  ['ruby -i', `ruby -i -pe 'x' ${M}/app/x.tsx`],
  ['sed -i', `sed -i s/a/b/ ${M}/src/components/x.tsx`],
  ['prettier --write', `npx prettier --write ${M}/app`],
  ['curl -o', `curl -o ${M}/app/x https://example.com/x`],
  ['wget -O', `wget -O ${M}/app/x https://example.com/x`],
  ['Invoke-WebRequest -OutFile', `Invoke-WebRequest https://e.com -OutFile ${M}\\app\\x`],
  ['Set-Content в контент', `Set-Content ${M}\\src\\content\\new.ts x`],
  ['python open w', `python -c "open('${M}/app/x','w')"`],
  ['python write_text', `python -c "pathlib.Path('${M}/app/x').write_text('a')"`],
  ['node writeFileSync', `node -e "fs.writeFileSync('${M}/app/x','a')"`],
  ['шаблон ap*', `echo hi > ${M}/ap*/q.tsx`],
  ['фигурные скобки', `echo hi > ${M}/{app,src}/q.tsx`],
  ['звёздочка вместо папки', `cp x ${M}/*/q.tsx`],
  ['удаление родителя', `rm -rf ${M}`],
  ['удаление src', `rm -rf ${M}/src`],
  ['git checkout в закрытую', `git checkout main -- ${M}/app`],
  ['tee', `echo a | tee ${M}/app/x`],
  ['heredoc в файл', `cat > ${M}/app/x.tsx <<'EOF'\nhi\nEOF`],
];
for (const [name, cmd] of BLOCKED) {
  test(`блокируется: ${name}`, () => assert.equal(shellWritesGuarded(cmd, CWD_ROOT), true, cmd));
}

// Раунд 4, В6: запись через .NET и ссылки на закрытую папку (mklink / Junction).
const BLOCKED_R4 = [
  ['.NET StreamWriter', `$w = New-Object System.IO.StreamWriter('${M}\\app\\x.tsx')`],
  ['.NET IO.Directory', `[System.IO.Directory]::CreateDirectory('${M}\\app\\x')`],
  ['.NET IO.Directory без System', `[IO.Directory]::CreateDirectory('${M}\\src\\screens\\b')`],
  ['cmd mklink /J', `cmd /c mklink /J link ${M}\\app`],
  ['Sysinternals junction', `junction link ${M}\\src\\components`],
];
for (const [name, cmd] of BLOCKED_R4) {
  test(`блокируется (раунд 4, В6): ${name}`, () => assert.equal(shellWritesGuarded(cmd, CWD_ROOT), true, cmd));
}

test('блокируется двухшаговый обход: cwd в закрытой папке, запись голым именем', () => {
  assert.equal(shellWritesGuarded('echo hi > x.tsx', `${CWD_MOBILE}/app`), true);
  assert.equal(shellWritesGuarded('ni b.tsx', `${CWD_MOBILE}\\src\\components`), true);
  assert.equal(shellWritesGuarded('copy a.txt b.tsx', `${CWD_MOBILE}/src/components`), true);
});

test('блокируется относительный путь от cwd приложения', () => {
  assert.equal(shellWritesGuarded('echo hi > app/x.tsx', CWD_MOBILE), true);
  assert.equal(shellWritesGuarded('echo hi > components/x.tsx', `${CWD_MOBILE}/src`), true);
  assert.equal(shellWritesGuarded('echo hi > ../app/x.tsx', `${CWD_MOBILE}/src`), true);
  assert.equal(shellWritesGuarded('echo hi > ./src/screens/x.tsx', CWD_MOBILE), true);
});

const ALLOWED = [
  ['чтение cat', `cat ${M}/app/x.tsx`],
  ['чтение ls', `ls ${M}/app`],
  ['чтение grep', `grep -rn foo ${M}/src/components`],
  ['сообщение коммита с путём', `git commit -m "правки ${M}/app/x.tsx"`],
  ['heredoc-сообщение коммита', `git commit -F - <<'MSG'\nправка ${M}/app/x.tsx > как есть\nMSG`],
  ['запись в scratchpad', 'echo hi > /tmp/x.txt'],
  ['app.json — не папка app', `echo hi > ${M}/app.json`],
  ['тест контента', `echo hi > ${M}/src/content/__tests__/x.test.ts`],
  ['npm install в приложении', `cd ${M} && npm install`],
  ['jest по контенту без записи', 'npx jest src/content'],
  ['копирование всего родителя читается', `cp -r ${M} /tmp/x`],
  ['перенаправление в /dev/null', `cat ${M}/app/x.tsx > /dev/null`],
  ['перенаправление в $null', `Get-Content ${M}\\app\\x.tsx > $null`],
  ['eslint --fix вне закрытых', 'npx eslint src/domain --fix'],
];
for (const [name, cmd] of ALLOWED) {
  test(`проходит: ${name}`, () => assert.equal(shellWritesGuarded(cmd, CWD_ROOT), false, cmd));
}

test('проходит: запись в приложении вне закрытых папок при cwd приложения', () => {
  assert.equal(shellWritesGuarded('echo hi > scratch.txt', CWD_MOBILE), false);
  assert.equal(shellWritesGuarded('npm install', CWD_MOBILE), false);
  assert.equal(shellWritesGuarded('echo hi > domain/x.ts', `${CWD_MOBILE}/src`), false);
});

// ---------------------------------------------------------------------------
// хук целиком: вход JSON → ответ deny
// ---------------------------------------------------------------------------

const HOOK = path.join(__dirname, 'audit-gate.js');
const ALL_AGENTS = [
  'backend-auditor',
  'child-privacy-compliance',
  'aba-pedagogy-specialist',
  'curriculum-content-reviewer',
  'localization-qa',
  'qa-engineer',
  'release-readiness-auditor',
  'design-lead',
  'child-ux-specialist',
];

function projectWith(round) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'talentia-gate-'));
  fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.claude', 'audit-gate.json'), JSON.stringify({ rounds: round ? [round] : [] }));
  fs.mkdirSync(path.join(dir, M, 'src', 'content'), { recursive: true });
  fs.writeFileSync(path.join(dir, M, 'src', 'content', 'old.ts'), '// старый');
  return dir;
}

function runHook(dir, input) {
  const r = spawnSync('node', [HOOK], {
    input: JSON.stringify({ cwd: dir, ...input }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
    encoding: 'utf8',
  });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout ? JSON.parse(r.stdout).hookSpecificOutput.permissionDecision : null;
}

const CLOSED = { date: '2026-10-12', agents: ALL_AGENTS, blockers: 15 };
const OPEN = { date: '2026-11-01', agents: ALL_AGENTS, blockers: 0 };

test('хук: закрытые ворота блокируют экраны, новый контент, запись через оболочку', () => {
  const dir = projectWith(CLOSED);
  const abs = (p) => `${dir.replace(/\\/g, '/')}/${p}`;
  assert.equal(runHook(dir, { tool_name: 'Write', tool_input: { file_path: abs(`${M}/app/x.tsx`) } }), 'deny');
  assert.equal(runHook(dir, { tool_name: 'Edit', tool_input: { file_path: abs(`${M}/src/components/B.tsx`) } }), 'deny');
  assert.equal(runHook(dir, { tool_name: 'MultiEdit', tool_input: { file_path: abs(`${M}/src/screens/B.tsx`) } }), 'deny');
  assert.equal(runHook(dir, { tool_name: 'NotebookEdit', tool_input: { notebook_path: abs(`${M}/app/n.ipynb`) } }), 'deny');
  assert.equal(runHook(dir, { tool_name: 'Write', tool_input: { file_path: abs(`${M}/src/content/new.ts`) } }), 'deny');
  assert.equal(runHook(dir, { tool_name: 'Bash', tool_input: { command: `echo hi > ${M}/app/x.tsx` } }), 'deny');
  assert.equal(runHook(dir, { tool_name: 'PowerShell', tool_input: { command: `copy a.txt ${M}\\app\\b.tsx` } }), 'deny');
});

test('хук: Edit с относительным путём тоже блокируется (путь разрешается от cwd)', () => {
  const dir = projectWith(CLOSED);
  const mobile = path.join(dir, M);
  assert.equal(runHook(dir, { cwd: mobile, tool_name: 'Edit', tool_input: { file_path: 'app/x.tsx' } }), 'deny');
  assert.equal(runHook(dir, { cwd: mobile, tool_name: 'Write', tool_input: { file_path: 'src/components/x.tsx' } }), 'deny');
});

test('хук (раунд 4, В2): новый файл контента блокируется любым инструментом записи, не только Write', () => {
  const dir = projectWith(CLOSED);
  const abs = (p) => `${dir.replace(/\\/g, '/')}/${p}`;
  const fresh = abs(`${M}/src/content/fresh.ts`);
  assert.equal(
    runHook(dir, { tool_name: 'Edit', tool_input: { file_path: fresh, old_string: '', new_string: 'export {}' } }),
    'deny',
    'Edit с пустым old_string создаёт файл',
  );
  assert.equal(runHook(dir, { tool_name: 'NotebookEdit', tool_input: { notebook_path: abs(`${M}/src/content/n.ipynb`) } }), 'deny');
  assert.equal(runHook(dir, { tool_name: 'MultiEdit', tool_input: { file_path: fresh } }), 'deny');
});

// ---------------------------------------------------------------------------
// Раунд 4, В3: короткие имена Windows 8.3 (`TALENT~1`) разрешаются до длинных
// ---------------------------------------------------------------------------

/** Подменённая файловая система: существующие папки (в коротком виде) → их настоящий путь. */
function fakeIo(real) {
  return {
    existsSync: (p) => Object.prototype.hasOwnProperty.call(real, p),
    realpathSync: (p) => real[p],
  };
}

test('realPathOf (В3): путь через короткое имя разрешается через ближайшего существующего предка', () => {
  const io = fakeIo({ '/w/TALENT~1/TALENT~2': '/w/Talentia-v1.0/talentia-mobile' });
  const short = '/w/TALENT~1/TALENT~2/app/new.tsx';
  assert.equal(classifyPath(short), null, 'без разрешения короткое имя не узнаётся');
  assert.equal(realPathOf(short, io), '/w/Talentia-v1.0/talentia-mobile/app/new.tsx');
  assert.equal(classifyPath(realPathOf(short, io)), 'screens');
});

test('realPathOf (В3): путь с диском и обратными слэшами; настоящий путь в виде Windows', () => {
  const io = fakeIo({ 'C:/w/TALENT~1/TALENT~2/src/COMPON~1': 'C:\\w\\Talentia-v1.0\\talentia-mobile\\src\\components' });
  const p = 'C:\\w\\TALENT~1\\TALENT~2\\src\\COMPON~1\\B.tsx';
  assert.equal(realPathOf(p, io), 'C:/w/Talentia-v1.0/talentia-mobile/src/components/B.tsx');
  assert.equal(classifyRealPath(p, {}, io), 'screens');
});

test('realPathOf (В3): относительный путь и путь без существующих предков не меняются', () => {
  const io = fakeIo({});
  assert.equal(realPathOf('TALENT~2/app/x.tsx', io), 'TALENT~2/app/x.tsx');
  assert.equal(realPathOf('/nope/TALENT~2/app/x.tsx', io), '/nope/TALENT~2/app/x.tsx');
  const throwing = { existsSync: () => true, realpathSync: () => { throw new Error('EACCES'); } };
  assert.equal(realPathOf('/w/x', throwing), '/w/x', 'ошибка realpath — исходный путь');
});

/** Короткое 8.3-имя папки через cmd (`%~sI`); `null`, если не Windows или 8.3-имена на томе отключены. */
function shortName(longPath) {
  if (process.platform !== 'win32') return null;
  try {
    const out = execFileSync('cmd', ['/d', '/s', '/c', `"for %I in ("${longPath}") do @echo %~sI"`], {
      encoding: 'utf8',
      windowsVerbatimArguments: true,
    }).trim();
    return out && out.toLowerCase() !== longPath.toLowerCase() && out.includes('~') ? out : null;
  } catch {
    return null;
  }
}

test('хук (В3): запись через настоящее 8.3-имя закрытой папки блокируется', (t) => {
  const dir = projectWith(CLOSED);
  fs.mkdirSync(path.join(dir, M, 'app'), { recursive: true });
  fs.mkdirSync(path.join(dir, M, 'src', 'components'), { recursive: true });
  const app = shortName(path.join(dir, M, 'app'));
  const components = shortName(path.join(dir, M, 'src', 'components'));
  const content = shortName(path.join(dir, M, 'src', 'content'));
  if (!components || !content || !app) return t.skip('8.3-имена в этой среде недоступны');
  assert.equal(classifyPath(components), null, 'короткое имя само по себе не узнаётся');
  assert.equal(runHook(dir, { tool_name: 'Write', tool_input: { file_path: `${components}\\B.tsx` } }), 'deny');
  assert.equal(runHook(dir, { tool_name: 'Write', tool_input: { file_path: `${content}\\fresh.ts` } }), 'deny');
  assert.equal(runHook(dir, { tool_name: 'Bash', tool_input: { command: `echo hi > ${components}\\B.tsx` } }), 'deny');
  assert.equal(runHook(dir, { cwd: app, tool_name: 'Bash', tool_input: { command: 'echo hi > x.tsx' } }), 'deny');
  assert.equal(runHook(dir, { tool_name: 'Edit', tool_input: { file_path: `${content}\\old.ts` } }), null, 'правка существующего контента через 8.3 проходит');
});

test('хук: двухшаговый обход через cwd', () => {
  const dir = projectWith(CLOSED);
  const cwd = path.join(dir, M, 'app');
  assert.equal(runHook(dir, { cwd, tool_name: 'Bash', tool_input: { command: 'echo hi > x.tsx' } }), 'deny');
});

test('хук: не блокируется то, что можно', () => {
  const dir = projectWith(CLOSED);
  const abs = (p) => `${dir.replace(/\\/g, '/')}/${p}`;
  assert.equal(runHook(dir, { tool_name: 'Edit', tool_input: { file_path: abs(`${M}/src/content/old.ts`) } }), null, 'правка существующего контента');
  assert.equal(runHook(dir, { tool_name: 'Write', tool_input: { file_path: abs(`${M}/src/content/__tests__/new.test.ts`) } }), null);
  assert.equal(runHook(dir, { tool_name: 'Write', tool_input: { file_path: abs(`${M}/app.json`) } }), null);
  assert.equal(runHook(dir, { tool_name: 'Write', tool_input: { file_path: abs(`${M}/src/domain/x.ts`) } }), null);
  assert.equal(runHook(dir, { tool_name: 'Bash', tool_input: { command: `cat ${M}/app/x.tsx` } }), null);
});

test('хук: ворота открыты — ничего не блокируется; без раундов или с битым JSON — закрыты', () => {
  const open = projectWith(OPEN);
  assert.equal(runHook(open, { tool_name: 'Write', tool_input: { file_path: `${open.replace(/\\/g, '/')}/${M}/app/x.tsx` } }), null);
  const none = projectWith(null);
  assert.equal(runHook(none, { tool_name: 'Write', tool_input: { file_path: `${none.replace(/\\/g, '/')}/${M}/app/x.tsx` } }), 'deny');
  const broken = projectWith(OPEN);
  fs.writeFileSync(path.join(broken, '.claude', 'audit-gate.json'), '{ не json');
  assert.equal(runHook(broken, { tool_name: 'Write', tool_input: { file_path: `${broken.replace(/\\/g, '/')}/${M}/app/x.tsx` } }), 'deny');
  const eight = projectWith({ ...OPEN, agents: ALL_AGENTS.slice(1) });
  assert.equal(runHook(eight, { tool_name: 'Write', tool_input: { file_path: `${eight.replace(/\\/g, '/')}/${M}/app/x.tsx` } }), 'deny');
});

// ---------------------------------------------------------------------------
// check-pr (CI)
// ---------------------------------------------------------------------------

/** Вывод `git diff --name-status -z`: `статус\0путь\0` на каждую запись. */
const zDiff = (rows) => rows.map(([s, f]) => `${s}\0${f}\0`).join('');

test('check-pr: нарушения в diff', () => {
  const diff = zDiff([
    ['A', `${M}/app/index.tsx`],
    ['M', `${M}/src/components/Button.tsx`],
    ['D', `${M}/src/screens/Old.tsx`], // удаление прежнего кода — не нарушение
    ['A', `${M}/src/content/new-world.ts`],
    ['M', `${M}/src/content/numbers-5-6.ts`],
    ['A', `${M}/src/content/__tests__/new.test.ts`],
    ['A', `${M}/app.json`],
    ['M', `${M}/src/domain/abaSession.ts`],
  ]);
  const bad = violations(diff).map((v) => v.split('\t').slice(0, 2).join(' '));
  assert.deepEqual(bad, [
    `A ${M}/app/index.tsx`,
    `M ${M}/src/components/Button.tsx`,
    `A ${M}/src/content/new-world.ts`,
  ]);
});

function git(cwd, ...args) {
  return execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function repo(gateRound) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'talentia-pr-'));
  git(dir, 'init', '-q', '-b', 'master');
  fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.claude', 'audit-gate.json'), JSON.stringify({ rounds: [gateRound] }));
  fs.mkdirSync(path.join(dir, M, 'src', 'content'), { recursive: true });
  fs.writeFileSync(path.join(dir, M, 'src', 'content', 'old.ts'), '// старый');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'base');
  git(dir, 'checkout', '-q', '-b', 'feature');
  return dir;
}

function write(dir, rel, text = 'x') {
  const f = path.join(dir, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, text);
}

function runCheck(dir, base = 'master') {
  const r = spawnSync('node', [path.join(__dirname, 'check-pr.js'), base, 'HEAD'], { cwd: dir, encoding: 'utf8', env: { ...process.env, GITHUB_WORKSPACE: dir } });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

test('check-pr: закрыто, PR добавляет экран — падает', () => {
  const dir = repo(CLOSED);
  write(dir, `${M}/app/index.tsx`);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'screen');
  const r = runCheck(dir);
  assert.equal(r.code, 1);
  assert.match(r.out, /экранный код/);
});

test('check-pr (В1): разбор -z — имена с табуляцией, переводом строки и кириллицей не теряются', () => {
  const bad = violations(
    zDiff([
      ['A', `${M}/app/экран.tsx`],
      ['M', `${M}/app/a\tb.tsx`],
      ['A', `${M}/src/content/нов\nый.ts`],
    ]),
  ).map((v) => v.split('\t')[0]);
  assert.deepEqual(bad, ['A', 'M', 'A']);
});

test('check-pr (В1): закрыто, PR добавляет экран с кириллическим именем — падает', () => {
  const dir = repo(CLOSED);
  write(dir, `${M}/app/экран.tsx`);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'cyrillic screen');
  const r = runCheck(dir);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /экран\.tsx/);
});

test('check-pr (В1): закрыто, PR добавляет новый контент с кириллицей и пробелом в имени — падает', () => {
  const dir = repo(CLOSED);
  write(dir, `${M}/src/content/новый мир.ts`);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'cyrillic content');
  assert.equal(runCheck(dir).code, 1);
});

test('check-pr (В1): результат не зависит от core.quotePath в конфиге репозитория', () => {
  const dir = repo(CLOSED);
  git(dir, 'config', 'core.quotePath', 'true');
  write(dir, `${M}/src/components/Кнопка.tsx`);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'cyrillic component');
  assert.equal(runCheck(dir).code, 1);
});

test('check-pr: закрыто, PR добавляет новый контент — падает; правка старого и тесты — проходят', () => {
  const dir = repo(CLOSED);
  write(dir, `${M}/src/content/old.ts`, '// правка');
  write(dir, `${M}/src/content/__tests__/t.test.ts`);
  write(dir, `${M}/src/domain/x.ts`);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'ok');
  assert.equal(runCheck(dir).code, 0);
  write(dir, `${M}/src/content/fresh.ts`);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'new content');
  assert.equal(runCheck(dir).code, 1);
});

test('check-pr: PR сам открыть ворота не может — состояние берётся из базы', () => {
  const dir = repo(CLOSED);
  write(dir, '.claude/audit-gate.json', JSON.stringify({ rounds: [OPEN] }));
  write(dir, `${M}/app/index.tsx`);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'fake open round + screen');
  assert.equal(runCheck(dir).code, 1);
});

test('check-pr: чистый раунд в базе — экраны проходят', () => {
  const dir = repo(OPEN);
  write(dir, `${M}/app/index.tsx`);
  write(dir, `${M}/src/content/fresh.ts`);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'screen after clean round');
  assert.equal(runCheck(dir).code, 0);
});

test('check-pr: нет базы и нет origin/master — проверка пропущена, не падает', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'talentia-pr-'));
  git(dir, 'init', '-q', '-b', 'topic');
  write(dir, 'a.txt');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'one');
  assert.equal(runCheck(dir, '0000000000000000000000000000000000000000').code, 0);
});
