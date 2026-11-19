/**
 * Журнал согласий на устройстве. Спецификация — PARENT.md, «Согласие»; правила —
 * `domain/consent.ts`.
 *
 * Локальная копия обязательна: без сети согласие должно и даваться, и отзываться.
 * Облако — копия, не источник. Только дописывание: база отклоняет правку и удаление
 * (`schema.ts`), а здесь — событие раньше последнего и противоречивое событие.
 */
import {
  consentActorError,
  consentEventErrors,
  isGranted,
  placeConsentEvent,
  type ConsentEvent,
  type GuardianRole,
} from '../../domain/consent';
import { CURRENT_CONSENT_TEXTS } from '../../domain/consentTexts';
import { withDbLock } from './lock';
import type { SqlDb } from './sql';

type Row = {
  id: string;
  scope: ConsentEvent['scope'];
  action: ConsentEvent['action'];
  child_id: string | null;
  text_version: string;
  confirmed_by: ConsentEvent['confirmedBy'];
  actor_id: string;
  at: string;
};

const toEvent = (r: Row): ConsentEvent => ({
  id: r.id,
  scope: r.scope,
  action: r.action,
  childId: r.child_id,
  textVersion: r.text_version,
  confirmedBy: r.confirmed_by,
  actorId: r.actor_id,
  at: r.at,
});

/**
 * Дописать событие. Порядок и повтор проверяются внутри той же транзакции; замок общий с
 * синхронизацией — отзыв не проскакивает посреди её прохода. `actorRole` — роль взрослого
 * при ребёнке (для согласия на аккаунт — `null`): второй родитель на своём устройстве не
 * включит то, что даёт только владелец.
 *
 * Отзыв согласия на ABA сюда не принимается: он идёт только через `revokeAbaProcessing`,
 * вместе с удалением данных. Отзыв без удаления оставил бы данные о здоровье без основания.
 * Отзыв `account_local` — тоже: только удалением аккаунта (`wipeDevice`), иначе итоги уроков и
 * навыки остались бы на устройстве без согласия (№124).
 */
export async function appendConsentEvent(db: SqlDb, e: ConsentEvent, actorRole: GuardianRole | null): Promise<void> {
  if (e.scope === 'aba_processing' && e.action === 'revoke') {
    throw new Error('Согласие не записано: отзыв согласия на ABA — только через revokeAbaProcessing');
  }
  if (e.scope === 'account_local' && e.action === 'revoke') {
    throw new Error('Согласие не записано: отзыв account_local — только удалением аккаунта (wipeDevice)');
  }
  await withDbLock(db, () => db.transaction((tx) => insertConsentEvent(tx, e, actorRole)));
}

/**
 * Вставка события внутри уже открытой транзакции — для записей, которые обязаны идти вместе
 * с событием (отзыв согласия на ABA и удаление данных ABA, `purge.ts`). Вызывающий держит
 * замок `withDbLock`. Отзыв раньше последнего события не отклоняется, а встаёт за ним
 * (`placeConsentEvent`).
 *
 * Согласие на ребёнка без действующего `account_local` не выдаётся (№124): без аккаунта на
 * устройство не пишется ничего о ребёнке, а событие согласия на ABA само говорит о режиме.
 * Отзыв принимается всегда.
 */
export async function insertConsentEvent(tx: SqlDb, e: ConsentEvent, actorRole: GuardianRole | null): Promise<void> {
  const errors = consentEventErrors(e);
  const actorError = consentActorError(e, actorRole);
  if (actorError) errors.push(actorError);
  if (errors.length) throw new Error(`Согласие не записано: ${errors.join('; ')}`);
  if (e.action === 'grant' && e.childId !== null) {
    if (!isGranted(await readConsentLog(tx), 'account_local', null, CURRENT_CONSENT_TEXTS.account_local)) {
      throw new Error('Согласие не записано: сначала согласие account_local');
    }
  }
  const [last] = await tx.all<{ at: string }>('SELECT at FROM consent_events ORDER BY seq DESC LIMIT 1');
  const placed = placeConsentEvent(last?.at, e);
  await tx.run(
    `INSERT INTO consent_events (id, scope, action, child_id, text_version, confirmed_by, actor_id, at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [placed.id, placed.scope, placed.action, placed.childId, placed.textVersion, placed.confirmedBy, placed.actorId, placed.at],
  );
}

/** Весь журнал в порядке записи — из него выводится текущее состояние (`consentStatus`). */
export async function readConsentLog(db: SqlDb): Promise<ConsentEvent[]> {
  return (await db.all<Row>('SELECT * FROM consent_events ORDER BY seq')).map(toEvent);
}
