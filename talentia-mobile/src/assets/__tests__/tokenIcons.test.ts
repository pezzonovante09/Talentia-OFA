/**
 * Каждая иконка, на которую ссылаются токены дизайна (`src/design/`), должна быть в реестре `ICONS`
 * (`src/assets/registry.ts`). Иначе экран возьмёт `ICONS[token.icon]`, получит `undefined` и нарисует
 * пустое место там, где ребёнку нужна подсказка.
 *
 * Реестр здесь не импортируется (он тянет .svg, а Jest их не трансформирует — как в `registry.test.ts`):
 * ключи `ICONS` разбираются из исходника. Иконки в токенах — любые строковые поля `icon` / `*Icon`.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as abaTokens from '../../design/abaTokens';
import * as parentTokens from '../../design/parentTokens';
import * as tokens from '../../design/tokens';

const registrySource = fs.readFileSync(path.join(__dirname, '..', 'registry.ts'), 'utf8');

/** Ключи объекта `ICONS = { ... } satisfies ...` из исходника реестра. */
function registeredIcons(): string[] {
  const body = registrySource.match(/export const ICONS = \{([\s\S]*?)\} satisfies/)?.[1];
  if (body === undefined) throw new Error('В registry.ts не найден объект ICONS');
  return [...body.matchAll(/^\s*(\w+):/gm)].map((m) => m[1]);
}

/** Пути и значения всех строковых полей `icon` / `*Icon` внутри токенов. */
function tokenIcons(value: unknown, trail: string, found: { path: string; icon: string }[] = []): { path: string; icon: string }[] {
  if (value && typeof value === 'object') {
    for (const [key, v] of Object.entries(value)) {
      if (typeof v === 'string' && (key === 'icon' || /Icon$/.test(key))) found.push({ path: `${trail}.${key}`, icon: v });
      else tokenIcons(v, `${trail}.${key}`, found);
    }
  }
  return found;
}

const FOUND = [
  ...tokenIcons(abaTokens, 'abaTokens'),
  ...tokenIcons(parentTokens, 'parentTokens'),
  ...tokenIcons(tokens, 'tokens'),
];
const REGISTERED = registeredIcons();

/**
 * Известные пропуски: иконка нужна токену, рисунка и строки в реестре ещё нет. Сейчас пусто: `fingerRing`
 * (тихая подсказка «держите» у выхода из пробы, `abaControls.exitTapHint`) и `note` нарисованы 2026-11-06
 * (Higgsfield, №177). Иконки карточки «перерыв» в токенах нет (только `abaControls.breakSize`): когда появится
 * поле `icon`, оно попадёт под эту же проверку.
 * `sliders` нарисована 2026-10-24 (этап 9, 0b). Имена в токенах — ключи `ICONS` без префикса `ui-`.
 */
const KNOWN_MISSING: string[] = []; // 2026-11-06: `fingerRing` и `note` нарисованы (Higgsfield, №177)

const missing = FOUND.filter((f) => !REGISTERED.includes(f.icon));

describe('иконки из токенов и реестр ICONS', () => {
  it('разбор реестра находит иконки, а обход токенов - ссылки на них (проверка не пустая)', () => {
    expect(REGISTERED).toEqual(expect.arrayContaining(['check', 'x', 'lock', 'sound', 'map', 'bulb']));
    expect(FOUND.map((f) => f.path)).toContain('abaTokens.abaControls.exitTapHint.icon');
  });

  it('все иконки из токенов есть в ICONS, кроме известных пропусков', () => {
    const unexpected = missing.filter((f) => !KNOWN_MISSING.includes(f.icon)).map((f) => `${f.path} = '${f.icon}'`);
    expect({ 'иконки токенов, которых нет в ICONS (src/assets/registry.ts)': unexpected }).toEqual({
      'иконки токенов, которых нет в ICONS (src/assets/registry.ts)': [],
    });
  });

  it('список известных пропусков не устарел: каждая запись ещё нужна токенам и ещё не в реестре', () => {
    const stillMissing = missing.map((f) => f.icon);
    expect({ 'убрать из KNOWN_MISSING (иконка уже в ICONS или токен её не использует)': KNOWN_MISSING.filter((i) => !stillMissing.includes(i)) }).toEqual({
      'убрать из KNOWN_MISSING (иконка уже в ICONS или токен её не использует)': [],
    });
  });

  it('abaControls.exitTapHint.icon есть в ICONS (`ui-finger-ring.svg`, 2026-11-06)', () => {
    expect(REGISTERED).toContain(abaTokens.abaControls.exitTapHint.icon);
  });

  it('вообще все иконки токенов есть в ICONS (без исключений)', () => {
    expect(missing.map((f) => `${f.path} = '${f.icon}'`)).toEqual([]);
  });
});
