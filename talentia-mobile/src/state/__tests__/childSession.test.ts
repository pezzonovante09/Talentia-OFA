/**
 * Сеанс ребёнка в памяти (режим без записи). Проверяется то, что увидит карта и атлас: порция,
 * узлы, продолжение брошенного урока, применение итога после `LessonConsentRequiredError`, запрет
 * применять память при чужой ошибке порта, накопление `formatsSeen` между уроками. Пишущий порт — только в
 * сеансе с аккаунтом: сеанс без записи его не вызывает (вопрос 84).
 */
import { regionLessons, regionMapLessons } from '../../content';
import { applyLessonEvent, lessonStepOf, type LessonAnswer, type LessonSessionState } from '../../domain/lessonSession';
import { mapNodes } from '../../domain/mapProgress';
import { emptySkill, type SkillState } from '../../domain/mastery';
import { LessonStaleError } from '../../services/local/commit';
import { newProfile } from '../../services/local/profiles';
import { EMPTY_PROGRESS, noRecordPort, type ProgressPort } from '../../services/progressPort';
import type { Task } from '../../types/task';
import { completedLessons, startedLessons, useChildSession } from '../childSession';

const NOW = new Date('2026-10-24T10:00:00.000Z');
const KID = '00000000-0000-4000-8000-000000000001';
const at = (sec: number) => new Date(NOW.getTime() + sec * 1000).toISOString();

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

/** Пройти открытый урок через стор до конца: завязка, пример, все задания верно. */
function playThrough(stopAfterTasks = Infinity): LessonSessionState {
  const { dispatch } = useChildSession.getState();
  let s = dispatch({ type: 'hook_done', at: at(1) });
  let sec = 2;
  while (lessonStepOf(s).kind === 'model') {
    const step = lessonStepOf(s);
    s = dispatch({ type: step.kind === 'model' && step.nowYou ? 'model_done' : 'model_step', at: at(sec++) });
  }
  let tasks = 0;
  while (lessonStepOf(s).kind === 'task' && tasks < stopAfterTasks) {
    const step = lessonStepOf(s);
    if (step.kind !== 'task') break;
    s = dispatch({ type: 'answer', answer: correctAnswer(step.task), at: at(sec + 3) });
    s = dispatch({ type: 'next', at: at(sec + 5) });
    sec += 6;
    tasks++;
  }
  return s;
}

const lessons = regionLessons('numbers');
const region = () => {
  const s = useChildSession.getState();
  return [{ lessons: regionMapLessons('numbers'), completed: completedLessons(s), started: startedLessons(s) }];
};
const nodes = () => mapNodes(region(), { band: '5-6' }, useChildSession.getState().portion.left)[0];

beforeEach(() => {
  useChildSession.getState().reset();
  useChildSession.getState().startNoRecordSession({ childId: KID, now: NOW, interfaceLang: 'ru' });
});

/** Сеанс с аккаунтом того же ребёнка: порт пишет только в нём (вопрос 84). */
const startAccount = () =>
  useChildSession.getState().startAccountSession({
    profile: newProfile({ childId: KID, band: '5-6', interfaceLang: 'ru', createdAt: NOW.toISOString() }),
    snapshot: { ...EMPTY_PROGRESS },
    now: NOW,
  });

describe('старт без записи', () => {
  it('порция — потолок полосы 5–6 (3), на карте открыт первый урок, остальные впереди', () => {
    const s = useChildSession.getState();
    expect(s.mode).toBe('no_record');
    expect(s.settings.band).toBe('5-6');
    expect(s.portion).toEqual({ left: 3, grantedDay: '2026-10-24' });
    expect(nodes()).toEqual(['open', 'ahead', 'ahead', 'ahead', 'ahead', 'ahead']);
  });

  it('setSettings меняет calm/focus/звук и не трогает полосу', () => {
    useChildSession.getState().setSettings({ calmMode: true, focusMode: true, soundEffects: false });
    const { settings } = useChildSession.getState();
    expect(settings).toMatchObject({ calmMode: true, focusMode: true, soundEffects: false, band: '5-6' });
  });
});

