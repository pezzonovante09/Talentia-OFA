/**
 * Время отзыва и занятые id ребёнка
 * (migrations/20261011120000_consent_clock_and_pseudonym_ids.sql; AUDIT.md, раунд 2, Р1 и Р2;
 * решение №90).
 *
 * Р2. Отзыв с client_at из будущего больше не отвергается 23514: сервер ограничивает время
 * отзыва своим received_at — и в revoke_cloud_sync, и в прямой записи отзыва companion_ai и
 * telemetry. Отзыв из прошлого не трогается. Выдача из будущего (create_child,
 * grant_cloud_sync, прямой grant) — по-прежнему 23514; выдача в пределах 5 минут проходит
 * с исходным client_at. Правка client_at записанной строки — 42501. После ограниченного
 * отзыва согласие неактивно (порядок — seq, а не client_at), заявка второго родителя
 * закрыта.
 *
 * Р1. id ребёнка не совпадает ни с id пользователя из auth.users, ни с псевдонимом из
 * журналов: consent_events.child_id / actor_id, child_access_log.child_id / user_id /
 * by_user — только строки с отметкой псевдонима. Каждая ветка проверяется отдельно, на id,
 * который попадает только в неё (строки собраны суперпользователем), и дополнительно —
 * естественным путём (отзыв облака, отклонённая заявка, удаление аккаунта). Ошибка одна:
 * 42501 'child id taken' без DETAIL и HINT; после отказа в базе ничего не записано. Путь
 * service-role (прямой INSERT, UPDATE id) закрыт тем же триггером. DO-блок миграции падает,
 * если такой ребёнок уже есть: отдельная база с миграциями до 20261011120000.
 *
 * Не проверяется (PGlite — одно соединение, без PostgREST):
 *  - гонки: create_child(P) одновременно с псевдонимизацией, отзыв одновременно с выдачей;
 *  - что доходит до клиента через PostgREST. Поле CONTEXT (`where`) у отказа из триггера и
 *    у отказа create_child на чужом живом ребёнке разное; PostgREST, насколько известно,
 *    отдаёт только code / message / details / hint — проверить на ветке Supabase;
 *  - различие веток по времени ответа.
 *
 * Запуск: npm test --prefix supabase
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { actor, eq, migratedDb, runner } from './harness.mjs';

const { check, group, finish } = runner();

const MIGRATION = '20261011120000_consent_clock_and_pseudonym_ids.sql';
const MIGRATION_SQL = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations', MIGRATION), 'utf8');

const A = '00000000-0000-4000-8000-00000000000a'; // владелец
const B = '00000000-0000-4000-8000-00000000000b'; // второй родитель
const C = '00000000-0000-4000-8000-00000000000c'; // посторонний
const D = '00000000-0000-4000-8000-00000000000d'; // заявитель, которому отказали
const E = '00000000-0000-4000-8000-00000000000e'; // взрослый, который удалит аккаунт
const U = '00000000-0000-4000-8000-0000000000a1'; // пользователь без единой записи в журналах
const W = '00000000-0000-4000-8000-0000000000a2'; // пользователь с заявкой в ожидании

const inFuture = (ms) => new Date(Date.now() + ms).toISOString();
const DAY = 24 * 60 * 60 * 1000;
const MIN = 60 * 1000;

/** Ошибка с конкретным SQLSTATE: «отклонено по другой причине» — тоже провал. */
async function fails(p, code) {
  try {
    await p;
  } catch (e) {
    if (e.code !== code) throw new Error(`ожидался код ${code}, получен ${e.code}: ${e.message}`);
    return e;
  }
  throw new Error(`операция прошла, а должна быть отклонена с кодом ${code}`);
}

/** Отказ «id занят»: 42501, ровно этот текст, без DETAIL и HINT. */
async function taken(p) {
  const e = await fails(p, '42501');
  eq({ message: e.message, detail: e.detail ?? null, hint: e.hint ?? null }, { message: 'child id taken', detail: null, hint: null }, 'ошибка:');
  return e;
}

