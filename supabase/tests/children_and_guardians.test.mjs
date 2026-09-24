/**
 * RLS и функции доступа для детей, родителей и согласий
 * (migrations/20260924120000_children_and_guardians.sql,
 * migrations/20260924140000_children_privacy_hardening.sql, PARENT.md).
 *
 * Каждая группа — на своей чистой базе со всеми миграциями.
 *
 * Запуск: npm test --prefix supabase
 */
import { actor, denied, eq, runner } from './harness.mjs';

const { check, group, finish } = runner();

const A = '00000000-0000-4000-8000-00000000000a'; // владелец
const B = '00000000-0000-4000-8000-00000000000b'; // второй родитель
const C = '00000000-0000-4000-8000-00000000000c'; // посторонний
const S = '00000000-0000-4000-8000-00000000000d'; // специалист
const D = '00000000-0000-4000-8000-00000000000e'; // ещё один взрослый
const ANON_SIGNIN = { id: '00000000-0000-4000-8000-0000000000ff', anonymous: true };

/** Общая подготовка группы: пользователи, действующие тексты согласий, помощники. */
async function setup(db) {
  await db.exec(`INSERT INTO auth.users (id, email, email_confirmed_at) VALUES
    ('${A}', 'anna@example.kg', now()), ('${B}', 'bakyt@example.kg', now()), ('${C}', 'c@example.kg', now()),
    ('${S}', 'spec@example.kg', now()), ('${D}', 'dana@example.kg', now()), ('${ANON_SIGNIN.id}', NULL, NULL)`);
  await db.exec(`INSERT INTO consent_texts (scope, version, locale, body_sha256, is_current)
    SELECT s, 'ru-v1', 'ru', sha256(convert_to(s || ' v1', 'UTF8')), true
    FROM unnest(ARRAY['account_local', 'cloud_sync', 'companion_ai', 'voice_asr', 'telemetry']) AS s`);
  const as = actor(db);
  // Как service-role: RLS не действует, пользователя в JWT нет.
  const admin = async (sql, params = []) => {
    await db.exec(`RESET ROLE`);
    await db.query(`SELECT set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claims', '', false)`);
    return db.query(sql, params);
  };
  const makeChild = async (owner = A, name = 'Лиса') =>
    (await as(owner, `SELECT public.create_child($1, '5-6', 'ru-v1', 'biometric') AS id`, [name])).rows[0].id;
  const invite = async (kid, owner = A) =>
    (await as(owner, `SELECT public.create_child_invite($1) AS c`, [kid])).rows[0].c;
  const redeem = async (user, code) => (await as(user, `SELECT public.redeem_child_invite($1) AS s`, [code])).rows[0].s;
  const link = async (kid, guardian, owner = A) => {
    eq(await redeem(guardian, await invite(kid, owner)), 'pending_approval', 'заявка:');
    await as(owner, `SELECT public.approve_guardian($1, $2)`, [kid, guardian]);
  };
  const count = async (user, sql, params = []) => (await as(user, `SELECT count(*)::int AS n FROM ${sql}`, params)).rows[0].n;
  const adminCount = async (sql, params = []) => (await admin(`SELECT count(*)::int AS n FROM ${sql}`, params)).rows[0].n;
  return { as, admin, makeChild, invite, redeem, link, count, adminCount };
}

// ---------------------------------------------------------------------------
await group('создание и видимость', async (db) => {
  const { as, admin, makeChild, count, adminCount } = await setup(db);
  let kid;

  await check('ребёнок появляется только с согласием на облако по текущему тексту', async () => {
    await denied(as(A, `SELECT public.create_child('x', '7', 'ru-v0', 'biometric')`));
    await denied(as(A, `SELECT public.create_child('x', '7', 'ru-v1', 'signup')`));
    kid = await makeChild();
    eq((await as(A, `SELECT role, status FROM child_guardians WHERE child_id = $1`, [kid])).rows, [
      { role: 'owner', status: 'active' },
    ]);
    eq(
      (await as(A, `SELECT scope, action, actor_id FROM consent_events WHERE child_id = $1`, [kid])).rows,
      [{ scope: 'cloud_sync', action: 'grant', actor_id: A }],
    );
  });

  await check('посторонний не видит ребёнка, связи и согласия', async () => {
    eq(await count(C, 'children'), 0);
    eq(await count(C, 'child_guardians'), 0);
    eq(await count(C, 'consent_events'), 0);
    eq(await count(C, 'child_access_log'), 0);
  });

  await check('прямой INSERT в child_guardians и children закрыт', async () => {
    await denied(as(C, `INSERT INTO child_guardians (child_id, user_id, role) VALUES ($1, $2, 'owner')`, [kid, C]));
    await denied(as(C, `INSERT INTO child_guardians (child_id, user_id, role) VALUES ($1, $2, 'guardian')`, [kid, C]));
    await denied(as(A, `INSERT INTO children (band) VALUES ('7')`));
  });

  await check('анонимный вход Supabase ребёнка не создаёт', async () => {
    await denied(as(ANON_SIGNIN, `SELECT public.create_child('x', '7', 'ru-v1', 'pin')`));
  });

  await check('аноним без входа не вызывает функции', async () => {
    await denied(as(null, `SELECT public.create_child('x', '7', 'ru-v1', 'pin')`));
    await denied(as(null, `SELECT public.redeem_child_invite('AAAAAAAA')`));
    await denied(as(null, `SELECT public.has_child_access($1)`, [kid]));
    await denied(as(null, `SELECT public.approve_guardian($1, $2)`, [kid, C]));
    await denied(as(null, `SELECT public.purge_expired()`));
  });

  await check('аноним без входа не читает и не пишет детские таблицы', async () => {
    for (const t of ['children', 'child_guardians', 'skill_state', 'lesson_runs', 'consent_events', 'child_access_log']) {
      await denied(as(null, `SELECT * FROM ${t}`));
    }
    await denied(as(null, `INSERT INTO consent_events (scope, action, text_version, confirmed_by) VALUES ('account_local', 'grant', 'ru-v1', 'signup')`));
  });

  await check('служебные функции клиенту недоступны', async () => {
    await denied(as(A, `SELECT public.purge_expired()`));
  });

  await check('TRUNCATE клиенту недоступен — он обходит RLS', async () => {
    await denied(as(A, `TRUNCATE skill_state`));
    eq(await adminCount('children'), 1);
  });

  await check('не больше десяти детей на аккаунт', async () => {
    for (let i = 0; i < 9; i += 1) await makeChild(D, `k${i}`);
    await makeChild(D, 'k9');
    await denied(makeChild(D, 'k10'));
    eq(await count(D, 'children'), 10);
  });

  await check('имя в одну строку: не канал для произвольного текста', async () => {
    await denied(makeChild(C, 'Лиса\nул. Ленина 5'));
  });

  await check('новые таблицы не публикуются в Realtime', async () => {
    const rows = (await admin(`SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime'`)).rows;
    const leaked = rows.map((r) => r.tablename).filter((t) =>
      ['children', 'child_guardians', 'child_access_invites', 'skill_state', 'lesson_runs', 'consent_events', 'child_access_log'].includes(t),
    );
    eq(leaked, []);
  });
});

