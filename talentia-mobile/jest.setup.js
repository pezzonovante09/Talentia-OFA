// Zustand stores persisted with AsyncStorage (progressStore, settingsStore, ...)
// need a working mock in the Jest (Node) environment — there is no native module.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