async function setup(db) {
  await db.exec(`INSERT INTO auth.users (id, email, email_confirmed_at) VALUES
    ('${A}', 'anna@example.kg', now()), ('${B}', 'bakyt@example.kg', now()), ('${C}', 'c@example.kg', now()),
    ('${D}', 'dana@example.kg', now()), ('${E}', 'erlan@example.kg', now()), ('${U}', 'u@example.kg', now()),
    ('${W}', 'w@example.kg', now())`);
  await db.exec(`INSERT INTO consent_texts (scope, version, locale, body_sha256, is_current)
    SELECT s, 'ru-v1', 'ru', sha256(convert_to(s || ' v1', 'UTF8')), true
    FROM unnest(ARRAY['account_local', 'cloud_sync', 'companion_ai', 'voice_asr', 'telemetry']) AS s`);
  const as = actor(db);
  // Суперпользователь: RLS не действует, пользователя в JWT нет.
  const admin = async (sql, params = []) => {
    await db.exec(`RESET ROLE`);
    await db.query(`SELECT set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claims', '', false)`);
    return db.query(sql, params);
  };
  // Как прокси с ключом service-role: роль в обход RLS, не суперпользователь.
  const service = async (sql, params = []) => {
    await db.exec(`RESET ROLE`);
    await db.query(`SELECT set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claims', '', false)`);
    await db.exec(`SET ROLE service_role`);
    try {
      return await db.query(sql, params);
    } finally {
      await db.exec(`RESET ROLE`);
    }
  };
  const adminCount = async (sql, params = []) => (await admin(`SELECT count(*)::int AS n FROM ${sql}`, params)).rows[0].n;
  /** Число строк во всех таблицах, куда пишет create_child: после отказа не должно меняться. */
  const snapshot = async () => ({
    children: await adminCount('children'),
    child_guardians: await adminCount('child_guardians'),
    consent_events: await adminCount('consent_events'),
    child_access_log: await adminCount('child_access_log'),
  });
  // `at` — SQL-выражение времени устройства.
  const create = async (user, kid, event = randomUUID(), at = 'now()') =>
    (await as(user, `SELECT public.create_child($1, $2, '5-6', 'ru-v1', 'biometric', ${at}, NULL) AS r`, [kid, event])).rows[0].r;
  const grant = async (user, kid, event = randomUUID(), at = 'now()') =>
    (await as(user, `SELECT public.grant_cloud_sync($1, $2, 'ru-v1', 'pin', ${at}) AS r`, [kid, event])).rows[0].r;
  const revoke = async (user, kid, event = randomUUID(), at = 'now()') =>
    (await as(user, `SELECT public.revoke_cloud_sync($1, $2, 'ru-v1', 'pin', ${at}) AS r`, [kid, event])).rows[0].r;
  /** Прямая запись события от лица пользователя — как разрешают GRANT INSERT и политика. */
  const insertEvent = (user, { id = randomUUID(), scope, action, kid, at = 'now()' }) =>
    as(user, `INSERT INTO consent_events (id, scope, action, child_id, text_version, confirmed_by, client_at)
              VALUES ($1, $2, $3, $4, 'ru-v1', 'pin', ${at})`, [id, scope, action, kid]);
  const event = async (id) =>
    (await admin(`SELECT action, child_id, actor_id, client_at = received_at AS clamped, client_at > received_at AS ahead,
                         child_pseudonymized_at IS NOT NULL AS child_marked
                  FROM consent_events WHERE id = $1`, [id])).rows;
  const invite = async (kid, owner = A) => (await as(owner, `SELECT public.create_child_invite($1) AS c`, [kid])).rows[0].c;
  const redeem = async (user, code) => (await as(user, `SELECT public.redeem_child_invite($1) AS s`, [code])).rows[0].s;
  const link = async (kid, guardian, owner = A) => {
    eq(await redeem(guardian, await invite(kid, owner)), 'pending_approval', 'заявка:');
    await as(owner, `SELECT public.approve_guardian($1, $2)`, [kid, guardian]);
  };
  /** Псевдоним ребёнка после удаления — из события отзыва, как его видит автор. */
  const pseudonymOf = async (revokeEventId) =>
    (await as(A, `SELECT child_id FROM consent_events WHERE id = $1`, [revokeEventId])).rows[0].child_id;
  return { as, admin, service, adminCount, snapshot, create, grant, revoke, insertEvent, event, invite, redeem, link, pseudonymOf };
}