// ---------------------------------------------------------------------------
await group('код приглашения', async (db) => {
  const { as, admin, makeChild, invite, redeem, count, adminCount } = await setup(db);
  const kid = await makeChild();
  let code;

  await check('выдаёт только владелец', async () => {
    await denied(as(C, `SELECT public.create_child_invite($1)`, [kid]));
  });

  await check('8 символов без I, O, 0, 1; в базе только хеш', async () => {
    code = await invite(kid);
    if (!/^[ABCDEFGHJKLMNPQRSTUVWXYZ2-9]{8}$/.test(code)) throw new Error(`код ${code}`);
    const stored = (await admin(`SELECT encode(code_hash, 'escape') AS h FROM child_access_invites`)).rows;
    if (stored.some((r) => r.h.includes(code))) throw new Error('код лежит открытым текстом');
  });

  await check('таблица кодов закрыта даже владельцу', async () => {
    await denied(as(A, `SELECT * FROM child_access_invites`));
  });

  await check('код даёт только заявку: ребёнка не видно до подтверждения', async () => {
    eq(await redeem(B, ` ${code.toLowerCase()} `), 'pending_approval');
    eq((await as(B, `SELECT status FROM child_guardians WHERE user_id = $1`, [B])).rows, [{ status: 'pending' }]);
    eq(await count(B, 'children'), 0);
    eq(await count(B, 'skill_state'), 0);
  });

  await check('подтвердить может только владелец', async () => {
    await denied(as(B, `SELECT public.approve_guardian($1, $2)`, [kid, B]));
    await denied(as(C, `SELECT public.approve_guardian($1, $2)`, [kid, B]));
    await as(A, `SELECT public.approve_guardian($1, $2)`, [kid, B]);
    eq(await count(B, 'children'), 1);
  });

  await check('владелец видит заявку и выдачу в журнале доступа', async () => {
    eq(
      (await as(A, `SELECT event FROM child_access_log WHERE user_id = $1 ORDER BY id`, [B])).rows.map((r) => r.event),
      ['requested', 'granted'],
    );
  });

  await check('код одноразовый', async () => {
    eq(await redeem(C, code), 'invalid');
  });

  await check('второй код тому, у кого уже есть доступ, не нужен', async () => {
    eq(await redeem(B, await invite(kid)), 'already_linked');
  });

  await check('просроченный код не работает', async () => {
    const c2 = await invite(kid);
    await admin(`UPDATE child_access_invites SET expires_at = now() - interval '1 minute' WHERE redeemed_at IS NULL`);
    eq(await redeem(C, c2), 'invalid');
  });

  await check('владелец гасит выданные коды; второй родитель — нет', async () => {
    const c3 = await invite(kid);
    await denied(as(B, `SELECT public.revoke_child_invites($1)`, [kid]));
    await as(A, `SELECT public.revoke_child_invites($1)`, [kid]);
    eq(await redeem(C, c3), 'invalid');
  });

  await check('не больше трёх действующих кодов на ребёнка', async () => {
    await as(A, `SELECT public.revoke_child_invites($1)`, [kid]);
    await invite(kid);
    await invite(kid);
    await invite(kid);
    await denied(invite(kid));
  });

  await check('анонимный вход кодом не пользуется', async () => {
    await as(A, `SELECT public.revoke_child_invites($1)`, [kid]);
    eq(await redeem(ANON_SIGNIN, await invite(kid)), 'not_allowed');
  });

  await check('перебор: после десяти неудач за час даже верный код не принимается', async () => {
    await as(A, `SELECT public.revoke_child_invites($1)`, [kid]);
    const good = await invite(kid);
    for (let i = 0; i < 10; i += 1) eq(await redeem(D, `WRONG${String(i).padStart(3, '2')}`), 'invalid');
    eq(await redeem(D, good), 'rate_limited');
    eq(await adminCount(`child_guardians WHERE user_id = '${D}'`), 0);
  });
});

// ---------------------------------------------------------------------------
await group('права второго родителя и специалиста', async (db) => {
  const { as, admin, makeChild, link, count, adminCount } = await setup(db);
  const kid = await makeChild();
  await link(kid, B);

  await check('второй родитель не удаляет ребёнка и не выдаёт доступ', async () => {
    await as(B, `DELETE FROM children WHERE id = $1`, [kid]);
    eq(await adminCount('children'), 1);
    await denied(as(B, `SELECT public.create_child_invite($1)`, [kid]));
  });

  await check('роль и статус из клиента не меняются', async () => {
    await as(B, `UPDATE child_guardians SET role = 'owner' WHERE user_id = $1`, [B]);
    eq((await admin(`SELECT role FROM child_guardians WHERE user_id = $1`, [B])).rows, [{ role: 'guardian' }]);
  });

  await check('строку владельца не удалить ни владельцу, ни второму родителю', async () => {
    await as(A, `DELETE FROM child_guardians WHERE user_id = $1`, [A]);
    await as(B, `DELETE FROM child_guardians WHERE user_id = $1`, [A]);
    eq(await adminCount(`child_guardians WHERE role = 'owner'`), 1);
  });

  await check('владелец отзывает второго родителя — это видно в журнале', async () => {
    await as(A, `DELETE FROM child_guardians WHERE user_id = $1`, [B]);
    eq(await count(B, 'children'), 0);
    eq((await as(A, `SELECT event FROM child_access_log WHERE user_id = $1 ORDER BY id DESC LIMIT 1`, [B])).rows, [
      { event: 'revoked' },
    ]);
  });

  await check('второй родитель может выйти сам — «left» в журнале', async () => {
    await link(kid, D);
    await as(D, `DELETE FROM child_guardians WHERE user_id = $1`, [D]);
    eq((await as(A, `SELECT event FROM child_access_log WHERE user_id = $1 ORDER BY id DESC LIMIT 1`, [D])).rows, [
      { event: 'left' },
    ]);
  });

  await check('истёкший доступ перестаёт действовать', async () => {
    await link(kid, B);
    await admin(`UPDATE child_guardians SET expires_at = now() - interval '1 second' WHERE user_id = $1`, [B]);
    eq(await count(B, 'children'), 0);
    await admin(`UPDATE child_guardians SET expires_at = NULL WHERE user_id = $1`, [B]);
  });

  await check('специалист в первой версии не видит ничего и ничего не выдаёт', async () => {
    await admin(
      `INSERT INTO child_guardians (child_id, user_id, role, expires_at) VALUES ($1, $2, 'specialist', now() + interval '90 days')`,
      [kid, S],
    );
    eq(await count(S, 'children'), 0);
    eq(await count(S, 'skill_state'), 0);
    await denied(as(S, `SELECT public.create_child_invite($1)`, [kid]));
    await denied(
      as(S, `INSERT INTO consent_events (scope, action, child_id, text_version, confirmed_by, client_at) VALUES ('telemetry', 'grant', $1, 'ru-v1', 'pin', now())`, [kid]),
    );
  });

  await check('специалист без срока и второй владелец невозможны', async () => {
    await denied(admin(`INSERT INTO child_guardians (child_id, user_id, role) VALUES ($1, $2, 'specialist')`, [kid, C]));
    await denied(admin(`INSERT INTO child_guardians (child_id, user_id, role) VALUES ($1, $2, 'owner')`, [kid, C]));
  });

  await check('не больше четырёх взрослых на ребёнка', async () => {
    // сейчас: A, B, S — трое
    await link(kid, D);
    await denied(admin(`INSERT INTO child_guardians (child_id, user_id, role) VALUES ($1, $2, 'guardian')`, [kid, C]));
  });
});

