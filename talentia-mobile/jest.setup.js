// Порт устройства (`src/services/local/expoDevice.ts`) читает и чистит ключи AsyncStorage;
// в Jest (Node) нативного модуля нет — нужен мок пакета.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
