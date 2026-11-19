/**
 * Индексы под purge_expired и children_id_not_taken, статус задания очистки
 * (migrations/20261018120000_purge_and_id_check_indexes.sql; раунд 3, В-13 и В-14).
 *
 * Проверяется: индекс существует; планировщик при запрещённом последовательном чтении
 * выбирает именно его для условия очистки (то есть условие индексу соответствует —
 * частичный предикат не промахивается); purge_schedule_status() без pg_cron отвечает
 * 'no_pg_cron' и не бросает, ensure_purge_scheduled() возвращает false; клиенту обе функции
 * закрыты. Мутант: убрать индекс из миграции — группа краснеет.
 *
 * Условия DELETE берутся из pg_get_functiondef('public.purge_expired'), не копируются.
 * Ветки scheduled / not_scheduled / unknown проверены на заглушке pg_cron (строка в
 * pg_extension и таблица cron.job): это не настоящий pg_cron.
 *
 * Не проверяется: время очистки на 100 тысячах детей и работа настоящего pg_cron — ветка
 * Supabase, шаг 7.
 *
 * Запуск: npm test --prefix supabase
 */
import { actor, denied, eq, runner } from './harness.mjs';

const { check, group, finish } = runner();

const A = '00000000-0000-4000-8000-00000000000a';

await group('индексы очистки и проверки id', async (db) => {
  const as = actor(db);
  const plan = async (sql) => {
    await db.exec(`RESET ROLE`);
    await db.exec(`SET enable_seqscan = off`);
    try {
      const r = await db.query(`EXPLAIN ${sql}`);
      return r.rows.map((x) => x['QUERY PLAN']).join('\n');
    } finally {
      await db.exec(`RESET enable_seqscan`);
    }
  };
  // Условия очистки берём из живого определения purge_expired, а не копируем: тест не
  // разойдётся с функцией. Каждому DELETE соответствует свой индекс (по таблице).
  const def = (await db.query(`SELECT pg_get_functiondef('public.purge_expired'::regproc) AS d`)).rows[0].d;
  const deletes = [...def.matchAll(/DELETE FROM public\.(\w+) WHERE [^;]+;/g)].map((m) => [m[1], m[0].replace(/;$/, '')]);
  const indexByTable = {
    lesson_runs: 'lesson_runs_started',
    child_access_invites: 'child_access_invites_expires',
    invite_attempts: 'invite_attempts_at',
    child_guardians: 'child_guardians_pending_created',
    consent_events: 'consent_events_retain',
    child_access_log: 'child_access_log_retain',
    consent_revoke_requests: 'consent_revoke_requests_resolved',
  };
  await check('purge_expired содержит ровно 7 DELETE по ожидаемым таблицам', async () => {
    eq(deletes.map(([t]) => t).sort(), Object.keys(indexByTable).sort());
  });
  for (const [table, sql] of deletes) {
    const index = indexByTable[table];
    await check(`${index}: DELETE из purge_expired по ${table} идёт по индексу`, async () => {
      if (!index) throw new Error(`неожиданный DELETE из ${table}`);
      const p = await plan(sql);
      if (!p.includes(index)) throw new Error(`план не использует ${index}:\n${p}`);
    });
  }
  const extra = [
    ['child_access_log_user_pseudo', `SELECT 1 FROM public.child_access_log WHERE user_id = '${A}' AND user_pseudonymized_at IS NOT NULL`],
    ['child_access_log_by_pseudo', `SELECT 1 FROM public.child_access_log WHERE by_user = '${A}' AND by_pseudonymized_at IS NOT NULL`],
  ];
  for (const [index, sql] of extra) {
    await check(`${index}: проверка id в children_id_not_taken идёт по индексу`, async () => {
      const p = await plan(sql);
      if (!p.includes(index)) throw new Error(`план не использует ${index}:\n${p}`);
    });
  }

  await check('purge_schedule_status без pg_cron: no_pg_cron, без исключения', async () => {
    await db.exec(`RESET ROLE`);
    eq((await db.query(`SELECT public.purge_schedule_status() AS s`)).rows[0].s, 'no_pg_cron');
  });

  await check('ensure_purge_scheduled без pg_cron возвращает false, не падает', async () => {
    await db.exec(`RESET ROLE`);
    eq((await db.query(`SELECT public.ensure_purge_scheduled() AS s`)).rows[0].s, false);
  });

  await check('purge_schedule_status: scheduled, когда задание в cron.job есть', async () => {
    await db.exec(`RESET ROLE`);
    // Заглушка pg_cron: в PGlite расширения нет, запись в pg_extension и таблица cron.job.
    await db.exec(`
      CREATE SCHEMA cron;
      CREATE TABLE cron.job (jobname text);
      INSERT INTO pg_extension (oid, extname, extowner, extnamespace, extrelocatable, extversion)
        VALUES (900001, 'pg_cron', 10, 2200, false, '1.6');
    `);
    await db.exec(`INSERT INTO cron.job (jobname) VALUES ('talentia-purge-expired')`);
    eq((await db.query(`SELECT public.purge_schedule_status() AS s`)).rows[0].s, 'scheduled');
  });

  await check('purge_schedule_status: not_scheduled, когда pg_cron есть, а задания нет', async () => {
    await db.exec(`RESET ROLE`);
    await db.exec(`DELETE FROM cron.job`);
    await db.exec(`INSERT INTO cron.job (jobname) VALUES ('other-job')`);
    eq((await db.query(`SELECT public.purge_schedule_status() AS s`)).rows[0].s, 'not_scheduled');
  });

  await check('purge_schedule_status: unknown, когда cron.job недоступна', async () => {
    await db.exec(`RESET ROLE`);
    await db.exec(`ALTER TABLE cron.job RENAME TO job_gone`);
    eq((await db.query(`SELECT public.purge_schedule_status() AS s`)).rows[0].s, 'unknown');
    await db.exec(`ALTER TABLE cron.job_gone RENAME TO job`);
  });

  await check('service_role сохраняет EXECUTE на функции очистки, anon и authenticated — нет', async () => {
    await db.exec(`RESET ROLE`);
    for (const fn of ['purge_schedule_status()', 'ensure_purge_scheduled()', 'purge_expired()']) {
      const r = await db.query(
        `SELECT has_function_privilege('service_role', 'public.${fn}', 'EXECUTE') AS s,
                has_function_privilege('anon', 'public.${fn}', 'EXECUTE') AS a,
                has_function_privilege('authenticated', 'public.${fn}', 'EXECUTE') AS u`,
      );
      eq(r.rows[0], { s: true, a: false, u: false }, fn);
    }
  });

  await check('клиенту функции очистки закрыты: аноним и пользователь', async () => {
    await db.exec(`RESET ROLE`);
    await db.exec(`INSERT INTO auth.users (id, email, email_confirmed_at) VALUES ('${A}', 'a@example.kg', now())`);
    for (const fn of ['purge_schedule_status', 'ensure_purge_scheduled', 'purge_expired']) {
      await denied(as(null, `SELECT public.${fn}()`));
      await denied(as(A, `SELECT public.${fn}()`));
    }
  });
});

finish();