// ---------------------------------------------------------------------------
await group('данные ребёнка и согласие на облако', async (db) => {
  const { as, admin, makeChild, link, count, adminCount } = await setup(db);
  const kid = await makeChild();
  const other = await makeChild(C, 'Чужой');
  await link(kid, B);

  await check('родители пишут и читают навыки, посторонний — нет', async () => {
    await as(B, `INSERT INTO skill_state (child_id, skill, box, attempts, correct) VALUES ($1, 'count-5', 2, 3, 1)`, [kid]);
    eq((await as(A, `SELECT box FROM skill_state`)).rows, [{ box: 2 }]);
    eq(await count(C, `skill_state WHERE child_id = '${kid}'`), 0);
    await denied(as(C, `INSERT INTO skill_state (child_id, skill, box) VALUES ($1, 'x', 1)`, [kid]));
  });

  await check('строку навыка не перенести на чужого ребёнка', async () => {
    await denied(as(A, `UPDATE skill_state SET child_id = $1 WHERE child_id = $2`, [other, kid]));
    eq(await adminCount(`skill_state WHERE child_id = '${kid}'`), 1);
  });

  await check('поля не принимают мусор', async () => {
    await denied(as(A, `INSERT INTO skill_state (child_id, skill, box, attempts, correct) VALUES ($1, 'y', 1, 2, 3)`, [kid]));
    await denied(as(A, `INSERT INTO skill_state (child_id, skill, box) VALUES ($1, $2, 1)`, [kid, 'x'.repeat(65)]));
    await denied(as(A, `INSERT INTO lesson_runs (child_id, lesson_id, started_at, task_seconds) VALUES ($1, 'l', now(), '{30,-5}')`, [kid]));
    await denied(as(A, `INSERT INTO lesson_runs (child_id, lesson_id, started_at) VALUES ($1, $2, now())`, [kid, 'l'.repeat(65)]));
  });

  await check('прохождения только дописываются: правки нет', async () => {
    await as(A, `INSERT INTO lesson_runs (child_id, lesson_id, started_at, task_seconds) VALUES ($1, 'l1', now(), '{30,40}')`, [kid]);
    await denied(as(A, `UPDATE lesson_runs SET task_seconds = '{9999}'`));
    eq((await admin(`SELECT task_seconds FROM lesson_runs`)).rows, [{ task_seconds: [30, 40] }]);
    eq(await count(B, 'lesson_runs'), 1);
    eq(await count(C, `lesson_runs WHERE child_id = '${kid}'`), 0);
  });

  await check('сменился текст — запись в облако закрыта до нового согласия', async () => {
    await admin(`UPDATE consent_texts SET is_current = false WHERE scope = 'cloud_sync'`);
    await admin(`INSERT INTO consent_texts (scope, version, locale, body_sha256, is_current) VALUES ('cloud_sync', 'ru-v2', 'ru', sha256('cloud v2'::bytea), true)`);
    await denied(as(B, `INSERT INTO skill_state (child_id, skill, box) VALUES ($1, 'new', 1)`, [kid]));
    await denied(as(B, `SELECT public.grant_cloud_sync($1, 'ru-v2', 'pin')`, [kid]));
    await denied(as(A, `SELECT public.grant_cloud_sync($1, 'ru-v1', 'pin')`, [kid]));
    await as(A, `SELECT public.grant_cloud_sync($1, 'ru-v2', 'pin')`, [kid]);
    await as(B, `INSERT INTO skill_state (child_id, skill, box) VALUES ($1, 'new', 1)`, [kid]);
  });

  await check('облачное согласие не пишется в обход функций', async () => {
    await denied(
      as(A, `INSERT INTO consent_events (scope, action, child_id, text_version, confirmed_by, client_at) VALUES ('cloud_sync', 'grant', $1, 'ru-v2', 'pin', now())`, [kid]),
    );
  });

  await check('отзыв облака — только владельцем, и убирает собранное', async () => {
    await denied(as(B, `SELECT public.revoke_cloud_sync($1, 'ru-v2', 'pin')`, [kid]));
    await as(A, `SELECT public.revoke_cloud_sync($1, 'ru-v2', 'pin')`, [kid]);
    eq(await adminCount(`children WHERE id = '${kid}'`), 0);
    eq(await adminCount(`skill_state WHERE child_id = '${kid}'`), 0);
    eq(await adminCount(`lesson_runs WHERE child_id = '${kid}'`), 0);
  });

  await check('согласия ребёнка остаются под одним псевдонимом и получают срок хранения', async () => {
    const rows = (await admin(`SELECT child_id, action, retain_until IS NOT NULL AS kept FROM consent_events WHERE scope = 'cloud_sync' AND actor_id = $1 AND child_id <> $2 ORDER BY received_at`, [A, other])).rows;
    eq(rows.map((r) => r.action), ['grant', 'grant', 'revoke']);
    eq(new Set(rows.map((r) => r.child_id)).size, 1, 'один псевдоним:');
    if (rows[0].child_id === kid) throw new Error('идентификатор ребёнка не заменён');
    eq(rows.every((r) => r.kept), true, 'срок хранения:');
  });
});

