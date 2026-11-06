// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

/**
 * Ворота «данные» (решение владельца №121, 2026-10-21): приложение — локальный прототип, ничего не
 * уходит с устройства. Запрет снимается только для одного адаптера (`src/services/remote/**`) после
 * раунда «данные» — `child-privacy-compliance` + `backend-auditor`, 0 блокеров, запись в
 * `.claude/audit-gate.json` со `scope: "data"`. Список — по проверке `child-privacy-compliance`.
 */
const OFFLINE = 'Ворота «данные» (№121): прототип не выходит в сеть — только после раунда «данные».';
/** Запрещённые импорты ворот; `except` — имена пакетов, снятые для одного файла ниже. */
const restrictedImports = (except = []) => [
  'error',
  {
    paths: [
      { name: '@supabase/supabase-js', message: OFFLINE },
      { name: 'expo/fetch', message: OFFLINE },
      { name: 'expo-linking', message: OFFLINE },
      { name: 'expo-sharing', message: `${OFFLINE} «Поделиться» выносит данные ребёнка из приложения.` },
      { name: 'expo-updates', message: OFFLINE },
      { name: 'expo-web-browser', message: OFFLINE },
      { name: 'expo-notifications', message: OFFLINE },
      { name: 'react-native-webview', message: OFFLINE },
      { name: 'react-native', importNames: ['Linking'], message: OFFLINE },
      // картинка по адресу (ментор П2): ассеты — из бандла
      { name: 'react-native-svg', importNames: ['SvgUri', 'SvgCssUri', 'SvgFromUri'], message: OFFLINE },
    ].filter((p) => !except.includes(p.name)),
    patterns: [{ group: ['@supabase/*'], message: OFFLINE }],
  },
];
const offlineRules = {
  'no-restricted-imports': restrictedImports(),
  'no-restricted-globals': [
    'error',
    ...['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource'].map((name) => ({ name, message: OFFLINE })),
  ],
  'no-restricted-properties': [
    'error',
    ...['globalThis', 'global', 'window', 'self'].map((object) => ({ object, property: 'fetch', message: OFFLINE })),
    { object: 'navigator', property: 'sendBeacon', message: OFFLINE },
    { object: 'window', property: 'open', message: OFFLINE },
    { object: 'window', property: 'location', message: OFFLINE },
    { object: 'Linking', property: 'openURL', message: OFFLINE },
    ...['prefetch', 'getSize', 'getSizeWithHeaders', 'queryCache'].map((property) => ({ object: 'Image', property, message: OFFLINE })),
    ...['downloadAsync', 'uploadAsync', 'createUploadTask', 'createDownloadResumable', 'downloadFileAsync'].map(
      (property) => ({ property, message: OFFLINE }),
    ),
  ],
  'no-restricted-syntax': [
    'error',
    // адрес в сети: картинка по uri, шрифт по URL, ссылка — всё раскрывает устройство; ассеты — из бандла
    { selector: 'Literal[value=/^\\s*(https?|wss?|ftp):\\/\\//i]', message: OFFLINE },
    { selector: 'TemplateElement[value.raw=/(https?|wss?|ftp):\\/\\//i]', message: OFFLINE },
    { selector: 'ImportExpression[source.type!="Literal"]', message: `${OFFLINE} import() — только литералом.` },
  ],
};

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    files: ['src/**/*.{ts,tsx,js,jsx}', 'app/**/*.{ts,tsx,js,jsx}'],
    ignores: ['**/__tests__/**'],
    // `eslint-disable` в коде не снимает ворота
    linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: 'error' },
    rules: offlineRules,
  },
  {
    // экран сессии ABA не растёт: новое — в `src/ui/aba/model/` и `src/ui/aba/session/` (фаза 8); предупреждение, не ворота (№122)
    files: ['app/aba/session.tsx'],
    rules: { 'max-lines': ['warn', 1183] },
  },
  {
    // №168, вопрос 67, проверка child-privacy-compliance 2026-11-01: share-sheet — не сеть, файл уходит по выбору
    // родителя. Снят только `expo-sharing` и только здесь; остальные `offlineRules` действуют.
    files: ['src/services/local/shareSpecialistExport.ts'],
    linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: 'error' },
    rules: { 'no-restricted-imports': restrictedImports(['expo-sharing']) },
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
