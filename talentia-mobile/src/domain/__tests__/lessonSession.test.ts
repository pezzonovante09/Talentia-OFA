/**
 * Оркестратор хода урока (`lessonSession.ts`, К1): порядок фаз, ошибка → сужение → показ →
 * активный ответ → проба переноса, секунды, итог для `commitLesson`, восстановление из снимка.
 */
import type { BuildTask, ChooseTask, GroupTask, Lesson, MatchTask, OrderTask, Task } from '../../types/task';
import { emptySkill, type SkillState } from '../mastery';
import {
  applyLessonEvent,
  evaluateAnswer,
  lessonCommitOf,
  lessonStepOf,
  LessonSessionError,
  startLessonSession,
  type LessonAnswer,
  type LessonSessionState,
  type LessonStep,
  type StartLessonInput,
} from '../lessonSession';

// ---------------------------------------------------------------------------
// Задания
// ---------------------------------------------------------------------------

const choose = (id: string, skill = 'count-to-3', extra: Partial<ChooseTask> = {}): ChooseTask => ({
  id,
  skill,
  format: 'choose',
  presentation: 'picture',
  promptKey: `content.${id}.p`,
  hintKey: `content.${id}.h`,
  explainKey: [`content.${id}.e`],
  options: [
    { id: 'a', labelKey: 'content.a', correct: false },
    { id: 'b', labelKey: 'content.b', correct: true },
    { id: 'c', labelKey: 'content.c', correct: false },
  ],
  ...extra,
});

const match = (id: string, skill = 'pairs'): MatchTask => ({
  id,
  skill,
  format: 'match',
  presentation: 'picture',
  promptKey: `content.${id}.p`,
  hintKey: `content.${id}.h`,
  pairs: [
    { id: 'p1', left: { labelKey: 'l1' }, right: { labelKey: 'r1' } },
    { id: 'p2', left: { labelKey: 'l2' }, right: { labelKey: 'r2' } },
    { id: 'p3', left: { labelKey: 'l3' }, right: { labelKey: 'r3' } },
  ],
});

const order = (id: string, skill = 'seq'): OrderTask => ({
  id,
  skill,
  format: 'order',
  presentation: 'picture',
  promptKey: `content.${id}.p`,
  hintKey: `content.${id}.h`,
  items: [
    { id: 'i1', labelKey: 'one', position: 0 },
    { id: 'i2', labelKey: 'two', position: 1 },
    { id: 'i3', labelKey: 'three', position: 2 },
  ],
});

const group = (id: string): GroupTask => ({
  id,
  skill: 'sort',
  format: 'group',
  presentation: 'picture',
  promptKey: `content.${id}.p`,
  hintKey: `content.${id}.h`,
  groups: [
    { id: 'g1', labelKey: 'big' },
    { id: 'g2', labelKey: 'small' },
  ],
  items: [
    { id: 'x', labelKey: 'x', groupId: 'g1' },
    { id: 'y', labelKey: 'y', groupId: 'g2' },
    { id: 'z', labelKey: 'z', groupId: 'g1' },
  ],
});

const buildFragments = (id: string): BuildTask => ({
  id,
  skill: 'syllables',
  format: 'build',
  promptKey: `content.${id}.p`,
  hintKey: `content.${id}.h`,
  fragments: [
    { id: 'f1', labelKey: 'ма' },
    { id: 'f2', labelKey: 'ши' },
    { id: 'f3', labelKey: 'на' },
    { id: 'f4', labelKey: 'ло' },
  ],
  answer: 'машина',
});

const keypad = (id: string): BuildTask => ({
  id,
  skill: 'sum',
  format: 'build',
  promptKey: `content.${id}.p`,
  hintKey: `content.${id}.h`,
  answer: '12',
});

/** Верный ответ на задание — как его собрал бы экран. */
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

const wrongChoose = (task: ChooseTask, except: readonly string[] = []): LessonAnswer => ({
  format: 'choose',
  optionId: task.options.find((o) => !o.correct && !except.includes(o.id))!.id,
});

// ---------------------------------------------------------------------------
// Урок и запуск
// ---------------------------------------------------------------------------

const lesson = (tasks: Task[], extra: Partial<Lesson> = {}): Lesson => ({
  id: 'l-1',
  titleKey: 'content.l1.title',
  band: '5-6',
  hook: { taliPose: 'found', lineKey: 'content.l1.hook' },
  atlasEntryKey: 'content.l1.atlas',
  tasks,
  ...extra,
});

