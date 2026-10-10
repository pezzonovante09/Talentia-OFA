#!/usr/bin/env node
/**
 * PreToolUse (Write|Edit|NotebookEdit|Bash|PowerShell): ворота аудита (решение владельца
 * 2026-10-09). Пока полный аудит сделанного не прошёл раунд без блокеров, не начинается новая
 * работа поверх фундамента:
 *
 * - **новые файлы контента** — `talentia-mobile/src/content/` (уроки, задания, цели ABA);
 * - **экранный код** — любые правки в `talentia-mobile/app/`, `src/screens/`, `src/components/`.
 *
 * Правки существующего контента (например, пилота по находкам аудита) не блокируются.
 *
 * Bash и PowerShell (решение №91): команда, которая упоминает закрытую папку и похожа на запись
 * (перенаправление, `tee`, `sed -i`, `cp` / `mv` / `rm` / `touch`, `writeFile`, `git checkout`,
 * `Set-Content` и т. п.), блокируется целиком — новый файл от правки там не отличить. Чтение
 * (`cat`, `grep`, `ls`) проходит. NotebookEdit проверяется как Edit.
 *
 * Ворота открыты, когда в `.claude/audit-gate.json` последний раунд — все девять агентов из
 * `.claude/agents/` (дизайн и UX — последовательно) и **0 блокеров**. Раунд с блокерами
 * дописывается туда же; блокеры чинятся, и аудит повторяется, пока раунд не станет чистым.
 * Записывает раунд основной поток после сводки отчётов агентов — не раньше.
 */
const fs = require('fs');
const path = require('path');

const AGENTS = [
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

const SCREENS = /talentia-mobile\/(app|src\/screens|src\/components)\//i;
const CONTENT = /talentia-mobile\/src\/content\//i;
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
    String.raw`\bsed\b[^|;&]*\s-i`,
    String.raw`\b(writeFile|appendFile|copyFile|rename|unlink|rmSync|mkdirSync|createWriteStream)`,
    String.raw`\bopen\([^)]*['"][wax]`,
    String.raw`\bgit\s+(checkout|restore|apply|am|mv|rm|reset|stash|cherry-pick|revert|merge|pull)\b`,
    String.raw`\b(Set-Content|Add-Content|Out-File|New-Item|Copy-Item|Move-Item|Remove-Item|Rename-Item|Expand-Archive)\b`,
    String.raw`\[(System\.)?IO\.File\]`,
  ].join('|'),
  'i',
);

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

/** Команда оболочки пишет в закрытую папку? Перенаправления в /dev/null и $null не в счёт. */
function shellWritesGuarded(command) {
  const cmd = dropMessages(String(command ?? ''))
    .replace(/\\/g, '/')
    .replace(/\d*>>?\s*(\/dev\/null|\$null|nul)\b/gi, ' ')
    .replace(/\d?>&\d/g, ' ');
  return SHELL_PATH.test(cmd) && SHELL_WRITE.test(cmd);
}

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
  const file = shell
    ? String(input?.tool_input?.command ?? '')
    : String(input?.tool_input?.file_path ?? input?.tool_input?.notebook_path ?? '').replace(/\\/g, '/');
  const shellWrite = shell && shellWritesGuarded(file);
  const screens = !shell && SCREENS.test(file);
  const newContent =
    !shell &&
    CONTENT.test(file) &&
    !/\/__tests__\//.test(file) &&
    tool === 'Write' &&
    !fs.existsSync(input.tool_input.file_path);
  if (!screens && !newContent && !shellWrite) return;

  const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  let rounds = [];
  try {
    rounds = JSON.parse(fs.readFileSync(path.join(root, '.claude', 'audit-gate.json'), 'utf8')).rounds ?? [];
  } catch {
    rounds = [];
  }
  const last = rounds[rounds.length - 1];
  const missing = last ? AGENTS.filter((a) => !(last.agents ?? []).includes(a)) : AGENTS;
  if (last && last.blockers === 0 && missing.length === 0) return;

  const state = !last
    ? 'раундов аудита ещё не было'
    : missing.length
      ? `в последнем раунде (${last.date}) не было агентов: ${missing.join(', ')}`
      : `в последнем раунде (${last.date}) блокеров: ${last.blockers}`;
  const what = shellWrite ? 'запись через оболочку в закрытую папку' : screens ? 'экранный код' : 'новый файл контента';
  const reason = [
    `Ворота аудита закрыты (${state}): ${what} — ${file}.`,
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
