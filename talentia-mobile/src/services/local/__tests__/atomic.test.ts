import type { AbaIoaRecord, AbaObserver, AbaSession, AbaTargetState, AbaTrial } from '../../../types/aba';
import type { AbaSessionResult, AbaSessionState } from '../../../domain/abaSession';
import { emptySkill } from '../../../domain/mastery';
import type { LessonRun } from '../../../domain/parentReport';
import { AbaConsentRequiredError, AbaPausedError, AbaSessionMissingError, appendTrial, ioaOfSession, sessionsOf, trialsOfTarget } from '../abaLog';
import { ABA_STATE_KEYS, loadChildState, saveChildState } from '../childState';
import { commitAbaSession, commitIoa, commitLesson, recordAbaTrial, setAbaObservers, setAbaPaused } from '../commit';
import type { ConsentEvent } from '../../../domain/consent';
import { appendConsentEvent, insertConsentEvent, readConsentLog } from '../consentLog';
import { lessonRunsOf } from '../lessonRuns';
import { abaDataSummary, exportChild, exportForSpecialist, revokeAbaProcessing } from '../purge';
import { migrate } from '../schema';
import { asAbaWriter, memoryDb } from './nodeSql';
import type { SqlDb, SqlValue } from '../sql';

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
  primaryObserverId: null,
});

const result = (index: number): AbaSessionResult =>
  ({
    session: session(index),
    states: {},
    trials: [],
    board: { size: 5, earned: 2, nonContingent: 1 },
    boardRev: 0,
    exchanged: 0,
    tokenTraining: { pairingDone: true, pairingSessions: 2, pairingStreak: 2, stage: 5, atStage: [], flags: [] },
    identifySets: [],
  }) as AbaSessionResult;

