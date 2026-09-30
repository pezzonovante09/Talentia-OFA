/**
 * Журнал согласий на устройстве. Спецификация — PARENT.md, «Согласие»; правила —
 * `domain/consent.ts`.
 *
 * Локальная копия обязательна: без сети согласие должно и даваться, и отзываться.
 * Облако — копия, не источник. Только дописывание: база отклоняет правку и удаление
 * (`schema.ts`), а здесь — событие раньше последнего и противоречивое событие.
 */
import { consentEventErrors, type ConsentEvent } from '../../domain/consent';
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

/** Дописать событие. Порядок и повтор проверяются внутри той же транзакции. */
export async function appendConsentEvent(db: SqlDb, e: ConsentEvent): Promise<void> {
  const errors = consentEventErrors(e);
  if (errors.length) throw new Error(`Согласие не записано: ${errors.join('; ')}`);
  await db.transaction(async () => {
    const [last] = await db.all<{ at: string }>('SELECT at FROM consent_events ORDER BY seq DESC LIMIT 1');
    if (last && e.at < last.at) throw new Error('Согласие не записано: событие раньше последнего в журнале');
    await db.run(
      `INSERT INTO consent_events (id, scope, action, child_id, text_version, confirmed_by, actor_id, at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [e.id, e.scope, e.action, e.childId, e.textVersion, e.confirmedBy, e.actorId, e.at],
    );
  });
}

/** Весь журнал в порядке записи — из него выводится текущее состояние (`consentStatus`). */
export async function readConsentLog(db: SqlDb): Promise<ConsentEvent[]> {
  return (await db.all<Row>('SELECT * FROM consent_events ORDER BY seq')).map(toEvent);
}

/** События начиная после позиции `afterSeq` — для синхронизации. */
export async function consentEventsAfter(
  db: SqlDb,
  childId: string | null,
  afterSeq: number,
): Promise<{ seq: number; event: ConsentEvent }[]> {
  const rows = await db.all<Row & { seq: number }>(
    childId === null
      ? 'SELECT * FROM consent_events WHERE child_id IS NULL AND seq > ? ORDER BY seq'
      : 'SELECT * FROM consent_events WHERE child_id = ? AND seq > ? ORDER BY seq',
    childId === null ? [afterSeq] : [childId, afterSeq],
  );
  return rows.map((r) => ({ seq: r.seq, event: toEvent(r) }));
}
