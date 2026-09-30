import type { AbaTrial } from '../../../types/aba';
import { appendTrial, trialsOfTarget } from '../abaLog';
import { appendConsentEvent, readConsentLog } from '../consentLog';
import type { CleanedPart, DeviceStore } from '../device';
import { deleteChildEverywhere, wipeAccountEverywhere } from '../deleteEverywhere';
import { memoryDb } from './nodeSql';

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
    deleteCacheDir: async (p) => void calls.push(`dir:${p.join('/')}`),
    cancelChildNotifications: async (id) => void calls.push(`notify:${id}`),
    cancelAllNotifications: async () => void calls.push('notify:*'),
  };
  return { device, calls, remaining: () => store };
}

async function filled() {
  const db = await memoryDb();
  await appendTrial(db, 'kid-a', trial, NOW);
  await appendTrial(db, 'kid-b', { ...trial, id: 'tr-2' }, NOW);
  await appendConsentEvent(db, {
    id: 'g',
    scope: 'cloud_sync',
    action: 'grant',
    childId: 'kid-a',
    textVersion: 'ru-1',
    confirmedBy: 'pin',
    actorId: 'parent',
    at: NOW,
  });
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
    expect((await readConsentLog(db))[0].childId).toBe(PSEUDO);
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