// ---------------------------------------------------------------------------
await group('журнал согласий', async (db) => {
  const { as, admin, makeChild, link, count } = await setup(db);
  const kid = await makeChild();
  await link(kid, B);

  await check('автора и серверное время ставит сервер', async () => {
    await as(A, `INSERT INTO consent_events (scope, action, text_version, confirmed_by, client_at) VALUES ('account_local', 'grant', 'ru-v1', 'signup', now() - interval '1 day')`);
    const r = (await admin(`SELECT actor_id, received_at > client_at AS later FROM consent_events WHERE scope = 'account_local'`)).rows;
    eq(r, [{ actor_id: A, later: true }]);
  });

  await check('чужое имя и серверное время из клиента не пишутся', async () => {
    await denied(as(C, `INSERT INTO consent_events (scope, action, text_version, confirmed_by, actor_id, client_at) VALUES ('account_local', 'grant', 'ru-v1', 'signup', $1, now())`, [A]));
    await denied(as(A, `INSERT INTO consent_events (scope, action, text_version, confirmed_by, client_at, received_at) VALUES ('account_local', 'grant', 'ru-v1', 'signup', now(), now() - interval '1 year')`));
  });

  await check('время устройства из будущего отклоняется', async () => {
    await denied(as(A, `INSERT INTO consent_events (scope, action, text_version, confirmed_by, client_at) VALUES ('account_local', 'grant', 'ru-v1', 'signup', now() + interval '1 day')`));
  });

  await check('ИИ и голос — только владелец', async () => {
    for (const scope of ['companion_ai', 'voice_asr']) {
      await denied(as(B, `INSERT INTO consent_events (scope, action, child_id, text_version, confirmed_by, client_at) VALUES ($1, 'grant', $2, 'ru-v1', 'pin', now())`, [scope, kid]));
      await as(A, `INSERT INTO consent_events (scope, action, child_id, text_version, confirmed_by, client_at) VALUES ($1, 'grant', $2, 'ru-v1', 'biometric', now())`, [scope, kid]);
    }
  });

  await check('телеметрию может отключить и второй родитель', async () => {
    await as(B, `INSERT INTO consent_events (scope, action, child_id, text_version, confirmed_by, client_at) VALUES ('telemetry', 'revoke', $1, 'ru-v1', 'pin', now())`, [kid]);
  });

  await check('на чужого ребёнка согласие не пишется', async () => {
    await denied(as(C, `INSERT INTO consent_events (scope, action, child_id, text_version, confirmed_by, client_at) VALUES ('telemetry', 'grant', $1, 'ru-v1', 'pin', now())`, [kid]));
    eq(await count(C, 'consent_events'), 0);
  });

  await check('правила в схеме совпадают с клиентом', async () => {
    await denied(as(A, `INSERT INTO consent_events (scope, action, child_id, text_version, confirmed_by, client_at) VALUES ('account_local', 'grant', $1, 'ru-v1', 'signup', now())`, [kid]));
    await denied(as(A, `INSERT INTO consent_events (scope, action, child_id, text_version, confirmed_by, client_at) VALUES ('telemetry', 'grant', $1, 'ru-v1', 'signup', now())`, [kid]));
    await denied(as(A, `INSERT INTO consent_events (scope, action, child_id, text_version, confirmed_by, client_at) VALUES ('telemetry', 'grant', $1, '', 'pin', now())`, [kid]));
  });

  await check('анонимный вход согласий не даёт', async () => {
    await denied(as(ANON_SIGNIN, `INSERT INTO consent_events (scope, action, text_version, confirmed_by, client_at) VALUES ('account_local', 'grant', 'ru-v1', 'signup', now())`));
  });

  await check('клиент не правит и не удаляет согласия', async () => {
    await denied(as(A, `UPDATE consent_events SET action = 'revoke'`));
    await denied(as(A, `DELETE FROM consent_events`));
  });

  await check('даже в обход RLS журнал только дописывается', async () => {
    await denied(admin(`UPDATE consent_events SET action = 'revoke' WHERE scope = 'account_local'`));
    await denied(admin(`UPDATE consent_events SET client_at = now() - interval '1 year' WHERE scope = 'account_local'`));
    await denied(admin(`DELETE FROM consent_events WHERE scope = 'account_local'`));
  });
});

// ---------------------------------------------------------------------------
await group('удаление аккаунта владельца без передачи', async (db) => {
  const { as, admin, makeChild, link, count, adminCount } = await setup(db);
  const kid = await makeChild();
  await link(kid, B);
  await as(B, `INSERT INTO skill_state (child_id, skill, box) VALUES ($1, 'count-5', 2)`, [kid]);
  await as(A, `INSERT INTO consent_events (scope, action, text_version, confirmed_by, client_at) VALUES ('account_local', 'grant', 'ru-v1', 'signup', now())`);

  await check('ребёнок удаляется вместе с владельцем — сирот не бывает', async () => {
    await admin(`DELETE FROM auth.users WHERE id = $1`, [A]);
    eq(await adminCount('children'), 0);
    eq(await adminCount('skill_state'), 0);
    eq(await adminCount('child_guardians'), 0);
    eq(await count(B, 'children'), 0);
  });

  await check('журнал доступа переживает удаление ребёнка — под псевдонимами и со сроком', async () => {
    const rows = (await admin(`SELECT child_id, user_id, retain_until IS NOT NULL AS kept FROM child_access_log`)).rows;
    if (rows.length === 0) throw new Error('журнал доступа удалён вместе с ребёнком');
    if (rows.some((r) => r.child_id === kid || r.user_id === A)) throw new Error('идентификаторы не заменены');
    eq(rows.every((r) => r.kept), true, 'срок хранения:');
    eq(new Set(rows.map((r) => r.child_id)).size, 1, 'один псевдоним ребёнка:');
  });

  await check('согласия остаются под псевдонимами: у ребёнка и у взрослого разные', async () => {
    const rows = (await admin(`SELECT child_id, actor_id, retain_until IS NOT NULL AS kept FROM consent_events`)).rows;
    eq(rows.length, 2);
    if (rows.some((r) => r.actor_id === A || r.child_id === kid)) throw new Error('идентификаторы не заменены');
    const cloud = rows.find((r) => r.child_id !== null);
    if (cloud.child_id === cloud.actor_id) throw new Error('один псевдоним на ребёнка и взрослого');
    eq(new Set(rows.map((r) => r.actor_id)).size, 1, 'один псевдоним взрослого:');
    eq(rows.every((r) => r.kept), true, 'срок хранения:');
  });
});

