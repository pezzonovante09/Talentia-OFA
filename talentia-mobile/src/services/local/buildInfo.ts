/**
 * Дата сборки — нижняя граница часов для срока хранения (№131, №147): дата «2000 год» на
 * устройстве не продлевает хранение дольше обещанных 12 месяцев. Пишется в `extra.builtAt`
 * в `app.config.ts` при сборке; нет или не разбирается — `null`, и граница не действует.
 */
import Constants from 'expo-constants';

export function buildTime(): string | null {
  const v: unknown = Constants.expoConfig?.extra?.builtAt;
  return typeof v === 'string' && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : null;
}
