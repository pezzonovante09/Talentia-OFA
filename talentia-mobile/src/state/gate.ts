/**
 * Гейт родительского раздела в памяти (PARENT.md «Гейт»): открыт после PIN, закрывается уходом в
 * фон и двумя минутами бездействия (`domain/parentGate.ts`); окно свежести 5 мин для чувствительных
 * действий; `gate_now` — PIN на самом экране. Ничего из этого не пишется на диск.
 */
import { create } from 'zustand';

import { canPerform, isOpen, onBackground, openSession, reconfirm, touch, type GateSession, type SensitiveAction } from '../domain/parentGate';

export type GateState = {
  session: GateSession | null;
  unlocked(now?: number): boolean;
  open(now?: number): void;
  touch(now?: number): void;
  confirm(now?: number): void;
  can(action: SensitiveAction, now?: number): boolean;
  lock(): void;
};

export const useGate = create<GateState>((set, get) => ({
  session: null,
  unlocked: (now = Date.now()) => isOpen(get().session, now),
  open: (now = Date.now()) => set({ session: openSession(now) }),
  touch: (now = Date.now()) => set({ session: touch(get().session, now) }),
  confirm: (now = Date.now()) => set({ session: reconfirm(get().session, now) }),
  can: (action, now = Date.now()) => canPerform(action, get().session, now),
  lock: () => set({ session: onBackground() }),
}));