const T0 = '2026-10-24T10:00:00.000Z';
const at = (sec: number) => new Date(Date.parse(T0) + sec * 1000).toISOString();

function start(l: Lesson, over: Partial<StartLessonInput> = {}): LessonSessionState {
  return startLessonSession({
    childId: 'kid',
    lesson: l,
    skills: [],
    lessonNumber: 0,
    day: '2026-10-24',
    startedAt: T0,
    pool: {},
    seed: 7,
    priorRun: 'none',
    ...over,
  });
}

/** Прокрутить завязку и пример до первого задания. */
function toTasks(s: LessonSessionState, sec = 1): LessonSessionState {
  let st = applyLessonEvent(s, { type: 'hook_done', at: at(sec) });
  if (st.phase === 'model') st = applyLessonEvent(st, { type: 'model_done', at: at(sec) });
  return st;
}

function currentTask(s: LessonSessionState): Task {
  const step = lessonStepOf(s);
  if (step.kind !== 'task') throw new Error(`фаза ${step.kind}`);
  return step.task;
}

/** Решить текущее задание верно с первой попытки и нажать «Дальше». */
function solve(s: LessonSessionState, sec: number): LessonSessionState {
  const answered = applyLessonEvent(s, { type: 'answer', answer: correctAnswer(currentTask(s)), at: at(sec) });
  return applyLessonEvent(answered, { type: 'next', at: at(sec) });
}

// ---------------------------------------------------------------------------
// Оценка ответа
// ---------------------------------------------------------------------------

describe('evaluateAnswer', () => {
  it('choose: верный по флагу, альтернатив — минус снятые', () => {
    const t = choose('c');
    expect(evaluateAnswer(t, { format: 'choose', optionId: 'b' }).correct).toBe(true);
    const e = evaluateAnswer(t, { format: 'choose', optionId: 'a' }, ['c']);
    expect(e.correct).toBe(false);
    expect(e.firstError).toEqual({ format: 'choose', alternatives: 2 });
  });

  it('match: неверных — пары, чья правая сторона не своя', () => {
    const t = match('m');
    const e = evaluateAnswer(t, { format: 'match', pairs: [{ left: 'p1', right: 'p2' }, { left: 'p2', right: 'p1' }, { left: 'p3', right: 'p3' }] });
    expect(e).toEqual({ correct: false, firstError: { format: 'match', wrong: 2 } });
    expect(evaluateAnswer(t, correctAnswer(t)).correct).toBe(true);
  });

  it('order: неверных — предметы не на своей позиции', () => {
    const t = order('o');
    expect(evaluateAnswer(t, { format: 'order', slots: ['i2', 'i1', 'i3'] }).firstError).toEqual({ format: 'order', wrong: 2 });
    expect(evaluateAnswer(t, { format: 'order', slots: ['i3', 'i1', 'i2'] }).firstError).toEqual({ format: 'order', wrong: 3 });
  });

  it('group: неверных — предметы не в своей корзине', () => {
    const t = group('g');
    const e = evaluateAnswer(t, { format: 'group', placements: { x: 'g1', y: 'g1', z: 'g1' } });
    expect(e).toEqual({ correct: false, firstError: { format: 'group', wrong: 1 } });
  });

  it('build из фишек: верное начало остаётся, с первой ошибки всё неверно; регистр не важен', () => {
    const t = buildFragments('b');
    expect(evaluateAnswer(t, { format: 'build', parts: ['Ма', 'ши', 'на'] }).correct).toBe(true);
    expect(evaluateAnswer(t, { format: 'build', parts: ['ма', 'ло', 'на'] }).firstError).toEqual({ format: 'build', wrong: 2 });
    expect(evaluateAnswer(t, { format: 'build', parts: ['ло', 'ма'] }).firstError).toEqual({ format: 'build', wrong: 2 });
    // собрано меньше, чем нужно, и всё верно — неверна одна «пустота»
    expect(evaluateAnswer(t, { format: 'build', parts: ['ма', 'ши'] }).firstError).toEqual({ format: 'build', wrong: 1 });
  });

  it('клавиатура: сравнение цифр, сужение по разрядности ответа', () => {
    const t = keypad('k');
    expect(evaluateAnswer(t, { format: 'build', parts: ['12'] }).correct).toBe(true);
    expect(evaluateAnswer(t, { format: 'build', parts: ['21'] }).firstError).toEqual({ format: 'keypad', digits: 2 });
  });

  it('ответ другого формата — ошибка программы', () => {
    expect(() => evaluateAnswer(choose('c'), { format: 'order', slots: [] })).toThrow(LessonSessionError);
  });
});

