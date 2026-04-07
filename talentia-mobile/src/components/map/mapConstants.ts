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
};

export const METHODOLOGY_STYLES: Record<Methodology, MethodologyStyle> = {
  aba: {
    nodeBorderWidth: 5,
    pathDotShape: 'square',
    pathDotSizes: [9, 7],
    sectionTintAlpha: '12',
    nodeLabel: 'step',
    nodeGlow: false,
  },
};

function decor(dotColor: string) {
  return { dotColor, left: [] as string[], right: [] as string[] };
}

export const WORLD_DECOR: Record<string, { dotColor: string; left: string[]; right: string[] }> = {
  jungle: decor('#3A9A3A'),
  canyon: decor('#C4783B'),
  lab: decor('#5B5BE8'),
  space: decor('#8B5CF6'),
  meadow: decor('#FF7043'),
  forest: decor('#66BB6A'),
  garden: decor('#9CCC65'),
  island: decor('#29B6F6'),
  g1math: decor('#FF7043'),
  g1rus: decor('#FFC107'),
  g1world: decor('#8BC34A'),
  g1eng: decor('#29B6F6'),
  g2math: decor('#2196F3'),
  g2rus: decor('#9C27B0'),
  g2sci: decor('#4CAF50'),
  g2eng: decor('#00BCD4'),
  g3math: decor('#607D8B'),
  g3rus: decor('#795548'),
  g3world: decor('#009688'),
  g3eng: decor('#FF5722'),
  g4math: decor('#FF5722'),
  g4rus: decor('#7C4DFF'),
  g4eng: decor('#00ACC1'),
  g4social: decor('#66BB6A'),
};

export const METHODOLOGY_DECOR: Record<Methodology, { left: string[]; right: string[] }> = {
  aba: { left: [], right: [] },
};

/** Larger nodes for path-style map */
export const PATH_NODE_SIZE = 72;
export const PATH_SPINE_WIDTH = 28;

/** @deprecated use PATH_NODE_SIZE */
export const NODE_SIZE = PATH_NODE_SIZE;
