const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Отключаем package.json exports — иначе Zustand/Supabase подхватывают ESM с import.meta,
// что Metro не поддерживает (ошибка "Cannot use 'import.meta' outside a module")
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
