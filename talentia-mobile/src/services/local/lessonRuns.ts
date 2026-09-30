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

/** Прохождения после позиции `afterSeq` — для синхронизации. */
export async function lessonRunsAfter(
  db: SqlDb,
  childId: string,
  afterSeq: number,
): Promise<{ seq: number; run: LessonRun }[]> {
  const rows = await db.all<{ seq: number; body: string }>(
    'SELECT seq, body FROM lesson_runs WHERE child_id = ? AND seq > ? ORDER BY seq',
    [childId, afterSeq],
  );
  return rows.map((r) => ({ seq: r.seq, run: JSON.parse(r.body) as LessonRun }));
}
