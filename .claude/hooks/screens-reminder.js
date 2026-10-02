#!/usr/bin/env node
/**
 * PreToolUse (Write|Edit): перед первой правкой экранного кода в сессии напоминает
 * про отложенную доменную логику хода урока (REBUILD.md, «Ход урока — к экранам»).
 * Не блокирует — только добавляет контекст, один раз за сессию.
 *
 * Удалить хук (этот файл и запись в .claude/settings.json), когда логика сделана.
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
  if (!/talentia-mobile\/(app|src\/screens|src\/components)\//.test(file)) return;

  const marker = path.join(os.tmpdir(), `talentia-screens-reminder-${input.session_id ?? 'none'}`);
  if (fs.existsSync(marker)) return;
  fs.writeFileSync(marker, '');

  const additionalContext = [
    'Talentia: начинается экранный код. Перед экранами урока сделать отложенную доменную',
    'логику хода урока — REBUILD.md, раздел «Ход урока — к экранам», спецификация —',
    'FORMATS.md, «Разобранный пример, объяснение, отрывок, клавиатура»: modelPlan (полный /',
    'короткий / без примера), полный пример при откате навыка в первую коробку (дата показа',
    'в SkillState), таймауты ведомого тапа 5 и 10 с, showAnswerCue по полосам (решение №32),',
    'демонстрация первой встречи с составным форматом по истории ребёнка (решение №35).',
    'Скажи об этом владельцу, если работа ещё не сделана.',
  ].join(' ');
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext } }),
  );
});
