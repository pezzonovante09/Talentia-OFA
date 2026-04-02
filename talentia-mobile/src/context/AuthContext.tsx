import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

type AuthContextValue = AuthState & {
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  /** Demo mode: set after "sign up" / "login" when Supabase is not configured */
  setDemoUser: (email: string) => Promise<void>;
  /** Demo mode: set after parent-setup when Supabase is not configured */
  setDemoProfile: (profile: ChildProfileRow) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ChildProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);

  const refreshProfile = useCallback(async () => {
    if (!isSupabaseConfigured) {
      try {
        const raw = await AsyncStorage.getItem(DEMO_STORAGE_KEY);
        if (raw) {
          const demo: DemoState = JSON.parse(raw);
          setProfile(demo.profile);
          if (demo.profile) syncProfileToLocal(demo.profile);
        }
      } catch {
        setProfile(null);
      }
      return;
    }
    if (!user?.id) {
      setProfile(null);
      return;
    }
    const p = await fetchProfile(user.id);
    if (p) {
      setProfile(p);
      syncProfileToLocal(p);
      // Keep offline cache fresh
      await saveOfflineCache(user.id, user.email ?? '', p);
    }
  }, [user?.id, user?.email]);

  const setDemoUser = useCallback(async (email: string) => {
    const demoUser = { id: `demo-${Date.now()}`, email };
    const sessionFake = { user: demoUser } as Session;
    setUser(demoUser as User);
    setSession(sessionFake);
    setProfile(null);
    await AsyncStorage.setItem(
      DEMO_STORAGE_KEY,
      JSON.stringify({ user: demoUser, profile: null }),
    );
  }, []);

  const setDemoProfile = useCallback(async (profileData: ChildProfileRow) => {
    setProfile(profileData);
    syncProfileToLocal(profileData);
    try {
      const raw = await AsyncStorage.getItem(DEMO_STORAGE_KEY);
      const demo: DemoState = raw ? JSON.parse(raw) : { user: { id: 'demo', email: '' }, profile: null };
      demo.profile = profileData;
      await AsyncStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(demo));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      AsyncStorage.getItem(DEMO_STORAGE_KEY)
        .then((raw) => {
          if (raw) {
            const demo: DemoState = JSON.parse(raw);
            const userFake = demo.user as User;
            setUser(userFake);
            setSession({ user: userFake } as Session);
            setProfile(demo.profile);
            if (demo.profile) syncProfileToLocal(demo.profile);
          }
          setLoading(false);
        })
        .catch(() => setLoading(false));
      return;
    }

    const AUTH_TIMEOUT_MS = 8000;

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Auth timeout')), AUTH_TIMEOUT_MS)
    );

    Promise.race([supabase.auth.getSession(), timeoutPromise])
      .then((result) => {
        const { data: { session: s } } = result;
        setSession(s);
        setUser(s?.user ?? null);
        setIsOffline(false);
        if (s?.user?.id) {
          fetchProfile(s.user.id).then((p) => {
            setProfile(p);
            if (p) {
              syncProfileToLocal(p);
              // Persist for offline use
              saveOfflineCache(s.user.id, s.user.email ?? '', p);
            }
          });
        } else {
          setProfile(null);
        }
      })
      .catch(async () => {
        // Network/timeout — try offline cache so user can still open the app
        const cache = await loadOfflineCache();
        if (cache) {
          const offlineUser = { id: cache.userId, email: cache.email } as User;
          setUser(offlineUser);
          setSession({ user: offlineUser } as Session);
          setProfile(cache.profile);
          if (cache.profile) syncProfileToLocal(cache.profile);
          setIsOffline(true);
        } else {
          // No cache — first time without network, must go to login
          setSession(null);
          setUser(null);
          setProfile(null);
        }
      })
      .finally(() => setLoading(false));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      setIsOffline(false);
      if (s?.user?.id) {
        const p = await fetchProfile(s.user.id);
        setProfile(p);
        if (p) {
          syncProfileToLocal(p);
          saveOfflineCache(s.user.id, s.user.email ?? '', p);
        }
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !user?.id || isOffline) return;
    fetchProfile(user.id).then((p) => {
      if (p) {
        setProfile(p);
        syncProfileToLocal(p);
        saveOfflineCache(user.id, user.email ?? '', p);
      }
    });
  }, [user?.id, user?.email, isOffline]);

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured) {
      await AsyncStorage.removeItem(DEMO_STORAGE_KEY);
    } else {
      await supabase.auth.signOut().catch(() => {});
      await AsyncStorage.removeItem(OFFLINE_CACHE_KEY);
    }
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsOffline(false);
  }, []);

  const profileCompleted = isProfileCompleted(profile);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      profile,
      loading,
      profileCompleted,
      isOffline,
      signOut,
      refreshProfile,
      setDemoUser,
      setDemoProfile,
    }),
    [user, session, profile, loading, profileCompleted, isOffline, signOut, refreshProfile, setDemoUser, setDemoProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
