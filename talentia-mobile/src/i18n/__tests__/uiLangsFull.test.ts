/**
 * Ж17, обратная сторона: когда словарь ky покрывает все ключи ru, `UI_LANGS` включает ky сам и устройство с
 * кыргызским получает ky. Здесь `ky.json` подменён содержимым `ru.json` — так проверяется сам гейт, а не перевод.
 */
import { getLocales } from 'expo-localization';

import { deviceLang, UI_LANGS } from '../index';

jest.mock('expo-localization', () => ({ getLocales: jest.fn(() => [{ languageCode: 'ky' }]) }));
jest.mock('../locales/ky.json', () => jest.requireActual('../locales/ru.json'));

describe('UI_LANGS при полном ky', () => {
  it('ky включён, устройство с кыргызским → ky', () => {
    expect(UI_LANGS).toEqual(['ru', 'en', 'ky']);
    expect(deviceLang()).toBe('ky');
    (getLocales as jest.Mock).mockReturnValueOnce([{ languageCode: 'de' }]);
    expect(deviceLang()).toBe('ru');
    // открытый ky — обычный язык списка (№190)
    (getLocales as jest.Mock).mockReturnValueOnce([{ languageCode: 'ky' }, { languageCode: 'en' }]);
    expect(deviceLang()).toBe('ky');
  });
});
