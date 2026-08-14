import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Forces AuthContext down its real-Supabase branch instead of the demo-mode
// branch that authStore.test.ts already covers (Jest never loads real env
// vars, so isSupabaseConfigured is false unless explicitly mocked like this).
jest.mock('../../services/supabase', () => {
  const authMock = {
    getSession: jest.fn(),
    onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    signOut: jest.fn(() => Promise.resolve({ error: null })),
  };
  const maybeSingle = jest.fn();
  const eq = jest.fn(() => ({ maybeSingle }));
  const select = jest.fn(() => ({ eq }));
  const from = jest.fn(() => ({ select }));
  return {
    isSupabaseConfigured: true,
    supabase: { auth: authMock, from },
  };
});

import { supabase } from '../../services/supabase';
import { AuthProvider, getAuthState } from '../AuthContext';

const authMock = supabase.auth as unknown as {
  getSession: jest.Mock;
  onAuthStateChange: jest.Mock;
  signOut: jest.Mock;
};
const fromMock = supabase.from as unknown as jest.Mock;

function profileRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    user_id: 'real-user-1',
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

/** Configures the from().select().eq().maybeSingle() chain's resolved value. */
function mockProfileFetch(data: unknown, error: unknown = null) {
  const maybeSingle = jest.fn().mockResolvedValue({ data, error });
  const eq = jest.fn(() => ({ maybeSingle }));
  const select = jest.fn(() => ({ eq }));
  fromMock.mockReturnValue({ select });
  return { eq };
}

describe('AuthContext — real Supabase branch (isSupabaseConfigured=true)', () => {
  beforeEach(async () => {
    // useAuthStore is a module-level singleton shared across tests (AuthContext.tsx
    // doesn't export a reset hook) — the previous test's rendered AuthProvider can
    // leave user/session/profile set, so reset via the real signOut action first,
    // *then* clear mocks so this reset call doesn't pollute this test's call counts.
    await getAuthState().signOut();
    jest.clearAllMocks();
    authMock.signOut.mockResolvedValue({ error: null });
    authMock.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });
    await AsyncStorage.clear();
  });

  it('loads the session and profile on mount, and saves an offline cache', async () => {
    const session = { user: { id: 'real-user-1', email: 'parent@example.com' } };
    authMock.getSession.mockResolvedValue({ data: { session } });
    const { eq } = mockProfileFetch(profileRow());

    render(<AuthProvider>{null}</AuthProvider>);

    await waitFor(() => expect(getAuthState().loading).toBe(false));

    const s = getAuthState();
    expect(s.user?.id).toBe('real-user-1');
    expect(s.session).not.toBeNull();
    expect(s.profile?.child_name).toBe('Tali');
    expect(s.profileCompleted).toBe(true);
    expect(s.isOffline).toBe(false);

    // Regression guard: fetchProfile must scope its query to the logged-in user —
    // a regression that drops this filter would let one account read another's
    // profile row and would pass CI unnoticed without this assertion (see the
    // same pattern already established in abaLiveSessionStore.test.ts).
    expect(fromMock).toHaveBeenCalledWith('profiles');
    expect(eq).toHaveBeenCalledWith('user_id', 'real-user-1');

    await waitFor(async () => {
      const raw = await AsyncStorage.getItem('talentia-offline-session');
      expect(raw).not.toBeNull();
    });
    const cached = JSON.parse((await AsyncStorage.getItem('talentia-offline-session'))!);
    expect(cached.userId).toBe('real-user-1');
    expect(cached.profile.child_name).toBe('Tali');
  });

  it('falls back to the offline cache and sets isOffline when getSession fails', async () => {
    await AsyncStorage.setItem(
      'talentia-offline-session',
      JSON.stringify({ userId: 'cached-user', email: 'cached@example.com', profile: profileRow({ user_id: 'cached-user' }) }),
    );
    authMock.getSession.mockRejectedValue(new Error('network down'));

    render(<AuthProvider>{null}</AuthProvider>);

    await waitFor(() => expect(getAuthState().loading).toBe(false));

    const s = getAuthState();
    expect(s.isOffline).toBe(true);
    expect(s.user?.id).toBe('cached-user');
    expect(s.profile?.child_name).toBe('Tali');
    expect(s.profileCompleted).toBe(true);
  });

  it('clears session/profile when getSession fails and there is no offline cache', async () => {
    authMock.getSession.mockRejectedValue(new Error('network down'));

    render(<AuthProvider>{null}</AuthProvider>);

    await waitFor(() => expect(getAuthState().loading).toBe(false));

    const s = getAuthState();
    expect(s.user).toBeNull();
    expect(s.session).toBeNull();
    expect(s.profile).toBeNull();
    expect(s.profileCompleted).toBe(false);
  });

  it('onAuthStateChange listener updates profile when a new session arrives', async () => {
    authMock.getSession.mockResolvedValue({ data: { session: null } });
    mockProfileFetch(profileRow());

    let capturedCallback: ((event: string, session: unknown) => void) | undefined;
    authMock.onAuthStateChange.mockImplementation((cb) => {
      capturedCallback = cb;
      return { data: { subscription: { unsubscribe: jest.fn() } } };
    });

    render(<AuthProvider>{null}</AuthProvider>);
    await waitFor(() => expect(getAuthState().loading).toBe(false));
    expect(getAuthState().user).toBeNull();

    const newSession = { user: { id: 'listener-user', email: 'listener@example.com' } };
    await capturedCallback!('SIGNED_IN', newSession);

    await waitFor(() => expect(getAuthState().user?.id).toBe('listener-user'));
    expect(getAuthState().profile?.child_name).toBe('Tali');
  });

  it('signOut calls supabase.auth.signOut, clears the offline cache, and resets state', async () => {
    const session = { user: { id: 'real-user-1', email: 'parent@example.com' } };
    authMock.getSession.mockResolvedValue({ data: { session } });
    mockProfileFetch(profileRow());

    render(<AuthProvider>{null}</AuthProvider>);
    await waitFor(() => expect(getAuthState().user).not.toBeNull());

    await getAuthState().signOut();

    expect(authMock.signOut).toHaveBeenCalledTimes(1);
    const s = getAuthState();
    expect(s.user).toBeNull();
    expect(s.session).toBeNull();
    expect(s.profile).toBeNull();
    expect(await AsyncStorage.getItem('talentia-offline-session')).toBeNull();
  });

  it('signOut still clears local state even if supabase.auth.signOut rejects', async () => {
    authMock.getSession.mockResolvedValue({ data: { session: null } });
    authMock.signOut.mockRejectedValue(new Error('network down'));

    render(<AuthProvider>{null}</AuthProvider>);
    await waitFor(() => expect(getAuthState().loading).toBe(false));

    await expect(getAuthState().signOut()).resolves.toBeUndefined();
    expect(getAuthState().user).toBeNull();
  });
});
