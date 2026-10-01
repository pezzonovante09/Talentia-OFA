import {
  appendConsent,
  canManageConsent,
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
    at: new Date(Date.UTC(2026, 8, 10, 10) + seq * 86_400_000).toISOString(),
    ...over,
  };
}

const build = (...events: ConsentEvent[]) => events.reduce<ConsentEvent[]>((log, e) => appendConsent(log, e, 'owner'), []);

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
    const after = appendConsent(before, event({ action: 'revoke' }), 'owner');
    expect({ до: before.length, после: after.length }).toEqual({ до: 1, после: 2 });
  });

  it('прошлое в журнал не вписывается', () => {
    const log = build(event({ at: '2026-09-20T10:00:00Z' }));
    expect(() => appendConsent(log, event({ at: '2026-09-19T10:00:00Z' }), 'owner')).toThrow();
  });

  it('отзыв при сбитых часах не отклоняется, а встаёт за последним событием', () => {
    const log = build(event({ at: '2026-09-20T10:00:00Z' }));
    const after = appendConsent(log, event({ action: 'revoke', at: '2026-09-19T10:00:00Z' }), 'owner');
    expect(after[1].at).toBe('2026-09-20T10:00:00Z');
    expect(consentStatus(after, 'cloud_sync', 'kid-1', 'v1')).toBe('revoked');
  });

  it('время сравнивается по моменту, а не строкой', () => {
    const log = build(event({ at: '2026-09-20T10:00:00Z' }));
    expect(appendConsent(log, event({ at: '2026-09-20T10:00:00.000Z' }), 'owner')).toHaveLength(2);
  });

  it('повтор идентификатора отклоняется', () => {
    const e = event();
    expect(() => appendConsent([e], { ...e, at: '2026-12-01T00:00:00Z' }, 'owner')).toThrow();
  });

  it('действует любая текущая версия — по одной на язык', () => {
    const log = build(event({ textVersion: 'ru-2' }));
    expect(isGranted(log, 'cloud_sync', 'kid-1', ['ru-2', 'en-2', 'ky-2'])).toBe(true);
    expect(isGranted(log, 'cloud_sync', 'kid-1', ['ru-3', 'en-3'])).toBe(false);
  });

  it('роль проверяется при записи: второй родитель не даёт того, что даёт владелец', () => {
    expect(() => appendConsent([], event({ scope: 'aba_processing' }), 'guardian')).toThrow(/роль/);
    expect(() => appendConsent([], event({ scope: 'aba_processing' }), null)).toThrow(/роль/);
    expect(appendConsent([], event({ scope: 'telemetry', action: 'revoke' }), 'guardian')).toHaveLength(1);
    expect(appendConsent([], event({ scope: 'account_local', childId: null }), null)).toHaveLength(1);
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
    expect(REVOCATION_EFFECTS.aba_processing).toEqual(['close_aba_mode', 'delete_aba_data']);
  });

  const KID_P = '6f1c1a8e-0000-4000-8000-000000000001';
  const ADULT_P = '6f1c1a8e-0000-4000-8000-000000000002';

  it('после удаления журнал остаётся, но с разными псевдонимами у ребёнка и взрослого', () => {
    const log = build(event(), event({ action: 'revoke' }), event({ childId: 'kid-2' }));
    const kept = pseudonymizeConsentLog(log, {
      child: { id: 'kid-1', pseudonym: KID_P },
      actor: { id: 'parent-1', pseudonym: ADULT_P },
    });
    expect(kept.map((e) => [e.childId, e.actorId])).toEqual([
      [KID_P, ADULT_P],
      [KID_P, ADULT_P],
      ['kid-2', ADULT_P],
    ]);
  });

  it('общий псевдоним на ребёнка и взрослого — ошибка', () => {
    expect(() =>
      pseudonymizeConsentLog([], { child: { id: 'kid-1', pseudonym: KID_P }, actor: { id: 'parent-1', pseudonym: KID_P } }),
    ).toThrow();
  });
});

describe('кто управляет согласием', () => {
  it('ИИ, голос и облако — только владелец', () => {
    expect((['companion_ai', 'voice_asr', 'cloud_sync'] as const).map((s) => canManageConsent(s, 'guardian'))).toEqual([
      false,
      false,
      false,
    ]);
    expect((['companion_ai', 'voice_asr', 'cloud_sync'] as const).map((s) => canManageConsent(s, 'owner'))).toEqual([
      true,
      true,
      true,
    ]);
  });

  it('данные ABA — согласие на ребёнка, даёт только владелец, специалист центра — нет', () => {
    expect(consentEventErrors({ ...event(), scope: 'aba_processing', childId: null })).toContain('согласие на ребёнка без ребёнка');
    expect(consentEventErrors({ ...event(), scope: 'aba_processing' })).toEqual([]);
    expect((['owner', 'guardian', 'specialist'] as const).map((r) => canManageConsent('aba_processing', r))).toEqual([
      true,
      false,
      false,
    ]);
  });

  it('телеметрию может отключить и второй родитель; специалист — ничего', () => {
    expect([canManageConsent('telemetry', 'guardian'), canManageConsent('telemetry', 'specialist')]).toEqual([true, false]);
  });
});
