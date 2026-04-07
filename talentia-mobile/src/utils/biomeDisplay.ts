/** Biome keys → display (эмодзи убраны; при необходимости можно вернуть текстовые метки). */
const BIOME_LABEL: Record<string, string> = {
  town: '',
  village: '',
  park: '',
  harbor: '',
  mountain: '',
  library: '',
  savanna: '',
  bridge: '',
  future: '',
  castle: '',
  globe: '',
  academy: '',
};

export function getBiomeDisplayEmoji(biome: string): string {
  return BIOME_LABEL[biome] ?? '';
}
