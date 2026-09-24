import {
  appendConsent,
  consentEventErrors,
  consentStatus,
  isGranted,
  pseudonymizeConsentLog,
  REVOCATION_EFFECTS,
  type ConsentEvent,
} from '../consent';

let seq = 0;
function event(over: Partial<ConsentEvent> = {}): ConsentEvent {
  seq += 1;
  return {
    id: `c-${seq}`,
    scope: 'cloud_sync',
    action: 'grant',
    childId: 'kid-1',
    textVersion: 'v1',
    confirmedBy: 'biometric',
    actorId: 'parent-1',
    at: `2026-09-${String(10 + seq).padStart(2, '0')}T10:00:00Z`,
    ...over,
  };
}

const build = (...events: ConsentEvent[]) => events.reduce<ConsentEvent[]>(appendConsent, []);

describe('журнал согласий', () => {
  it('не спрашивали — не то же, что отказ', () => {
    expect(consentStatus([], 'cloud_sync', 'kid-1', 'v1')).toBe('not_asked');
  });

  it('последнее событие решает: дал, отозвал', () => {
    const log = build(event(), event({ action: 'revoke' }));
    expect(consentStatus(log, 'cloud_sync', 'kid-1', 'v1')).toBe('revoked');
  });

  it('согласие на прежний текст не переносится на новый', () => {
    const log = build(event({ textVersion: 'v1' }));
    expect(consentStatus(log, 'cloud_sync', 'kid-1', 'v2')).toBe('outdated');
    expect(isGranted(log, 'cloud_sync', 'kid-1', 'v2')).toBe(false);
  });

  it('согласие одного ребёнка не действует на другого', () => {
    const log = build(event({ childId: 'kid-1' }));
    expect(consentStatus(log, 'cloud_sync', 'kid-2', 'v1')).toBe('not_asked');
  });

  it('ИИ и голос — разные согласия', () => {
    const log = build(event({ scope: 'companion_ai' }));
    expect([
      isGranted(log, 'companion_ai', 'kid-1', 'v1'),
      isGranted(log, 'voice_asr', 'kid-1', 'v1'),
    ]).toEqual([true, false]);
  });

  it('журнал только дописывается: прежний массив не меняется', () => {
    const before = build(event());
    const after = appendConsent(before, event({ action: 'revoke' }));
    expect({ до: before.length, после: after.length }).toEqual({ до: 1, после: 2 });
  });

  it('прошлое в журнал не вписывается', () => {
    const log = build(event({ at: '2026-09-20T10:00:00Z' }));
    expect(() => appendConsent(log, event({ at: '2026-09-19T10:00:00Z' }))).toThrow();
  });

  it('повтор идентификатора отклоняется', () => {
    const e = event();
    expect(() => appendConsent([e], { ...e, at: '2026-12-01T00:00:00Z' })).toThrow();
  });
});

describe('правила события', () => {
  it('регистрацией подтверждается только согласие аккаунта', () => {
    expect(consentEventErrors(event({ confirmedBy: 'signup' }))).toContain(
      'только согласие аккаунта подтверждается регистрацией, остальные — за гейтом',
    );
    expect(consentEventErrors(event({ scope: 'account_local', childId: null, confirmedBy: 'signup' }))).toEqual([]);
  });

  it('согласие на ребёнка требует ребёнка, согласие аккаунта — нет', () => {
    expect(consentEventErrors(event({ childId: null }))).toContain('согласие на ребёнка без ребёнка');
    expect(consentEventErrors(event({ scope: 'account_local', childId: 'kid-1' }))).toContain(
      'согласие на аккаунт привязано к ребёнку',
    );
  });

  it('без версии текста — не согласие', () => {
    expect(consentEventErrors(event({ textVersion: '' }))).toContain('нет версии текста');
  });
});

describe('отзыв и удаление', () => {
  it('отзыв убирает собранное, а не только прекращает сбор', () => {
    expect(REVOCATION_EFFECTS.cloud_sync).toEqual(['delete_cloud_rows']);
    expect(REVOCATION_EFFECTS.companion_ai).toContain('companion_bank_only');
    expect(REVOCATION_EFFECTS.voice_asr).toEqual(['hide_microphone']);
  });

  it('после удаления журнал остаётся, но без идентификаторов', () => {
    const log = build(event(), event({ action: 'revoke' }), event({ childId: 'kid-2' }));
    const kept = pseudonymizeConsentLog(log, { childId: 'kid-1', actorId: 'parent-1' }, 'anon-7');
    expect(kept.map((e) => [e.childId, e.actorId])).toEqual([
      ['anon-7', 'anon-7'],
      ['anon-7', 'anon-7'],
      ['kid-2', 'anon-7'],
    ]);
  });
});
