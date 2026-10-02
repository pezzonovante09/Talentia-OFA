import type { AbaFormat, AbaTarget, AbaTrial } from '../../types/aba';

/**
 * Место цели в сетке по формату — для фикстур, которые меняют только формат. Подражание и
 * самообслуживание проверяются своими тестами.
 */
export const GRID_FOR: Record<AbaFormat, Pick<AbaTarget, 'level' | 'area' | 'sdKind' | 'fieldSize'>> = {
  imitate_sound: { level: 1, area: 'echoic' },
  repeat_word: { level: 1, area: 'echoic' },
  voice_volume: { level: 2, area: 'voice_control', sdKind: 'instruction' },
  do_action: { level: 1, area: 'receptive_instructions', sdKind: 'instruction' },
  identify: { level: 1, area: 'receptive_identify', sdKind: 'name' },
  match: { level: 1, area: 'matching', fieldSize: 3 },
  say: { level: 2, area: 'tact', sdKind: 'picture' },
};

export const target: AbaTarget = {
  id: 't-meow',
  programId: 'p-sounds',
  format: 'imitate_sound',
  band: '5-6',
  level: 1,
  area: 'echoic',
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
  const latencyMs = over.latencyMs !== undefined ? over.latencyMs : over.response === 'no_response' ? null : 1200;
  const kind = over.kind ?? 'teaching';
  const delayed = (kind === 'teaching' || kind === 'transfer') && (over.startPromptLevel ?? 0) === 0;
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
    latencyMs,
    latencyFromFirstSdMs: latencyMs,
    latencySource: latencyMs === null ? null : 'adult_press',
    promptDelayMs: delayed ? 3000 : null,
    responseWindowMs: 5000,
    presentationLog: [],
    sdEndedAt: '2026-09-24T10:00:00Z',
    scoredBy: 'adult',
    tokens: 0,
    ...over,
  };
}
