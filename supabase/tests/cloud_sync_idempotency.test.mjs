/**
 * Идемпотентность облачного согласия: id ребёнка и id события задаёт клиент
 * (migrations/20261010120000_cloud_sync_client_ids.sql; AUDIT.md, аудит 2026-10-06, А6, блокер 9).
 *
 * Повтор доставленного события после потерянного ответа — 'duplicate', а не второй ребёнок
 * и не второй grant; чужое или изменённое событие с тем же id — 23505; отзыв для ребёнка,
 * которого уже нет, — 'gone', и на сервере ничего не пишется.
 *
 * Не проверяется: гонки двух одновременных вызовов (PGlite — одно соединение).
 *
 * Запуск: npm test --prefix supabase
 */
import { randomUUID } from 'node:crypto';
import { actor, eq, runner } from './harness.mjs';

const { check, group, finish } = runner();

const A = '00000000-0000-4000-8000-00000000000a'; // владелец
const C = '00000000-0000-4000-8000-00000000000c'; // посторонний

/** Ошибка с конкретным SQLSTATE: «отклонено по другой причине» — тоже провал. */
async function fails(p, code) {
  try {
    await p;
  } catch (e) {
    if (e.code !== code) throw new Error(`ожидался код ${code}, получен ${e.code}: ${e.message}`);
    return;
  }
  throw new Error(`операция прошла, а должна быть отклонена с кодом ${code}`);
}

async function setup(db) {
  await db.exec(`INSERT INTO auth.users (id, email, email_confirmed_at) VALUES
    ('${A}', 'anna@example.kg', now()), ('${C}', 'c@example.kg', now())`);
  await db.exec(`INSERT INTO consent_texts (scope, version, locale, body_sha256, is_current)
    SELECT s, 'ru-v1', 'ru', sha256(convert_to(s || ' v1', 'UTF8')), true
    FROM unnest(ARRAY['account_local', 'cloud_sync', 'companion_ai', 'voice_asr', 'telemetry']) AS s`);
  const as = actor(db);
  const admin = async (sql, params = []) => {
    await db.exec(`RESET ROLE`);
    await db.query(`SELECT set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claims', '', false)`);
    return db.query(sql, params);
  };
  const adminCount = async (sql, params = []) => (await admin(`SELECT count(*)::int AS n FROM ${sql}`, params)).rows[0].n;
  const create = async (user, kid, event, { version = 'ru-v1', via = 'biometric', at = 'now()', name = 'Лиса' } = {}) =>
    (await as(user, `SELECT public.create_child($1, $2, '5-6', $3, $4, ${at}, $5) AS r`, [kid, event, version, via, name])).rows[0].r;
  const grant = async (user, kid, event, version = 'ru-v1', via = 'pin') =>
    (await as(user, `SELECT public.grant_cloud_sync($1, $2, $3, $4, now()) AS r`, [kid, event, version, via])).rows[0].r;
  const revoke = async (user, kid, event, version = 'ru-v1', via = 'pin') =>
    (await as(user, `SELECT public.revoke_cloud_sync($1, $2, $3, $4, now()) AS r`, [kid, event, version, via])).rows[0].r;
  return { as, admin, adminCount, create, grant, revoke };
}

