/**
 * База новее приложения (контрольный аудит 2026-11-09, `backend-auditor`): старая сборка не знает таблиц
 * и охран из новых миграций, поэтому `migrate` не открывает такую базу — бросает `DbNewerThanAppError`
 * и ничего в ней не меняет (`useAccount.boot` покажет «Повторить», данные целы).
 */
import { DbNewerThanAppError, MIGRATIONS, migrate } from '../schema';
import type { SqlDb } from '../sql';
import { memoryDb } from './nodeSql';

const userVersion = async (db: SqlDb) => (await db.all<{ user_version: number }>('PRAGMA user_version'))[0].user_version;
const schemaDump = (db: SqlDb) => db.all<{ type: string; name: string; sql: string | null }>('SELECT type, name, sql FROM sqlite_master ORDER BY type, name');

async function newerDb(): Promise<SqlDb> {
  const db = await memoryDb();
  await db.exec(`PRAGMA user_version = ${MIGRATIONS.length + 1}`);
  return db;
}

describe('migrate: база новее приложения', () => {
  it('версия MIGRATIONS.length + 1 → DbNewerThanAppError с номером версии базы', async () => {
    const db = await newerDb();
    const err = await migrate(db).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DbNewerThanAppError);
    expect((err as DbNewerThanAppError).dbVersion).toBe(MIGRATIONS.length + 1);
  });

  it('отказ ничего не меняет: user_version, схема и строки журнала прежние', async () => {
    const db = await newerDb();
    const schemaBefore = await schemaDump(db);
    const consentBefore = await db.all('SELECT * FROM consent_events ORDER BY id');
    await expect(migrate(db)).rejects.toBeInstanceOf(DbNewerThanAppError);
    expect(await userVersion(db)).toBe(MIGRATIONS.length + 1);
    expect(await schemaDump(db)).toEqual(schemaBefore);
    expect(await db.all('SELECT * FROM consent_events ORDER BY id')).toEqual(consentBefore);
  });

  it('база ровно текущей версии открывается без ошибки (граница)', async () => {
    const db = await memoryDb();
    expect(await userVersion(db)).toBe(MIGRATIONS.length);
    await expect(migrate(db)).resolves.toBeUndefined();
    expect(await userVersion(db)).toBe(MIGRATIONS.length);
  });
});