// ---------------------------------------------------------------------------
// Старт
// ---------------------------------------------------------------------------

describe('startLessonSession', () => {
  it('варианты перемешаны уже при первом показе, а не как у автора', () => {
    const l = lesson([choose('t1'), choose('t2'), choose('t3'), choose('t4')]);
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
    const orders = seeds.map((seed) => start(l, { seed }).queue.map((q) => (q.task as ChooseTask).options.map((o) => o.id).join('')).join('|'));
    expect(new Set(orders).size).toBeGreaterThan(1);
    const author = l.tasks.map((t) => (t as ChooseTask).options.map((o) => o.id).join('')).join('|');
    expect(orders.every((o) => o === author)).toBe(false);
  });

  it('одно семя — одна очередь', () => {
    const l = lesson([choose('t1'), choose('t2'), choose('t3'), choose('t4')]);
    expect(start(l, { seed: 42 })).toEqual(start(l, { seed: 42 }));
  });

  it('фаза — завязка; без примера после неё сразу задание', () => {
    const s = start(lesson([choose('t1')]));
    expect(lessonStepOf(s)).toEqual({ kind: 'hook' });
    const next = applyLessonEvent(s, { type: 'hook_done', at: at(1) });
    expect(lessonStepOf(next).kind).toBe('task');
  });

  it('пример: полная форма в первый раз, короткая после успешного прохождения, полная после брошенного (№29)', () => {
    const l = lesson([choose('t1')], {
      model: { skill: 'count-to-3', example: { ...choose('ex'), id: undefined } as never, steps: [{ lineKey: 's1' }, { lineKey: 's2' }] },
    });
    const full = applyLessonEvent(start(l, { priorRun: 'none' }), { type: 'hook_done', at: at(1) });
    expect(lessonStepOf(full)).toEqual({ kind: 'model', form: 'full', step: 0, nowYou: false });
    const s1 = applyLessonEvent(full, { type: 'model_step', at: at(2) });
    const s2 = applyLessonEvent(s1, { type: 'model_step', at: at(3) });
    expect(lessonStepOf(s2)).toEqual({ kind: 'model', form: 'full', step: 2, nowYou: true });
    expect(lessonStepOf(applyLessonEvent(s2, { type: 'model_done', at: at(4) })).kind).toBe('task');

    const short = applyLessonEvent(start(l, { priorRun: 'completed' }), { type: 'hook_done', at: at(1) });
    expect(lessonStepOf(short)).toEqual({ kind: 'model', form: 'short', step: 2, nowYou: true });
    const again = applyLessonEvent(start(l, { priorRun: 'abandoned' }), { type: 'hook_done', at: at(1) });
    expect(lessonStepOf(again)).toMatchObject({ form: 'full', nowYou: false });
  });
});

// ---------------------------------------------------------------------------
// Ход задания
// ---------------------------------------------------------------------------

