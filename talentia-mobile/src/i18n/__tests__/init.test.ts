/**
 * i18next без запасного языка (А23, №78): ru отдаёт строку, ky — ничего, и ключ не подменяется
 * русским. `expo-localization` замокан: язык устройства не из тройки → ru; ky с пустым словарём → ru (Ж17).
 * Положительный случай — словарь ky полный → ky — в `uiLangsFull.test.ts` (там ky.json подменён на ru).
 */
import { getLocales } from 'expo-localization';

import i18n, { deviceLang, initI18n, keyExists, UI_LANGS } from '../index';
import { useChildSession } from '../../state/childSession';

const ADULT_KEYS = ['firstRun.forAdults', 'firstRun.callAdult', 'parent.pin.title', 'parent.pin.hint'];

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

  it('deviceLang: язык устройства вне тройки → ru; en с полным словарём → en', () => {
    expect(deviceLang()).toBe('ru');
    (getLocales as jest.Mock).mockReturnValueOnce([{ languageCode: 'en' }]);
    expect(deviceLang()).toBe('en');
    (getLocales as jest.Mock).mockReturnValueOnce([]);
    expect(deviceLang()).toBe('ru');
  });

  it('deviceLang смотрит весь список языков устройства по порядку (№190)', () => {
    const cases: [string | null, string | null, string][] = [
      ['de', 'en', 'en'], // второй язык пользователя, а не русский
      ['ky', 'en', 'ru'], // ky закрыт гейтом: семья из КР получает русский, а не английский
      ['kk', 'ru', 'ru'],
      ['fr', 'de', 'ru'], // ничего не совпало
      [null, 'en', 'en'], // язык без кода пропускается
      ['en', 'ru', 'en'], // порядок устройства, а не порядок наших языков
      ['en', 'ky', 'en'], // ky после найденного языка ни на что не влияет
    ];
    for (const [first, second, want] of cases) {
      (getLocales as jest.Mock).mockReturnValueOnce([{ languageCode: first }, { languageCode: second }]);
      expect([first, second, deviceLang()]).toEqual([first, second, want]);
    }
    // закрытый ky в середине списка останавливает поиск: русский, а не английский после него
    (getLocales as jest.Mock).mockReturnValueOnce([{ languageCode: 'de' }, { languageCode: 'ky' }, { languageCode: 'en' }]);
    expect(deviceLang()).toBe('ru');
  });

  it('Ж17: устройство с кыргызским при пустом ky.json → интерфейс ru, экран взрослых без сырых ключей', () => {
    expect(UI_LANGS).toEqual(['ru', 'en']);
    (getLocales as jest.Mock).mockReturnValueOnce([{ languageCode: 'ky' }]);
    const lng = deviceLang();
    expect(lng).toBe('ru');
    initI18n({ lng });
    expect(i18n.language).toBe('ru');
    // ключи экрана взрослых и PIN-гейта — первое, что увидел бы родитель на устройстве с кыргызским
    for (const key of ADULT_KEYS) {
      expect(keyExists(key)).toBe(true);
      expect(i18n.t(key)).not.toBe(key);
      expect(i18n.t(key)).not.toMatch(/^[a-z]+\.[a-zA-Z.]+$/);
    }
    expect(i18n.t('firstRun.forAdults')).toBe('Для взрослых');
  });

  it('язык профиля ребёнка — язык контента, интерфейс он не переключает', () => {
    initI18n({ lng: 'ru' });
    useChildSession.getState().startNoRecordSession({ childId: '00000000-0000-4000-8000-0000000000c1', now: new Date(), interfaceLang: 'ky' });
    expect(useChildSession.getState().settings.interfaceLang).toBe('ky');
    expect(i18n.language).toBe('ru');
  });
});
