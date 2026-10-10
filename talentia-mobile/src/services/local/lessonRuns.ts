/**
 * Прохождения уроков на устройстве — источник отчёта родителю (`domain/parentReport.ts`):
 * отчёт строится из локальных данных, облако — резервная копия (PARENT.md). Только
 * дописывание.
 */
import type { LessonRun } from '../../domain/parentReport';
import type { SqlDb } from './sql';

export async function appendLessonRun(db: SqlDb, run: LessonRun): Promise<void> {
  await db.run('INSERT INTO lesson_runs (child_id, id, lesson_id, started_at, body) VALUES (?, ?, ?, ?, ?)', [
    run.childId,
    run.id,
    run.lessonId,
    run.startedAt,
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
