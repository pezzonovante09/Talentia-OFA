import type { ChooseTask, PointTask, Task } from '../../types/task';
import {
  activeResponseAfterShow,
  countsTowardMastery,
  feedbackFor,
  narrowAfterFirstError,
  outcomeOf,
  PROBE_AFTER,
  reshuffle,
  scheduleTransferProbe,
  type QueuedTask,
  type Rng,
} from '../lessonFlow';
import { applyOutcome, emptySkill, starsForLesson } from '../mastery';

const cycle = (...xs: number[]): Rng => {
  let i = 0;
  return () => xs[i++ % xs.length];
};

function choose(id: string, extra: Partial<ChooseTask> = {}): ChooseTask {
  return {
    id,
    skill: 'count-to-3',
    format: 'choose',
    presentation: 'picture',
    promptKey: 'content.p',
    hintKey: 'content.h',
    options: [
      { id: 'a', labelKey: 'content.a', correct: false },
      { id: 'b', labelKey: 'content.b', correct: true },
      { id: 'c', labelKey: 'content.c', correct: false },
    ],
    ...extra,
  };
}

const point: PointTask = {
  id: 'pt',
  skill: 'find',
  format: 'point',
  promptKey: 'content.p',
  hintKey: 'content.h',
  scene: 's',
  targets: [
    { id: 'x', x: 0.2, y: 0.3, r: 0.1, correct: true, labelKey: 'content.x' },
    { id: 'y', x: 0.8, y: 0.3, r: 0.1, correct: false, labelKey: 'content.y' },
    { id: 'z', x: 0.5, y: 0.8, r: 0.1, correct: false, labelKey: 'content.z' },
  ],
};

describe('знакомство с форматом', () => {
  it('в зачёт не идёт: ни исхода, ни коробки', () => {
    const intro = choose('i', { intro: true });
    expect(countsTowardMastery(intro)).toBe(false);
    expect(outcomeOf(intro, 'first')).toBeNull();
    expect(countsTowardMastery(choose('c'))).toBe(true);
  });
});

describe('первая ошибка: сузить или показать', () => {
  it('choose и point: из трёх снимается один — выбор остаётся', () => {
    expect(narrowAfterFirstError({ format: 'choose', alternatives: 3 })).toEqual({ kind: 'narrow', pin: false });
  });

  it('из двух — сужать некуда, сразу показ', () => {
    expect(narrowAfterFirstError({ format: 'point', alternatives: 2 })).toEqual({ kind: 'show' });
  });

  it('match и order: при трёх неверных одна часть закрепляется — свободными остаются двое', () => {
    expect(narrowAfterFirstError({ format: 'order', wrong: 3 })).toEqual({ kind: 'narrow', pin: true });
  });

  it('при двух неверных не закрепляется — иначе последний элемент ставится сам', () => {
    expect(narrowAfterFirstError({ format: 'match', wrong: 2 })).toEqual({ kind: 'narrow', pin: false });
  });

  it('group: один неверный — без закрепления, выбор корзины остаётся', () => {
    expect(narrowAfterFirstError({ format: 'group', wrong: 1 })).toEqual({ kind: 'narrow', pin: false });
    expect(narrowAfterFirstError({ format: 'group', wrong: 2 })).toEqual({ kind: 'narrow', pin: true });
  });

  it('клавиатура: однозначный ответ — вторая попытка значима (угадать 10%)', () => {
    expect(narrowAfterFirstError({ format: 'keypad', digits: 1 })).toEqual({ kind: 'narrow', pin: false });
    expect(narrowAfterFirstError({ format: 'keypad', digits: 2 })).toEqual({ kind: 'narrow', pin: true });
  });
});

describe('исход и отклик', () => {
  const t = choose('c');

  it('первая попытка — верно и праздник', () => {
    expect([outcomeOf(t, 'first'), feedbackFor('first')]).toEqual(['correct', 'celebrate']);
  });

  it('вторая — с подсказкой и тёплая похвала без праздника', () => {
    expect([outcomeOf(t, 'second'), feedbackFor('second')]).toEqual(['hinted', 'warm']);
  });

  it('показ — «ответ показали» и нейтральное «вот так»: угадывание не должно окупаться', () => {
    expect([outcomeOf(t, 'shown'), feedbackFor('shown')]).toEqual(['helped', 'neutral']);
  });

  it('после показа ребёнок отвечает сам: тапает показанный или исправленный', () => {
    expect([activeResponseAfterShow('choose'), activeResponseAfterShow('point'), activeResponseAfterShow('order')]).toEqual([
      'tap_shown',
      'tap_shown',
      'tap_corrected',
    ]);
  });
});

describe('проба переноса', () => {
  const queue = (): QueuedTask[] => ['t0', 't1', 't2', 't3', 't4'].map((id) => ({ task: choose(id) }));

  it('показанное возвращается через два других задания', () => {
    const q = scheduleTransferProbe(queue(), 1, cycle(0.3));
    expect(q.map((x) => x.task.id + (x.transferProbe ? '*' : ''))).toEqual(['t0', 't1', 't2', 't3', 't1*', 't4']);
    expect(PROBE_AFTER).toBe(2);
  });

  it('в конце урока — после оставшихся, сколько есть', () => {
    const q = scheduleTransferProbe(queue(), 4, cycle(0.3));
    expect(q.map((x) => x.task.id + (x.transferProbe ? '*' : ''))).toEqual(['t0', 't1', 't2', 't3', 't4', 't4*']);
  });

  it('не больше одной пробы на урок', () => {
    const once = scheduleTransferProbe(queue(), 0, cycle(0.3));
    const twice = scheduleTransferProbe(once, 1, cycle(0.3));
    expect(twice.filter((x) => x.transferProbe)).toHaveLength(1);
  });

  it('проба пробы не заводится, знакомство — тоже', () => {
    const q: QueuedTask[] = [{ task: choose('p'), transferProbe: true }, { task: choose('i', { intro: true }) }];
    expect(scheduleTransferProbe(q, 0, cycle(0.3))).toHaveLength(2);
    expect(scheduleTransferProbe(q, 1, cycle(0.3))).toHaveLength(2);
  });

  it('позиции перемешаны — это не тот же экран', () => {
    const original = choose('c');
    const again = reshuffle(original, cycle(0.99)) as ChooseTask;
    expect(again.options.map((o) => o.id)).not.toEqual(original.options.map((o) => o.id));
    expect([...again.options].sort((a, b) => a.id.localeCompare(b.id))).toEqual(original.options);
  });

  it('сцену point не перемешать — проба просто позже', () => {
    expect(reshuffle(point, cycle(0.5))).toBe(point);
  });

  it('в пробе нет второй попытки: верно — отдельный исход, ошибка — показ', () => {
    const t: Task = choose('c');
    expect([outcomeOf(t, 'first', true), outcomeOf(t, 'shown', true), feedbackFor('first', true)]).toEqual([
      'transfer_correct',
      'helped',
      'warm',
    ]);
  });
});

describe('проба переноса в интервальном повторении', () => {
  it('верный ответ в пробе коробку не двигает, но засчитывается как верный', () => {
    let s = applyOutcome(emptySkill('x'), 'helped', 1);
    s = applyOutcome(s, 'transfer_correct', 1);
    expect({ box: s.box, попыток: s.attempts, верных: s.correct }).toEqual({ box: 1, попыток: 2, верных: 1 });
  });

  it('звёзды за урок проба не меняет', () => {
    expect(starsForLesson(['correct', 'helped', 'transfer_correct'])).toBe(1);
    expect(starsForLesson(['correct', 'correct', 'transfer_correct'])).toBe(3);
  });
});
