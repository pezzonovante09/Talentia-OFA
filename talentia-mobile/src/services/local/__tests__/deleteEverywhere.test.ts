import type { AbaTrial } from '../../../types/aba';
import { appendTrial, trialsOfTarget } from '../abaLog';
import { appendConsentEvent, readConsentLog } from '../consentLog';
import type { CleanedPart, DeviceStore } from '../device';
import { deleteChildEverywhere, undeliveredRevocations, wipeAccountEverywhere } from '../deleteEverywhere';
import type { ConsentEvent } from '../../../domain/consent';
import { revokeAbaProcessing } from '../purge';
import { asAbaWriter, memoryDb } from './nodeSql';

const PSEUDO = '5f0c2a8e-3b1d-4c6e-9a7f-2d8b1e4c7a90';
const NOW = '2026-09-30T10:00:00Z';

const trial: AbaTrial = {
  id: 'tr-1',
  sessionId: 's',
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
};

function fakeDevice(keys: string[]) {
  const calls: string[] = [];
  let store = [...keys];
  const device: DeviceStore = {
    keys: async () => store,
    removeKeys: async (ks) => {
      calls.push(`keys:${[...ks].sort().join(',')}`);
      store = store.filter((k) => !ks.includes(k));
    },
    removeSecure: async (ks) => void calls.push(`secure:${ks.join(',')}`),
    getItem: async () => null,
    setItem: async () => undefined,
    getSecure: async () => null,
    setSecure: async () => undefined,
    deleteCacheDir: async (p) => void calls.push(`dir:${p.join('/')}`),
    cancelChildNotifications: async (id) => void calls.push(`notify:${id}`),
    cancelAllNotifications: async () => void calls.push('notify:*'),
  };
  return { device, calls, remaining: () => store };
}

async function filled() {
  const db = await memoryDb();
  await asAbaWriter(db, 'kid-a', (tx) => appendTrial(tx, 'kid-a', trial, NOW));
  await asAbaWriter(db, 'kid-b', (tx) => appendTrial(tx, 'kid-b', { ...trial, id: 'tr-2' }, NOW));
  await appendConsentEvent(db, {
    id: 'g',
    scope: 'cloud_sync',
    action: 'grant',
    childId: 'kid-a',
    textVersion: 'ru-1',
    confirmedBy: 'pin',
    actorId: 'parent',
    at: NOW,
  }, 'owner');
  return db;
}

const KEYS = ['talentia:child:kid-a:settings', 'talentia:child:kid-b:settings', 'talentia:telemetry:q', 'other-app'];

describe('удаление ребёнка везде', () => {
  it('отзыв на сервер, база, ключи, кеш озвучки, экспорт, уведомления — всё и по порядку', async () => {
    const db = await filled();
    const { device, calls, remaining } = fakeDevice(KEYS);
    const order: string[] = [];
    const done = await deleteChildEverywhere({
      db,
      device,
      childId: 'kid-a',
      pseudonym: PSEUDO,
      deliverRevocation: async () => {
        order.push('server');
        return true;
      },
    });
    const required: CleanedPart[] = ['server_revocation', 'sqlite', 'async_storage', 'voice_cache', 'export_file', 'notifications'];
    expect(done).toEqual(required);
    expect(order).toEqual(['server']);
    expect(await trialsOfTarget(db, 'kid-a', 't')).toEqual([]);
    expect(await trialsOfTarget(db, 'kid-b', 't')).toHaveLength(1);
    expect((await readConsentLog(db)).find((e) => e.scope !== 'account_local')?.childId).toBe(PSEUDO);
    expect(remaining()).toEqual(['talentia:child:kid-b:settings', 'talentia:telemetry:q', 'other-app']);
    expect(calls).toEqual(
      expect.arrayContaining(['dir:voice/child/kid-a', 'dir:export', 'notify:kid-a']),
    );
  });

  it('отзыв не дошёл до сервера — не удаляется ничего', async () => {
    const db = await filled();
    const { device, calls } = fakeDevice(KEYS);
    await expect(
      deleteChildEverywhere({ db, device, childId: 'kid-a', pseudonym: PSEUDO, deliverRevocation: async () => false }),
    ).rejects.toThrow(/со связью/);
    expect(await trialsOfTarget(db, 'kid-a', 't')).toHaveLength(1);
    expect(calls).toEqual([]);
  });
});

describe('удаление аккаунта везде', () => {
  it('строки, файл базы, ключи приложения, PIN, кеш, экспорт, уведомления, телеметрия', async () => {
    const db = await filled();
    const { device, calls, remaining } = fakeDevice(KEYS);
    let fileDeleted = false;
    const done = await wipeAccountEverywhere({
      db,
      device,
      accountId: 'acc-123456',
      deleteDbFile: async () => {
        fileDeleted = true;
      },
      deliverRevocations: async () => true,
    });
    expect(new Set(done)).toEqual(
      new Set(['sqlite', 'async_storage', 'telemetry_queue', 'secure_store', 'voice_cache', 'export_file', 'notifications']),
    );
    expect(fileDeleted).toBe(true);
    expect(await readConsentLog(db)).toEqual([]);
    expect(remaining()).toEqual(['other-app']);
    expect(calls).toEqual(expect.arrayContaining(['secure:talentia.acc-123456.pin,talentia.acc-123456.lockout', 'notify:*']));
  });
});

