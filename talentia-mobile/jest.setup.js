// Порт устройства (`src/services/local/expoDevice.ts`) читает и чистит ключи AsyncStorage;
// в Jest (Node) нативного модуля нет — нужен мок пакета.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Жесты ленты карты: официальная заглушка библиотеки.
require('react-native-gesture-handler/jestSetup');

// Нативные модули Expo, которых в Node нет. Поведение — «всё готово, язык ru»;
// тест, которому нужно иное, перекрывает мок у себя.
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'ru' }] }));
jest.mock('expo-font', () => ({ useFonts: () => [true, null], loadAsync: () => Promise.resolve(), isLoaded: () => true }));
jest.mock('expo-splash-screen', () => ({ preventAutoHideAsync: () => Promise.resolve(), hideAsync: () => Promise.resolve() }));
jest.mock('expo-crypto', () => ({
  // Детерминированные байты: id и семена в тестах воспроизводимы.
  getRandomBytes: (n) => Uint8Array.from({ length: n }, (_, i) => (i * 37 + 11) & 0xff),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async (_alg, s) => require('node:crypto').createHash('sha256').update(s).digest('hex'),
}));
// Экспо-SQLite в Node нет: экраны аккаунта в тестах получают базу через `setDevice` + `memoryDb`.
jest.mock('expo-sqlite', () => ({}));
jest.mock('@expo-google-fonts/nunito', () => ({ Nunito_400Regular: 1, Nunito_700Bold: 2, Nunito_800ExtraBold: 3 }));
