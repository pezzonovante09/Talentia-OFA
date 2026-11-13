/**
 * Цели ABA, ступень 1, сопоставление (`match`, область `matching`) — ABA.md «Сетка целей», лестница: одинаковые из 2
 * → из 3 → форма; цвет — от «из 2» (№162: две цели, а не ступень; вопрос 11, решение 2026-10-31). «Одинаковые фото» не пишутся: растр на экране пробы
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
    // перенос — на предметах, которых не было ни в одном обучении лестницы
    ex('g1', [o('chair'), o('flower'), o('cup')], 'generalization', 'adult_f'),
    ex('g2', [o('tree'), o('bus'), o('bell')], 'generalization', 'adult_m'),
  ],
};

/**
 * Форма: одна заливка на поле и один размер — отличает только форма. В одно поле не ставятся квадрат с ромбом и
 * круг с кольцом (`ABA_SHAPE_NOT_TOGETHER`); перенос — другой заливкой (`-alt`).
 */
export const MATCH_SHAPE: AbaTarget = {
  ...base,
  id: 'match-shape',
  fieldSize: 3,
  prerequisiteTargetIds: ['match-same-3'],
  // проверка сверху вниз (вопрос 63): 5/5 на форме выводит освоенность «одинаковых» из 3 и из 2
  includesTargetIds: ['match-same-3', 'match-same-2'],
  exemplars: [
    ex('e1', [s('circle'), s('square'), s('triangle')]),
    ex('e2', [s('triangle'), s('ring'), s('square')]),
    ex('e3', [s('circle'), s('triangle'), s('rhombus')]),
    ex('g1', [s('square-alt'), s('ring-alt'), s('triangle-alt')], 'generalization', 'adult_f'),
    ex('g2', [s('circle-alt'), s('rhombus-alt'), s('triangle-alt')], 'generalization', 'adult_m'),
  ],
};

/**
 * Цвет: одна форма одного размера; первое поле — синий и киноварь; зелёный с пурпурным — не вместе; перенос — на квадрате.
 * Открывается от «одинаковых из 2» (решение владельца 2026-10-31, «две цели»): то же поле 2, другой класс стимулов, не рост
 * трудности; учится параллельно с «одинаковыми из 3».
 */
export const MATCH_COLOR: AbaTarget = {
  ...base,
  id: 'match-color',
  fieldSize: 2,
  prerequisiteTargetIds: ['match-same-2'],
  exemplars: [
    ex('e1', [c('blue'), c('vermilion')]),
    ex('e2', [c('blue'), c('green')]),
    ex('e3', [c('vermilion'), c('purple')]),
    ex('g1', [c('blue-sq'), c('purple-sq')], 'generalization', 'adult_f'),
    ex('g2', [c('vermilion-sq'), c('green-sq')], 'generalization', 'adult_m'),
  ],
};

export const MATCH_LEVEL1: readonly AbaTarget[] = [MATCH_SAME_2, MATCH_SAME_3, MATCH_SHAPE, MATCH_COLOR];
