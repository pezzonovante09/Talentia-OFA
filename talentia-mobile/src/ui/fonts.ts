/**
 * Шрифты из бандла (сети у приложения нет): Nunito в трёх весах — детский урок (`tokens.typography`, №176);
 * Golos Text в четырёх — раздел взрослого и ABA, направление «Тихий кабинет» (№203).
 * Нативный RN не подбирает начертание по `fontWeight` для загруженных файлов — имя файла и есть
 * семейство, поэтому `fontFamilyFor` переводит пару «семейство + вес» токена в имя загруженного шрифта.
 */
import { GolosText_400Regular, GolosText_500Medium, GolosText_600SemiBold, GolosText_700Bold } from '@expo-google-fonts/golos-text';
import { Nunito_400Regular, Nunito_700Bold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito';

export const FONT_FILES = {
  Nunito_400Regular,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  GolosText_400Regular,
  GolosText_500Medium,
  GolosText_600SemiBold,
  GolosText_700Bold,
} as const;

export type LoadedFont = keyof typeof FONT_FILES;

const BY_FAMILY: Record<string, Partial<Record<string, LoadedFont>>> = {
  Nunito: { '400': 'Nunito_400Regular', '700': 'Nunito_700Bold', '800': 'Nunito_800ExtraBold' },
  'Golos Text': { '400': 'GolosText_400Regular', '500': 'GolosText_500Medium', '600': 'GolosText_600SemiBold', '700': 'GolosText_700Bold' },
};

/** Имя загруженного шрифта для стиля; незнакомая пара — ближайшее по весу начертание семейства. */
export function fontFamilyFor(style: { family: string; weight: string }): LoadedFont {
  const family = BY_FAMILY[style.family] ?? BY_FAMILY.Nunito;
  const exact = family[style.weight];
  if (exact) return exact;
  const weights = Object.keys(family).map(Number).sort((a, b) => a - b);
  const want = Number(style.weight);
  const nearest = weights.reduce((best, w) => (Math.abs(w - want) < Math.abs(best - want) ? w : best), weights[0]);
  return family[String(nearest)] as LoadedFont;
}
