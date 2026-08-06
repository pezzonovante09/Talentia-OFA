import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuthState } from '../AuthContext';
import type { ChildProfileRow } from '../../services/supabase';

// Jest never loads real Supabase env vars, so isSupabaseConfigured is false here —
// this exercises the same demo-mode sign-in/sign-out path a device without
// network/Supabase configured actually takes.

function profile(over: Partial<ChildProfileRow> = {}): ChildProfileRow {
  return {
    user_id: 'demo-1',
    child_name: 'Tali',
    age_band: '5-6',
    language: 'en',
    avatar_id: 'sun',
    child_mode: 'standard',
    methodology: null,
    guardian_attested: true,
    parental_consent_at: '2026-07-24T12:00:00.000Z',
    ...over,
  };
}

describe('auth store — demo sign-in flow', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await getAuthState().signOut();
  });

  it('starts signed out', () => {
    const s = getAuthState();
    expect(s.user).toBeNull();
    expect(s.session).toBeNull();
    expect(s.profileCompleted).toBe(false);
  });

  it('setDemoUser signs a user in and persists the session', async () => {
    await getAuthState().setDemoUser('parent@example.com');
    const s = getAuthState();
    expect(s.user?.email).toBe('parent@example.com');
    expect(s.session).not.toBeNull();
    expect(s.profileCompleted).toBe(false);

    const raw = await AsyncStorage.getItem('talentia-demo-auth');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!).user.email).toBe('parent@example.com');
  });

  it('setDemoProfile completes the profile once consent + name are present', async () => {
    await getAuthState().setDemoUser('parent@example.com');
    await getAuthState().setDemoProfile(profile());
    const s = getAuthState();
    expect(s.profile?.child_name).toBe('Tali');
    expect(s.profileCompleted).toBe(true);
  });

  it('setDemoProfile does not complete without parental consent', async () => {
    await getAuthState().setDemoUser('parent@example.com');
    await getAuthState().setDemoProfile(profile({ parental_consent_at: null }));
    expect(getAuthState().profileCompleted).toBe(false);
  });

  it('signOut clears session, profile, and demo storage', async () => {
    await getAuthState().setDemoUser('parent@example.com');
    await getAuthState().setDemoProfile(profile());
    expect(getAuthState().user).not.toBeNull();

    await getAuthState().signOut();

    const s = getAuthState();
    expect(s.user).toBeNull();
    expect(s.session).toBeNull();
    expect(s.profile).toBeNull();
    expect(s.profileCompleted).toBe(false);
    expect(await AsyncStorage.getItem('talentia-demo-auth')).toBeNull();
  });

  it('refreshProfile re-derives profile/profileCompleted from demo storage', async () => {
    await getAuthState().setDemoUser('parent@example.com');
    await getAuthState().setDemoProfile(profile());
    expect(getAuthState().profileCompleted).toBe(true);

    await getAuthState().refreshProfile();

    const s = getAuthState();
    expect(s.profile?.child_name).toBe('Tali');
    expect(s.profileCompleted).toBe(true);
  });

  it('refreshProfile clears profile when demo storage has no saved profile yet', async () => {
    await getAuthState().setDemoUser('parent@example.com');
    // No setDemoProfile call — demo storage has a user but profile: null.
    await getAuthState().refreshProfile();
    expect(getAuthState().profile).toBeNull();
    expect(getAuthState().profileCompleted).toBe(false);
  });
});