// ---------------------------------------------------------------------------
await group('повтор создания ребёнка', async (db) => {
  const { as, admin, adminCount, create, grant } = await setup(db);
  const kid = randomUUID();
  const event = randomUUID();

  await check('create дважды с одним событием — один ребёнок, одно событие, второй ответ duplicate', async () => {
    eq(await create(A, kid, event), 'created');
    eq(await create(A, kid, event), 'duplicate');
    eq(await adminCount('children'), 1, 'детей:');
    eq(await adminCount(`child_guardians WHERE child_id = '${kid}'`), 1, 'связей:');
    eq(await adminCount(`consent_events WHERE scope = 'cloud_sync'`), 1, 'событий:');
    eq((await admin(`SELECT id, child_id, action FROM consent_events WHERE scope = 'cloud_sync'`)).rows, [
      { id: event, child_id: kid, action: 'grant' },
    ]);
  });

  await check('тот же id события от другого пользователя — 23505, ребёнок не создан', async () => {
    const theirs = randomUUID();
    await fails(create(C, theirs, event), '23505');
    eq(await adminCount(`children WHERE id = '${theirs}'`), 0, 'ребёнок C:');
    eq(await adminCount(`child_guardians WHERE user_id = '${C}'`), 0, 'связи C:');
  });

  await check('чужой существующий id ребёнка — 42501, событие не записано', async () => {
    const e = randomUUID();
    await fails(create(C, kid, e), '42501');
    eq(await adminCount(`consent_events WHERE id = '${e}'`), 0);
    eq(await adminCount(`child_guardians WHERE user_id = '${C}'`), 0);
  });

  await check('свой существующий ребёнок с новым событием — granted', async () => {
    const e = randomUUID();
    eq(await create(A, kid, e), 'granted');
    eq(await adminCount('children'), 1, 'детей:');
    eq(await adminCount(`consent_events WHERE child_id = '${kid}' AND action = 'grant'`), 2, 'выдач:');
  });

  await check('повтор события с другим text_version — 23505, а не duplicate', async () => {
    await admin(`INSERT INTO consent_texts (scope, version, locale, body_sha256, is_current) VALUES ('cloud_sync', 'en-v1', 'en', sha256('cloud en'::bytea), true)`);
    await fails(create(A, kid, event, { version: 'en-v1' }), '23505');
    await fails(grant(A, kid, event, 'en-v1', 'biometric'), '23505');
    eq(await adminCount(`consent_events WHERE id = '${event}'`), 1);
  });

  await check('повтор события с другим способом подтверждения — 23505', async () => {
    await fails(create(A, kid, event, { via: 'pin' }), '23505');
  });

  await check('имя по умолчанию не отправляется — display_name NULL', async () => {
    const k = randomUUID();
    eq((await as(A, `SELECT public.create_child($1, gen_random_uuid(), '7', 'ru-v1', 'pin', now()) AS r`, [k])).rows[0].r, 'created');
    eq((await admin(`SELECT display_name FROM children WHERE id = $1`, [k])).rows, [{ display_name: null }]);
  });

  await check('время устройства больше чем на 5 минут в будущем — 23514, ребёнок не создан', async () => {
    const k = randomUUID();
    await fails(create(A, k, randomUUID(), { at: `now() + interval '6 minutes'` }), '23514');
    eq(await adminCount(`children WHERE id = '${k}'`), 0);
  });

  await check('без id ребёнка, события или времени — 22023', async () => {
    await fails(as(A, `SELECT public.create_child(NULL, gen_random_uuid(), '7', 'ru-v1', 'pin', now())`), '22023');
    await fails(as(A, `SELECT public.create_child(gen_random_uuid(), NULL, '7', 'ru-v1', 'pin', now())`), '22023');
    await fails(as(A, `SELECT public.create_child(gen_random_uuid(), gen_random_uuid(), '7', 'ru-v1', 'pin', NULL)`), '22023');
  });
});

// ---------------------------------------------------------------------------
await group('выдача согласия', async (db) => {
  const { adminCount, create, grant } = await setup(db);
  const kid = randomUUID();
  eq(await create(A, kid, randomUUID()), 'created');

  await check('повтор выдачи тем же событием — duplicate, событие одно', async () => {
    const e = randomUUID();
    eq(await grant(A, kid, e), 'granted');
    eq(await grant(A, kid, e), 'duplicate');
    eq(await adminCount(`consent_events WHERE id = '${e}'`), 1);
  });

  await check('grant_cloud_sync для отсутствующего ребёнка — P0002', async () => {
    const e = randomUUID();
    await fails(grant(A, randomUUID(), e), 'P0002');
    eq(await adminCount(`consent_events WHERE id = '${e}'`), 0);
  });

  await check('grant_cloud_sync на чужого ребёнка — 42501', async () => {
    await fails(grant(C, kid, randomUUID()), '42501');
  });
});

// ---------------------------------------------------------------------------
await group('повтор отзыва', async (db) => {
  const { admin, adminCount, create, revoke } = await setup(db);
  const kid = randomUUID();
  eq(await create(A, kid, randomUUID()), 'created');
  const r1 = randomUUID();

  await check('revoke, затем тот же revoke — gone; ребёнок удалён', async () => {
    eq(await revoke(A, kid, r1), 'revoked');
    eq(await revoke(A, kid, r1), 'gone');
    eq(await adminCount(`children WHERE id = '${kid}'`), 0);
  });

  await check('событие отзыва одно и под псевдонимом', async () => {
    const rows = (await admin(`SELECT id, child_id FROM consent_events WHERE scope = 'cloud_sync' AND action = 'revoke'`)).rows;
    eq(rows.length, 1, 'отзывов:');
    eq(rows[0].id, r1);
    if (rows[0].child_id === kid) throw new Error('id ребёнка в отзыве не заменён псевдонимом');
  });

  await check('новый revoke для отсутствующего ребёнка — gone, строки с его id нет', async () => {
    const e = randomUUID();
    eq(await revoke(A, kid, e), 'gone');
    eq(await adminCount(`consent_events WHERE child_id = '${kid}'`), 0, 'строк с настоящим id:');
    eq(await adminCount(`consent_events WHERE id = '${e}'`), 0, 'новое событие:');
  });

  await check('revoke для никогда не существовавшего ребёнка — gone, ничего не пишется', async () => {
    const ghost = randomUUID();
    eq(await revoke(C, ghost, randomUUID()), 'gone');
    eq(await adminCount(`consent_events WHERE child_id = '${ghost}'`), 0);
  });

  await check('revoke чужого существующего ребёнка — 42501, ребёнок на месте', async () => {
    const theirs = randomUUID();
    eq(await create(A, theirs, randomUUID()), 'created');
    await fails(revoke(C, theirs, randomUUID()), '42501');
    eq(await adminCount(`children WHERE id = '${theirs}'`), 1);
  });
});

