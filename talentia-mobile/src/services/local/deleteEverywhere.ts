/**
 * Удаление ребёнка и аккаунта **везде** на устройстве и по порядку. Спецификация —
 * PARENT.md, «Удаление и экспорт», «Данные на устройстве».
 *
 * Порядок при удалении ребёнка:
 * 1. отзыв согласия доходит до сервера — иначе после псевдонимизации он ушёл бы с
 *    псевдонимом, и сервер не связал бы его с ребёнком; нет связи — удаление не идёт;
 * 2. база: всё о ребёнке прочь с физическим стиранием, согласия — с псевдонимом;
 * 3. вне базы: ключи AsyncStorage, кеш озвучки с его именем, файл экспорта, уведомления.
 */
import {
  ALL_KEYS_PREFIX,
  CHILD_VOICE_ROOT,
  childKeyPrefix,
  childVoiceDir,
  EXPORT_DIR,
  secureKeys,
  TELEMETRY_KEY_PREFIX,
  type CleanedPart,
  type DeviceStore,
} from './device';
import { purgeChild, wipeDevice } from './purge';
import type { SqlDb } from './sql';

export type DeleteChildInput = {
  db: SqlDb;
  device: DeviceStore;
  childId: string;
  /** Случайный uuid — не хеш от id. */
  pseudonym: string;
  /**
   * Довести отзыв согласия ребёнка до сервера и получить подтверждение. Ребёнка в облаке
   * не было — сразу `true`. `false` или ошибка — удаление не начинается.
   */
  deliverRevocation: () => Promise<boolean>;
};

export async function deleteChildEverywhere(input: DeleteChildInput): Promise<CleanedPart[]> {
  const { db, device, childId } = input;
  if (!(await input.deliverRevocation())) {
    throw new Error('Отзыв согласия не дошёл до сервера: удаление ребёнка — только со связью');
  }
  const done: CleanedPart[] = ['server_revocation'];

  await purgeChild(db, childId, input.pseudonym);
  done.push('sqlite');

  const prefix = childKeyPrefix(childId);
  await device.removeKeys((await device.keys()).filter((k) => k.startsWith(prefix)));
  done.push('async_storage');

  await device.deleteCacheDir(childVoiceDir(childId));
  done.push('voice_cache');

  await device.deleteCacheDir(EXPORT_DIR);
  done.push('export_file');

  await device.cancelChildNotifications(childId);
  done.push('notifications');
  return done;
}

export type WipeAccountInput = {
  db: SqlDb;
  device: DeviceStore;
  accountId: string;
  /** Закрыть базу и удалить файл целиком (`deleteLocalDb`). */
  deleteDbFile: () => Promise<void>;
};

/**
 * Удаление аккаунта: на устройстве не остаётся ничего — строки, файл базы, все ключи
 * приложения, PIN, кеш озвучки детей, экспорт, уведомления, очередь телеметрии. Журнал
 * согласий переживает удаление только на сервере, с псевдонимами.
 */
export async function wipeAccountEverywhere(input: WipeAccountInput): Promise<CleanedPart[]> {
  const { db, device, accountId } = input;
  const done: CleanedPart[] = [];

  await wipeDevice(db);
  await input.deleteDbFile();
  done.push('sqlite');

  const keys = await device.keys();
  await device.removeKeys(keys.filter((k) => k.startsWith(ALL_KEYS_PREFIX) && !k.startsWith(TELEMETRY_KEY_PREFIX)));
  done.push('async_storage');
  await device.removeKeys(keys.filter((k) => k.startsWith(TELEMETRY_KEY_PREFIX)));
  done.push('telemetry_queue');

  await device.removeSecure(secureKeys(accountId));
  done.push('secure_store');

  await device.deleteCacheDir(CHILD_VOICE_ROOT);
  done.push('voice_cache');

  await device.deleteCacheDir(EXPORT_DIR);
  done.push('export_file');

  await device.cancelAllNotifications();
  done.push('notifications');
  return done;
}