// ---------------------------------------------------------------------------
await group('передача владения перед удалением', async (db) => {
  const { as, admin, makeChild, link, invite, redeem, count, adminCount } = await setup(db);
  const kid = await makeChild();
  await link(kid, B);

  await check('передать можно только действующему второму родителю и только владельцу', async () => {
    await denied(as(A, `SELECT public.transfer_child_ownership($1, $2)`, [kid, C]));
    eq(await redeem(D, await invite(kid)), 'pending_approval');
    await denied(as(A, `SELECT public.transfer_child_ownership($1, $2)`, [kid, D]));
    await denied(as(B, `SELECT public.transfer_child_ownership($1, $2)`, [kid, B]));
  });

  await check('после передачи ребёнок переживает удаление аккаунта прежнего владельца', async () => {
    await as(A, `SELECT public.transfer_child_ownership($1, $2)`, [kid, B]);
    await admin(`DELETE FROM auth.users WHERE id = $1`, [A]);
    eq(await adminCount('children'), 1);
    eq((await admin(`SELECT user_id, role FROM child_guardians WHERE status = 'active'`)).rows, [{ user_id: B, role: 'owner' }]);
  });

  await check('новый владелец распоряжается ребёнком', async () => {
    await as(B, `SELECT public.approve_guardian($1, $2)`, [kid, D]);
    eq(await count(D, 'children'), 1);
    await invite(kid, B);
  });

  await check('в журнале передача видна, прежний владелец — под псевдонимом', async () => {
    const rows = (await as(B, `SELECT user_id, event FROM child_access_log WHERE event LIKE 'transferred%' ORDER BY id`)).rows;
    eq(rows.map((r) => r.event), ['transferred_out', 'transferred_in']);
    if (rows[0].user_id === A) throw new Error('прежний владелец не заменён псевдонимом');
    eq(rows[1].user_id, B);
  });

  await check('второй родитель удаляет свой аккаунт — ребёнок остаётся у владельца', async () => {
    await admin(`DELETE FROM auth.users WHERE id = $1`, [D]);
    eq(await count(B, 'children'), 1);
    const last = (await as(B, `SELECT user_id, event FROM child_access_log ORDER BY id DESC LIMIT 1`)).rows[0];
    eq(last.event, 'left');
    if (last.user_id === D) throw new Error('ушедший не заменён псевдонимом');
  });
});

// ---------------------------------------------------------------------------
await group('сроки хранения', async (db) => {
  const { as, admin, makeChild, invite, adminCount } = await setup(db);
  const kid = await makeChild();

  await check('purge_expired убирает просроченное и не трогает свежее', async () => {
    await admin(`INSERT INTO lesson_runs (child_id, lesson_id, started_at) VALUES ($1, 'old', now() - interval '13 months'), ($1, 'new', now() - interval '1 month')`, [kid]);
    await invite(kid);
    await admin(`UPDATE child_access_invites SET expires_at = now() - interval '8 days'`);
    await admin(`INSERT INTO invite_attempts (user_id, at) VALUES ($1, now() - interval '2 days')`, [C]);
    await as(C, `INSERT INTO consent_events (scope, action, text_version, confirmed_by, client_at) VALUES ('account_local', 'grant', 'ru-v1', 'signup', now())`);
    await admin(`DELETE FROM auth.users WHERE id = $1`, [C]); // псевдоним и срок
    // «прошло три года»: срок в прошлое защитный триггер не пускает — отключаем его только здесь
    await admin(`ALTER TABLE consent_events DISABLE TRIGGER consent_events_append_only`);
    await admin(`UPDATE consent_events SET retain_until = now() - interval '1 day' WHERE retain_until IS NOT NULL`);
    await admin(`ALTER TABLE consent_events ENABLE TRIGGER consent_events_append_only`);

    await admin(`SELECT public.purge_expired()`);
    eq((await admin(`SELECT lesson_id FROM lesson_runs`)).rows, [{ lesson_id: 'new' }]);
    eq(await adminCount('child_access_invites'), 0);
    eq(await adminCount('invite_attempts'), 0);
    eq(await adminCount(`consent_events WHERE scope = 'account_local'`), 0);
    eq(await adminCount(`consent_events WHERE scope = 'cloud_sync'`), 1, 'действующее согласие осталось:');
  });
});

// ---------------------------------------------------------------------------
await group('передача: согласие переданного ребёнка и семь дней на своё', async (db) => {
  const { as, admin, makeChild, link, count } = await setup(db);
  const kid = await makeChild();
  await link(kid, B);
  await as(A, `INSERT INTO consent_events (scope, action, text_version, confirmed_by, client_at) VALUES ('account_local', 'grant', 'ru-v1', 'signup', now())`);
  await as(A, `SELECT public.transfer_child_ownership($1, $2)`, [kid, B]);
  await admin(`DELETE FROM auth.users WHERE id = $1`, [A]);

  await check('согласие живого ребёнка не получает срок хранения при удалении аккаунта', async () => {
    const rows = (await admin(`SELECT scope, retain_until IS NULL AS forever FROM consent_events ORDER BY seq`)).rows;
    eq(rows, [
      { scope: 'cloud_sync', forever: true },
      { scope: 'account_local', forever: false },
    ]);
  });

  await check('очистка через три года согласие живого ребёнка не трогает', async () => {
    await admin(`ALTER TABLE consent_events DISABLE TRIGGER consent_events_append_only`);
    await admin(`UPDATE consent_events SET retain_until = now() - interval '1 day' WHERE retain_until IS NOT NULL`);
    await admin(`ALTER TABLE consent_events ENABLE TRIGGER consent_events_append_only`);
    await admin(`SELECT public.purge_expired()`);
    eq((await admin(`SELECT scope FROM consent_events`)).rows, [{ scope: 'cloud_sync' }]);
  });

  await check('семь дней новый владелец пишет на согласии прежнего', async () => {
    eq((await as(B, `SELECT public.has_consent($1, 'cloud_sync') AS ok`, [kid])).rows[0].ok, true);
    await as(B, `INSERT INTO skill_state (child_id, skill, box) VALUES ($1, 'a', 1)`, [kid]);
  });

  await check('после семи дней без своего согласия запись закрыта', async () => {
    await admin(`UPDATE children SET consent_grace_until = now() - interval '1 minute' WHERE id = $1`, [kid]);
    eq((await as(B, `SELECT public.has_consent($1, 'cloud_sync') AS ok`, [kid])).rows[0].ok, false);
    await denied(as(B, `INSERT INTO skill_state (child_id, skill, box) VALUES ($1, 'b', 1)`, [kid]));
    await denied(as(B, `UPDATE children SET display_name = 'Новое' WHERE id = $1`, [kid]));
  });

  await check('своё согласие — и запись снова открыта', async () => {
    await as(B, `SELECT public.grant_cloud_sync($1, 'ru-v1', 'biometric')`, [kid]);
    await as(B, `INSERT INTO skill_state (child_id, skill, box) VALUES ($1, 'b', 1)`, [kid]);
    eq(await count(B, 'skill_state'), 2);
  });

  await check('срок на согласие из клиента не продлить', async () => {
    await denied(as(B, `UPDATE children SET consent_grace_until = now() + interval '1 year' WHERE id = $1`, [kid]));
  });
});

