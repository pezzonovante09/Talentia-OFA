/**
 * №181 в хранилище: `settleTailExchange` — обмен в конце записан итогом, сцена хвоста не началась (ушли на обмене и не
 * вернулись за 2 мин, выход, убитое приложение). Жетоны обмена — обратно на живую доску с версией +1 и меткой, строка
 * хвоста дописывается с `exchangeReturned`. Только последняя записанная сессия, без живого снимка, один раз.
 */
import { CURRENT_CONSENT_TEXTS } from '../../../domain/consentTexts';
import type { AbaSession, AbaSessionTail } from '../../../types/aba';
import type { AbaSessionResult, AbaSessionState } from '../../../domain/abaSession';
import { initialTokenTraining, type TokenTrainingState } from '../../../domain/abaTokenTraining';
import type { ConsentEvent } from '../../../domain/consent';
import { AbaConsentRequiredError, AbaPausedError, sessionTailsOf } from '../abaLog';
import { childStateUpdatedAt, loadChildState, saveChildState } from '../childState';
import { commitAbaSession, commitAbaSessionTail, setAbaPaused, settleTailExchange } from '../commit';
import { appendConsentEvent } from '../consentLog';
import { exportChild, exportForSpecialist, revokeAbaProcessing } from '../purge';
import type { SqlDb } from '../sql';
import { asAbaWriter, memoryDb } from './nodeSql';

const NOW = '2026-11-06T10:00:00.000Z';
const MID = '2026-11-06T10:01:00.000Z';
const LATER = '2026-11-06T10:05:00.000Z';
const TRAINED: TokenTrainingState = { ...initialTokenTraining(), pairingDone: true, stage: 5 };
const START = '2026-11-06T07:31:15.000Z';
const at = (ms: number) => new Date(Date.parse(START) + ms).toISOString();
const END = at(600_000);

const consent = (action: 'grant' | 'revoke', at0: string): ConsentEvent => ({
  id: `aba-${action}-kid-${at0}`,
  scope: 'aba_processing',
  action,
  childId: 'kid',
  textVersion: CURRENT_CONSENT_TEXTS.aba_processing[0],
  confirmedBy: action === 'grant' ? 'biometric' : 'pin',
  actorId: 'parent',
  at: at0,
});

/** Итог с обменом в конце (`at === endedAt`): три жетона, один не за результат. */
const session = (id: string, index = 7, over: Partial<AbaSession> = {}): AbaSession => ({
  id,
  index,
  startedAt: START,
  endedAt: END,
  config: 'with_adult',
  targetIds: ['A'],
  reinforcerId: 'puzzle',
  reinforcerChosenBy: 'child',
  tokensEarned: 3,
  exchangesMade: 1,
  endReason: 'assent_withdrawn',
  brokenTargetId: null,
  boardSize: 3,
  endedOnSuccess: false,
  events: [{ kind: 'exchange', at: END, tokens: 3, nonContingent: 1 }],
  primaryObserverId: null,
  ...over,
});
const resultOf = (s: AbaSession, board = { earned: 0, nonContingent: 0 }, boardRev = 0): AbaSessionResult =>
  ({
    session: s,
    states: {},
    trials: [],
    board: { size: 3, ...board },
    boardRev,
    exchanged: 3,
    tokenTraining: TRAINED,
    identifySets: [],
    routineExchangeInWindow: false,
  }) as AbaSessionResult;

/** Строка ухода на обмене хвоста: сцена не начиналась. */
const leftOnExchange = (sessionId: string, over: Partial<AbaSessionTail> = {}): AbaSessionTail => ({
  sessionId,
  accessScene: [],
  pairingTokenAt: null,
  leftAtStep: 'exchange',
  leftAt: at(601_000),
  completed: false,
  sceneStarted: false,
  ...over,
});

async function withSession(s: AbaSession = session('s-7')): Promise<SqlDb> {
  const db = await memoryDb();
  await appendConsentEvent(db, consent('grant', '2026-11-06T09:00:00.000Z'), 'owner');
  await asAbaWriter(db, 'kid', (tx) => saveChildState(tx, 'kid', 'tokenTraining', TRAINED, NOW));
  await commitAbaSession(db, 'kid', resultOf(s), NOW);
  return db;
}
const tailBodies = async (db: SqlDb) =>
  (await db.all<{ body: string }>("SELECT body FROM aba_session_tails WHERE child_id = 'kid' ORDER BY seq")).map((r) => JSON.parse(r.body) as AbaSessionTail);
