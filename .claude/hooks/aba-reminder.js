#!/usr/bin/env node
/**
 * PreToolUse (Write|Edit): напоминания по ABA-режиму из решений владельца 2026-10-02 (AUDIT.md,
 * №52–61; ABA.md, «Сетка целей»). Не блокирует — добавляет контекст, каждое напоминание один
 * раз за сессию.
 *
 * - Контент и цели ABA (`src/content/aba*`, `src/aba/`) — состав первой версии, список
 *   самообслуживания и что в него не входит (№58), цели только на русском (№57).
 * - Экраны ABA (`app/`, `src/screens/`, `src/components/` с «aba» в пути) — журнал взрослого
 *   отложен на будущее (№55), его делать вместе с `child-privacy-compliance`.
 *
 * Удалить напоминание, когда сделано: самообслуживание — когда цели написаны; журнал — когда
 * владелец включит его в работу.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const REMINDERS = [
  {
    id: 'aba-content',
    match: /talentia-mobile\/src\/(content\/aba|aba\/)/i,
    text: [
      'Talentia, контент ABA. Первая версия (решение №54): ступень 1 целиком + из ступени 2 —',
      'match по категориям, LRFFC и say по картинке; ступень 3 — позже. Цели только на русском,',
      'кыргызские — позже, с логопедом-носителем (№57). Самообслуживание (№58) — цепочки do_action',
      'с картинками шагов: мыть руки, чистить зубы, надеть обувь на липучке, убрать игрушки,',
      'повесить куртку. НЕ делать: туалет, купание, переодевание. Сетка — ABA.md, «Сетка целей».',
    ].join(' '),
  },
  {
    id: 'aba-screens',
    match: /talentia-mobile\/(app|src\/screens|src\/components)\/.*aba/i,
    text: [
      'Talentia, экраны ABA. Журнал взрослого (просьба словом или жестом, отклик на имя, перенос',
      'вне экрана) — не в первой версии, но запланирован (решение №55): напомни владельцу, когда',
      'дойдёт дело; это расширяет данные о здоровье — проектировать вместе с',
      'child-privacy-compliance. Карточка перерыва — событие, а не цель с критерием.',
    ].join(' '),
  },
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
  const due = REMINDERS.filter((r) => {
    if (!r.match.test(file)) return false;
    const marker = path.join(os.tmpdir(), `talentia-${r.id}-${input.session_id ?? 'none'}`);
    if (fs.existsSync(marker)) return false;
    fs.writeFileSync(marker, '');
    return true;
  });
  if (!due.length) return;
  const additionalContext = due.map((r) => r.text).join('\n');
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext } }),
  );
});