// ---------------------------------------------------------------------------
await group('заявки: владелец видит, кто просится', async (db) => {
  const { as, admin, makeChild, invite, redeem, count, adminCount } = await setup(db);
  const kid = await makeChild();
  eq(await redeem(B, await invite(kid)), 'pending_approval');

  await check('владелец видит заявку с замаскированной почтой', async () => {
    const rows = (await as(A, `SELECT user_id, email_hint FROM public.pending_requests($1)`, [kid])).rows;
    eq(rows, [{ user_id: B, email_hint: 'ba***t@example.kg' }]);
  });

  await check('заявки не видит никто, кроме владельца', async () => {
    await denied(as(B, `SELECT * FROM public.pending_requests($1)`, [kid]));
    await denied(as(C, `SELECT * FROM public.pending_requests($1)`, [kid]));
    await denied(as(null, `SELECT * FROM public.pending_requests($1)`, [kid]));
  });

  await check('неподтверждённая заявка истекает через 72 часа и освобождает место', async () => {
    await admin(`UPDATE child_guardians SET created_at = now() - interval '73 hours' WHERE status = 'pending'`);
    await admin(`SELECT public.purge_expired()`);
    eq(await adminCount(`child_guardians WHERE user_id = '${B}'`), 0);
    eq((await as(A, `SELECT event FROM child_access_log WHERE user_id = $1 ORDER BY id`, [B])).rows.map((r) => r.event), [
      'requested',
      'expired',
    ]);
  });

  await check('отзыв доступа сервисом пишется как отзыв, а не как «вышел сам»', async () => {
    eq(await redeem(D, await invite(kid)), 'pending_approval');
    await as(A, `SELECT public.approve_guardian($1, $2)`, [kid, D]);
    await admin(`DELETE FROM child_guardians WHERE user_id = $1`, [D]);
    eq((await as(A, `SELECT event FROM child_access_log WHERE user_id = $1 ORDER BY id DESC LIMIT 1`, [D])).rows, [
      { event: 'revoked' },
    ]);
    eq(await count(D, 'children'), 0);
  });
});

// ---------------------------------------------------------------------------
await group('запрос второго родителя на отзыв', async (db) => {
  const { as, makeChild, link } = await setup(db);
  const kid = await makeChild();
  await link(kid, B);
  await as(A, `INSERT INTO consent_events (scope, action, child_id, text_version, confirmed_by, client_at) VALUES ('companion_ai', 'grant', $1, 'ru-v1', 'pin', now())`, [kid]);

  await check('второй родитель подаёт запрос, владелец его видит', async () => {
    await as(B, `SELECT public.request_consent_revoke($1, 'companion_ai')`, [kid]);
    await as(B, `SELECT public.request_consent_revoke($1, 'companion_ai')`, [kid]); // повтор не плодит запросов
    eq((await as(A, `SELECT scope, requested_by FROM consent_revoke_requests WHERE resolved_at IS NULL`)).rows, [
      { scope: 'companion_ai', requested_by: B },
    ]);
    eq((await as(B, `SELECT count(*)::int AS n FROM consent_revoke_requests`)).rows[0].n, 1);
  });

  await check('владельцу просить некого, посторонний не просит', async () => {
    await denied(as(A, `SELECT public.request_consent_revoke($1, 'companion_ai')`, [kid]));
    await denied(as(C, `SELECT public.request_consent_revoke($1, 'companion_ai')`, [kid]));
    eq((await as(C, `SELECT count(*)::int AS n FROM consent_revoke_requests`)).rows[0].n, 0);
  });

  await check('владелец оставляет согласие — запрос закрыт как «оставлено»', async () => {
    await denied(as(B, `SELECT public.dismiss_consent_revoke($1, 'companion_ai')`, [kid]));
    await as(A, `SELECT public.dismiss_consent_revoke($1, 'companion_ai')`, [kid]);
    eq((await as(B, `SELECT resolution FROM consent_revoke_requests`)).rows, [{ resolution: 'kept' }]);
  });

  await check('после «оставить» повторный запрос — не раньше чем через 30 дней', async () => {
    await denied(as(B, `SELECT public.request_consent_revoke($1, 'companion_ai')`, [kid]));
  });

  await check('владелец отзывает — запрос закрывается сам', async () => {
    await as(A, `INSERT INTO consent_events (scope, action, child_id, text_version, confirmed_by, client_at) VALUES ('voice_asr', 'grant', $1, 'ru-v1', 'pin', now())`, [kid]);
    await as(B, `SELECT public.request_consent_revoke($1, 'voice_asr')`, [kid]);
    await as(A, `INSERT INTO consent_events (scope, action, child_id, text_version, confirmed_by, client_at) VALUES ('voice_asr', 'revoke', $1, 'ru-v1', 'pin', now())`, [kid]);
    eq((await as(B, `SELECT scope, resolution FROM consent_revoke_requests ORDER BY id`)).rows, [
      { scope: 'companion_ai', resolution: 'kept' },
      { scope: 'voice_asr', resolution: 'revoked' },
    ]);
  });

  await check('ушедший второй родитель — его открытый запрос отозван', async () => {
    await as(A, `INSERT INTO consent_events (scope, action, child_id, text_version, confirmed_by, client_at) VALUES ('voice_asr', 'grant', $1, 'ru-v1', 'pin', now())`, [kid]);
    await as(B, `SELECT public.request_consent_revoke($1, 'voice_asr')`, [kid]);
    await as(B, `DELETE FROM child_guardians WHERE user_id = $1`, [B]);
    eq((await as(A, `SELECT resolution FROM consent_revoke_requests ORDER BY id DESC LIMIT 1`)).rows, [
      { resolution: 'withdrawn' },
    ]);
  });
});

// ---------------------------------------------------------------------------
await group('журналы нельзя переписать даже в обход RLS', async (db) => {
  const { as, admin, makeChild } = await setup(db);
  const kid = await makeChild();
  const other = await makeChild(C, 'Другой');

  await check('срок хранения не сдвинуть в прошлое, чтобы потом удалить', async () => {
    await denied(admin(`UPDATE consent_events SET retain_until = '2000-01-01' WHERE child_id = $1`, [kid]));
    await denied(admin(`UPDATE child_access_log SET retain_until = '2000-01-01' WHERE child_id = $1`, [kid]));
  });

  await check('согласие не перевесить на другого живого ребёнка', async () => {
    await denied(admin(`UPDATE consent_events SET child_id = $1 WHERE child_id = $2`, [other, kid]));
  });

  await check('псевдоним не переписать второй раз', async () => {
    await as(A, `SELECT public.revoke_cloud_sync($1, 'ru-v1', 'pin')`, [kid]);
    await denied(admin(`UPDATE consent_events SET child_id = gen_random_uuid() WHERE actor_id = $1 AND scope = 'cloud_sync'`, [A]));
  });

  await check('журнал доступа не правится и не удаляется до срока', async () => {
    await denied(admin(`UPDATE child_access_log SET event = 'left'`));
    await denied(admin(`DELETE FROM child_access_log`));
  });

  await check('TRUNCATE журналов запрещён всем', async () => {
    await denied(admin(`TRUNCATE consent_events`));
    await denied(admin(`TRUNCATE child_access_log`));
  });
});