// ===========================================================================
// Р2. Время отзыва
// ===========================================================================

await group('Р2: отзыв облака с часами устройства впереди', async (db) => {
  const { as, admin, adminCount, create, revoke, event } = await setup(db);
  const kid = randomUUID();
  const r1 = randomUUID();
  eq(await create(A, kid), 'created');

  await check('отзыв с client_at на сутки вперёд — revoked, client_at = received_at, ребёнок удалён', async () => {
    eq(await revoke(A, kid, r1, `now() + interval '1 day'`), 'revoked');
    const [row] = await event(r1);
    eq({ action: row.action, clamped: row.clamped, child_marked: row.child_marked }, { action: 'revoke', clamped: true, child_marked: true });
    if (row.child_id === kid) throw new Error('отзыв остался под настоящим id ребёнка');
    eq(await adminCount(`children WHERE id = '${kid}'`), 0, 'ребёнок:');
    eq(await adminCount(`consent_events WHERE child_id = '${kid}'`), 0, 'строк с настоящим id:');
  });

  await check('повтор того же отзыва — gone, событие одно', async () => {
    eq(await revoke(A, kid, r1, `now() + interval '1 day'`), 'gone');
    eq(await adminCount(`consent_events WHERE id = '${r1}'`), 1);
    eq(await adminCount(`consent_events WHERE child_id = '${kid}'`), 0);
  });

  await check('отзыв на 2 минуты вперёд тоже ограничен', async () => {
    const k = randomUUID();
    const r = randomUUID();
    eq(await create(A, k), 'created');
    eq(await revoke(A, k, r, `now() + interval '2 minutes'`), 'revoked');
    eq((await event(r))[0].clamped, true, 'client_at = received_at:');
  });

  await check('отзыв из прошлого записан с исходным временем', async () => {
    const k = randomUUID();
    const r = randomUUID();
    const past = new Date(Date.now() - 60 * MIN).toISOString();
    eq(await create(A, k), 'created');
    eq(await revoke(A, k, r, `'${past}'::timestamptz`), 'revoked');
    eq((await admin(`SELECT client_at = $2::timestamptz AS same FROM consent_events WHERE id = $1`, [r, past])).rows, [{ same: true }]);
  });

  await check('client_at записанного отзыва не правится — 42501 и у суперпользователя, и у владельца', async () => {
    const before = (await admin(`SELECT client_at::text AS t FROM consent_events WHERE id = $1`, [r1])).rows[0].t;
    await fails(admin(`UPDATE consent_events SET client_at = client_at + interval '1 day' WHERE id = $1`, [r1]), '42501');
    await fails(admin(`UPDATE consent_events SET client_at = client_at - interval '1 day' WHERE id = $1`, [r1]), '42501');
    await fails(as(A, `UPDATE consent_events SET client_at = client_at - interval '1 day' WHERE id = $1`, [r1]), '42501');
    eq((await admin(`SELECT client_at::text AS t FROM consent_events WHERE id = $1`, [r1])).rows[0].t, before, 'client_at:');
  });
});

