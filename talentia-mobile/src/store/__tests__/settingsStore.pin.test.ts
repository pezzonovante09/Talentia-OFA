import { PIN_MAX_ATTEMPTS, useSettingsStore } from '../settingsStore';

describe('settingsStore PIN lockout', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      pinFailedAttempts: 0,
      pinLockedUntil: null,
      pinLockoutLevel: 0,
      parentPin: '1234',
      parentPinHydrated: true,
    });
  });

  it('locks out after PIN_MAX_ATTEMPTS failures and escalates duration on repeat lockouts', () => {
    const before = Date.now();
    for (let i = 0; i < PIN_MAX_ATTEMPTS; i++) {
      useSettingsStore.getState().registerPinFailure();
    }
    const state = useSettingsStore.getState();
    expect(state.pinFailedAttempts).toBe(0);
    expect(state.pinLockedUntil).not.toBeNull();
    expect(state.pinLockedUntil!).toBeGreaterThanOrEqual(before + 60_000 - 50);
    expect(state.pinLockoutLevel).toBe(1);

    // Second lockout wave → 5 minutes
    for (let i = 0; i < PIN_MAX_ATTEMPTS; i++) {
      useSettingsStore.getState().registerPinFailure();
    }
    const state2 = useSettingsStore.getState();
    expect(state2.pinLockoutLevel).toBe(2);
    expect(state2.pinLockedUntil!).toBeGreaterThanOrEqual(before + 5 * 60_000 - 50);
  });

  it('clears lockout state on successful PIN entry', () => {
    for (let i = 0; i < PIN_MAX_ATTEMPTS; i++) {
      useSettingsStore.getState().registerPinFailure();
    }
    expect(useSettingsStore.getState().pinLockedUntil).not.toBeNull();

    useSettingsStore.getState().registerPinSuccess();
    const state = useSettingsStore.getState();
    expect(state.pinFailedAttempts).toBe(0);
    expect(state.pinLockedUntil).toBeNull();
    expect(state.pinLockoutLevel).toBe(0);
  });
});