describe('ход задания', () => {
  const l = lesson([choose('t1', 'count-to-3', { intro: true }), choose('t2'), choose('t3'), choose('t4')]);

  it('верно с первой: ждём «Дальше» с праздником, в зачёте', () => {
    const s = toTasks(start(l));
    const t = currentTask(s);
    const answered = applyLessonEvent(s, { type: 'answer', answer: correctAnswer(t), at: at(5) });
    expect(lessonStepOf(answered)).toMatchObject({ stage: 'next', attempt: 'first', feedback: 'celebrate', counts: false });
    const next = applyLessonEvent(answered, { type: 'next', at: at(6) });
    expect(next.played).toEqual([{ queued: s.queue[0], attempt: 'first' }]);
    expect(next.taskSeconds).toEqual([5]);
    expect(lessonStepOf(next)).toMatchObject({ kind: 'task', progress: { segment: 1, total: 4 } });
  });

  it('первая ошибка из трёх: сужение, снятый вариант помнится, вторая верная — hinted и тёплый отклик', () => {
    let s = toTasks(start(l));
    s = solve(s, 2);
    const t = currentTask(s) as ChooseTask;
    const wrong = wrongChoose(t);
    s = applyLessonEvent(s, { type: 'answer', answer: wrong, at: at(3) });
    expect(lessonStepOf(s)).toMatchObject({
      stage: 'answer',
      attempt: 'second',
      narrowing: { kind: 'narrow', pin: false },
      removed: [(wrong as { optionId: string }).optionId],
    });
    s = applyLessonEvent(s, { type: 'answer', answer: correctAnswer(t), at: at(4) });
    expect(lessonStepOf(s)).toMatchObject({ stage: 'next', attempt: 'second', feedback: 'warm' });
  });

  it('две ошибки: показ, активный ответ обязателен, нейтральный отклик, проба переноса через два задания', () => {
    let s = toTasks(start(l));
    s = solve(s, 2);
    const t = currentTask(s) as ChooseTask;
    const first = wrongChoose(t);
    s = applyLessonEvent(s, { type: 'answer', answer: first, at: at(3) });
    const second = wrongChoose(t, [(first as { optionId: string }).optionId]);
    s = applyLessonEvent(s, { type: 'answer', answer: second, at: at(4) });
    expect(lessonStepOf(s)).toMatchObject({ stage: 'active_response', attempt: 'shown', activeResponse: 'tap_shown', feedback: null });
    expect(() => applyLessonEvent(s, { type: 'next', at: at(5) })).toThrow(LessonSessionError);
    s = applyLessonEvent(s, { type: 'active_response', at: at(5) });
    expect(lessonStepOf(s)).toMatchObject({ stage: 'next', feedback: 'neutral' });
    s = applyLessonEvent(s, { type: 'next', at: at(6) });
    // t2 показан на индексе 1; проба — через два других: индекс 4, после t3 и t4
    expect(s.queue.map((q) => `${q.task.id}${q.transferProbe ? '*' : ''}`)).toEqual(['t1', 't2', 't3', 't4', 't2*']);
    expect(lessonStepOf(s)).toMatchObject({ progress: { segment: 2, total: 4 } });
  });

  it('проба переноса: сегмент не добавляется, верно — transfer_correct с тёплым откликом; ошибка — сразу показ', () => {
    let s = toTasks(start(l));
    s = solve(s, 1);
    const t = currentTask(s) as ChooseTask;
    const w1 = wrongChoose(t);
    s = applyLessonEvent(s, { type: 'answer', answer: w1, at: at(2) });
    s = applyLessonEvent(s, { type: 'answer', answer: wrongChoose(t, [(w1 as { optionId: string }).optionId]), at: at(3) });
    s = applyLessonEvent(s, { type: 'active_response', at: at(4) });
    s = applyLessonEvent(s, { type: 'next', at: at(5) });
    s = solve(s, 6);
    s = solve(s, 7);
    const probe = lessonStepOf(s);
    expect(probe).toMatchObject({ kind: 'task', transferProbe: true, progress: { segment: 3, total: 4 } });
    expect((probe as { task: Task }).task.id).toBe('t2');

    // ошибка в пробе — без сужения
    const shown = applyLessonEvent(s, { type: 'answer', answer: wrongChoose(t), at: at(8) });
    expect(lessonStepOf(shown)).toMatchObject({ attempt: 'shown', stage: 'active_response', narrowing: null });

    // верно в пробе — тёплый отклик, урок кончается
    let ok = applyLessonEvent(s, { type: 'answer', answer: correctAnswer(t), at: at(8) });
    expect(lessonStepOf(ok)).toMatchObject({ feedback: 'warm', attempt: 'first' });
    ok = applyLessonEvent(ok, { type: 'next', at: at(9) });
    expect(lessonStepOf(ok)).toEqual({ kind: 'done' });
  });

  it('сужать некуда (знакомство из двух): первая ошибка сразу ведёт к показу', () => {
    const intro = choose('t1', 'count-to-3', {
      intro: true,
      options: [
        { id: 'a', labelKey: 'a', correct: false },
        { id: 'b', labelKey: 'b', correct: true },
      ],
    });
    let s = toTasks(start(lesson([intro, choose('t2'), choose('t3'), choose('t4')])));
    s = applyLessonEvent(s, { type: 'answer', answer: { format: 'choose', optionId: 'a' }, at: at(2) });
    expect(lessonStepOf(s)).toMatchObject({ attempt: 'shown', stage: 'active_response', narrowing: { kind: 'show' } });
    s = applyLessonEvent(s, { type: 'active_response', at: at(3) });
    s = applyLessonEvent(s, { type: 'next', at: at(4) });
    // знакомство не в зачёт — пробы переноса нет
    expect(s.queue.some((q) => q.transferProbe)).toBe(false);
  });

  it('событие не по фазе — ошибка программы', () => {
    const s = start(l);
    expect(() => applyLessonEvent(s, { type: 'next', at: at(1) })).toThrow(LessonSessionError);
    expect(() => applyLessonEvent(s, { type: 'answer', answer: correctAnswer(l.tasks[0]), at: at(1) })).toThrow(LessonSessionError);
    expect(() => applyLessonEvent(s, { type: 'model_done', at: at(1) })).toThrow(LessonSessionError);
  });

  it('секунды на задание — от открытия до «Дальше»; часы назад дают ноль', () => {
    let s = toTasks(start(l), 10);
    s = applyLessonEvent(s, { type: 'answer', answer: correctAnswer(currentTask(s)), at: at(17) });
    s = applyLessonEvent(s, { type: 'next', at: at(19) });
    s = applyLessonEvent(s, { type: 'answer', answer: correctAnswer(currentTask(s)), at: at(5) });
    s = applyLessonEvent(s, { type: 'next', at: at(5) });
    expect(s.taskSeconds).toEqual([9, 0]);
  });
});