// ---------------------------------------------------------------------------
await group('Р2: прямая запись отзыва ИИ и телеметрии', async (db) => {
  const { as, admin, adminCount, create, insertEvent, event, link } = await setup(db);
  const kid = randomUUID();
  eq(await create(A, kid), 'created');

  await check('отзыв companion_ai на сутки вперёд записан, client_at = received_at', async () => {
    const id = randomUUID();
    await insertEvent(A, { id, scope: 'companion_ai', action: 'revoke', kid, at: `now() + interval '1 day'` });
    eq(await event(id), [{ action: 'revoke', child_id: kid, actor_id: A, clamped: true, ahead: false, child_marked: false }]);
  });

  await check('отзыв telemetry на сутки вперёд записан, client_at = received_at', async () => {
    const id = randomUUID();
    await insertEvent(A, { id, scope: 'telemetry', action: 'revoke', kid, at: `now() + interval '1 day'` });
    eq(await event(id), [{ action: 'revoke', child_id: kid, actor_id: A, clamped: true, ahead: false, child_marked: false }]);
  });

  await check('выдача companion_ai на сутки вперёд — 23514, не записана', async () => {
    const id = randomUUID();
    await fails(insertEvent(A, { id, scope: 'companion_ai', action: 'grant', kid, at: `now() + interval '1 day'` }), '23514');
    eq(await adminCount(`consent_events WHERE id = '${id}'`), 0);
  });

  await check('выдача на 4 минуты вперёд, затем ограниченный отзыв — согласие неактивно, заявка закрыта', async () => {
    const k = randomUUID();
    const g = randomUUID();
    const r = randomUUID();
    eq(await create(A, k), 'created');
    await link(k, B);
    await insertEvent(A, { id: g, scope: 'companion_ai', action: 'grant', kid: k, at: `now() + interval '4 minutes'` });
    eq((await admin(`SELECT public.consent_active($1, 'companion_ai') AS ok`, [k])).rows[0].ok, true, 'до отзыва:');
    await as(B, `SELECT public.request_consent_revoke($1, 'companion_ai')`, [k]);
    eq(await adminCount(`consent_revoke_requests WHERE child_id = '${k}' AND resolved_at IS NULL`), 1, 'открытых заявок:');

    await insertEvent(A, { id: r, scope: 'companion_ai', action: 'revoke', kid: k, at: `now() + interval '1 day'` });
    // время отзыва теперь раньше времени выдачи — порядок решает seq
    eq((await admin(`SELECT (SELECT client_at FROM consent_events WHERE id = $1) < (SELECT client_at FROM consent_events WHERE id = $2) AS earlier`, [r, g])).rows[0].earlier, true, 'отзыв раньше выдачи по client_at:');
    eq((await admin(`SELECT public.consent_active($1, 'companion_ai') AS ok`, [k])).rows[0].ok, false, 'consent_active:');
    eq((await as(A, `SELECT public.has_consent($1, 'companion_ai') AS ok`, [k])).rows[0].ok, false, 'has_consent:');
    eq((await admin(`SELECT resolution FROM consent_revoke_requests WHERE child_id = $1`, [k])).rows, [{ resolution: 'revoked' }]);
  });
});

// ---------------------------------------------------------------------------
await group('Р2: выдача из будущего по-прежнему отклоняется', async (db) => {
  const { admin, adminCount, snapshot, create, grant } = await setup(db);
  const kid = randomUUID();
  eq(await create(A, kid), 'created');

  await check('create_child на сутки вперёд — 23514, ничего не записано', async () => {
    const k = randomUUID();
    const before = await snapshot();
    await fails(create(A, k, randomUUID(), `now() + interval '1 day'`), '23514');
    eq(await snapshot(), before);
    eq(await adminCount(`children WHERE id = '${k}'`), 0);
  });

  await check('grant_cloud_sync на сутки вперёд — 23514, выдача не записана', async () => {
    const e = randomUUID();
    await fails(grant(A, kid, e, `now() + interval '1 day'`), '23514');
    eq(await adminCount(`consent_events WHERE id = '${e}'`), 0);
  });

  await check('grant_cloud_sync на 4 минуты вперёд — granted, client_at не изменён', async () => {
    const e = randomUUID();
    const at = inFuture(4 * MIN);
    eq(await grant(A, kid, e, `'${at}'::timestamptz`), 'granted');
    eq((await admin(`SELECT client_at = $2::timestamptz AS same, client_at > received_at AS ahead FROM consent_events WHERE id = $1`, [e, at])).rows, [
      { same: true, ahead: true },
    ]);
  });

  await check('create_child на 4 минуты вперёд — created, client_at не изменён', async () => {
    const k = randomUUID();
    const e = randomUUID();
    const at = inFuture(4 * MIN);
    eq(await create(A, k, e, `'${at}'::timestamptz`), 'created');
    eq((await admin(`SELECT client_at = $2::timestamptz AS same FROM consent_events WHERE id = $1`, [e, at])).rows, [{ same: true }]);
  });
});

