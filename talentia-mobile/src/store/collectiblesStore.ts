import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { CollectibleId } from '../data/worlds';

export type CollectibleMeta = {
  id: CollectibleId;
  nameKey: string;
  emoji: string;
  rarity: 'common' | 'rare' | 'epic';
};

export const COLLECTIBLES_META: Record<CollectibleId, CollectibleMeta> = {
  tali_egg: { id: 'tali_egg', nameKey: 'collection.taliEgg', emoji: '🥚', rarity: 'epic' },
  banana_badge: { id: 'banana_badge', nameKey: 'collection.bananaBadge', emoji: '🍌', rarity: 'common' },
  jungle_leaf: { id: 'jungle_leaf', nameKey: 'collection.jungleLeaf', emoji: '🌿', rarity: 'common' },
  canyon_gem: { id: 'canyon_gem', nameKey: 'collection.canyonGem', emoji: '💎', rarity: 'rare' },
  spike_crystal: { id: 'spike_crystal', nameKey: 'collection.spikeCrystal', emoji: '🔮', rarity: 'rare' },
  star_fragment: { id: 'star_fragment', nameKey: 'collection.starFragment', emoji: '⭐', rarity: 'epic' },
  dino_egg_green: { id: 'dino_egg_green', nameKey: 'collection.dinoEggGreen', emoji: '🟢', rarity: 'common' },
  dino_egg_red: { id: 'dino_egg_red', nameKey: 'collection.dinoEggRed', emoji: '🔴', rarity: 'rare' },
  dino_egg_blue: { id: 'dino_egg_blue', nameKey: 'collection.dinoEggBlue', emoji: '🔵', rarity: 'rare' },
  artifact_map: { id: 'artifact_map', nameKey: 'collection.artifactMap', emoji: '🗺️', rarity: 'epic' },
};

type CollectiblesState = {
  /** O(1) lookup — true = owned */
  owned: Partial<Record<CollectibleId, boolean>>;
  addItem: (item: CollectibleId) => void;
  hasItem: (item: CollectibleId) => boolean;
  ownedCount: () => number;
  resetAll: () => void;
};

export const useCollectiblesStore = create<CollectiblesState>()(
  persist(
    (set, get) => ({
      owned: {},
      addItem: (item) =>
        set((state) => ({
          owned: { ...state.owned, [item]: true },
        })),
      hasItem: (item) => !!get().owned[item],
      ownedCount: () => Object.values(get().owned).filter(Boolean).length,
      resetAll: () => set({ owned: {} }),
    }),
    {
      name: 'talentia-collectibles',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
