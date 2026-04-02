/** Biome keys (town, village, etc.) → emoji for display; preschool worlds use emoji directly in worlds.ts */
const BIOME_EMOJI: Record<string, string> = {
  town: '🏙️',
  village: '🏘️',
  park: '🌳',
  harbor: '⚓',
  mountain: '⛰️',
  library: '📚',
  savanna: '🦒',
  bridge: '🌉',
  future: '🤖',
  castle: '🏰',
  globe: '🌍',
  academy: '🎓',
};

export function getBiomeDisplayEmoji(biome: string): string {
  return BIOME_EMOJI[biome] ?? biome;
}
