import type { ConsentEvent } from '../../../domain/consent';
import { emptySkill, type SkillState } from '../../../domain/mastery';
import type { LessonRun } from '../../../domain/parentReport';
import { useSyncStatusStore } from '../../syncStatus';
import { saveChildState } from '../childState';
import { appendConsentEvent } from '../consentLog';
import { appendLessonRun } from '../lessonRuns';
import { runBackgroundSync, syncAccount, syncChild, type RemotePort } from '../sync';
import { memoryDb } from './nodeSql';

let clock = 0;
const at = () => `2026-09-30T10:${String(Math.floor(clock / 60)).padStart(2, '0')}:${String(clock++ % 60).padStart(2, '0')}Z`;

const ev = (over: Partial<ConsentEvent>): ConsentEvent => ({
  id: `c-${clock}`,
  scope: 'cloud_sync',
  action: 'grant',
  childId: 'kid-a',
  textVersion: 'ru-1',
  confirmedBy: 'pin',
  actorId: 'parent',
  at: at(),
  ...over,
});

const run = (id: string): LessonRun => ({
  id,
  childId: 'kid-a',
  lessonId: 'nv-count-l1',
  startedAt: '2026-09-30T09:00:00Z',
  taskSeconds: [10, 11, 9, 12],
  reviewTasks: 0,
});

function remote() {
  const sent = { consent: [] as ConsentEvent[], skills: [] as SkillState[][], runs: [] as LessonRun[][] };
  const port: RemotePort = {
    pushConsentEvents: async (e) => void sent.consent.push(...e),
    pushSkillStates: async (_, s) => void sent.skills.push(s),
    pushLessonRuns: async (_, r) => void sent.runs.push(r),
  };
  return { port, sent };
}

async function withData() {
  const db = await memoryDb();
  await appendLessonRun(db, run('r-1'));
  await saveChildState(db, 'kid-a', 'skills', [emptySkill('count')], at());
  return db;
}

describe('синхронизация только при согласии на облако', () => {
  it('согласия не спрашивали — не уходит ничего, даже журнал согласий ребёнка', async () => {
    const db = await withData();
    const { port, sent } = remote();
    const r = await syncChild(db, port, 'kid-a', 'ru-1');
    expect(r.blocked).toBe(true);
    expect(sent).toEqual({ consent: [], skills: [], runs: [] });
  });

  it('согласие дано — уходят прохождения и навыки, второй проход ничего не повторяет', async () => {
    const db = await withData();
    await appendConsentEvent(db, ev({ id: 'g-1' }));
    const { port, sent } = remote();
    expect(await syncChild(db, port, 'kid-a', 'ru-1')).toMatchObject({ blocked: false, lessonRuns: 1, skills: true, consent: 1 });
    expect(await syncChild(db, port, 'kid-a', 'ru-1')).toMatchObject({ lessonRuns: 0, skills: false, consent: 0 });
    expect(sent.runs).toHaveLength(1);
    expect(sent.skills).toHaveLength(1);
  });

  it('новое прохождение и изменённые навыки уходят следующим проходом', async () => {
    const db = await withData();
    await appendConsentEvent(db, ev({ id: 'g-1' }));
    const { port, sent } = remote();
    await syncChild(db, port, 'kid-a', 'ru-1');
    await appendLessonRun(db, run('r-2'));
    await saveChildState(db, 'kid-a', 'skills', [{ ...emptySkill('count'), box: 2 }], at());
    await syncChild(db, port, 'kid-a', 'ru-1');
    expect(sent.runs.map((r) => r.map((x) => x.id))).toEqual([['r-1'], ['r-2']]);
    expect(sent.skills[1][0].box).toBe(2);
  });

  it('отзыв доходит до сервера, данные больше не уходят, при новом согласии копия заново', async () => {
    const db = await withData();
    await appendConsentEvent(db, ev({ id: 'g-1' }));
    const { port, sent } = remote();
    await syncChild(db, port, 'kid-a', 'ru-1');
    await appendConsentEvent(db, ev({ id: 'rv-1', action: 'revoke' }));
    await appendLessonRun(db, run('r-2'));
    const off = await syncChild(db, port, 'kid-a', 'ru-1');
    expect(off.blocked).toBe(true);
    expect(sent.consent.map((e) => e.id)).toEqual(['g-1', 'rv-1']);
    expect(sent.runs).toHaveLength(1);

    await appendConsentEvent(db, ev({ id: 'g-2' }));
    await syncChild(db, port, 'kid-a', 'ru-1');
    expect(sent.runs[1].map((r) => r.id)).toEqual(['r-1', 'r-2']);
  });

  it('согласие на прежний текст — как отсутствие: данные не уходят', async () => {
    const db = await withData();
    await appendConsentEvent(db, ev({ id: 'g-1', textVersion: 'ru-0' }));
    const { port, sent } = remote();
    expect((await syncChild(db, port, 'kid-a', 'ru-1')).blocked).toBe(true);
    expect(sent.runs).toEqual([]);
  });

  it('согласие одного ребёнка не открывает данные другого', async () => {
    const db = await withData();
    await appendConsentEvent(db, ev({ id: 'g-b', childId: 'kid-b' }));
    const { port, sent } = remote();
    expect((await syncChild(db, port, 'kid-a', 'ru-1')).blocked).toBe(true);
    expect(sent.runs).toEqual([]);
  });

  it('события аккаунта уходят всегда', async () => {
    const db = await memoryDb();
    await appendConsentEvent(db, ev({ id: 'acc', scope: 'account_local', childId: null, confirmedBy: 'signup' }));
    const { port, sent } = remote();
    expect(await syncAccount(db, port)).toBe(1);
    expect(sent.consent.map((e) => e.id)).toEqual(['acc']);
  });

  it('сбой сети не бросает и виден в статусе синхронизации', async () => {
    const db = await withData();
    await appendConsentEvent(db, ev({ id: 'g-1' }));
    const failing: RemotePort = {
      pushConsentEvents: async () => {
        throw new Error('offline');
      },
      pushSkillStates: async () => undefined,
      pushLessonRuns: async () => undefined,
    };
    await runBackgroundSync(db, failing, ['kid-a'], 'ru-1', { retries: 1, baseDelayMs: 1 });
    expect(useSyncStatusStore.getState().errorsBySource['local-sync:kid-a']).toBe('offline');
  });
});
