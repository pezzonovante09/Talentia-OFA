/**
 * Общее ядро ворот аудита (решение владельца №76): какие пути закрыты и открыты ли ворота. Им
 * пользуются хук `audit-gate.js` (правки в сессии Claude Code) и `check-pr.js` (CI: то, что вошло в
 * PR любым путём, а не только через инструменты Claude).
 *
 * Закрыто, пока последний раунд `.claude/audit-gate.json` не чист (все девять агентов, 0 блокеров):
 * - **новые файлы контента** — `talentia-mobile/src/content/` (кроме `__tests__`);
 * - **экранный код** — любые правки в `talentia-mobile/app/`, `src/screens/`, `src/components/`.
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

/** Закрытые папки: сегменты от `talentia-mobile` и вид (`screens` — любая правка, `content` — новый файл). */
const GUARDED_DIRS = [
  { parts: ['talentia-mobile', 'app'], kind: 'screens' },
  { parts: ['talentia-mobile', 'src', 'screens'], kind: 'screens' },
  { parts: ['talentia-mobile', 'src', 'components'], kind: 'screens' },
  { parts: ['talentia-mobile', 'src', 'content'], kind: 'content' },
];

const hasGlob = (s) => /[*?[{]/.test(s);

/** Сегмент пути (возможно с шаблоном `*`, `?`, `{a,b}`) совпадает с литералом `literal` (без учёта регистра). */
function segMatch(pattern, literal) {
  if (pattern === '**') return true;
  if (!hasGlob(pattern)) return pattern.toLowerCase() === literal.toLowerCase();
  const body = pattern
    .replace(/[.+^$()|\\]/g, '\\$&')
    .replace(/\*+/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/\{([^}]*)\}/g, (_m, alt) => `(${alt.split(',').join('|')})`);
  try {
    return new RegExp(`^${body}$`, 'i').test(literal);
  } catch {
    return true; // непонятный шаблон — считаем, что может совпасть
  }
}

/** Нормализованные сегменты пути: прямые слэши, без `.`, `..` разрешены. */
function segments(p) {
  const norm = path.posix.normalize(String(p).replace(/\\/g, '/'));
  return norm.split('/').filter((s) => s && s !== '.');
}

/**
 * К какой закрытой папке относится путь: `'screens'`, `'content'` или `null`. Шаблоны в сегментах
 * (`talentia-mobile/ap*\/x.tsx`) считаются совпадением, если могут совпасть. `content/__tests__`
 * закрытым не считается. `ancestors` — путь выше закрытой папки (`talentia-mobile`, `talentia-mobile/src`):
 * для разрушающих команд (`rm -rf talentia-mobile`).
 */
function classifyPath(p, { ancestors = false } = {}) {
  const segs = segments(p);
  for (let i = 0; i < segs.length; i += 1) {
    if (!segMatch(segs[i], 'talentia-mobile')) continue;
    for (const dir of GUARDED_DIRS) {
      const rest = segs.slice(i);
      const upto = Math.min(rest.length, dir.parts.length);
      let ok = true;
      for (let k = 0; k < upto; k += 1) if (!segMatch(rest[k], dir.parts[k])) ok = false;
      if (!ok) continue;
      if (rest.length >= dir.parts.length) {
        if (dir.kind === 'content' && rest[dir.parts.length] === '__tests__') continue;
        return dir.kind;
      }
      if (ancestors) return dir.kind;
    }
  }
  return null;
}

const REAL_IO = { existsSync: fs.existsSync, realpathSync: fs.realpathSync.native };

/**
 * Настоящий путь (раунд 4, В3): короткие имена Windows 8.3 (`TALENT~1`), ссылки и регистр
 * разрешаются через `realpathSync.native` **ближайшего существующего предка**; несуществующий хвост
 * (новый файл) дописывается как есть. Относительный путь и любая ошибка — исходный путь.
 * `io` — для тестов.
 */
function realPathOf(p, io = REAL_IO) {
  const original = String(p ?? '');
  const fwd = original.replace(/\\/g, '/');
  if (!(fwd.startsWith('/') || /^[A-Za-z]:\//.test(fwd))) return original;
  let cur = path.posix.normalize(fwd);
  if (cur.length > 1 && cur.endsWith('/') && !/^[A-Za-z]:\/$/.test(cur)) cur = cur.slice(0, -1);
  const rest = [];
  try {
    while (!io.existsSync(cur)) {
      let up = path.posix.dirname(cur);
      if (/^[A-Za-z]:$/.test(up)) up += '/';
      if (up === cur || up === '.') return original;
      rest.unshift(path.posix.basename(cur));
      cur = up;
    }
    const real = String(io.realpathSync(cur)).replace(/\\/g, '/').replace(/\/$/, '');
    return [real, ...rest].join('/');
  } catch {
    return original;
  }
}

/** `classifyPath` по пути как есть, а если не закрыт — по настоящему пути (`realPathOf`). */
function classifyRealPath(p, opts = {}, io = REAL_IO) {
  return classifyPath(p, opts) ?? classifyPath(realPathOf(p, io), opts);
}

/** Состояние ворот по тексту `audit-gate.json` (пусто или битый JSON — закрыто). */
function gateStateFromText(text) {
  let rounds = [];
  try {
    rounds = JSON.parse(text).rounds ?? [];
  } catch {
    rounds = [];
  }
  const last = rounds[rounds.length - 1];
  const missing = last ? AGENTS.filter((a) => !(last.agents ?? []).includes(a)) : AGENTS;
  const open = Boolean(last) && last.blockers === 0 && missing.length === 0;
  const state = !last
    ? 'раундов аудита ещё не было'
    : missing.length
      ? `в последнем раунде (${last.date}) не было агентов: ${missing.join(', ')}`
      : `в последнем раунде (${last.date}) блокеров: ${last.blockers}`;
  return { open, state, last, missing };
}

/** Открыты ли ворота: последний раунд — все девять агентов и ноль блокеров. */
function gateState(root) {
  let text = '';
  try {
    text = fs.readFileSync(path.join(root, '.claude', 'audit-gate.json'), 'utf8');
  } catch {
    text = '';
  }
  return gateStateFromText(text);
}

module.exports = {
  AGENTS,
  GUARDED_DIRS,
  classifyPath,
  classifyRealPath,
  realPathOf,
  segMatch,
  segments,
  gateState,
  gateStateFromText,
  hasGlob,
};