const board = (db: SqlDb) => loadChildState(db, 'kid', 'abaBoard');

describe('settleTailExchange: возврат жетонов обмена в конце (№181)', () => {
  it('последняя строка — уход на обмене: доска +жетоны и доля не за результат, версия +1, метка', async () => {
    const db = await withSession();
    await commitAbaSessionTail(db, 'kid', leftOnExchange('s-7'), NOW);
    const before = await board(db);
    expect(await settleTailExchange(db, 'kid', { at: LATER })).toBe(true);
    expect(await board(db)).toEqual({ earned: 3, nonContingent: 1, returned: { tokens: 3, fromSessionId: 's-7' }, rev: (before?.rev ?? 0) + 1 });
  });

  it('строка хвоста дописана с отметкой exchangeReturned (время — момент возврата)', async () => {
    const db = await withSession();
    await commitAbaSessionTail(db, 'kid', leftOnExchange('s-7'), NOW);
    await settleTailExchange(db, 'kid', { at: LATER });
    const rows = await tailBodies(db);
    expect([rows.length, rows[1]]).toEqual([2, { ...leftOnExchange('s-7'), exchangeReturned: { tokens: 3, nonContingent: 1, at: LATER } }]);
  });

  it('идемпотентно: второй вызов — false, доска и строки не меняются', async () => {
    const db = await withSession();
    await commitAbaSessionTail(db, 'kid', leftOnExchange('s-7'), NOW);
    await settleTailExchange(db, 'kid', { at: LATER });
    const [b, n] = [await board(db), (await tailBodies(db)).length];
    expect([await settleTailExchange(db, 'kid', { at: LATER }), await board(db), (await tailBodies(db)).length]).toEqual([false, b, n]);
  });

  it('посторонняя строка ухода после возврата — второго возврата нет', async () => {
    const db = await withSession();
    await commitAbaSessionTail(db, 'kid', leftOnExchange('s-7'), NOW);
    await settleTailExchange(db, 'kid', { at: LATER });
    await commitAbaSessionTail(db, 'kid', leftOnExchange('s-7', { leftAt: at(700_000) }), LATER);
    expect([await settleTailExchange(db, 'kid', { at: LATER }), (await board(db))?.earned]).toEqual([false, 3]);
  });

  it.each<[string, Partial<AbaSessionTail>]>([
    ['уход в доступе', { leftAtStep: 'access', sceneStarted: true }],
    ['уход на ожидании цикла', { leftAtStep: 'wait' }],
    ['уход на жетоне сопряжения', { leftAtStep: 'pairing_token' }],
    ['хвост доигран (completed)', { leftAtStep: null, leftAt: null, completed: true }],
    ['на обмене, но сцена уже началась (sceneStarted)', { sceneStarted: true }],
  ])('%s — возврата нет, доска не тронута', async (_name, over) => {
    const db = await withSession();
    await commitAbaSessionTail(db, 'kid', leftOnExchange('s-7', over), NOW);
    expect([await settleTailExchange(db, 'kid', { at: LATER }), (await board(db))?.earned ?? 0]).toEqual([false, 0]);
  });

  it('нет обмена в конце (обмен посреди сессии) — возврата нет', async () => {
    const db = await withSession(session('s-7', 7, { events: [{ kind: 'exchange', at: at(300_000), tokens: 3, nonContingent: 1 }] }));
    await commitAbaSessionTail(db, 'kid', leftOnExchange('s-7'), NOW);
    expect(await settleTailExchange(db, 'kid', { at: LATER })).toBe(false);
  });

  it('хвост предпоследней сессии — возврата нет', async () => {
    const db = await withSession();
    await commitAbaSessionTail(db, 'kid', leftOnExchange('s-7'), NOW);
    await commitAbaSession(db, 'kid', resultOf(session('s-8', 8, { events: [] })), NOW);
    expect([await settleTailExchange(db, 'kid', { at: LATER }), (await board(db))?.earned ?? 0]).toEqual([false, 0]);
  });

  it('живой снимок сессии — возврата нет', async () => {
    const db = await withSession();
    await commitAbaSessionTail(db, 'kid', leftOnExchange('s-7'), NOW);
    const snap = { sessionId: 's-8', startedAt: Date.parse(START), board: { size: 3, earned: 0, nonContingent: 0 }, boardRev: 1, observers: [], primaryObserverId: null } as unknown as AbaSessionState;
    await asAbaWriter(db, 'kid', (tx) => saveChildState(tx, 'kid', 'abaSessionInProgress', snap, NOW));
    expect([await settleTailExchange(db, 'kid', { at: LATER }), (await board(db))?.earned ?? 0]).toEqual([false, 0]);
  });

  it('на паузе — AbaPausedError без записи; после снятия паузы возврат применяется', async () => {
    const db = await withSession();
    await commitAbaSessionTail(db, 'kid', leftOnExchange('s-7'), NOW);
    await setAbaPaused(db, 'kid', true, NOW);
    await expect(settleTailExchange(db, 'kid', { at: LATER })).rejects.toBeInstanceOf(AbaPausedError);
    expect([(await board(db))?.earned ?? 0, (await tailBodies(db)).length]).toEqual([0, 1]);
    await setAbaPaused(db, 'kid', false, NOW);
    expect([await settleTailExchange(db, 'kid', { at: LATER }), (await board(db))?.earned]).toEqual([true, 3]);
  });

  it('согласие отозвано — AbaConsentRequiredError, доска не тронута', async () => {
    const db = await withSession();
    await commitAbaSessionTail(db, 'kid', leftOnExchange('s-7'), NOW);
    await revokeAbaProcessing(db, consent('revoke', '2026-11-06T09:30:00.000Z'), 'owner');
    await expect(settleTailExchange(db, 'kid', { at: LATER })).rejects.toBeInstanceOf(AbaConsentRequiredError);
    expect((await board(db))?.earned ?? 0).toBe(0);
  });

  it('гонка с рутиной: рутина положила жетоны после итога — жетоны складываются, версия от живой', async () => {
    const db = await withSession();
    await commitAbaSessionTail(db, 'kid', leftOnExchange('s-7'), NOW);
    await asAbaWriter(db, 'kid', (tx) => saveChildState(tx, 'kid', 'abaBoard', { earned: 2, nonContingent: 0, rev: 4 }, NOW));
    await settleTailExchange(db, 'kid', { at: LATER });
    expect(await board(db)).toEqual({ earned: 5, nonContingent: 1, returned: { tokens: 3, fromSessionId: 's-7' }, rev: 5 });
  });

  it('переданная строка (тёплый возврат) без строки в журнале — возврат и одна строка с отметкой', async () => {
    const db = await withSession();
    expect(await settleTailExchange(db, 'kid', { at: LATER, row: leftOnExchange('s-7') })).toBe(true);
    expect(await tailBodies(db)).toEqual([{ ...leftOnExchange('s-7'), exchangeReturned: { tokens: 3, nonContingent: 1, at: LATER } }]);
  });

  it('ступень доски выросла тем же итогом — отметка belowBoard', async () => {
    const db = await withSession(session('s-7', 7, { events: [{ kind: 'exchange', at: END, tokens: 3, nonContingent: 0 }, { kind: 'board_stage', at: END, from: 2, to: 3 }] }));
    await commitAbaSessionTail(db, 'kid', leftOnExchange('s-7'), NOW);
    await settleTailExchange(db, 'kid', { at: LATER });
    expect((await tailBodies(db)).at(-1)?.exchangeReturned).toEqual({ tokens: 3, nonContingent: 0, at: LATER, belowBoard: true });
  });

  it('быстрый возврат и падение в сцене: последняя строка — «сцена началась», возврата нет, доска не тронута', async () => {
    const db = await withSession();
    await commitAbaSessionTail(db, 'kid', leftOnExchange('s-7'), NOW);
    // форма tailOnSceneStart (sessionResume.ts): доступ хвоста начался после тёплого возврата
    await commitAbaSessionTail(db, 'kid', leftOnExchange('s-7', { leftAtStep: 'access', leftAt: null, sceneStarted: true }), MID);
    expect([await settleTailExchange(db, 'kid', { at: LATER }), (await board(db))?.earned ?? 0, (await tailBodies(db)).length]).toEqual([false, 0, 2]);
  });

  it('обмен в конце до №181 (без nonContingent) — возврата нет, доска и строки не тронуты', async () => {
    const db = await withSession(session('s-7', 7, { events: [{ kind: 'exchange', at: END, tokens: 3 }] }));
    await commitAbaSessionTail(db, 'kid', leftOnExchange('s-7'), NOW);
    expect([await settleTailExchange(db, 'kid', { at: LATER }), (await board(db))?.earned ?? 0, (await tailBodies(db)).length]).toEqual([false, 0, 1]);
  });

  it('recorded_at строки возврата — recorded_at записанной сессии, а не момент вызова', async () => {
    const db = await withSession();
    await commitAbaSessionTail(db, 'kid', leftOnExchange('s-7'), MID);
    await settleTailExchange(db, 'kid', { at: LATER });
    const [s] = await db.all<{ recorded_at: string }>("SELECT recorded_at FROM aba_sessions WHERE child_id = 'kid' AND id = 's-7'");
    const rows = await db.all<{ recorded_at: string }>("SELECT recorded_at FROM aba_session_tails WHERE child_id = 'kid' ORDER BY seq");
    expect(rows.map((r) => r.recorded_at)).toEqual([MID, s.recorded_at]);
  });

  it('updated_at доски после возврата — recorded_at записанной сессии, а не момент вызова', async () => {
    const db = await withSession();
    await commitAbaSessionTail(db, 'kid', leftOnExchange('s-7'), MID);
    await settleTailExchange(db, 'kid', { at: LATER });
    const [s] = await db.all<{ recorded_at: string }>("SELECT recorded_at FROM aba_sessions WHERE child_id = 'kid' AND id = 's-7'");
    expect([(await board(db))?.earned, await childStateUpdatedAt(db, 'kid', 'abaBoard')]).toEqual([3, s.recorded_at]);
  });

  it('sessionTailsOf отдаёт последнюю строку — с отметкой возврата', async () => {
    const db = await withSession();
    await commitAbaSessionTail(db, 'kid', leftOnExchange('s-7'), NOW);
    await settleTailExchange(db, 'kid', { at: LATER });
    expect((await sessionTailsOf(db, 'kid')).get('s-7')?.exchangeReturned).toEqual({ tokens: 3, nonContingent: 1, at: LATER });
  });
});

