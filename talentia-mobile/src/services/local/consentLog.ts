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
  placeConsentEvent,
  type ConsentEvent,
  type GuardianRole,
} from '../../domain/consent';
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
 */
export async function appendConsentEvent(db: SqlDb, e: ConsentEvent, actorRole: GuardianRole | null): Promise<void> {
  if (e.scope === 'aba_processing' && e.action === 'revoke') {
    throw new Error('Согласие не записано: отзыв согласия на ABA — только через revokeAbaProcessing');
  }
  await withDbLock(db, () => db.transaction((tx) => insertConsentEvent(tx, e, actorRole)));
}

/**
 * Вставка события внутри уже открытой транзакции — для записей, которые обязаны идти вместе
 * с событием (отзыв согласия на ABA и удаление данных ABA, `purge.ts`). Вызывающий держит
 * замок `withDbLock`. Отзыв раньше последнего события не отклоняется, а встаёт за ним
 * (`placeConsentEvent`).
 */
export async function insertConsentEvent(tx: SqlDb, e: ConsentEvent, actorRole: GuardianRole | null): Promise<void> {
  const errors = consentEventErrors(e);
  const actorError = consentActorError(e, actorRole);
  if (actorError) errors.push(actorError);
  if (errors.length) throw new Error(`Согласие не записано: ${errors.join('; ')}`);
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
