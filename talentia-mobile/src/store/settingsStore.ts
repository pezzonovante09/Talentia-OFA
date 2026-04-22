import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type LanguageCode = 'en' | 'ru' | 'ky';

export type Methodology = 'aba';

export type AgeBand = '5-6' | '7' | '8' | '9-10';

export type AvatarId = 'sun' | 'rocket' | 'panda' | 'unicorn';

export type TaliSkinId = 'default' | 'cool' | 'explorer' | 'scientist';

/** Key for parent PIN in SecureStore (not persisted in Zustand JSON). */
export const PARENT_PIN_SECURE_KEY = 'talentia_parent_pin';

const SETTINGS_VERSION = 2;

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
  notificationsEnabled: boolean;
  reminderHour: number;
  breakReminderEnabled: boolean;
  sessionDurationMinutes: number;
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
  setNotificationsEnabled: (value: boolean) => void;
  setReminderHour: (hour: number) => void;
  setBreakReminderEnabled: (value: boolean) => void;
  setSessionDurationMinutes: (minutes: number) => void;
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
      notificationsEnabled: false,
      reminderHour: 18,
      breakReminderEnabled: true,
      sessionDurationMinutes: 20,
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
        void (async () => {
          await writePinToSecureStore(pin);
          set({ parentPin: pin, parentPinHydrated: true });
        })();
      },
      setNotificationsEnabled: (value) => set({ notificationsEnabled: value }),
      setReminderHour: (hour) => set({ reminderHour: hour }),
      setBreakReminderEnabled: (value) => set({ breakReminderEnabled: value }),
      setSessionDurationMinutes: (minutes) => set({ sessionDurationMinutes: minutes }),
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
        const { parentPin: _removed, ...rest } = p;
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
        sessionDurationMinutes: state.sessionDurationMinutes,
        breakDurationMinutes: state.breakDurationMinutes,
        adaptiveSpeed: state.adaptiveSpeed,
        voiceInputEnabled: state.voiceInputEnabled,
        hasSeenMapTip: state.hasSeenMapTip,
        ttsEnabled: state.ttsEnabled,
        taliSpeakEnabled: state.taliSpeakEnabled,
        reduceMotion: state.reduceMotion,
      }),
      onRehydrateStorage: () => () => {
        void readPinFromSecureStore().then((pin) => {
          useSettingsStore.setState({ parentPin: pin, parentPinHydrated: true });
        });
      },
    },
  ),
);

void readPinFromSecureStore().then((pin) => {
  useSettingsStore.setState({ parentPin: pin, parentPinHydrated: true });
});
