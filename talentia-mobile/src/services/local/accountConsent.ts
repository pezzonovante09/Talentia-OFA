/**
 * Согласие на аккаунт и локальное хранение (`account_local`, №124; PARENT.md, «Запись уроков
 * под `account_local`»). Без него на устройство не пишется ничего о ребёнке: ни итоги уроков,
 * ни данные ABA. Устройство без согласия — режим без записи: всё живёт в памяти до закрытия
 * приложения.
 *
 * Ошибка — штатный ход, а не сбой: в отчёты об ошибках её не отправлять. Ребёнок видит обычный
 * финал урока; `status` говорит экрану, что делать: `not_asked` — режим без записи, `outdated` —
 * спросить заново перед следующим уроком, `revoked` — штатно не встречается (отзыв только
 * удалением аккаунта).
 */
import { consentStatus, type ConsentStatus } from '../../domain/consent';
import { CURRENT_CONSENT_TEXTS } from '../../domain/consentTexts';
import { readConsentLog } from './consentLog';
import type { SqlDb } from './sql';

/** Согласия на аккаунт нет, оно отозвано или дано на прежний текст: не записано ничего. */
export class LessonConsentRequiredError extends Error {
  constructor(readonly status: Exclude<ConsentStatus, 'granted'>) {
    super('Нет согласия account_local: итог не записан');
  }
}

/**
 * Согласие на аккаунт на текущий текст (любой язык). Вызывать внутри транзакции записи: отзыв
 * не проскочит между проверкой и вставкой. Версия текста — из `consentTexts.ts`, не от экрана.
 */
export async function requireAccountConsent(tx: SqlDb): Promise<void> {
  const status = consentStatus(await readConsentLog(tx), 'account_local', null, CURRENT_CONSENT_TEXTS.account_local);
  if (status !== 'granted') throw new LessonConsentRequiredError(status);
}