// ---------------------------------------------------------------------------
// Демонстрация составного формата (№35)
// ---------------------------------------------------------------------------

describe('первая встреча с составным форматом', () => {
  const l = lesson([choose('t1'), match('t2'), order('t3'), match('t4')]);

  it('demo у первого match и первого order; второй match — уже нет; choose — никогда', () => {
    let s = toTasks(start(l));
    expect(lessonStepOf(s)).toMatchObject({ demo: false });
    s = solve(s, 1);
    expect(lessonStepOf(s)).toMatchObject({ task: { format: 'match' }, demo: true });
    s = solve(s, 2);
    expect(lessonStepOf(s)).toMatchObject({ task: { format: 'order' }, demo: true });
    s = solve(s, 3);
    expect(lessonStepOf(s)).toMatchObject({ task: { format: 'match' }, demo: false });
  });

  it('формат из истории ребёнка или из примера демонстрации не получает', () => {
    const s = toTasks(start(l, { formatsSeen: ['match'] }));
    expect(lessonStepOf(solve(s, 1))).toMatchObject({ task: { format: 'match' }, demo: false });
    const withModel = lesson([match('t1'), choose('t2')], {
      model: { skill: 'pairs', example: { ...match('ex'), id: undefined } as never, steps: [{ lineKey: 's1' }] },
    });
    expect(lessonStepOf(toTasks(start(withModel)))).toMatchObject({ task: { format: 'match' }, demo: false });
  });
});

// ---------------------------------------------------------------------------
// Итог и снимок
// ---------------------------------------------------------------------------

