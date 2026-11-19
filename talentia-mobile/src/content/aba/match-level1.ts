/**
 * Цели ABA, ступень 1, сопоставление (`match`, область `matching`) — ABA.md «Сетка целей», лестница: одинаковые из 2
 * → из 3 → форма и цвет из 3 (решение методиста 40, 2026-11-18, вместо №162 «цвет из 2 от «из 2»»). «Одинаковые фото» не пишутся: растр на экране пробы
 * запрещён — открыто. Поля — по `abaTargetRules.ts` (`targetErrors`, `programErrors`): 3–5 экземпляров, не меньше
 * двух обучающих и одного переноса, у переноса — другой голос; касательный формат: `modelKey` — повтор SD,
 * частичных моделей нет. Полоса — самая строгая (5–6); загрузчик подставляет полосу ребёнка.
 */
import type { AbaExemplar, AbaTarget } from '../../types/aba';
import { ABA_CARDS_NOT_TOGETHER } from './stimuli';

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
  // соседи образца меняются на каждой пробе (решение методиста 41) — правила «не вместе» держит сессия
  notTogether: ABA_CARDS_NOT_TOGETHER,
  // рука-модель шага «коснись картинки» — белая кисть: варежка рядом с ней читалась бы как та же рука
  notForSampleTouch: ['aba-obj-mitten'],
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
  // смешанный блок с цветом после освоения обеих по отдельности (решение методиста 43)
  mixWith: ['match-color-3'],
  exemplars: [
    ex('e1', [s('circle'), s('square'), s('triangle')]),
    ex('e2', [s('triangle'), s('ring'), s('square')]),
    ex('e3', [s('circle'), s('triangle'), s('rhombus')]),
    ex('g1', [s('square-alt'), s('ring-alt'), s('triangle-alt')], 'generalization', 'adult_f'),
    ex('g2', [s('circle-alt'), s('rhombus-alt'), s('triangle-alt')], 'generalization', 'adult_m'),
  ],
};

/**
 * Цвет из трёх (решение методиста 40, 2026-11-18; пересматривает №162 «цвет из 2 от «одинаковых из 2»»): после
 * «одинаковых из 3», параллельно с формой. Одна форма одного размера; первое поле — с синим и киноварью; вместе не
 * ставятся зелёный с пурпурным и синий с голубым (`ABA_COLOR_NOT_TOGETHER`) — поэтому киноварь есть в каждом поле.
 * Перенос — на квадрате. «Включает» нет: выводить «одинаковые» из цвета или нет — вопрос методисту (у формы — вопрос 63).
 */
export const MATCH_COLOR_3: AbaTarget = {
  ...base,
  id: 'match-color-3',
  fieldSize: 3,
  prerequisiteTargetIds: ['match-same-3'],
  exemplars: [
    ex('e1', [c('blue'), c('vermilion'), c('green')]),
    ex('e2', [c('sky'), c('purple'), c('vermilion')]),
    ex('e3', [c('vermilion'), c('blue'), c('purple')]),
    ex('g1', [c('green-sq'), c('vermilion-sq'), c('sky-sq')], 'generalization', 'adult_f'),
    ex('g2', [c('purple-sq'), c('blue-sq'), c('vermilion-sq')], 'generalization', 'adult_m'),
  ],
};

/**
 * «Похожее, но не такое же» (решение владельца №206, условия методиста 2026-11-19): образец сверху — второй рисунок
 * предмета (`-b`), верная в поле — его первый рисунок (`samplePairs`), соседи — обучающие карточки цели. У экземпляра
 * одна карточка с парой; перенос — на предметах вне обучения всей лестницы (чашка, стул — поэтому обучение на машине,
 * книге и шапке, а не на чашке, как предлагал методист). Поле 3, после «одинаковых из 3»; в программе стоит
 * после формы и цвета и занимает слот, когда освоена первая из них. Инструкция та же — «Найди такую же»; «включает» нет;
 * в смешанный блок не входит. Пока вторых рисунков нет в реестре, цель закрыта (`abaTargetReady`).
 */
export const MATCH_SIMILAR_3: AbaTarget = {
  ...base,
  id: 'match-similar-3',
  fieldSize: 3,
  prerequisiteTargetIds: ['match-same-3'],
  samplePairs: {
    [o('car')]: o('car-b'),
    [o('cup')]: o('cup-b'),
    [o('hat')]: o('hat-b'),
    [o('book')]: o('book-b'),
    [o('chair')]: o('chair-b'),
  },
  exemplars: [
    ex('e1', [o('car'), o('spoon'), o('house')]),
    ex('e2', [o('book'), o('plane'), o('umbrella')]),
    ex('e3', [o('hat'), o('carrot'), o('boat')]),
    // перенос — на предметах, которых не было ни в одном обучении лестницы: чашка и стул
    ex('g1', [o('cup'), o('flower'), o('tree')], 'generalization', 'adult_f'),
    ex('g2', [o('chair'), o('bell'), o('key')], 'generalization', 'adult_m'),
  ],
};

export const MATCH_LEVEL1: readonly AbaTarget[] = [MATCH_SAME_2, MATCH_SAME_3, MATCH_SHAPE, MATCH_COLOR_3];

/** Цели после лестницы «одинаковые → форма и цвет»: в программе стоят за ней и ждут своих картинок. */
export const MATCH_AFTER_LADDER: readonly AbaTarget[] = [MATCH_SIMILAR_3];
