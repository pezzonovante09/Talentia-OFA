/**
 * Хвост конца сессии в хранилище (фаза 8, №172 п. 2): `commitAbaSessionTail` — согласие и пауза, нет итога сессии,
 * идемпотентность только по одинаковому телу (строк на сессию может быть несколько: уход, затем доигранный возврат;
 * действует последняя по `seq`), отзыв и удаление, экспорт родителю и специалисту, сводка перед отзывом. И
 * идемпотентность `commitAbaSession` по id сессии: повтор после успеха не трогает ни журнал, ни снимок следующей сессии
 * и не падает на версии доски.
 */
import { CURRENT_CONSENT_TEXTS } from '../../../domain/consentTexts';
import type { AbaSession, AbaSessionTail } from '../../../types/aba';
import type { AbaSessionResult, AbaSessionState } from '../../../domain/abaSession';
import { initialTokenTraining, type TokenTrainingState } from '../../../domain/abaTokenTraining';
import type { ConsentEvent } from '../../../domain/consent';
import { AbaConsentRequiredError, AbaPausedError, AbaSessionMissingError, sessionsOf, sessionTailsOf } from '../abaLog';
import { loadChildState, saveChildState } from '../childState';
import { commitAbaSession, commitAbaSessionTail, setAbaPaused } from '../commit';
import { appendConsentEvent, readConsentLog } from '../consentLog';
import { abaDataSummary, clearChildProgress, exportChild, exportForSpecialist, purgeChild, revokeAbaProcessing, wipeDevice } from '../purge';
import type { SqlDb } from '../sql';
import { asAbaWriter, memoryDb } from './nodeSql';

const NOW = '2026-11-06T10:00:00.000Z';
const PSEUDONYM = '9f1c2b3a-4d5e-4f60-8a7b-1c2d3e4f5a6b';
const TRAINED: TokenTrainingState = { ...initialTokenTraining(), pairingDone: true, stage: 5 };

const consent = (action: 'grant' | 'revoke', childId = 'kid', at = '2026-11-06T09:00:00.000Z'): ConsentEvent => ({
  id: `aba-${action}-${childId}-${at}`,
  scope: 'aba_processing',
  action,
  childId,
  textVersion: CURRENT_CONSENT_TEXTS.aba_processing[0],
  confirmedBy: action === 'grant' ? 'biometric' : 'pin',
  actorId: 'parent',
  at,
});

/** База с согласием на ABA и обучением доске у переданных детей. */
async function dbWithConsent(...kids: string[]): Promise<SqlDb> {
  const db = await memoryDb();
  for (const [i, kid] of kids.entries()) {
    await appendConsentEvent(db, consent('grant', kid, `2026-11-06T09:0${i}:00.000Z`), 'owner');
    await asAbaWriter(db, kid, (tx) => saveChildState(tx, kid, 'tokenTraining', TRAINED, NOW));
  }
  return db;
}

// --- сессия и её хвост -------------------------------------------------------------------------

const START = '2026-11-06T07:31:15.000Z';
const at = (ms: number) => new Date(Date.parse(START) + ms).toISOString();
const session = (id: string, index = 7): AbaSession => ({
  id,
  index,
  startedAt: START,
  endedAt: at(600_000),
  config: 'with_adult',
  targetIds: ['A'],
  reinforcerId: 'puzzle',
  reinforcerChosenBy: 'child',
  tokensEarned: 1,
  exchangesMade: 1,
  endReason: 'completed',
  brokenTargetId: null,
  boardSize: 5,
  endedOnSuccess: true,
  events: [
    { kind: 'exchange', at: at(590_000), tokens: 1 },
    { kind: 'access', startedAt: at(591_000), endedAt: at(621_000) },
  ],
  primaryObserverId: null,
});
const resultOf = (s: AbaSession, boardRev = 0): AbaSessionResult =>
  ({
    session: s,
    states: {},
    trials: [],
    board: { size: 5, earned: 0, nonContingent: 0 },
    boardRev,
    exchanged: 1,
    tokenTraining: TRAINED,
    identifySets: [],
    routineExchangeInWindow: false,
  }) as AbaSessionResult;