describe('итог урока', () => {
  const l = lesson([choose('t1', 'count-to-3', { intro: true }), choose('t2'), choose('t3', 'count-to-5'), choose('t4')]);

  function playAll(s: LessonSessionState): LessonSessionState {
    let st = s;
    let sec = 1;
    while (lessonStepOf(st).kind === 'task') st = solve(st, sec++);
    return st;
  }

  it('без ошибок: три звезды, навыки в коробке 2, запись в атласе, прохождение с секундами', () => {
    const done = playAll(toTasks(start(l)));
    expect(lessonStepOf(done)).toEqual({ kind: 'done' });
    const c = lessonCommitOf(done, { lesson: l, skills: [], atlas: [], runId: 'run-1' });
    expect(c.stars).toBe(3);
    expect(c.nextLessonNumber).toBe(1);
    expect(c.atlas).toEqual([{ lessonId: 'l-1', atlasEntryKey: 'content.l1.atlas', stars: 3, firstLesson: 0 }]);
    expect(c.skills.map((s) => [s.skill, s.box, s.attempts])).toEqual([
      ['count-to-3', 2, 2],
      ['count-to-5', 2, 1],
    ]);
    // первое задание открыто и закрыто на одной секунде, следующие — от «Дальше» до «Дальше»
    expect(c.run).toEqual({ id: 'run-1', childId: 'kid', lessonId: 'l-1', startedAt: T0, taskSeconds: [0, 1, 1, 1], reviewTasks: 0 });
  });

  it('ответ показали: одна звезда, навык в первой коробке, проба переноса в зачёт попытки не двигает коробку', () => {
    let s = toTasks(start(l));
    s = solve(s, 1);
    const t = currentTask(s) as ChooseTask;
    const w1 = wrongChoose(t);
    s = applyLessonEvent(s, { type: 'answer', answer: w1, at: at(2) });
    s = applyLessonEvent(s, { type: 'answer', answer: wrongChoose(t, [(w1 as { optionId: string }).optionId]), at: at(3) });
    s = applyLessonEvent(s, { type: 'active_response', at: at(4) });
    s = applyLessonEvent(s, { type: 'next', at: at(5) });
    const done = playAll(s);
    const prior: SkillState = { ...emptySkill('count-to-3'), box: 3, lastSeenLesson: 0, lastSeenDay: '2026-10-01' };
    const c = lessonCommitOf(done, { lesson: l, skills: [prior], atlas: [], runId: 'run-2' });
    expect(c.stars).toBe(1);
    const skill = c.skills.find((x) => x.skill === 'count-to-3')!;
    expect(skill.box).toBe(1);
    // t2 показан + проба верно + t4 верно — три попытки навыка
    expect(skill.attempts).toBe(3);
  });

  it('итог незавершённого урока и чужой урок — ошибка программы', () => {
    const s = toTasks(start(l));
    expect(() => lessonCommitOf(s, { lesson: l, skills: [], atlas: [], runId: 'r' })).toThrow(LessonSessionError);
    const done = playAll(s);
    expect(() => lessonCommitOf(done, { lesson: { ...l, id: 'other' }, skills: [], atlas: [], runId: 'r' })).toThrow(LessonSessionError);
  });

  it('снимок — plain JSON: после восстановления урок продолжается так же, включая пробу переноса', () => {
    let s = toTasks(start(l));
    s = solve(s, 1);
    const t = currentTask(s) as ChooseTask;
    const w1 = wrongChoose(t);
    s = applyLessonEvent(s, { type: 'answer', answer: w1, at: at(2) });
    const restored = JSON.parse(JSON.stringify(s)) as LessonSessionState;
    expect(restored).toEqual(s);
    const finish = (st: LessonSessionState) => {
      let x = applyLessonEvent(st, { type: 'answer', answer: wrongChoose(t, [(w1 as { optionId: string }).optionId]), at: at(3) });
      x = applyLessonEvent(x, { type: 'active_response', at: at(4) });
      return applyLessonEvent(x, { type: 'next', at: at(5) });
    };
    expect(finish(restored)).toEqual(finish(s));
  });
});

// ---------------------------------------------------------------------------
// По ревью К1 (backend-auditor, 2026-10-24)
// ---------------------------------------------------------------------------

describe('нижний ряд match', () => {
  const l = lesson([match('t1'), match('t2'), choose('t3'), choose('t4')]);

  it('порядок правых сторон перемешан из семени, не совпадает с верхним, одинаков при одном семени', () => {
    const s = toTasks(start(l, { seed: 3 }));
    const step = lessonStepOf(s);
    expect(step.kind).toBe('task');
    const right = (step as Extract<LessonStep, { kind: 'task' }>).rightOrder as string[];
    expect([...right].sort()).toEqual(['p1', 'p2', 'p3']);
    expect(right).not.toEqual(['p1', 'p2', 'p3']);
    expect(lessonStepOf(toTasks(start(l, { seed: 3 })))).toEqual(step);
  });

  it('у других форматов rightOrder — null; после восстановления снимка ряд тот же', () => {
    let s = toTasks(start(l));
    s = solve(s, 1);
    s = solve(s, 2);
    expect(lessonStepOf(s)).toMatchObject({ task: { format: 'choose' }, rightOrder: null });
    const fresh = toTasks(start(l, { seed: 8 }));
    const restored = JSON.parse(JSON.stringify(fresh)) as LessonSessionState;
    expect(lessonStepOf(restored)).toEqual(lessonStepOf(fresh));
  });
});

