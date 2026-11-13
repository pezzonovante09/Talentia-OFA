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

/** Юр-тексты в локалях: тексты согласий (их хеши — в `consentTexts.test.ts`) и политика в приложении. */
const LEGAL_KEYS = [
  'parent.consent.title',
  'parent.consent.body',
  'parent.aba.consentTitle',
  'parent.aba.consentBody',
  'parent.aba.localOnly',
  'parent.policy.body',
];

function legalValues(jsonText) {
  let tree;
  try {
    tree = JSON.parse(jsonText);
  } catch {
    return null;
  }
  return LEGAL_KEYS.map((k) => k.split('.').reduce((n, p) => (n && typeof n === 'object' ? n[p] : undefined), tree));
}

/**
 * Задевает ли правка юр-значение файла на диске. Write — сравнение значений до и после; Edit — есть ли строка
 * заменяемого куска (без `"ключ": "` и `",`) внутри юр-значения в том виде, как оно записано в файле.
 */
function touchesLegal(filePath, tool) {
  let disk;
  try {
    disk = fs.readFileSync(filePath, 'utf8');
  } catch {
    return false;
  }
  const now = legalValues(disk);
  if (!now) return false;
  if (typeof tool.content === 'string') return JSON.stringify(legalValues(tool.content)) !== JSON.stringify(now);
  const raws = now.filter((v) => typeof v === 'string').map((v) => JSON.stringify(v).slice(1, -1));
  return String(tool.old_string ?? '')
    .split('\n')
    .map((l) => l.trim().replace(/^"[^"]+":\s*"/, '').replace(/",?$/, ''))
    .filter((piece) => piece.length >= 8)
    .some((piece) => raws.some((r) => r.includes(piece)));
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
  const rawPath = String(input?.tool_input?.file_path ?? '');
  const file = rawPath.replace(/\\/g, '/');
  // Юртексты внутри приложения тоже требуют ky (№133; контрольный аудит 2026-11-09, `localization-qa`): версии согласий
  // (`consentTexts.ts`) и ключи локалей из `LEGAL_KEYS`. По правке ru/en.json ключ не виден — ловится двумя способами:
  // по тексту (эти значения начинаются с «Черновик.» / «Draft.» или говорят «ничего не уходит в интернет») и, для
  // правки из середины, — по совпадению заменяемого куска с юр-значениями файла на диске (`qa-engineer`, этап C).
  const tool = input?.tool_input ?? {};
  const edited = String(tool.new_string ?? tool.content ?? '');
  const legalDoc = /docs\/legal\/[^/]+\.(ru|en)\.md$/.test(file);
  const consentCode = /src\/domain\/consentTexts\.ts$/.test(file);
  const localeFile = /src\/i18n\/locales\/(ru|en)\.json$/.test(file);
  const consentKeys =
    localeFile &&
    (/Черновик\.|Draft\.|Ничего не уходит в интернет|В интернет ничего не уходит|Nothing goes online/.test(edited) ||
      touchesLegal(rawPath, tool));
  if (!legalDoc && !consentCode && !consentKeys) return;

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
