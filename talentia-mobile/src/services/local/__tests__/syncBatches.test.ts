/**
 * Синхронизация: классификация облачного согласия, профиль, пачки прохождений, таймауты и
 * отказы по существу (спецификация `backend-auditor`, п. 2.8). Базовые сценарии согласия —
 * `sync.test.ts`.
 */
import type { ConsentEvent } from '../../../domain/consent';
import { emptySkill } from '../../../domain/mastery';
import type { LessonRun } from '../../../domain/parentReport';
import { appendConsentEvent, insertConsentEvent } from '../consentLog';
import { revokeAbaProcessing } from '../purge';
import type { SqlDb } from '../sql';
import {
  cloudKind,
  LESSON_RUNS_BATCH,
  MAX_BATCHES_PER_PASS,
  RemoteTimeoutError,
  consentPlan,
  retrySyncProblem,
  supersededEvents,
  syncAccount,
  syncChild,
  syncProblems,
  UndeliverableError,
  type ChildProfile,
  type CloudConsent,
  type RemotePort,
  type SyncOptions,
  type SyncProblemCode,
} from '../sync';
import { memoryDb, writeLessonRun, writeLessonState } from './nodeSql';

let clock = 0;
const at = () =>
  `2026-09-30T${String(10 + Math.floor(clock / 3600)).padStart(2, '0')}:${String(Math.floor(clock / 60) % 60).padStart(2, '0')}:${String(clock++ % 60).padStart(2, '0')}Z`;
const NOW = '2026-09-30T23:00:00Z';
const OPTS: SyncOptions = { profileOf: async () => ({ band: '5-6' }) };

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

async function addRuns(db: SqlDb, n: number, from = 1): Promise<void> {
  for (let i = from; i < from + n; i += 1) await writeLessonRun(db, run(`r-${i}`));
}

/** Порт, который записывает всё, что ушло; поведение каждого вызова можно подменить. */
function recorder(over: Partial<RemotePort> = {}) {
  const sent = {
    cloud: [] as CloudConsent[],
    events: [] as string[],
    runs: [] as string[][],
    skills: 0,
  };
  const base: RemotePort = {
    pushCloudConsent: async (cmd) => void sent.cloud.push(cmd),
    pushConsentEvent: async (e) => void sent.events.push(e.id),
    pushSkillStates: async () => void (sent.skills += 1),
    pushLessonRuns: async (_, runs) => void sent.runs.push(runs.map((r) => r.id)),
  };
  return { port: { ...base, ...over }, sent, base };
}

/** Ребёнок с согласием на облако, уже доставленным; в базе `n` прохождений. */
async function granted(n: number) {
  const db = await memoryDb();
  await addRuns(db, n);
  await appendConsentEvent(db, ev({ id: 'g-1' }), 'owner');
  await withoutRuns(db, recorder().port);
  return db;
}

/** Доставить согласия, не трогая прохождения: порт отказывает прохождениям сетью, ошибка глотается. */
async function withoutRuns(db: SqlDb, port: RemotePort): Promise<void> {
  const noRuns: RemotePort = {
    ...port,
    pushLessonRuns: async () => {
      throw new Error('offline');
    },
  };
  await syncChild(db, noRuns, 'kid-a', 'ru-1', NOW, OPTS).catch(() => undefined);
}

/** Зависший удалённый вызов: не резолвится сам, отклоняется только по сигналу. */
const hang = (signal: AbortSignal) =>
  new Promise<void>((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))));

describe('классификация облачного согласия', () => {
  const e = (id: string, action: ConsentEvent['action'] = 'grant') => ev({ id, action });

  it('первый grant — open', () => {
    const log = [e('g1')];
    expect(cloudKind(log, log[0], new Set())).toBe('open');
  });

  it('grant после отзыва — снова open: ребёнка на сервере уже нет', () => {
    const log = [e('g1'), e('rv', 'revoke'), e('g2')];
    expect(cloudKind(log, log[2], new Set())).toBe('open');
  });

  it('grant при действующем согласии — regrant', () => {
    const log = [e('g1'), e('g2')];
    expect(cloudKind(log, log[1], new Set())).toBe('regrant');
  });

  it('revoke — revoke', () => {
    const log = [e('g1'), e('rv', 'revoke')];
    expect(cloudKind(log, log[1], new Set())).toBe('revoke');
  });

  it('grant после отклонённого сервером grant — open: тот ребёнка не создал', () => {
    const log = [e('g1'), e('g2')];
    expect(cloudKind(log, log[1], new Set(['g1']))).toBe('open');
  });

  it('согласия других областей на вид не влияют', () => {
    const log = [ev({ id: 'ai', scope: 'companion_ai' }), e('g1')];
    expect(cloudKind(log, log[1], new Set())).toBe('open');
  });

  it('по журналу уходят open, revoke, open, regrant — с полосой и без имени', async () => {
    const db = await memoryDb();
    const { port, sent } = recorder();
    const pass = (version = 'ru-1') => syncChild(db, port, 'kid-a', version, NOW, OPTS);
    await appendConsentEvent(db, ev({ id: 'g-1' }), 'owner');
    await pass();
    await appendConsentEvent(db, ev({ id: 'rv-1', action: 'revoke' }), 'owner');
    await pass();
    await appendConsentEvent(db, ev({ id: 'g-2' }), 'owner');
    await pass();
    // смена текста согласия — повторный grant при действующем
    await appendConsentEvent(db, ev({ id: 'g-3', textVersion: 'ru-2' }), 'owner');
    await pass('ru-2');

    expect(sent.cloud.map((c) => [c.kind, c.event.id])).toEqual([
      ['open', 'g-1'],
      ['revoke', 'rv-1'],
      ['open', 'g-2'],
      ['regrant', 'g-3'],
    ]);
    for (const c of sent.cloud) {
      if (c.kind === 'revoke') expect(c).not.toHaveProperty('profile');
      else expect(c.profile).toEqual({ band: '5-6' });
    }
  });

  // Профиль из полной записи ребёнка (с именем) проходит типы: лишние поля структурно
  // допустимы. sync.ts собирает профиль заново — по PARENT.md в cmd только полоса.
  it('профиль из полной записи ребёнка — в облако уходит только полоса, имя нет', async () => {
    const db = await memoryDb();
    const child = { band: '7' as const, displayName: 'Айгуль' };
    const profileOf = async (): Promise<ChildProfile> => child;
    await appendConsentEvent(db, ev({ id: 'g-1' }), 'owner');
    const { port, sent } = recorder();
    await syncChild(db, port, 'kid-a', 'ru-1', NOW, { profileOf });
    const [cmd] = sent.cloud;
    expect(cmd.kind === 'revoke' ? null : cmd.profile).toEqual({ band: '7' });
  });
});

