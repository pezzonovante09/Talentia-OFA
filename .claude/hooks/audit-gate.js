#!/usr/bin/env node
/**
 * PreToolUse (Write|Edit): ворота аудита (решение владельца 2026-10-09). Пока полный аудит
 * сделанного не прошёл раунд без блокеров, не начинается новая работа поверх фундамента:
 *
 * - **новые файлы контента** — `talentia-mobile/src/content/` (уроки, задания, цели ABA);
 * - **экранный код** — любые правки в `talentia-mobile/app/`, `src/screens/`, `src/components/`.
 *
 * Правки существующего контента (например, пилота по находкам аудита) не блокируются.
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

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    return;
  }
  const file = String(input?.tool_input?.file_path ?? '').replace(/\\/g, '/');
  const screens = /talentia-mobile\/(app|src\/screens|src\/components)\//.test(file);
  const newContent =
    /talentia-mobile\/src\/content\//.test(file) &&
    !/\/__tests__\//.test(file) &&
    input?.tool_name === 'Write' &&
    !fs.existsSync(input.tool_input.file_path);
  if (!screens && !newContent) return;

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
  const what = screens ? 'экранный код' : 'новый файл контента';
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