describe('экспорт хвоста с возвратом жетонов (№181)', () => {
  /** Уход на обмене в конце и возврат жетонов; `extra` — поле строки хвоста вне списка экспорта. */
  async function settled(extra: Record<string, unknown> = {}): Promise<SqlDb> {
    const db = await withSession();
    await commitAbaSessionTail(db, 'kid', { ...leftOnExchange('s-7'), ...extra } as AbaSessionTail, NOW);
    expect(await settleTailExchange(db, 'kid', { at: LATER })).toBe(true);
    return db;
  }
  const specialistTail = async (db: SqlDb) => ((await exportForSpecialist(db, 'kid', LATER)).abaSessions[0] as { tail: Record<string, unknown> }).tail;

  it('специалисту: хвост — поля списка, время смещением от начала сессии, exchangeReturned — факт и число', async () => {
    expect(await specialistTail(await settled())).toEqual({
      accessScene: [],
      pairingTokenAt: null,
      leftAtStep: 'exchange',
      leftAt: 601_000,
      completed: false,
      sceneStarted: false,
      exchangeReturned: { tokens: 3, nonContingent: 1 },
    });
  });

  it('специалисту: в exchangeReturned нет момента возврата (at)', async () => {
    expect((await specialistTail(await settled())).exchangeReturned).not.toHaveProperty('at');
  });

  it('специалисту: в хвосте нет sessionId', async () => {
    expect(await specialistTail(await settled())).not.toHaveProperty('sessionId');
  });

  it('специалисту: поле строки хвоста не из списка не уходит', async () => {
    const tail = await specialistTail(await settled({ deviceNote: 'x' }));
    expect(Object.keys(tail).sort()).toEqual(['accessScene', 'completed', 'exchangeReturned', 'leftAt', 'leftAtStep', 'pairingTokenAt', 'sceneStarted']);
  });

  it('специалисту: отметка belowBoard доходит', async () => {
    const db = await withSession(session('s-7', 7, { events: [{ kind: 'exchange', at: END, tokens: 3, nonContingent: 0 }, { kind: 'board_stage', at: END, from: 2, to: 3 }] }));
    await commitAbaSessionTail(db, 'kid', leftOnExchange('s-7'), NOW);
    await settleTailExchange(db, 'kid', { at: LATER });
    expect((await specialistTail(db)).exchangeReturned).toEqual({ tokens: 3, nonContingent: 0, belowBoard: true });
  });

  it('родителю: строка хвоста целиком, exchangeReturned с моментом возврата', async () => {
    const exp = await exportChild(await settled(), 'kid', LATER, {});
    expect((exp.abaSessionTails.at(-1) as AbaSessionTail).exchangeReturned).toEqual({ tokens: 3, nonContingent: 1, at: LATER });
  });
});