describe('нет профиля ребёнка', () => {
  it.each([
    ['profileOf возвращает null', { profileOf: async () => null }],
    ['profileOf не передан', {}],
  ] as [string, SyncOptions][])('%s — согласие на облако ждёт, не бросает, данные не уходят', async (_, opts) => {
    const db = await memoryDb();
    await addRuns(db, 3);
    await writeLessonState(db, 'kid-a', 'skills', [emptySkill('count')], at());
    await appendConsentEvent(db, ev({ id: 'ai', scope: 'companion_ai' }), 'owner');
    await appendConsentEvent(db, ev({ id: 'g-1' }), 'owner');
    const { port, sent } = recorder();

    const report = await syncChild(db, port, 'kid-a', 'ru-1', NOW, opts);

    expect(report).toMatchObject({ blocked: true, consent: 0, lessonRuns: 0, skills: false, problem: false });
    expect(sent).toEqual({ cloud: [], events: [], runs: [], skills: 0 });
  });

  it('профиль появился — согласие и накопленное уходят следующим проходом', async () => {
    const db = await memoryDb();
    await addRuns(db, 2);
    await appendConsentEvent(db, ev({ id: 'g-1' }), 'owner');
    const { port, sent } = recorder();
    await syncChild(db, port, 'kid-a', 'ru-1', NOW, { profileOf: async () => null });

    const report = await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS);

    expect(report).toMatchObject({ blocked: false, consent: 1, lessonRuns: 2 });
    expect(sent.cloud.map((c) => c.kind)).toEqual(['open']);
  });

  it('отзыв уходит и без профиля: он профиля не требует', async () => {
    const db = await memoryDb();
    await appendConsentEvent(db, ev({ id: 'g-1' }), 'owner');
    const { port, sent } = recorder();
    await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS);
    await appendConsentEvent(db, ev({ id: 'rv-1', action: 'revoke' }), 'owner');

    await syncChild(db, port, 'kid-a', 'ru-1', NOW, { profileOf: async () => null });

    expect(sent.cloud.map((c) => c.event.id)).toEqual(['g-1', 'rv-1']);
  });
});

describe('прохождения пачками', () => {
  it('450 прохождений уходят тремя пачками: 200, 200, 50', async () => {
    const db = await granted(450);
    const { port, sent } = recorder();

    const report = await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS);

    expect(sent.runs.map((b) => b.length)).toEqual([LESSON_RUNS_BATCH, LESSON_RUNS_BATCH, 50]);
    expect(report.lessonRuns).toBe(450);
    expect(sent.runs.flat()).toEqual(Array.from({ length: 450 }, (_, i) => `r-${i + 1}`));
  });

  it('сбой сети на второй пачке — проход бросает, следующий начинает со второй пачки', async () => {
    const db = await granted(450);
    let calls = 0;
    const { port, sent, base } = recorder();
    const flaky: RemotePort = {
      ...port,
      pushLessonRuns: async (childId, runs, signal) => {
        calls += 1;
        if (calls === 2) throw new Error('offline');
        await base.pushLessonRuns(childId, runs, signal);
      },
    };

    await expect(syncChild(db, flaky, 'kid-a', 'ru-1', NOW, OPTS)).rejects.toThrow('offline');
    expect(sent.runs.map((b) => [b[0], b.length])).toEqual([['r-1', 200]]);

    const report = await syncChild(db, flaky, 'kid-a', 'ru-1', NOW, OPTS);

    expect(sent.runs.map((b) => [b[0], b.length])).toEqual([
      ['r-1', 200],
      ['r-201', 200],
      ['r-401', 50],
    ]);
    expect(report.lessonRuns).toBe(250);
  });

  it('после полной доставки следующий проход прохождений не повторяет', async () => {
    const db = await granted(450);
    const { port, sent } = recorder();
    await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS);

    const report = await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS);

    expect(report.lessonRuns).toBe(0);
    expect(sent.runs).toHaveLength(3);
  });

  it('отзыв, записанный между пачками, останавливает остальные пачки', async () => {
    const db = await granted(450);
    let revoke: Promise<void> | null = null;
    const { port, sent, base } = recorder();
    const revoking: RemotePort = {
      ...port,
      pushLessonRuns: async (childId, runs, signal) => {
        await base.pushLessonRuns(childId, runs, signal);
        // родитель отзывает, пока уходит первая пачка: запись ждёт замка
        revoke ??= appendConsentEvent(db, ev({ id: 'rv-1', action: 'revoke' }), 'owner');
      },
    };

    const report = await syncChild(db, revoking, 'kid-a', 'ru-1', NOW, OPTS);
    await revoke;

    expect(sent.runs.map((b) => b.length)).toEqual([200]);
    expect(report.lessonRuns).toBe(200);
  });

  it('после отзыва между пачками следующий проход доставляет отзыв и данные не шлёт', async () => {
    const db = await granted(450);
    let revoke: Promise<void> | null = null;
    const { port, sent, base } = recorder();
    const revoking: RemotePort = {
      ...port,
      pushLessonRuns: async (childId, runs, signal) => {
        await base.pushLessonRuns(childId, runs, signal);
        revoke ??= appendConsentEvent(db, ev({ id: 'rv-1', action: 'revoke' }), 'owner');
      },
    };
    await syncChild(db, revoking, 'kid-a', 'ru-1', NOW, OPTS);
    await revoke;

    const report = await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS);

    expect(report.blocked).toBe(true);
    expect(sent.cloud.map((c) => [c.kind, c.event.id])).toEqual([['revoke', 'rv-1']]);
    expect(sent.runs).toHaveLength(1);
  });

  it(`за один проход уходит не больше ${MAX_BATCHES_PER_PASS} пачек`, async () => {
    const total = MAX_BATCHES_PER_PASS * LESSON_RUNS_BATCH + 50;
    const db = await granted(total);
    const { port, sent } = recorder();

    const first = await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS);

    expect(sent.runs).toHaveLength(MAX_BATCHES_PER_PASS);
    expect(first.lessonRuns).toBe(MAX_BATCHES_PER_PASS * LESSON_RUNS_BATCH);

    const second = await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS);

    expect(second.lessonRuns).toBe(50);
    expect(sent.runs[MAX_BATCHES_PER_PASS][0]).toBe(`r-${MAX_BATCHES_PER_PASS * LESSON_RUNS_BATCH + 1}`);
  });
});

