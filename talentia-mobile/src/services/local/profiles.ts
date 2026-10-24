/**
 * Профили детей на устройстве — AsyncStorage под `childKeyPrefix` (PARENT.md «Состав экрана»,
 * «Минимизация»; решения №85 — имя только на устройстве, №101 — имя необязательно, №112 — вибрация).
 * Список детей аккаунта — под `accountKeyPrefix`. Профиль пишется только при действующем
 * `account_local` (блокер 1 проверки приватности 2026-10-25): без согласия на диске не появляется
 * ни одного ключа ребёнка.
 */
import { CURRENT_CONSENT_TEXTS } from '../../domain/consentTexts';
import { isGranted } from '../../domain/consent';
import type { AddressForm } from '../../domain/companionSituations';
import type { InterfaceLang } from '../../domain/regionVisibility';
import type { AgeBand } from '../../types/task';
import { readConsentLog } from './consentLog';
import { accountKeyPrefix, childKeyPrefix, type DeviceStore } from './device';
import type { SqlDb } from './sql';

export type ChildProfile = {
  childId: string;
  /** Имя в игре; пустая строка — «Профиль N» (№101). */
  name: string;
  band: AgeBand;
  interfaceLang: InterfaceLang;
  /** Показывать ли регион «Кыргызский язык» этому ребёнку (№38, №50). Не геолокация. */
  kyrgyzRegion: boolean;
  addressForm: AddressForm;
  /** «Вибрация при касании» (№112), выключена по умолчанию. */
  hapticsEnabled: boolean;
  sessionMinutes: number;
  calmMode: boolean;
  focusMode: boolean;
  soundEffects: boolean;
  createdAt: string;
};

export const DEFAULT_SESSION_MINUTES = 10;

export const childrenKey = (accountId: string) => `${accountKeyPrefix(accountId)}children`;
export const profileKey = (childId: string) => `${childKeyPrefix(childId)}profile`;

export class ProfileConsentRequiredError extends Error {
  constructor() {
    super('Профиль ребёнка не записан: нет действующего согласия account_local');
    this.name = 'ProfileConsentRequiredError';
  }
}

export function newProfile(input: Pick<ChildProfile, 'childId' | 'band' | 'interfaceLang' | 'createdAt'> & Partial<ChildProfile>): ChildProfile {
  return {
    name: '',
    kyrgyzRegion: false,
    addressForm: 'neutral',
    hapticsEnabled: false,
    sessionMinutes: DEFAULT_SESSION_MINUTES,
    calmMode: false,
    focusMode: false,
    soundEffects: true,
    ...input,
  };
}

export async function listChildIds(device: DeviceStore, accountId: string): Promise<string[]> {
  const raw = await device.getItem(childrenKey(accountId));
  return raw ? (JSON.parse(raw) as string[]) : [];
}

export async function loadProfile(device: DeviceStore, childId: string): Promise<ChildProfile | null> {
  const raw = await device.getItem(profileKey(childId));
  return raw ? (JSON.parse(raw) as ChildProfile) : null;
}

export async function listProfiles(device: DeviceStore, accountId: string): Promise<ChildProfile[]> {
  const ids = await listChildIds(device, accountId);
  const profiles = await Promise.all(ids.map((id) => loadProfile(device, id)));
  return profiles.filter((p): p is ChildProfile => p !== null);
}

/** Записать профиль; новый ребёнок добавляется в список аккаунта. Без `account_local` — ошибка, ничего не пишется. */
export async function saveProfile(device: DeviceStore, db: SqlDb, accountId: string, profile: ChildProfile): Promise<void> {
  if (!isGranted(await readConsentLog(db), 'account_local', null, CURRENT_CONSENT_TEXTS.account_local)) throw new ProfileConsentRequiredError();
  await device.setItem(profileKey(profile.childId), JSON.stringify(profile));
  const ids = await listChildIds(device, accountId);
  if (!ids.includes(profile.childId)) await device.setItem(childrenKey(accountId), JSON.stringify([...ids, profile.childId]));
}

export async function removeChildFromList(device: DeviceStore, accountId: string, childId: string): Promise<void> {
  const ids = await listChildIds(device, accountId);
  await device.setItem(childrenKey(accountId), JSON.stringify(ids.filter((id) => id !== childId)));
}

/** Профиль в экспорте — явный allow-list: форма обращения и вибрация наружу не выходят (№71). */
export function exportProfile(p: ChildProfile): Record<string, unknown> {
  return { childId: p.childId, name: p.name, band: p.band, interfaceLang: p.interfaceLang, kyrgyzRegion: p.kyrgyzRegion, sessionMinutes: p.sessionMinutes, createdAt: p.createdAt };
}
