import type { AgeBand, ChooseTask, Lesson, PointTask, Task, TaskFormat } from '../../types/task';
import {
  assembleLesson,
  buildReviewPool,
  finishLesson,
  fitsBand,
  recordInAtlas,
  type AtlasEntry,
  type Played,
} from '../lessonAssembly';
import { maxFormatRun, scheduleTransferProbe, type QueuedTask, type Rng } from '../lessonFlow';
import { applyLessonOutcomes, emptySkill, type SkillState } from '../mastery';

const rng: Rng = () => 0.3;

function choose(id: string, skill: string, extra: Partial<ChooseTask> = {}): ChooseTask {
  return {
    id,
    skill,
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

function point(id: string, skill: string): PointTask {
  return {
    id,
    skill,
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
}

function lesson(id: string, band: AgeBand, tasks: Task[]): Lesson {
  return {
    id,
    band,
    tasks,
    titleKey: 'content.t',
    atlasEntryKey: `content.atlas.${id}`,
    hook: { taliPose: 'found', lineKey: 'content.hook' },
  };
}

/** Навык, виденный на уроке `lastSeenLesson`: в первой коробке срок — через урок. */
function dueSkill(skill: string, box: SkillState['box'] = 1, lastSeenLesson = 1): SkillState {
  return { ...emptySkill(skill), box, lastSeenLesson, attempts: 1, correct: 1 };
}

const formats = (q: readonly QueuedTask[]): TaskFormat[] => q.map((x) => x.task.format);
const queueOf = (tasks: Task[]): QueuedTask[] => tasks.map((task) => ({ task }));
const played = (q: readonly QueuedTask[], attempts: Played['attempt'][]): Played[] =>
  q.map((queued, i) => ({ queued, attempt: attempts[i] }));

// урок 7 лет из четырёх заданий: место для двух повторений
const fourTasks = lesson('l2', '7', [
  choose('l2-1', 'own-a'),
  point('l2-2', 'own-b'),
  choose('l2-3', 'own-a'),
  point('l2-4', 'own-b'),
]);

const past = lesson('l1', '7', [choose('l1-1', 'old-a'), point('l1-2', 'old-b'), choose('l1-3', 'old-c')]);
const pool = buildReviewPool([past]);

describe('пул повторения', () => {
  it('задания пройденных уроков по навыку, без знакомства с форматом', () => {
    const p = buildReviewPool([past, lesson('l0', '7', [choose('i', 'old-a', { intro: true }), choose('l0-1', 'old-a')])]);
    expect(p['old-a'].map((t) => t.id)).toEqual(['l1-1', 'l0-1']);
  });

  it('до 7 лет — только картинки, build — только с 7', () => {
    expect(fitsBand(choose('t', 's', { presentation: 'text' }), '5-6')).toBe(false);
    expect(fitsBand(choose('t', 's', { presentation: 'text' }), '7')).toBe(true);
    const build: Task = { id: 'b', skill: 's', format: 'build', promptKey: 'p', hintKey: 'h', answer: '5' };
    expect(fitsBand(build, '5-6')).toBe(false);
    expect(fitsBand(build, '8')).toBe(true);
  });
});

describe('сборка урока', () => {
  it('без сроков — ровно задания урока', () => {
    const q = assembleLesson({ lesson: fourTasks, skills: [], lessonNumber: 2, pool, rng });
    expect(q.map((x) => x.task.id)).toEqual(['l2-1', 'l2-2', 'l2-3', 'l2-4']);
  });

  it('не больше двух повторений, младшие коробки первыми', () => {
    const skills = [dueSkill('old-c', 3, 0), dueSkill('old-a', 1), dueSkill('old-b', 2, 0)];
    const q = assembleLesson({ lesson: fourTasks, skills, lessonNumber: 5, pool, rng });
    expect(q.filter((x) => x.review).map((x) => x.task.skill)).toEqual(['old-a', 'old-b']);
  });

  it('повторение не первое и не последнее', () => {
    const q = assembleLesson({
      lesson: fourTasks,
      skills: [dueSkill('old-a'), dueSkill('old-b')],
      lessonNumber: 2,
      pool,
      rng,
    });
    expect(q).toHaveLength(6);
    expect(q[0].review).toBeUndefined();
    expect(q[q.length - 1].review).toBeUndefined();
  });

  it('после знакомства с форматом — не раньше первого задания в зачёт', () => {
    const withIntro = lesson('li', '7', [
      choose('i', 'own-a', { intro: true }),
      point('li-1', 'own-a'),
      choose('li-2', 'own-a'),
      point('li-3', 'own-a'),
    ]);
    const q = assembleLesson({ lesson: withIntro, skills: [dueSkill('old-b')], lessonNumber: 2, pool, rng });
    expect(q.findIndex((x) => x.review)).toBeGreaterThanOrEqual(2);
  });

  it('встаёт туда, где серия одного формата не длиннее двух', () => {
    const dense = lesson('ld', '7', [choose('ld-1', 'own'), choose('ld-2', 'own'), point('ld-3', 'own'), point('ld-4', 'own')]);
    const q = assembleLesson({ lesson: dense, skills: [dueSkill('old-a')], lessonNumber: 2, pool, rng });
    expect(formats(q)).toEqual(['choose', 'choose', 'point', 'choose', 'point']);
    expect(q[3].review).toBe(true);
  });

  it('задание навыка никуда не встаёт — пробуется другое задание того же навыка', () => {
    const points = lesson('lp', '7', [point('p1', 'own'), point('p2', 'own'), choose('p3', 'own'), point('p4', 'own'), point('p5', 'own')]);
    const q = assembleLesson({
      lesson: points,
      skills: [dueSkill('old-b')],
      lessonNumber: 2,
      pool: { 'old-b': [point('rb-point', 'old-b'), choose('rb-choose', 'old-b')] },
      rng,
    });
    expect(q.filter((x) => x.review).map((x) => x.task.id)).toEqual(['rb-choose']);
    expect(maxFormatRun(q)).toBe(2);
  });

  it('навык никуда не встаёт — место следующему по сроку', () => {
    const points = lesson('lp', '7', [point('p1', 'own'), point('p2', 'own'), choose('p3', 'own'), point('p4', 'own'), point('p5', 'own')]);
    const q = assembleLesson({
      lesson: points,
      skills: [dueSkill('old-b'), dueSkill('old-a', 2, 0)],
      lessonNumber: 5,
      pool,
      rng,
    });
    expect(q.filter((x) => x.review).map((x) => x.task.skill)).toEqual(['old-a']);
    expect(maxFormatRun(q)).toBe(2);
  });

  it('навык самого урока не повторяется', () => {
    const q = assembleLesson({
      lesson: fourTasks,
      skills: [dueSkill('own-a')],
      lessonNumber: 2,
      pool: { 'own-a': [choose('x', 'own-a')] },
      rng,
    });
    expect(q.some((x) => x.review)).toBe(false);
  });

  it('помещается в потолок сессии: урок 5–6 из четырёх заданий получает одно повторение, из пяти — ни одного', () => {
    const young = (n: number) =>
      lesson('y', '5-6', Array.from({ length: n }, (_, i) => (i % 2 ? point(`y-${i}`, 'own') : choose(`y-${i}`, 'own'))));
    const skills = [dueSkill('old-a'), dueSkill('old-b')];
    expect(assembleLesson({ lesson: young(5), skills, lessonNumber: 2, pool, rng })).toHaveLength(5);
    const four = assembleLesson({ lesson: young(4), skills, lessonNumber: 2, pool, rng });
    expect(four).toHaveLength(5);
    expect(four.filter((x) => x.review)).toHaveLength(1);
  });

  it('позиции в задании повторения перемешаны', () => {
    const q = assembleLesson({ lesson: fourTasks, skills: [dueSkill('old-a')], lessonNumber: 2, pool, rng });
    const review = q.find((x) => x.review)!.task as ChooseTask;
    expect(review.id).toBe('l1-1');
    expect(review.options.map((o) => o.id)).not.toEqual(['a', 'b', 'c']);
  });

  it('при равной коробке — навык своего региона', () => {
    const skills = [dueSkill('old-a'), dueSkill('old-b')];
    const young = lesson('y', '5-6', [choose('y-1', 'own'), point('y-2', 'own'), choose('y-3', 'own'), point('y-4', 'own')]);
    const q = assembleLesson({ lesson: young, skills, lessonNumber: 2, pool, regionSkills: new Set(['old-b']), rng });
    expect(q.filter((x) => x.review).map((x) => x.task.skill)).toEqual(['old-b']);
  });

  it('5–6: текстовое задание из пула не берётся', () => {
    const young = lesson('y', '5-6', [choose('y-1', 'own'), point('y-2', 'own'), choose('y-3', 'own'), point('y-4', 'own')]);
    const q = assembleLesson({
      lesson: young,
      skills: [dueSkill('old-a')],
      lessonNumber: 2,
      pool: { 'old-a': [choose('txt', 'old-a', { presentation: 'text' })] },
      rng,
    });
    expect(q.some((x) => x.review)).toBe(false);
  });
});

describe('итог урока', () => {
  it('знакомство с форматом не в зачёт — ни звёзд, ни навыка', () => {
    const l = lesson('l', '7', [choose('i', 'intro-only', { intro: true }), choose('c', 'real')]);
    const r = finishLesson(l, played(queueOf(l.tasks), ['shown', 'first']), [], 3);
    expect(r.stars).toBe(3);
    expect(r.skills.map((s) => s.skill)).toEqual(['real']);
  });

  it('проба переноса звёзды не меняет, даже неудачная', () => {
    const l = lesson('l', '7', [choose('a', 's1'), point('b', 's2'), choose('c', 's3')]);
    const q = scheduleTransferProbe(queueOf(l.tasks), 0, rng);
    expect(q[3].transferProbe).toBe(true);
    const r = finishLesson(l, played(q, ['second', 'first', 'first', 'shown']), [], 3);
    expect(r.stars).toBe(2);
  });

  it('повторение в звёзды не идёт, но двигает свой навык', () => {
    const l = lesson('l', '7', [choose('a', 's1'), point('b', 's2')]);
    const q: QueuedTask[] = [{ task: l.tasks[0] }, { task: choose('r', 'old'), review: true }, { task: l.tasks[1] }];
    const hinted = finishLesson(l, played(q, ['first', 'second', 'first']), [dueSkill('old', 2)], 4);
    expect(hinted.stars).toBe(3);
    expect(hinted.skills.find((s) => s.skill === 'old')).toMatchObject({ box: 2, lastSeenLesson: 4 });
    const shown = finishLesson(l, played(q, ['first', 'shown', 'first']), [dueSkill('old', 2)], 4);
    expect(shown.stars).toBe(3);
    expect(shown.skills.find((s) => s.skill === 'old')?.box).toBe(1);
  });

  it('безошибочный первый урок — вторая коробка, а не «освоено»', () => {
    const l = lesson('l', '5-6', [choose('a', 'sub'), point('b', 'scene'), choose('c', 'sub'), choose('d', 'sub')]);
    const r = finishLesson(l, played(queueOf(l.tasks), ['first', 'first', 'first', 'first']), [], 1);
    expect(r.skills.find((s) => s.skill === 'sub')).toMatchObject({ box: 2, correctInRow: 3, attempts: 3 });
  });

  it('навыки, которых урок не касался, остаются как были', () => {
    const l = lesson('l', '7', [choose('a', 's1')]);
    const untouched = dueSkill('other', 3);
    const r = finishLesson(l, played(queueOf(l.tasks), ['first']), [untouched], 2);
    expect(r.skills).toContainEqual(untouched);
  });

  it('запись в атлас — ключ урока и звёзды', () => {
    const l = lesson('l', '7', [choose('a', 's1')]);
    const r = finishLesson(l, played(queueOf(l.tasks), ['shown']), [], 9);
    expect(r.entry).toEqual({ lessonId: 'l', atlasEntryKey: 'content.atlas.l', stars: 1, firstLesson: 9 });
  });
});

describe('коробка за урок', () => {
  it('всё сам — на шаг дальше, сколько бы ни было верных', () => {
    expect(applyLessonOutcomes(emptySkill('s'), ['correct', 'correct', 'correct'], 1).box).toBe(2);
  });

  it('срок не подошёл — всё сам, а коробка на месте', () => {
    // коробка 2 видена на уроке 1: срок — через 2 урока
    expect(applyLessonOutcomes(dueSkill('s', 2), ['correct'], 2).box).toBe(2);
    expect(applyLessonOutcomes(dueSkill('s', 2), ['correct'], 3).box).toBe(3);
  });

  it('три урока темы за вечер не дают «освоено»', () => {
    let s = emptySkill('s');
    for (const n of [1, 2, 3]) s = applyLessonOutcomes(s, ['correct', 'correct'], n);
    expect(s.box).toBe(2);
  });

  it('показанный ответ сбрасывает и до срока', () => {
    expect(applyLessonOutcomes(dueSkill('s', 3, 4), ['helped'], 5).box).toBe(1);
  });

  it('хоть раз с подсказкой — на месте', () => {
    expect(applyLessonOutcomes(dueSkill('s', 3), ['correct', 'hinted', 'correct'], 5).box).toBe(3);
  });

  it('хоть раз показали — первая коробка', () => {
    expect(applyLessonOutcomes(dueSkill('s', 3), ['correct', 'helped', 'transfer_correct'], 5).box).toBe(1);
  });

  it('только проба переноса — коробка на месте', () => {
    expect(applyLessonOutcomes(dueSkill('s', 2), ['transfer_correct'], 5).box).toBe(2);
  });

  it('без попыток — без изменений', () => {
    const s = dueSkill('s', 2);
    expect(applyLessonOutcomes(s, [], 5)).toBe(s);
  });
});

describe('атлас', () => {
  const entry = (stars: AtlasEntry['stars'], firstLesson: number): AtlasEntry => ({
    lessonId: 'l',
    atlasEntryKey: 'k',
    stars,
    firstLesson,
  });

  it('новая запись добавляется', () => {
    expect(recordInAtlas([], entry(2, 4))).toEqual([entry(2, 4)]);
  });

  it('повторное прохождение звёзды не отнимает и первое появление не меняет', () => {
    expect(recordInAtlas([entry(3, 2)], entry(1, 7))).toEqual([entry(3, 2)]);
  });

  it('лучший результат заменяет прежний', () => {
    expect(recordInAtlas([entry(1, 2)], entry(3, 7))).toEqual([entry(3, 2)]);
  });
});

describe('проба переноса после повторения', () => {
  it('не встаёт последней — идёт перед последним заданием урока', () => {
    const q: QueuedTask[] = [
      { task: choose('a', 's') },
      { task: point('b', 's') },
      { task: choose('r', 'old'), review: true },
      { task: point('c', 's') },
      { task: choose('d', 's') },
    ];
    const out = scheduleTransferProbe(q, 2, rng);
    expect(out.findIndex((x) => x.transferProbe)).toBe(4);
    expect(out[out.length - 1].task.id).toBe('d');
  });
});

describe('проба переноса и серия формата', () => {
  it('через два — если серия не длиннее двух', () => {
    const q = queueOf([choose('a', 's'), point('b', 's'), choose('c', 's'), point('d', 's')]);
    expect(scheduleTransferProbe(q, 0, rng).findIndex((x) => x.transferProbe)).toBe(3);
  });

  it('через одно — если через два вышло бы три одного формата подряд', () => {
    // через два: c p p [c] c c; через одно: c p [c] p c c
    const q = queueOf([choose('a', 's'), point('b', 's'), point('c', 's'), choose('d', 's'), choose('e', 's')]);
    const out = scheduleTransferProbe(q, 0, rng);
    expect(out.findIndex((x) => x.transferProbe)).toBe(2);
    expect(maxFormatRun(out)).toBe(2);
  });

  it('серию не разбить ни так, ни так — остаётся через два', () => {
    // через два: c p c [c] c; через одно: c p [c] c c
    const q = queueOf([choose('a', 's'), point('b', 's'), choose('c', 's'), choose('d', 's')]);
    expect(scheduleTransferProbe(q, 0, rng).findIndex((x) => x.transferProbe)).toBe(3);
  });
});
