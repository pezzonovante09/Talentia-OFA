/**
 * Случайность для идентификаторов и семян. Домен источник байт не выбирает (`domain/ids.ts`):
 * на устройстве — `expo-crypto`, в тестах — детерминированная функция.
 */
import { getRandomBytes } from 'expo-crypto';

import type { RandomBytes } from '../domain/ids';

export const randomBytes: RandomBytes = (length) => getRandomBytes(length);

/** Семя генератора урока: 31 бит, чтобы оставаться целым и положительным в любом движке. */
export function randomSeed(bytes: RandomBytes = randomBytes): number {
  const b = bytes(4);
  return ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 1;
}
