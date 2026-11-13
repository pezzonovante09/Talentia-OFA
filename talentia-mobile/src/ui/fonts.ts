/**
 * Шрифты из бандла (сети у приложения нет): один Nunito в трёх весах (`tokens.typography`, №176).
 * Нативный RN не подбирает начертание по `fontWeight` для загруженных файлов — имя файла и есть
 * семейство, поэтому `fontFamilyFor` переводит пару «семейство + вес» токена в имя загруженного шрифта.
 */
import { Nunito_400Regular, Nunito_700Bold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito';

import type { TypeStyle } from '../design/tokens';

export const FONT_FILES = {
  Nunito_400Regular,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} as const;

export type LoadedFont = keyof typeof FONT_FILES;

const BY_FAMILY: Record<string, Partial<Record<TypeStyle['weight'], LoadedFont>>> = {
  Nunito: { '400': 'Nunito_400Regular', '700': 'Nunito_700Bold', '800': 'Nunito_800ExtraBold' },
};

/** Имя загруженного шрифта для стиля; незнакомая пара — ближайшее по весу начертание семейства. */
export function fontFamilyFor(style: Pick<TypeStyle, 'family' | 'weight'>): LoadedFont {
  const family = BY_FAMILY[style.family] ?? BY_FAMILY.Nunito;
  const exact = family[style.weight];
  if (exact) return exact;
  const weights = Object.keys(family).map(Number).sort((a, b) => a - b);
  const want = Number(style.weight);
  const nearest = weights.reduce((best, w) => (Math.abs(w - want) < Math.abs(best - want) ? w : best), weights[0]);
  return family[String(nearest) as TypeStyle['weight']] as LoadedFont;
}