// ---------------------------------------------------------------------------
await group('цикл create → revoke → create с тем же id ребёнка', async (db) => {
  const { as, admin, adminCount, create, revoke } = await setup(db);
  const kid = randomUUID();
  const e1 = randomUUID();
  const e2 = randomUUID();
  eq(await create(A, kid, e1), 'created');
  eq(await revoke(A, kid, randomUUID()), 'revoked');

  await check('запоздалый повтор старого create после отзыва — 23505, а не duplicate', async () => {
    await fails(create(A, kid, e1), '23505');
    eq(await adminCount(`children WHERE id = '${kid}'`), 0, 'ребёнок не воскрес:');
  });

  await check('новый create с тем же id ребёнка — created, согласие действует', async () => {
    eq(await create(A, kid, e2), 'created');
    eq((await as(A, `SELECT public.has_consent($1, 'cloud_sync') AS ok`, [kid])).rows[0].ok, true);
  });

  await check('единственное событие с настоящим id ребёнка — новое', async () => {
    eq((await admin(`SELECT id, action FROM consent_events WHERE child_id = $1`, [kid])).rows, [{ id: e2, action: 'grant' }]);
  });

  await check('повтор старого create и после нового создания — 23505', async () => {
    await fails(create(A, kid, e1), '23505');
    eq(await adminCount(`consent_events WHERE child_id = '${kid}'`), 1);
  });
});

// ---------------------------------------------------------------------------
await group('синхронизация с id устройства', async (db) => {
  const { as, adminCount, create } = await setup(db);
  const kid = randomUUID();
  eq(await create(A, kid, randomUUID()), 'created');

  await check('прохождение с ON CONFLICT (id) DO NOTHING дважды — одна строка, без ошибки', async () => {
    const run = randomUUID();
    const send = () =>
      as(A, `INSERT INTO lesson_runs (id, child_id, lesson_id, started_at) VALUES ($1, $2, 'l1', now()) ON CONFLICT (id) DO NOTHING`, [run, kid]);
    await send();
    await send();
    eq(await adminCount(`lesson_runs WHERE id = '${run}'`), 1);
  });

  await check('upsert навыка с last_seen_day проходит: вставка, затем обновление', async () => {
    const upsert = (day) =>
      as(A, `INSERT INTO skill_state (child_id, skill, box, last_seen_lesson, last_seen_day) VALUES ($1, 'count-5', 2, 3, $2)
             ON CONFLICT (child_id, skill) DO UPDATE SET child_id = EXCLUDED.child_id, skill = EXCLUDED.skill,
               box = EXCLUDED.box, last_seen_lesson = EXCLUDED.last_seen_lesson, last_seen_day = EXCLUDED.last_seen_day`, [kid, day]);
    await upsert('2026-10-09');
    await upsert('2026-10-10');
    eq((await as(A, `SELECT to_char(last_seen_day, 'YYYY-MM-DD') AS d FROM skill_state WHERE child_id = $1`, [kid])).rows, [{ d: '2026-10-10' }]);
  });

  await check('посторонний last_seen_day чужого ребёнка не пишет', async () => {
    await as(C, `UPDATE skill_state SET last_seen_day = '2000-01-01' WHERE child_id = $1`, [kid]);
    eq(await adminCount(`skill_state WHERE last_seen_day = '2026-10-10'`), 1);
  });
});

// ---------------------------------------------------------------------------
await group('сигнатуры и права', async (db) => {
  const { as, admin } = await setup(db);
  const kid = randomUUID();

  await check('по одной функции на имя — старых перегрузок нет', async () => {
    const rows = (await admin(`SELECT proname, count(*)::int AS n FROM pg_proc
      WHERE pronamespace = 'public'::regnamespace AND proname IN ('create_child', 'grant_cloud_sync', 'revoke_cloud_sync', 'cloud_event_replay')
      GROUP BY proname ORDER BY proname`)).rows;
    eq(rows, [
      { proname: 'cloud_event_replay', n: 1 },
      { proname: 'create_child', n: 1 },
      { proname: 'grant_cloud_sync', n: 1 },
      { proname: 'revoke_cloud_sync', n: 1 },
    ]);
  });

  await check('аноним не вызывает ни одну из четырёх функций', async () => {
    await fails(as(null, `SELECT public.create_child($1, gen_random_uuid(), '7', 'ru-v1', 'pin', now())`, [kid]), '42501');
    await fails(as(null, `SELECT public.grant_cloud_sync($1, gen_random_uuid(), 'ru-v1', 'pin', now())`, [kid]), '42501');
    await fails(as(null, `SELECT public.revoke_cloud_sync($1, gen_random_uuid(), 'ru-v1', 'pin', now())`, [kid]), '42501');
    await fails(as(null, `SELECT public.cloud_event_replay(gen_random_uuid(), 'grant', $1, 'ru-v1', 'pin')`, [kid]), '42501');
  });

  await check('authenticated не вызывает cloud_event_replay', async () => {
    await fails(as(A, `SELECT public.cloud_event_replay(gen_random_uuid(), 'grant', $1, 'ru-v1', 'pin')`, [kid]), '42501');
  });
});

finish();
