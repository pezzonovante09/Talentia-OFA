import type { AgeBand, ChooseTask, Lesson, PointTask, Task, TaskFormat } from '../../types/task';
import {
  assembleLesson,
  assembleReview,
  buildReviewPool,
  finishLesson,
  finishReview,
  fitsBand,
  recordInAtlas,
  type AtlasEntry,
  type Played,
} from '../lessonAssembly';
import { maxFormatRun, scheduleTransferProbe, type QueuedTask, type Rng } from '../lessonFlow';
import { applyLessonOutcomes, daysBetween, emptySkill, isDue, isMastered, skillsToReview, type SkillState } from '../mastery';

const rng: Rng = () => 0.3;
const DAY = '2026-09-30';

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
    const q = assembleLesson({ lesson: fourTasks, skills: [], lessonNumber: 2, day: DAY, pool, rng });
    expect(q.map((x) => x.task.id)).toEqual(['l2-1', 'l2-2', 'l2-3', 'l2-4']);
  });

  it('не больше двух повторений, младшие коробки первыми', () => {
    const skills = [dueSkill('old-c', 3, 0), dueSkill('old-a', 1), dueSkill('old-b', 2, 0)];
    const q = assembleLesson({ lesson: fourTasks, skills, lessonNumber: 5, day: DAY, pool, rng });
    expect(q.filter((x) => x.review).map((x) => x.task.skill)).toEqual(['old-a', 'old-b']);
  });

  it('повторение не первое и не последнее', () => {
    const q = assembleLesson({
      lesson: fourTasks,
      skills: [dueSkill('old-a'), dueSkill('old-b')],
      lessonNumber: 2, day: DAY,
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
    const q = assembleLesson({ lesson: withIntro, skills: [dueSkill('old-b')], lessonNumber: 2, day: DAY, pool, rng });
    expect(q.findIndex((x) => x.review)).toBeGreaterThanOrEqual(2);
  });

  it('встаёт туда, где серия одного формата не длиннее двух', () => {
    const dense = lesson('ld', '7', [choose('ld-1', 'own'), choose('ld-2', 'own'), point('ld-3', 'own'), point('ld-4', 'own')]);
    const q = assembleLesson({ lesson: dense, skills: [dueSkill('old-a')], lessonNumber: 2, day: DAY, pool, rng });
    expect(formats(q)).toEqual(['choose', 'choose', 'point', 'choose', 'point']);
    expect(q[3].review).toBe(true);
  });

  it('задание навыка никуда не встаёт — пробуется другое задание того же навыка', () => {
    const points = lesson('lp', '7', [point('p1', 'own'), point('p2', 'own'), choose('p3', 'own'), point('p4', 'own'), point('p5', 'own')]);
    const q = assembleLesson({
      lesson: points,
      skills: [dueSkill('old-b')],
      lessonNumber: 2, day: DAY,
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
      lessonNumber: 5, day: DAY,
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
      lessonNumber: 2, day: DAY,
      pool: { 'own-a': [choose('x', 'own-a')] },
      rng,
    });
    expect(q.some((x) => x.review)).toBe(false);
  });

  it('помещается в потолок сессии: урок 5–6 из четырёх заданий получает одно повторение, из пяти — ни одного', () => {
    const young = (n: number) =>
      lesson('y', '5-6', Array.from({ length: n }, (_, i) => (i % 2 ? point(`y-${i}`, 'own') : choose(`y-${i}`, 'own'))));
    const skills = [dueSkill('old-a'), dueSkill('old-b')];
    expect(assembleLesson({ lesson: young(5), skills, lessonNumber: 2, day: DAY, pool, rng })).toHaveLength(5);
    const four = assembleLesson({ lesson: young(4), skills, lessonNumber: 2, day: DAY, pool, rng });
    expect(four).toHaveLength(5);
    expect(four.filter((x) => x.review)).toHaveLength(1);
  });

  it('позиции в задании повторения перемешаны', () => {
    const q = assembleLesson({ lesson: fourTasks, skills: [dueSkill('old-a')], lessonNumber: 2, day: DAY, pool, rng });
    const review = q.find((x) => x.review)!.task as ChooseTask;
    expect(review.id).toBe('l1-1');
    expect(review.options.map((o) => o.id)).not.toEqual(['a', 'b', 'c']);
  });

  it('при равной коробке — навык своего региона', () => {
    const skills = [dueSkill('old-a'), dueSkill('old-b')];
    const young = lesson('y', '5-6', [choose('y-1', 'own'), point('y-2', 'own'), choose('y-3', 'own'), point('y-4', 'own')]);
    const q = assembleLesson({ lesson: young, skills, lessonNumber: 2, day: DAY, pool, regionSkills: new Set(['old-b']), rng });
    expect(q.filter((x) => x.review).map((x) => x.task.skill)).toEqual(['old-b']);
  });

  it('5–6: текстовое задание из пула не берётся', () => {
    const young = lesson('y', '5-6', [choose('y-1', 'own'), point('y-2', 'own'), choose('y-3', 'own'), point('y-4', 'own')]);
    const q = assembleLesson({
      lesson: young,
      skills: [dueSkill('old-a')],
      lessonNumber: 2, day: DAY,
      pool: { 'old-a': [choose('txt', 'old-a', { presentation: 'text' })] },
      rng,
    });
    expect(q.some((x) => x.review)).toBe(false);
  });
});

