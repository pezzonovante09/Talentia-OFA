/**
 * i18next без запасного языка (А23, №78): ru отдаёт строку, ky — ничего, и ключ не подменяется
 * русским. `expo-localization` замокан: язык устройства не из тройки → ru.
 */
import { getLocales } from 'expo-localization';

import i18n, { deviceLang, initI18n, keyExists } from '../index';

jest.mock('expo-localization', () => ({ getLocales: jest.fn(() => [{ languageCode: 'de' }]) }));

describe('initI18n', () => {
  it('ru: строка есть; ky: ключа нет и fallback на ru не происходит', () => {
    initI18n({ lng: 'ru' });
    expect(i18n.language).toBe('ru');
    expect(i18n.t('content.regions.numbers.title')).toBe('Мир чисел');
    expect(keyExists('content.regions.numbers.title')).toBe(true);

    initI18n({ lng: 'ky' });
    expect(i18n.language).toBe('ky');
    expect(keyExists('content.regions.numbers.title')).toBe(false);
    expect(i18n.t('content.regions.numbers.title')).not.toBe('Мир чисел');
  });

  it('повторный вызов не создаёт второй экземпляр, а переключает язык', () => {
    const a = initI18n({ lng: 'en' });
    const b = initI18n({ lng: 'ru' });
    expect(a).toBe(b);
    expect(b.language).toBe('ru');
  });

  it('deviceLang: язык устройства вне тройки → ru; ky остаётся ky', () => {
    expect(deviceLang()).toBe('ru');
    (getLocales as jest.Mock).mockReturnValueOnce([{ languageCode: 'ky' }]);
    expect(deviceLang()).toBe('ky');
    (getLocales as jest.Mock).mockReturnValueOnce([]);
    expect(deviceLang()).toBe('ru');
  });
});
