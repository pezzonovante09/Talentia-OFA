/**
 * Изменяемое состояние ребёнка на устройстве. Всё — по ребёнку: на планшете с двумя
 * детьми иначе они делили бы одни коробки Лейтнера, и отчёт врал бы про обоих
 * (PARENT.md, «Несколько детей у одного родителя»).
 *
 * Состояние — производное: навыки выводятся из прохождений, цели ABA — из проб. Его
 * можно перезаписывать; доказательства лежат в журналах (`abaLog.ts`, `lessonRuns.ts`).
 */
import type { AbaTargetState } from '../../types/aba';
import type { SkillState } from '../../domain/mastery';
import type { AtlasEntry } from '../../domain/lessonAssembly';
import type { TokenBoard } from '../../domain/abaTokens';
import type { TokenTrainingState } from '../../domain/abaTokenTraining';
import type { IdentifySet } from '../../domain/abaIdentifySet';
import type { AbaSessionState } from '../../domain/abaSession';
import type { SqlDb } from './sql';

export type ChildStateValues = {
  skills: SkillState[];
  atlas: AtlasEntry[];
  /** Сквозной номер урока ребёнка — счётчик для `lastSeenLesson`. */
  lessonCounter: number;
  abaTargets: Record<string, AbaTargetState>;
  tokenTraining: TokenTrainingState;
  identifySets: IdentifySet[];
  /** Жетоны на доске между сессиями: не сгорают. */
  abaBoard: Pick<TokenBoard, 'earned' | 'nonContingent'>;
  abaSessionIndex: number;
  /** Сессия, свёрнутая посреди: её состояние — обычный объект, продолжается как было. */
  abaSessionInProgress: AbaSessionState | null;
  /**
   * Пауза ABA (решение владельца 2026-10-01, №17): режим выключен без удаления данных —
   * сессию не начать, пробы не пишутся. Отзыв согласия, в отличие от паузы, удаляет.
   */
  abaPaused: boolean;
};

export type ChildStateKey = keyof ChildStateValues;

/**
 * Ключи ABA, которые пишутся только при согласии на данные ABA. Запись в обход
 * `commit.ts` отклоняет сама база (`schema.ts`, миграция 3, — список там продублирован:
 * миграции не правятся).
 */
export const ABA_STATE_KEYS = [
  'abaTargets',
  'tokenTraining',
  'identifySets',
  'abaBoard',
  'abaSessionIndex',
  'abaSessionInProgress',
] as const satisfies readonly ChildStateKey[];

/** Что удаляет отзыв согласия на ABA: состояние и пауза — пауза тоже говорит, что режим был. */
export const ABA_DELETED_KEYS = [...ABA_STATE_KEYS, 'abaPaused'] as const satisfies readonly ChildStateKey[];

export async function saveChildState<K extends ChildStateKey>(
  db: SqlDb,
  childId: string,
  key: K,
  value: ChildStateValues[K],
  updatedAt: string,
): Promise<void> {
  await db.run(
    `INSERT INTO child_state (child_id, key, body, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (child_id, key) DO UPDATE SET body = excluded.body, updated_at = excluded.updated_at`,
    [childId, key, JSON.stringify(value), updatedAt],
  );
}

export async function loadChildState<K extends ChildStateKey>(
  db: SqlDb,
  childId: string,
  key: K,
): Promise<ChildStateValues[K] | undefined> {
  const [row] = await db.all<{ body: string }>('SELECT body FROM child_state WHERE child_id = ? AND key = ?', [
    childId,
    key,
  ]);
  return row ? (JSON.parse(row.body) as ChildStateValues[K]) : undefined;
}

/** Когда ключ менялся последний раз — для синхронизации снимков. */
export async function childStateUpdatedAt(db: SqlDb, childId: string, key: ChildStateKey): Promise<string | undefined> {
  const [row] = await db.all<{ updated_at: string }>(
    'SELECT updated_at FROM child_state WHERE child_id = ? AND key = ?',
    [childId, key],
  );
  return row?.updated_at;
}
