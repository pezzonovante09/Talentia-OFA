import type { AbaExemplar, AbaTarget } from '../../types/aba';
import { answerLevel, correctionLevel, initialTargetState, ladderUp, promptLadder } from '../abaPrompting';
import { programErrors, targetErrors } from '../abaTargetRules';
import { target, trial } from './abaFixtures';

/** Форматы первой версии (ABA.md, «Спецификация первой версии»): `match`, сортировка, `say`. */

const card = (id: string, role: AbaExemplar['role'] = 'teaching', cards = [`${id}-a`, `${id}-b`, `${id}-c`]): AbaExemplar => ({
  id,
  role,
  targetKey: `k.${id}`,
  modelKey: `m.${id}`,
  partialModelKeys: [],
  cards,
});

const match: AbaTarget = {
  ...target,
  id: 'm',
  format: 'match',
  band: '7',
  level: 1,
  area: 'matching',
  sdKind: undefined,
  fieldSize: 3,
  scoredBy: 'device_tap',
  exemplars: [card('e1'), card('e2'), card('g1', 'generalization'), card('g2', 'generalization')],
};

const item = (id: string, category: string, role: AbaExemplar['role'] = 'teaching'): AbaExemplar => ({
  id,
  role,
  targetKey: `k.${id}`,
  modelKey: `m.${id}`,
  partialModelKeys: [],
  image: `img.${id}`,
  category,
});

const sort: AbaTarget = {
  ...match,
  id: 's',
  level: 2,
  fieldSize: undefined,
  matchMode: 'sort',
  sortCategories: ['food', 'clothes'],
  prerequisiteTargetIds: ['m'],
  blockSize: 10,
  exemplars: [
    ...['f1', 'f2', 'f3'].map((id) => item(id, 'food')),
    item('fg', 'food', 'generalization'),
    ...['c1', 'c2', 'c3'].map((id) => item(id, 'clothes')),
    item('cg', 'clothes', 'generalization'),
  ],
};

const word: AbaTarget = { ...target, id: 'w', format: 'repeat_word', band: '7', level: 1, area: 'echoic' };
const say: AbaTarget = {
  ...target,
  id: 'say',
  format: 'say',
  band: '7',
  level: 2,
  area: 'tact',
  sdKind: 'picture',
  prerequisiteTargetIds: ['w'],
  exemplars: [...target.exemplars, { id: 'cat-4', role: 'generalization', targetKey: 'k4', modelKey: 'm4', partialModelKeys: [] }],
};

describe('match', () => {
  it('годная цель проходит правила', () => {
    expect(targetErrors(match)).toEqual([]);
  });

  it('нужен размер поля; на 5–6 не больше трёх; у экземпляра столько карточек, сколько поле', () => {
    expect(targetErrors({ ...match, fieldSize: undefined }).join('\n')).toContain('нет размера поля');
    expect(targetErrors({ ...match, band: '5-6', fieldSize: 4, exemplars: match.exemplars.map((e) => ({ ...e, cards: [...e.cards!, `${e.id}-d`] })) }).join('\n')).toContain(
      'поле 4 на полосе 5–6',
    );
    expect(targetErrors({ ...match, fieldSize: 2 }).join('\n')).toContain('карточек 3, нужно 2');
  });

  it('поле и режим — только у match; касание оценивает identify и match', () => {
    expect(targetErrors({ ...target, fieldSize: 3 }).join('\n')).toContain('только у match');
    expect(targetErrors(match).join('\n')).not.toContain('касание оценивает');
  });

  it('поле 2 и сортировка — лестница без L2; коррекция после неверного — с L3', () => {
    expect(promptLadder({ ...match, fieldSize: 2 })).toBe('two_choice');
    expect(promptLadder(sort)).toBe('two_choice');
    expect(promptLadder(match)).toBe('standard');
    expect(ladderUp(1, 'two_choice')).toBe(3);
    expect(answerLevel(match)).toBe(3);
    const failed = trial({ startPromptLevel: 0, promptLevelUsed: 0, response: 'incorrect' });
    expect(correctionLevel(initialTargetState(match), failed, match)).toBe(3);
  });
});

describe('сортировка', () => {
  it('годная цель проходит правила: 8 предметов — 3 и 1 на категорию', () => {
    expect(targetErrors(sort)).toEqual([]);
  });

  it('ловит неполную категорию, предмет без категории и не ту ступень', () => {
    const short = { ...sort, exemplars: sort.exemplars.filter((e) => e.id !== 'c3') };
    expect(targetErrors(short).join('\n')).toContain('категория clothes: предметов 2 обучающих');
    const stray = { ...sort, exemplars: [...sort.exemplars.slice(0, 7), item('x', 'toys')] };
    expect(targetErrors(stray).join('\n')).toContain('нет категории из двух');
    expect(targetErrors({ ...sort, level: 1 }).join('\n')).toContain('сортировка — ступень 2');
    expect(targetErrors({ ...sort, blockSize: 5 }).join('\n')).toContain('выбор из двух с полосы 7 — блоком 10');
    expect(targetErrors({ ...sort, band: '5-6', blockSize: 5 })).toEqual([]);
  });
});

describe('say', () => {
  it('засчитывает только взрослый', () => {
    expect(targetErrors(say)).toEqual([]);
    expect(targetErrors({ ...say, scoredBy: 'device_tap' }).join('\n')).toContain('say засчитывает только взрослый');
  });

  it('называние — по картинке, интравербальное — словесный SD', () => {
    expect(targetErrors({ ...say, sdKind: 'verbal' }).join('\n')).toContain('вид инструкции picture');
    expect(targetErrors({ ...say, area: 'intraverbal', sdKind: 'verbal' })).toEqual([]);
  });
});

describe('правила программы', () => {
  it('у say нужна предпосылка repeat_word, у сортировки — match', () => {
    expect(programErrors([match, sort, word, say])).toEqual([]);
    expect(programErrors([{ ...say, prerequisiteTargetIds: [] }]).join('\n')).toContain('нет цели repeat_word');
    expect(programErrors([{ ...sort, prerequisiteTargetIds: [] }]).join('\n')).toContain('нет match');
  });
});
