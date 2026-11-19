/**
 * Хук `.claude/hooks/legal-ky-reminder.js` (PreToolUse Write|Edit): напоминает о кыргызской версии юртекстов (№133)
 * один раз за сессию. Условия расширены контрольным аудитом 2026-11-09 (этап C, `localization-qa`): кроме
 * `docs/legal/*.ru|en.md` — `src/domain/consentTexts.ts` и ru/en.json, когда правка содержит юр-текст согласия
 * («Черновик.» / «Draft.» / «Ничего не уходит в интернет» / «Nothing goes online»).
 *
 * Хук запускается настоящим `node` со stdin JSON, как его зовёт Claude Code. Проект подменяется временной папкой
 * (`CLAUDE_PROJECT_DIR`), чтобы наличие `*.ky.md` было под контролем теста, а `os.tmpdir()` хука — своей папкой,
 * чтобы маркер сессии не попадал в общий temp и удалялся вместе с ней. `session_id` уникален на каждый запуск.
 */
import { spawnSync } from 'child_process';
import { randomUUID } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const HOOK = path.join(REPO_ROOT, '.claude', 'hooks', 'legal-ky-reminder.js');

let base: string;
let project: string;
let tmp: string;

beforeEach(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'talentia-legal-hook-test-'));
  project = path.join(base, 'project');
  tmp = path.join(base, 'tmp');
  fs.mkdirSync(path.join(project, 'docs', 'legal'), { recursive: true });
  fs.mkdirSync(tmp);
});

afterEach(() => {
  fs.rmSync(base, { recursive: true, force: true });
});

type ToolInput = { file_path: string; old_string?: string; new_string?: string; content?: string };

const hookEnv = () => ({ ...process.env, CLAUDE_PROJECT_DIR: project, TMPDIR: tmp, TEMP: tmp, TMP: tmp });

function runHook(toolInput: ToolInput, sessionId: string = randomUUID()): string {
  const res = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ session_id: sessionId, hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: toolInput }),
    env: hookEnv(),
    encoding: 'utf8',
    timeout: 20_000,
  });
  expect({ status: res.status, stderr: res.stderr }).toEqual({ status: 0, stderr: '' });
  return res.stdout;
}

const reminded = (stdout: string) => {
  if (stdout === '') return false;
  const out = JSON.parse(stdout) as { hookSpecificOutput: { hookEventName: string; additionalContext: string } };
  return out.hookSpecificOutput.hookEventName === 'PreToolUse' && /Кыргызская версия обязательна/.test(out.hookSpecificOutput.additionalContext);
};

const RU_JSON = 'C:\\repo\\talentia-mobile\\src\\i18n\\locales\\ru.json';
const EN_JSON = '/repo/talentia-mobile/src/i18n/locales/en.json';

describe('legal-ky-reminder: когда напоминает', () => {
  it('файл хука на месте — тест запускает настоящий хук', () => {
    expect(fs.existsSync(HOOK)).toBe(true);
  });

  it('правка docs/legal/x.ru.md — напоминает', () => {
    expect(reminded(runHook({ file_path: '/repo/docs/legal/x.ru.md', new_string: 'что угодно' }))).toBe(true);
  });

  it('правка docs/legal/privacy-policy.en.md с путём Windows — напоминает', () => {
    expect(reminded(runHook({ file_path: 'C:\\repo\\docs\\legal\\privacy-policy.en.md', new_string: 'x' }))).toBe(true);
  });

  it('правка src/domain/consentTexts.ts — напоминает, даже без юр-слов в правке', () => {
    expect(reminded(runHook({ file_path: 'C:\\repo\\talentia-mobile\\src\\domain\\consentTexts.ts', new_string: "const ABA = ['ru-draft-4'];" }))).toBe(true);
  });

  it('ru.json, правка с «Черновик.» — напоминает', () => {
    expect(reminded(runHook({ file_path: RU_JSON, new_string: '"body": "Черновик. Мы храним данные на устройстве."' }))).toBe(true);
  });

  it('ru.json, правка с «Ничего не уходит в интернет» — напоминает', () => {
    expect(reminded(runHook({ file_path: RU_JSON, new_string: '"localOnly": "Ничего не уходит в интернет"' }))).toBe(true);
  });

  it('en.json через Write (content, не new_string) с «Draft.» — напоминает', () => {
    expect(reminded(runHook({ file_path: EN_JSON, content: '{ "parent": { "consent": { "body": "Draft. We keep data on the device." } } }' }))).toBe(true);
  });

  it('en.json, правка с «Nothing goes online» — напоминает', () => {
    expect(reminded(runHook({ file_path: EN_JSON, new_string: '"x": "Nothing goes online"' }))).toBe(true);
  });
});

/**
 * Правка из середины юр-текста (`qa-engineer` по этапу C): ни «Черновик.», ни «интернет» в куске нет — хук сверяет
 * заменяемый кусок с юр-значениями настоящего файла локали на диске. Файл пишется в папку теста.
 */
