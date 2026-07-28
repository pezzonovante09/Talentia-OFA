import { isProfileCompleted } from '../AuthContext';
import type { ChildProfileRow } from '../../services/supabase';

function base(over: Partial<ChildProfileRow> = {}): ChildProfileRow {
  return {
    user_id: 'u1',
    child_name: 'Tali',
    age_band: '5-6',
    language: 'ru',
    avatar_id: 'sun',
    child_mode: 'standard',
    methodology: null,
    guardian_attested: true,
    parental_consent_at: '2026-07-24T12:00:00.000Z',
    ...over,
  };
}

describe('isProfileCompleted', () => {
  it('rejects null / empty name', () => {
    expect(isProfileCompleted(null)).toBe(false);
    expect(isProfileCompleted(base({ child_name: '' }))).toBe(false);
    expect(isProfileCompleted(base({ child_name: '   ' }))).toBe(false);
  });

  it('rejects name without guardian attestation', () => {
    expect(isProfileCompleted(base({ guardian_attested: false }))).toBe(false);
  });

  it('rejects name without parental_consent_at', () => {
    expect(isProfileCompleted(base({ parental_consent_at: null }))).toBe(false);
    expect(isProfileCompleted(base({ parental_consent_at: '' }))).toBe(false);
    expect(isProfileCompleted(base({ parental_consent_at: '  ' }))).toBe(false);
  });

  it('accepts name + attested + consent timestamp', () => {
    expect(isProfileCompleted(base())).toBe(true);
  });
});
