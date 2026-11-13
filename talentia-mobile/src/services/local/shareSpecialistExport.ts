/**
 * «Выгрузить для специалиста» файлом (№168, вопрос 67, направление `docs/design/parent-aba-2026-11-01.md` §G3).
 * Единственное место в приложении, откуда данные ребёнка покидают песочницу — и только руками родителя через
 * системный лист «Поделиться»: это не сеть, адресата выбирает родитель (проверка `child-privacy-compliance`
 * 2026-11-01; исключение для `expo-sharing` — в `eslint.config.js` только для этого файла).
 *
 * Порядок: каталог экспорта очищается до записи (прошлый файл не уедет вместо нового) → JSON
 * `exportForSpecialist` пишется в кеш → лист → в `finally` каталог снимается снова: успех, отмена и исключение —
 * одинаково, файл в кеше не живёт дольше листа. Отзыв и очистка прогресса снимают тот же каталог (`purge.ts`).
 *
 * Имя файла — `talentia-aba-YYYY-MM-DD.json`: без имени и без `childId` (имя файла видно в чужом приложении и в
 * его истории). При нескольких детях индекса в имени тоже нет — иначе по индексу читается, сколько детей в
 * семье и который из них в центре; два файла за день специалист переименует сам. День в имени — локальный
 * (`abaLocalDay`), как у записей внутри файла.
 *
 * Согласие `aba_processing` действующей версии проверяется здесь же, до чтения журналов: единственная точка
 * выхода данных не полагается на экран (проверка `child-privacy-compliance` по диффу 2026-11-01).
 */
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { consentStatus } from '../../domain/consent';
import { CURRENT_CONSENT_TEXTS } from '../../domain/consentTexts';
import { abaLocalDay } from './abaLog';
import { readConsentLog } from './consentLog';
import { EXPORT_DIR, type DeviceStore } from './device';
import { exportForSpecialist } from './purge';
import type { SqlDb } from './sql';

/**
 * Файл включён решением владельца 2026-11-01 (вопрос 67) после раунда `child-privacy-compliance`. `false` — строка
 * «Позже» с подписью `exportLater`, как до этапа G3.
 */
export const ABA_EXPORT_FILE_ENABLED = true;

export const EXPORT_MIME = 'application/json';
/** UTI для iOS — тот же тип, что `mimeType` для Android. */
const EXPORT_UTI = 'public.json';

/** `'no_consent'` — согласия `aba_processing` действующей версии нет (в т. ч. устарело): файл не собирается. */
export type ShareSpecialistExportResult = 'shared' | 'cancelled' | 'unavailable' | 'no_consent';

/** Имя файла по дню выгрузки (`exportedAt` уже без времени суток, `exportForSpecialist`). */
export const exportFileName = (day: string) => `talentia-aba-${day.slice(0, 10)}.json`;

/**
 * Лист «Поделиться» на устройстве не сообщает, отправлен ли файл или лист закрыт: `shareAsync` завершается в
 * обоих случаях. `'shared'` значит «лист закрыт без ошибки»; `'cancelled'` — только когда система явно
 * сообщила об отмене (web `AbortError`). Экран на `'shared'` показывает нейтральное «передан в выбранное
 * приложение», а не «отправлен».
 */
function isCancellation(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  return e.name === 'AbortError' || /cancel/i.test(e.message);
}

export async function shareSpecialistExport(db: SqlDb, childId: string, device: DeviceStore, now: string): Promise<ShareSpecialistExportResult> {
  if (!(await Sharing.isAvailableAsync())) return 'unavailable';
  if (consentStatus(await readConsentLog(db), 'aba_processing', childId, CURRENT_CONSENT_TEXTS.aba_processing) !== 'granted') return 'no_consent';
  const data = await exportForSpecialist(db, childId, now);
  // прошлый файл — прочь до записи: в каталоге всегда не больше одного файла, и он — этой выгрузки
  await device.deleteCacheDir(EXPORT_DIR);
  try {
    const dir = new Directory(Paths.cache, ...EXPORT_DIR);
    dir.create({ intermediates: true, idempotent: true });
    const file = new File(dir, exportFileName(abaLocalDay(Date.parse(now))));
    file.write(JSON.stringify(data));
    try {
      await Sharing.shareAsync(file.uri, { mimeType: EXPORT_MIME, UTI: EXPORT_UTI });
    } catch (e) {
      if (isCancellation(e)) return 'cancelled';
      throw e;
    }
    return 'shared';
  } finally {
    await device.deleteCacheDir(EXPORT_DIR);
  }
}