// ===========================================================================
// Р1. Занятые id
// ===========================================================================

await group('Р1: псевдоним удалённого ребёнка', async (db) => {
  const { as, admin, adminCount, snapshot, create, revoke, invite, redeem, pseudonymOf } = await setup(db);
  const kid = randomUUID();
  const r = randomUUID();
  eq(await create(A, kid), 'created');
  // D подал заявку, владелец отказал; потом облако отозвано — ребёнок под псевдонимом.
  eq(await redeem(D, await invite(kid)), 'pending_approval');
  await as(A, `DELETE FROM child_guardians WHERE child_id = $1 AND user_id = $2`, [kid, D]);
  eq(await revoke(A, kid, r), 'revoked');
  const P = await pseudonymOf(r);

  await check('псевдоним видят автор согласий и отклонённый заявитель', async () => {
    if (!P || P === kid) throw new Error(`псевдоним не получен: ${P}`);
    eq((await as(D, `SELECT DISTINCT child_id FROM child_access_log`)).rows, [{ child_id: P }], 'журнал доступа D:');
    eq(await adminCount(`consent_events WHERE child_id = '${P}' AND child_pseudonymized_at IS NOT NULL`), 2, 'событий под псевдонимом:');
  });

  for (const [who, user] of [['посторонний', C], ['отклонённый заявитель', D], ['автор согласий', A]]) {
    await check(`create_child(P) — ${who}: 42501 child id taken, всё откатилось`, async () => {
      const e = randomUUID();
      const before = await snapshot();
      await taken(create(user, P, e));
      eq(await snapshot(), before, 'строк:');
      eq(await adminCount(`children WHERE id = '${P}'`), 0, 'ребёнок P:');
      eq(await adminCount(`child_guardians WHERE child_id = '${P}'`), 0, 'связи с P:');
      eq(await adminCount(`consent_events WHERE id = '${e}'`), 0, 'новое событие:');
    });
  }

  await check('после отказа старые согласия не «ожили»: has_consent(P) у автора — false', async () => {
    eq((await as(A, `SELECT public.has_consent($1, 'cloud_sync') AS ok`, [P])).rows[0].ok, false);
    eq((await admin(`SELECT public.consent_active($1, 'cloud_sync') AS ok`, [P])).rows[0].ok, false);
  });

  await check('владелец заново создаёт ребёнка с прежним id — created, старые строки остались под псевдонимом', async () => {
    const before = {
      events: await adminCount(`consent_events WHERE child_id = '${P}'`),
      log: await adminCount(`child_access_log WHERE child_id = '${P}'`),
    };
    const e = randomUUID();
    eq(await create(A, kid, e), 'created');
    eq((await admin(`SELECT id FROM consent_events WHERE child_id = $1`, [kid])).rows, [{ id: e }], 'события с id ребёнка:');
    eq((await admin(`SELECT user_id, event FROM child_access_log WHERE child_id = $1`, [kid])).rows, [{ user_id: A, event: 'granted' }], 'журнал доступа:');
    eq({ events: await adminCount(`consent_events WHERE child_id = '${P}'`), log: await adminCount(`child_access_log WHERE child_id = '${P}'`) }, before, 'под псевдонимом:');
    eq((await as(A, `SELECT public.has_consent($1, 'cloud_sync') AS ok`, [kid])).rows[0].ok, true, 'согласие:');
  });

  await check('владелец на своём живом ребёнке — granted, тот же запрос — duplicate', async () => {
    const e = randomUUID();
    eq(await create(A, kid, e), 'granted');
    eq(await create(A, kid, e), 'duplicate');
    eq(await adminCount(`consent_events WHERE id = '${e}'`), 1);
  });

  await check('чужой живой ребёнок — 42501 child id taken, ничего не записано', async () => {
    const before = await snapshot();
    await taken(create(C, kid));
    eq(await snapshot(), before);
  });
});

