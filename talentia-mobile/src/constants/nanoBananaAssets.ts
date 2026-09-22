import type { ImageSourcePropType } from 'react-native';

/** Миры 5–6 с нарисованными NPC и фонами Nano Banana. */
export const NANO_NPC_BY_WORLD: Record<
  'meadow' | 'forest' | 'garden' | 'island',
  ImageSourcePropType
> = {
  meadow: require('../../assets/images/npcs/npc-zoya.webp'),
  forest: require('../../assets/images/npcs/npc-fedya.webp'),
  garden: require('../../assets/images/npcs/npc-tara.webp'),
  island: require('../../assets/images/npcs/npc-pete.webp'),
};

export const NANO_BG_BY_WORLD: Record<
  'meadow' | 'forest' | 'garden' | 'island',
  ImageSourcePropType
> = {
  meadow: require('../../assets/images/backgrounds/bg-meadow.webp'),
  forest: require('../../assets/images/backgrounds/bg-forest.webp'),
  garden: require('../../assets/images/backgrounds/bg-garden.webp'),
  island: require('../../assets/images/backgrounds/bg-island.webp'),
};

/** Спокойный градиент для режима ABA (особый профиль + методология ABA). */
export const NANO_BG_ABA: ImageSourcePropType = require('../../assets/images/backgrounds/bg-aba.webp');

export const NANO_UI = {
  streak: require('../../assets/images/ui/ui-streak.webp'),
  book: require('../../assets/images/ui/ui-book.webp'),
  bookBookmark: require('../../assets/images/ui/ui-book-bookmark.webp'),
  check: require('../../assets/images/ui/ui-check.webp'),
  medal: require('../../assets/images/ui/ui-medal.webp'),
  backpack: require('../../assets/images/ui/ui-backpack.webp'),
  stars: require('../../assets/images/ui/ui-stars.webp'),
  x: require('../../assets/images/ui/ui-x.webp'),
  lightning: require('../../assets/images/ui/ui-lightning.webp'),
  gift: require('../../assets/images/ui/ui-gift.webp'),
  levelUp: require('../../assets/images/ui/ui-level-up.webp'),
  bulb: require('../../assets/images/ui/ui-bulb.webp'),
  map: require('../../assets/images/ui/ui-map.webp'),
  egg: require('../../assets/images/ui/ui-egg.webp'),
  help: require('../../assets/images/ui/ui-help.webp'),
  lock: require('../../assets/images/ui/ui-lock.webp'),
  heart: require('../../assets/images/ui/ui-heart.webp'),
  trophy: require('../../assets/images/ui/ui-trophy.webp'),
  pencilPaper: require('../../assets/images/ui/ui-pencil-paper.webp'),
  meteor: require('../../assets/images/ui/ui-meteor.webp'),
  flame: require('../../assets/images/ui/ui-flame.webp'),
} as const satisfies Record<string, ImageSourcePropType>;

export type NanoUiKey = keyof typeof NANO_UI;

export function getNanoNpcForWorld(worldId: string): ImageSourcePropType | undefined {
  return NANO_NPC_BY_WORLD[worldId as keyof typeof NANO_NPC_BY_WORLD];
}

export function getNanoBgForWorld(worldId: string): ImageSourcePropType | undefined {
  return NANO_BG_BY_WORLD[worldId as keyof typeof NANO_BG_BY_WORLD];
}

/** Фон карты по умолчанию (лужайка), если нет привязки к миру. */
export const NANO_MAP_DEFAULT_BG: ImageSourcePropType = NANO_BG_BY_WORLD.meadow;

/**
 * Фон экрана урока / карты: в ABA — отдельные обои; в стандарте — фон острова (Nano) или лужайка по умолчанию.
 */
export function resolveScreenBackground(args: {
  isAbaMode: boolean;
  worldId?: string | null;
}): ImageSourcePropType {
  if (args.isAbaMode) return NANO_BG_ABA;
  return getNanoBgForWorld(args.worldId ?? '') ?? NANO_MAP_DEFAULT_BG;
}
