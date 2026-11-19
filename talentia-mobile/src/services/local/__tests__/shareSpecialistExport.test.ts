/**
 * «Выгрузить для специалиста» файлом (№168, вопрос 67; вопросы 117–119): одна выгрузка — два файла (отчёт HTML и
 * JSON) в новом подкаталоге; лист отдаёт один из них; сразу после листа ничего не стирается (вопрос 117), каталог
 * снимается в начале следующей, другой выгрузки; та же выгрузка второй кнопкой отдаёт соседний файл без
 * перезаписи. Имена без `childId`, день — местный (вопрос 119). `expo-file-system` и `expo-sharing` — моки с
 * журналом вызовов, порт устройства — `fakeDevice()`. Плюс пункт m5 вопроса 54: отзыв и очистка прогресса снимают
 * каталог экспорта, когда им передан порт устройства.
 */
import { CURRENT_CONSENT_TEXTS } from '../../../domain/consentTexts';
import type { ConsentEvent } from '../../../domain/consent';
import { appendConsentEvent } from '../consentLog';
import { EXPORT_DIR } from '../device';
import { clearChildProgress, revokeAbaProcessing } from '../purge';
import {
  ABA_EXPORT_FILE_ENABLED,
  exportFileName,
  reportFileName,
  resetPreparedExport,
  shareSpecialistExport,
  type ShareSpecialistExportOptions,
} from '../shareSpecialistExport';
import type { SqlDb } from '../sql';
import { fakeDevice, type FakeDevice } from '../../../test/fakeDevice';
import { reportT } from '../../../test/reportT';
import { memoryDb } from './nodeSql';

/** Журнал событий всех трёх сторон: порт устройства, файловая система, лист. */
const events: string[] = [];

jest.mock('expo-file-system', () => {
  /** Файлы на «диске» мока: uri → содержимое. Очистка каталога порта устройства снимает их по префиксу. */
  const disk = new Map<string, string>();
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
    get exists() {
      return disk.has(this.uri);
    }
    write(content: string) {
      events.push(`write:${this.uri}`);
      disk.set(this.uri, content);
    }
  }
  return { Paths: { cache: new Directory('cache') }, Directory, File, __disk: disk };
});

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => {
    events.push('share');
  }),
}));

const fs = jest.requireMock('expo-file-system') as { __disk: Map<string, string> };
const sharing = jest.requireMock('expo-sharing') as { isAvailableAsync: jest.Mock; shareAsync: jest.Mock };

const KID = '00000000-0000-4000-8000-0000000000c1';
const KID_B = '00000000-0000-4000-8000-0000000000c2';
const NOW = '2026-11-01T09:37:21.000Z';
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

/** Порт устройства с журналом очисток каталога; очистка снимает и файлы мока. */
function loggingDevice(): FakeDevice {
  const d = fakeDevice();
  const orig = d.deleteCacheDir;
  d.deleteCacheDir = async (path) => {
    events.push(`clear:${path.join('/')}`);
    const prefix = `cache/${path.join('/')}/`;
    for (const uri of [...fs.__disk.keys()]) if (uri.startsWith(prefix)) fs.__disk.delete(uri);
    await orig(path);
  };
  return d;
}

let db: SqlDb;
let device: FakeDevice;
let folders = 0;
const t = reportT();
const opts = (o: Partial<ShareSpecialistExportOptions> = {}): ShareSpecialistExportOptions => ({ t, lang: 'ru', folderId: () => `F${++folders}`, ...o });
const sharedUris = () => sharing.shareAsync.mock.calls.map((c) => c[0] as string);

beforeEach(async () => {
  events.length = 0;
  fs.__disk.clear();
  folders = 0;
  resetPreparedExport();
  sharing.isAvailableAsync.mockReset().mockResolvedValue(true);
  sharing.shareAsync.mockReset().mockImplementation(async () => {
    events.push('share');
  });
  db = await memoryDb();
  await appendConsentEvent(db, grant(), 'owner');
  device = loggingDevice();
});

