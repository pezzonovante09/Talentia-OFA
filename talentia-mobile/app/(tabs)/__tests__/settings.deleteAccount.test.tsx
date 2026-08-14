import React from 'react';
import { Alert } from 'react-native';
import { render, waitFor, fireEvent } from '@testing-library/react-native';

// isSupabaseConfigured is read as a plain import at module load — mock it per
// test scenario the same way authContext.supabase.test.tsx does.
const mockSupabaseState = { isSupabaseConfigured: false };
jest.mock('../../../src/services/supabase', () => ({
  get isSupabaseConfigured() {
    return mockSupabaseState.isSupabaseConfigured;
  },
  supabase: { auth: { signOut: jest.fn(() => Promise.resolve({ error: null })) } },
}));

const mockBackendApi = {
  getBackendBaseUrl: jest.fn(),
  backendFetch: jest.fn(),
};
jest.mock('../../../src/services/backendApi', () => ({
  getBackendBaseUrl: (...args: unknown[]) => mockBackendApi.getBackendBaseUrl(...args),
  backendFetch: (...args: unknown[]) => mockBackendApi.backendFetch(...args),
}));

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}));

jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn(() => Promise.resolve()),
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../../src/services/notificationService', () => ({
  requestNotificationPermissions: jest.fn(),
  scheduleDailyReminder: jest.fn(),
  cancelAllReminders: jest.fn(),
}));

const mockSignOut = jest.fn(() => Promise.resolve());
jest.mock('../../../src/context/AuthContext', () => ({
  useAuth: (selector: (s: unknown) => unknown) =>
    selector({ signOut: mockSignOut, profile: null, setDemoProfile: jest.fn() }),
}));

import SettingsScreen from '../settings';

/** Presses the destructive "delete account" Alert button, matching how a user confirms. */
function confirmDeleteViaAlert() {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
    const destructive = buttons?.find((b) => b.style === 'destructive');
    destructive?.onPress?.();
  });
  return alertSpy;
}

describe('SettingsScreen — doDeleteAccount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseState.isSupabaseConfigured = false;
    mockSignOut.mockResolvedValue(undefined);
  });

  it('demo mode (no Supabase): wipes local data and signs out without a network call', async () => {
    mockSupabaseState.isSupabaseConfigured = false;
    const alertSpy = confirmDeleteViaAlert();

    const { getByText } = render(<SettingsScreen />);
    fireEvent.press(getByText('settings.deleteAccount'));

    await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));

    expect(mockBackendApi.backendFetch).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
    alertSpy.mockRestore();
  });

  it('Supabase configured, no backend URL: hard-blocks with an alert and does not wipe/sign out', async () => {
    mockSupabaseState.isSupabaseConfigured = true;
    mockBackendApi.getBackendBaseUrl.mockReturnValue(null);
    const alertSpy = confirmDeleteViaAlert();

    const { getByText } = render(<SettingsScreen />);
    fireEvent.press(getByText('settings.deleteAccount'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(2));

    expect(mockBackendApi.backendFetch).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('Supabase configured, backend deletion fails (res.ok=false): alerts and does not wipe/sign out', async () => {
    mockSupabaseState.isSupabaseConfigured = true;
    mockBackendApi.getBackendBaseUrl.mockReturnValue('https://proxy.example.com');
    mockBackendApi.backendFetch.mockResolvedValue({ ok: false });
    const alertSpy = confirmDeleteViaAlert();

    const { getByText } = render(<SettingsScreen />);
    fireEvent.press(getByText('settings.deleteAccount'));

    await waitFor(() => expect(mockBackendApi.backendFetch).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(2));

    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('Supabase configured, backend deletion succeeds: wipes local data and signs out', async () => {
    mockSupabaseState.isSupabaseConfigured = true;
    mockBackendApi.getBackendBaseUrl.mockReturnValue('https://proxy.example.com');
    mockBackendApi.backendFetch.mockResolvedValue({ ok: true });
    const alertSpy = confirmDeleteViaAlert();

    const { getByText } = render(<SettingsScreen />);
    fireEvent.press(getByText('settings.deleteAccount'));

    await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));

    expect(mockBackendApi.backendFetch).toHaveBeenCalledWith(
      '/api/account/delete',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
    alertSpy.mockRestore();
  });

  it('an unexpected exception during deletion alerts instead of crashing', async () => {
    mockSupabaseState.isSupabaseConfigured = true;
    mockBackendApi.getBackendBaseUrl.mockReturnValue('https://proxy.example.com');
    mockBackendApi.backendFetch.mockRejectedValue(new Error('network down'));
    const alertSpy = confirmDeleteViaAlert();

    const { getByText } = render(<SettingsScreen />);
    fireEvent.press(getByText('settings.deleteAccount'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(2));

    expect(mockSignOut).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
