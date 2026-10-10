import type { ConsentEvent } from '../../../domain/consent';
import { emptySkill, type SkillState } from '../../../domain/mastery';
import type { LessonRun } from '../../../domain/parentReport';
import { useSyncStatusStore } from '../../syncStatus';
import { saveChildState } from '../childState';
import { appendConsentEvent } from '../consentLog';
import { appendLessonRun } from '../lessonRuns';
import {
  consentPlan,
  runBackgroundSync,
  syncAccount,
  syncChild,
  syncProblems,
  UndeliverableError,
  type RemotePort,
  type SyncProblemCode,
} from '../sync';
import { memoryDb } from './nodeSql';

let clock = 0;
const at = () =>
  `2026-09-30T10:${String(Math.floor(clock / 60)).padStart(2, '0')}:${String(clock++ % 60).padStart(2, '0')}Z`;
const NOW = '2026-09-30T12:00:00Z';
/** Профиль для создания ребёнка в облаке — только полоса. */
const OPTS = { profileOf: async () => ({ band: '5-6' as const }) };

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

function remote(reject: (e: ConsentEvent) => SyncProblemCode | null = () => null) {
  const sent = { consent: [] as string[], skills: [] as SkillState[][], runs: [] as LessonRun[][] };
  const push = async (e: ConsentEvent) => {
    const reason = reject(e);
    if (reason) throw new UndeliverableError(reason);
    sent.consent.push(e.id);
  };
  const port: RemotePort = {
    pushCloudConsent: async (cmd) => push(cmd.event),
    pushConsentEvent: async (e) => push(e),
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

describe('порядок согласий', () => {
  const e = (id: string, scope: ConsentEvent['scope'], action: ConsentEvent['action'] = 'grant') =>
    ev({ id, scope, action });

  it('первым — событие, создающее ребёнка в облаке; данные раньше согласия — сразу после', () => {
    const log = [e('ai', 'companion_ai'), e('cloud', 'cloud_sync'), e('voice', 'voice_asr')];
    expect(consentPlan(log, new Set(), new Set()).map((x) => x.id)).toEqual(['cloud', 'ai', 'voice']);
  });

  it('вне облака события копятся до нового согласия на облако', () => {
    const log = [e('g1', 'cloud_sync'), e('rv', 'cloud_sync', 'revoke'), e('ai', 'companion_ai'), e('g2', 'cloud_sync')];
    expect(consentPlan(log, new Set(['g1', 'rv']), new Set()).map((x) => x.id)).toEqual(['g2', 'ai']);
    expect(consentPlan(log.slice(0, 3), new Set(['g1', 'rv']), new Set())).toEqual([]);
  });

  it('согласие на данные ABA в облако не уходит никогда — ни до облака, ни после', () => {
    const log = [e('aba-1', 'aba_processing'), e('cloud', 'cloud_sync'), e('aba-2', 'aba_processing', 'revoke')];
    expect(consentPlan(log, new Set(), new Set()).map((x) => x.id)).toEqual(['cloud']);
  });
});

describe('синхронизация только при согласии на облако', () => {
  it('согласия не спрашивали — не уходит ничего, даже журнал согласий ребёнка', async () => {
    const db = await withData();
    await appendConsentEvent(db, ev({ id: 'ai', scope: 'companion_ai' }), 'owner');
    const { port, sent } = remote();
    expect((await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS)).blocked).toBe(true);
    expect(sent).toEqual({ consent: [], skills: [], runs: [] });
  });

  it('согласие дано и дошло — уходят прохождения и навыки, второй проход ничего не повторяет', async () => {
    const db = await withData();
    await appendConsentEvent(db, ev({ id: 'g-1' }), 'owner');
    const { port, sent } = remote();
    expect(await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS)).toMatchObject({
      blocked: false,
      lessonRuns: 1,
      skills: true,
      consent: 1,
    });
    expect(await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS)).toMatchObject({ lessonRuns: 0, skills: false, consent: 0 });
    expect([sent.runs.length, sent.skills.length]).toEqual([1, 1]);
  });

  it('отзыв доходит до сервера, данные больше не уходят, при новом согласии — заново целиком', async () => {
    const db = await withData();
    await appendConsentEvent(db, ev({ id: 'g-1' }), 'owner');
    const { port, sent } = remote();
    await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS);
    await appendConsentEvent(db, ev({ id: 'rv-1', action: 'revoke' }), 'owner');
    await appendLessonRun(db, run('r-2'));
    expect((await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS)).blocked).toBe(true);
    expect(sent.consent).toEqual(['g-1', 'rv-1']);
    expect(sent.runs).toHaveLength(1);

    await appendConsentEvent(db, ev({ id: 'g-2' }), 'owner');
    await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS);
    expect(sent.runs[1].map((r) => r.id)).toEqual(['r-1', 'r-2']);
  });

  it('после отзыва события ребёнка не уходят: сервер его уже не знает', async () => {
    const db = await withData();
    await appendConsentEvent(db, ev({ id: 'g-1' }), 'owner');
    await appendConsentEvent(db, ev({ id: 'rv-1', action: 'revoke' }), 'owner');
    const { port, sent } = remote();
    await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS);
    await appendConsentEvent(db, ev({ id: 'ai-off', scope: 'companion_ai', action: 'revoke' }), 'owner');
    await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS);
    expect(sent.consent).toEqual(['g-1', 'rv-1']);
  });

  it('согласие на прежний текст — как отсутствие: данные не уходят', async () => {
    const db = await withData();
    await appendConsentEvent(db, ev({ id: 'g-1', textVersion: 'ru-0' }), 'owner');
    const { port, sent } = remote();
    expect((await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS)).blocked).toBe(true);
    expect(sent.runs).toEqual([]);
  });

  it('согласие одного ребёнка не открывает данные другого', async () => {
    const db = await withData();
    await appendConsentEvent(db, ev({ id: 'g-b', childId: 'kid-b' }), 'owner');
    const { port, sent } = remote();
    expect((await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS)).blocked).toBe(true);
    expect(sent.runs).toEqual([]);
  });

  it('отклонённое по существу не повторяется вечно и ждёт родителя; данные не уходят', async () => {
    const db = await withData();
    await appendConsentEvent(db, ev({ id: 'g-old' }), 'owner');
    const { port, sent } = remote((e) => (e.id === 'g-old' ? 'outdated_text' : null));
    const r = await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS);
    expect([r.problem, r.blocked]).toEqual([true, true]);
    expect(await syncProblems(db)).toEqual([{ childId: 'kid-a', kind: 'consent', ref: 'g-old', reason: 'outdated_text' }]);
    await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS);
    expect(sent.runs).toEqual([]);
  });

  it('отзыв посреди прохода ждёт замка и останавливает данные в том же проходе', async () => {
    const db = await withData();
    await appendConsentEvent(db, ev({ id: 'g-1' }), 'owner');
    let revoke: Promise<void> | null = null;
    const { port, sent } = remote();
    const slow: RemotePort = {
      ...port,
      pushCloudConsent: async (cmd, signal) => {
        await port.pushCloudConsent(cmd, signal);
        // родитель отзывает, пока проход ещё идёт — запись ждёт замка
        revoke ??= appendConsentEvent(db, ev({ id: 'rv-1', action: 'revoke' }), 'owner');
      },
    };
    await syncChild(db, slow, 'kid-a', 'ru-1', NOW, OPTS);
    await revoke;
    // каждое согласие — своя секция под замком: отзыв записан между ними и ушёл тем же проходом,
    // данные не ушли
    expect(sent.consent).toEqual(['g-1', 'rv-1']);
    expect(sent.runs).toHaveLength(0);
    await appendLessonRun(db, run('r-2'));
    expect((await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS)).blocked).toBe(true);
    expect(sent.runs).toHaveLength(0);
  });

  it('события аккаунта уходят всегда', async () => {
    const db = await memoryDb();
    await appendConsentEvent(db, ev({ id: 'acc', scope: 'account_local', childId: null, confirmedBy: 'signup' }), 'owner');
    const { port, sent } = remote();
    expect(await syncAccount(db, port, NOW)).toBe(1);
    expect(await syncAccount(db, port, NOW)).toBe(0);
    expect(sent.consent).toEqual(['acc']);
  });

  it('сбой сети не бросает и виден в статусе синхронизации', async () => {
    const db = await withData();
    await appendConsentEvent(db, ev({ id: 'g-1' }), 'owner');
    const failing: RemotePort = {
      pushCloudConsent: async () => {
        throw new Error('offline');
      },
      pushConsentEvent: async () => {
        throw new Error('offline');
      },
      pushSkillStates: async () => undefined,
      pushLessonRuns: async () => undefined,
    };
    await runBackgroundSync(db, failing, ['kid-a'], 'ru-1', () => NOW, { retries: 1, baseDelayMs: 1 }, OPTS);
    expect(useSyncStatusStore.getState().errorsBySource['local-sync:kid-a']).toBe('offline');
  });
});
