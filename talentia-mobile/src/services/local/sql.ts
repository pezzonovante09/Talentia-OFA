/**
 * Порт локальной базы. Спецификация — REBUILD.md («Ближайшие работы», локальный слой),
 * ABA.md («Данные», «Хранение»), PARENT.md («Несколько детей», «Удаление и экспорт»).
 *
 * Репозитории работают с этим интерфейсом, а не с `expo-sqlite` напрямую: в
 * приложении его реализует `expoSqlite.ts`, в тестах — встроенный SQLite Node на той же
 * схеме. Так гарантии «только дописывание» и «всё по ребёнку» проверяются на настоящем
 * SQLite, а не на моках.
 */

export type SqlValue = string | number | null;

export interface SqlDb {
  /** Изменяющий запрос. */
  run(sql: string, params?: readonly SqlValue[]): Promise<{ changes: number }>;
  /** Читающий запрос. */
  all<T>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;
  /** Несколько операторов без параметров — схема. */
  exec(sql: string): Promise<void>;
  /** Всё внутри — одна транзакция: или целиком, или ничего. */
  transaction<T>(fn: () => Promise<T>): Promise<T>;
}
