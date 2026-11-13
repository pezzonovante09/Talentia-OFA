/**
 * «Выгрузить для специалиста» файлом (№168, вопрос 67): порядок «очистить → записать → лист → очистить», удаление в
 * `finally` при успехе, отмене и ошибке, имя файла без `childId`, возвраты. `expo-file-system` и `expo-sharing` —
 * моки с журналом вызовов, порт устройства — `fakeDevice()`. Плюс пункт m5 вопроса 54: отзыв и очистка прогресса
 * снимают каталог экспорта, когда им передан порт устройства.
 */
import { CURRENT_CONSENT_TEXTS } from '../../../domain/consentTexts';
import type { ConsentEvent } from '../../../domain/consent';
import { appendConsentEvent } from '../consentLog';
import { EXPORT_DIR } from '../device';
import { clearChildProgress, revokeAbaProcessing } from '../purge';
import { ABA_EXPORT_FILE_ENABLED, exportFileName, shareSpecialistExport } from '../shareSpecialistExport';
import type { SqlDb } from '../sql';
import { fakeDevice, type FakeDevice } from '../../../test/fakeDevice';
import { memoryDb } from './nodeSql';

/** Журнал событий всех трёх сторон: порт устройства, файловая система, лист. */
const events: string[] = [];

jest.mock('expo-file-system', () => {
  class Directory {
    parts: string[];
    constructor(...p: (string | Directory)[]) {
      this.parts = p.flatMap((x) => (typeof x === 'string' ? [x] : x.parts));
    }
    get uri() {
      return this.parts.join('/');
    }
    create(opts?: unknown) {
      events.push(`mkdir:${this.uri}:${JSON.stringify(opts)}`);
    }
  }
  class File {
    parts: string[];
    constructor(...p: (string | Directory | File)[]) {
      this.parts = p.flatMap((x) => (typeof x === 'string' ? [x] : x.parts));
    }
    get uri() {
      return this.parts.join('/');
    }
    write(content: string) {
      events.push(`write:${this.uri}`);
      written.push({ uri: this.uri, content });
    }
  }
  const written: { uri: string; content: string }[] = [];
  return { Paths: { cache: new Directory('cache') }, Directory, File, __written: written };
});

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => {
    events.push('share');
  }),
}));

const fs = jest.requireMock('expo-file-system') as { __written: { uri: string; content: string }[] };
const sharing = jest.requireMock('expo-sharing') as { isAvailableAsync: jest.Mock; shareAsync: jest.Mock };

const KID = '00000000-0000-4000-8000-0000000000c1';
const NOW = '2026-11-01T14:37:21.000Z';
const grant = (childId = KID): ConsentEvent => ({
  id: `aba-grant-${childId}`,
  scope: 'aba_processing',
  action: 'grant',
  childId,
  textVersion: CURRENT_CONSENT_TEXTS.aba_processing[0],
  confirmedBy: 'pin',
  actorId: 'parent',
  at: '2026-11-01T09:00:00Z',
});
const revoke = (childId = KID): ConsentEvent => ({ ...grant(childId), id: `aba-revoke-${childId}`, action: 'revoke', at: NOW });

/** Порт устройства с журналом очисток каталога. */
function loggingDevice(): FakeDevice {
  const d = fakeDevice();
  const orig = d.deleteCacheDir;
  d.deleteCacheDir = async (path) => {
    events.push(`clear:${path.join('/')}`);
    await orig(path);
  };
  return d;
}

let db: SqlDb;
let device: FakeDevice;

beforeEach(async () => {
  events.length = 0;
  fs.__written.length = 0;
  sharing.isAvailableAsync.mockReset().mockResolvedValue(true);
  sharing.shareAsync.mockReset().mockImplementation(async () => {
    events.push('share');
  });
  db = await memoryDb();
  await appendConsentEvent(db, grant(), 'owner');
  device = loggingDevice();
});

