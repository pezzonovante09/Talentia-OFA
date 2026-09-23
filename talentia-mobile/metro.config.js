const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Отключаем package.json exports — иначе Zustand/Supabase подхватывают ESM с import.meta,
// что Metro не поддерживает (ошибка "Cannot use 'import.meta' outside a module")
config.resolver.unstable_enablePackageExports = false;

// SVG собираются в компоненты, а не в картинки. Ассеты нарисованы вектором
// намеренно: генератор выдал свою палитру, и её переназначение под токены
// возможно только в векторе — растр так не поправить. Плюс вектор не мылится
// на любой плотности экрана и весит меньше растра того же качества.
config.transformer.babelTransformerPath = require.resolve('react-native-svg-transformer/expo');
config.resolver.assetExts = config.resolver.assetExts.filter((ext) => ext !== 'svg');
config.resolver.sourceExts = [...config.resolver.sourceExts, 'svg'];

module.exports = config;