/** Снимок сессии в работе: из него хранилище берёт доску и версию, с которой сессия сверялась. */
const snapshot = (over: Partial<AbaSessionState> = {}): AbaSessionState =>
  ({ sessionId: 's-1', board: { size: 5, earned: 0, nonContingent: 0 }, boardRev: 0, ...over }) as AbaSessionState;

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
    expect(await loadChildState(db, 'kid', 'abaBoard')).toEqual({ earned: 2, nonContingent: 1, rev: 1 });
  });

  it('сбой посреди фиксации — не записано ничего, номер сессии не сдвинут', async () => {
    const db = await dbWithAbaConsent();
    await commitAbaSession(db, 'kid', result(1), NOW);
    // повтор того же номера — сессия с index 1 уже есть: фиксация падает
    await expect(
      commitAbaSession(db, 'kid', { ...result(1), boardRev: 1, session: { ...session(1), id: 's-dup' } }, NOW),
    ).rejects.toThrow();
    expect(await sessionsOf(db, 'kid')).toHaveLength(1);
    expect(await loadChildState(db, 'kid', 'abaSessionIndex')).toBe(2);
  });

  it('проба и снимок сессии в работе — вместе', async () => {
    const db = await dbWithAbaConsent();
    const inProgress = snapshot();
    await recordAbaTrial(db, 'kid', trial('tr-1'), inProgress, NOW);
    expect(await trialsOfTarget(db, 'kid', 't')).toHaveLength(1);
    expect(await loadChildState(db, 'kid', 'abaSessionInProgress')).toEqual(inProgress);
    // противоречивая проба не пишется — и снимок остаётся прежним
    await expect(
      recordAbaTrial(db, 'kid', { ...trial('tr-2'), response: 'independent', promptLevelUsed: 2 }, snapshot({ sessionId: 'x' }), NOW),
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
  const inProgress = snapshot();

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
    expect(await abaDataSummary(db, 'kid')).toEqual({ sessions: 1, trials: 1, ioaRecords: 0, routineRuns: 0, reinforcerChoices: 0, observers: 0, settings: true });

    await revokeAbaProcessing(db, abaConsent('revoke', { at: '2026-09-30T11:00:00Z' }), 'owner');

    expect(await abaDataSummary(db, 'kid')).toEqual({ sessions: 0, trials: 0, ioaRecords: 0, routineRuns: 0, reinforcerChoices: 0, observers: 0, settings: false });
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
    expect(await setAbaPaused(db, 'kid', true, NOW)).toBe('no_consent');
    expect(await loadChildState(db, 'kid', 'abaPaused')).toBeUndefined();
  });

  const REVOKE_AT = '2026-09-30T11:00:00Z';

  it('пауза после отзыва не возвращает метку режима (А1)', async () => {
    const db = await dbWithAbaConsent();
    await revokeAbaProcessing(db, abaConsent('revoke', { at: REVOKE_AT }), 'owner');
    expect(await setAbaPaused(db, 'kid', true, NOW)).toBe('no_consent');
    expect(await setAbaPaused(db, 'kid', false, NOW)).toBe('no_consent');
    expect(await loadChildState(db, 'kid', 'abaPaused')).toBeUndefined();
  });

  it('после повторного согласия пауза снова работает', async () => {
    const db = await dbWithAbaConsent();
    await revokeAbaProcessing(db, abaConsent('revoke', { at: REVOKE_AT }), 'owner');
    await appendConsentEvent(db, abaConsent('grant', { at: '2026-09-30T12:00:00Z' }), 'owner');
    expect(await setAbaPaused(db, 'kid', true, NOW)).toBe('saved');
    expect(await loadChildState(db, 'kid', 'abaPaused')).toBe(true);
  });

  it('согласие на прежний текст: поставить паузу можно, снять — только после нового согласия', async () => {
    const db = await memoryDb();
    await appendConsentEvent(db, abaConsent('grant', { at: '2026-09-30T09:00:00Z', textVersion: 'ru-draft-0' }), 'owner');
    expect(await setAbaPaused(db, 'kid', true, NOW)).toBe('saved');
    expect(await setAbaPaused(db, 'kid', false, NOW)).toBe('consent_required');
    expect(await loadChildState(db, 'kid', 'abaPaused')).toBe(true);
  });

  it('отзыв у одного ребёнка не мешает паузе другого', async () => {
    const db = await dbWithAbaConsent();
    await appendConsentEvent(db, abaConsent('grant', { childId: 'sib', at: '2026-09-30T09:30:00Z' }), 'owner');
    await revokeAbaProcessing(db, abaConsent('revoke', { childId: 'sib', at: REVOKE_AT }), 'owner');
    expect(await setAbaPaused(db, 'kid', true, NOW)).toBe('saved');
    expect(await setAbaPaused(db, 'sib', true, NOW)).toBe('no_consent');
    expect(await loadChildState(db, 'kid', 'abaPaused')).toBe(true);
    expect(await loadChildState(db, 'sib', 'abaPaused')).toBeUndefined();
  });

  it('пауза, затем отзыв — метки режима не остаётся', async () => {
    const db = await dbWithAbaConsent();
    await setAbaPaused(db, 'kid', true, NOW);
    await revokeAbaProcessing(db, abaConsent('revoke', { at: REVOKE_AT }), 'owner');
    expect(await loadChildState(db, 'kid', 'abaPaused')).toBeUndefined();
  });

  /**
   * Чтение журнала согласий останавливается после ответа базы и ждёт `release`: отзыв
   * запускается ровно в окне «прочитали журнал → записали паузу». На старом
   * `setAbaPaused` (чтение мимо транзакции) отзыв проходил в этом окне, и метка оставалась.
   */
  function pauseAfterConsentRead(db: SqlDb) {
    let release!: () => void;
    let reached!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const hit = new Promise<void>((r) => (reached = r));
    let armed = true;
    const wrap = (d: SqlDb): SqlDb => ({
      run: (sql, params) => d.run(sql, params),
      exec: (sql) => d.exec(sql),
      all: async <T,>(sql: string, params?: readonly SqlValue[]) => {
        const rows = await d.all<T>(sql, params);
        if (armed && sql.startsWith('SELECT * FROM consent_events')) {
          armed = false;
          reached();
          await gate;
        }
        return rows;
      },
      transaction: (fn) => d.transaction((tx) => fn(wrap(tx))),
    });
    return { db: wrap(db), hit, release };
  }

  it('отзыв между чтением журнала и записью паузы — метки режима не остаётся', async () => {
    const db = await dbWithAbaConsent();
    const gated = pauseAfterConsentRead(db);
    const pause = setAbaPaused(gated.db, 'kid', true, NOW);
    await gated.hit;
    const revoke = revokeAbaProcessing(db, abaConsent('revoke', { at: REVOKE_AT }), 'owner');
    await new Promise((r) => setTimeout(r, 0));
    gated.release();
    await Promise.all([pause, revoke]);
    expect(await loadChildState(db, 'kid', 'abaPaused')).toBeUndefined();
    expect((await readConsentLog(db)).at(-1)).toMatchObject({ scope: 'aba_processing', action: 'revoke', childId: 'kid' });
  });
});

