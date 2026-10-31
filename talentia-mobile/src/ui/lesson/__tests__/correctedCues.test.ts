/**
 * Подсветка исправленных после показа (№140): `FormatSpec.correctedCues` — ключи `listening` для плиток,
 * которые ребёнку предстоит «показать, что исправили». Оставшиеся верными (`kept`) и закреплённая
 * (`pinned`) не светятся — они не исправлялись.
 */
import { regionLessons } from '../../../content';
import type { ChooseTask, MatchTask, OrderTask, Task } from '../../../types/task';
import { chooseSpec } from '../formats/ChooseTask';
import { matchSpec } from '../formats/MatchTask';
import { orderSpec } from '../formats/OrderTask';
import type { TaskStep } from '../formats/types';

const allTasks = regionLessons('numbers').flatMap((l) => l.tasks);
const choose = allTasks.find((t) => t.format === 'choose') as ChooseTask;
const match = allTasks.find((t) => t.format === 'match') as MatchTask;
const order = allTasks.find((t) => t.format === 'order') as OrderTask;

const shownStep = (task: Task, extra: Partial<Pick<TaskStep, 'kept' | 'pinned'>> = {}): TaskStep => ({
  kind: 'task',
  task,
  transferProbe: false,
  review: false,
  progress: { segment: 0, total: 4 },
  attempt: 'shown',
  stage: 'active_response',
  narrowing: null,
  removed: [],
  rightOrder: null,
  kept: [],
  pinned: null,
  demo: false,
  answerCue: true,
  activeResponse: null,
  feedback: null,
  counts: true,
  mirrored: false,
  ...extra,
});

describe('correctedCues: choose', () => {
  it('светится один верный вариант', () => {
    const correct = choose.options.find((o) => o.correct)!.id;
    expect(chooseSpec.correctedCues(choose, shownStep(choose))).toEqual([correct]);
  });

  it('совпадает с correctedOf — тап по подсвеченному и есть активный ответ', () => {
    const step = shownStep(choose);
    expect(chooseSpec.correctedCues(choose, step)).toEqual(chooseSpec.correctedOf(choose, step));
  });
});

describe('correctedCues: match', () => {
  const ids = match.pairs.map((p) => p.id);

  it('без kept и pinned — обе карточки каждой пары', () => {
    expect(matchSpec.correctedCues(match, shownStep(match))).toEqual(ids.flatMap((id) => [`left:${id}`, `right:${id}`]));
  });

  it('оставшаяся верной пара (kept) не светится', () => {
    const [kept, ...rest] = ids;
    const cues = matchSpec.correctedCues(match, shownStep(match, { kept: [kept] }));
    expect(cues).toEqual(rest.flatMap((id) => [`left:${id}`, `right:${id}`]));
    expect(cues).not.toContain(`left:${kept}`);
    expect(cues).not.toContain(`right:${kept}`);
  });

  it('закреплённая пара (pinned) не светится', () => {
    const [pinned, ...rest] = ids;
    const cues = matchSpec.correctedCues(match, shownStep(match, { pinned }));
    expect(cues).toEqual(rest.flatMap((id) => [`left:${id}`, `right:${id}`]));
  });

  it('kept и pinned вместе: светится только то, что исправлялось', () => {
    expect(ids.length).toBeGreaterThanOrEqual(3);
    const [kept, pinned, ...rest] = ids;
    expect(matchSpec.correctedCues(match, shownStep(match, { kept: [kept], pinned }))).toEqual(rest.flatMap((id) => [`left:${id}`, `right:${id}`]));
  });

  it('всё верно стояло (kept — все пары) — светиться нечему', () => {
    expect(matchSpec.correctedCues(match, shownStep(match, { kept: ids }))).toEqual([]);
  });
});

describe('correctedCues: order', () => {
  it('без kept и pinned — места всех предметов по их position', () => {
    expect(orderSpec.correctedCues(order, shownStep(order))).toEqual(order.items.map((i) => `place:${i.position}`));
  });

  it('место предмета, оставшегося на своём (kept), не светится', () => {
    const [kept, ...rest] = order.items;
    const cues = orderSpec.correctedCues(order, shownStep(order, { kept: [kept.id] }));
    expect(cues).toEqual(rest.map((i) => `place:${i.position}`));
    expect(cues).not.toContain(`place:${kept.position}`);
  });

  it('место закреплённого предмета (pinned) не светится', () => {
    const [pinned, ...rest] = order.items;
    expect(orderSpec.correctedCues(order, shownStep(order, { pinned: pinned.id }))).toEqual(rest.map((i) => `place:${i.position}`));
  });

  it('ключи — места, а не id предметов: позиция берётся из position, не из порядка в items', () => {
    // в корпусе предметы перечислены не по позициям — иначе проверка ничего бы не отличала
    const unsorted = order.items.some((i, idx) => i.position !== idx);
    expect(unsorted).toBe(true);
    const cues = orderSpec.correctedCues(order, shownStep(order));
    order.items.forEach((i) => expect(cues).toContain(`place:${i.position}`));
    expect(cues).toHaveLength(order.items.length);
  });
});