describe('открыть, выйти, вернуться', () => {
  it('повторное открытие того же урока возвращает то же состояние: урок ждёт', () => {
    const open = () => useChildSession.getState().openLesson({ lessonId: lessons[0].id, now: NOW, seed: 7, nodeState: 'open' });
    open();
    const mid = playThrough(1);
    useChildSession.getState().leaveLesson();
    expect(startedLessons(useChildSession.getState())).toEqual(new Set([lessons[0].id]));
    expect(open()).toBe(mid);
    expect(nodes()[0]).toBe('open');
  });

  it('открытие другого урока бросает прежний; возврат к нему — полная форма примера (priorRun abandoned)', () => {
    useChildSession.getState().openLesson({ lessonId: lessons[0].id, now: NOW, seed: 7, nodeState: 'open' });
    playThrough(1);
    useChildSession.getState().openLesson({ lessonId: lessons[1].id, now: NOW, seed: 7, nodeState: 'open' });
    expect(useChildSession.getState().abandoned).toEqual([lessons[0].id]);
    const again = useChildSession.getState().openLesson({ lessonId: lessons[0].id, now: NOW, seed: 7, nodeState: 'open' });
    expect(again.phase).toBe('hook');
    expect(again.model?.form).toBe('full');
  });
});

describe('finishLesson', () => {
  it('без записи: порт отвечает LessonConsentRequiredError → session_only, итог в памяти, порция 2, открыт урок 2', async () => {
    useChildSession.getState().openLesson({ lessonId: lessons[0].id, now: NOW, seed: 7, nodeState: 'open' });
    const done = playThrough();
    expect(done.phase).toBe('done');

    const outcome = await useChildSession.getState().finishLesson({ port: noRecordPort, runId: KID, at: at(100) });
    const s = useChildSession.getState();
    expect(outcome).toBe('session_only');
    expect(s.activeLesson).toBeNull();
    expect(s.progress.lessonCounter).toBe(1);
    expect(s.progress.atlas.map((e) => e.lessonId)).toEqual([lessons[0].id]);
    expect(s.progress.skills.length).toBeGreaterThan(0);
    expect(s.portion.left).toBe(2);
    expect(s.pendingResult?.run.lessonId).toBe(lessons[0].id);
    expect(nodes()).toEqual(['done', 'open', 'ahead', 'ahead', 'ahead', 'ahead']);
  });

  /**
   * Вопрос 84: взрослый завёл аккаунт, пока ребёнок играл без записи, — глобальный порт уже пишет в базу, а
   * случайного `childId` сеанса нет ни в одном профиле. Сеанс без записи порт не трогает.
   */
  it('без записи: пишущий порт не вызывается, итог только в памяти (session_only)', async () => {
    const commit = jest.fn<Promise<void>, Parameters<ProgressPort['commit']>>(() => Promise.resolve());
    const port: ProgressPort = { load: noRecordPort.load, commit };
    useChildSession.getState().openLesson({ lessonId: lessons[0].id, now: NOW, seed: 7, nodeState: 'open' });
    playThrough();
    await expect(useChildSession.getState().finishLesson({ port, runId: KID, at: at(100) })).resolves.toBe('session_only');
    expect(commit).not.toHaveBeenCalled();
    const s = useChildSession.getState();
    expect(s.progress.atlas.map((e) => e.lessonId)).toEqual([lessons[0].id]);
    expect(s.portion.left).toBe(2);
  });

  it('с аккаунтом: порт записал → persisted; повтор пройденного урока порцию не тратит', async () => {
    startAccount();
    const commit = jest.fn<Promise<void>, Parameters<ProgressPort['commit']>>(() => Promise.resolve());
    const port: ProgressPort = { load: noRecordPort.load, commit };
    useChildSession.getState().openLesson({ lessonId: lessons[0].id, now: NOW, seed: 7, nodeState: 'open' });
    playThrough();
    await expect(useChildSession.getState().finishLesson({ port, runId: KID, at: at(100) })).resolves.toBe('persisted');
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit.mock.calls[0][1]).toMatchObject({ nextLessonNumber: 1 });

    useChildSession.getState().openLesson({ lessonId: lessons[0].id, now: NOW, seed: 9, nodeState: 'done' });
    playThrough();
    await useChildSession.getState().finishLesson({ port, runId: KID, at: at(200) });
    expect(useChildSession.getState().portion.left).toBe(2);
    expect(useChildSession.getState().progress.lessonCounter).toBe(2);
  });

  it('чужая ошибка порта (LessonStaleError) пробрасывается, память не меняется', async () => {
    startAccount();
    const port: ProgressPort = { load: noRecordPort.load, commit: () => Promise.reject(new LessonStaleError(1, 1)) };
    useChildSession.getState().openLesson({ lessonId: lessons[0].id, now: NOW, seed: 7, nodeState: 'open' });
    playThrough();
    const before = useChildSession.getState();
    await expect(useChildSession.getState().finishLesson({ port, runId: KID, at: at(100) })).rejects.toBeInstanceOf(LessonStaleError);
    const after = useChildSession.getState();
    expect(after.progress).toBe(before.progress);
    expect(after.portion).toBe(before.portion);
    expect(after.activeLesson).toBe(before.activeLesson);
  });

  it('formatsSeen копится между уроками: второй урок с match идёт без демо', async () => {
    const withMatch = lessons.find((l) => l.tasks.some((t) => t.format === 'match'))!;
    const idx = lessons.indexOf(withMatch);
    // Пройти все уроки до него и его самого, затем открыть следующий урок с match.
    for (let i = 0; i <= idx; i++) {
      useChildSession.getState().openLesson({ lessonId: lessons[i].id, now: NOW, seed: 3, nodeState: 'open' });
      playThrough();
      await useChildSession.getState().finishLesson({ port: noRecordPort, runId: KID, at: at(100 + i) });
    }
    expect(useChildSession.getState().progress.formatsSeen).toContain('match');
    const next = lessons.slice(idx + 1).find((l) => l.tasks.some((t) => t.format === 'match'));
    if (!next) return;
    const s = useChildSession.getState().openLesson({ lessonId: next.id, now: NOW, seed: 3, nodeState: 'open' });
    let state = applyLessonEvent(s, { type: 'hook_done', at: at(1) });
    while (lessonStepOf(state).kind === 'model') {
      const step = lessonStepOf(state);
      state = applyLessonEvent(state, { type: step.kind === 'model' && step.nowYou ? 'model_done' : 'model_step', at: at(2) });
    }
    while (lessonStepOf(state).kind === 'task') {
      const step = lessonStepOf(state);
      if (step.kind !== 'task') break;
      if (step.task.format === 'match') {
        expect(step.demo).toBe(false);
        break;
      }
      state = applyLessonEvent(state, { type: 'answer', answer: correctAnswer(step.task), at: at(3) });
      state = applyLessonEvent(state, { type: 'next', at: at(4) });
    }
  });
});

