import type { AbaSession, AbaTrial } from '../../../types/aba';
import type { ConsentEvent } from '../../../domain/consent';
import { emptySkill } from '../../../domain/mastery';
import type { LessonRun } from '../../../domain/parentReport';
import { appendSession, appendTrial, pastSessionsOfTarget, trialsOfSession, trialsOfTarget } from '../abaLog';
import { loadChildState, saveChildState } from '../childState';
import { appendConsentEvent, readConsentLog } from '../consentLog';
import { appendLessonRun, lessonRunsOf } from '../lessonRuns';
import { clearChildProgress, exportChild, purgeChild, wipeDevice } from '../purge';
import { migrate } from '../schema';
import { memoryDb } from './nodeSql';

let n = 0;
function trial(over: Partial<AbaTrial> = {}): AbaTrial {
  n += 1;
  return {
    id: `tr-${n}`,
    sessionId: 's-1',
    targetId: 't-1',
    exemplarId: 'e-1',
    index: n,
    kind: 'teaching',
    startPromptLevel: 0,
    promptLevelUsed: 0,
    presentations: 1,
    response: 'independent',
    emittedBeforePrompt: true,
    latencyMs: 900,
    sdEndedAt: '2026-09-30T10:00:00Z',
    scoredBy: 'adult',
    tokens: 1,
    ...over,
  };
}

function session(id: string, index: number): AbaSession {
  return {
    id,
    index,
    startedAt: '2026-09-30T10:00:00Z',
    endedAt: '2026-09-30T10:08:00Z',
    config: 'with_adult',
    targetIds: ['t-1'],
    reinforcerId: 'puzzle',
    reinforcerChosenBy: 'child',
    tokensEarned: 3,
    exchangesMade: 1,
    endReason: 'completed',
    brokenTargetId: null,
    boardSize: 5,
    endedOnSuccess: true,
    events: [],
  };
}

const consent = (over: Partial<ConsentEvent> = {}): ConsentEvent => {
  n += 1;
  return {
    id: `c-${n}`,
    scope: 'cloud_sync',
    action: 'grant',
    childId: 'kid-a',
    textVersion: 'ru-1',
    confirmedBy: 'pin',
    actorId: 'parent',
    at: `2026-09-30T10:00:${String(n % 60).padStart(2, '0')}Z`,
    ...over,
  };
};

const run = (childId: string, id: string): LessonRun => ({
  id,
  childId,
  lessonId: 'nv-count-l1',
  startedAt: '2026-09-30T09:00:00Z',
  taskSeconds: [10, 12, 9, 14],
  reviewTasks: 1,
});

const NOW = '2026-09-30T10:00:00Z';

describe('схема', () => {
  it('миграции накатываются один раз', async () => {
    const db = await memoryDb();
    await migrate(db);
    expect(await db.all('PRAGMA user_version')).toEqual([{ user_version: 1 }]);
  });
});

describe('журнал проб ABA', () => {
  it('каждая проба пишется сразу, две подряд за миллисекунду — обе на месте', async () => {
    const db = await memoryDb();
    await appendTrial(db, 'kid-a', trial(), NOW);
    await appendTrial(db, 'kid-a', trial(), NOW);
    expect(await trialsOfTarget(db, 'kid-a', 't-1')).toHaveLength(2);
  });

  it('противоречивая проба не пишется', async () => {
    const db = await memoryDb();
    await expect(appendTrial(db, 'kid-a', trial({ response: 'independent', promptLevelUsed: 2 }), NOW)).rejects.toThrow(
      /не записана/,
    );
    expect(await trialsOfTarget(db, 'kid-a', 't-1')).toEqual([]);
  });

  it('только дописывание: ни правки, ни удаления обычным запросом, ни повтора id', async () => {
    const db = await memoryDb();
    const t = trial();
    await appendTrial(db, 'kid-a', t, NOW);
    await expect(db.run("UPDATE aba_trials SET body = '{}'")).rejects.toThrow(/только дописывание/);
    await expect(db.run('DELETE FROM aba_trials')).rejects.toThrow(/только дописывание/);
    await expect(appendTrial(db, 'kid-a', t, NOW)).rejects.toThrow();
  });

  it('пробы одного ребёнка не видны другому', async () => {
    const db = await memoryDb();
    await appendTrial(db, 'kid-a', trial(), NOW);
    expect(await trialsOfTarget(db, 'kid-b', 't-1')).toEqual([]);
    expect(await trialsOfSession(db, 'kid-a', 's-1')).toHaveLength(1);
  });

  it('прошлые сессии цели — по номеру сессии, для проверки зависимости', async () => {
    const db = await memoryDb();
    await appendSession(db, 'kid-a', session('s-1', 3), NOW);
    await appendSession(db, 'kid-a', session('s-2', 4), NOW);
    await appendTrial(db, 'kid-a', trial({ sessionId: 's-1' }), NOW);
    await appendTrial(db, 'kid-a', trial({ sessionId: 's-2' }), NOW);
    await appendTrial(db, 'kid-a', trial({ sessionId: 's-2', targetId: 't-2' }), NOW);
    const past = await pastSessionsOfTarget(db, 'kid-a', 't-1');
    expect(past.map((s) => [s.index, s.trials.length])).toEqual([
      [3, 1],
      [4, 1],
    ]);
  });
});