describe('shareSpecialistExport: два файла, лист, без удаления сразу после листа', () => {
  it('флаг файла включён (решение владельца 2026-11-01)', () => {
    expect(ABA_EXPORT_FILE_ENABLED).toBe(true);
  });

  it('отчёт: каталог очищен до записи, оба файла в новом подкаталоге, лист с HTML; после листа ничего не стирается', async () => {
    await expect(shareSpecialistExport(db, KID, device, NOW, opts())).resolves.toBe('shared');
    expect(events).toEqual([
      'clear:export',
      'mkdir:cache/export/F1:{"intermediates":true,"idempotent":true}',
      'write:cache/export/F1/talentia-aba-2026-11-01.html',
      'write:cache/export/F1/talentia-aba-2026-11-01.json',
      'share',
    ]);
    expect(sharing.shareAsync).toHaveBeenCalledWith('cache/export/F1/talentia-aba-2026-11-01.html', { mimeType: 'text/html', UTI: 'public.html' });
    expect([...fs.__disk.keys()]).toEqual(['cache/export/F1/talentia-aba-2026-11-01.html', 'cache/export/F1/talentia-aba-2026-11-01.json']);
  });

  it('файл данных той же выгрузки — соседний JSON, без очистки и без перезаписи: отчёт первого получателя цел', async () => {
    await shareSpecialistExport(db, KID, device, NOW, opts());
    events.length = 0;
    await expect(shareSpecialistExport(db, KID, device, NOW, opts({ kind: 'data' }))).resolves.toBe('shared');
    expect(events).toEqual(['share']);
    expect(sharing.shareAsync).toHaveBeenLastCalledWith('cache/export/F1/talentia-aba-2026-11-01.json', { mimeType: 'application/json', UTI: 'public.json' });
    expect(fs.__disk.has('cache/export/F1/talentia-aba-2026-11-01.html')).toBe(true);
  });

  it('другой ребёнок — прошлые файлы прочь в начале выгрузки, новый подкаталог', async () => {
    await appendConsentEvent(db, grant(KID_B), 'owner');
    await shareSpecialistExport(db, KID, device, NOW, opts());
    events.length = 0;
    await shareSpecialistExport(db, KID_B, device, NOW, opts({ kind: 'data' }));
    expect(events[0]).toBe('clear:export');
    expect(sharedUris().at(-1)).toBe('cache/export/F2/talentia-aba-2026-11-01.json');
    expect([...fs.__disk.keys()].every((u) => u.startsWith('cache/export/F2/'))).toBe(true);
  });

  it('файлы уже сняты (отзыв, очистка, старт) — выгрузка собирается заново, а не отдаёт пустой путь', async () => {
    await shareSpecialistExport(db, KID, device, NOW, opts());
    await device.deleteCacheDir(EXPORT_DIR);
    events.length = 0;
    await shareSpecialistExport(db, KID, device, NOW, opts({ kind: 'data' }));
    expect(events.slice(0, 2)).toEqual(['clear:export', 'mkdir:cache/export/F2:{"intermediates":true,"idempotent":true}']);
    expect(fs.__disk.has('cache/export/F2/talentia-aba-2026-11-01.json')).toBe(true);
  });

  it('в JSON — выгрузка с exportedAt-днём, без childId; в отчёте — заголовок, без childId и с именем JSON', async () => {
    await shareSpecialistExport(db, KID, device, NOW, opts());
    const json = fs.__disk.get('cache/export/F1/talentia-aba-2026-11-01.json')!;
    const html = fs.__disk.get('cache/export/F1/talentia-aba-2026-11-01.html')!;
    const parsed = JSON.parse(json) as { exportedAt: string; abaTrials: unknown[] };
    expect(parsed.exportedAt).toBe('2026-11-01');
    expect(parsed.abaTrials).toEqual([]);
    expect(json).not.toContain(KID);
    expect(html).toContain('Отчёт по домашней практике');
    expect(html).toContain('talentia-aba-2026-11-01.json');
    expect(html).not.toContain(KID);
  });

  it('имена — только день, без childId и без индекса ребёнка', () => {
    expect(exportFileName('2026-11-01')).toBe('talentia-aba-2026-11-01.json');
    expect(reportFileName('2026-11-01')).toBe('talentia-aba-2026-11-01.html');
    expect(exportFileName(NOW)).not.toContain(KID);
  });

  it('отмена (AbortError листа): cancelled, файлы остаются до следующей выгрузки', async () => {
    sharing.shareAsync.mockImplementation(async () => {
      events.push('share');
      const e = new Error('Share canceled');
      e.name = 'AbortError';
      throw e;
    });
    await expect(shareSpecialistExport(db, KID, device, NOW, opts())).resolves.toBe('cancelled');
    expect(events.at(-1)).toBe('share');
    expect(events.filter((e) => e === 'clear:export')).toHaveLength(1);
  });

  it('другая ошибка листа: пробрасывается, файлы не стираются сразу', async () => {
    sharing.shareAsync.mockImplementation(async () => {
      throw new Error('нет приложения, принимающего файл');
    });
    await expect(shareSpecialistExport(db, KID, device, NOW, opts())).rejects.toThrow(/нет приложения/);
    expect(events.filter((e) => e === 'clear:export')).toHaveLength(1);
    expect(fs.__disk.size).toBe(2);
  });

  it('лист недоступен: unavailable, файл не пишется, устройства не касаемся', async () => {
    sharing.isAvailableAsync.mockResolvedValue(false);
    await expect(shareSpecialistExport(db, KID, device, NOW, opts())).resolves.toBe('unavailable');
    expect(events).toEqual([]);
    expect(fs.__disk.size).toBe(0);
  });

  it('без согласия на ABA действующей версии — no_consent до чтения журналов, ничего не записано и не показано', async () => {
    const other = await memoryDb();
    expect(await shareSpecialistExport(other, KID, device, NOW, opts())).toBe('no_consent');
    expect(fs.__disk.size).toBe(0);
    expect(sharing.shareAsync).not.toHaveBeenCalled();
  });

  it('согласие отозвано после первой выгрузки — вторая кнопка тоже no_consent, соседний файл не отдаётся', async () => {
    await shareSpecialistExport(db, KID, device, NOW, opts());
    await revokeAbaProcessing(db, revoke(), 'owner', device);
    sharing.shareAsync.mockClear();
    expect(await shareSpecialistExport(db, KID, device, NOW, opts({ kind: 'data' }))).toBe('no_consent');
    expect(sharing.shareAsync).not.toHaveBeenCalled();
    expect(fs.__disk.size).toBe(0);
  });

  it('сбой базы при сборке — ошибка до записи', async () => {
    const other = await memoryDb();
    await appendConsentEvent(other, grant(), 'owner');
    const broken = { ...other, transaction: async () => { throw new Error('база недоступна'); } } as unknown as SqlDb;
    await expect(shareSpecialistExport(broken, KID, device, NOW, opts())).rejects.toThrow(/база недоступна/);
    expect(fs.__disk.size).toBe(0);
  });
});