describe('недопустимый ответ — ошибка программы, попытка не сгорает', () => {
  it('choose: чужой или снятый вариант', () => {
    const t = choose('c');
    expect(() => evaluateAnswer(t, { format: 'choose', optionId: 'zzz' })).toThrow(LessonSessionError);
    expect(() => evaluateAnswer(t, { format: 'choose', optionId: 'a' }, ['a'])).toThrow(LessonSessionError);
  });

  it('match / order / group: неполный набор, повторы, чужие id', () => {
    const m = match('m');
    expect(() => evaluateAnswer(m, { format: 'match', pairs: [{ left: 'p1', right: 'p1' }] })).toThrow(LessonSessionError);
    expect(() =>
      evaluateAnswer(m, { format: 'match', pairs: [{ left: 'p1', right: 'p1' }, { left: 'p1', right: 'p2' }, { left: 'p3', right: 'p3' }] }),
    ).toThrow(LessonSessionError);
    const o = order('o');
    expect(() => evaluateAnswer(o, { format: 'order', slots: ['i1', 'i2'] })).toThrow(LessonSessionError);
    expect(() => evaluateAnswer(o, { format: 'order', slots: ['i1', 'i1', 'i3'] })).toThrow(LessonSessionError);
    const g = group('g');
    expect(() => evaluateAnswer(g, { format: 'group', placements: { x: 'g1', y: 'g2' } })).toThrow(LessonSessionError);
    expect(() => evaluateAnswer(g, { format: 'group', placements: { x: 'g1', y: 'g2', z: 'nope' } })).toThrow(LessonSessionError);
  });

  it('build: пустой ответ, с клавиатуры не цифры', () => {
    expect(() => evaluateAnswer(buildFragments('b'), { format: 'build', parts: [] })).toThrow(LessonSessionError);
    expect(() => evaluateAnswer(buildFragments('b'), { format: 'build', parts: ['', 'ма'] })).toThrow(LessonSessionError);
    expect(() => evaluateAnswer(keypad('k'), { format: 'build', parts: ['1a'] })).toThrow(LessonSessionError);
  });

  it('в ходе задания состояние после ошибки программы не меняется', () => {
    const s = toTasks(start(lesson([choose('t1'), choose('t2'), choose('t3'), choose('t4')])));
    expect(() => applyLessonEvent(s, { type: 'answer', answer: { format: 'choose', optionId: 'nope' }, at: at(1) })).toThrow(LessonSessionError);
    expect(lessonStepOf(s)).toMatchObject({ attempt: 'first', stage: 'answer' });
  });
});

describe('остались и закреплён после первой ошибки', () => {
  it('order: верно стоящие остаются; первый неверный закреплён только при трёх неверных', () => {
    const four: OrderTask = {
      ...order('o'),
      items: [
        { id: 'i1', labelKey: 'one', position: 0 },
        { id: 'i2', labelKey: 'two', position: 1 },
        { id: 'i3', labelKey: 'three', position: 2 },
        { id: 'i4', labelKey: 'four', position: 3 },
      ],
    };
    const l = lesson([four, choose('t2'), choose('t3'), choose('t4')], { band: '7' });
    let s = toTasks(start(l));
    s = applyLessonEvent(s, { type: 'answer', answer: { format: 'order', slots: ['i1', 'i3', 'i4', 'i2'] }, at: at(1) });
    expect(lessonStepOf(s)).toMatchObject({
      attempt: 'second',
      narrowing: { kind: 'narrow', pin: true },
      kept: ['i1'],
      pinned: 'i2',
      demo: false,
      answerCue: false,
    });

    let two = toTasks(start(l));
    two = applyLessonEvent(two, { type: 'answer', answer: { format: 'order', slots: ['i2', 'i1', 'i3', 'i4'] }, at: at(1) });
    expect(lessonStepOf(two)).toMatchObject({ narrowing: { kind: 'narrow', pin: false }, kept: ['i3', 'i4'], pinned: null });
  });

  it('match и group: по порядку элементов задания', () => {
    const l = lesson([match('m'), group('g'), choose('t3'), choose('t4')]);
    let s = toTasks(start(l));
    s = applyLessonEvent(s, {
      type: 'answer',
      answer: { format: 'match', pairs: [{ left: 'p1', right: 'p2' }, { left: 'p2', right: 'p1' }, { left: 'p3', right: 'p3' }] },
      at: at(1),
    });
    expect(lessonStepOf(s)).toMatchObject({ kept: ['p3'], pinned: null, narrowing: { kind: 'narrow', pin: false } });
    s = applyLessonEvent(s, { type: 'answer', answer: correctAnswer(match('m')), at: at(2) });
    s = applyLessonEvent(s, { type: 'next', at: at(3) });
    s = applyLessonEvent(s, { type: 'answer', answer: { format: 'group', placements: { x: 'g2', y: 'g1', z: 'g1' } }, at: at(4) });
    // «первый» — в порядке показа: предметы перемешаны при первом показе, порядок — у задания в очереди
    const shownOrder = (currentTask(s) as GroupTask).items.map((i) => i.id);
    const firstWrong = shownOrder.find((id) => id === 'x' || id === 'y');
    expect(lessonStepOf(s)).toMatchObject({ kept: ['z'], pinned: firstWrong, narrowing: { kind: 'narrow', pin: true } });
  });

  it('build из фишек: верное начало и следующая фишка; клавиатура — первая цифра', () => {
    const l = lesson([buildFragments('b'), keypad('k'), choose('t3'), choose('t4')], { band: '7' });
    let s = toTasks(start(l));
    // две неверных — закреплять нельзя (осталось бы одно место); три — закрепляется следующая по ответу фишка
    s = applyLessonEvent(s, { type: 'answer', answer: { format: 'build', parts: ['ма', 'ло', 'на'] }, at: at(1) });
    expect(lessonStepOf(s)).toMatchObject({ kept: ['ма'], pinned: null, narrowing: { kind: 'narrow', pin: false } });
    let three = toTasks(start(l));
    three = applyLessonEvent(three, { type: 'answer', answer: { format: 'build', parts: ['ло', 'ма', 'на'] }, at: at(1) });
    expect(lessonStepOf(three)).toMatchObject({ kept: [], pinned: 'f1', narrowing: { kind: 'narrow', pin: true } });
    s = applyLessonEvent(s, { type: 'answer', answer: { format: 'build', parts: ['ма', 'ши', 'на'] }, at: at(2) });
    s = applyLessonEvent(s, { type: 'next', at: at(3) });
    s = applyLessonEvent(s, { type: 'answer', answer: { format: 'build', parts: ['21'] }, at: at(4) });
    expect(lessonStepOf(s)).toMatchObject({ narrowing: { kind: 'narrow', pin: true }, kept: [], pinned: '1' });
  });

  it('до ошибки — пусто; на 5-6 answerCue', () => {
    const s = toTasks(start(lesson([order('o'), choose('t2'), choose('t3'), choose('t4')])));
    expect(lessonStepOf(s)).toMatchObject({ kept: [], pinned: null, answerCue: true, demo: true });
  });
});

