/**
 * Содержимое плитки по `Media`: кучка (с корзинкой), карточка-число / немая карточка, иначе подпись.
 */
import type { TFunction } from 'i18next';

import { AppText } from '../AppText';
import { NumeralCard } from './NumeralCard';
import { Pile } from './Pile';
import type { Media } from '../../types/task';

export function isSilentCard(media: Media): boolean {
  return media.voice === 'select';
}

export function MediaContent({ media, t, maxChars = 1, testID }: { media: Media; t: TFunction; maxChars?: number; testID?: string }) {
  if (media.count !== undefined || media.container) return <Pile media={media} variant="tile" testID={testID} />;
  if (media.numeral !== undefined) return <NumeralCard text={String(media.numeral)} maxChars={maxChars} testID={testID} />;
  return (
    <AppText role="label" align="center" lines={2} testID={testID}>
      {t(media.labelKey)}
    </AppText>
  );
}

/** Озвучивается ли элемент по тапу: кучки и немые карточки молчат (SCREENS.md 2.1, 3.8, 3.8.1). */
export function speaksOnTap(media: Media): boolean {
  return media.count === undefined && !media.container && !isSilentCard(media);
}