describe('legal-ky-reminder: правка из середины юр-текста в локали', () => {
  const BODY = 'Черновик. Данные хранятся на этом устройстве. Удалить всё можно в разделе «Для взрослых».';
  const tree = { parent: { consent: { title: 'Согласие', body: BODY }, home: { title: 'Дом' } } };
  const write = () => {
    const dir = path.join(project, 'talentia-mobile', 'src', 'i18n', 'locales');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'ru.json');
    fs.writeFileSync(file, `${JSON.stringify(tree, null, 2)}\n`);
    return file;
  };

  it('Edit куска из середины тела согласия — напоминает', () => {
    expect(reminded(runHook({ file_path: write(), old_string: 'хранятся на этом устройстве', new_string: 'лежат на телефоне' }))).toBe(true);
  });

  it('Edit конца тела вместе со следующей строкой файла — напоминает', () => {
    expect(reminded(runHook({ file_path: write(), old_string: 'Удалить всё можно в разделе «Для взрослых»."\n    },', new_string: 'x' }))).toBe(true);
  });

  it('Edit заголовка согласия — напоминает: он входит в хеш версии', () => {
    expect(reminded(runHook({ file_path: write(), old_string: '"title": "Согласие"', new_string: '"title": "Согласие родителя"' }))).toBe(true);
  });

  it('Write без слов-меток: изменённое юр-значение — напоминает, неизменное — молчит', () => {
    // «Черновик.» в теле ловится и без сверки; здесь его нет, чтобы проверить именно сравнение значений
    const body = BODY.replace('Черновик. ', '');
    const file = write();
    fs.writeFileSync(file, JSON.stringify({ parent: { consent: { title: 'Согласие', body }, home: { title: 'Дом' } } }, null, 2));
    const same = { parent: { consent: { title: 'Согласие', body }, home: { title: 'Главная' } } };
    const changed = { parent: { consent: { title: 'Согласие', body: body.replace('устройстве', 'телефоне') }, home: { title: 'Дом' } } };
    expect(runHook({ file_path: file, content: JSON.stringify(same, null, 2) })).toBe('');
    expect(reminded(runHook({ file_path: file, content: JSON.stringify(changed, null, 2) }))).toBe(true);
  });

  it('Edit не юр-ключа в том же файле — молчит', () => {
    expect(runHook({ file_path: write(), old_string: '"title": "Дом"', new_string: '"title": "Главная"' })).toBe('');
  });
});

describe('legal-ky-reminder: когда молчит', () => {
  it('ru.json без юр-текста — молчит', () => {
    expect(runHook({ file_path: RU_JSON, new_string: '"lessons_one": "урок"' })).toBe('');
  });

  it('ky.json даже с «Черновик.» — молчит (условие только для ru/en)', () => {
    expect(runHook({ file_path: 'C:\\repo\\talentia-mobile\\src\\i18n\\locales\\ky.json', new_string: 'Черновик.' })).toBe('');
  });

  it.each([
    ['/repo/talentia-mobile/app/parent/index.tsx', 'Черновик.'],
    ['/repo/talentia-mobile/src/domain/consent.ts', 'x'],
    ['/repo/docs/legal/README.md', 'x'],
    ['/repo/docs/legal/privacy-policy.ky.md', 'x'],
    ['/repo/TALI.md', 'Draft.'],
  ])('прочий файл %s — молчит', (file, text) => {
    expect(runHook({ file_path: file, new_string: text })).toBe('');
  });

  it('второй раз в той же сессии — молчит; маркер сессии лежит в tmpdir хука', () => {
    const sid = randomUUID();
    expect(reminded(runHook({ file_path: '/repo/docs/legal/x.ru.md', new_string: 'x' }, sid))).toBe(true);
    expect(fs.existsSync(path.join(tmp, `talentia-legal-ky-reminder-${sid}`))).toBe(true);
    expect(runHook({ file_path: '/repo/talentia-mobile/src/domain/consentTexts.ts', new_string: 'x' }, sid)).toBe('');
  });

  it('другая сессия — напоминает снова', () => {
    runHook({ file_path: '/repo/docs/legal/x.ru.md', new_string: 'x' });
    expect(reminded(runHook({ file_path: '/repo/docs/legal/x.ru.md', new_string: 'x' }))).toBe(true);
  });

  it('все три *.ky.md на месте — молчит (условие удаления хука)', () => {
    for (const n of ['privacy-policy', 'terms-of-use', 'account-deletion']) fs.writeFileSync(path.join(project, 'docs', 'legal', `${n}.ky.md`), '');
    expect(runHook({ file_path: '/repo/docs/legal/x.ru.md', new_string: 'x' })).toBe('');
  });

  it('нет одного *.ky.md — напоминает и называет именно его', () => {
    for (const n of ['privacy-policy', 'account-deletion']) fs.writeFileSync(path.join(project, 'docs', 'legal', `${n}.ky.md`), '');
    const out = runHook({ file_path: '/repo/docs/legal/x.ru.md', new_string: 'x' });
    const ctx = (JSON.parse(out) as { hookSpecificOutput: { additionalContext: string } }).hookSpecificOutput.additionalContext;
    expect(ctx).toMatch(/нет terms-of-use\.ky\.md\./);
  });

  it('битый JSON на stdin — молчит и не падает', () => {
    const res = spawnSync(process.execPath, [HOOK], { input: 'not json', env: hookEnv(), encoding: 'utf8', timeout: 20_000 });
    expect([res.status, res.stdout]).toEqual([0, '']);
  });
});