describe('сессия повторения с узла карты (вопрос 56)', () => {
  /** Навык урока 1 в первой коробке, виденный на уроке 0 вчера: на счётчике 1 — в срок и сегодня ещё не встречался. */
  const dueYesterday = (skill: string): SkillState => ({ ...emptySkill(skill), lastSeenLesson: 0, lastSeenDay: '2026-10-23', attempts: 1, correct: 1 });
  const entry = (i: number) => ({ lessonId: lessons[i].id, atlasEntryKey: lessons[i].atlasEntryKey, stars: 3 as const, firstLesson: i });
  const skillOf = (i: number) => lessons[i].tasks[0].skill;

  /** Урок пройден вчера, его навык ждёт повторения. */
  const afterLesson = (i = 0) => {
    const s = useChildSession.getState();
    useChildSession.setState({ progress: { ...s.progress, skills: [dueYesterday(skillOf(i))], atlas: [entry(i)], lessonCounter: 1 } });
  };

  /** Пройти открытое повторение до конца: все задания верно. */
  function playReview(): LessonSessionState {
    const { dispatch } = useChildSession.getState();
    let s = useChildSession.getState().activeLesson!;
    let sec = 2;
    while (lessonStepOf(s).kind === 'task') {
      const step = lessonStepOf(s);
      if (step.kind !== 'task') break;
      s = dispatch({ type: 'answer', answer: correctAnswer(step.task), at: at(sec + 3) });
      s = dispatch({ type: 'next', at: at(sec + 5) });
      sec += 6;
    }
    return s;
  }

  it('openReview: нечего повторять — null, стор не меняется', () => {
    const before = useChildSession.getState();
    expect(useChildSession.getState().openReview({ now: NOW, seed: 7 })).toBeNull();
    expect(useChildSession.getState()).toBe(before);
    expect(useChildSession.getState().activeLesson).toBeNull();
  });

  it('openReview: навык в срок, но урок с ним не пройден (пул пуст) — null', () => {
    const s = useChildSession.getState();
    useChildSession.setState({ progress: { ...s.progress, skills: [dueYesterday(skillOf(0))], lessonCounter: 1 } });
    expect(useChildSession.getState().openReview({ now: NOW, seed: 7 })).toBeNull();
    expect(useChildSession.getState().activeLesson).toBeNull();
  });

  it('openReview после пройденного урока с навыком в срок: activeLesson — review, задания из этого урока, порция не тронута, урок на карте не «начат»', () => {
    afterLesson(0);
    const state = useChildSession.getState().openReview({ now: NOW, seed: 7 });
    expect(state?.lessonId).toBe('review');
    expect(state?.phase).toBe('task');
    expect(state?.queue.map((q) => q.task.skill)).toEqual([skillOf(0)]);
    expect(state?.queue.every((q) => lessons[0].tasks.some((t) => t.id === q.task.id))).toBe(true);
    const s = useChildSession.getState();
    expect(s.activeLesson).toBe(state);
    expect(s.openedAs).toBeNull();
    expect(s.portion).toEqual({ left: 3, grantedDay: '2026-10-24' });
    expect(startedLessons(s)).toEqual(new Set());
    expect(nodes()).toEqual(['done', 'open', 'ahead', 'ahead', 'ahead', 'ahead']);
  });

  it('openReview повторно продолжает то же повторение; открытие урока бросает его', () => {
    afterLesson(0);
    const first = useChildSession.getState().openReview({ now: NOW, seed: 7 });
    expect(useChildSession.getState().openReview({ now: NOW, seed: 99 })).toBe(first);
    useChildSession.getState().openLesson({ lessonId: lessons[1].id, now: NOW, seed: 7, nodeState: 'open' });
    expect(useChildSession.getState().abandoned).toEqual(['review']);
  });

  it('openReview поверх начатого урока: урок уходит в abandoned, возврат к нему — полная форма примера', () => {
    afterLesson(0);
    useChildSession.getState().openLesson({ lessonId: lessons[1].id, now: NOW, seed: 7, nodeState: 'open' });
    playThrough(1);
    expect(useChildSession.getState().openReview({ now: NOW, seed: 7 })?.lessonId).toBe('review');
    expect(useChildSession.getState().abandoned).toEqual([lessons[1].id]);
    const again = useChildSession.getState().openLesson({ lessonId: lessons[1].id, now: NOW, seed: 7, nodeState: 'open' });
    expect(again.model?.form).toBe('full');
  });

  it('finishLesson после повторения: порция цела, атлас прежний, lessonCounter +1, pendingResult.run — review, навык сдвинут', async () => {
    afterLesson(0);
    const before = useChildSession.getState().progress;
    useChildSession.getState().openReview({ now: NOW, seed: 7 });
    const done = playReview();
    expect(done.phase).toBe('done');

    const outcome = await useChildSession.getState().finishLesson({ port: noRecordPort, runId: KID, at: at(100) });
    const s = useChildSession.getState();
    expect(outcome).toBe('session_only');
    expect(s.activeLesson).toBeNull();
    expect(s.portion).toEqual({ left: 3, grantedDay: '2026-10-24' });
    expect(s.progress.atlas).toEqual(before.atlas);
    expect(s.progress.lessonCounter).toBe(2);
    expect(s.pendingResult?.run.lessonId).toBe('review');
    expect(s.pendingResult?.run.reviewTasks).toBe(1);
    expect(s.progress.skills.find((x) => x.skill === skillOf(0))).toMatchObject({ box: 2, lastSeenLesson: 1, lastSeenDay: '2026-10-24' });
    expect(nodes()).toEqual(['done', 'open', 'ahead', 'ahead', 'ahead', 'ahead']);
  });

  it('finishLesson после повторения с портом: commit получает run review и счётчик +1, порция не тратится и при persisted', async () => {
    startAccount();
    afterLesson(0);
    const commit = jest.fn<Promise<void>, Parameters<ProgressPort['commit']>>(() => Promise.resolve());
    const port: ProgressPort = { load: noRecordPort.load, commit };
    useChildSession.getState().openReview({ now: NOW, seed: 7 });
    playReview();
    await expect(useChildSession.getState().finishLesson({ port, runId: KID, at: at(100) })).resolves.toBe('persisted');
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit.mock.calls[0][1]).toMatchObject({ run: { lessonId: 'review', reviewTasks: 1 }, nextLessonNumber: 2 });
    expect(commit.mock.calls[0][1].atlas).toEqual([entry(0)]);
    expect(useChildSession.getState().portion.left).toBe(3);
  });

  it('после повторения тот же навык в тот же день второй раз не повторяется — openReview даёт null', async () => {
    afterLesson(0);
    useChildSession.getState().openReview({ now: NOW, seed: 7 });
    playReview();
    await useChildSession.getState().finishLesson({ port: noRecordPort, runId: KID, at: at(100) });
    expect(useChildSession.getState().openReview({ now: NOW, seed: 8 })).toBeNull();
  });
});