describe('таймаут удалённого вызова', () => {
  const FAST = { ...OPTS, timeoutMs: 20 };

  it('зависшая пачка прохождений — проход бросает RemoteTimeoutError', async () => {
    const db = await granted(3);
    const { port } = recorder({ pushLessonRuns: async (_, __, signal) => hang(signal) });

    await expect(syncChild(db, port, 'kid-a', 'ru-1', NOW, FAST)).rejects.toBeInstanceOf(RemoteTimeoutError);
  });

  it('удалённый вызов получает отмену по таймауту', async () => {
    const db = await granted(3);
    let aborted = false;
    const { port } = recorder({
      pushLessonRuns: async (_, __, signal) => {
        signal.addEventListener('abort', () => (aborted = true));
        await hang(signal);
      },
    });

    await syncChild(db, port, 'kid-a', 'ru-1', NOW, FAST).catch(() => undefined);

    expect(aborted).toBe(true);
  });

  it('после таймаута замок свободен: отзыв записывается сразу', async () => {
    const db = await granted(3);
    // порт игнорирует сигнал совсем — замок должен освободить сам таймаут
    const { port } = recorder({ pushLessonRuns: () => new Promise<void>(() => undefined) });
    await syncChild(db, port, 'kid-a', 'ru-1', NOW, FAST).catch(() => undefined);

    const write = appendConsentEvent(db, ev({ id: 'rv-1', action: 'revoke' }), 'owner').then(() => 'written');
    const stuck = new Promise((r) => setTimeout(() => r('stuck'), 500));

    expect(await Promise.race([write, stuck])).toBe('written');
  });

  it('после таймаута следующий проход идёт и доставляет то же самое', async () => {
    const db = await granted(3);
    const { port: hung } = recorder({ pushLessonRuns: () => new Promise<void>(() => undefined) });
    await syncChild(db, hung, 'kid-a', 'ru-1', NOW, FAST).catch(() => undefined);
    const { port, sent } = recorder();

    const report = await syncChild(db, port, 'kid-a', 'ru-1', NOW, FAST);

    expect(report.lessonRuns).toBe(3);
    expect(sent.runs).toEqual([['r-1', 'r-2', 'r-3']]);
  });

  describe('зависший profileOf под замком базы', () => {
    const NEVER = { profileOf: () => new Promise<ChildProfile | null>(() => undefined), timeoutMs: 20 };

    async function withCloudAndAbaGrants() {
      const db = await memoryDb();
      await appendConsentEvent(db, ev({ id: 'g-cloud' }), 'owner');
      await appendConsentEvent(db, ev({ id: 'g-aba', scope: 'aba_processing', confirmedBy: 'biometric' }), 'owner');
      return db;
    }

    it('зависший profileOf — проход бросает RemoteTimeoutError', async () => {
      const db = await withCloudAndAbaGrants();
      const { port } = recorder();

      await expect(syncChild(db, port, 'kid-a', 'ru-1', NOW, NEVER)).rejects.toBeInstanceOf(RemoteTimeoutError);
    });

    it('после таймаута profileOf отзыв облачного согласия записывается сразу', async () => {
      const db = await withCloudAndAbaGrants();
      const { port } = recorder();
      await syncChild(db, port, 'kid-a', 'ru-1', NOW, NEVER).catch(() => undefined);

      const write = appendConsentEvent(db, ev({ id: 'rv-cloud', action: 'revoke' }), 'owner').then(() => 'written');
      const stuck = new Promise((r) => setTimeout(() => r('stuck'), 500));

      expect(await Promise.race([write, stuck])).toBe('written');
    });

    it('после таймаута profileOf отзыв ABA (revokeAbaProcessing) проходит быстро', async () => {
      const db = await withCloudAndAbaGrants();
      const { port } = recorder();
      await syncChild(db, port, 'kid-a', 'ru-1', NOW, NEVER).catch(() => undefined);

      const revoke = revokeAbaProcessing(
        db,
        ev({ id: 'rv-aba', scope: 'aba_processing', action: 'revoke', confirmedBy: 'biometric' }),
        'owner',
      ).then(() => 'revoked');
      const stuck = new Promise((r) => setTimeout(() => r('stuck'), 500));

      expect(await Promise.race([revoke, stuck])).toBe('revoked');
    });

    it('пока profileOf висит, замок держится не дольше таймаута: отзыв ждёт, но дожидается', async () => {
      const db = await withCloudAndAbaGrants();
      const { port } = recorder();
      const pass = syncChild(db, port, 'kid-a', 'ru-1', NOW, NEVER).catch(() => 'timeout');

      const write = appendConsentEvent(db, ev({ id: 'rv-cloud', action: 'revoke' }), 'owner').then(() => 'written');
      const stuck = new Promise((r) => setTimeout(() => r('stuck'), 500));

      expect(await Promise.race([write, stuck])).toBe('written');
      expect(await pass).toBe('timeout');
    });

    it('после таймаута profileOf следующий проход с живым profileOf доставляет согласие', async () => {
      const db = await withCloudAndAbaGrants();
      const { port: first } = recorder();
      await syncChild(db, first, 'kid-a', 'ru-1', NOW, NEVER).catch(() => undefined);
      const { port, sent } = recorder();

      await syncChild(db, port, 'kid-a', 'ru-1', NOW, { ...OPTS, timeoutMs: 20 });

      expect(sent.cloud.map((c) => [c.kind, c.event.id])).toEqual([['open', 'g-cloud']]);
    });
  });

  it('зависшее согласие на облако не считается доставленным и уходит снова', async () => {
    const db = await memoryDb();
    await appendConsentEvent(db, ev({ id: 'g-1' }), 'owner');
    const { port: hung } = recorder({ pushCloudConsent: async (_, signal) => hang(signal) });
    await expect(syncChild(db, hung, 'kid-a', 'ru-1', NOW, FAST)).rejects.toBeInstanceOf(RemoteTimeoutError);
    const { port, sent } = recorder();

    await syncChild(db, port, 'kid-a', 'ru-1', NOW, FAST);

    expect(sent.cloud.map((c) => [c.kind, c.event.id])).toEqual([['open', 'g-1']]);
  });
});

