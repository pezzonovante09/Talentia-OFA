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
 * Известные пропуски: иконка нужна токену, рисунка и строки в реестре ещё нет.
 * TODO(ASSETS.md): `finger_ring` («палец + кольцо», тихая подсказка «держите» у кнопки выхода из
 * пробы, `abaControls.exitTapHint`) - нарисовать, добавить `ui-finger-ring.svg` в `assets/icons` и
 * строку `finger_ring` в `ICONS`, затем убрать её отсюда. ASSETS.md иконку пока не описывает. Иконки
 * карточки «перерыв» в токенах нет вовсе (только `abaControls.breakSize`): когда появится поле
 * `icon`, оно попадёт под эту же проверку.
 */
const KNOWN_MISSING = ['finger_ring'];

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

  // Красный по существу: иконки нет. `it.failing` держит это видимым и сам покраснеет, когда иконку
  // добавят - тогда нужно снять `.failing` и очистить KNOWN_MISSING.
  it.failing('abaControls.exitTapHint.icon есть в ICONS (ждёт рисунка: ASSETS.md, finger_ring)', () => {
    expect(REGISTERED).toContain(abaTokens.abaControls.exitTapHint.icon);
  });

  it.failing('вообще все иконки токенов есть в ICONS (без исключений)', () => {
    expect(missing.map((f) => `${f.path} = '${f.icon}'`)).toEqual([]);
  });
});
