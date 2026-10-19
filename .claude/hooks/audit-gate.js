#!/usr/bin/env node
/**
 * PreToolUse (Write|Edit|MultiEdit|NotebookEdit|Bash|PowerShell): ворота аудита (решение владельца
 * 2026-10-09). Пока полный аудит сделанного не прошёл раунд без блокеров, не начинается новая
 * работа поверх фундамента:
 *
 * - **новые файлы контента** — `talentia-mobile/src/content/` (уроки, задания, цели ABA);
 * - **экранный код** — любые правки в `talentia-mobile/app/`, `src/screens/`, `src/components/`.
 *
 * Правки существующего контента (например, пилота по находкам аудита) не блокируются.
 *
 * Bash и PowerShell (решения №91 и раунд 3): команда, которая упоминает закрытую папку и похожа на
 * запись, блокируется целиком — новый файл от правки там не отличить. «Упоминает» — это:
 * - путь в тексте (полный, относительный, с шаблонами `ap*`, `{app,x}`);
 * - любой путь-аргумент, который **относительно текущей папки сессии** (`cwd`) ведёт в закрытую папку:
 *   `cd talentia-mobile/app` в одной команде и `echo > x.tsx` в другой не проходят;
 * - для разрушающих команд (`rm`, `mv`, `Remove-Item`, `git clean` …) ещё и путь **выше** закрытой
 *   папки (`rm -rf talentia-mobile`).
 * «Запись» — перенаправление, `tee`, `cp` / `mv` / `rm`, псевдонимы PowerShell (`copy`, `move`,
 * `ni`, `sc`, `ac`, `del`, `ren` …), `robocopy` / `xcopy`, `sed -i`, `perl -i`, `awk -i inplace`,
 * `prettier --write`, `eslint --fix`, `curl -o` / `wget -O` / `-OutFile`, `writeFile` /
 * `write_text` / `shutil`, `git checkout` и т. п. Чтение (`cat`, `grep`, `ls`) проходит.
 * Известное ограничение: команда, где рядом стоят запись (даже в scratchpad) и закрытая папка
 * (`jest src/content > out.txt`), блокируется целиком — разнести на две команды.
 *
 * Разбор оболочки неполный (раунд 4, В6): переменные (`$d="talentia-mobile/app"; … > $d/x`),
 * склейка кавычек (`'talentia-mo''bile'`), скрипты из файла, `git apply` готового патча и т. п. он не
 * видит и видеть не будет. Это защита от случайной записи, а не от обхода. Настоящая защита —
 * `check-pr.js` в CI: он смотрит на результат (diff PR), каким бы путём файл ни появился.
 *
 * Ворота открыты, когда в `.claude/audit-gate.json` последний раунд — все девять агентов из
 * `.claude/agents/` (дизайн и UX — последовательно) и **0 блокеров** (`gate-core.js`). То же в CI
 * проверяет `check-pr.js`: хук видит только инструменты Claude, а PR может прийти любым путём.
 */
const fs = require('fs');
const path = require('path');
const { classifyRealPath, gateState, hasGlob } = require('./gate-core');

// Пути в команде оболочки — и полные, и относительные (`cd talentia-mobile && … > app/x.tsx`).
// `app.json` и `__tests__` контента — не закрытые.
const GUARDED_DIR = String.raw`(app|src\/screens|src\/components|src\/content(?!\/__tests__\/))(?=\/|[\s'"\`;|&)]|$)`;
const SHELL_PATH = new RegExp(
  String.raw`talentia-mobile\/${GUARDED_DIR}|(^|[\s'"\`=(:])(\.\/)?${GUARDED_DIR}`,
  'i',
);
const SHELL_WRITE = new RegExp(
  [
    String.raw`(^|[^<>&0-9])>{1,2}`,
    String.raw`\b(tee|touch|cp|mv|rm|rmdir|mkdir|ln|install|rsync|dd|truncate|unzip|tar|patch)\b`,
    // псевдонимы и команды PowerShell / cmd
    String.raw`\b(copy|cpi|ci|move|mi|del|erase|rd|ren|rni|md|ni|sc|ac|clc|si|robocopy|xcopy|attrib)\b`,
    String.raw`\bsed\b[^|;&]*\s-i`,
    String.raw`\b(perl|ruby)\b[^|;&]*\s-\w*i`,
    String.raw`\bawk\b[^|;&]*inplace`,
    String.raw`--write\b|\bprettier\b[^|;&]*\s-w\b|\beslint\b[^|;&]*--fix\b|\bbiome\b[^|;&]*--(write|apply)`,
    String.raw`\bcurl\b[^|;&]*\s-[oO]\b|\bwget\b[^|;&]*\s-O\b|-OutFile\b`,
    String.raw`\b(writeFile|appendFile|copyFile|rename|unlink|rmSync|mkdirSync|createWriteStream|writeSync)`,
    String.raw`\b(write_text|write_bytes)\b|\bshutil\.|\bos\.(rename|replace|remove|makedirs|mkdir|unlink)\b`,
    String.raw`\bopen\([^)]*['"][wax]`,
    String.raw`\bgit\s+(checkout|restore|apply|am|mv|rm|reset|stash|cherry-pick|revert|merge|pull|clean)\b`,
    String.raw`\b(Set-Content|Add-Content|Out-File|New-Item|Copy-Item|Move-Item|Remove-Item|Rename-Item|Expand-Archive|Clear-Content|Tee-Object|Export-Csv|Export-Clixml|Set-Item)\b`,
    String.raw`\[(System\.)?IO\.File\]`,
    // раунд 4, В6: .NET-запись и ссылки на закрытую папку
    String.raw`\bStreamWriter\b|\bIO\.Directory|\bmklink\b|\bJunction\b`,
  ].join('|'),
  'i',
);
/** Разрушающие команды: для них закрытым считается и путь выше закрытой папки. */
const SHELL_DESTRUCTIVE = /\b(rm|rmdir|del|erase|rd|rimraf|mv|move|Remove-Item|Move-Item|git\s+clean)\b/i;

