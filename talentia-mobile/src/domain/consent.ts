/**
 * Журнал согласий. Спецификация — раздел «Согласие» в `PARENT.md`.
 *
 * Append-only: событие только добавляется, никогда не правится и не удаляется.
 * Запись согласия, которую можно отредактировать, ничего не доказывает. Текущее
 * состояние не хранится отдельно — оно всегда выводится из журнала, иначе два
 * источника правды однажды разойдутся.
 *
 * Журнал живёт локально и действует без сети: согласие должно и давать, и
 * отзываться офлайн. Облако — копия, не источник.
 */

/**
 * Область согласия. Три момента — три разных вопроса, каждый тогда, когда данные
 * действительно понадобятся. ИИ и голос — разные согласия: наружу уходит разное
 * и к разным провайдерам.
 */
export type ConsentScope =
  /** Учётная запись и локальное хранение. Обязательное, при создании аккаунта. */
  | 'account_local'
  /** Облачная синхронизация профиля ребёнка. Предлагается, по умолчанию выключено. */
  | 'cloud_sync'
  /** Свободный разговор с Tali через ИИ. Спрашивается у родителя за гейтом, не у ребёнка. */
  | 'companion_ai'
  /** Распознавание голоса. Уходит запись, и уходит не туда же, куда реплики компаньона. */
  | 'voice_asr'
  | 'telemetry';

/** Области, которые относятся к конкретному ребёнку. `account_local` — к аккаунту целиком. */
const CHILD_SCOPES: ReadonlySet<ConsentScope> = new Set(['cloud_sync', 'companion_ai', 'voice_asr', 'telemetry']);

/**
 * Чем подтверждено. `signup` — только для согласия при создании аккаунта: там
 * подтверждение e-mail и есть граница. Всё остальное даётся и отзывается за
 * гейтом — биометрией или PIN.
 */
export type ConsentMethod = 'signup' | 'biometric' | 'pin';

export type ConsentEvent = {
  id: string;
  scope: ConsentScope;
  action: 'grant' | 'revoke';
  /** `null` — согласие на уровне аккаунта. */
  childId: string | null;
  /**
   * Версия текста, который родитель **видел**. Меняется текст — старое согласие не
   * переносится: родитель соглашался не с этим.
   */
  textVersion: string;
  confirmedBy: ConsentMethod;
  actorId: string;
  at: string;
};

export type ConsentStatus =
  | 'granted'
  /** Не спрашивали. Не то же, что отказ: вопрос ещё впереди. */
  | 'not_asked'
  | 'revoked'
  /** Согласие дано на прежний текст. Действует как отсутствие, пока не спросят заново. */
  | 'outdated';

/** Противоречие в событии. Непустой список — событие в журнал не пишется. */
export function consentEventErrors(e: ConsentEvent): string[] {
  const errors: string[] = [];
  const perChild = CHILD_SCOPES.has(e.scope);
  if (perChild && e.childId === null) errors.push('согласие на ребёнка без ребёнка');
  if (!perChild && e.childId !== null) errors.push('согласие на аккаунт привязано к ребёнку');
  if (e.confirmedBy === 'signup' && e.scope !== 'account_local') {
    errors.push('только согласие аккаунта подтверждается регистрацией, остальные — за гейтом');
  }
  if (e.action === 'revoke' && e.confirmedBy === 'signup') errors.push('отзыв подтверждается гейтом');
  if (!e.textVersion) errors.push('нет версии текста');
  return errors;
}

/**
 * Дописать событие. Возвращает новый журнал: прежний не мутируется.
 *
 * События, идущие раньше последнего, отклоняются: журнал, в который можно
 * вписать прошлое, так же ничего не доказывает, как журнал с правками.
 */
export function appendConsent(log: readonly ConsentEvent[], e: ConsentEvent): ConsentEvent[] {
  const errors = consentEventErrors(e);
  if (errors.length) throw new Error(`Согласие не записано: ${errors.join('; ')}`);
  const last = log[log.length - 1];
  if (last && e.at < last.at) throw new Error('Согласие не записано: событие раньше последнего в журнале');
  if (log.some((x) => x.id === e.id)) throw new Error('Согласие не записано: повтор идентификатора');
  return [...log, e];
}

/** Состояние согласия сейчас — по последнему событию этой области и этого ребёнка. */
export function consentStatus(
  log: readonly ConsentEvent[],
  scope: ConsentScope,
  childId: string | null,
  currentTextVersion: string,
): ConsentStatus {
  let last: ConsentEvent | undefined;
  for (const e of log) if (e.scope === scope && e.childId === childId) last = e;
  if (!last) return 'not_asked';
  if (last.action === 'revoke') return 'revoked';
  return last.textVersion === currentTextVersion ? 'granted' : 'outdated';
}

export function isGranted(
  log: readonly ConsentEvent[],
  scope: ConsentScope,
  childId: string | null,
  currentTextVersion: string,
): boolean {
  return consentStatus(log, scope, childId, currentTextVersion) === 'granted';
}

/**
 * Что сделать при отзыве. Не только «перестать собирать», но и «убрать собранное».
 * Отказ ничего не ломает: приложение продолжает работать без этой области.
 */
export type RevocationEffect =
  /** Tali отвечает только из банка реплик. */
  | 'companion_bank_only'
  | 'hide_free_talk'
  | 'hide_microphone'
  /** Облачные строки этого ребёнка удаляются; локальные остаются. */
  | 'delete_cloud_rows'
  | 'clear_telemetry_queue'
  | 'delete_account';

export const REVOCATION_EFFECTS: Record<ConsentScope, readonly RevocationEffect[]> = {
  account_local: ['delete_account'],
  cloud_sync: ['delete_cloud_rows'],
  companion_ai: ['companion_bank_only', 'hide_free_talk'],
  voice_asr: ['hide_microphone'],
  telemetry: ['clear_telemetry_queue'],
};

/**
 * Журнал после удаления ребёнка или аккаунта.
 *
 * Переживает удаление только он, как доказательство, что согласие было получено
 * и отозвано, — и только с псевдонимом вместо идентификаторов. Об этом прямо
 * говорит текст экрана удаления.
 */
export function pseudonymizeConsentLog(
  log: readonly ConsentEvent[],
  ids: { childId?: string; actorId?: string },
  pseudonym: string,
): ConsentEvent[] {
  return log.map((e) => ({
    ...e,
    childId: ids.childId !== undefined && e.childId === ids.childId ? pseudonym : e.childId,
    actorId: ids.actorId !== undefined && e.actorId === ids.actorId ? pseudonym : e.actorId,
  }));
}
