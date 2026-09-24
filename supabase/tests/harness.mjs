/**
 * Проверка миграций без Supabase и без Docker: PGlite — это Postgres, собранный в
 * WASM. Эмулируется ровно то, на что опираются миграции: роли anon и
 * authenticated, auth.users, auth.uid() из JWT, публикация Realtime и права на
 * таблицы по умолчанию. Границей доступа остаётся только RLS — как в Supabase.
 *
 * Накатываются ВСЕ миграции по порядку, а не одна: так ловится и конфликт с
 * прежними.
 */
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

export async function freshDb() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO anon, authenticated;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
    GRANT USAGE ON SCHEMA public TO anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
    CREATE PUBLICATION supabase_realtime;
  `);
  for (const f of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    try {
      await db.exec(readFileSync(join(MIGRATIONS, f), 'utf8'));
    } catch (e) {
      throw new Error(`миграция ${f} не накатилась: ${e.message}`);
    }
  }
  return db;
}

/** Выполнить запрос от лица пользователя (`null` — аноним), как это делает PostgREST. */
export function actor(db) {
  return async function as(user, sql, params = []) {
    await db.exec(`RESET ROLE`);
    await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [user ?? '']);
    await db.exec(user ? `SET ROLE authenticated` : `SET ROLE anon`);
    try {
      return await db.query(sql, params);
    } finally {
      await db.exec(`RESET ROLE`);
    }
  };
}

/** Мини-раннер: сценарии идут по порядку и опираются на состояние предыдущих. */
export function runner() {
  let passed = 0;
  const failures = [];
  return {
    async check(name, fn) {
      try {
        await fn();
        passed += 1;
      } catch (e) {
        failures.push(`${name}: ${e.message}`);
      }
    },
    finish() {
      console.log(`пройдено: ${passed}, провалено: ${failures.length}`);
      for (const f of failures) console.log('  ✕ ' + f);
      process.exit(failures.length ? 1 : 0);
    },
  };
}

export const eq = (a, b, what = '') => {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error(`${what} ожидалось ${JSON.stringify(b)}, получено ${JSON.stringify(a)}`);
  }
};

export async function denied(p) {
  try {
    await p;
  } catch {
    return;
  }
  throw new Error('операция прошла, а должна быть отклонена');
}
