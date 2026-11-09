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
  accountKeyPrefix,
  ALL_KEYS_PREFIX,
  CHILD_VOICE_ROOT,
  childKeyPrefix,
  childVoiceDir,
  EXPORT_DIR,
  secureKeys,
  TELEMETRY_KEY_PREFIX,
  type CleanedPart,
  DB_FILE,
  type DeviceStore,
  KNOWN_ACCOUNTS_PREFIX,
  knownAccountKey,
  SECURE_ACCOUNTS_KEY,
  WIPE_PENDING_KEY,
} from './device';
import { CURRENT_ACCOUNT_KEY, forgetSecureAccount } from './account';
import type { ConsentEvent } from '../../domain/consent';
import { readConsentLog } from './consentLog';
import { listChildIds, removeChildFromList } from './profiles';
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
  const resuming = (await device.getItem(WIPE_PENDING_KEY)) !== null;

  // отзывы доставлены до метки: на повторе их уже проверили, а база может быть закрыта
  if (!resuming) {
    const pending = await undeliveredRevocations(db);
    if (pending.length > 0 && !(await input.deliverRevocations(pending))) {
      throw new Error('Отзывы согласий не дошли до сервера: удаление аккаунта — только со связью');
    }
  }
  await device.setItem(WIPE_PENDING_KEY, accountId);

  // на повторе ручка закрыта или файла уже нет — не беда: файлы снимает и проверяет finishDeviceWipe
  try {
    await wipeDevice(db);
  } catch (e) {
    if (!resuming) throw e;
  }
  try {
    await input.deleteDbFile();
  } catch (e) {
    if (!resuming) throw e;
  }
  return ['sqlite', ...(await finishDeviceWipe(device, accountId))];
}

export type WipeOwnAccountInput = Pick<WipeAccountInput, 'db' | 'device' | 'accountId' | 'deleteDbFile'>;

/**
 * Стирание **одного** аккаунта — брошенной первой настройки (PIN придуман, согласия `account_local` нет;
 * `useAccount.abandonSetup` и ветка `not_asked` в `boot`). Контрольный аудит 2026-11-09, Ж1: раньше сюда шёл
 * `wipeAccountEverywhere`, а его `finishDeviceWipe` снимает базы **всех** аккаунтов устройства — после сбоя старта
 * это стирало настоящий аккаунт со всеми журналами. По №148 зачистка всех — только у явного «Удалить аккаунт».
 *
 * Данных ребёнка в таком аккаунте нет (профили пишутся после согласия), сервера нет — отзывы не нужны. Порядок
 * — строки, файл базы и спутники, PIN, реестры, и ключ `current` последним: сбой на любом шаге оставляет
 * `current`, и следующий `boot` открывает пустую базу без согласия и стирает заново. Метка `WIPE_PENDING_KEY`
 * не ставится: она означает зачистку всех.
 */
export async function wipeOwnAccount({ db, device, accountId, deleteDbFile }: WipeOwnAccountInput): Promise<CleanedPart[]> {
  // дети этого аккаунта — до строк: их список лежит в AsyncStorage, а не в базе
  const children = await listChildIds(device, accountId);
  await wipeDevice(db);
  await deleteDbFile();
  const own = (await device.listDbFiles()).filter((f) => DB_FILE.exec(f)?.[1] === accountId);
  await device.deleteDbFiles(own);
  await device.removeSecure(secureKeys(accountId));
  await forgetSecureAccount(device, accountId);
  const keys = await device.keys();
  const ownKeys = keys.filter((k) => k.startsWith(accountKeyPrefix(accountId)) || children.some((c) => k.startsWith(childKeyPrefix(c))));
  await device.removeKeys([...ownKeys, knownAccountKey(accountId)]);
  for (const c of children) {
    await device.deleteCacheDir(childVoiceDir(c));
    await device.cancelChildNotifications(c);
  }
  await device.deleteCacheDir(EXPORT_DIR);
  if ((await device.getItem(CURRENT_ACCOUNT_KEY)) === accountId) await device.removeKeys([CURRENT_ACCOUNT_KEY]);
  return ['sqlite', 'secure_store', 'async_storage', 'voice_cache', 'export_file', 'notifications'];
}

/**
 * Всё, что после строк базы: файлы баз всех аккаунтов устройства, PIN, кеш, уведомления, ключи.
 * Метка `WIPE_PENDING_KEY` и id (`current`, реестр) снимаются последними: сбой на любом шаге —
 * и повтор или следующий старт (`useAccount.boot`) находят всё снова (№148).
 */
export async function finishDeviceWipe(device: DeviceStore, accountId: string | null): Promise<CleanedPart[]> {
  const done: CleanedPart[] = [];
  // все id аккаунтов — до любого удаления: после сбоя старта на устройстве бывает брошенный
  const keys = await device.keys();
  const ids = new Set<string>(accountId ? [accountId] : []);
  for (const k of [CURRENT_ACCOUNT_KEY, WIPE_PENDING_KEY]) {
    const v = await device.getItem(k);
    if (v) ids.add(v);
  }
  for (const k of keys) if (k.startsWith(KNOWN_ACCOUNTS_PREFIX)) ids.add(k.slice(KNOWN_ACCOUNTS_PREFIX.length));
  for (const f of await device.listDbFiles()) {
    const m = DB_FILE.exec(f);
    if (m) ids.add(m[1]);
  }

  // брошенные базы не открываются (могут быть испорчены, облака нет): файлы и спутники всех id
  await device.deleteDbFiles((await device.listDbFiles()).filter((f) => DB_FILE.test(f)));
  for (const id of ids) await device.removeSecure(secureKeys(id));
  await device.removeSecure([SECURE_ACCOUNTS_KEY]);
  done.push('secure_store', 'orphan_accounts');

  await device.deleteCacheDir(CHILD_VOICE_ROOT);
  done.push('voice_cache');
  await device.deleteCacheDir(EXPORT_DIR);
  done.push('export_file');
  await device.cancelAllNotifications();
  done.push('notifications');
  await device.removeKeys(keys.filter((k) => k.startsWith(TELEMETRY_KEY_PREFIX)));
  done.push('telemetry_queue');

  const left = (await device.listDbFiles()).filter((f) => DB_FILE.test(f));
  if (left.length) throw new Error(`Файлы баз остались на устройстве: ${left.length}`);

  // id и метка — последними: пока они есть, PIN и файлы ещё можно найти; ключи — заново, с поздними записями
  const rest = await device.keys();
  await device.removeKeys(rest.filter((k) => k.startsWith(ALL_KEYS_PREFIX) && k !== WIPE_PENDING_KEY));
  done.push('async_storage');
  await device.removeKeys([WIPE_PENDING_KEY]);
  return done;
}
