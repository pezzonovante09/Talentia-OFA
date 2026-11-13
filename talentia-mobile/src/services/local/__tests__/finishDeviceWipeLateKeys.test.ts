/**
 * №148, коммит 8db6ddc: `finishDeviceWipe` перечитывает ключи AsyncStorage перед финальной
 * очисткой — ключ `talentia:…`, записанный, пока удаление уже идёт (экран дописал настройку,
 * таймер сохранил черновик), тоже снят. Поздняя запись внедряется в шаг удаления после первого
 * чтения ключей (`deleteCacheDir`).
 */
import { CURRENT_ACCOUNT_KEY } from '../account';
import { knownAccountKey, secureKeys, WIPE_PENDING_KEY } from '../device';
import { finishDeviceWipe } from '../deleteEverywhere';
import { fakeDevice, type FakeDevice } from '../../../test/fakeDevice';

const ACC = '0a1b2c3d-0000-4000-8000-0000000000c1';

function device(): FakeDevice {
  const d = fakeDevice();
  d.storage.set(CURRENT_ACCOUNT_KEY, ACC);
  d.storage.set(knownAccountKey(ACC), '1');
  d.storage.set(WIPE_PENDING_KEY, ACC);
  d.storage.set('talentia:child:kid:settings', '{}');
  d.storage.set('other-app', 'keep');
  for (const k of secureKeys(ACC)) d.secure.set(k, '{}');
  return d;
}

/** Первый `deleteCacheDir` (уже после `device.keys()`) дописывает ключ. */
function writeLate(d: FakeDevice, key: string) {
  const orig = d.deleteCacheDir;
  let done = false;
  d.deleteCacheDir = async (p) => {
    if (!done) {
      done = true;
      d.storage.set(key, 'late');
    }
    return orig(p);
  };
}

describe('finishDeviceWipe: ключи, записанные после начала удаления', () => {
  it('поздний ключ talentia:child:… снят, чужой ключ на месте', async () => {
    const d = device();
    writeLate(d, 'talentia:child:kid:lessonResume');
    await finishDeviceWipe(d, ACC);
    expect([...d.storage.keys()]).toEqual(['other-app']);
  });

  it('поздний ключ, которого не было при первом чтении, снят до метки: метка снимается последней', async () => {
    const d = device();
    writeLate(d, 'talentia:account:late');
    const removed: string[][] = [];
    const orig = d.removeKeys;
    d.removeKeys = async (ks) => {
      removed.push([...ks]);
      return orig(ks);
    };
    await finishDeviceWipe(d, ACC);
    const lateAt = removed.findIndex((ks) => ks.includes('talentia:account:late'));
    const markAt = removed.findIndex((ks) => ks.includes(WIPE_PENDING_KEY));
    expect(lateAt).toBeGreaterThanOrEqual(0);
    expect(lateAt).toBeLessThan(markAt);
  });

  it('поздний чужой ключ (не talentia:) не тронут', async () => {
    const d = device();
    writeLate(d, 'other-late');
    await finishDeviceWipe(d, ACC);
    expect([...d.storage.keys()].sort()).toEqual(['other-app', 'other-late']);
  });

  /**
   * Регрессия (исправлено 2026-10-25): очередь телеметрии снимается по **первому** чтению ключей
   * (deleteEverywhere.ts:174, `keys.filter(...TELEMETRY_KEY_PREFIX)`), а финальная очистка по свежему
   * чтению телеметрию исключает (deleteEverywhere.ts:182). Ключ `talentia:telemetry:…`, записанный
   * после начала удаления, остаётся на устройстве после «Удалить аккаунт». Сейчас писателя
   * телеметрии в коде нет — дыра латентная, откроется вместе с очередью.
   */
  it('поздний ключ talentia:telemetry:… тоже снят', async () => {
    const d = device();
    writeLate(d, 'talentia:telemetry:q');
    await finishDeviceWipe(d, ACC);
    expect([...d.storage.keys()]).toEqual(['other-app']);
  });
});
