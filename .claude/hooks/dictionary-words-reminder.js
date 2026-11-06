#!/usr/bin/env node
/**
 * PreToolUse (Write|Edit): перед первой правкой контента Побережья слов в сессии напоминает,
 * что список словарных слов ждёт от владельца (решение №51, 2026-10-02). В стандарте КР
 * «Русский язык и чтение» словарного минимума нет — везде «согласно минимуму»
 * (`docs/sources/russian-1-4.md`), а выдуманный список научит не тем словам.
 * Не блокирует — только добавляет контекст, один раз за сессию.
 *
 * Удалить хук (этот файл и запись в .claude/settings.json), когда список лежит в
 * `docs/sources/dictionary-words.md`.
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
  if (!/talentia-mobile\/src\/content\/words-[^/]+\.ts$|docs\/sources\/dictionary-words\.md$/.test(file)) return;

  const marker = path.join(os.tmpdir(), `talentia-dictionary-reminder-${input.session_id ?? 'none'}`);
  if (fs.existsSync(marker)) return;
  fs.writeFileSync(marker, '');

  const additionalContext = [
    'Talentia: правка контента Побережья слов. Список словарных слов ещё не получен от',
    'владельца (решение №51): уроки «Словарные слова» (тема «Проверяем букву», полоса 8,',
    'навык dictionary-words-2) и словарные слова в других темах не писать и слова не',
    'придумывать — спросить владельца список и положить его в docs/sources/dictionary-words.md.',
  ].join(' ');
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext } }),
  );
});
