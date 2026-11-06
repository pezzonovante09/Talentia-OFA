/**
 * Локальный аккаунт взрослого без облака (AUDIT.md №64; PARENT.md «Гейт», «Согласие» п. 1).
 *
 * Порядок первой настройки — «согласие раньше записи» (проверка `child-privacy-compliance`,
 * 2026-10-25): порог намерения → PIN (хеш с солью в SecureStore) → база аккаунта с единственной
 * строкой — событием `account_local`, подтверждённым PIN. До этого события на устройстве допустимы
 * только id аккаунта, PIN и таймаут; профили детей (`profiles.ts`) пишутся только после него.
 * Отказ на экране согласия или прерванная настройка = `abandonSetup`: тот же путь, что удаление
 * аккаунта, на устройстве ничего не остаётся.
 */
import { uuidV4, type RandomBytes } from '../../domain/ids';
import { CURRENT_CONSENT_TEXTS } from '../../domain/consentTexts';
import { consentStatus, type ConsentStatus } from '../../domain/consent';
import {
  hashPin,
  isLocked,
  NO_LOCKOUT,
  pinProblem,
  registerFailure,
  registerSuccess,
  verifyPin,
  type Digest,
  type LockoutState,
  type PinRecord,
} from '../../domain/parentGate';
import type { InterfaceLang } from '../../domain/regionVisibility';
import { readConsentLog, appendConsentEvent } from './consentLog';
import { ALL_KEYS_PREFIX, INSTALL_MARK_KEY, knownAccountKey, SECURE_ACCOUNTS_KEY, secureKeys, type DeviceStore } from './device';
import type { SqlDb } from './sql';

/** Ключ AsyncStorage с id текущего локального аккаунта (один аккаунт на устройство в v1). */
export const CURRENT_ACCOUNT_KEY = 'talentia:account:current';

export async function currentAccountId(device: DeviceStore): Promise<string | null> {
  return device.getItem(CURRENT_ACCOUNT_KEY);
}

/** Соль PIN — 16 случайных байт в hex. */
export function pinSalt(randomBytes: RandomBytes): string {
  return Array.from(randomBytes(16), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Создать аккаунт: id и PIN. База ещё не открыта, согласия нет — следующим шагом вызывающий открывает
 * базу и пишет `grantAccountLocal`, иначе `abandonSetup`.
 */
export async function createLocalAccount(
  device: DeviceStore,
  pin: string,
  { randomBytes, digest }: { randomBytes: RandomBytes; digest: Digest },
): Promise<string> {
  const problem = pinProblem(pin);
  if (problem) throw new Error(`PIN не принят: ${problem}`);
  const accountId = uuidV4(randomBytes);
  const record = await hashPin(pin, pinSalt(randomBytes), digest);
  const [pinKey, lockoutKey] = secureKeys(accountId);
  // реестр — раньше PIN: упадёт посередине — останется id без PIN, а не PIN, который не найти (№148)
  await device.setItem(knownAccountKey(accountId), '1');
  await rememberSecureAccount(device, accountId);
  await device.setSecure(pinKey, JSON.stringify(record));
  await device.setSecure(lockoutKey, JSON.stringify(NO_LOCKOUT));
  await device.setItem(CURRENT_ACCOUNT_KEY, accountId);
  return accountId;
}

/** id аккаунтов из реестра SecureStore; битый — пусто. */
async function secureAccounts(device: DeviceStore): Promise<string[]> {
  try {
    const v: unknown = JSON.parse((await device.getSecure(SECURE_ACCOUNTS_KEY)) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

async function rememberSecureAccount(device: DeviceStore, accountId: string): Promise<void> {
  const ids = await secureAccounts(device);
  if (!ids.includes(accountId)) await device.setSecure(SECURE_ACCOUNTS_KEY, JSON.stringify([...ids, accountId]));
}

/**
 * Первый запуск после переустановки (№157): в AsyncStorage нет ни одного ключа приложения — значит,
 * приложение удаляли, а на iOS Keychain пережил удаление. Хеши PIN прежних аккаунтов стираются по
 * реестру SecureStore. Обновление без переустановки (ключи есть, метки ещё нет) только ставит метку.
 */
export async function clearAfterReinstall(device: DeviceStore): Promise<void> {
  if ((await device.getItem(INSTALL_MARK_KEY)) !== null) return;
  const fresh = !(await device.keys()).some((k) => k.startsWith(ALL_KEYS_PREFIX));
  if (fresh) {
    for (const id of await secureAccounts(device)) await device.removeSecure(secureKeys(id));
    await device.removeSecure([SECURE_ACCOUNTS_KEY]);
  }
  await device.setItem(INSTALL_MARK_KEY, '1');
}

export async function hasPin(device: DeviceStore, accountId: string): Promise<boolean> {
  return (await device.getSecure(secureKeys(accountId)[0])) !== null;
}

export async function readLockout(device: DeviceStore, accountId: string): Promise<LockoutState> {
  const raw = await device.getSecure(secureKeys(accountId)[1]);
  return raw ? (JSON.parse(raw) as LockoutState) : NO_LOCKOUT;
}

export type PinCheck = { result: 'ok' } | { result: 'wrong'; lockout: LockoutState } | { result: 'locked'; lockedUntil: number };

/** Проверка PIN с лимитом попыток; таймаут хранится в SecureStore и переживает перезапуск. */
export async function checkPin(device: DeviceStore, accountId: string, pin: string, { digest, now }: { digest: Digest; now: number }): Promise<PinCheck> {
  const [pinKey, lockoutKey] = secureKeys(accountId);
  const lockout = await readLockout(device, accountId);
  if (isLocked(lockout, now)) return { result: 'locked', lockedUntil: lockout.lockedUntil as number };
  const raw = await device.getSecure(pinKey);
  if (!raw) throw new Error('PIN аккаунта не найден');
  const ok = await verifyPin(pin, JSON.parse(raw) as PinRecord, digest);
  if (ok) {
    await device.setSecure(lockoutKey, JSON.stringify(registerSuccess()));
    return { result: 'ok' };
  }
  const next = registerFailure(lockout, now);
  await device.setSecure(lockoutKey, JSON.stringify(next));
  return isLocked(next, now) ? { result: 'locked', lockedUntil: next.lockedUntil as number } : { result: 'wrong', lockout: next };
}

/** Версия текста `account_local` на языке экрана — та, которую родитель видел. */
export function accountLocalTextVersion(lang: InterfaceLang): string {
  const versions = CURRENT_CONSENT_TEXTS.account_local;
  return versions.find((v) => v.startsWith(`${lang}-`)) ?? versions[0];
}

/** Согласие на локальное хранение — сразу после PIN, подтверждено им (`confirmedBy: 'pin'`). */
export async function grantAccountLocal(
  db: SqlDb,
  { accountId, lang, at, randomBytes }: { accountId: string; lang: InterfaceLang; at: string; randomBytes: RandomBytes },
): Promise<void> {
  await appendConsentEvent(
    db,
    { id: uuidV4(randomBytes), scope: 'account_local', action: 'grant', childId: null, textVersion: accountLocalTextVersion(lang), confirmedBy: 'pin', actorId: accountId, at },
    'owner',
  );
}

export async function accountConsentStatus(db: SqlDb): Promise<ConsentStatus> {
  return consentStatus(await readConsentLog(db), 'account_local', null, CURRENT_CONSENT_TEXTS.account_local);
}