describe('журнал согласий', () => {
  it('дописывается и читается в порядке записи', async () => {
    const db = await memoryDb();
    const a = consent();
    const b = consent({ action: 'revoke' });
    await appendConsentEvent(db, a);
    await appendConsentEvent(db, b);
    expect(await readConsentLog(db)).toEqual([a, b]);
  });

  it('событие раньше последнего и противоречивое событие не пишутся', async () => {
    const db = await memoryDb();
    await appendConsentEvent(db, consent({ at: '2026-09-30T11:00:00Z' }));
    await expect(appendConsentEvent(db, consent({ at: '2026-09-30T10:00:00Z' }))).rejects.toThrow(/раньше последнего/);
    await expect(appendConsentEvent(db, consent({ childId: null, at: '2026-09-30T12:00:00Z' }))).rejects.toThrow(
      /без ребёнка/,
    );
  });

  it('правка и удаление отклоняются базой', async () => {
    const db = await memoryDb();
    await appendConsentEvent(db, consent());
    await expect(db.run("UPDATE consent_events SET action = 'revoke'")).rejects.toThrow(/только дописывание/);
    await expect(db.run('DELETE FROM consent_events')).rejects.toThrow(/только дописывание/);
  });
});

describe('состояние по ребёнку', () => {
  it('у каждого ребёнка свои коробки', async () => {
    const db = await memoryDb();
    await saveChildState(db, 'kid-a', 'skills', [{ ...emptySkill('count'), box: 3 }], NOW);
    await saveChildState(db, 'kid-b', 'skills', [emptySkill('count')], NOW);
    expect((await loadChildState(db, 'kid-a', 'skills'))?.[0].box).toBe(3);
    expect((await loadChildState(db, 'kid-b', 'skills'))?.[0].box).toBe(1);
    expect(await loadChildState(db, 'kid-c', 'skills')).toBeUndefined();
  });

  it('перезапись ключа — последнее значение', async () => {
    const db = await memoryDb();
    await saveChildState(db, 'kid-a', 'lessonCounter', 3, NOW);
    await saveChildState(db, 'kid-a', 'lessonCounter', 4, NOW);
    expect(await loadChildState(db, 'kid-a', 'lessonCounter')).toBe(4);
  });
});

describe('удаление и экспорт', () => {
  async function filled() {
    const db = await memoryDb();
    for (const kid of ['kid-a', 'kid-b']) {
      await appendTrial(db, kid, trial(), NOW);
      await appendSession(db, kid, session(`${kid}-s`, 1), NOW);
      await appendLessonRun(db, run(kid, `${kid}-run`));
      await saveChildState(db, kid, 'lessonCounter', 7, NOW);
      await appendConsentEvent(db, consent({ childId: kid }));
    }
    return db;
  }

  it('удаление ребёнка: всё его — прочь, журнал согласий — с псевдонимом, другой ребёнок цел', async () => {
    const db = await filled();
    await purgeChild(db, 'kid-a', 'pseudo-1');
    expect(await trialsOfTarget(db, 'kid-a', 't-1')).toEqual([]);
    expect(await lessonRunsOf(db, 'kid-a')).toEqual([]);
    expect(await loadChildState(db, 'kid-a', 'lessonCounter')).toBeUndefined();
    const log = await readConsentLog(db);
    expect(log.map((e) => e.childId)).toEqual(['pseudo-1', 'kid-b']);
    expect(await trialsOfTarget(db, 'kid-b', 't-1')).toHaveLength(1);
  });

  it('после удаления защита журнала снова на месте', async () => {
    const db = await filled();
    await purgeChild(db, 'kid-a', 'pseudo-1');
    await expect(db.run("DELETE FROM aba_trials WHERE child_id = 'kid-b'")).rejects.toThrow(/только дописывание/);
  });

  it('очистка прогресса оставляет согласия', async () => {
    const db = await filled();
    await clearChildProgress(db, 'kid-a');
    expect(await lessonRunsOf(db, 'kid-a')).toEqual([]);
    expect((await readConsentLog(db)).filter((e) => e.childId === 'kid-a')).toHaveLength(1);
  });

  it('удаление аккаунта: на устройстве не остаётся ничего', async () => {
    const db = await filled();
    await wipeDevice(db);
    for (const t of ['aba_trials', 'aba_sessions', 'lesson_runs', 'consent_events', 'child_state', 'purge_gate']) {
      expect(await db.all(`SELECT 1 FROM ${t}`)).toEqual([]);
    }
  });

  it('экспорт — всё о ребёнке и ничего о другом', async () => {
    const db = await filled();
    const out = await exportChild(db, 'kid-a', NOW);
    expect([out.abaTrials.length, out.abaSessions.length, out.lessonRuns.length]).toEqual([1, 1, 1]);
    expect(out.state).toEqual({ lessonCounter: 7 });
    expect(out.consentEvents.every((e) => e.childId === 'kid-a')).toBe(true);
  });
});
