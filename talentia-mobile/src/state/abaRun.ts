/**
 * Занятие ABA, выбранное на экране 2.6: конфигурация и кто ведёт. Само занятие (состояние домена, шаг, модели
 * экрана) — в экране сессии; здесь только то, что передаётся между экранами. Имён нет нигде (`AbaObserver`).
 */
import { create } from 'zustand';

import type { AbaConfig, AbaObserver } from '../types/aba';

export type AbaRunSetup = {
  config: AbaConfig | null;
  observers: AbaObserver[];
  primaryObserverId: string | null;
  set(p: { config: AbaConfig; observers: AbaObserver[]; primaryObserverId: string | null }): void;
  reset(): void;
};

export const useAbaRun = create<AbaRunSetup>((set) => ({
  config: null,
  observers: [],
  primaryObserverId: null,
  set: (p) => set(p),
  reset: () => set({ config: null, observers: [], primaryObserverId: null }),
}));
