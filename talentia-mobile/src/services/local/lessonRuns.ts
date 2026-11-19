/**
 * Прохождения уроков на устройстве — источник отчёта родителю (`domain/parentReport.ts`):
 * отчёт строится из локальных данных, облако — резервная копия (PARENT.md). Только
 * дописывание.
 *
 * **Без согласия `account_local` итоги урока не пишутся** (№124). Экраны пишут только через
 * `commit.ts`: он вызывает `withLessonWrite`, который проверяет согласие внутри той же
 * транзакции, что и запись. На время записи открываются ворота `lesson_write_gate`; без них
 * вставку прохождений и запись навыков, атласа и счётчика уроков отклоняет сама база
 * (`schema.ts`, миграция 13). `appendLessonRun` — кирпич для `commit.ts`, а не вход для экранов.
 */
import type { LessonRun } from '../../domain/parentReport';
import { recordedAtIso } from './abaLog';
import { requireAccountConsent } from './accountConsent';
import type { SqlDb } from './sql';

/**
 * Запись итогов урока ребёнка: проверка `account_local`, ворота открыты только на время `fn` и
 * закрываются в той же транзакции. Транзакцию открывает сама — сбой внутри откатывает и ворота.
 * Нет согласия — `LessonConsentRequiredError`, не записано ничего.
 */
export async function withLessonWrite(db: SqlDb, childId: string, fn: (tx: SqlDb) => Promise<void>): Promise<void> {
  await db.transaction(async (tx) => {
    await requireAccountConsent(tx);
    await tx.run('INSERT INTO lesson_write_gate (child_id) VALUES (?)', [childId]);
    await fn(tx);
    await tx.run('DELETE FROM lesson_write_gate WHERE child_id = ?', [childId]);
  });
}

/**
 * Колонка `started_at` — в едином формате UTC с миллисекундами (`recordedAtIso`): срок хранения
 * сравнивает её как строку, и время с поясом или без долей секунды удалилось бы не в срок (раунд 4,
 * backend 2). Тело записи остаётся как пришло.
 */
export async function appendLessonRun(db: SqlDb, run: LessonRun): Promise<void> {
  await db.run('INSERT INTO lesson_runs (child_id, id, lesson_id, started_at, body) VALUES (?, ?, ?, ?, ?)', [
    run.childId,
    run.id,
    run.lessonId,
    recordedAtIso(run.startedAt),
    JSON.stringify(run),
  ]);
}

export async function lessonRunsOf(db: SqlDb, childId: string): Promise<LessonRun[]> {
  const rows = await db.all<{ body: string }>('SELECT body FROM lesson_runs WHERE child_id = ? ORDER BY seq', [childId]);
  return rows.map((r) => JSON.parse(r.body) as LessonRun);
}

/** Одно прохождение ребёнка по id — для повторной отправки; удалено сроком хранения — null. */
export async function lessonRunById(db: SqlDb, childId: string, id: string): Promise<LessonRun | null> {
  const [row] = await db.all<{ body: string }>('SELECT body FROM lesson_runs WHERE child_id = ? AND id = ?', [childId, id]);
  return row ? (JSON.parse(row.body) as LessonRun) : null;
}

/**
 * Прохождения после позиции `afterSeq` — для синхронизации, не больше `limit`: после недели
 * офлайна или нового согласия история уходит пачками, а не одним запросом на год (А7).
 */

export async function lessonRunsAfter(
  db: SqlDb,
  childId: string,
  afterSeq: number,
  limit = 200,
): Promise<{ seq: number; run: LessonRun }[]> {
  const rows = await db.all<{ seq: number; body: string }>(
    'SELECT seq, body FROM lesson_runs WHERE child_id = ? AND seq > ? ORDER BY seq LIMIT ?',
    [childId, afterSeq, limit],
  );
  return rows.map((r) => ({ seq: r.seq, run: JSON.parse(r.body) as LessonRun }));
}