describe('отказ по существу', () => {
  const rejecting = (reason: SyncProblemCode) => async () => {
    throw new UndeliverableError(reason);
  };

  it('отказ согласию — проблема consent, проход не бросает, report.problem', async () => {
    const db = await memoryDb();
    await appendConsentEvent(db, ev({ id: 'g-1' }), 'owner');
    const { port } = recorder({ pushCloudConsent: rejecting('device_clock') });

    const report = await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS);

    expect(report.problem).toBe(true);
    expect(await syncProblems(db)).toEqual([{ childId: 'kid-a', kind: 'consent', ref: 'g-1', reason: 'device_clock' }]);
  });

  it('отказ событию не про облако не останавливает данные навсегда', async () => {
    const db = await memoryDb();
    await addRuns(db, 1);
    await appendConsentEvent(db, ev({ id: 'g-1' }), 'owner');
    await appendConsentEvent(db, ev({ id: 'ai', scope: 'companion_ai' }), 'owner');
    const { port, sent } = recorder({ pushConsentEvent: rejecting('invalid_data') });
    await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS);

    await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS);

    expect(sent.runs).toEqual([['r-1']]);
  });

  it('отказ потоку прохождений — проблема lesson_runs, проход не бросает', async () => {
    const db = await granted(3);
    const { port } = recorder({ pushLessonRuns: rejecting('outdated_text') });

    const report = await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS);

    expect(report.problem).toBe(true);
    expect(await syncProblems(db)).toEqual([{ childId: 'kid-a', kind: 'lesson_runs', ref: 'lesson_runs', reason: 'outdated_text' }]);
  });

  it('пока проблема потока открыта, прохождения не отправляются', async () => {
    const db = await granted(3);
    let calls = 0;
    const { port } = recorder({
      pushLessonRuns: async () => {
        calls += 1;
        throw new UndeliverableError('no_access');
      },
    });
    await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS);

    await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS);
    await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS);

    expect(calls).toBe(1);
  });

  it('проблема потока прохождений не останавливает навыки', async () => {
    const db = await granted(3);
    await writeLessonState(db, 'kid-a', 'skills', [emptySkill('count')], at());
    const { port, sent } = recorder({ pushLessonRuns: rejecting('no_access') });

    const report = await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS);

    expect([report.skills, sent.skills]).toEqual([true, 1]);
  });

  it('новое согласие на облако закрывает проблему потока, прохождения уходят снова', async () => {
    const db = await granted(3);
    const { port: refusing } = recorder({ pushLessonRuns: rejecting('outdated_text') });
    await syncChild(db, refusing, 'kid-a', 'ru-1', NOW, OPTS);
    await appendConsentEvent(db, ev({ id: 'g-2' }), 'owner');
    const { port, sent } = recorder();

    const report = await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS);

    expect(sent.cloud.map((c) => [c.kind, c.event.id])).toEqual([['regrant', 'g-2']]);
    expect(await syncProblems(db)).toEqual([]);
    expect(report.lessonRuns).toBe(3);
    expect(sent.runs).toEqual([['r-1', 'r-2', 'r-3']]);
  });

  it('«повторить» снимает проблему потока, и прохождения уходят', async () => {
    const db = await granted(3);
    const { port: refusing } = recorder({ pushLessonRuns: rejecting('no_access') });
    await syncChild(db, refusing, 'kid-a', 'ru-1', NOW, OPTS);
    const [problem] = await syncProblems(db);
    await retrySyncProblem(db, problem.childId, problem.ref);
    const { port, sent } = recorder();

    await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS);

    expect(sent.runs).toEqual([['r-1', 'r-2', 'r-3']]);
  });

  it('invalid_data на пачке — по одной: плохая в проблемы, остальные доставлены', async () => {
    const db = await granted(5);
    const { port, sent, base } = recorder();
    const picky: RemotePort = {
      ...port,
      pushLessonRuns: async (childId, runs, signal) => {
        if (runs.some((r) => r.id === 'r-3')) throw new UndeliverableError('invalid_data');
        await base.pushLessonRuns(childId, runs, signal);
      },
    };

    const report = await syncChild(db, picky, 'kid-a', 'ru-1', NOW, OPTS);

    expect(sent.runs).toEqual([['r-1'], ['r-2'], ['r-4'], ['r-5']]);
    expect(report).toMatchObject({ lessonRuns: 4, problem: true });
    expect(await syncProblems(db)).toEqual([{ childId: 'kid-a', kind: 'lesson_run', ref: 'r-3', reason: 'invalid_data' }]);
  });

  it('после плохой строки курсор за ней: следующий проход шлёт только новое', async () => {
    const db = await granted(5);
    const { port, sent, base } = recorder();
    const picky: RemotePort = {
      ...port,
      pushLessonRuns: async (childId, runs, signal) => {
        if (runs.some((r) => r.id === 'r-3')) throw new UndeliverableError('invalid_data');
        await base.pushLessonRuns(childId, runs, signal);
      },
    };
    await syncChild(db, picky, 'kid-a', 'ru-1', NOW, OPTS);
    await addRuns(db, 1, 6);

    const report = await syncChild(db, picky, 'kid-a', 'ru-1', NOW, OPTS);

    expect(report.lessonRuns).toBe(1);
    expect(sent.runs[sent.runs.length - 1]).toEqual(['r-6']);
  });

  it('плохая строка не блокирует поток: проблема одной строки — не проблема потока', async () => {
    const db = await granted(3);
    const { port: picky } = recorder({
      pushLessonRuns: async (_, runs) => {
        if (runs.some((r) => r.id === 'r-2')) throw new UndeliverableError('invalid_data');
      },
    });
    await syncChild(db, picky, 'kid-a', 'ru-1', NOW, OPTS);
    await addRuns(db, 1, 4);
    const { port, sent } = recorder();

    await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS);

    expect(sent.runs).toEqual([['r-4']]);
  });

  // курсор прохождений уже за плохой строкой — «повторить» ставит её в очередь переотправки
  it('«повторить» для отклонённого прохождения отправляет его снова', async () => {
    const db = await granted(3);
    const { port: picky } = recorder({
      pushLessonRuns: async (_, runs) => {
        if (runs.some((r) => r.id === 'r-2')) throw new UndeliverableError('invalid_data');
      },
    });
    await syncChild(db, picky, 'kid-a', 'ru-1', NOW, OPTS);
    await retrySyncProblem(db, 'kid-a', 'r-2');
    const { port, sent } = recorder();

    await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS);

    expect(sent.runs.flat()).toContain('r-2');
    expect(await syncProblems(db)).toEqual([]);
    await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS);
    expect(sent.runs.flat().filter((id) => id === 'r-2')).toHaveLength(1);
  });

  it('повтор снова отклонён — проблема возвращается к родителю, без вечных повторов', async () => {
    const db = await granted(3);
    let tries = 0;
    const { port: picky } = recorder({
      pushLessonRuns: async (_, runs) => {
        if (runs.some((r) => r.id === 'r-2')) {
          tries += 1;
          throw new UndeliverableError('invalid_data');
        }
      },
    });
    await syncChild(db, picky, 'kid-a', 'ru-1', NOW, OPTS);
    await retrySyncProblem(db, 'kid-a', 'r-2');
    expect(await syncProblems(db)).toEqual([]);
    await syncChild(db, picky, 'kid-a', 'ru-1', NOW, OPTS);
    await syncChild(db, picky, 'kid-a', 'ru-1', NOW, OPTS);
    // пачка, по одной и один повтор
    expect(tries).toBe(3);
    expect(await syncProblems(db)).toEqual([{ childId: 'kid-a', kind: 'lesson_run', ref: 'r-2', reason: 'invalid_data' }]);
  });

  it('отказ навыкам — проблема skill_state, проход не бросает', async () => {
    const db = await granted(0);
    await writeLessonState(db, 'kid-a', 'skills', [emptySkill('count')], at());
    const { port } = recorder({ pushSkillStates: rejecting('no_access') });

    const report = await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS);

    expect([report.problem, report.skills]).toEqual([true, false]);
    expect(await syncProblems(db)).toEqual([{ childId: 'kid-a', kind: 'skill_state', ref: 'skill_state', reason: 'no_access' }]);
  });

  it('пока проблема навыков открыта, изменённые навыки не отправляются', async () => {
    const db = await granted(0);
    await writeLessonState(db, 'kid-a', 'skills', [emptySkill('count')], at());
    let calls = 0;
    const { port } = recorder({
      pushSkillStates: async () => {
        calls += 1;
        throw new UndeliverableError('no_access');
      },
    });
    await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS);
    await writeLessonState(db, 'kid-a', 'skills', [emptySkill('count'), emptySkill('compare')], at());

    await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS);

    expect(calls).toBe(1);
  });
});