describe('сборка повторения', () => {
  it('по одному заданию на навык в срок, все помечены review, завязки и примера нет', () => {
    const q = assembleReview({ band: '7', skills: [dueSkill('old-a'), dueSkill('old-b')], lessonNumber: 2, day: DAY, pool, rng });
    expect(q.map((x) => x.task.skill)).toEqual(['old-a', 'old-b']);
    expect(q.every((x) => x.review === true)).toBe(true);
    expect(q.some((x) => x.transferProbe)).toBe(false);
  });

  it('навыки не в срок не берутся; без навыков — пустая очередь', () => {
    expect(assembleReview({ band: '7', skills: [], lessonNumber: 2, day: DAY, pool, rng })).toEqual([]);
    // коробка 2 видена на уроке 1: срок — урок 3
    expect(assembleReview({ band: '7', skills: [dueSkill('old-a', 2, 1)], lessonNumber: 2, day: DAY, pool, rng })).toEqual([]);
  });

  it('навык, встреченный сегодня, в сессию не попадает — одна встреча в игровой день', () => {
    const today = { ...dueSkill('old-a'), lastSeenDay: DAY };
    const yesterday = { ...dueSkill('old-b'), lastSeenDay: '2026-09-29' };
    const q = assembleReview({ band: '7', skills: [today, yesterday], lessonNumber: 2, day: DAY, pool, rng });
    expect(q.map((x) => x.task.skill)).toEqual(['old-b']);
  });

  it('младшие коробки первыми', () => {
    const skills = [dueSkill('old-c', 3, 0), dueSkill('old-a', 1), dueSkill('old-b', 2, 0)];
    const q = assembleReview({ band: '7', skills, lessonNumber: 5, day: DAY, pool, rng });
    expect(q.map((x) => x.task.skill)).toEqual(['old-a', 'old-b', 'old-c']);
  });

  it('потолок полосы: 5–6 при семи навыках в срок получает пять заданий', () => {
    const skills = Array.from({ length: 7 }, (_, i) => dueSkill(`s${i}`));
    const wide: Record<string, Task[]> = Object.fromEntries(skills.map((s, i) => [s.skill, [i % 2 ? point(`p${i}`, s.skill) : choose(`c${i}`, s.skill)]]));
    const q = assembleReview({ band: '5-6', skills, lessonNumber: 2, day: DAY, pool: wide, rng });
    expect(q).toHaveLength(5);
    expect(q.map((x) => x.task.skill)).toEqual(['s0', 's1', 's2', 's3', 's4']);
    expect(assembleReview({ band: '7', skills, lessonNumber: 2, day: DAY, pool: wide, rng })).toHaveLength(7);
  });

  it('серия одного формата не длиннее двух: три навыка с одними choose дают два задания', () => {
    const onlyChoose: Record<string, Task[]> = { a: [choose('a1', 'a')], b: [choose('b1', 'b')], c: [choose('c1', 'c')] };
    const q = assembleReview({ band: '7', skills: [dueSkill('a'), dueSkill('b'), dueSkill('c')], lessonNumber: 2, day: DAY, pool: onlyChoose, rng });
    expect(q.map((x) => x.task.skill)).toEqual(['a', 'b']);
    expect(maxFormatRun(q)).toBe(2);
  });

  it('задание навыка не встаёт по серии — берётся другое задание того же навыка', () => {
    const mixed: Record<string, Task[]> = { a: [choose('a1', 'a')], b: [choose('b1', 'b')], c: [choose('c1', 'c'), point('c2', 'c')] };
    const q = assembleReview({ band: '7', skills: [dueSkill('a'), dueSkill('b'), dueSkill('c')], lessonNumber: 2, day: DAY, pool: mixed, rng });
    expect(q.map((x) => x.task.id)).toEqual(['a1', 'b1', 'c2']);
    expect(maxFormatRun(q)).toBe(2);
  });

  it('навык без подходящего задания пропускается: нет в пуле или не по полосе', () => {
    const q = assembleReview({
      band: '5-6',
      skills: [dueSkill('old-a'), dueSkill('nowhere'), dueSkill('txt'), dueSkill('old-b')],
      lessonNumber: 2,
      day: DAY,
      pool: { ...pool, txt: [choose('t', 'txt', { presentation: 'text' })] },
      rng,
    });
    expect(q.map((x) => x.task.skill)).toEqual(['old-a', 'old-b']);
  });

  it('знакомство с форматом повторением не бывает', () => {
    const q = assembleReview({ band: '7', skills: [dueSkill('old-a')], lessonNumber: 2, day: DAY, pool: { 'old-a': [choose('i', 'old-a', { intro: true })] }, rng });
    expect(q).toEqual([]);
  });

  it('позиции в задании перемешаны', () => {
    const q = assembleReview({ band: '7', skills: [dueSkill('old-a')], lessonNumber: 2, day: DAY, pool, rng });
    expect((q[0].task as ChooseTask).options.map((o) => o.id)).not.toEqual(['a', 'b', 'c']);
  });

  it('finishReview двигает коробки по худшему исходу и не возвращает ни звёзд, ни атласа', () => {
    const q: QueuedTask[] = [
      { task: choose('ra', 'old-a'), review: true },
      { task: point('rb', 'old-b'), review: true },
      { task: choose('rc', 'old-c'), review: true },
    ];
    const r = finishReview(played(q, ['first', 'second', 'shown']), [dueSkill('old-a'), dueSkill('old-b', 2, 0), dueSkill('old-c', 3, 0)], 5, DAY);
    expect(Object.keys(r)).toEqual(['skills']);
    expect(r.skills.find((s) => s.skill === 'old-a')).toMatchObject({ box: 2, lastSeenLesson: 5, lastSeenDay: DAY });
    expect(r.skills.find((s) => s.skill === 'old-b')).toMatchObject({ box: 2, lastSeenLesson: 5 });
    expect(r.skills.find((s) => s.skill === 'old-c')).toMatchObject({ box: 1, lastSeenLesson: 5 });
  });

  it('finishReview: навыки, которых повторение не касалось, остаются как были', () => {
    const untouched = dueSkill('other', 3);
    const r = finishReview(played([{ task: choose('ra', 'old-a'), review: true }], ['first']), [untouched], 5, DAY);
    expect(r.skills).toContainEqual(untouched);
    expect(r.skills).toHaveLength(2);
  });
});

