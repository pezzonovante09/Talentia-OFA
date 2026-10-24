/**
 * Старт приложения: какой порт прогресса использовать.
 *
 * - Без аккаунта на устройстве (срез прототипа, режим без записи) база не открывается вовсе:
 *   файл базы привязан к аккаунту (`openLocalDb(accountId)`), а писать всё равно некуда.
 * - С аккаунтом (`account_local`, этап 10): открыть базу, применить срок хранения по доверенному
 *   времени (`applyRetention(db, trustedNow(...))`, решение №131) и отдать `sqlitePort(db)`.
 */
import { openLocalDb } from '../services/local/expoSqlite';
import { applyRetention, trustedNow } from '../services/local/purge';
import { noRecordPort, sqlitePort, type ProgressPort } from '../services/progressPort';

export type Boot = { kind: 'no_record'; port: ProgressPort } | { kind: 'account'; accountId: string; port: ProgressPort };

export function bootNoRecord(): Boot {
  return { kind: 'no_record', port: noRecordPort };
}

/** Заготовка для этапа 10: `lastTrusted` — последняя доверенная метка времени с устройства. */
export async function bootWithAccount(accountId: string, lastTrusted: string | null): Promise<Boot> {
  const db = await openLocalDb(accountId);
  await applyRetention(db, trustedNow(null, lastTrusted));
  return { kind: 'account', accountId, port: sqlitePort(db) };
}
