/**
 * «Выгрузить для специалиста» файлом (№168, вопрос 67, направление `docs/design/parent-aba-2026-11-01.md` §G3).
 * Единственное место в приложении, откуда данные ребёнка покидают песочницу — и только руками родителя через
 * системный лист «Поделиться»: это не сеть, адресата выбирает родитель (проверка `child-privacy-compliance`
 * 2026-11-01; исключение для `expo-sharing` — в `eslint.config.js` только для этого файла).
 *
 * Два файла одной выгрузки (вопрос 118, выбор владельца «лист + машинный файл»): читаемый отчёт
 * `talentia-aba-YYYY-MM-DD.html` (`specialistReportHtml.ts`) и JSON `exportForSpecialist` с тем же днём в имени.
 * Лист `expo-sharing` берёт один файл за вызов, поэтому на экране две строки: «Отчёт специалисту» (`'report'`) и
 * «Файл данных» (`'data'`). Каждое нажатие проверяет согласие и собирает выгрузку заново; оба файла пишутся
 * вместе в новый подкаталог со случайным именем внутри каталога экспорта.
 *
 * Когда файлы удаляются (вопрос 117): не сразу после листа — `shareAsync` на Android возвращается раньше, чем
 * получатель прочитал файл, и тот мог получить пустой. Каталог экспорта снимается:
 * - в начале следующей выгрузки, если она другая (другой ребёнок, изменились записи или язык) или файлов уже нет;
 *   та же выгрузка второй кнопкой отдаёт соседний файл из того же подкаталога и ничего не стирает — иначе
 *   «Файл данных» стёр бы отчёт, который первый получатель ещё читает;
 * - при очистке прогресса и отзыве согласия ABA (`purge.ts`), при удалении аккаунта (`deleteEverywhere.ts`) и на
 *   старте приложения (`state/account.ts`).
 * Подкаталог со случайным именем, а не постоянный путь: поздний получатель старого адреса не прочтёт по нему файл
 * следующей выгрузки — в том числе другого ребёнка (в имени файла ребёнка нет).
 *
 * Имя файла — `talentia-aba-YYYY-MM-DD.(html|json)`: без имени и без `childId` (имя файла видно в чужом приложении и
 * в его истории). При нескольких детях индекса в имени тоже нет — иначе по индексу читается, сколько детей в
 * семье и который из них в центре; два файла за день специалист переименует сам. День в имени — `exportedAt`
 * выгрузки, местный (`abaLocalDay`, вопрос 119), как у записей внутри файла.
 *
 * Согласие `aba_processing` действующей версии проверяется здесь же, до чтения журналов: единственная точка
 * выхода данных не полагается на экран (проверка `child-privacy-compliance` по диффу 2026-11-01).
 */
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { consentStatus } from '../../domain/consent';
import { CURRENT_CONSENT_TEXTS } from '../../domain/consentTexts';
import { uuidV4 } from '../../domain/ids';
import { randomBytes } from '../random';
import { readConsentLog } from './consentLog';
import { EXPORT_DIR, type DeviceStore } from './device';
import { exportForSpecialist } from './purge';
import { specialistReportHtml, type ReportT } from './specialistReportHtml';
import type { SqlDb } from './sql';

/**
 * Файл включён решением владельца 2026-11-01 (вопрос 67) после раунда `child-privacy-compliance`. `false` — строка
 * «Позже» с подписью `exportLater`, как до этапа G3.
 */
export const ABA_EXPORT_FILE_ENABLED = true;

export const EXPORT_MIME = 'application/json';
/** UTI для iOS — тот же тип, что `mimeType` для Android. */
const EXPORT_UTI = 'public.json';
export const REPORT_MIME = 'text/html';
const REPORT_UTI = 'public.html';

/** `'report'` — читаемый отчёт (HTML), `'data'` — файл данных (JSON). */
export type SpecialistExportKind = 'report' | 'data';

