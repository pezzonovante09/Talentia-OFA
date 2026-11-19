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

// expo-sqlite на web: wasm как ассет и заголовки изоляции для OPFS (только dev-сервер Expo Web).
config.resolver.assetExts = [...config.resolver.assetExts, 'wasm'];
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => (req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    return middleware(req, res, next);
  },
};

module.exports = config;