// ---------------------------------------------------------------------------
await group('проверка согласия и порядок событий', async (db) => {
  const { as, makeChild, link } = await setup(db);
  const kid = await makeChild();
  await link(kid, B);

  await check('о согласии чужого ребёнка не узнать', async () => {
    eq((await as(A, `SELECT public.has_consent($1, 'cloud_sync') AS ok`, [kid])).rows[0].ok, true);
    eq((await as(C, `SELECT public.has_consent($1, 'cloud_sync') AS ok`, [kid])).rows[0].ok, false);
  });

  await check('бывший второй родитель тоже не узнаёт', async () => {
    await as(B, `DELETE FROM child_guardians WHERE user_id = $1`, [B]);
    eq((await as(B, `SELECT public.has_consent($1, 'cloud_sync') AS ok`, [kid])).rows[0].ok, false);
  });

  await check('пачка [дал, отозвал] одним запросом: решает серверный порядок, а не время устройства', async () => {
    // время устройства у grant позже — по нему «победил» бы grant
    await as(A, `INSERT INTO consent_events (scope, action, child_id, text_version, confirmed_by, client_at) VALUES
      ('telemetry', 'grant', $1, 'ru-v1', 'pin', now()),
      ('telemetry', 'revoke', $1, 'ru-v1', 'pin', now() - interval '1 hour')`, [kid]);
    eq((await as(A, `SELECT public.has_consent($1, 'telemetry') AS ok`, [kid])).rows[0].ok, false);
  });
});

// ---------------------------------------------------------------------------
await group('прохождения из будущего', async (db) => {
  const { as, makeChild } = await setup(db);
  const kid = await makeChild();

  await check('датой из будущего от очистки не уйти', async () => {
    await denied(as(A, `INSERT INTO lesson_runs (child_id, lesson_id, started_at) VALUES ($1, 'l', now() + interval '2 years')`, [kid]));
  });
});

// ---------------------------------------------------------------------------
await group('отозванное согласие не вернуть подменой идентификатора', async (db) => {
  const { as, admin, makeChild } = await setup(db);
  const kid = await makeChild();
  await as(A, `INSERT INTO consent_events (scope, action, child_id, text_version, confirmed_by, client_at) VALUES ('companion_ai', 'grant', $1, 'ru-v1', 'pin', now())`, [kid]);
  await as(A, `INSERT INTO consent_events (scope, action, child_id, text_version, confirmed_by, client_at) VALUES ('companion_ai', 'revoke', $1, 'ru-v1', 'pin', now())`, [kid]);

  await check('отзыв живого ребёнка не отвязать псевдонимом — даже в обход RLS', async () => {
    await denied(admin(`UPDATE consent_events SET child_id = gen_random_uuid(), child_pseudonymized_at = now() WHERE action = 'revoke' AND child_id = $1`, [kid]));
    await denied(admin(`UPDATE consent_events SET child_id = gen_random_uuid() WHERE action = 'revoke' AND child_id = $1`, [kid]));
    eq((await as(A, `SELECT public.has_consent($1, 'companion_ai') AS ok`, [kid])).rows[0].ok, false);
  });

  await check('после удаления ребёнка псевдоним ставится один раз, отметка не снимается', async () => {
    await as(A, `DELETE FROM children WHERE id = $1`, [kid]);
    const rows = (await admin(`SELECT child_id, child_pseudonymized_at IS NOT NULL AS marked FROM consent_events WHERE scope = 'companion_ai'`)).rows;
    eq(rows.every((r) => r.marked), true, 'отметка:');
    const pseudo = rows[0].child_id;
    await denied(admin(`UPDATE consent_events SET child_id = gen_random_uuid() WHERE child_id = $1`, [pseudo]));
    await denied(admin(`UPDATE consent_events SET child_pseudonymized_at = NULL WHERE child_id = $1`, [pseudo]));
  });
});

// ---------------------------------------------------------------------------
await group('служебные колонки клиент не пишет', async (db) => {
  const { as, makeChild } = await setup(db);
  const kid = await makeChild();

  await check('дату записи прохождения из будущего не подставить', async () => {
    await denied(as(A, `INSERT INTO lesson_runs (child_id, lesson_id, started_at, created_at) VALUES ($1, 'l', now() + interval '2 years', now() + interval '2 years')`, [kid]));
    await denied(as(A, `INSERT INTO lesson_runs (child_id, lesson_id, started_at, created_at) VALUES ($1, 'l', now(), now() + interval '2 years')`, [kid]));
  });

  await check('время изменения навыка ставит сервер', async () => {
    await denied(as(A, `INSERT INTO skill_state (child_id, skill, box, updated_at) VALUES ($1, 's', 1, now() + interval '1 year')`, [kid]));
    await as(A, `INSERT INTO skill_state (child_id, skill, box) VALUES ($1, 's', 1)`, [kid]);
    await denied(as(A, `UPDATE skill_state SET updated_at = now() + interval '1 year'`));
    await as(A, `UPDATE skill_state SET box = 2`);
    eq((await as(A, `SELECT box, updated_at <= now() AS sane FROM skill_state`)).rows, [{ box: 2, sane: true }]);
  });
});

// ---------------------------------------------------------------------------
await group('проверка согласия для сервера', async (db) => {
  const { as, makeChild } = await setup(db);
  const kid = await makeChild();

  await check('consent_active — только для service_role', async () => {
    await denied(as(A, `SELECT public.consent_active($1, 'cloud_sync')`, [kid]));
    await denied(as(null, `SELECT public.consent_active($1, 'cloud_sync')`, [kid]));
    await db.exec(`SET ROLE service_role`);
    try {
      eq((await db.query(`SELECT public.consent_active($1, 'cloud_sync') AS ok`, [kid])).rows[0].ok, true);
      eq((await db.query(`SELECT public.consent_active($1, 'companion_ai') AS ok`, [kid])).rows[0].ok, false);
    } finally {
      await db.exec(`RESET ROLE`);
    }
  });

  await check('версия текста с хешем: без хеша и языка текст не публикуется', async () => {
    await denied(db.query(`INSERT INTO consent_texts (scope, version, is_current) VALUES ('telemetry', 'x', false)`));
    await denied(db.query(`INSERT INTO consent_texts (scope, version, locale, body_sha256) VALUES ('telemetry', 'x', 'ru', 'abc'::bytea)`));
  });

  await check('на каждый язык — своя действующая версия', async () => {
    await db.query(`INSERT INTO consent_texts (scope, version, locale, body_sha256, is_current) VALUES ('cloud_sync', 'ky-1', 'ky', sha256('ky'::bytea), true)`);
    await denied(db.query(`INSERT INTO consent_texts (scope, version, locale, body_sha256, is_current) VALUES ('cloud_sync', 'ru-2', 'ru', sha256('ru2'::bytea), true)`));
    const other = (await as(B, `SELECT public.create_child('Айбек', '7', 'ky-1', 'pin') AS id`)).rows[0].id;
    eq((await as(B, `SELECT public.has_consent($1, 'cloud_sync') AS ok`, [other])).rows[0].ok, true);
  });
});