// ---------------------------------------------------------------------------
await group('Р1: каждая ветка занятого id отдельно', async (db) => {
  const { as, admin, adminCount, snapshot, create, invite, redeem, link } = await setup(db);
  const kid = randomUUID();
  eq(await create(A, kid), 'created');
  const errors = {};

  // Каждый id попадает ровно в одну ветку проверки: строки собраны суперпользователем,
  // остальные идентификаторы в них настоящие (A) или ничейные без отметки.
  const X = {
    consentChild: randomUUID(),
    consentActor: randomUUID(),
    logChild: randomUUID(),
    logUser: randomUUID(),
    logBy: randomUUID(),
  };
  await admin(`INSERT INTO consent_events (scope, action, child_id, text_version, confirmed_by, actor_id, client_at, child_pseudonymized_at)
               VALUES ('cloud_sync', 'grant', $1, 'ru-v1', 'pin', $2, now(), now())`, [X.consentChild, A]);
  await admin(`INSERT INTO consent_events (scope, action, child_id, text_version, confirmed_by, actor_id, client_at, actor_pseudonymized_at)
               VALUES ('account_local', 'grant', NULL, 'ru-v1', 'signup', $1, now(), now())`, [X.consentActor]);
  await admin(`INSERT INTO child_access_log (child_id, user_id, role, event, by_user, child_pseudonymized_at)
               VALUES ($1, $2, 'owner', 'granted', $2, now())`, [X.logChild, A]);
  await admin(`INSERT INTO child_access_log (child_id, user_id, role, event, by_user, user_pseudonymized_at)
               VALUES ($1, $2, 'guardian', 'granted', $3, now())`, [randomUUID(), X.logUser, A]);
  await admin(`INSERT INTO child_access_log (child_id, user_id, role, event, by_user, by_pseudonymized_at)
               VALUES ($1, $2, 'guardian', 'granted', $3, now())`, [randomUUID(), A, X.logBy]);

  const branches = [
    ['пользователь из auth.users', 'authUser', U],
    ['псевдоним ребёнка в consent_events', 'consentChild', X.consentChild],
    ['псевдоним взрослого в consent_events.actor_id', 'consentActor', X.consentActor],
    ['псевдоним ребёнка в child_access_log', 'logChild', X.logChild],
    ['псевдоним взрослого в child_access_log.user_id', 'logUser', X.logUser],
    ['псевдоним взрослого в child_access_log.by_user', 'logBy', X.logBy],
  ];
  for (const [what, key, id] of branches) {
    await check(`id = ${what} — 42501 child id taken, ничего не записано`, async () => {
      const before = await snapshot();
      errors[key] = await taken(create(C, id));
      eq(await snapshot(), before, 'строк:');
      eq(await adminCount(`children WHERE id = '${id}'`), 0, 'ребёнок:');
    });
  }

  await check('свой собственный id пользователя — тоже 42501', async () => {
    await taken(create(A, A));
  });

  await check('id заявителя из pending_requests — 42501; удаление его аккаунта после этого проходит', async () => {
    eq(await redeem(W, await invite(kid)), 'pending_approval');
    eq((await as(A, `SELECT user_id FROM public.pending_requests($1)`, [kid])).rows, [{ user_id: W }], 'владелец видит uuid:');
    await taken(create(A, W));
    await admin(`DELETE FROM auth.users WHERE id = $1`, [W]);
    await admin(`DELETE FROM auth.users WHERE id = $1`, [U]);
    eq(await adminCount(`auth.users WHERE id IN ('${W}', '${U}')`), 0, 'пользователей:');
    eq(await adminCount(`children WHERE id IN ('${W}', '${U}')`), 0, 'детей с их id:');
  });

  await check('псевдоним удалённого взрослого, видимый владельцу в журнале доступа, — 42501', async () => {
    // E — второй родитель с согласием аккаунта; удаляет аккаунт: его id в обоих журналах
    // заменяется псевдонимом Q (actor_id, user_id, by_user)
    await as(E, `INSERT INTO consent_events (scope, action, child_id, text_version, confirmed_by, client_at)
                 VALUES ('account_local', 'grant', NULL, 'ru-v1', 'signup', now())`);
    await link(kid, E);
    await admin(`DELETE FROM auth.users WHERE id = $1`, [E]);
    const seen = (await as(A, `SELECT DISTINCT user_id FROM child_access_log WHERE child_id = $1 AND event = 'granted' AND user_pseudonymized_at IS NOT NULL`, [kid])).rows;
    eq(seen.length, 1, 'псевдонимов в журнале владельца:');
    const Q = seen[0].user_id;
    eq(await adminCount(`consent_events WHERE actor_id = '${Q}' AND actor_pseudonymized_at IS NOT NULL`), 1, 'согласие аккаунта под Q:');
    await taken(create(A, Q));
    eq(await adminCount(`children WHERE id = '${Q}'`), 0);
  });

  await check('текст отказа одинаков во всех ветках и у чужого живого ребёнка', async () => {
    errors.liveForeign = await taken(create(C, kid));
    const shapes = Object.values(errors).map((e) => ({ code: e.code, message: e.message, detail: e.detail ?? null, hint: e.hint ?? null }));
    eq(shapes.length, 7, 'веток:');
    for (const s of shapes) eq(s, { code: '42501', message: 'child id taken', detail: null, hint: null });
  });
});

