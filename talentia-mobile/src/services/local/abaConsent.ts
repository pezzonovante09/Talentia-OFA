/**
 * Согласие на данные ABA (`aba_processing`) — на ребёнка, за PIN (ABA.md «Согласие `aba_processing`»). Без него
 * сессия не пишется вовсе (`withAbaWrite`). Отзыв — только с удалением данных ABA (`revokeAbaProcessing`,
 * `purge.ts`): отзыв без удаления оставил бы данные о развитии без основания.
 *
 * Тексты согласий — черновики (`CURRENT_CONSENT_TEXTS`, `DRAFT`): с ними к детям нельзя, итог — после юриста.
 */
import { uuidV4, type RandomBytes } from '../../domain/ids';
import { CURRENT_CONSENT_TEXTS } from '../../domain/consentTexts';
import type { InterfaceLang } from '../../domain/regionVisibility';
import type { GuardianRole } from '../../domain/consent';
import { appendConsentEvent } from './consentLog';
import type { SqlDb } from './sql';

/** Версия текста на языке экрана — та, которую родитель видел. */
export function abaConsentTextVersion(lang: InterfaceLang): string {
  const versions = CURRENT_CONSENT_TEXTS.aba_processing;
  return versions.find((v) => v.startsWith(`${lang}-`)) ?? versions[0];
}

export async function grantAbaProcessing(
  db: SqlDb,
  input: { childId: string; accountId: string; lang: InterfaceLang; at: string; randomBytes: RandomBytes; role?: GuardianRole },
): Promise<void> {
  await appendConsentEvent(
    db,
    {
      id: uuidV4(input.randomBytes),
      scope: 'aba_processing',
      action: 'grant',
      childId: input.childId,
      textVersion: abaConsentTextVersion(input.lang),
      confirmedBy: 'pin',
      actorId: input.accountId,
      at: input.at,
    },
    input.role ?? 'owner',
  );
}
