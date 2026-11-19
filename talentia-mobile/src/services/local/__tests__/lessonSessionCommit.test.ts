/**
 * Сквозной путь первого прототипа (взгляд ментора 2026-10-23, К1 и К7): пилотный урок →
 * оркестратор (`domain/lessonSession.ts`) → `commitLesson` → чтение с устройства. На настоящем
 * SQLite с триггерами, как на устройстве; с согласием `account_local` и без него (№124).
 */
import { countingTopic } from '../../../content/numbers-5-6';
import { uuidV4 } from '../../../domain/ids';
import {
  applyLessonEvent,
  lessonCommitOf,
  lessonStepOf,
  startLessonSession,
  type LessonAnswer,
  type LessonSessionState,
} from '../../../domain/lessonSession';
import { buildReviewPool } from '../../../domain/lessonAssembly';
import type { Lesson, Task } from '../../../types/task';
import { LessonConsentRequiredError } from '../accountConsent';
import { LESSON_STATE_KEYS, loadChildState } from '../childState';
import { commitLesson, LessonStaleError } from '../commit';
import { lessonRunsOf } from '../lessonRuns';
import type { SqlDb } from '../sql';
import { memoryDb } from './nodeSql';

const KID = 'kid-1';
const T0 = '2026-10-24T09:00:00.000Z';
const at = (sec: number) => new Date(Date.parse(T0) + sec * 1000).toISOString();
const DAY = '2026-10-24';
const bytes = (n: number) => Uint8Array.from({ length: 16 }, (_, i) => (n * 31 + i) & 0xff);

function correctAnswer(task: Task): LessonAnswer {
  switch (task.format) {
    case 'choose':
      return { format: 'choose', optionId: task.options.find((o) => o.correct)!.id };
    case 'point':
      return { format: 'point', targetId: task.targets.find((t) => t.correct)!.id };
    case 'match':
      return { format: 'match', pairs: task.pairs.map((p) => ({ left: p.id, right: p.id })) };
    case 'order':
      return { format: 'order', slots: [...task.items].sort((a, b) => a.position - b.position).map((i) => i.id) };
    case 'group':
      return { format: 'group', placements: Object.fromEntries(task.items.map((i) => [i.id, i.groupId])) };
    case 'build':
      return { format: 'build', parts: [task.answer] };
  }
}

/** Пройти урок, как экран: завязка, пример, все задания верно с первой попытки. */
function play(state: LessonSessionState): LessonSessionState {
  let s = applyLessonEvent(state, { type: 'hook_done', at: at(1) });
  let sec = 2;
  while (lessonStepOf(s).kind === 'model') {
    const step = lessonStepOf(s);
    s = step.kind === 'model' && step.nowYou ? applyLessonEvent(s, { type: 'model_done', at: at(sec++) }) : applyLessonEvent(s, { type: 'model_step', at: at(sec++) });
  }
  while (lessonStepOf(s).kind === 'task') {
    const step = lessonStepOf(s);
    if (step.kind !== 'task') break;
    s = applyLessonEvent(s, { type: 'answer', answer: correctAnswer(step.task), at: at(sec + 3) });
    s = applyLessonEvent(s, { type: 'next', at: at(sec + 4) });
    sec += 5;
  }
  expect(lessonStepOf(s)).toEqual({ kind: 'done' });
  return s;
}

/** Урок от чтения состояния ребёнка до записи — как сделает экран. */
async function runLesson(db: SqlDb, lesson: Lesson, completed: Lesson[], seed: number) {
  const skills = (await loadChildState(db, KID, 'skills')) ?? [];
  const atlas = (await loadChildState(db, KID, 'atlas')) ?? [];
  const lessonNumber = (await loadChildState(db, KID, 'lessonCounter')) ?? 0;
  const state = startLessonSession({
    childId: KID,
    lesson,
    skills,
    lessonNumber,
    day: DAY,
    startedAt: at(0),
    pool: buildReviewPool(completed),
    seed,
    priorRun: 'none',
  });
  const done = play(state);
  const commit = lessonCommitOf(done, { lesson, skills, atlas, runId: uuidV4(() => bytes(seed)) });
  await commitLesson(db, KID, commit, at(60));
  return { done, commit };
}

const [l1, l2, l3] = countingTopic.lessons;

