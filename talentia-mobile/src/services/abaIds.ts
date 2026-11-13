/**
 * Идентификаторы ABA для экранов: сессии, пробы, прогоны рутин, сессии сопряжения, IOA — только отсюда.
 * UUIDv4 из случайных байт устройства (`domain/ids.ts`, В11): время из id не читается. Запись отклоняет id
 * со временем (`abaLog.ts`).
 */
import { uuidV4, type RandomBytes } from '../domain/ids';
import { randomBytes } from './random';

export function newAbaId(bytes: RandomBytes = randomBytes): string {
  return uuidV4(bytes);
}
