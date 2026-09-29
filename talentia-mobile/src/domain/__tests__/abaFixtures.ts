import type { AbaTarget, AbaTrial } from '../../types/aba';

export const target: AbaTarget = {
  id: 't-meow',
  programId: 'p-sounds',
  format: 'imitate_sound',
  band: '5-6',
  sdKey: 'aba.sd.meow',
  exemplars: [
    { id: 'cat-1', role: 'teaching', targetKey: 'k1', modelKey: 'm1', partialModelKeys: [] },
    { id: 'cat-2', role: 'teaching', targetKey: 'k2', modelKey: 'm2', partialModelKeys: [] },
    { id: 'cat-3', role: 'generalization', targetKey: 'k3', modelKey: 'm3', partialModelKeys: [] },
  ],
  delayMs: 3000,
  delayMode: 'constant',
  blockSize: 5,
  scoredBy: 'adult',
};

let seq = 0;

export function trial(over: Partial<AbaTrial> = {}): AbaTrial {
  seq += 1;
  return {
    id: `tr-${seq}`,
    sessionId: 's-1',
    targetId: target.id,
    exemplarId: 'cat-1',
    index: seq,
    kind: 'teaching',
    startPromptLevel: 0,
    promptLevelUsed: 0,
    presentations: 1,
    response: 'independent',
    emittedBeforePrompt: true,
    latencyMs: 1200,
    sdEndedAt: '2026-09-24T10:00:00Z',
    scoredBy: 'adult',
    tokens: 0,
    ...over,
  };
}