describe('день в именах и в файле — местный (вопрос 119): полночь в Бишкеке (UTC+6)', () => {
  /** Подмена локальных геттеров даты на +6 ч — как в `pairingJournal.test.ts` (пояс процесса в Jest не переключить). */
  const BISHKEK_MS = 6 * 60 * 60 * 1000;
  let restore: (() => void) | null = null;
  beforeEach(() => {
    const shifted = (d: Date) => new Date(d.getTime() + BISHKEK_MS);
    const spies = [
      jest.spyOn(Date.prototype, 'getFullYear').mockImplementation(function (this: Date) {
        return shifted(this).getUTCFullYear();
      }),
      jest.spyOn(Date.prototype, 'getMonth').mockImplementation(function (this: Date) {
        return shifted(this).getUTCMonth();
      }),
      jest.spyOn(Date.prototype, 'getDate').mockImplementation(function (this: Date) {
        return shifted(this).getUTCDate();
      }),
    ];
    restore = () => spies.forEach((s) => s.mockRestore());
  });
  afterEach(() => restore?.());

  it('00:30 по Бишкеку 2 ноября (18:30 UTC 1 ноября): имена файлов и exportedAt — 2026-11-02', async () => {
    await shareSpecialistExport(db, KID, device, '2026-11-01T18:30:00.000Z', opts());
    expect([...fs.__disk.keys()]).toEqual(['cache/export/F1/talentia-aba-2026-11-02.html', 'cache/export/F1/talentia-aba-2026-11-02.json']);
    expect((JSON.parse(fs.__disk.get('cache/export/F1/talentia-aba-2026-11-02.json')!) as { exportedAt: string }).exportedAt).toBe('2026-11-02');
    expect(fs.__disk.get('cache/export/F1/talentia-aba-2026-11-02.html')).toContain('выгружено 2.11.2026');
  });
});

describe('отзыв и очистка прогресса снимают каталог экспорта (вопрос 54, m5)', () => {
  const stale = `${EXPORT_DIR.join('/')}/F0/talentia-aba-2026-10-30.json`;

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