describe('shareSpecialistExport: порядок и удаление файла', () => {
  it('флаг файла включён (решение владельца 2026-11-01)', () => {
    expect(ABA_EXPORT_FILE_ENABLED).toBe(true);
  });

  it('успех: каталог очищен до записи, файл записан, лист, каталог очищен снова; результат shared', async () => {
    await expect(shareSpecialistExport(db, KID, device, NOW)).resolves.toBe('shared');
    expect(events).toEqual([
      'clear:export',
      'mkdir:cache/export:{"intermediates":true,"idempotent":true}',
      `write:cache/export/talentia-aba-2026-11-01.json`,
      'share',
      'clear:export',
    ]);
  });

  it('лист получает путь к файлу и mime application/json', async () => {
    await shareSpecialistExport(db, KID, device, NOW);
    expect(sharing.shareAsync).toHaveBeenCalledWith('cache/export/talentia-aba-2026-11-01.json', { mimeType: 'application/json', UTI: 'public.json' });
  });

  it('в файле — JSON выгрузки специалисту с exportedAt-днём, без childId', async () => {
    await shareSpecialistExport(db, KID, device, NOW);
    const [file] = fs.__written;
    const parsed = JSON.parse(file.content) as { exportedAt: string; abaTrials: unknown[] };
    expect(parsed.exportedAt).toBe('2026-11-01');
    expect(parsed.abaTrials).toEqual([]);
    expect(file.content).not.toContain(KID);
  });

  it('имя файла — только день, без childId и без индекса ребёнка', () => {
    expect(exportFileName('2026-11-01')).toBe('talentia-aba-2026-11-01.json');
    expect(exportFileName('2026-11-01T14:37:21.000Z')).toBe('talentia-aba-2026-11-01.json');
    expect(exportFileName(NOW)).not.toContain(KID);
  });

  it('отмена (AbortError листа): каталог всё равно очищен в finally, результат cancelled', async () => {
    sharing.shareAsync.mockImplementation(async () => {
      events.push('share');
      const e = new Error('Share canceled');
      e.name = 'AbortError';
      throw e;
    });
    await expect(shareSpecialistExport(db, KID, device, NOW)).resolves.toBe('cancelled');
    expect(events.at(-1)).toBe('clear:export');
    expect(events.filter((e) => e === 'clear:export')).toHaveLength(2);
  });

  it('другая ошибка листа: пробрасывается, каталог очищен в finally', async () => {
    sharing.shareAsync.mockImplementation(async () => {
      throw new Error('нет приложения, принимающего файл');
    });
    await expect(shareSpecialistExport(db, KID, device, NOW)).rejects.toThrow(/нет приложения/);
    expect(events.at(-1)).toBe('clear:export');
    expect(events.filter((e) => e === 'clear:export')).toHaveLength(2);
  });

  it('лист недоступен: unavailable, файл не пишется, устройства не касаемся', async () => {
    sharing.isAvailableAsync.mockResolvedValue(false);
    await expect(shareSpecialistExport(db, KID, device, NOW)).resolves.toBe('unavailable');
    expect(events).toEqual([]);
    expect(fs.__written).toEqual([]);
  });

  it('без согласия на ABA действующей версии — no_consent до чтения журналов, ничего не записано и не показано', async () => {
    const other = await memoryDb();
    expect(await shareSpecialistExport(other, KID, device, NOW)).toBe('no_consent');
    expect(fs.__written).toEqual([]);
    expect(sharing.shareAsync).not.toHaveBeenCalled();
  });

  it('сбой базы при сборке — ошибка до записи, каталог чист', async () => {
    const other = await memoryDb();
    await appendConsentEvent(other, grant(), 'owner');
    const broken = { ...other, transaction: async () => { throw new Error('база недоступна'); } } as unknown as SqlDb;
    await expect(shareSpecialistExport(broken, KID, device, NOW)).rejects.toThrow(/база недоступна/);
    expect(fs.__written).toEqual([]);
  });
});

describe('отзыв и очистка прогресса снимают каталог экспорта (вопрос 54, m5)', () => {
  const stale = `${EXPORT_DIR.join('/')}/talentia-aba-2026-10-30.json`;

  it('revokeAbaProcessing с портом устройства удаляет файл экспорта', async () => {
    device.cache.add(stale);
    device.cache.add('voice/child/x/a.mp3');
    await revokeAbaProcessing(db, revoke(), 'owner', device);
    expect([...device.cache]).toEqual(['voice/child/x/a.mp3']);
    expect(events).toEqual(['clear:export']);
  });

  it('clearChildProgress с портом устройства удаляет файл экспорта', async () => {
    device.cache.add(stale);
    await clearChildProgress(db, KID, device);
    expect(device.cache.has(stale)).toBe(false);
    expect(events).toEqual(['clear:export']);
  });

  it('без порта устройства обе функции работают как прежде', async () => {
    await expect(clearChildProgress(db, KID)).resolves.toBeUndefined();
    await expect(revokeAbaProcessing(db, revoke(), 'owner')).resolves.toBeUndefined();
    expect(events).toEqual([]);
  });
});
