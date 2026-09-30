import type { AbaSession, AbaTrial } from '../../../types/aba';
import type { AbaSessionResult, AbaSessionState } from '../../../domain/abaSession';
import { emptySkill } from '../../../domain/mastery';
import type { LessonRun } from '../../../domain/parentReport';
import { appendTrial, sessionsOf, trialsOfTarget } from '../abaLog';
import { loadChildState } from '../childState';
import { commitAbaSession, commitLesson, recordAbaTrial } from '../commit';
import { appendConsentEvent, readConsentLog } from '../consentLog';
import { lessonRunsOf } from '../lessonRuns';
import { memoryDb } from './nodeSql';

const NOW = '2026-09-30T10:00:00Z';

const trial = (id: string): AbaTrial => ({
  id,
  sessionId: 's-1',
  targetId: 't',
  exemplarId: 'e',
  index: 0,
  kind: 'teaching',
  startPromptLevel: 0,
  promptLevelUsed: 0,
  presentations: 1,
  response: 'independent',
  emittedBeforePrompt: true,
  latencyMs: 900,
  sdEndedAt: NOW,
  scoredBy: 'adult',
  tokens: 1,
});

const session = (index: number): AbaSession => ({
  id: `s-${index}`,
  index,
  startedAt: NOW,
  endedAt: NOW,
  config: 'with_adult',
  targetIds: ['t'],
  reinforcerId: 'puzzle',
  reinforcerChosenBy: 'child',
  tokensEarned: 1,
  exchangesMade: 0,
  endReason: 'completed',
  brokenTargetId: null,
  boardSize: 5,
  endedOnSuccess: true,
  events: [],
});

const result = (index: number): AbaSessionResult =>
  ({
    session: session(index),
    states: {},
    trials: [],
    board: { size: 5, earned: 2, nonContingent: 1 },
    exchanged: 0,
    tokenTraining: { pairingDone: true, pairingSessions: 2, pairingStreak: 2, stage: 5, atStage: [], flags: [] },
    identifySets: [],
  }) as AbaSessionResult;

describe('эксклюзивные транзакции', () => {
  it('откат согласия не стирает пробу, записанную в то же время', async () => {
    const db = await memoryDb();
    await appendConsentEvent(db, {
      id: 'c-late',
      scope: 'cloud_sync',
      action: 'grant',
      childId: 'kid',
      textVersion: 'ru-1',
      confirmedBy: 'pin',
      actorId: 'parent',
      at: '2026-09-30T12:00:00Z',
    });
    const early = appendConsentEvent(db, {
      id: 'c-early',
      scope: 'cloud_sync',
      action: 'revoke',
      childId: 'kid',
      textVersion: 'ru-1',
      confirmedBy: 'pin',
      actorId: 'parent',
      at: '2026-09-30T11:00:00Z',
    });
    const write = appendTrial(db, 'kid', trial('tr-1'), NOW);
    await expect(early).rejects.toThrow(/раньше последнего/);
    await write;
    expect(await trialsOfTarget(db, 'kid', 't')).toHaveLength(1);
    expect((await readConsentLog(db)).map((e) => e.id)).toEqual(['c-late']);
  });
});

describe('атомарная запись итогов', () => {
  it('итог ABA-сессии: запись сессии и номер следующей — вместе', async () => {
    const db = await memoryDb();
    await commitAbaSession(db, 'kid', result(1), NOW);
    expect(await loadChildState(db, 'kid', 'abaSessionIndex')).toBe(2);
    expect(await loadChildState(db, 'kid', 'abaSessionInProgress')).toBeNull();
    expect(await loadChildState(db, 'kid', 'abaBoard')).toEqual({ earned: 2, nonContingent: 1 });
  });

  it('сбой посреди фиксации — не записано ничего, номер сессии не сдвинут', async () => {
    const db = await memoryDb();
    await commitAbaSession(db, 'kid', result(1), NOW);
    // повтор того же номера — сессия с index 1 уже есть: фиксация падает
    await expect(commitAbaSession(db, 'kid', { ...result(1), session: { ...session(1), id: 's-dup' } }, NOW)).rejects.toThrow();
    expect(await sessionsOf(db, 'kid')).toHaveLength(1);
    expect(await loadChildState(db, 'kid', 'abaSessionIndex')).toBe(2);
  });

  it('проба и снимок сессии в работе — вместе', async () => {
    const db = await memoryDb();
    const inProgress = { sessionId: 's-1' } as AbaSessionState;
    await recordAbaTrial(db, 'kid', trial('tr-1'), inProgress, NOW);
    expect(await trialsOfTarget(db, 'kid', 't')).toHaveLength(1);
    expect(await loadChildState(db, 'kid', 'abaSessionInProgress')).toEqual(inProgress);
    // противоречивая проба не пишется — и снимок остаётся прежним
    await expect(
      recordAbaTrial(db, 'kid', { ...trial('tr-2'), response: 'independent', promptLevelUsed: 2 }, { sessionId: 'x' } as AbaSessionState, NOW),
    ).rejects.toThrow();
    expect(await loadChildState(db, 'kid', 'abaSessionInProgress')).toEqual(inProgress);
  });

  it('итог урока: прохождение, навыки, атлас и счётчик — вместе', async () => {
    const db = await memoryDb();
    const run: LessonRun = { id: 'r-1', childId: 'kid', lessonId: 'l', startedAt: NOW, taskSeconds: [5], reviewTasks: 0 };
    await commitLesson(db, 'kid', { run, skills: [emptySkill('count')], atlas: [], nextLessonNumber: 4 }, NOW);
    expect(await lessonRunsOf(db, 'kid')).toHaveLength(1);
    expect(await loadChildState(db, 'kid', 'lessonCounter')).toBe(4);
    // повтор того же прохождения — сбой, и счётчик не сдвигается
    await expect(commitLesson(db, 'kid', { run, skills: [], atlas: [], nextLessonNumber: 5 }, NOW)).rejects.toThrow();
    expect(await loadChildState(db, 'kid', 'lessonCounter')).toBe(4);
    expect(await loadChildState(db, 'kid', 'skills')).toHaveLength(1);
  });

  it('прохождение чужого ребёнка не фиксируется', async () => {
    const db = await memoryDb();
    const run: LessonRun = { id: 'r-1', childId: 'other', lessonId: 'l', startedAt: NOW, taskSeconds: [], reviewTasks: 0 };
    await expect(commitLesson(db, 'kid', { run, skills: [], atlas: [], nextLessonNumber: 1 }, NOW)).rejects.toThrow(/другого ребёнка/);
  });
});
