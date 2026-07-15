import type { ImageSourcePropType } from 'react-native';

import { NANO_UI } from './nanoBananaAssets';

/**
 * Maps emoji used in lessons to bundled art when available (visualCount rows and
 * intro slides). Unknown emojis fall back to text glyph in the lesson UI.
 */
export const VISUAL_COUNT_IMAGE_BY_EMOJI: Partial<Record<string, ImageSourcePropType>> = {
  '🐱': require('../../assets/images/aba/aba_cat.webp'),
  '🐶': require('../../assets/images/aba/aba_dog.webp'),
  '🐦': require('../../assets/images/aba/aba_bird.webp'),
  '🐟': require('../../assets/images/aba/aba_fish.webp'),
  '🍎': require('../../assets/images/aba/aba_apple.webp'),
  '🍌': require('../../assets/images/aba/aba_banana.webp'),
  '⭐': NANO_UI.stars,
  '🌟': NANO_UI.stars,
};
