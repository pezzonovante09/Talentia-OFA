/**
 * Исключения гейта `UI_LANGS` (Ж17; `localization-qa` по диффу этапа C, тесты — по отчёту `qa-engineer`): язык
 * включается, когда покрыты все ключи ru, кроме ждущих экранов (`PENDING_KEYS`) и текстов уроков `content.<регион>.*`
 * (непереведённый урок помечается на карте, №78). Общие `content.common/skills/skillTips/regions/objects` — обязательны.
 * `ky.json` подменяется копией ru без нужной части — проверяется сам гейт, а не перевод.
 */
import ru from '../locales/ru.json';
import { PENDING_KEYS } from '../pendingKeys';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'ky' }] }));

type Tree = { [k: string]: string | Tree };

const clone = (): Tree => JSON.parse(JSON.stringify(ru)) as Tree;

function drop(tree: Tree, path: string): void {
  const parts = path.split('.');
  let n = tree;
  for (const p of parts.slice(0, -1)) n = n[p] as Tree;
  delete n[parts[parts.length - 1]];
}

function langsWith(ky: Tree): readonly string[] {
  let langs: readonly string[] = [];
  jest.isolateModules(() => {
    jest.doMock('../locales/ky.json', () => ky);
    langs = (jest.requireActual('../index') as { UI_LANGS: readonly string[] }).UI_LANGS;
  });
  jest.dontMock('../locales/ky.json');
  return langs;
}

describe('гейт UI_LANGS: что ky обязан покрыть', () => {
  it('без текстов уроков (content.numbers.*) ky включается: урок без перевода помечается на карте, №78', () => {
    const ky = clone();
    delete (ky.content as Tree).numbers;
    expect(langsWith(ky)).toContain('ky');
  });

  it('без ключей, ждущих экранов (PENDING_KEYS), ky включается: их носитель не переводит', () => {
    const ky = clone();
    for (const k of PENDING_KEYS) drop(ky, k);
    expect(langsWith(ky)).toContain('ky');
  });

  it.each(['common', 'skills', 'skillTips', 'regions'])('без content.%s ky не включается: это интерфейс карты и раздела взрослых', (part) => {
    const ky = clone();
    delete (ky.content as Tree)[part];
    expect(langsWith(ky)).not.toContain('ky');
  });

  it('без одного ключа интерфейса ky не включается', () => {
    const ky = clone();
    drop(ky, 'parent.data.deleteAccount');
    expect(langsWith(ky)).not.toContain('ky');
  });
});
