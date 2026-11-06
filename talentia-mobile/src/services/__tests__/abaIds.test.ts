/** Идентификаторы ABA (В11): экраны берут UUIDv4, запись отклоняет id со временем. */
import { CURRENT_CONSENT_TEXTS } from '../../domain/consentTexts';
import { isUuidV4 } from '../../domain/ids';
import { newAbaId } from '../abaIds';
import { appendSession, appendTrial, appendTrialCorrection } from '../local/abaLog';
import { asAbaWriter, memoryDb } from '../local/__tests__/nodeSql';
import { appendConsentEvent } from '../local/consentLog';
import { trial } from '../../domain/__tests__/abaFixtures';

const bytes = (n: number) => Uint8Array.from({ length: n }, (_, i) => (i * 37 + 11) & 0xff);
const V7 = '018f3b5e-7c2a-7d3e-9a1b-2c4d5e6f7a8b';

async function db() {
  const d = await memoryDb();
  await appendConsentEvent(
    d,
    { id: 'g', scope: 'aba_processing', action: 'grant', childId: 'kid', textVersion: CURRENT_CONSENT_TEXTS.aba_processing[0], confirmedBy: 'biometric', actorId: 'p', at: '2026-10-11T09:00:00Z' },
    'owner',
  );
  return d;
}

describe('newAbaId', () => {
  it('UUIDv4, разные на разных байтах', () => {
    const a = newAbaId(bytes);
    expect(isUuidV4(a)).toBe(true);
    expect(newAbaId(() => new Uint8Array(16))).not.toBe(a);
  });
});

describe('запись отклоняет id со временем', () => {
  it('проба с id или sessionId UUIDv7 — ошибка; UUIDv4 и короткий id — пишутся', async () => {
    const d = await db();
    const t = trial();
    await expect(asAbaWriter(d, 'kid', (tx) => appendTrial(tx, 'kid', { ...t, id: V7 }, '2026-10-11T10:00:00Z'))).rejects.toThrow(/время/);
    await expect(asAbaWriter(d, 'kid', (tx) => appendTrial(tx, 'kid', { ...t, sessionId: V7 }, '2026-10-11T10:00:00Z'))).rejects.toThrow(/время/);
    await asAbaWriter(d, 'kid', (tx) => appendTrial(tx, 'kid', { ...t, id: newAbaId(bytes) }, '2026-10-11T10:00:00Z'));
  });

  it('сессия с id из метки времени и исправление с ULID — ошибка', async () => {
    const d = await db();
    await expect(asAbaWriter(d, 'kid', (tx) => appendSession(tx, 'kid', { id: '1760000000000', index: 1 } as never, '2026-10-11T10:00:00Z'))).rejects.toThrow(/время/);
    await expect(
      asAbaWriter(d, 'kid', (tx) =>
        appendTrialCorrection(tx, 'kid', { trialId: '01ARZ3NDEKTSV4RRFFQ69G5FAV', replacementId: 'r', sessionId: 's', msSinceOriginal: 1, fromResponse: 'independent', toResponse: 'incorrect', tokenKept: 0, tokenAdded: 0 }, '2026-10-11T10:00:00Z'),
      ),
    ).rejects.toThrow(/время/);
  });
});