describe('итог урока', () => {
  it('знакомство с форматом не в зачёт — ни звёзд, ни навыка', () => {
    const l = lesson('l', '7', [choose('i', 'intro-only', { intro: true }), choose('c', 'real')]);
    const r = finishLesson(l, played(queueOf(l.tasks), ['shown', 'first']), [], 3, DAY);
    expect(r.stars).toBe(3);
    expect(r.skills.map((s) => s.skill)).toEqual(['real']);
  });

  it('проба переноса звёзды не меняет, даже неудачная', () => {
    const l = lesson('l', '7', [choose('a', 's1'), point('b', 's2'), choose('c', 's3')]);
    const q = scheduleTransferProbe(queueOf(l.tasks), 0, rng);
    expect(q[3].transferProbe).toBe(true);
    const r = finishLesson(l, played(q, ['second', 'first', 'first', 'shown']), [], 3, DAY);
    expect(r.stars).toBe(2);
  });

  it('повторение в звёзды не идёт, но двигает свой навык', () => {
    const l = lesson('l', '7', [choose('a', 's1'), point('b', 's2')]);
    const q: QueuedTask[] = [{ task: l.tasks[0] }, { task: choose('r', 'old'), review: true }, { task: l.tasks[1] }];
    const hinted = finishLesson(l, played(q, ['first', 'second', 'first']), [dueSkill('old', 2)], 4, DAY);
    expect(hinted.stars).toBe(3);
    expect(hinted.skills.find((s) => s.skill === 'old')).toMatchObject({ box: 2, lastSeenLesson: 4 });
    const shown = finishLesson(l, played(q, ['first', 'shown', 'first']), [dueSkill('old', 2)], 4, DAY);
    expect(shown.stars).toBe(3);
    expect(shown.skills.find((s) => s.skill === 'old')?.box).toBe(1);
  });

  it('безошибочный первый урок — вторая коробка, а не «освоено»', () => {
    const l = lesson('l', '5-6', [choose('a', 'sub'), point('b', 'scene'), choose('c', 'sub'), choose('d', 'sub')]);
    const r = finishLesson(l, played(queueOf(l.tasks), ['first', 'first', 'first', 'first']), [], 1, DAY);
    expect(r.skills.find((s) => s.skill === 'sub')).toMatchObject({ box: 2, correctInRow: 3, attempts: 3 });
  });

  it('навыки, которых урок не касался, остаются как были', () => {
    const l = lesson('l', '7', [choose('a', 's1')]);
    const untouched = dueSkill('other', 3);
    const r = finishLesson(l, played(queueOf(l.tasks), ['first']), [untouched], 2, DAY);
    expect(r.skills).toContainEqual(untouched);
  });

  it('запись в атлас — ключ урока и звёзды', () => {
    const l = lesson('l', '7', [choose('a', 's1')]);
    const r = finishLesson(l, played(queueOf(l.tasks), ['shown']), [], 9, DAY);
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
    // урок 2 — спираль не в срок: часы стоят; урок 3 — в срок, коробка 3; до четвёртой — зазор 5 и 7 дней
    let s = emptySkill('s');
    for (const n of [1, 2, 3]) s = applyLessonOutcomes(s, ['correct', 'correct'], n, `2026-10-0${n}`);
    expect({ box: s.box, освоен: isMastered(s) }).toEqual({ box: 3, освоен: false });
    expect(isDue(s, 8, '2026-10-05')).toBe(false);
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

describe('календарный зазор повторения', () => {
  const seen = (box: SkillState['box'], lastSeenDay: string | null): SkillState => ({
    ...emptySkill('s'),
    box,
    lastSeenLesson: 0,
    lastSeenDay,
  });

  it('коробка 3 — не раньше чем через три дня, даже если уроков прошло достаточно', () => {
    expect(isDue(seen(3, DAY), 10, '2026-10-02')).toBe(false);
    expect(isDue(seen(3, DAY), 10, '2026-10-03')).toBe(true);
  });

  it('коробка 4 — не раньше чем через неделю', () => {
    expect(isDue(seen(4, '2026-09-24'), 20, DAY)).toBe(false);
    expect(isDue(seen(4, '2026-09-23'), 20, DAY)).toBe(true);
  });

  it('подсказка на «освоенном» навыке возвращает его в третью коробку', () => {
    expect(applyLessonOutcomes(seen(4, '2026-09-01'), ['correct', 'hinted'], 30, DAY).box).toBe(3);
    expect(applyLessonOutcomes(seen(3, '2026-09-01'), ['hinted'], 30, DAY).box).toBe(3);
  });

  it('младшие коробки — без зазора: вспомненное с трудом трогают часто', () => {
    expect(isDue(seen(1, DAY), 1, DAY)).toBe(true);
    expect(isDue(seen(2, DAY), 2, DAY)).toBe(true);
  });

  it('и по урокам тоже: день прошёл, а уроков мало — рано', () => {
    expect(isDue(seen(3, '2026-09-01'), 4, DAY)).toBe(false);
  });

  it('шесть уроков за вечер не дают ни повторения, ни «освоено»', () => {
    let s: SkillState = { ...emptySkill('s'), box: 3, lastSeenLesson: 0, lastSeenDay: DAY };
    for (let n = 5; n <= 10; n += 1) s = applyLessonOutcomes(s, ['correct'], n, DAY);
    expect(s.box).toBe(3);
    expect(skillsToReview([seen(3, DAY)], 10, 2, DAY)).toEqual([]);
  });

  it('итог урока пишет день встречи', () => {
    const l = lesson('l', '7', [choose('a', 's1')]);
    const r = finishLesson(l, played([{ task: l.tasks[0] }], ['first']), [], 1, DAY);
    expect(r.skills[0].lastSeenDay).toBe(DAY);
  });

  it('запись без дня прошлой встречи календарём не ограничивается', () => {
    expect(isDue(seen(4, null), 12, DAY)).toBe(true);
  });

  it('дни считаются через границу месяца', () => {
    expect(daysBetween('2026-09-29', '2026-10-02')).toBe(3);
  });
});
