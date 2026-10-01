import type { AbaSession, AbaTrial } from '../../../types/aba';
import type { AbaSessionResult, AbaSessionState } from '../../../domain/abaSession';
import { emptySkill } from '../../../domain/mastery';
import type { LessonRun } from '../../../domain/parentReport';
import { AbaConsentRequiredError, AbaPausedError, appendTrial, sessionsOf, trialsOfTarget } from '../abaLog';
import { ABA_STATE_KEYS, loadChildState, saveChildState } from '../childState';
import { commitAbaSession, commitLesson, recordAbaTrial, setAbaPaused } from '../commit';
import type { ConsentEvent } from '../../../domain/consent';
import { appendConsentEvent, insertConsentEvent, readConsentLog } from '../consentLog';
import { lessonRunsOf } from '../lessonRuns';
import { abaDataSummary, revokeAbaProcessing } from '../purge';
import { migrate } from '../schema';
import { asAbaWriter, memoryDb } from './nodeSql';

const NOW = '2026-09-30T10:00:00Z';
/** Текущая версия текста согласия на ABA — из `consentTexts.ts`. */
const ABA_TEXT = 'ru-draft-1';

const abaConsent = (action: 'grant' | 'revoke', over: Partial<ConsentEvent> = {}): ConsentEvent => ({
  id: `aba-${action}-${over.at ?? NOW}`,
  scope: 'aba_processing',
  action,
  childId: 'kid',
  textVersion: ABA_TEXT,
  confirmedBy: 'biometric',
  actorId: 'parent',
  at: NOW,
  ...over,
});

/** База с согласием на данные ABA у `kid` — без него пробы не пишутся. */
async function dbWithAbaConsent() {
  const db = await memoryDb();
  await appendConsentEvent(db, abaConsent('grant', { at: '2026-09-30T09:00:00Z' }), 'owner');
  return db;
}

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
  latencyFromFirstSdMs: 900,
  latencySource: 'adult_press',
  promptDelayMs: 3000,
  responseWindowMs: 5000,
  presentationLog: [],
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
    }, 'owner');
    // выдача раньше последнего события отклоняется — её транзакция откатывается
    const early = appendConsentEvent(db, {
      id: 'c-early',
      scope: 'companion_ai',
      action: 'grant',
      childId: 'kid',
      textVersion: 'ru-1',
      confirmedBy: 'pin',
      actorId: 'parent',
      at: '2026-09-30T11:00:00Z',
    }, 'owner');
    const write = asAbaWriter(db, 'kid', (tx) => appendTrial(tx, 'kid', trial('tr-1'), NOW));
    await expect(early).rejects.toThrow(/раньше последнего/);
    await write;
    expect(await trialsOfTarget(db, 'kid', 't')).toHaveLength(1);
    expect((await readConsentLog(db)).map((e) => e.id)).toEqual(['c-late']);
  });
});