// ---------------------------------------------------------------------------
await group('заявки: почта подтверждена, отказ виден как отказ', async (db) => {
  const { as, admin, makeChild, invite, redeem } = await setup(db);
  const kid = await makeChild();

  await check('с неподтверждённой почтой заявку не подать', async () => {
    await admin(`UPDATE auth.users SET email_confirmed_at = NULL WHERE id = $1`, [C]);
    eq(await redeem(C, await invite(kid)), 'email_unconfirmed');
  });

  await check('короткое имя ящика не раскрывается целиком', async () => {
    await admin(`UPDATE auth.users SET email = 'bo@mail.kg' WHERE id = $1`, [B]);
    eq(await redeem(B, await invite(kid)), 'pending_approval');
    eq((await as(A, `SELECT email_hint FROM public.pending_requests($1)`, [kid])).rows, [{ email_hint: 'b***@mail.kg' }]);
  });

  await check('владелец отклонил заявку — в журнале «rejected»', async () => {
    await as(A, `DELETE FROM child_guardians WHERE user_id = $1`, [B]);
    eq((await as(A, `SELECT event FROM child_access_log WHERE user_id = $1 ORDER BY id DESC LIMIT 1`, [B])).rows, [
      { event: 'rejected' },
    ]);
  });
});

// ---------------------------------------------------------------------------
await group('передача туда-обратно срок не продлевает', async (db) => {
  const { as, admin, makeChild, link } = await setup(db);
  const kid = await makeChild();
  await link(kid, B);

  await check('повторная передача в течение 30 дней не сбрасывает неделю', async () => {
    await as(A, `SELECT public.transfer_child_ownership($1, $2)`, [kid, B]);
    await admin(`UPDATE children SET consent_grace_until = now() + interval '1 day' WHERE id = $1`, [kid]);
    await as(B, `SELECT public.transfer_child_ownership($1, $2)`, [kid, A]);
    await as(A, `SELECT public.transfer_child_ownership($1, $2)`, [kid, B]);
    const left = (await admin(`SELECT consent_grace_until < now() + interval '2 days' AS short FROM children WHERE id = $1`, [kid])).rows[0];
    eq(left, { short: true });
  });
});

// ---------------------------------------------------------------------------
await group('срок хранения только у записей удалённых', async (db) => {
  const { as, admin, makeChild } = await setup(db);
  const kid = await makeChild();
  await as(A, `INSERT INTO consent_events (scope, action, child_id, text_version, confirmed_by, client_at) VALUES ('companion_ai', 'grant', $1, 'ru-v1', 'pin', now())`, [kid]);
  await as(A, `INSERT INTO consent_events (scope, action, child_id, text_version, confirmed_by, client_at) VALUES ('companion_ai', 'revoke', $1, 'ru-v1', 'pin', now())`, [kid]);

  await check('на отзыв живого ребёнка срок не поставить — даже в обход RLS', async () => {
    await denied(admin(`UPDATE consent_events SET retain_until = now() + interval '3 years' WHERE action = 'revoke' AND child_id = $1`, [kid]));
    await denied(admin(`UPDATE child_access_log SET retain_until = now() + interval '3 years' WHERE child_id = $1`, [kid]));
  });

  await check('на согласие аккаунта живого взрослого срок не поставить', async () => {
    await as(A, `INSERT INTO consent_events (scope, action, text_version, confirmed_by, client_at) VALUES ('account_local', 'grant', 'ru-v1', 'signup', now())`);
    await denied(admin(`UPDATE consent_events SET retain_until = now() + interval '3 years' WHERE scope = 'account_local'`));
  });

  await check('после удаления ребёнка срок ставится сам', async () => {
    await as(A, `DELETE FROM children WHERE id = $1`, [kid]);
    const rows = (await admin(`SELECT retain_until IS NOT NULL AS kept FROM consent_events WHERE scope = 'companion_ai'`)).rows;
    eq(rows, [{ kept: true }, { kept: true }]);
  });
});

// ---------------------------------------------------------------------------
await group('синхронизация из клиента, как её шлёт PostgREST', async (db) => {
  const { as, makeChild, count } = await setup(db);
  const kid = await makeChild();
  const other = await makeChild(C, 'Чужой');
  // upsert с merge-duplicates: SET по всем колонкам из запроса, включая ключ
  const upsert = (user, child, box) =>
    as(user, `INSERT INTO skill_state (child_id, skill, box, attempts, correct) VALUES ($1, 'count-5', $2, 3, 1)
              ON CONFLICT (child_id, skill) DO UPDATE SET child_id = EXCLUDED.child_id, skill = EXCLUDED.skill,
                box = EXCLUDED.box, attempts = EXCLUDED.attempts, correct = EXCLUDED.correct`, [child, box]);

  await check('upsert навыка работает: вставка, затем обновление', async () => {
    await upsert(A, kid, 1);
    await upsert(A, kid, 3);
    eq((await as(A, `SELECT box FROM skill_state WHERE child_id = $1`, [kid])).rows, [{ box: 3 }]);
  });

  await check('право на ключевые колонки не переносит строку на чужого ребёнка', async () => {
    await denied(as(A, `UPDATE skill_state SET child_id = $1 WHERE child_id = $2`, [other, kid]));
    eq(await count(A, `skill_state WHERE child_id = '${kid}'`), 1);
  });

  await check('повтор прохождения из офлайна — ignore-duplicates без права на UPDATE', async () => {
    const id = '00000000-0000-4000-8000-00000000abcd';
    const send = () =>
      as(A, `INSERT INTO lesson_runs (id, child_id, lesson_id, started_at) VALUES ($1, $2, 'l', now()) ON CONFLICT (id) DO NOTHING`, [id, kid]);
    await send();
    await send();
    eq(await count(A, 'lesson_runs'), 1);
  });
});

// ---------------------------------------------------------------------------
await group('версия текста согласия с языком', async (db) => {
  await setup(db);

  await check('версия без префикса языка не публикуется', async () => {
    await denied(db.query(`INSERT INTO consent_texts (scope, version, locale, body_sha256) VALUES ('telemetry', 'v9', 'ru', sha256('x'::bytea))`));
    await denied(db.query(`INSERT INTO consent_texts (scope, version, locale, body_sha256) VALUES ('telemetry', 'en-9', 'ru', sha256('x'::bytea))`));
    await db.query(`INSERT INTO consent_texts (scope, version, locale, body_sha256) VALUES ('telemetry', 'en-9', 'en', sha256('x'::bytea))`);
  });
});

finish();