// --- регрессии по аудиту `backend-auditor` 2026-10-10 (B1–B3, M2, L4) и `child-privacy-compliance`

describe('отзыв и новое согласие одним проходом (B1)', () => {
  /** Ребёнок, чьи 3 прохождения и навыки уже в облаке; затем отзыв и новое согласие записаны офлайн. */
  async function revokedAndRegranted() {
    const db = await memoryDb();
    await addRuns(db, 3);
    await writeLessonState(db, 'kid-a', 'skills', [emptySkill('count')], at());
    await appendConsentEvent(db, ev({ id: 'g-1' }), 'owner');
    const { port: first, sent: before } = recorder();
    await syncChild(db, first, 'kid-a', 'ru-1', NOW, OPTS);
    // предусловие: копия уже собрана, иначе тест ничего не проверяет
    expect([before.runs, before.skills]).toEqual([[['r-1', 'r-2', 'r-3']], 1]);
    await appendConsentEvent(db, ev({ id: 'rv-1', action: 'revoke' }), 'owner');
    await appendConsentEvent(db, ev({ id: 'g-2' }), 'owner');
    return db;
  }

  /** Не больше двух проходов: «в том же или следующем». */
  async function twoPasses(db: SqlDb, port: RemotePort) {
    await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS);
    await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS);
  }

  it('отзыв и новое согласие уходят одним проходом: revoke, затем open', async () => {
    const db = await revokedAndRegranted();
    const { port, sent } = recorder();

    await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS);

    expect(sent.cloud.map((c) => [c.kind, c.event.id])).toEqual([
      ['revoke', 'rv-1'],
      ['open', 'g-2'],
    ]);
  });

  it('после такого прохода вся история прохождений уходит заново, один раз', async () => {
    const db = await revokedAndRegranted();
    const { port, sent } = recorder();

    await twoPasses(db, port);

    expect(sent.runs.flat()).toEqual(['r-1', 'r-2', 'r-3']);
  });

  it('после такого прохода навыки уходят заново, хотя с прошлой отправки не менялись', async () => {
    const db = await revokedAndRegranted();
    const { port, sent } = recorder();

    await twoPasses(db, port);

    expect(sent.skills).toBe(1);
  });

  it('отзыв дошёл, а новое согласие оборвалось сетью — следующий проход шлёт историю заново', async () => {
    const db = await revokedAndRegranted();
    const { port, sent, base } = recorder();
    const grantOffline: RemotePort = {
      ...port,
      pushCloudConsent: async (cmd, signal) => {
        if (cmd.kind !== 'revoke') throw new Error('offline');
        await base.pushCloudConsent(cmd, signal);
      },
    };
    await expect(syncChild(db, grantOffline, 'kid-a', 'ru-1', NOW, OPTS)).rejects.toThrow('offline');

    await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS);

    expect(sent.runs.flat()).toEqual(['r-1', 'r-2', 'r-3']);
  });
});

