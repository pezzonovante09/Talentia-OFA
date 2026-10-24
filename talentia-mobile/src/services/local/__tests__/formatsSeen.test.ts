/**
 * Миграция 14: `formatsSeen` в `child_state` — под воротами записи урока, как skills / atlas /
 * lessonCounter; `commitLesson` пишет его вместе с итогом, `sqlitePort.load` читает.
 */
import { regionLessons } from '../../../content';
import { applyLessonEvent, lessonCommitOf, lessonStepOf, startLessonSession, type LessonAnswer } from '../../../domain/lessonSession';
import { buildReviewPool } from '../../../domain/lessonAssembly';
import type { Task } from '../../../types/task';
import { sqlitePort } from '../../progressPort';
import { loadChildState, saveChildState } from '../childState';
import { commitLesson } from '../commit';
import { memoryDb } from './nodeSql';

const KID = 'kid-f';
const NOW = '2026-10-25T10:00:00.000Z';
const at = (s: number) => new Date(Date.parse(NOW) + s * 1000).toISOString();

function correctAnswer(task: Task): LessonAnswer {
  switch (task.format) {
    case 'choose':
      return { format: 'choose', optionId: task.options.find((o) => o.correct)!.id };
    case 'match':
      return { format: 'match', pairs: task.pairs.map((p) => ({ left: p.id, right: p.id })) };
    case 'order':
      return { format: 'order', slots: [...task.items].sort((a, b) => a.position - b.position).map((i) => i.id) };
    default:
      throw new Error('вне среза');
  }
}

describe('formatsSeen', () => {
  it('прямая запись без ворот отклоняется базой', async () => {
    const db = await memoryDb();
    await expect(saveChildState(db, KID, 'formatsSeen', ['match'], NOW)).rejects.toThrow(/formatsSeen/);
  });

  it('commitLesson пишет formatsSeen, порт читает его обратно', async () => {
    const db = await memoryDb();
    const lesson = regionLessons('numbers')[0];
    let state = startLessonSession({ childId: KID, lesson, skills: [], lessonNumber: 0, day: '2026-10-25', startedAt: NOW, pool: buildReviewPool([]), seed: 3, priorRun: 'none' });
    state = applyLessonEvent(state, { type: 'hook_done', at: at(1) });
    let sec = 2;
    while (lessonStepOf(state).kind === 'model') {
      const step = lessonStepOf(state);
      state = applyLessonEvent(state, { type: step.kind === 'model' && step.nowYou ? 'model_done' : 'model_step', at: at(sec++) });
    }
    while (lessonStepOf(state).kind === 'task') {
      const step = lessonStepOf(state);
      if (step.kind !== 'task') break;
      state = applyLessonEvent(state, { type: 'answer', answer: correctAnswer(step.task), at: at(sec + 3) });
      state = applyLessonEvent(state, { type: 'next', at: at(sec + 5) });
      sec += 6;
    }
    const result = lessonCommitOf(state, { lesson, skills: [], atlas: [], runId: '00000000-0000-4000-8000-00000000000f' });
    await commitLesson(db, KID, { run: result.run, skills: result.skills, atlas: result.atlas, nextLessonNumber: result.nextLessonNumber, formatsSeen: state.formatsSeen }, at(100));
    expect(await loadChildState(db, KID, 'formatsSeen')).toEqual(expect.arrayContaining(['match']));
    const snap = await sqlitePort(db).load(KID);
    expect(snap.formatsSeen).toEqual(state.formatsSeen);
    expect(snap.lessonCounter).toBe(1);
  });
});