// ---------------------------------------------------------------------------
await group('Р1: путь service-role', async (db) => {
  const { admin, service, adminCount, create, revoke, pseudonymOf } = await setup(db);
  const kid = randomUUID();
  const r = randomUUID();
  eq(await create(A, kid), 'created');
  eq(await revoke(A, kid, r), 'revoked');
  const P = await pseudonymOf(r);
  const bare = randomUUID();

  await check('INSERT children с id = псевдоним — 42501 у суперпользователя и service_role', async () => {
    await taken(admin(`INSERT INTO children (id, band) VALUES ($1, '7')`, [P]));
    await taken(service(`INSERT INTO children (id, band) VALUES ($1, '7')`, [P]));
    eq(await adminCount(`children WHERE id = '${P}'`), 0);
  });

  await check('INSERT children с id пользователя — 42501', async () => {
    await taken(admin(`INSERT INTO children (id, band) VALUES ($1, '7')`, [C]));
    await taken(service(`INSERT INTO children (id, band) VALUES ($1, '7')`, [C]));
  });

  await check('INSERT children со свободным id — проходит (контроль)', async () => {
    await admin(`INSERT INTO children (id, band) VALUES ($1, '7')`, [bare]);
    eq(await adminCount(`children WHERE id = '${bare}'`), 1);
  });

  await check('UPDATE children SET id = псевдоним / пользователь — 42501, id не изменился', async () => {
    await taken(admin(`UPDATE children SET id = $1 WHERE id = $2`, [P, bare]));
    await taken(service(`UPDATE children SET id = $1 WHERE id = $2`, [P, bare]));
    await taken(admin(`UPDATE children SET id = $1 WHERE id = $2`, [C, bare]));
    eq(await adminCount(`children WHERE id = '${bare}'`), 1, 'ребёнок на месте:');
    eq(await adminCount(`children WHERE id IN ('${P}', '${C}')`), 0, 'с занятым id:');
  });

  await check('UPDATE других колонок не задевается (контроль)', async () => {
    await service(`UPDATE children SET band = '8' WHERE id = $1`, [bare]);
    eq((await admin(`SELECT band FROM children WHERE id = $1`, [bare])).rows, [{ band: '8' }]);
  });
});

