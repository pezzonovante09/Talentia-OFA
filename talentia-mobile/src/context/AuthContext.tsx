import React, { useEffect } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { supabase, isSupabaseConfigured, type ChildProfileRow } from '../services/supabase';
import { useSettingsStore } from '../store/settingsStore';

const DEMO_STORAGE_KEY = 'talentia-demo-auth';
/** Persisted after every successful Supabase login so the app works offline */
const OFFLINE_CACHE_KEY = 'talentia-offline-session';

type OfflineCache = {
  userId: string;
  email: string;
  profile: ChildProfileRow | null;
};

type DemoState = {
  user: { id: string; email: string };
  profile: ChildProfileRow | null;
};

type AuthState = {
  user: User | null;
  session: Session | null;
  profile: ChildProfileRow | null;
  loading: boolean;
  profileCompleted: boolean;
  /** True when running on a cached session because the server is unreachable */
  isOffline: boolean;
};

export type AuthContextValue = AuthState & {
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  /** Demo mode: set after "sign up" / "login" when Supabase is not configured */
  setDemoUser: (email: string) => Promise<void>;
  /** Demo mode: set after parent-setup when Supabase is not configured */
  setDemoProfile: (profile: ChildProfileRow) => Promise<void>;
};

const PROFILE_TABLE = 'profiles';

async function fetchProfile(userId: string): Promise<ChildProfileRow | null> {
  const { data, error } = await supabase
    .from(PROFILE_TABLE)
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return null;
  return data as ChildProfileRow | null;
}

function isProfileCompleted(profile: ChildProfileRow | null): boolean {
  return !!profile?.child_name?.trim();
}

function syncProfileToLocal(profile: ChildProfileRow | null) {
  if (!profile) return;
  useSettingsStore.getState().setLanguage(profile.language as 'en' | 'ru' | 'ky');
  useSettingsStore.getState().updateProfile({
    childName: profile.child_name,
    ageBand: profile.age_band as '5-6' | '7' | '8' | '9-10',
    avatarId: profile.avatar_id as 'sun' | 'rocket' | 'panda' | 'unicorn',
  });
  if (profile.methodology) {
    useSettingsStore.getState().setMethodology('aba');
  }
}

/** Persist session+profile so the app can start without network */
async function saveOfflineCache(userId: string, email: string, profile: ChildProfileRow | null) {
  try {
    const cache: OfflineCache = { userId, email, profile };
    await AsyncStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // non-critical
  }
}

async function loadOfflineCache(): Promise<OfflineCache | null> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_CACHE_KEY);
    return raw ? (JSON.parse(raw) as OfflineCache) : null;
  } catch {
    return null;
  }
}

/**
 * Backing store for auth state. Using Zustand (instead of a plain React
 * Context value object) lets consumers subscribe with a selector so they
 * only re-render when the specific slice they read actually changes,
 * rather than on every auth state update (loading/session/etc).
 */
const useAuthStore = create<AuthContextValue>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  loading: true,
  profileCompleted: false,
  isOffline: false,

  refreshProfile: async () => {
    if (!isSupabaseConfigured) {
      try {
        const raw = await AsyncStorage.getItem(DEMO_STORAGE_KEY);
        if (raw) {
          const demo: DemoState = JSON.parse(raw);
          set({ profile: demo.profile, profileCompleted: isProfileCompleted(demo.profile) });
          if (demo.profile) syncProfileToLocal(demo.profile);
        }
      } catch {
        set({ profile: null, profileCompleted: false });
      }
      return;
    }
    const userId = get().user?.id;
    const userEmail = get().user?.email;
    if (!userId) {
      set({ profile: null, profileCompleted: false });
      return;
    }
    const p = await fetchProfile(userId);
    if (p) {
      set({ profile: p, profileCompleted: isProfileCompleted(p) });
      syncProfileToLocal(p);
      await saveOfflineCache(userId, userEmail ?? '', p);
    }
  },

  setDemoUser: async (email: string) => {
    const demoUser = { id: `demo-${Date.now()}`, email };
    const sessionFake = { user: demoUser } as Session;
    set({ user: demoUser as User, session: sessionFake, profile: null, profileCompleted: false });
    await AsyncStorage.setItem(
      DEMO_STORAGE_KEY,
      JSON.stringify({ user: demoUser, profile: null }),
    );
  },

  setDemoProfile: async (profileData: ChildProfileRow) => {
    set({ profile: profileData, profileCompleted: isProfileCompleted(profileData) });
    syncProfileToLocal(profileData);
    try {
      const raw = await AsyncStorage.getItem(DEMO_STORAGE_KEY);
      const demo: DemoState = raw ? JSON.parse(raw) : { user: { id: 'demo', email: '' }, profile: null };
      demo.profile = profileData;
      await AsyncStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(demo));
    } catch {
      // ignore
    }
  },

  signOut: async () => {
    if (!isSupabaseConfigured) {
      await AsyncStorage.removeItem(DEMO_STORAGE_KEY);
    } else {
      try {
        await supabase.auth.signOut();
      } catch {
        // Best-effort: local state is cleared below regardless of network errors.
      }
      await AsyncStorage.removeItem(OFFLINE_CACHE_KEY);
    }
    set({ user: null, session: null, profile: null, profileCompleted: false, isOffline: false });
  },
}));