/** Хвост: сцена доступа прошла двумя отрезками (уход и возврат), доиграна до «Закончили». */
const tail = (sessionId: string, over: Partial<AbaSessionTail> = {}): AbaSessionTail => ({
  sessionId,
  accessScene: [
    { startedAt: at(591_000), endedAt: at(605_000) },
    { startedAt: at(640_000), endedAt: at(656_000) },
  ],
  pairingTokenAt: null,
  leftAtStep: 'access',
  leftAt: at(605_000),
  completed: true,
  ...over,
});
const snapOf = (sessionId: string) =>
  ({ sessionId, startedAt: Date.parse(START), board: { size: 5, earned: 0, nonContingent: 0 }, boardRev: 0, observers: [], primaryObserverId: null }) as unknown as AbaSessionState;

const tailRows = async (db: SqlDb, childId = 'kid') =>
  db.all<{ session_id: string; body: string; recorded_at: string }>('SELECT session_id, body, recorded_at FROM aba_session_tails WHERE child_id = ? ORDER BY seq', [childId]);
const countOf = async (db: SqlDb, table: string, childId: string) =>
  (await db.all<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table} WHERE child_id = ?`, [childId]))[0].n;

/** База с согласием и записанным итогом сессии `s-7`. */
async function withSession(): Promise<SqlDb> {
  const db = await dbWithConsent('kid');
  await commitAbaSession(db, 'kid', resultOf(session('s-7')), NOW);
  return db;
}

/** Все строки внутри значения. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}
/** Все числа внутри значения. */
function numbers(value: unknown): number[] {
  if (typeof value === 'number') return [value];
  if (Array.isArray(value)) return value.flatMap(numbers);
  if (value && typeof value === 'object') return Object.values(value).flatMap(numbers);
  return [];
}

// --- 1. согласие, пауза, нет итога ------------------------------------------------------------

describe('хвост сессии: согласие и предпосылки', () => {
  it('без согласия на ABA — AbaConsentRequiredError, строки нет', async () => {
    const db = await memoryDb();
    await expect(commitAbaSessionTail(db, 'kid', tail('s-7'), NOW)).rejects.toBeInstanceOf(AbaConsentRequiredError);
    expect(await tailRows(db)).toEqual([]);
  });

  it('согласие у другого ребёнка не считается: у kid строки нет', async () => {
    const db = await dbWithConsent('sib');
    await commitAbaSession(db, 'sib', resultOf(session('s-7')), NOW);
    await expect(commitAbaSessionTail(db, 'kid', tail('s-7'), NOW)).rejects.toBeInstanceOf(AbaConsentRequiredError);
    expect(await tailRows(db, 'kid')).toEqual([]);
    expect(await tailRows(db, 'sib')).toEqual([]);
  });

  it('на паузе — AbaPausedError, строки нет; после снятия паузы пишется', async () => {
    const db = await withSession();
    await setAbaPaused(db, 'kid', true, NOW);
    await expect(commitAbaSessionTail(db, 'kid', tail('s-7'), NOW)).rejects.toBeInstanceOf(AbaPausedError);
    expect(await tailRows(db)).toEqual([]);
    await setAbaPaused(db, 'kid', false, NOW);
    await commitAbaSessionTail(db, 'kid', tail('s-7'), NOW);
    expect(await tailRows(db)).toHaveLength(1);
  });

  it('сессии нет в aba_sessions — AbaSessionMissingError с id сессии, строки нет', async () => {
    const db = await dbWithConsent('kid');
    const err = await commitAbaSessionTail(db, 'kid', tail('s-7'), NOW).then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(AbaSessionMissingError);
    expect((err as AbaSessionMissingError).sessionId).toBe('s-7');
    expect(await tailRows(db)).toEqual([]);
  });

  it('сессия записана у другого ребёнка — для этого её нет: AbaSessionMissingError, строки нет', async () => {
    const db = await dbWithConsent('kid', 'sib');
    await commitAbaSession(db, 'sib', resultOf(session('s-7')), NOW);
    await expect(commitAbaSessionTail(db, 'kid', tail('s-7'), NOW)).rejects.toBeInstanceOf(AbaSessionMissingError);
    expect(await tailRows(db, 'kid')).toEqual([]);
    expect(await tailRows(db, 'sib')).toEqual([]);
  });

  it('свёрнутая, ещё не записанная сессия (только снимок) — тоже AbaSessionMissingError', async () => {
    const db = await dbWithConsent('kid');
    await asAbaWriter(db, 'kid', (tx) => saveChildState(tx, 'kid', 'abaSessionInProgress', snapOf('s-9'), NOW));
    await expect(commitAbaSessionTail(db, 'kid', tail('s-9'), NOW)).rejects.toBeInstanceOf(AbaSessionMissingError);
    expect(await tailRows(db)).toEqual([]);
  });
});

// --- 2. запись и идемпотентность ---------------------------------------------------------------

describe('хвост сессии: запись', () => {
  it('после commitAbaSession хвост пишется: тело как есть, recorded_at — момент записи', async () => {
    const db = await withSession();
    await commitAbaSessionTail(db, 'kid', tail('s-7'), '2026-11-06T10:15:00Z');
    expect(await tailRows(db)).toEqual([{ session_id: 's-7', body: JSON.stringify(tail('s-7')), recorded_at: '2026-11-06T10:15:00.000Z' }]);
    expect(await sessionTailsOf(db, 'kid')).toEqual(new Map([['s-7', tail('s-7')]]));
  });

  describe('уход, затем доигранный возврат: несколько строк на сессию', () => {
    /** Строка ухода: сцена прервана, хвост не доигран. */
    const left = tail('s-7', { accessScene: [{ startedAt: at(591_000), endedAt: at(605_000) }], completed: false });
    /** Строка итога: возврат до 2 минут доиграл доступ. */
    const done = tail('s-7');
    async function leftThenDone() {
      const db = await withSession();
      await commitAbaSessionTail(db, 'kid', left, NOW);
      await commitAbaSessionTail(db, 'kid', done, '2026-11-06T10:20:00.000Z');
      return db;
    }

    it('одно тело дважды — одна строка, момент записи первый: повтор не дописывает', async () => {
      const db = await withSession();
      await commitAbaSessionTail(db, 'kid', left, NOW);
      await commitAbaSessionTail(db, 'kid', left, '2026-11-06T10:20:00.000Z');
      expect((await tailRows(db)).map((r) => [JSON.parse(r.body), r.recorded_at])).toEqual([[left, NOW]]);
    });

    it('другое тело — вторая строка: обе в журнале по порядку записи', async () => {
      const db = await leftThenDone();
      expect((await tailRows(db)).map((r) => [JSON.parse(r.body), r.recorded_at])).toEqual([
        [left, NOW],
        [done, '2026-11-06T10:20:00.000Z'],
      ]);
    });

    it('sessionTailsOf берёт последнюю строку сессии', async () => {
      const db = await leftThenDone();
      expect(await sessionTailsOf(db, 'kid')).toEqual(new Map([['s-7', done]]));
    });

    it('последняя — по порядку записи, а не по моменту ухода и не по completed: вторая строка «ушли» заменяет первую', async () => {
      const db = await withSession();
      const again = tail('s-7', { completed: false, leftAt: at(640_000) });
      await commitAbaSessionTail(db, 'kid', done, NOW);
      await commitAbaSessionTail(db, 'kid', again, '2026-11-06T10:20:00.000Z');
      expect((await sessionTailsOf(db, 'kid')).get('s-7')).toEqual(again);
    });

    it('exportForSpecialist берёт последнюю строку: в файле доигранный хвост, а не строка ухода', async () => {
      const db = await leftThenDone();
      const out = (await exportForSpecialist(db, 'kid', NOW)).abaSessions as { id: string; tail: { completed: boolean; accessScene: unknown[] } }[];
      expect(out).toHaveLength(1);
      expect(out[0].tail.completed).toBe(true);
      expect(out[0].tail.accessScene).toHaveLength(2);
    });

    it('exportChild содержит обе строки: родителю отдаётся весь журнал, без слияния', async () => {
      const db = await leftThenDone();
      expect((await exportChild(db, 'kid', NOW, {})).abaSessionTails).toEqual([left, done]);
    });

    it('строка другой сессии не сбивает выбор последней', async () => {
      const db = await leftThenDone();
      await commitAbaSession(db, 'kid', resultOf(session('s-8', 8)), NOW);
      await commitAbaSessionTail(db, 'kid', tail('s-8', { completed: false }), '2026-11-06T10:30:00.000Z');
      const tails = await sessionTailsOf(db, 'kid');
      expect([tails.get('s-7')?.completed, tails.get('s-8')?.completed]).toEqual([true, false]);
    });

    it('отзыв согласия удаляет все строки сессии, а не только последнюю', async () => {
      const db = await leftThenDone();
      await revokeAbaProcessing(db, consent('revoke', 'kid', '2026-11-06T12:00:00.000Z'), 'owner');
      expect(await tailRows(db)).toEqual([]);
    });
  });

  it('хвост «ушли и не вернулись»: completed false, leftAtStep и leftAt сохраняются, пустая сцена — пустой массив', async () => {
    const db = await withSession();
    const left = tail('s-7', { accessScene: [], leftAtStep: 'exchange', leftAt: at(590_500), completed: false });
    await commitAbaSessionTail(db, 'kid', left, NOW);
    expect((await sessionTailsOf(db, 'kid')).get('s-7')).toEqual(left);
  });

  it('хвосты двух сессий одного ребёнка — две строки, по одной на сессию', async () => {
    const db = await withSession();
    await commitAbaSession(db, 'kid', resultOf(session('s-8', 8)), NOW);
    await commitAbaSessionTail(db, 'kid', tail('s-7'), NOW);
    await commitAbaSessionTail(db, 'kid', tail('s-8', { pairingTokenAt: at(595_000) }), NOW);
    expect((await tailRows(db)).map((r) => r.session_id)).toEqual(['s-7', 's-8']);
    expect((await sessionTailsOf(db, 'kid')).get('s-8')?.pairingTokenAt).toBe(at(595_000));
  });

  it('хвост не трогает снимок следующей сессии и доску', async () => {
    const db = await withSession();
    await asAbaWriter(db, 'kid', async (tx) => {
      await saveChildState(tx, 'kid', 'abaSessionInProgress', snapOf('s-8'), NOW);
      await saveChildState(tx, 'kid', 'abaBoard', { earned: 2, nonContingent: 0, rev: 4 }, NOW);
    });
    await commitAbaSessionTail(db, 'kid', tail('s-7'), NOW);
    expect(await loadChildState(db, 'kid', 'abaSessionInProgress')).toEqual(snapOf('s-8'));
    expect(await loadChildState(db, 'kid', 'abaBoard')).toEqual({ earned: 2, nonContingent: 0, rev: 4 });
  });
});

// --- 3. отзыв, удаление, сводка ---------------------------------------------------------------

describe('хвост сессии: отзыв, удаление, сводка', () => {
  async function withTail(): Promise<SqlDb> {
    const db = await withSession();
    await commitAbaSessionTail(db, 'kid', tail('s-7'), NOW);
    expect(await tailRows(db)).toHaveLength(1); // предпосылка
    return db;
  }

  it('abaDataSummary.sessionTails считает хвосты: 0 без хвоста, 1 с хвостом, чужой не считается', async () => {
    const db = await withSession();
    expect((await abaDataSummary(db, 'kid')).sessionTails).toBe(0);
    await commitAbaSessionTail(db, 'kid', tail('s-7'), NOW);
    expect(await abaDataSummary(db, 'kid')).toMatchObject({ sessions: 1, sessionTails: 1 });
    expect((await abaDataSummary(db, 'sib')).sessionTails).toBe(0);
  });

  it('revokeAbaProcessing при хвосте проходит и удаляет его вместе с сессией; отзыв записан', async () => {
    const db = await withTail();
    await revokeAbaProcessing(db, consent('revoke', 'kid', '2026-11-06T12:00:00.000Z'), 'owner');
    expect(await tailRows(db)).toEqual([]);
    expect(await sessionsOf(db, 'kid')).toEqual([]);
    expect((await readConsentLog(db)).at(-1)).toMatchObject({ scope: 'aba_processing', action: 'revoke', childId: 'kid' });
    expect((await abaDataSummary(db, 'kid')).sessionTails).toBe(0);
  });

  it('отзыв у одного ребёнка не трогает хвост другого', async () => {
    const db = await dbWithConsent('kid', 'sib');
    for (const [kid, id] of [['kid', 's-7'], ['sib', 's-7s']] as const) {
      await commitAbaSession(db, kid, resultOf(session(id)), NOW);
      await commitAbaSessionTail(db, kid, tail(id), NOW);
    }
    await revokeAbaProcessing(db, consent('revoke', 'kid', '2026-11-06T12:00:00.000Z'), 'owner');
    expect(await tailRows(db, 'kid')).toEqual([]);
    expect(await tailRows(db, 'sib')).toHaveLength(1);
  });

  it('purgeChild удаляет хвосты ребёнка', async () => {
    const db = await withTail();
    await purgeChild(db, 'kid', PSEUDONYM);
    expect(await countOf(db, 'aba_session_tails', 'kid')).toBe(0);
    expect(await countOf(db, 'aba_sessions', 'kid')).toBe(0);
  });

  it('clearChildProgress удаляет хвосты, согласие остаётся', async () => {
    const db = await withTail();
    await clearChildProgress(db, 'kid');
    expect(await countOf(db, 'aba_session_tails', 'kid')).toBe(0);
    expect(await countOf(db, 'consent_events', 'kid')).toBe(1);
  });

  it('wipeDevice удаляет все хвосты', async () => {
    const db = await withTail();
    await wipeDevice(db);
    expect(await db.all('SELECT 1 FROM aba_session_tails')).toEqual([]);
  });
});

// --- 4. экспорт --------------------------------------------------------------------------------

describe('хвост сессии: экспорт', () => {
  it('exportChild содержит abaSessionTails как есть — только этого ребёнка', async () => {
    const db = await dbWithConsent('kid', 'sib');
    await commitAbaSession(db, 'kid', resultOf(session('s-7')), NOW);
    await commitAbaSession(db, 'sib', resultOf(session('s-7s')), NOW);
    await commitAbaSessionTail(db, 'kid', tail('s-7'), NOW);
    await commitAbaSessionTail(db, 'sib', tail('s-7s', { completed: false }), NOW);
    const out = await exportChild(db, 'kid', NOW, {});
    expect(out.abaSessionTails).toEqual([tail('s-7')]);
    expect((await exportChild(db, 'sib', NOW, {})).abaSessionTails).toEqual([tail('s-7s', { completed: false })]);
  });

  it('exportChild без хвоста — пустой массив, а не отсутствие поля', async () => {
    const db = await withSession();
    expect((await exportChild(db, 'kid', NOW, {})).abaSessionTails).toEqual([]);
  });

  it('exportForSpecialist: у сессии с хвостом tail со смещениями в мс от начала сессии, без sessionId', async () => {
    const db = await withSession();
    await commitAbaSessionTail(db, 'kid', tail('s-7'), NOW);
    const [s] = (await exportForSpecialist(db, 'kid', NOW)).abaSessions as { id: string; tail: Record<string, unknown> }[];
    expect(s.id).toBe('s-7');
    expect(s.tail).toEqual({
      accessScene: [
        { startedAt: 591_000, endedAt: 605_000 },
        { startedAt: 640_000, endedAt: 656_000 },
      ],
      pairingTokenAt: null,
      leftAtStep: 'access',
      leftAt: 605_000,
      completed: true,
    });
  });

  it('exportForSpecialist: в хвосте нет ISO-строк, времени суток и абсолютных миллисекунд эпохи', async () => {
    const db = await withSession();
    await commitAbaSessionTail(db, 'kid', tail('s-7', { pairingTokenAt: at(595_000) }), NOW);
    const [s] = (await exportForSpecialist(db, 'kid', NOW)).abaSessions as { tail: unknown }[];
    expect(strings(s.tail).filter((v) => /\d{4}-\d{2}-\d{2}|\d{2}:\d{2}/.test(v))).toEqual([]);
    expect(numbers(s.tail).filter((n) => Math.abs(n) > 1e11)).toEqual([]);
    expect(JSON.stringify(s.tail)).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}|\d{2}:\d{2}/);
  });

  it('exportForSpecialist: у сессии без хвоста tail === null (неизвестно, не «выдано»)', async () => {
    const db = await withSession();
    await commitAbaSession(db, 'kid', resultOf(session('s-8', 8)), NOW);
    await commitAbaSessionTail(db, 'kid', tail('s-8'), NOW);
    const out = (await exportForSpecialist(db, 'kid', NOW)).abaSessions as { id: string; tail: unknown }[];
    expect(out.map((s) => [s.id, s.tail === null])).toEqual([
      ['s-7', true],
      ['s-8', false],
    ]);
  });

  it('exportForSpecialist: хвост чужого ребёнка не попадает в файл', async () => {
    const db = await dbWithConsent('kid', 'sib');
    await commitAbaSession(db, 'kid', resultOf(session('s-7')), NOW);
    await commitAbaSession(db, 'sib', resultOf(session('s-7s')), NOW);
    await commitAbaSessionTail(db, 'sib', tail('s-7s'), NOW);
    const out = (await exportForSpecialist(db, 'kid', NOW)).abaSessions as { id: string; tail: unknown }[];
    expect(out.map((s) => [s.id, s.tail])).toEqual([['s-7', null]]);
  });
});

// --- 5. идемпотентность commitAbaSession --------------------------------------------------------

describe('commitAbaSession: повтор одного итога', () => {
  it('дважды одним result — одна строка в aba_sessions, номер следующей сессии не растёт второй раз', async () => {
    const db = await dbWithConsent('kid');
    await commitAbaSession(db, 'kid', resultOf(session('s-7')), NOW);
    await commitAbaSession(db, 'kid', resultOf(session('s-7')), '2026-11-06T10:01:00.000Z');
    expect((await sessionsOf(db, 'kid')).map((s) => s.id)).toEqual(['s-7']);
    expect(await loadChildState(db, 'kid', 'abaSessionIndex')).toBe(8);
  });

  it('второй вызов не трогает снимок: между вызовами лёг снимок другой сессии — он цел', async () => {
    const db = await dbWithConsent('kid');
    await commitAbaSession(db, 'kid', resultOf(session('s-7')), NOW);
    expect(await loadChildState(db, 'kid', 'abaSessionInProgress')).toBeNull(); // предпосылка: итог снял снимок
    await asAbaWriter(db, 'kid', (tx) => saveChildState(tx, 'kid', 'abaSessionInProgress', snapOf('s-8'), NOW));
    await commitAbaSession(db, 'kid', resultOf(session('s-7')), '2026-11-06T10:01:00.000Z');
    expect(await loadChildState(db, 'kid', 'abaSessionInProgress')).toEqual(snapOf('s-8'));
  });

  it('повтор при версии доски +1 (рутина обменяла после итога) не бросает и доску не трогает', async () => {
    const db = await dbWithConsent('kid');
    await commitAbaSession(db, 'kid', resultOf(session('s-7'), 0), NOW);
    await asAbaWriter(db, 'kid', (tx) => saveChildState(tx, 'kid', 'abaBoard', { earned: 1, nonContingent: 0, rev: 1 }, NOW));
    await expect(commitAbaSession(db, 'kid', resultOf(session('s-7'), 0), '2026-11-06T10:01:00.000Z')).resolves.toBeUndefined();
    expect(await loadChildState(db, 'kid', 'abaBoard')).toEqual({ earned: 1, nonContingent: 0, rev: 1 });
    expect(await sessionsOf(db, 'kid')).toHaveLength(1);
  });

  it('контроль: другой id сессии с тем же номером — не повтор, а конфликт UNIQUE(child_id, session_index)', async () => {
    const db = await dbWithConsent('kid');
    await commitAbaSession(db, 'kid', resultOf(session('s-7')), NOW);
    await expect(commitAbaSession(db, 'kid', resultOf(session('s-7b', 7)), NOW)).rejects.toThrow(/UNIQUE/);
    expect(await sessionsOf(db, 'kid')).toHaveLength(1);
  });

  it('контроль: итог другого ребёнка с тем же id сессии — не повтор молча, а отказ базы (id сессии уникален на устройстве)', async () => {
    const db = await dbWithConsent('kid', 'sib');
    await commitAbaSession(db, 'kid', resultOf(session('s-7')), NOW);
    await expect(commitAbaSession(db, 'sib', resultOf(session('s-7')), NOW)).rejects.toThrow(/UNIQUE/);
    expect(await sessionsOf(db, 'sib')).toEqual([]);
    expect(await sessionsOf(db, 'kid')).toHaveLength(1);
  });
});
