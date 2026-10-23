#!/usr/bin/env node
/**
 * PreToolUse (Write|Edit): перед первой правкой юридических текстов в сессии напоминает, что
 * кыргызская версия политики, условий и страницы удаления обязательна к публикации в КР
 * (решение владельца №133, 2026-10-23; взгляд ментора П6). Пока `docs/legal/*.ky.md` нет,
 * изменение ru-текста — это ещё и долг перевода носителем после утверждения ru.
 * Не блокирует — только добавляет контекст, один раз за сессию.
 *
 * Удалить хук (этот файл и запись в .claude/settings.json), когда все три `*.ky.md` лежат в
 * `docs/legal/` и утверждены.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

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
  if (!/docs\/legal\/[^/]+\.(ru|en)\.md$/.test(file)) return;

  const legalDir = path.join(process.env.CLAUDE_PROJECT_DIR ?? process.cwd(), 'docs', 'legal');
  const missing = ['privacy-policy', 'terms-of-use', 'account-deletion'].filter(
    (name) => !fs.existsSync(path.join(legalDir, `${name}.ky.md`)),
  );
  if (missing.length === 0) return;

  const marker = path.join(os.tmpdir(), `talentia-legal-ky-reminder-${input.session_id ?? 'none'}`);
  if (fs.existsSync(marker)) return;
  fs.writeFileSync(marker, '');

  const additionalContext = [
    'Talentia: правка юридических текстов. Кыргызская версия обязательна к публикации в КР',
    `(решение №133): нет ${missing.map((n) => `${n}.ky.md`).join(', ')}.`,
    'Перевод — носителем после утверждения ru; изменение ru-текста должно попасть и в ky.',
    'Блокер публикации — docs/legal/README.md, чеклист.',
  ].join(' ');
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext } }),
  );
});