describe('удаление аккаунта: недоставленные отзывы сначала на сервер (раунд 4, приватность В4)', () => {
  const revoke = (id: string, scope: 'cloud_sync' | 'companion_ai' | 'aba_processing', childId = 'kid-a') =>
    ({ id, scope, action: 'revoke', childId, textVersion: 'ru-1', confirmedBy: 'pin', actorId: 'parent', at: '2026-09-30T11:00:00Z' }) as const;

  const grant = (id: string, scope: 'cloud_sync' | 'companion_ai', childId = 'kid-a') =>
    ({ ...revoke(id, scope, childId), action: 'grant', at: '2026-09-30T10:00:00Z' }) as const;

  async function withRevokes() {
    const db = await filled();
    // grant облака доставлен — на сервере есть что отзывать
    await appendConsentEvent(db, grant('g-cloud', 'cloud_sync'), 'owner');
    await db.run('INSERT INTO consent_delivered (id, delivered_at) VALUES (?, ?)', ['g-cloud', NOW]);
    await appendConsentEvent(db, revoke('r-cloud', 'cloud_sync'), 'owner');
    await appendConsentEvent(db, revoke('r-ai-done', 'companion_ai'), 'owner');
    await db.run('INSERT INTO consent_delivered (id, delivered_at) VALUES (?, ?)', ['r-ai-done', NOW]);
    // отзыв ABA — только на устройстве: на сервер не уходит (ребёнок без данных ABA)
    await revokeAbaProcessing(db, revoke('r-aba', 'aba_processing', 'kid-c'), 'owner');
    return db;
  }
  const wipe = (db: Awaited<ReturnType<typeof filled>>, deliverRevocations: (e: ConsentEvent[]) => Promise<boolean>) => {
    const { device, calls } = fakeDevice(KEYS);
    let fileDeleted = false;
    const run = wipeAccountEverywhere({
      db,
      device,
      accountId: 'acc-123456',
      deleteDbFile: async () => {
        fileDeleted = true;
      },
      deliverRevocations,
    });
    return { run, calls, fileDeleted: () => fileDeleted };
  };

  it('undeliveredRevocations: только недоставленные отзывы не-локальных областей', async () => {
    const db = await withRevokes();
    expect((await undeliveredRevocations(db)).map((e) => e.id)).toEqual(['r-cloud']);
  });

  it('недоставленный отзыв облака передаётся deliverRevocations, после подтверждения — удаление', async () => {
    const db = await withRevokes();
    const sent: string[][] = [];
    const w = wipe(db, async (events) => {
      sent.push(events.map((e) => e.id));
      return true;
    });
    await w.run;
    expect(sent).toEqual([['r-cloud']]);
    expect(w.fileDeleted()).toBe(true);
    expect(await readConsentLog(db)).toEqual([]);
  });

  it.each([
    ['false', async () => false],
    ['ошибка', async () => Promise.reject(new Error('нет сети'))],
  ])('доставка: %s — не удалено ничего', async (_, deliver) => {
    const db = await withRevokes();
    const w = wipe(db, deliver);
    await expect(w.run).rejects.toThrow();
    expect([w.fileDeleted(), w.calls]).toEqual([false, []]);
    expect(await trialsOfTarget(db, 'kid-a', 't')).toHaveLength(1);
    expect((await readConsentLog(db)).map((e) => e.id)).toContain('r-cloud');
  });

  // раунд 5, приватность В1 = бэкенд В1: отзывы, которые сервер не примет никогда, удаление не блокируют
  it.each([
    [
      'отзыв ИИ ребёнка без облака',
      async (db: Awaited<ReturnType<typeof filled>>) => {
        await appendConsentEvent(db, grant('g-ai', 'companion_ai', 'kid-b'), 'owner');
        await appendConsentEvent(db, revoke('r-ai', 'companion_ai', 'kid-b'), 'owner');
      },
    ],
    [
      'отзыв облака, чей grant до сервера не дошёл',
      async (db: Awaited<ReturnType<typeof filled>>) => {
        await appendConsentEvent(db, grant('g-off', 'cloud_sync', 'kid-b'), 'owner');
        await appendConsentEvent(db, revoke('r-off', 'cloud_sync', 'kid-b'), 'owner');
      },
    ],
    [
      'отзыв, отклонённый сервером по существу (sync_problems)',
      async (db: Awaited<ReturnType<typeof filled>>) => {
        await appendConsentEvent(db, grant('g-fail', 'cloud_sync', 'kid-b'), 'owner');
        await db.run('INSERT INTO consent_delivered (id, delivered_at) VALUES (?, ?)', ['g-fail', NOW]);
        await appendConsentEvent(db, revoke('r-fail', 'cloud_sync', 'kid-b'), 'owner');
        await db.run(
          "INSERT INTO sync_problems (child_id, event_id, reason, noticed_at, kind) VALUES ('kid-b', 'r-fail', 'child_gone', ?, 'consent')",
          [NOW],
        );
      },
    ],
  ])('%s — удаление идёт без связи', async (_, setup) => {
    const db = await filled();
    await setup(db);
    expect(await undeliveredRevocations(db)).toEqual([]);
    const deliver = jest.fn(async () => false);
    const w = wipe(db, deliver);
    await w.run;
    expect(deliver).not.toHaveBeenCalled();
    expect(w.fileDeleted()).toBe(true);
  });

  it('недоставленных нет — deliverRevocations не вызывается, удаление идёт и без связи', async () => {
    const db = await filled();
    const deliver = jest.fn(async () => false);
    const w = wipe(db, deliver);
    await w.run;
    expect(deliver).not.toHaveBeenCalled();
    expect(w.fileDeleted()).toBe(true);
  });
});
