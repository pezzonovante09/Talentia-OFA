/**
 * Конфиг поверх `app.json`: дата сборки в `extra.builtAt` — нижняя граница часов для срока
 * хранения (№147, `src/services/local/buildInfo.ts`). EAS вычисляет конфиг при сборке.
 */
import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig =>
  ({ ...config, extra: { ...config.extra, builtAt: new Date().toISOString() } }) as ExpoConfig;
