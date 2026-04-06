import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type LanguageCode = 'en' | 'ru' | 'ky';

export type Methodology = 'aba';

export type AgeBand = '5-6' | '7' | '8' | '9-10';

export type AvatarId = 'sun' | 'rocket' | 'panda' | 'unicorn';

export type TaliSkinId = 'default' | 'cool' | 'explorer' | 'scientist';

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
  /** 4-digit PIN code for parent-only sections. null = not set */
  parentPin: string | null;
  /** Whether daily reminder notifications are enabled */
  notificationsEnabled: boolean;
  /** Hour (0-23) for the daily reminder */
  reminderHour: number;
  /** Whether break reminder during lessons is enabled */
  breakReminderEnabled: boolean;
  /** Session duration in minutes before suggesting a break (15, 20, or 30) */
  sessionDurationMinutes: number;
  /** Break duration in minutes (5 or 10) */
  breakDurationMinutes: number;
  /** Adaptive difficulty speed: fast=wider range, slow=stricter match */
  adaptiveSpeed: 'fast' | 'medium' | 'slow';
  /** Whether voice input is enabled for input tasks */
  voiceInputEnabled: boolean;
  /** True after first map visit — hides the tutorial overlay */
  hasSeenMapTip: boolean;
  /** Whether text-to-speech is enabled for lesson questions and options */
  ttsEnabled: boolean;
  /** Whether Tali speaks her chat replies aloud via neural TTS */
  taliSpeakEnabled: boolean;
  /** Fewer motion effects (no confetti, no map node pulse) */
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
      setParentPin: (pin) => set({ parentPin: pin }),
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
      storage: createJSONStorage(() => AsyncStorage),
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
        parentPin: state.parentPin,
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
    },
  ),
);
