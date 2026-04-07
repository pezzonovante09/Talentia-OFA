import type { ImageSourcePropType } from 'react-native';

/** Миры 5–6 с нарисованными NPC и фонами Nano Banana. */
export const NANO_NPC_BY_WORLD: Record<
  'meadow' | 'forest' | 'garden' | 'island',
  ImageSourcePropType
> = {
  meadow: require('../../assets/images/npcs/npc-zoya.png'),
  forest: require('../../assets/images/npcs/npc-fedya.png'),
  garden: require('../../assets/images/npcs/npc-tara.png'),
  island: require('../../assets/images/npcs/npc-pete.png'),
};

export const NANO_BG_BY_WORLD: Record<
  'meadow' | 'forest' | 'garden' | 'island',
  ImageSourcePropType
> = {
  meadow: require('../../assets/images/backgrounds/bg-meadow.png'),
  forest: require('../../assets/images/backgrounds/bg-forest.png'),
  garden: require('../../assets/images/backgrounds/bg-garden.png'),
  island: require('../../assets/images/backgrounds/bg-island.png'),
};

/** Спокойный градиент для режима ABA (особый профиль + методология ABA). */
export const NANO_BG_ABA: ImageSourcePropType = require('../../assets/images/backgrounds/bg-aba.png');

export const NANO_UI = {
  streak: require('../../assets/images/ui/ui-streak.png'),
  book: require('../../assets/images/ui/ui-book.png'),
  bookBookmark: require('../../assets/images/ui/ui-book-bookmark.png'),
  check: require('../../assets/images/ui/ui-check.png'),
  medal: require('../../assets/images/ui/ui-medal.png'),
  backpack: require('../../assets/images/ui/ui-backpack.png'),
  stars: require('../../assets/images/ui/ui-stars.png'),
  x: require('../../assets/images/ui/ui-x.png'),
  lightning: require('../../assets/images/ui/ui-lightning.png'),
  gift: require('../../assets/images/ui/ui-gift.png'),
  levelUp: require('../../assets/images/ui/ui-level-up.png'),
  bulb: require('../../assets/images/ui/ui-bulb.png'),
  map: require('../../assets/images/ui/ui-map.png'),
  egg: require('../../assets/images/ui/ui-egg.png'),
  help: require('../../assets/images/ui/ui-help.png'),
  lock: require('../../assets/images/ui/ui-lock.png'),
  heart: require('../../assets/images/ui/ui-heart.png'),
  trophy: require('../../assets/images/ui/ui-trophy.png'),
  pencilPaper: require('../../assets/images/ui/ui-pencil-paper.png'),
  meteor: require('../../assets/images/ui/ui-meteor.png'),
  flame: require('../../assets/images/ui/ui-flame.png'),
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