describe('устаревшие события согласия (B2)', () => {
  const e = (id: string, over: Partial<ConsentEvent> = {}) => ev({ id, ...over });
  const ids = (s: Set<string>) => [...s].sort();

  describe('supersededEvents', () => {
    it('пустой журнал — устаревших нет', () => {
      expect(ids(supersededEvents([], new Set()))).toEqual([]);
    });

    it('ничего не доставлено — устаревших нет', () => {
      const log = [e('g1'), e('rv', { action: 'revoke' })];
      expect(ids(supersededEvents(log, new Set()))).toEqual([]);
    });

    it('недоставленное событие раньше доставленного той же области и ребёнка — устаревшее', () => {
      const log = [e('g1'), e('rv', { action: 'revoke' })];
      expect(ids(supersededEvents(log, new Set(['rv'])))).toEqual(['g1']);
    });

    it('недоставленное событие после доставленного — не устаревшее', () => {
      const log = [e('g1'), e('rv', { action: 'revoke' })];
      expect(ids(supersededEvents(log, new Set(['g1'])))).toEqual([]);
    });

    it('доставленное событие само устаревшим не считается', () => {
      const log = [e('g1'), e('g2')];
      expect(ids(supersededEvents(log, new Set(['g1', 'g2'])))).toEqual([]);
    });

    it('событие другой области раньше доставленного — не устаревшее', () => {
      const log = [e('ai', { scope: 'companion_ai' }), e('g1')];
      expect(ids(supersededEvents(log, new Set(['g1'])))).toEqual([]);
    });

    it('событие другого ребёнка раньше доставленного — не устаревшее', () => {
      const log = [e('g-b', { childId: 'kid-b' }), e('g-a')];
      expect(ids(supersededEvents(log, new Set(['g-a'])))).toEqual([]);
    });

    it('события аккаунта (childId null) — по тому же правилу', () => {
      const acc = { scope: 'account_local' as const, childId: null };
      const log = [e('acc-g', acc), e('acc-rv', { ...acc, action: 'revoke' })];
      expect(ids(supersededEvents(log, new Set(['acc-rv'])))).toEqual(['acc-g']);
    });

    it('событие аккаунта не устаревает от доставленного события ребёнка', () => {
      const log = [e('acc-g', { scope: 'account_local', childId: null }), e('g1')];
      expect(ids(supersededEvents(log, new Set(['g1'])))).toEqual([]);
    });
  });

  it('consentPlan не включает устаревший grant после доставленного отзыва', () => {
    const log = [e('g1'), e('rv', { action: 'revoke' })];
    expect(consentPlan(log, new Set(['rv']), new Set())).toEqual([]);
  });

  /** Порт, отклоняющий одно событие `id` по существу; остальное принимает. */
  function refusingEvent(id: string, reason: SyncProblemCode = 'device_clock'): RemotePort {
    const { port, base } = recorder();
    return {
      ...port,
      pushCloudConsent: async (cmd, signal) => {
        if (cmd.event.id === id) throw new UndeliverableError(reason);
        await base.pushCloudConsent(cmd, signal);
      },
      pushConsentEvent: async (event, signal) => {
        if (event.id === id) throw new UndeliverableError(reason);
        await base.pushConsentEvent(event, signal);
      },
    };
  }

  describe('«повторить» на отклонённом согласии на облако после доставленного отзыва', () => {
    async function scenario() {
      const db = await memoryDb();
      await addRuns(db, 2);
      await appendConsentEvent(db, ev({ id: 'g1' }), 'owner');
      const refusing = refusingEvent('g1');
      await syncChild(db, refusing, 'kid-a', 'ru-1', NOW, OPTS);
      await appendConsentEvent(db, ev({ id: 'rv', action: 'revoke' }), 'owner');
      await syncChild(db, refusing, 'kid-a', 'ru-1', NOW, OPTS);
      await retrySyncProblem(db, 'kid-a', 'g1');
      return db;
    }

    it('следующий проход не отправляет ничего: ни open для g1, ни данные', async () => {
      const db = await scenario();
      const { port, sent } = recorder();

      await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS);

      expect(sent).toEqual({ cloud: [], events: [], runs: [], skills: 0 });
    });

    it('облако остаётся закрытым: проход сообщает, что данные заблокированы', async () => {
      const db = await scenario();
      const { port } = recorder();

      const report = await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS);

      expect(report).toMatchObject({ blocked: true, consent: 0, problem: false });
    });

    it('устаревшее событие не возвращается к родителю новой проблемой', async () => {
      const db = await scenario();
      const { port } = recorder();

      await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS);

      expect(await syncProblems(db)).toEqual([]);
    });
  });

  it('«повторить» на отклонённом согласии на ИИ после доставленного отзыва ничего не отправляет', async () => {
    const db = await memoryDb();
    await appendConsentEvent(db, ev({ id: 'g-1' }), 'owner');
    await appendConsentEvent(db, ev({ id: 'ai-g', scope: 'companion_ai' }), 'owner');
    const refusing = refusingEvent('ai-g');
    await syncChild(db, refusing, 'kid-a', 'ru-1', NOW, OPTS);
    await appendConsentEvent(db, ev({ id: 'ai-rv', scope: 'companion_ai', action: 'revoke' }), 'owner');
    await syncChild(db, refusing, 'kid-a', 'ru-1', NOW, OPTS);
    await retrySyncProblem(db, 'kid-a', 'ai-g');
    const { port, sent } = recorder();

    await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS);

    expect([sent.cloud, sent.events]).toEqual([[], []]);
  });

  it('«повторить» на отклонённом согласии аккаунта после доставленного отзыва ничего не отправляет', async () => {
    const db = await memoryDb();
    const acc = { scope: 'account_local' as const, childId: null };
    await appendConsentEvent(db, ev({ id: 'acc-g', ...acc, confirmedBy: 'signup' }), 'owner');
    const refusing = refusingEvent('acc-g');
    await syncAccount(db, refusing, NOW);
    // отзыв аккаунта приложение пишет только вместе с удалением аккаунта (№124), а синхронизация
    // должна быть готова к нему: событие — напрямую, в обход appendConsentEvent
    await db.transaction((tx) => insertConsentEvent(tx, ev({ id: 'acc-rv', ...acc, action: 'revoke' }), 'owner'));
    // предусловие: отзыв аккаунта доставлен
    expect(await syncAccount(db, refusing, NOW)).toBe(1);
    await retrySyncProblem(db, '', 'acc-g');
    const { port, sent } = recorder();

    const n = await syncAccount(db, port, NOW);

    expect([n, sent.events]).toEqual([0, []]);
  });

  it('событие другой области, отложенное до облачного согласия, после его доставки уходит', async () => {
    const db = await memoryDb();
    await appendConsentEvent(db, ev({ id: 'ai', scope: 'companion_ai' }), 'owner');
    await appendConsentEvent(db, ev({ id: 'g-1' }), 'owner');
    const { port, sent } = recorder();
    // облачное согласие доходит, отложенное согласие на ИИ обрывается сетью
    const eventsOffline: RemotePort = {
      ...port,
      pushConsentEvent: async () => {
        throw new Error('offline');
      },
    };
    await expect(syncChild(db, eventsOffline, 'kid-a', 'ru-1', NOW, OPTS)).rejects.toThrow('offline');

    await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS);

    expect([sent.cloud.map((c) => c.event.id), sent.events]).toEqual([['g-1'], ['ai']]);
  });
});

