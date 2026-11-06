/**
 * Содержимое рамки находки атласа (D1, D2): то, что ребёнок считал, теми же примитивами, что в уроке.
 * - кучка ≤ 5 — `Pile` с метками «сосчитано» на всех фигурах (состояние конца задания): на странице ряд —
 *   стимульный размер (фигуры 40), россыпь и «кубик» — плиточный (поле 80); в коллекции — всегда плиточный;
 * - кучка ≥ 6 и карточка-число — `NumeralCard` с цифрой;
 * - иначе — иконка региона (`atlasPage.finding.fallbackSize`).
 * Касания примитив не принимает: тап по рамке — это тап по карточке (повтор голоса).
 */
import { View } from 'react-native';

import { atlasPage } from '../../design/tokens';
import { findingOf } from '../../domain/atlasFinding';
import type { Lesson } from '../../types/task';
import { Icon } from '../Icon';
import { NumeralCard } from '../lesson/NumeralCard';
import { Pile } from '../lesson/Pile';

export type FindingPreviewProps = {
  lesson: Lesson;
  /** `page` — страница атласа (стимульный размер, если ряд); `tile` — карточка коллекции (всегда плиточный). */
  fit: 'page' | 'tile';
  testID?: string;
};

export function FindingPreview({ lesson, fit, testID = 'finding' }: FindingPreviewProps) {
  const finding = findingOf(lesson);
  if (finding.kind === 'numeral') return <NumeralCard text={finding.text} testID={`${testID}-numeral`} />;
  if (finding.kind === 'pile') {
    const row = finding.media.layout === undefined || finding.media.layout === 'row';
    const variant = fit === 'page' && row ? 'stimulus' : 'tile';
    return (
      <View pointerEvents="none" testID={`${testID}-${variant}`}>
        <Pile media={finding.media} variant={variant} markedAll testID={`${testID}-pile`} />
      </View>
    );
  }
  return <Icon name="regionNumbers" size={atlasPage.finding.fallbackSize} color="onRegion" testID={`${testID}-fallback`} />;
}