describe('журнал IOA и наблюдатели — условия приватности', () => {
  const ioa = (id = 'ioa-1'): AbaIoaRecord => ({
    id,
    sessionId: 's-1',
    secondaryObserverId: 'obs-2',
    source: 'paper_entry',
    enteredAt: NOW,
    items: [],
    byTarget: {},
  });
  const observers: AbaObserver[] = [{ id: 'obs-1', role: 'specialist', trained: true }];

  it('без согласия не пишется ни IOA, ни наблюдатели', async () => {
    const db = await memoryDb();
    await expect(commitIoa(db, 'kid', ioa(), {}, NOW)).rejects.toBeInstanceOf(AbaConsentRequiredError);
    await expect(setAbaObservers(db, 'kid', observers, NOW)).rejects.toBeInstanceOf(AbaConsentRequiredError);
    await expect(db.run("INSERT INTO aba_ioa (child_id, id, session_id, body, recorded_at) VALUES ('kid', 'x', 's', '{}', ?)", [NOW])).rejects.toThrow(
      /при согласии/,
    );
  });

  it('IOA и наблюдатели — в экспорте, в подсчёте перед отзывом и удаляются отзывом', async () => {
    const db = await dbWithAbaConsent();
    await commitAbaSession(db, 'kid', result(1), NOW);
    await commitIoa(db, 'kid', ioa(), {}, NOW);
    await setAbaObservers(db, 'kid', observers, NOW);
    expect(await ioaOfSession(db, 'kid', 's-1')).toHaveLength(1);
    expect((await abaDataSummary(db, 'kid')).ioaRecords).toBe(1);
    const exported = await exportChild(db, 'kid', NOW, {});
    expect([exported.abaIoa.length, exported.state.abaObservers]).toEqual([1, observers]);
    await revokeAbaProcessing(db, abaConsent('revoke', { at: '2026-09-30T11:00:00Z' }), 'owner');
    expect(await ioaOfSession(db, 'kid', 's-1')).toEqual([]);
    expect(await loadChildState(db, 'kid', 'abaObservers')).toBeUndefined();
  });

  it('запись IOA — только поля схемы; срок хранения — по дате сессии', async () => {
    const db = await dbWithAbaConsent();
    const extra = { ...ioa('i-x'), comment: 'плакал' } as unknown as AbaIoaRecord;
    await expect(commitIoa(db, 'kid', extra, {}, NOW)).rejects.toThrow(/лишнее поле/);
    await commitAbaSession(db, 'kid', { ...result(1), session: { ...session(1), id: 's-1' } }, '2026-09-30T09:30:00Z');
    await commitIoa(db, 'kid', ioa('i-2'), {}, '2026-10-05T10:00:00Z');
    const [row] = await db.all<{ recorded_at: string }>("SELECT recorded_at FROM aba_ioa WHERE id = 'i-2'");
    expect(row.recorded_at).toBe('2026-09-30T09:30:00Z');
  });

  it('IOA без сессии на устройстве — типизированный отказ, ничего не записано', async () => {
    const db = await dbWithAbaConsent();
    await expect(commitIoa(db, 'kid', ioa(), { t: {} as AbaTargetState }, NOW)).rejects.toBeInstanceOf(AbaSessionMissingError);
    expect(await ioaOfSession(db, 'kid', 's-1')).toEqual([]);
    expect(await loadChildState(db, 'kid', 'abaTargets')).toBeUndefined();
  });

  it('журнал IOA только дописывается', async () => {
    const db = await dbWithAbaConsent();
    await commitAbaSession(db, 'kid', result(1), NOW);
    await commitIoa(db, 'kid', ioa(), {}, NOW);
    await expect(db.run("UPDATE aba_ioa SET body = '{}'")).rejects.toThrow(/только дописывание/);
    await expect(db.run('DELETE FROM aba_ioa')).rejects.toThrow(/только дописывание/);
  });
});

describe('экспорт для специалиста', () => {
  it('только данные ABA, наблюдатели — метками, без uuid взрослых', async () => {
    const db = await dbWithAbaConsent();
    await setAbaObservers(db, 'kid', [{ id: 'obs-uuid-1', role: 'specialist', trained: true }, { id: 'obs-uuid-2', role: 'parent', trained: false }], NOW);
    await commitAbaSession(db, 'kid', { ...result(1), session: { ...session(1), primaryObserverId: 'obs-uuid-2' } }, NOW);
    await commitIoa(db, 'kid', { id: 'i1', sessionId: 's-1', secondaryObserverId: 'obs-uuid-1', source: 'paper_entry', enteredAt: NOW, items: [], byTarget: {} }, {}, NOW);
    const out = await exportForSpecialist(db, 'kid', NOW);
    const text = JSON.stringify(out);
    expect(text).not.toContain('obs-uuid');
    expect(out).not.toHaveProperty('profile');
    expect(out).not.toHaveProperty('consentEvents');
    expect(out.state.abaObservers).toEqual([
      { id: 'O2', role: 'specialist', trained: true },
      { id: 'O1', role: 'parent', trained: false },
    ]);
  });
});
