import type { Methodology } from '../../store/settingsStore';

export type MethodologyStyle = {
  nodeBorderWidth: number;
  nodeBorderExtra?: string;
  pathDotShape: 'round' | 'square' | 'diamond';
  pathDotSizes: [number, number];
  sectionTintAlpha: string;
  nodeLabel: 'level' | 'step' | 'none';
  nodeGlow: boolean;
  accentShift?: string;
  bannerTopEmoji?: string;
};

export const METHODOLOGY_STYLES: Record<Methodology, MethodologyStyle> = {
  aba: {
    nodeBorderWidth: 5,
    pathDotShape: 'square',
    pathDotSizes: [9, 7],
    sectionTintAlpha: '12',
    nodeLabel: 'step',
    nodeGlow: false,
    bannerTopEmoji: '📋',
  },
};

export const WORLD_DECOR: Record<string, { dotColor: string; left: string[]; right: string[] }> = {
  jungle: {
    dotColor: '#3A9A3A',
    left: ['🌿', '🍃', '🌴', '🌱'],
    right: ['🦜', '🍃', '🌺', '🌿'],
  },
  canyon: {
    dotColor: '#C4783B',
    left: ['🪨', '🌵', '⛰️', '🦴'],
    right: ['🌵', '🏜️', '🪨', '⛰️'],
  },
  lab: {
    dotColor: '#5B5BE8',
    left: ['⚗️', '💡', '⚙️', '🧪'],
    right: ['🔬', '💡', '⚗️', '⚙️'],
  },
  space: {
    dotColor: '#8B5CF6',
    left: ['⭐', '🌙', '🪐', '☄️'],
    right: ['🌟', '🪐', '⭐', '🌙'],
  },
  meadow: {
    dotColor: '#FF7043',
    left: ['🌸', '🌼', '🌻', '🌺'],
    right: ['🐰', '🌷', '🌼', '🍀'],
  },
  forest: {
    dotColor: '#66BB6A',
    left: ['🌲', '🍃', '🌿', '🍂'],
    right: ['🦔', '🍄', '🌱', '🌾'],
  },
  garden: {
    dotColor: '#9CCC65',
    left: ['🌻', '🐢', '🌷', '🦋'],
    right: ['🌿', '🌸', '🐞', '🌺'],
  },
  island: {
    dotColor: '#29B6F6',
    left: ['🏝️', '🌊', '🐚', '🦜'],
    right: ['🌴', '🐬', '🌊', '⭐'],
  },
  g1math: {
    dotColor: '#FF7043',
    left: ['🏠', '🌳', '🚦', '🏪'],
    right: ['🚌', '🏡', '🌟', '🎒'],
  },
  g1rus: {
    dotColor: '#FFC107',
    left: ['🌾', '🐄', '🌻', '🏚️'],
    right: ['🐓', '🌿', '🌼', '🏕️'],
  },
  g1world: {
    dotColor: '#8BC34A',
    left: ['🌳', '🦋', '🌸', '🍃'],
    right: ['🐿️', '🌱', '🌺', '🍀'],
  },
  g1eng: {
    dotColor: '#29B6F6',
    left: ['⚓', '🚢', '🌊', '🐟'],
    right: ['🐠', '⛵', '🦀', '🌊'],
  },
  g2math: {
    dotColor: '#2196F3',
    left: ['⛰️', '🏔️', '🌨️', '🦅'],
    right: ['🗻', '❄️', '🌲', '🏕️'],
  },
  g2rus: {
    dotColor: '#9C27B0',
    left: ['📚', '🔭', '✏️', '📐'],
    right: ['📖', '🔬', '📏', '💡'],
  },
  g2sci: {
    dotColor: '#4CAF50',
    left: ['🦒', '🌾', '🌅', '🐘'],
    right: ['🦓', '🌻', '🦁', '🌿'],
  },
  g2eng: {
    dotColor: '#00BCD4',
    left: ['🌉', '🏗️', '🔩', '🌆'],
    right: ['🌃', '⚙️', '🔧', '🏙️'],
  },
  g3math: {
    dotColor: '#607D8B',
    left: ['🤖', '💻', '🚀', '⚡'],
    right: ['🛸', '🔋', '🌐', '💡'],
  },
  g3rus: {
    dotColor: '#795548',
    left: ['🏰', '⚔️', '🛡️', '👑'],
    right: ['🗡️', '🏯', '📜', '🗺️'],
  },
  g3world: {
    dotColor: '#009688',
    left: ['🌍', '🗺️', '✈️', '🧭'],
    right: ['🌏', '🌐', '🗼', '🌁'],
  },
  g3eng: {
    dotColor: '#FF5722',
    left: ['🎓', '📐', '📊', '🔢'],
    right: ['📈', '📉', '🧮', '✏️'],
  },
  g4math: {
    dotColor: '#FF5722',
    left: ['🧮', '🔢', '➗', '✖️'],
    right: ['➕', '➖', '🔣', '🧩'],
  },
  g4rus: {
    dotColor: '#7C4DFF',
    left: ['📝', '📖', '🖊️', '📚'],
    right: ['📜', '✍️', '🔤', '📃'],
  },
  g4eng: {
    dotColor: '#00ACC1',
    left: ['🌍', '💬', '🗣️', '📢'],
    right: ['🔡', '📰', '✏️', '🌐'],
  },
  g4social: {
    dotColor: '#66BB6A',
    left: ['🤝', '👋', '😊', '💬'],
    right: ['🫂', '❤️', '😄', '👥'],
  },
};

export const METHODOLOGY_DECOR: Record<Methodology, { left: string[]; right: string[] }> = {
  aba: {
    left: ['✅', '📌', '🔴', '🟡'],
    right: ['🟢', '📍', '✔️', '🔵'],
  },
};

/** Larger nodes for path-style map */
export const PATH_NODE_SIZE = 72;
export const PATH_SPINE_WIDTH = 28;

/** @deprecated use PATH_NODE_SIZE */
export const NODE_SIZE = PATH_NODE_SIZE;