describe('зеркальный ряд order (№151)', () => {
  const tasks = () => [order('o'), choose('t2'), choose('t3'), choose('t4')];
  const mirror: LessonAnswer = { format: 'order', slots: ['i3', 'i2', 'i1'] };

  it('evaluateAnswer: зеркало от трёх мест; перестановка не зеркало; на двух местах — нет', () => {
    expect(evaluateAnswer(order('o'), mirror)).toMatchObject({ correct: false, mirrored: true });
    expect(evaluateAnswer(order('o'), { format: 'order', slots: ['i2', 'i1', 'i3'] }).mirrored).toBeUndefined();
    const two: OrderTask = { ...order('o'), items: order('o').items.slice(0, 2) };
    expect(evaluateAnswer(two, { format: 'order', slots: ['i2', 'i1'] }).mirrored).toBeUndefined();
  });

  it('на 5-6 — механика: попытка та же, ждём ответ, поправка одна; второе зеркало — обычная ошибка', () => {
    let s = toTasks(start(lesson(tasks())));
    s = applyLessonEvent(s, { type: 'answer', answer: mirror, at: at(1) });
    expect(lessonStepOf(s)).toMatchObject({ attempt: 'first', stage: 'answer', narrowing: null, mirrored: true, demo: false });
    s = applyLessonEvent(s, { type: 'answer', answer: mirror, at: at(2) });
    expect(lessonStepOf(s)).toMatchObject({ mirrored: false });
    expect((lessonStepOf(s) as Extract<LessonStep, { kind: 'task' }>).attempt).not.toBe('first');
  });

  it('на 5-6 после поправки верный ряд — с первой попытки', () => {
    let s = toTasks(start(lesson(tasks())));
    s = applyLessonEvent(s, { type: 'answer', answer: mirror, at: at(1) });
    s = applyLessonEvent(s, { type: 'answer', answer: correctAnswer(order('o')), at: at(2) });
    expect(lessonStepOf(s)).toMatchObject({ attempt: 'first', stage: 'next', mirrored: false });
  });

  it('с 7 — ошибка навыка, как любая', () => {
    let s = toTasks(start(lesson(tasks(), { band: '7' })));
    s = applyLessonEvent(s, { type: 'answer', answer: mirror, at: at(1) });
    const step = lessonStepOf(s) as Extract<LessonStep, { kind: 'task' }>;
    expect(step.mirrored).toBe(false);
    expect(step.attempt).not.toBe('first');
  });
});
