/**
 * Введение для взрослого «Как проходят занятия» (решение владельца №202): просмотрено ли оно на этом аккаунте.
 * Флаг — на взрослого, не на ребёнка: введение объясняет взрослому его роль, второму ребёнку того же взрослого оно не
 * нужно заново. Ключ под префиксом аккаунта — его стирает удаление аккаунта (`deleteEverywhere`).
 */
import { accountKeyPrefix, type DeviceStore } from './device';

export const abaIntroKey = (accountId: string) => `${accountKeyPrefix(accountId)}abaIntroSeen`;

export async function abaIntroSeen(device: DeviceStore, accountId: string): Promise<boolean> {
  return (await device.getItem(abaIntroKey(accountId))) === '1';
}

export async function markAbaIntroSeen(device: DeviceStore, accountId: string): Promise<void> {
  await device.setItem(abaIntroKey(accountId), '1');
}
