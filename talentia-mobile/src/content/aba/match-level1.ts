/**
 * Цели ABA, ступень 1, сопоставление (`match`, область `matching`) — ABA.md «Сетка целей», лестница: одинаковые из 2
 * → из 3 → форма и цвет (№162: две цели, а не ступень). «Одинаковые фото» не пишутся: растр на экране пробы
 * запрещён — открыто. Поля — по `abaTargetRules.ts` (`targetErrors`, `programErrors`): 3–5 экземпляров, не меньше
 * двух обучающих и одного переноса, у переноса — другой голос; касательный формат: `modelKey` — повтор SD,
 * частичных моделей нет. Полоса — самая строгая (5–6); загрузчик подставляет полосу ребёнка.
 */
import type { AbaExemplar, AbaTarget } from '../../types/aba';

const SD = 'aba.sd.matchSame';
const SD_WHERE = 'aba.sd.matchWhere';

const ex = (id: string, cards: string[], role: AbaExemplar['role'] = 'teaching', voice?: AbaExemplar['voice']): AbaExemplar => ({
  id,
  role,
  targetKey: SD,
  modelKey: SD,
  partialModelKeys: [],
  cards,
  ...(voice ? { voice } : {}),
});

const base = {
  programId: 'matching-1',
  format: 'match',
  band: '5-6',
  level: 1,
  area: 'matching',
  sdKey: SD,
  sdVariantKeys: [SD_WHERE],
  delayMs: 2000,
  delayMode: 'progressive',
  blockSize: 5,
  scoredBy: 'device_tap',
} as const satisfies Partial<AbaTarget>;

const o = (n: string) => `aba-obj-${n}`;
const s = (n: string) => `aba-shape-${n}`;
const c = (n: string) => `aba-color-${n}`;

export const MATCH_SAME_2: AbaTarget = {
  ...base,
  id: 'match-same-2',
  fieldSize: 2,
  exemplars: [
    ex('e1', [o('apple'), o('car')]),
    ex('e2', [o('spoon'), o('hat')]),
    ex('e3', [o('house'), o('book')]),
    ex('g1', [o('mushroom'), o('key')], 'generalization', 'adult_f'),
    ex('g2', [o('leaf'), o('teapot')], 'generalization', 'adult_m'),
  ],
};

export const MATCH_SAME_3: AbaTarget = {
  ...base,
  id: 'match-same-3',
  fieldSize: 3,
  prerequisiteTargetIds: ['match-same-2'],
  includesTargetIds: ['match-same-2'],
  exemplars: [
    ex('e1', [o('pear'), o('plane'), o('umbrella')]),
    ex('e2', [o('carrot'), o('mitten'), o('pyramid')]),
    ex('e3', [o('boat'), o('sock'), o('apple')]),
    ex('g1', [o('teapot'), o('hat'), o('car')], 'generalization', 'adult_f'),
    ex('g2', [o('key'), o('book'), o('spoon')], 'generalization', 'adult_m'),
  ],
};

/** Форма: все одного цвета (`ABA_SHAPE_FILL`) и размера — отличает только форма. */
export const MATCH_SHAPE: AbaTarget = {
  ...base,
  id: 'match-shape',
  fieldSize: 3,
  prerequisiteTargetIds: ['match-same-3'],
  exemplars: [
    ex('e1', [s('circle'), s('square'), s('triangle')]),
    ex('e2', [s('square'), s('ring'), s('rhombus')]),
    ex('e3', [s('circle'), s('triangle'), s('ring')]),
    ex('g1', [s('rhombus'), s('circle'), s('square')], 'generalization', 'adult_f'),
    ex('g2', [s('triangle'), s('ring'), s('rhombus')], 'generalization', 'adult_m'),
  ],
};

/** Цвет: одна форма одного размера; первое поле — синий и киноварь; зелёный с пурпурным — не вместе. */
export const MATCH_COLOR: AbaTarget = {
  ...base,
  id: 'match-color',
  fieldSize: 2,
  prerequisiteTargetIds: ['match-same-3'],
  exemplars: [
    ex('e1', [c('blue'), c('vermilion')]),
    ex('e2', [c('blue'), c('green')]),
    ex('e3', [c('vermilion'), c('purple')]),
    ex('g1', [c('blue'), c('purple')], 'generalization', 'adult_f'),
    ex('g2', [c('vermilion'), c('green')], 'generalization', 'adult_m'),
  ],
};

export const MATCH_LEVEL1: readonly AbaTarget[] = [MATCH_SAME_2, MATCH_SAME_3, MATCH_SHAPE, MATCH_COLOR];
