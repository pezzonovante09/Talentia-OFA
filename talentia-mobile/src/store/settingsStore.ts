import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { AgeBand } from '../data/worlds';

/** Re-exported so existing `import { type AgeBand } from '../store/settingsStore'` call sites keep working. */
export type { AgeBand };

export type LanguageCode = 'en' | 'ru' | 'ky';

export type Methodology = 'aba';

export type AvatarId = 'sun' | 'rocket' | 'panda' | 'unicorn';

export type TaliSkinId = 'default' | 'cool' | 'explorer' | 'scientist';

/** Key for parent PIN in SecureStore (not persisted in Zustand JSON). */
export const PARENT_PIN_SECURE_KEY = 'talentia_parent_pin';
/** Lockout timestamp stored separately so clearing AsyncStorage alone cannot reset the timer. */
export const PARENT_PIN_LOCKOUT_SECURE_KEY = 'talentia_parent_pin_lockout';

const SETTINGS_VERSION = 5;

/** After this many wrong PIN attempts in a row, lock out further attempts for a while. */
export const PIN_MAX_ATTEMPTS = 5;
/** Base lockout duration — escalates with consecutive lockouts (1m → 5m → 15m, capped). */
export const PIN_LOCKOUT_MS = 60_000;
export const PIN_LOCKOUT_MAX_MS = 15 * 60_000;

async function readPinFromSecureStore(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return null;
  }
  try {
    return await SecureStore.getItemAsync(PARENT_PIN_SECURE_KEY);
  } catch {
    return null;
  }
}

async function writePinToSecureStore(pin: string | null): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }
  try {
    if (pin === null || pin === '') {
      await SecureStore.deleteItemAsync(PARENT_PIN_SECURE_KEY);
    } else {
      await SecureStore.setItemAsync(PARENT_PIN_SECURE_KEY, pin);
    }
  } catch {
    // non-critical
  }
}

async function readLockoutFromSecureStore(): Promise<number | null> {
  if (Platform.OS === 'web') return null;
  try {
    const raw = await SecureStore.getItemAsync(PARENT_PIN_LOCKOUT_SECURE_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > Date.now() ? n : null;
  } catch {
    return null;
  }
}

async function writeLockoutToSecureStore(until: number | null): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    if (until == null || until <= Date.now()) {
      await SecureStore.deleteItemAsync(PARENT_PIN_LOCKOUT_SECURE_KEY);
    } else {
      await SecureStore.setItemAsync(PARENT_PIN_LOCKOUT_SECURE_KEY, String(until));
    }
  } catch {
    // non-critical
  }
}

function nextLockoutMs(lockoutLevel: number): number {
  // level 0 → 1m, 1 → 5m, 2+ → 15m
  if (lockoutLevel <= 0) return PIN_LOCKOUT_MS;
  if (lockoutLevel === 1) return 5 * 60_000;
  return PIN_LOCKOUT_MAX_MS;
}