describe('атомарная запись итогов', () => {
  it('итог ABA-сессии: запись сессии и номер следующей — вместе', async () => {
    const db = await dbWithAbaConsent();
    await commitAbaSession(db, 'kid', result(1), NOW);
    expect(await loadChildState(db, 'kid', 'abaSessionIndex')).toBe(2);
    expect(await loadChildState(db, 'kid', 'abaSessionInProgress')).toBeNull();
    expect(await loadChildState(db, 'kid', 'abaBoard')).toEqual({ earned: 2, nonContingent: 1 });
  });

  it('сбой посреди фиксации — не записано ничего, номер сессии не сдвинут', async () => {
    const db = await dbWithAbaConsent();
    await commitAbaSession(db, 'kid', result(1), NOW);
    // повтор того же номера — сессия с index 1 уже есть: фиксация падает
    await expect(
      commitAbaSession(db, 'kid', { ...result(1), session: { ...session(1), id: 's-dup' } }, NOW),
    ).rejects.toThrow();
    expect(await sessionsOf(db, 'kid')).toHaveLength(1);
    expect(await loadChildState(db, 'kid', 'abaSessionIndex')).toBe(2);
  });

  it('проба и снимок сессии в работе — вместе', async () => {
    const db = await dbWithAbaConsent();
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

describe('согласие на данные ABA', () => {
  const inProgress = { sessionId: 's-1' } as AbaSessionState;

  it('без согласия не пишется ни проба, ни снимок, ни итог сессии', async () => {
    const db = await memoryDb();
    await expect(recordAbaTrial(db, 'kid', trial('tr-1'), inProgress, NOW)).rejects.toBeInstanceOf(AbaConsentRequiredError);
    await expect(commitAbaSession(db, 'kid', result(1), NOW)).rejects.toBeInstanceOf(AbaConsentRequiredError);
    expect(await trialsOfTarget(db, 'kid', 't')).toEqual([]);
    expect(await sessionsOf(db, 'kid')).toEqual([]);
    expect(await loadChildState(db, 'kid', 'abaSessionInProgress')).toBeUndefined();
  });

  it('согласие на прежний текст и согласие на другого ребёнка не действуют', async () => {
    const db = await memoryDb();
    await appendConsentEvent(db, abaConsent('grant', { textVersion: 'ru-old', at: '2026-09-30T09:00:00Z' }), 'owner');
    await expect(recordAbaTrial(db, 'kid', trial('tr-1'), inProgress, NOW)).rejects.toBeInstanceOf(AbaConsentRequiredError);
    await appendConsentEvent(db, abaConsent('grant', { childId: 'sib', at: '2026-09-30T09:01:00Z' }), 'owner');
    await expect(recordAbaTrial(db, 'kid', trial('tr-2'), inProgress, NOW)).rejects.toBeInstanceOf(AbaConsentRequiredError);
  });

  it('согласие на другом языке действует: смена языка режим не блокирует', async () => {
    const db = await memoryDb();
    await appendConsentEvent(db, abaConsent('grant', { textVersion: 'ky-draft-1', at: '2026-09-30T09:00:00Z' }), 'owner');
    await recordAbaTrial(db, 'kid', trial('tr-1'), inProgress, NOW);
    expect(await trialsOfTarget(db, 'kid', 't')).toHaveLength(1);
  });

  it('согласие на ABA даёт только владелец — второй родитель на своём устройстве не включит запись', async () => {
    const db = await memoryDb();
    await expect(appendConsentEvent(db, abaConsent('grant'), 'guardian')).rejects.toThrow(/роль/);
    await expect(appendConsentEvent(db, abaConsent('grant'), 'specialist')).rejects.toThrow(/роль/);
    await expect(recordAbaTrial(db, 'kid', trial('tr-1'), inProgress, NOW)).rejects.toBeInstanceOf(AbaConsentRequiredError);
  });

  it('в обход commit.ts база не пускает ни пробу, ни сессию, ни состояние ABA', async () => {
    const db = await dbWithAbaConsent();
    await expect(appendTrial(db, 'kid', trial('tr-1'), NOW)).rejects.toThrow(/при согласии/);
    await expect(saveChildState(db, 'kid', 'abaSessionIndex', 7, NOW)).rejects.toThrow(/при согласии/);
    // не-ABA состояние пишется как раньше
    await saveChildState(db, 'kid', 'lessonCounter', 3, NOW);
  });

  it('пауза: не пишется ничего, данные и согласие остаются, после снятия — снова пишется', async () => {
    const db = await dbWithAbaConsent();
    await recordAbaTrial(db, 'kid', trial('tr-1'), inProgress, NOW);
    await setAbaPaused(db, 'kid', true, NOW);
    await expect(recordAbaTrial(db, 'kid', trial('tr-2'), inProgress, NOW)).rejects.toBeInstanceOf(AbaPausedError);
    await expect(commitAbaSession(db, 'kid', result(1), NOW)).rejects.toBeInstanceOf(AbaPausedError);
    expect(await trialsOfTarget(db, 'kid', 't')).toHaveLength(1);
    await setAbaPaused(db, 'kid', false, NOW);
    await recordAbaTrial(db, 'kid', trial('tr-3'), inProgress, NOW);
    expect(await trialsOfTarget(db, 'kid', 't')).toHaveLength(2);
  });

  it('отзыв удаляет пробы, сессии, состояние и паузу ABA ребёнка — уроки, навыки и чужое остаются', async () => {
    const db = await dbWithAbaConsent();
    await appendConsentEvent(db, abaConsent('grant', { childId: 'sib', at: '2026-09-30T09:30:00Z' }), 'owner');
    await recordAbaTrial(db, 'kid', trial('tr-1'), inProgress, NOW);
    await commitAbaSession(db, 'kid', result(1), NOW);
    await setAbaPaused(db, 'kid', true, NOW);
    await recordAbaTrial(db, 'sib', trial('tr-sib'), inProgress, NOW);
    const run: LessonRun = { id: 'r-1', childId: 'kid', lessonId: 'l', startedAt: NOW, taskSeconds: [5], reviewTasks: 0 };
    await commitLesson(db, 'kid', { run, skills: [emptySkill('count')], atlas: [], nextLessonNumber: 2 }, NOW);
    expect(await abaDataSummary(db, 'kid')).toEqual({ sessions: 1, trials: 1 });

    await revokeAbaProcessing(db, abaConsent('revoke', { at: '2026-09-30T11:00:00Z' }), 'owner');

    expect(await abaDataSummary(db, 'kid')).toEqual({ sessions: 0, trials: 0 });
    for (const key of [
      'abaTargets',
      'abaBoard',
      'tokenTraining',
      'identifySets',
      'abaSessionIndex',
      'abaSessionInProgress',
      'abaPaused',
    ] as const) {
      expect(await loadChildState(db, 'kid', key)).toBeUndefined();
    }
    expect(await lessonRunsOf(db, 'kid')).toHaveLength(1);
    expect(await loadChildState(db, 'kid', 'skills')).toHaveLength(1);
    expect(await trialsOfTarget(db, 'sib', 't')).toHaveLength(1);
    expect((await readConsentLog(db)).at(-1)).toMatchObject({ scope: 'aba_processing', action: 'revoke', childId: 'kid' });
    await expect(recordAbaTrial(db, 'kid', trial('tr-9'), inProgress, NOW)).rejects.toBeInstanceOf(AbaConsentRequiredError);
  });

  it('отзыв при сбитых часах не отклоняется: встаёт за последним событием и удаляет', async () => {
    const db = await dbWithAbaConsent();
    await recordAbaTrial(db, 'kid', trial('tr-1'), inProgress, NOW);
    await revokeAbaProcessing(db, abaConsent('revoke', { at: '2026-09-30T08:00:00Z' }), 'owner');
    expect(await trialsOfTarget(db, 'kid', 't')).toEqual([]);
    expect((await readConsentLog(db)).at(-1)).toMatchObject({ action: 'revoke', at: '2026-09-30T09:00:00Z' });
  });

  it('отзыв обычным путём, без удаления, и отзыв чужой ролью не принимаются — данные на месте', async () => {
    const db = await dbWithAbaConsent();
    await recordAbaTrial(db, 'kid', trial('tr-1'), inProgress, NOW);
    await expect(appendConsentEvent(db, abaConsent('revoke', { at: '2026-09-30T12:00:00Z' }), 'owner')).rejects.toThrow(
      /revokeAbaProcessing/,
    );
    await expect(revokeAbaProcessing(db, abaConsent('revoke', { at: '2026-09-30T12:00:00Z' }), 'guardian')).rejects.toThrow(
      /роль/,
    );
    await expect(revokeAbaProcessing(db, abaConsent('grant', { at: '2026-09-30T12:00:00Z' }), 'owner')).rejects.toThrow(/отзыв/);
    expect(await trialsOfTarget(db, 'kid', 't')).toHaveLength(1);
  });

  it('отзыв и проба одновременно: проба или записана до отзыва и удалена, или отклонена', async () => {
    const db = await dbWithAbaConsent();
    const revoke = revokeAbaProcessing(db, abaConsent('revoke', { at: '2026-09-30T11:00:00Z' }), 'owner');
    const write = recordAbaTrial(db, 'kid', trial('tr-1'), inProgress, NOW);
    await revoke;
    await write.catch((e) => expect(e).toBeInstanceOf(AbaConsentRequiredError));
    expect(await trialsOfTarget(db, 'kid', 't')).toEqual([]);
  });

  it('ни один ключ состояния ABA не пишется в обход согласия', async () => {
    const db = await dbWithAbaConsent();
    for (const key of ABA_STATE_KEYS) {
      await expect(saveChildState(db, 'kid', key, null as never, NOW)).rejects.toThrow(/при согласии/);
    }
  });

  it('отзыв ABA мимо удаления база не примет, даже в обход appendConsentEvent', async () => {
    const db = await dbWithAbaConsent();
    await recordAbaTrial(db, 'kid', trial('tr-1'), inProgress, NOW);
    await expect(
      db.transaction((tx) => insertConsentEvent(tx, abaConsent('revoke', { at: '2026-09-30T12:00:00Z' }), 'owner')),
    ).rejects.toThrow(/вместе с удалением/);
    expect(await trialsOfTarget(db, 'kid', 't')).toHaveLength(1);
  });

  it('забытые ворота закрываются при открытии базы', async () => {
    const db = await dbWithAbaConsent();
    await db.run('INSERT INTO aba_write_gate (child_id) VALUES (?)', ['kid']);
    await migrate(db);
    await expect(appendTrial(db, 'kid', trial('tr-1'), NOW)).rejects.toThrow(/при согласии/);
  });

  it('пауза у ребёнка, которому согласие не давали, не создаёт метку режима', async () => {
    const db = await memoryDb();
    await setAbaPaused(db, 'kid', true, NOW);
    expect(await loadChildState(db, 'kid', 'abaPaused')).toBeUndefined();
  });
});
