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
import type { ConsentEvent } from '../../domain/consent';
import { readConsentLog } from './consentLog';
import { removeChildFromList } from './profiles';
import { purgeChild, wipeDevice } from './purge';
import type { SqlDb } from './sql';
import { consentPlan, delivered, failedEvents, LOCAL_ONLY_SCOPES } from './sync';

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
  /** Аккаунт, из списка детей которого ребёнок убирается (`profiles.ts`); без него список не трогается. */
  accountId?: string;
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
  if (input.accountId) await removeChildFromList(device, input.accountId, childId);
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
  /**
   * Довести до сервера отзывы облачных областей, ещё не доставленные (`undeliveredRevocations`),
   * и получить подтверждение. Вызывается, только если такие есть. `false` или ошибка — удаление
   * не начинается.
   */
  deliverRevocations: (events: ConsentEvent[]) => Promise<boolean>;
};

/**
 * Отзывы согласий, которые должны уйти на сервер, но ещё не ушли. После «Удалить всё» журнал
 * согласий стирается вместе с базой, и недоставленный отзыв облака или ИИ не дошёл бы до сервера
 * никогда (раунд 4, приватность В4).
 *
 * Берётся тот же план, что у синхронизации (`consentPlan`), а не сырой журнал, и только отзывы
 * области, grant которой сервер уже получил: иначе на сервере нечего отзывать. Отзыв ИИ без
 * облака, отзыв из `sync_problems`, устаревший отзыв и отзыв облака, чей grant не дошёл, сервер
 * не примет никогда — с ними «Удалить всё» блокировалось бы навсегда (раунд 5, приватность В1 =
 * бэкенд В1).
 */
export async function undeliveredRevocations(db: SqlDb): Promise<ConsentEvent[]> {
  const events = await readConsentLog(db);
  const done = await delivered(db);
  const known = (e: ConsentEvent) =>
    events.some((g) => g.action === 'grant' && g.scope === e.scope && g.childId === e.childId && done.has(g.id));
  return consentPlan(events, done, await failedEvents(db)).filter(
    (e) => e.action === 'revoke' && !LOCAL_ONLY_SCOPES.has(e.scope) && known(e),
  );
}

/**
 * Удаление аккаунта: на устройстве не остаётся ничего — строки, файл базы, все ключи
 * приложения, PIN, кеш озвучки детей, экспорт, уведомления, очередь телеметрии. Журнал
 * согласий на устройстве стирается тоже (решение владельца 2026-10-19); на сервере он переживает
 * удаление с псевдонимами. Поэтому сначала недоставленные отзывы облачных областей доходят до
 * сервера: без связи удаление не начинается.
 */
export async function wipeAccountEverywhere(input: WipeAccountInput): Promise<CleanedPart[]> {
  const { db, device, accountId } = input;
  const done: CleanedPart[] = [];

  const pending = await undeliveredRevocations(db);
  if (pending.length > 0 && !(await input.deliverRevocations(pending))) {
    throw new Error('Отзывы согласий не дошли до сервера: удаление аккаунта — только со связью');
  }

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