// Текст сообщения — не запись: тело heredoc для `git commit` / `git tag` / `gh` и `-m "…"`.
// Heredoc для `node`, `python` и т. п. остаётся — там это код.
const HEREDOC = /<<-?[ \t]*(['"]?)(\w+)\1([^\n]*)\n[\s\S]*?\n[ \t]*\2[ \t]*(?=\n|$)/g;
const MESSAGE_CMD = /\b(git\s+(commit|tag)|gh\s+\w+)\b[^\n]*$/;

function dropMessages(cmd) {
  return cmd
    .replace(HEREDOC, (whole, _q, tag, rest, offset) => {
      const line = cmd.slice(cmd.lastIndexOf('\n', offset) + 1, offset);
      return MESSAGE_CMD.test(line) ? `<<${tag}${rest}\n` : whole;
    })
    .replace(/(\s(-m|--message|--body|--title)[=\s]*)("(?:[^"\\]|\\.)*"|'[^']*')/g, '$1""');
}

/** Аргументы-пути команды: отбрасываем флаги и пустое; разделители — пробелы, кавычки, `;|&()<>=,`. */
function pathTokens(cmd) {
  return cmd
    // запятая разделяет аргументы (PowerShell: `a,b`), но не альтернативы в `{app,src}`
    .replace(/,(?![^{}]*})/g, ' ')
    .split(/[\s'"`;|&()<>=]+/)
    .map((t) => t.trim())
    .filter((t) => t && !t.startsWith('-') && !/^\$/.test(t));
}

/** Путь-аргумент относительно `cwd` ведёт в закрытую папку? */
function tokenGuarded(token, cwd, destructive) {
  const t = token.replace(/\\/g, '/');
  const absolute = t.startsWith('/') || /^[A-Za-z]:\//.test(t) || t.startsWith('~');
  const full = absolute || !cwd ? t : `${cwd}/${t}`;
  return classifyRealPath(full, { ancestors: destructive }) !== null;
}

/**
 * Команда оболочки пишет в закрытую папку? Перенаправления в /dev/null и $null не в счёт.
 * `cwd` — текущая папка сессии из входа хука (если есть).
 */
function shellWritesGuarded(command, cwd = '') {
  const cmd = dropMessages(String(command ?? ''))
    .replace(/\\/g, '/')
    .replace(/\d*>>?\s*(\/dev\/null|\$null|nul)\b/gi, ' ')
    .replace(/\d?>&\d/g, ' ');
  if (!SHELL_WRITE.test(cmd)) return false;
  if (SHELL_PATH.test(cmd)) return true;
  const here = String(cwd ?? '').replace(/\\/g, '/');
  const destructive = SHELL_DESTRUCTIVE.test(cmd);
  return pathTokens(cmd).some((t) => tokenGuarded(t, here, destructive) || (hasGlob(t) && tokenGuarded(t, '', destructive)));
}

/** Путь, который правит инструмент записи (Write, Edit, MultiEdit, NotebookEdit), — в абсолютный. */
function toolFile(input, cwd) {
  const f = String(input?.tool_input?.file_path ?? input?.tool_input?.notebook_path ?? '').replace(/\\/g, '/');
  if (!f) return '';
  const abs = f.startsWith('/') || /^[A-Za-z]:\//.test(f) ? f : `${String(cwd).replace(/\\/g, '/')}/${f}`;
  return path.posix.normalize(abs);
}

function main() {
  let raw = '';
  process.stdin.on('data', (c) => (raw += c));
  process.stdin.on('end', () => {
    let input;
    try {
      input = JSON.parse(raw);
    } catch {
      return;
    }
    const tool = input?.tool_name;
    const shell = tool === 'Bash' || tool === 'PowerShell';
    const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
    const cwd = String(input.cwd || root);
    const file = shell ? String(input?.tool_input?.command ?? '') : toolFile(input, cwd);
    const shellWrite = shell && shellWritesGuarded(file, cwd);
    // путь разрешается и через короткие 8.3-имена (`TALENT~1`) — раунд 4, В3
    const kind = !shell && file ? classifyRealPath(file) : null;
    const screens = kind === 'screens';
    // новый файл контента — любым инструментом записи (Write, Edit с пустым old_string, MultiEdit,
    // NotebookEdit), если файла ещё нет: условие — существование файла, а не имя инструмента (раунд 4, В2).
    // Правка существующего контента не блокируется.
    const newContent = kind === 'content' && !fs.existsSync(file);
    if (!screens && !newContent && !shellWrite) return;

    const gate = gateState(root);
    if (gate.open) return;

    const what = shellWrite ? 'запись через оболочку в закрытую папку' : screens ? 'экранный код' : 'новый файл контента';
    const reason = [
      `Ворота аудита закрыты (${gate.state}): ${what} — ${file}.`,
      'Решение владельца 2026-10-09: перед заданиями, фронтом и подобным — полный аудит всего',
      'сделанного всеми девятью агентами (design-lead → child-ux-specialist последовательно), раунд',
      'за раундом, пока специалисты не перестанут находить блокеры. Каждый раунд — в',
      '.claude/audit-gate.json ({ date, commit, agents, blockers }), блокеры — в AUDIT.md.',
      'Скажи владельцу, что ворота закрыты, и предложи следующий раунд аудита.',
    ].join(' ');
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason },
      }),
    );
  });
}

if (require.main === module) main();

module.exports = { shellWritesGuarded, toolFile, dropMessages };
