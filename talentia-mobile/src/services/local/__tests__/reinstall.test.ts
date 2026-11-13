/** №157: на iOS Keychain переживает удаление приложения — первый запуск после переустановки стирает старые хеши PIN. */
import { createHash } from 'node:crypto';

import type { Digest } from '../../../domain/parentGate';
import { fakeDevice } from '../../../test/fakeDevice';
import { clearAfterReinstall, createLocalAccount } from '../account';
import { INSTALL_MARK_KEY, SECURE_ACCOUNTS_KEY, secureKeys } from '../device';

const digest: Digest = async (x) => createHash('sha256').update(x).digest('hex');
let counter = 0;
const randomBytes = (n: number) => Uint8Array.from({ length: n }, (_, i) => (i * 31 + ++counter) & 0xff);

describe('чистка после переустановки (№157)', () => {
  it('переустановка: AsyncStorage пуст, Keychain остался — хеши PIN и реестр стёрты, метка поставлена', async () => {
    const d = fakeDevice();
    const a = await createLocalAccount(d, '295173', { randomBytes, digest });
    d.secure.set('чужой.ключ', 'x');
    d.storage.clear(); // удаление приложения: AsyncStorage уходит, Keychain нет
    await clearAfterReinstall(d);
    expect(secureKeys(a).some((k) => d.secure.has(k))).toBe(false);
    expect(d.secure.has(SECURE_ACCOUNTS_KEY)).toBe(false);
    expect(d.secure.get('чужой.ключ')).toBe('x');
    expect(d.storage.get(INSTALL_MARK_KEY)).toBe('1');
  });

  it('обновление без переустановки: ключи есть, метки нет — PIN цел, ставится только метка', async () => {
    const d = fakeDevice();
    const a = await createLocalAccount(d, '295173', { randomBytes, digest });
    await clearAfterReinstall(d);
    expect(d.secure.has(secureKeys(a)[0])).toBe(true);
    expect(d.storage.get(INSTALL_MARK_KEY)).toBe('1');
  });

  it('метка есть — ничего не трогает; битый реестр — не падает', async () => {
    const d = fakeDevice();
    d.secure.set(SECURE_ACCOUNTS_KEY, '{не json');
    await clearAfterReinstall(d);
    expect(d.storage.get(INSTALL_MARK_KEY)).toBe('1');
    d.secure.set('talentia.x.pin', 'h');
    d.storage.clear();
    d.storage.set(INSTALL_MARK_KEY, '1');
    await clearAfterReinstall(d);
    expect(d.secure.get('talentia.x.pin')).toBe('h');
  });
});