type SettingsState = {
  language: LanguageCode;
  methodology: Methodology;
  calmMode: boolean;
  focusMode: boolean;
  childName: string;
  ageBand: AgeBand;
  avatarId: AvatarId;
  taliSkinId: TaliSkinId;
  onboardingCompleted: boolean;
  isPremium: boolean;
  /** 4-digit PIN for parent-only sections; loaded from SecureStore. null = not set */
  parentPin: string | null;
  /** False until SecureStore read completes (avoids a brief wrong PIN gate). */
  parentPinHydrated: boolean;
  /** Consecutive wrong PIN attempts since the last success (or lockout reset). */
  pinFailedAttempts: number;
  /** Epoch ms until which PIN entry is locked out, or null if not locked. */
  pinLockedUntil: number | null;
  /** How many lockouts have fired since the last successful PIN — drives backoff. */
  pinLockoutLevel: number;
  notificationsEnabled: boolean;
  reminderHour: number;
  breakReminderEnabled: boolean;
  breakDurationMinutes: number;
  adaptiveSpeed: 'fast' | 'medium' | 'slow';
  voiceInputEnabled: boolean;
  hasSeenMapTip: boolean;
  ttsEnabled: boolean;
  taliSpeakEnabled: boolean;
  reduceMotion: boolean;
  setLanguage: (language: LanguageCode) => void;
  setMethodology: (methodology: Methodology) => void;
  toggleCalmMode: () => void;
  toggleFocusMode: () => void;
  updateProfile: (payload: {
    childName?: string;
    ageBand?: AgeBand;
    avatarId?: AvatarId;
  }) => void;
  setTaliSkin: (skinId: TaliSkinId) => void;
  setOnboardingCompleted: () => void;
  setPremium: (value: boolean) => void;
  setParentPin: (pin: string | null) => void;
  /** Record a wrong PIN attempt; triggers a lockout after PIN_MAX_ATTEMPTS in a row. */
  registerPinFailure: () => void;
  /** Reset the failure counter/lockout after a correct PIN entry. */
  registerPinSuccess: () => void;
  setNotificationsEnabled: (value: boolean) => void;
  setReminderHour: (hour: number) => void;
  setBreakReminderEnabled: (value: boolean) => void;
  setBreakDurationMinutes: (minutes: number) => void;
  setAdaptiveSpeed: (speed: 'fast' | 'medium' | 'slow') => void;
  setVoiceInputEnabled: (value: boolean) => void;
  setHasSeenMapTip: () => void;
  setTtsEnabled: (value: boolean) => void;
  setTaliSpeakEnabled: (value: boolean) => void;
  setReduceMotion: (value: boolean) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      language: 'ru',
      methodology: 'aba',
      calmMode: false,
      focusMode: false,
      childName: '',
      ageBand: '5-6',
      avatarId: 'sun',
      taliSkinId: 'default',
      onboardingCompleted: false,
      isPremium: false,
      parentPin: null,
      parentPinHydrated: false,
      pinFailedAttempts: 0,
      pinLockedUntil: null,
      pinLockoutLevel: 0,
      notificationsEnabled: false,
      reminderHour: 18,
      breakReminderEnabled: true,
      breakDurationMinutes: 5,
      adaptiveSpeed: 'medium',
      voiceInputEnabled: false,
      hasSeenMapTip: false,
      ttsEnabled: true,
      taliSpeakEnabled: true,
      reduceMotion: false,
      setLanguage: (language) => set({ language }),
      setMethodology: (methodology) => set({ methodology }),
      toggleCalmMode: () => set((state) => ({ calmMode: !state.calmMode })),
      toggleFocusMode: () => set((state) => ({ focusMode: !state.focusMode })),
      updateProfile: (payload) => set((state) => ({ ...state, ...payload })),
      setTaliSkin: (skinId) => set({ taliSkinId: skinId }),
      setOnboardingCompleted: () => set({ onboardingCompleted: true }),
      setPremium: (value) => set({ isPremium: value }),
      setParentPin: (pin) => {
        // SecureStore is unavailable on web — refuse to pretend a PIN is set,
        // otherwise gates would silently no-op after refresh.
        if (Platform.OS === 'web') {
          set({ parentPin: null, parentPinHydrated: true, pinFailedAttempts: 0, pinLockedUntil: null, pinLockoutLevel: 0 });
          return;
        }
        void (async () => {
          await writePinToSecureStore(pin);
          await writeLockoutToSecureStore(null);
          set({ parentPin: pin, parentPinHydrated: true, pinFailedAttempts: 0, pinLockedUntil: null, pinLockoutLevel: 0 });
        })();
      },
      registerPinFailure: () =>
        set((state) => {
          const attempts = state.pinFailedAttempts + 1;
          if (attempts >= PIN_MAX_ATTEMPTS) {
            const level = state.pinLockoutLevel;
            const until = Date.now() + nextLockoutMs(level);
            void writeLockoutToSecureStore(until);
            return {
              pinFailedAttempts: 0,
              pinLockedUntil: until,
              pinLockoutLevel: level + 1,
            };
          }
          return { pinFailedAttempts: attempts };
        }),
      registerPinSuccess: () => {
        void writeLockoutToSecureStore(null);
        set({ pinFailedAttempts: 0, pinLockedUntil: null, pinLockoutLevel: 0 });
      },
      setNotificationsEnabled: (value) => set({ notificationsEnabled: value }),
      setReminderHour: (hour) => set({ reminderHour: hour }),
      setBreakReminderEnabled: (value) => set({ breakReminderEnabled: value }),
      setBreakDurationMinutes: (minutes) => set({ breakDurationMinutes: minutes }),
      setAdaptiveSpeed: (speed) => set({ adaptiveSpeed: speed }),
      setVoiceInputEnabled: (value) => set({ voiceInputEnabled: value }),
      setHasSeenMapTip: () => set({ hasSeenMapTip: true }),
      setTtsEnabled: (value) => set({ ttsEnabled: value }),
      setTaliSpeakEnabled: (value) => set({ taliSpeakEnabled: value }),
      setReduceMotion: (value) => set({ reduceMotion: value }),
    }),
    {
      name: 'talentia-settings',
      version: SETTINGS_VERSION,
      storage: createJSONStorage(() => AsyncStorage),
      migrate: async (persistedState) => {
        const p = (persistedState as Record<string, unknown> | null) ?? {};
        const legacy = p.parentPin;
        if (typeof legacy === 'string' && legacy.length >= 4) {
          await writePinToSecureStore(legacy);
        }
        const { parentPin: _removed, sessionDurationMinutes: _legacySession, ...rest } = p;
        const pin = await readPinFromSecureStore();
        return {
          ...rest,
          parentPin: pin,
          parentPinHydrated: true,
        };
      },
      partialize: (state) => ({
        language: state.language,
        methodology: state.methodology,
        calmMode: state.calmMode,
        focusMode: state.focusMode,
        childName: state.childName,
        ageBand: state.ageBand,
        avatarId: state.avatarId,
        taliSkinId: state.taliSkinId,
        onboardingCompleted: state.onboardingCompleted,
        isPremium: state.isPremium,
        notificationsEnabled: state.notificationsEnabled,
        reminderHour: state.reminderHour,
        breakReminderEnabled: state.breakReminderEnabled,
        breakDurationMinutes: state.breakDurationMinutes,
        adaptiveSpeed: state.adaptiveSpeed,
        voiceInputEnabled: state.voiceInputEnabled,
        hasSeenMapTip: state.hasSeenMapTip,
        ttsEnabled: state.ttsEnabled,
        taliSpeakEnabled: state.taliSpeakEnabled,
        reduceMotion: state.reduceMotion,
        pinFailedAttempts: state.pinFailedAttempts,
        pinLockedUntil: state.pinLockedUntil,
        pinLockoutLevel: state.pinLockoutLevel,
      }),
      onRehydrateStorage: () => () => {
        void (async () => {
          const [pin, lockout] = await Promise.all([
            readPinFromSecureStore(),
            readLockoutFromSecureStore(),
          ]);
          useSettingsStore.setState({
            parentPin: pin,
            parentPinHydrated: true,
            ...(lockout != null ? { pinLockedUntil: lockout } : {}),
          });
        })();
      },
    },
  ),
);

void readPinFromSecureStore().then((pin) => {
  useSettingsStore.setState({ parentPin: pin, parentPinHydrated: true });
});
