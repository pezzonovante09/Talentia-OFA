// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    files: ['jest.setup.js'],
    languageOptions: {
      globals: { jest: 'readonly', require: 'readonly' },
    },
  },
  {
    // Dev tooling scripts run directly with Node (not bundled by Metro/Expo),
    // so Node globals apply and the Expo-bundler-oriented env-var rule doesn't.
    files: ['scripts/**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: { Buffer: 'readonly', process: 'readonly', __dirname: 'readonly' },
    },
    rules: {
      'expo/no-dynamic-env-var': 'off',
    },
  },
]);
