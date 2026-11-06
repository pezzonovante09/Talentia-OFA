/** Порт устройства приложения; тесты подменяют `setDevice(fakeDevice())`. */
import type { DeviceStore } from '../services/local/device';
import { expoDevice } from '../services/local/expoDevice';

let current: DeviceStore | null = null;

export function device(): DeviceStore {
  if (!current) current = expoDevice();
  return current;
}

export function setDevice(d: DeviceStore | null): void {
  current = d;
}