// ---------------------------------------------------------------------------
// DO-блок: миграция падает, если ребёнок с занятым id появился до неё.
await group('Р1: миграция на базе с занятым id', async () => {
  const db = await migratedDb((f) => f < MIGRATION);
  const { admin } = await setup(db);
  eq((await admin(`SELECT count(*)::int AS n FROM pg_trigger WHERE tgname = 'children_id_not_taken'`)).rows[0].n, 0, 'база до миграции:');

  /** Внутри транзакции: подготовить строки, накатить миграцию, откатить всё. */
  const migrateWith = async (prepare) => {
    await admin(`BEGIN`);
    try {
      await prepare();
      await db.exec(MIGRATION_SQL);
    } finally {
      await db.exec(`ROLLBACK`);
    }
  };
  const child = (id) => admin(`INSERT INTO children (id, band) VALUES ($1, '7')`, [id]);
  const cases = [
    ['ребёнок с id пользователя', async (x) => {
      await admin(`INSERT INTO auth.users (id) VALUES ($1)`, [x]);
    }],
    ['ребёнок с псевдонимом из consent_events.child_id', async (x) => {
      await admin(`INSERT INTO consent_events (scope, action, child_id, text_version, confirmed_by, actor_id, client_at, child_pseudonymized_at)
                   VALUES ('cloud_sync', 'grant', $1, 'ru-v1', 'pin', $2, now(), now())`, [x, A]);
    }],
    ['ребёнок с псевдонимом из consent_events.actor_id', async (x) => {
      await admin(`INSERT INTO consent_events (scope, action, child_id, text_version, confirmed_by, actor_id, client_at, actor_pseudonymized_at)
                   VALUES ('account_local', 'grant', NULL, 'ru-v1', 'signup', $1, now(), now())`, [x]);
    }],
    ['ребёнок с псевдонимом из child_access_log.child_id', async (x) => {
      await admin(`INSERT INTO child_access_log (child_id, user_id, role, event, by_user, child_pseudonymized_at)
                   VALUES ($1, $2, 'owner', 'granted', $2, now())`, [x, A]);
    }],
    ['ребёнок с псевдонимом из child_access_log.user_id', async (x) => {
      await admin(`INSERT INTO child_access_log (child_id, user_id, role, event, by_user, user_pseudonymized_at)
                   VALUES ($1, $2, 'guardian', 'granted', $3, now())`, [randomUUID(), x, A]);
    }],
    ['ребёнок с псевдонимом из child_access_log.by_user', async (x) => {
      await admin(`INSERT INTO child_access_log (child_id, user_id, role, event, by_user, by_pseudonymized_at)
                   VALUES ($1, $2, 'guardian', 'granted', $3, now())`, [randomUUID(), A, x]);
    }],
  ];
  for (const [what, prepare] of cases) {
    await check(`${what} — миграция падает с 'children with taken ids exist'`, async () => {
      const x = randomUUID();
      const e = await fails(migrateWith(async () => {
        await prepare(x);
        await child(x);
      }), 'P0001');
      if (!e.message.includes('children with taken ids exist')) throw new Error(`другая ошибка: ${e.message}`);
    });
  }

  await check('без занятых id миграция накатывается (контроль), триггер появился', async () => {
    // ребёнок и псевдонимы в журналах есть, но не совпадают
    await child(randomUUID());
    await admin(`INSERT INTO consent_events (scope, action, child_id, text_version, confirmed_by, actor_id, client_at, child_pseudonymized_at)
                 VALUES ('cloud_sync', 'grant', $1, 'ru-v1', 'pin', $2, now(), now())`, [randomUUID(), A]);
    await db.exec(MIGRATION_SQL);
    eq((await admin(`SELECT count(*)::int AS n FROM pg_trigger WHERE tgname IN ('children_id_not_taken', 'consent_events_clamp_revoke_time')`)).rows[0].n, 2);
  });
});

finish();