/** Контрольный аудит 2026-11-09, UX п. 13 (этап B6): сбой записи итога — не тупик для ребёнка. */
describe('finishLesson: сбой записи на устройство', () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  const failingPort: ProgressPort = { load: noRecordPort.load, commit: () => Promise.reject(new Error('disk I/O error')) };

  it('обычная Error порта → write_failed, а не исключение', async () => {
    startAccount();
    useChildSession.getState().openLesson({ lessonId: lessons[0].id, now: NOW, seed: 7, nodeState: 'open' });
    playThrough();
    await expect(useChildSession.getState().finishLesson({ port: failingPort, runId: KID, at: at(100) })).resolves.toBe('write_failed');
  });

  it('при write_failed итог остаётся в памяти: урок пройден, счётчик +1, pendingResult есть, activeLesson снят', async () => {
    startAccount();
    useChildSession.getState().openLesson({ lessonId: lessons[0].id, now: NOW, seed: 7, nodeState: 'open' });
    playThrough();
    await useChildSession.getState().finishLesson({ port: failingPort, runId: KID, at: at(100) });
    const s = useChildSession.getState();
    expect(s.progress.lessonCounter).toBe(1);
    expect(completedLessons(s).has(lessons[0].id)).toBe(true);
    expect(s.pendingResult?.run.lessonId).toBe(lessons[0].id);
    expect(s.activeLesson).toBeNull();
  });

  it('при write_failed lastWriteError — сообщение ошибки порта', async () => {
    startAccount();
    useChildSession.getState().openLesson({ lessonId: lessons[0].id, now: NOW, seed: 7, nodeState: 'open' });
    playThrough();
    await useChildSession.getState().finishLesson({ port: failingPort, runId: KID, at: at(100) });
    expect(useChildSession.getState().lastWriteError).toBe('disk I/O error');
  });

  it('не-Error в reject тоже даёт write_failed со строкой', async () => {
    startAccount();
    const port: ProgressPort = { load: noRecordPort.load, commit: () => Promise.reject('SQLITE_FULL') };
    useChildSession.getState().openLesson({ lessonId: lessons[0].id, now: NOW, seed: 7, nodeState: 'open' });
    playThrough();
    await expect(useChildSession.getState().finishLesson({ port, runId: KID, at: at(100) })).resolves.toBe('write_failed');
    expect(useChildSession.getState().lastWriteError).toBe('SQLITE_FULL');
  });

  it('следующая удачная запись снимает lastWriteError', async () => {
    startAccount();
    useChildSession.getState().openLesson({ lessonId: lessons[0].id, now: NOW, seed: 7, nodeState: 'open' });
    playThrough();
    await useChildSession.getState().finishLesson({ port: failingPort, runId: KID, at: at(100) });
    const ok: ProgressPort = { load: noRecordPort.load, commit: () => Promise.resolve() };
    useChildSession.getState().openLesson({ lessonId: lessons[0].id, now: NOW, seed: 9, nodeState: 'done' });
    playThrough();
    await expect(useChildSession.getState().finishLesson({ port: ok, runId: KID, at: at(200) })).resolves.toBe('persisted');
    expect(useChildSession.getState().lastWriteError).toBeNull();
  });

  it('LessonStaleError по-прежнему пробрасывается и lastWriteError не ставит', async () => {
    startAccount();
    const port: ProgressPort = { load: noRecordPort.load, commit: () => Promise.reject(new LessonStaleError(1, 1)) };
    useChildSession.getState().openLesson({ lessonId: lessons[0].id, now: NOW, seed: 7, nodeState: 'open' });
    playThrough();
    await expect(useChildSession.getState().finishLesson({ port, runId: KID, at: at(100) })).rejects.toBeInstanceOf(LessonStaleError);
    expect(useChildSession.getState().lastWriteError).toBeNull();
  });

  it('reset снимает lastWriteError', async () => {
    startAccount();
    useChildSession.getState().openLesson({ lessonId: lessons[0].id, now: NOW, seed: 7, nodeState: 'open' });
    playThrough();
    await useChildSession.getState().finishLesson({ port: failingPort, runId: KID, at: at(100) });
    useChildSession.getState().reset();
    expect(useChildSession.getState().lastWriteError).toBeNull();
  });
});
