/**
 * Банк Tali в уроке (этап D5 по аудиту 2026-11-09, Ж14): какая ситуация звучит на итог задания и какой вариант без
 * повтора. Реплика — не на каждый верный ответ: в уроке из четырёх-пяти заданий это стало бы сценарием (№168).
 */
import { correctSituation, doneSituation, VARIANTS_PER_SITUATION } from '../../domain/companionSituations';
import { initI18n } from '../../i18n';
import { companionLine, resetCompanionMemory } from '../companionMemory';

describe('реплика на итог задания — correctSituation', () => {
  it('показ ответа и проба переноса — без реплики', () => {
    expect(correctSituation([], 'shown', false)).toBeNull();
    expect(correctSituation(['shown'], 'first', true)).toBeNull();
  });

  it('со второй попытки — correct-after-hint', () => {
    expect(correctSituation(['first'], 'second', false)).toBe('correct-after-hint');
  });

  it('первый верный в уроке — correct-first, в том числе после показанного', () => {
    expect(correctSituation([], 'first', false)).toBe('correct-first');
    expect(correctSituation(['shown'], 'first', false)).toBe('correct-first');
  });

  it('второй верный подряд — молча; ровно третий подряд с первой попытки — серия; четвёртый — молча', () => {
    expect(correctSituation(['first'], 'first', false)).toBeNull();
    expect(correctSituation(['first', 'first'], 'first', false)).toBe('correct-streak-3plus');
    expect(correctSituation(['first', 'first', 'first'], 'first', false)).toBeNull();
    // серию рвёт подсказка
    expect(correctSituation(['first', 'second', 'first'], 'first', false)).toBeNull();
    expect(correctSituation(['second', 'first', 'first'], 'first', false)).toBe('correct-streak-3plus');
  });

  it('урок из пяти с первой попытки: две реплики, не пять', () => {
    const played: ('first' | 'second' | 'shown')[] = [];
    const said = [0, 1, 2, 3, 4].map(() => {
      const s = correctSituation(played, 'first', false);
      played.push('first');
      return s;
    });
    expect(said.filter(Boolean)).toEqual(['correct-first', 'correct-streak-3plus']);
  });
});

describe('итог урока — doneSituation', () => {
  it('по причине, а не по звёздам: показ → helped, подсказка → hinted, иначе clean', () => {
    expect(doneSituation(['first', 'first'])).toBe('lesson-done-clean');
    expect(doneSituation(['first', 'second'])).toBe('lesson-done-hinted');
    expect(doneSituation(['second', 'shown'])).toBe('lesson-done-helped');
  });
});

describe('выбор варианта — companionLine', () => {
  beforeAll(() => initI18n({ lng: 'ru' }));
  beforeEach(() => resetCompanionMemory());

  const variant = (key: string) => Number(/\.(\d)$/.exec(key)![1]);

  it('четыре реплики подряд — четыре разных варианта, ключи банка', () => {
    const keys = Array.from({ length: VARIANTS_PER_SITUATION }, () => companionLine('review-intro', 'neutral', () => 0));
    expect(keys.every((k) => /^companion\.review-intro\.[0-3]$/.test(k))).toBe(true);
    expect(new Set(keys.map(variant)).size).toBe(VARIANTS_PER_SITUATION);
  });

  it('на новом круге первым не звучит тот, что прозвучал последним', () => {
    const first = Array.from({ length: VARIANTS_PER_SITUATION }, () => variant(companionLine('probe-intro', 'neutral', () => 0.99)));
    const next = variant(companionLine('probe-intro', 'neutral', () => 0.99));
    expect(next).not.toBe(first[first.length - 1]);
  });

  it('ситуации не делят память; сброс — с начала', () => {
    companionLine('review-intro', 'neutral', () => 0);
    expect(variant(companionLine('probe-intro', 'neutral', () => 0))).toBe(0);
    resetCompanionMemory();
    expect(variant(companionLine('review-intro', 'neutral', () => 0))).toBe(0);
  });

  it('родовой формы в банке нет — звучит безродовая основа при любой форме обращения', () => {
    expect(companionLine('correct-first', 'feminine', () => 0)).toBe('companion.correct-first.0');
    expect(companionLine('correct-first', 'masculine', () => 0)).toBe('companion.correct-first.1');
  });
});