describe('пилотный урок от старта до записи', () => {
  it('«Узнаём до трёх» с примером: прохождение, навыки, атлас и счётчик на устройстве', async () => {
    const db = await memoryDb();
    const { done, commit } = await runLesson(db, l1, [], 11);

    expect(done.model).toMatchObject({ form: 'full' });
    expect(commit.stars).toBe(3);

    const runs = await lessonRunsOf(db, KID);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ childId: KID, lessonId: l1.id, startedAt: at(0), reviewTasks: 0 });
    expect(runs[0].taskSeconds).toHaveLength(l1.tasks.length);
    expect(await loadChildState(db, KID, 'lessonCounter')).toBe(1);
    expect(await loadChildState(db, KID, 'atlas')).toEqual([{ lessonId: l1.id, atlasEntryKey: l1.atlasEntryKey, stars: 3, firstLesson: 0 }]);
    const skills = (await loadChildState(db, KID, 'skills')) ?? [];
    expect(skills.map((s) => [s.skill, s.box])).toEqual([['subitize-1-3', 2]]);
  });

  it('три урока темы подряд: счётчик растёт, навыки за вечер не уезжают в «освоено», атлас — три страницы', async () => {
    const db = await memoryDb();
    await runLesson(db, l1, [], 1);
    await runLesson(db, l2, [l1], 2);
    await runLesson(db, l3, [l1, l2], 3);

    expect(await loadChildState(db, KID, 'lessonCounter')).toBe(3);
    expect((await lessonRunsOf(db, KID)).map((r) => r.lessonId)).toEqual([l1.id, l2.id, l3.id]);
    expect(((await loadChildState(db, KID, 'atlas')) ?? []).map((e) => e.lessonId)).toEqual([l1.id, l2.id, l3.id]);
    const skills = (await loadChildState(db, KID, 'skills')) ?? [];
    // спираль темы не отодвигает часы (№168): третий урок доводит до коробки 3, но до «освоено» (4) — зазор 5 уроков и 7 дней
    for (const s of skills) expect(s.box).toBeLessThanOrEqual(3);
    expect(skills.every((s) => s.lastSeenDay === DAY)).toBe(true);
  });

  it('повторный заход в тот же урок: звёзды в атласе не падают, прохождений два', async () => {
    const db = await memoryDb();
    await runLesson(db, l1, [], 5);
    const { commit } = await runLesson(db, l1, [l1], 6);
    expect(commit.nextLessonNumber).toBe(2);
    expect(await lessonRunsOf(db, KID)).toHaveLength(2);
    expect(await loadChildState(db, KID, 'atlas')).toEqual([{ lessonId: l1.id, atlasEntryKey: l1.atlasEntryKey, stars: 3, firstLesson: 0 }]);
  });
});