describe('разбор пачки по одной (B3)', () => {
  /** Пачка из нескольких строк отклоняется как плохие данные; одиночную сначала видит `single`. */
  function splitting(single: (id: string) => void) {
    const { port, sent, base } = recorder();
    const p: RemotePort = {
      ...port,
      pushLessonRuns: async (childId, runs, signal) => {
        if (runs.length > 1) throw new UndeliverableError('invalid_data');
        single(runs[0].id);
        await base.pushLessonRuns(childId, runs, signal);
      },
    };
    return { port: p, sent };
  }

  /** Родитель отзывает облако, пока уходит вторая одиночная строка. */
  async function revokeOnSecondSingle() {
    const db = await granted(5);
    const order: string[] = [];
    let revoke: Promise<void> | null = null;
    const { port, sent } = splitting((id) => {
      order.push(id);
      if (id === 'r-2') {
        revoke ??= appendConsentEvent(db, ev({ id: 'rv-1', action: 'revoke' }), 'owner').then(() => void order.push('revoke'));
      }
    });
    await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS);
    await revoke;
    return { order, sent };
  }

  it('отзыв во время разбора по одной записывается сразу, а не после всех строк', async () => {
    const { order } = await revokeOnSecondSingle();

    expect(order).toEqual(['r-1', 'r-2', 'revoke']);
  });

  it('после отзыва во время разбора по одной оставшиеся строки не уходят', async () => {
    const { sent } = await revokeOnSecondSingle();

    expect(sent.runs).toEqual([['r-1'], ['r-2']]);
  });

  /** Разбор по одной: r-1 доставлена, на r-2 — `fail`. Возвращает ошибку прохода или null. */
  async function failOnSecondSingle(fail: () => never) {
    const db = await granted(5);
    const { port } = splitting((id) => {
      if (id === 'r-2') fail();
    });
    const result = await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS).then(
      () => null,
      (err: unknown) => err,
    );
    return { db, result };
  }

  const noAccess = (): never => {
    throw new UndeliverableError('no_access');
  };
  const offline = (): never => {
    throw new Error('offline');
  };

  it('отказ потоку (no_access) во время разбора по одной — одна проблема потока, без проблем строк', async () => {
    const { db } = await failOnSecondSingle(noAccess);

    expect(await syncProblems(db)).toEqual([{ childId: 'kid-a', kind: 'lesson_runs', ref: 'lesson_runs', reason: 'no_access' }]);
  });

  it('отказ потоку во время разбора по одной не бросает', async () => {
    const { result } = await failOnSecondSingle(noAccess);

    expect(result).toBeNull();
  });

  it('после отказа потоку во время разбора курсор не уходит за недоставленные строки', async () => {
    const { db } = await failOnSecondSingle(noAccess);
    await retrySyncProblem(db, 'kid-a', 'lesson_runs');
    const { port, sent } = recorder();

    await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS);

    expect(sent.runs).toEqual([['r-2', 'r-3', 'r-4', 'r-5']]);
  });

  it('сбой сети во время разбора по одной — проход бросает', async () => {
    const { result } = await failOnSecondSingle(offline);

    expect(result).toEqual(new Error('offline'));
  });

  it('после сбоя сети во время разбора курсор стоит на последней доставленной строке', async () => {
    const { db } = await failOnSecondSingle(offline);
    const { port, sent } = recorder();

    await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS);

    expect(sent.runs).toEqual([['r-2', 'r-3', 'r-4', 'r-5']]);
  });

  it('сбой сети во время разбора по одной проблем к родителю не добавляет', async () => {
    const { db } = await failOnSecondSingle(offline);

    expect(await syncProblems(db)).toEqual([]);
  });
});