/**
 * Mounts the auth session bootstrap/listener side effects once for the app.
 * Does not provide a React Context — state lives in `useAuthStore` (Zustand)
 * so consumers can select just the slice they need.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!isSupabaseConfigured) {
      AsyncStorage.getItem(DEMO_STORAGE_KEY)
        .then((raw) => {
          if (raw) {
            const demo: DemoState = JSON.parse(raw);
            const userFake = demo.user as User;
            useAuthStore.setState({
              user: userFake,
              session: { user: userFake } as Session,
              profile: demo.profile,
              profileCompleted: isProfileCompleted(demo.profile),
            });
            if (demo.profile) syncProfileToLocal(demo.profile);
          }
          useAuthStore.setState({ loading: false });
        })
        .catch(() => useAuthStore.setState({ loading: false }));
      return;
    }

    const AUTH_TIMEOUT_MS = 8000;

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Auth timeout')), AUTH_TIMEOUT_MS)
    );

    Promise.race([supabase.auth.getSession(), timeoutPromise])
      .then((result) => {
        const { data: { session: s } } = result;
        useAuthStore.setState({ session: s, user: s?.user ?? null, isOffline: false });
        if (s?.user?.id) {
          fetchProfile(s.user.id).then((p) => {
            useAuthStore.setState({ profile: p, profileCompleted: isProfileCompleted(p) });
            if (p) {
              syncProfileToLocal(p);
              saveOfflineCache(s.user.id, s.user.email ?? '', p);
            }
          });
        } else {
          useAuthStore.setState({ profile: null, profileCompleted: false });
        }
      })
      .catch(async () => {
        const cache = await loadOfflineCache();
        if (cache) {
          const offlineUser = { id: cache.userId, email: cache.email } as User;
          useAuthStore.setState({
            user: offlineUser,
            session: { user: offlineUser } as Session,
            profile: cache.profile,
            profileCompleted: isProfileCompleted(cache.profile),
            isOffline: true,
          });
          if (cache.profile) syncProfileToLocal(cache.profile);
        } else {
          useAuthStore.setState({ session: null, user: null, profile: null, profileCompleted: false });
        }
      })
      .finally(() => useAuthStore.setState({ loading: false }));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, s) => {
      useAuthStore.setState({ session: s, user: s?.user ?? null, isOffline: false });
      if (s?.user?.id) {
        const p = await fetchProfile(s.user.id);
        useAuthStore.setState({ profile: p, profileCompleted: isProfileCompleted(p) });
        if (p) {
          syncProfileToLocal(p);
          saveOfflineCache(s.user.id, s.user.email ?? '', p);
        }
      } else {
        useAuthStore.setState({ profile: null, profileCompleted: false });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const userId = useAuthStore((s) => s.user?.id);
  const userEmail = useAuthStore((s) => s.user?.email);
  const isOffline = useAuthStore((s) => s.isOffline);

  useEffect(() => {
    if (!isSupabaseConfigured || !userId || isOffline) return;
    fetchProfile(userId).then((p) => {
      if (p) {
        useAuthStore.setState({ profile: p, profileCompleted: isProfileCompleted(p) });
        syncProfileToLocal(p);
        saveOfflineCache(userId, userEmail ?? '', p);
      }
    });
  }, [userId, userEmail, isOffline]);

  return <>{children}</>;
}

/** Read the full auth state/actions object (re-renders on any change). */
export function useAuth(): AuthContextValue;
/** Read a derived slice of the auth state; only re-renders when that slice changes. */
export function useAuth<T>(selector: (state: AuthContextValue) => T): T;
export function useAuth<T>(selector?: (state: AuthContextValue) => T): T | AuthContextValue {
  return useAuthStore(selector ?? ((s: AuthContextValue) => s as unknown as T));
}

/** Imperative access outside React components (e.g. non-hook utility code). */
export const getAuthState = useAuthStore.getState;