describe('режим без записи', () => {
  it('урок проходится целиком, итог есть, commitLesson отклоняет, на диске ничего', async () => {
    const db = await memoryDb(undefined, { account: false });
    const state = startLessonSession({
      childId: KID,
      lesson: l1,
      skills: [],
      lessonNumber: 0,
      day: DAY,
      startedAt: at(0),
      pool: {},
      seed: 9,
      priorRun: 'none',
    });
    const done = play(state);
    const commit = lessonCommitOf(done, { lesson: l1, skills: [], atlas: [], runId: uuidV4(() => bytes(9)) });
    expect(commit.stars).toBe(3);

    const err = await commitLesson(db, KID, commit, at(60)).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LessonConsentRequiredError);
    expect(await lessonRunsOf(db, KID)).toEqual([]);
    for (const key of LESSON_STATE_KEYS) expect(await loadChildState(db, KID, key)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// По ревью К1 (backend-auditor, 2026-10-24): не только счастливая ветка
// ---------------------------------------------------------------------------

function wrongAnswer(task: Task, except: readonly string[] = []): LessonAnswer {
  if (task.format !== 'choose') throw new Error('помощник только для choose');
  return { format: 'choose', optionId: task.options.find((o) => !o.correct && !except.includes(o.id))!.id };
}

async function startFromDb(
  db: SqlDb,
  lesson: Lesson,
  completed: Lesson[],
  seed: number,
  day = DAY,
  priorRun: 'none' | 'completed' = 'none',
) {
  const skills = (await loadChildState(db, KID, 'skills')) ?? [];
  const atlas = (await loadChildState(db, KID, 'atlas')) ?? [];
  const lessonNumber = (await loadChildState(db, KID, 'lessonCounter')) ?? 0;
  const state = startLessonSession({
    childId: KID,
    lesson,
    skills,
    lessonNumber,
    day,
    startedAt: at(0),
    pool: buildReviewPool(completed),
    seed,
    priorRun,
  });
  return { state, skills, atlas };
}

/** Прокрутить завязку и пример. */
function toTasks(state: LessonSessionState): LessonSessionState {
  let s = applyLessonEvent(state, { type: 'hook_done', at: at(1) });
  while (lessonStepOf(s).kind === 'model') {
    const step = lessonStepOf(s);
    s = step.kind === 'model' && step.nowYou ? applyLessonEvent(s, { type: 'model_done', at: at(2) }) : applyLessonEvent(s, { type: 'model_step', at: at(2) });
  }
  return s;
}

describe('ошибка, показ и проба переноса доходят до записи', () => {
  it('две ошибки в третьем задании (choose): пять замеров секунд, навык в коробке 1, одна звезда в атласе', async () => {
    const db = await memoryDb();
    const { state, skills, atlas } = await startFromDb(db, l2, [l1], 21);
    let s = toTasks(state);
    let sec = 3;
    let shownSkill = '';
    while (lessonStepOf(s).kind === 'task') {
      const step = lessonStepOf(s);
      if (step.kind !== 'task') break;
      if (step.task.id === 'nv-count-l2-t3' && !step.transferProbe) {
        shownSkill = step.task.skill;
        const w1 = wrongAnswer(step.task);
        s = applyLessonEvent(s, { type: 'answer', answer: w1, at: at(sec) });
        s = applyLessonEvent(s, { type: 'answer', answer: wrongAnswer(step.task, [(w1 as { optionId: string }).optionId]), at: at(sec + 1) });
        s = applyLessonEvent(s, { type: 'active_response', at: at(sec + 2) });
      } else {
        s = applyLessonEvent(s, { type: 'answer', answer: correctAnswer(step.task), at: at(sec) });
      }
      s = applyLessonEvent(s, { type: 'next', at: at(sec + 3) });
      sec += 5;
    }
    expect(s.queue.some((q) => q.transferProbe)).toBe(true);
    const commit = lessonCommitOf(s, { lesson: l2, skills, atlas, runId: uuidV4(() => bytes(21)) });
    expect(commit.stars).toBe(1);
    await commitLesson(db, KID, commit, at(99));

    const [run] = await lessonRunsOf(db, KID);
    expect(run.taskSeconds).toHaveLength(l2.tasks.length + 1);
    expect(((await loadChildState(db, KID, 'skills')) ?? []).find((x) => x.skill === shownSkill)).toMatchObject({ box: 1 });
    expect(await loadChildState(db, KID, 'atlas')).toEqual([{ lessonId: l2.id, atlasEntryKey: l2.atlasEntryKey, stars: 1, firstLesson: 0 }]);
  });

  it('повторение через неделю: навык из пройденного урока подмешан, reviewTasks = 1, коробка двигается только в срок', async () => {
    const db = await memoryDb();
    await runLesson(db, l1, [], 31);
    await runLesson(db, l3, [l1], 32);
    const { state, skills, atlas } = await startFromDb(db, l3, [l1, l3], 33, '2026-11-01');
    expect(state.queue.filter((q) => q.review).map((q) => q.task.skill)).toEqual(['subitize-1-3']);
    const done = play(state);
    const commit = lessonCommitOf(done, { lesson: l3, skills, atlas, runId: uuidV4(() => bytes(33)) });
    await commitLesson(db, KID, commit, at(99));
    const runs = await lessonRunsOf(db, KID);
    expect(runs[2].reviewTasks).toBe(1);
    expect(runs[2].taskSeconds).toHaveLength(l3.tasks.length + 1);
    const byName = Object.fromEntries(((await loadChildState(db, KID, 'skills')) ?? []).map((x) => [x.skill, x.box]));
    // subitize: урок 0 → коробка 2; повторение на уроке 2 через 8 дней — в срок → 3.
    // count-to-10 и count-to-5: уроки 1 и 2 подряд, срок два урока не вышел → остаются во 2-й
    expect(byName).toEqual({ 'subitize-1-3': 3, 'count-to-10': 2, 'count-to-5': 2 });
  });

  it('три урока за вечер: точные коробки', async () => {
    const db = await memoryDb();
    await runLesson(db, l1, [], 1);
    await runLesson(db, l2, [l1], 2);
    await runLesson(db, l3, [l1, l2], 3);
    const byName = Object.fromEntries(((await loadChildState(db, KID, 'skills')) ?? []).map((x) => [x.skill, x.box]));
    // subitize-1-3 введён в уроке 1, спираль в уроке 2 часы не сдвинула, урок 3 — в срок → коробка 3 (№168)
    expect(byName).toEqual({ 'subitize-1-3': 3, 'count-to-5': 2, 'count-to-10': 2 });
  });

  it('повтор пройденного урока — короткая форма примера', async () => {
    const db = await memoryDb();
    await runLesson(db, l1, [], 5);
    const { state } = await startFromDb(db, l1, [l1], 6, DAY, 'completed');
    const done = play(state);
    expect(done.model).toMatchObject({ form: 'short' });
  });

  it('итог от устаревшего счётчика не пишется: LessonStaleError, счётчик и прохождения прежние', async () => {
    const db = await memoryDb();
    const a = await startFromDb(db, l1, [], 41);
    await runLesson(db, l2, [l1], 42);
    const done = play(a.state);
    const commit = lessonCommitOf(done, { lesson: l1, skills: a.skills, atlas: a.atlas, runId: uuidV4(() => bytes(41)) });
    await expect(commitLesson(db, KID, commit, at(99))).rejects.toBeInstanceOf(LessonStaleError);
    expect(await loadChildState(db, KID, 'lessonCounter')).toBe(1);
    expect(await lessonRunsOf(db, KID)).toHaveLength(1);
  });
});