/** `'no_consent'` — согласия `aba_processing` действующей версии нет (в т. ч. устарело): файл не собирается. */
export type ShareSpecialistExportResult = 'shared' | 'cancelled' | 'unavailable' | 'no_consent';

/** Имя JSON по дню выгрузки (`exportedAt` уже без времени суток, `exportForSpecialist`). */
export const exportFileName = (day: string) => `talentia-aba-${day.slice(0, 10)}.json`;
/** Имя отчёта — тот же день, что у JSON. */
export const reportFileName = (day: string) => `talentia-aba-${day.slice(0, 10)}.html`;

export type ShareSpecialistExportOptions = {
  /** Какой файл отдать листу; по умолчанию — отчёт. */
  kind?: SpecialistExportKind;
  /** `t` раздела взрослого (язык взрослого, №190) — подписи отчёта. */
  t: ReportT;
  /** Язык страницы отчёта (`<html lang>`). */
  lang?: string;
  /** Имя подкаталога выгрузки; в тестах — детерминированное. */
  folderId?: () => string;
};

/** Последняя подготовленная выгрузка этого запуска: вторая кнопка отдаёт соседний файл, ничего не стирая. */
type Prepared = { childId: string; json: string; html: string; jsonFile: File; htmlFile: File };
let prepared: Prepared | null = null;

/**
 * Забыть подготовленную выгрузку (как после перезапуска приложения): копия JSON и отчёта в памяти не переживает
 * удаление данных. Зовёт экран подтверждения после очистки прогресса, удаления профиля, отзыва согласия ABA и
 * удаления аккаунта (`app/parent/confirm/[action].tsx`, `child-privacy-compliance` 2026-11-19); тесты — между кейсами.
 */
export function resetPreparedExport(): void {
  prepared = null;
}

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

const randomFolder = () => uuidV4(randomBytes);

export async function shareSpecialistExport(
  db: SqlDb,
  childId: string,
  device: DeviceStore,
  now: string,
  opts: ShareSpecialistExportOptions,
): Promise<ShareSpecialistExportResult> {
  if (!(await Sharing.isAvailableAsync())) return 'unavailable';
  if (consentStatus(await readConsentLog(db), 'aba_processing', childId, CURRENT_CONSENT_TEXTS.aba_processing) !== 'granted') {
    // согласия нет — и копии прошлой выгрузки в памяти не держим
    prepared = null;
    return 'no_consent';
  }
  const data = await exportForSpecialist(db, childId, now);
  const json = JSON.stringify(data);
  const html = specialistReportHtml(data, opts.t, { lang: opts.lang, dataFileName: exportFileName(data.exportedAt) });

  const same = prepared !== null && prepared.childId === childId && prepared.json === json && prepared.html === html && prepared.jsonFile.exists && prepared.htmlFile.exists;
  if (!same) {
    // другая выгрузка или файлов уже нет — прошлые файлы прочь до записи: в каталоге только эта выгрузка
    prepared = null;
    await device.deleteCacheDir(EXPORT_DIR);
    const dir = new Directory(Paths.cache, ...EXPORT_DIR, (opts.folderId ?? randomFolder)());
    dir.create({ intermediates: true, idempotent: true });
    const htmlFile = new File(dir, reportFileName(data.exportedAt));
    const jsonFile = new File(dir, exportFileName(data.exportedAt));
    htmlFile.write(html);
    jsonFile.write(json);
    prepared = { childId, json, html, jsonFile, htmlFile };
  }
  const { htmlFile, jsonFile } = prepared!;
  const report = (opts.kind ?? 'report') === 'report';
  try {
    await Sharing.shareAsync(report ? htmlFile.uri : jsonFile.uri, report ? { mimeType: REPORT_MIME, UTI: REPORT_UTI } : { mimeType: EXPORT_MIME, UTI: EXPORT_UTI });
  } catch (e) {
    if (isCancellation(e)) return 'cancelled';
    throw e;
  }
  // файлы остаются до следующей выгрузки, очистки или старта (вопрос 117): получатель может читать их позже
  return 'shared';
}