describe('проблема потока при открытой проблеме строки (M2)', () => {
  /**
   * У r-1 своя проблема `lesson_run`; затем отзыв и новое согласие сбрасывают курсор, и
   * пачка с r-1 отклонена `outdated_text`.
   */
  async function scenario() {
    const db = await granted(3);
    const { port: picky } = recorder({
      pushLessonRuns: async (_, runs) => {
        if (runs.some((r) => r.id === 'r-1')) throw new UndeliverableError('invalid_data');
      },
    });
    await syncChild(db, picky, 'kid-a', 'ru-1', NOW, OPTS);
    await appendConsentEvent(db, ev({ id: 'rv-1', action: 'revoke' }), 'owner');
    await appendConsentEvent(db, ev({ id: 'g-2' }), 'owner');
    let calls = 0;
    const { port: refusing } = recorder({
      pushLessonRuns: async () => {
        calls += 1;
        throw new UndeliverableError('outdated_text');
      },
    });
    await syncChild(db, refusing, 'kid-a', 'ru-1', NOW, OPTS);
    return { db, refusing, calls: () => calls };
  }

  it('появляется проблема потока с ref по имени потока', async () => {
    const { db } = await scenario();

    expect(await syncProblems(db)).toContainEqual({
      childId: 'kid-a',
      kind: 'lesson_runs',
      ref: 'lesson_runs',
      reason: 'outdated_text',
    });
  });

  it('поток заблокирован: следующий проход pushLessonRuns не вызывает', async () => {
    const { db, refusing, calls } = await scenario();
    const before = calls();

    await syncChild(db, refusing, 'kid-a', 'ru-1', NOW, OPTS);

    expect(calls()).toBe(before);
  });
});

describe('очередь переотправки (L4)', () => {
  const TOTAL = LESSON_RUNS_BATCH + 5;

  /** Все прохождения отклонены по одной, затем новое согласие ставит их все на переотправку. */
  async function allQueued() {
    const db = await granted(TOTAL);
    const { port: refusing } = recorder({
      pushLessonRuns: async () => {
        throw new UndeliverableError('invalid_data');
      },
    });
    await syncChild(db, refusing, 'kid-a', 'ru-1', NOW, OPTS);
    // предусловие: каждое прохождение — своя проблема
    expect(await syncProblems(db)).toHaveLength(TOTAL);
    await appendConsentEvent(db, ev({ id: 'g-2' }), 'owner');
    return db;
  }

  it(`за проход переотправляется не больше ${LESSON_RUNS_BATCH} прохождений`, async () => {
    const db = await allQueued();
    const { port, sent } = recorder();

    await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS);

    expect(sent.runs).toHaveLength(LESSON_RUNS_BATCH);
  });

  it('остаток очереди уходит следующим проходом, каждое прохождение — один раз', async () => {
    const db = await allQueued();
    const { port, sent } = recorder();
    await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS);

    await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS);

    expect(sent.runs.flat().sort()).toEqual(Array.from({ length: TOTAL }, (_, i) => `r-${i + 1}`).sort());
  });
});

describe('«повторить» прохождение при отозванном облаке (child-privacy-compliance)', () => {
  /** r-2 отклонена по существу, облако отозвано (отзыв доставлен), затем родитель жмёт «повторить». */
  async function retriedAfterRevoke() {
    const db = await granted(3);
    const { port: picky } = recorder({
      pushLessonRuns: async (_, runs) => {
        if (runs.some((r) => r.id === 'r-2')) throw new UndeliverableError('invalid_data');
      },
    });
    await syncChild(db, picky, 'kid-a', 'ru-1', NOW, OPTS);
    await appendConsentEvent(db, ev({ id: 'rv-1', action: 'revoke' }), 'owner');
    await syncChild(db, recorder().port, 'kid-a', 'ru-1', NOW, OPTS);
    await retrySyncProblem(db, 'kid-a', 'r-2');
    return db;
  }

  it('при отозванном согласии на облако «повторить» ничего не отправляет', async () => {
    const db = await retriedAfterRevoke();
    const { port, sent } = recorder();

    await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS);

    expect(sent).toEqual({ cloud: [], events: [], runs: [], skills: 0 });
  });

  it('после нового согласия на облако повторённое прохождение уходит', async () => {
    const db = await retriedAfterRevoke();
    await appendConsentEvent(db, ev({ id: 'g-2' }), 'owner');
    const { port, sent } = recorder();

    await syncChild(db, port, 'kid-a', 'ru-1', NOW, OPTS);

    expect(sent.runs.flat()).toContain('r-2');
  });
});
