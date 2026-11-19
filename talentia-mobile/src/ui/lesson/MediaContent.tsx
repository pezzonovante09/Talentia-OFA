/**
 * Содержимое плитки по `Media`: кучка (с корзинкой), карточка-символ (цифра, буква, слог; немая — так же), иначе подпись.
 */
import type { TFunction } from 'i18next';

import { AppText } from '../AppText';
import { NumeralCard } from './NumeralCard';
import { Pile } from './Pile';
import { symbolBox, symbolFontSize, symbolShift } from '../../design/glyphFit';
import type { Media } from '../../types/task';

export function isSilentCard(media: Media): boolean {
  return media.voice === 'select';
}

/** Знак карточки-символа или `undefined`, если элемент — не символ. */
export function symbolText(media: Media): string | undefined {
  if (media.glyph !== undefined) return media.glyph;
  return media.numeral !== undefined ? String(media.numeral) : undefined;
}

/**
 * Кегль и рамка карточек-символов одного задания: один кегль на все (`symbolFontSize`) по ширине и высоте плитки,
 * рамка — плитка внутри контура «выбрано» (`symbolBox`), один сдвиг на все (`symbolShift`, №192): середина общих
 * чернил задания — в середине карточки, базовая линия общая.
 */
export type SymbolFit = { size: number; boxW: number; boxH: number; shift: number };

export function symbolFitFor(media: readonly Media[], tileW: number, tileH: number): SymbolFit {
  const texts = media.map(symbolText).filter((t): t is string => t !== undefined);
  const size = symbolFontSize(texts, tileW, tileH);
  return { size, boxW: symbolBox(tileW), boxH: symbolBox(tileH), shift: symbolShift(texts, size) };
}

export function MediaContent({ media, t, symbol, testID }: { media: Media; t: TFunction; symbol?: SymbolFit; testID?: string }) {
  if (media.count !== undefined || media.container) return <Pile media={media} variant="tile" testID={testID} />;
  const text = symbolText(media);
  if (text !== undefined) return <NumeralCard text={text} size={symbol?.size} boxW={symbol?.boxW} boxH={symbol?.boxH} shift={symbol?.shift} testID={testID} />;
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
