/**
 * RLS и функции доступа для детей, родителей и согласий
 * (migrations/20260924120000_children_and_guardians.sql, PARENT.md).
 *
 * Запуск: npm test --prefix supabase
 */
import { actor, denied, eq, freshDb, runner } from './harness.mjs';

const db = await freshDb();
const as = actor(db);
const admin = (sql, params = []) => db.query(sql, params);
const { check, finish } = runner();

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const C = '00000000-0000-4000-8000-00000000000c';
const S = '00000000-0000-4000-8000-00000000000d';
await db.exec(`INSERT INTO auth.users VALUES ('${A}'), ('${B}'), ('${C}'), ('${S}')`);

// --- сценарии ---
let kid;
await check('владелец создаёт ребёнка функцией', async () => {
  kid = (await as(A, `SELECT public.create_child('Лиса', '5-6') AS id`)).rows[0].id;
  eq((await as(A, `SELECT role FROM child_guardians WHERE child_id = $1`, [kid])).rows, [{ role: 'owner' }]);
});

await check('посторонний не видит ребёнка', async () => {
  eq((await as(C, `SELECT id FROM children`)).rows.length, 0);
  eq((await as(C, `SELECT * FROM child_guardians`)).rows.length, 0);
});

await check('прямой INSERT в child_guardians закрыт — чужого ребёнка к себе не привязать', async () => {
  await denied(as(C, `INSERT INTO child_guardians (child_id, user_id, role) VALUES ($1, $2, 'owner')`, [kid, C]));
  await denied(as(C, `INSERT INTO child_guardians (child_id, user_id, role) VALUES ($1, $2, 'guardian')`, [kid, C]));
});

await check('прямой INSERT в children закрыт', async () => {
  await denied(as(A, `INSERT INTO children (band) VALUES ('7')`));
});

await check('анониму функции недоступны', async () => {
  await denied(as(null, `SELECT public.create_child('x', '7')`));
  await denied(as(null, `SELECT public.redeem_child_invite('AAAAAAAA')`));
});

await check('инвайт выдаёт только владелец', async () => {
  await denied(as(C, `SELECT public.create_child_invite($1)`, [kid]));
});

let code;
await check('код — 8 символов без I, O, 0, 1; хранится хеш', async () => {
  code = (await as(A, `SELECT public.create_child_invite($1) AS c`, [kid])).rows[0].c;
  if (!/^[ABCDEFGHJKLMNPQRSTUVWXYZ2-9]{8}$/.test(code)) throw new Error(`код ${code}`);
  const stored = (await admin(`SELECT encode(code_hash, 'escape') AS h FROM child_access_invites`)).rows;
  if (stored.some((r) => r.h.includes(code))) throw new Error('код лежит открытым текстом');
});

await check('таблица инвайтов недоступна напрямую даже владельцу', async () => {
  eq((await as(A, `SELECT * FROM child_access_invites`)).rows.length, 0);
});

await check('второй родитель входит по коду, в любом регистре', async () => {
  eq((await as(B, `SELECT public.redeem_child_invite($1) AS id`, [` ${code.toLowerCase()} `])).rows[0].id, kid);
  eq((await as(B, `SELECT role FROM child_guardians WHERE user_id = $1`, [B])).rows, [{ role: 'guardian' }]);
  eq((await as(B, `SELECT id FROM children`)).rows.length, 1);
});

await check('код одноразовый', async () => {
  await denied(as(C, `SELECT public.redeem_child_invite($1)`, [code]));
});

await check('просроченный код не работает', async () => {
  const c2 = (await as(A, `SELECT public.create_child_invite($1) AS c`, [kid])).rows[0].c;
  await admin(`UPDATE child_access_invites SET expires_at = now() - interval '1 minute' WHERE redeemed_at IS NULL`);
  await denied(as(C, `SELECT public.redeem_child_invite($1)`, [c2]));
});

await check('владелец видит всех, второй родитель — только себя', async () => {
  eq((await as(A, `SELECT count(*)::int AS n FROM child_guardians`)).rows[0].n, 2);
  eq((await as(B, `SELECT count(*)::int AS n FROM child_guardians`)).rows[0].n, 1);
});

await check('второй родитель не удаляет ребёнка и не выдаёт доступ', async () => {
  await as(B, `DELETE FROM children WHERE id = $1`, [kid]);
  eq((await admin(`SELECT count(*)::int AS n FROM children`)).rows[0].n, 1, 'ребёнок остался:');
  await denied(as(B, `SELECT public.create_child_invite($1)`, [kid]));
});

await check('роль и срок из клиента не меняются', async () => {
  await as(B, `UPDATE child_guardians SET role = 'owner' WHERE user_id = $1`, [B]);
  eq((await admin(`SELECT role FROM child_guardians WHERE user_id = $1`, [B])).rows, [{ role: 'guardian' }]);
});

await check('строку владельца не удалить никому', async () => {
  await as(A, `DELETE FROM child_guardians WHERE user_id = $1`, [A]);
  await as(B, `DELETE FROM child_guardians WHERE user_id = $1`, [A]);
  eq((await admin(`SELECT count(*)::int AS n FROM child_guardians WHERE role = 'owner'`)).rows[0].n, 1);
});

await check('навыки: родители пишут и читают, посторонний — нет', async () => {
  await as(B, `INSERT INTO skill_state (child_id, skill, box, attempts, correct) VALUES ($1, 'count-5', 2, 3, 1)`, [kid]);
  eq((await as(A, `SELECT box FROM skill_state`)).rows, [{ box: 2 }]);
  eq((await as(C, `SELECT * FROM skill_state`)).rows.length, 0);
  await denied(as(C, `INSERT INTO skill_state (child_id, skill, box) VALUES ($1, 'x', 1)`, [kid]));
});

await check('навыки: верных не больше попыток', async () => {
  await denied(as(A, `INSERT INTO skill_state (child_id, skill, box, attempts, correct) VALUES ($1, 'y', 1, 2, 3)`, [kid]));
});

await check('прохождения: родитель пишет, посторонний не видит', async () => {
  await as(A, `INSERT INTO lesson_runs (child_id, lesson_id, started_at, task_seconds) VALUES ($1, 'l1', now(), '{30,40}')`, [kid]);
  eq((await as(B, `SELECT count(*)::int AS n FROM lesson_runs`)).rows[0].n, 1);
  eq((await as(C, `SELECT count(*)::int AS n FROM lesson_runs`)).rows[0].n, 0);
});

await check('специалист в первой версии ничего не видит', async () => {
  await admin(`INSERT INTO child_guardians (child_id, user_id, role, expires_at) VALUES ($1, $2, 'specialist', now() + interval '90 days')`, [kid, S]);
  eq((await as(S, `SELECT count(*)::int AS n FROM skill_state`)).rows[0].n, 0);
  eq((await as(S, `SELECT count(*)::int AS n FROM children`)).rows[0].n, 0);
});

await check('специалист без срока невозможен', async () => {
  await denied(admin(`INSERT INTO child_guardians (child_id, user_id, role) VALUES ($1, $2, 'specialist')`, [kid, C]));
});

await check('второй владелец невозможен', async () => {
  await denied(admin(`INSERT INTO child_guardians (child_id, user_id, role) VALUES ($1, $2, 'owner')`, [kid, C]));
});

await check('истёкший доступ перестаёт действовать', async () => {
  await admin(`UPDATE child_guardians SET expires_at = now() - interval '1 second' WHERE user_id = $1`, [B]);
  eq((await as(B, `SELECT count(*)::int AS n FROM children`)).rows[0].n, 0);
  await admin(`UPDATE child_guardians SET expires_at = NULL WHERE user_id = $1`, [B]);
});

let consentId;
await check('согласия: запись и чтение', async () => {
  await as(A, `INSERT INTO consent_events (scope, action, text_version, confirmed_by, actor_id) VALUES ('account_local', 'grant', 'v1', 'signup', $1)`, [A]);
  consentId = (await as(A, `INSERT INTO consent_events (scope, action, child_id, text_version, confirmed_by, actor_id) VALUES ('cloud_sync', 'grant', $1, 'v1', 'biometric', $2) RETURNING id`, [kid, A])).rows[0].id;
  eq((await as(B, `SELECT scope FROM consent_events WHERE child_id = $1`, [kid])).rows, [{ scope: 'cloud_sync' }]);
  eq((await as(C, `SELECT count(*)::int AS n FROM consent_events`)).rows[0].n, 0);
});

await check('согласия не правятся и не удаляются', async () => {
  await as(A, `UPDATE consent_events SET action = 'revoke' WHERE id = $1`, [consentId]);
  await as(A, `DELETE FROM consent_events WHERE id = $1`, [consentId]);
  eq((await admin(`SELECT action FROM consent_events WHERE id = $1`, [consentId])).rows, [{ action: 'grant' }]);
});

await check('согласие от чужого имени и на чужого ребёнка не пишется', async () => {
  await denied(as(C, `INSERT INTO consent_events (scope, action, text_version, confirmed_by, actor_id) VALUES ('account_local', 'grant', 'v1', 'signup', $1)`, [A]));
  await denied(as(C, `INSERT INTO consent_events (scope, action, child_id, text_version, confirmed_by, actor_id) VALUES ('cloud_sync', 'grant', $1, 'v1', 'pin', $2)`, [kid, C]));
});

await check('правила согласия в схеме совпадают с клиентом', async () => {
  // согласие аккаунта с ребёнком
  await denied(as(A, `INSERT INTO consent_events (scope, action, child_id, text_version, confirmed_by, actor_id) VALUES ('account_local', 'grant', $1, 'v1', 'signup', $2)`, [kid, A]));
  // регистрацией подтверждено не согласие аккаунта
  await denied(as(A, `INSERT INTO consent_events (scope, action, child_id, text_version, confirmed_by, actor_id) VALUES ('cloud_sync', 'grant', $1, 'v1', 'signup', $2)`, [kid, A]));
  // пустая версия текста
  await denied(as(A, `INSERT INTO consent_events (scope, action, child_id, text_version, confirmed_by, actor_id) VALUES ('cloud_sync', 'grant', $1, '', 'pin', $2)`, [kid, A]));
});

await check('второй родитель может выйти сам', async () => {
  await as(B, `DELETE FROM child_guardians WHERE user_id = $1`, [B]);
  eq((await as(B, `SELECT count(*)::int AS n FROM children`)).rows[0].n, 0);
});

await check('удаление ребёнка владельцем уносит навыки и прохождения, журнал согласий остаётся', async () => {
  await as(A, `DELETE FROM children WHERE id = $1`, [kid]);
  const left = (await admin(`SELECT
      (SELECT count(*)::int FROM children) AS c,
      (SELECT count(*)::int FROM skill_state) AS s,
      (SELECT count(*)::int FROM lesson_runs) AS r,
      (SELECT count(*)::int FROM child_guardians) AS g,
      (SELECT count(*)::int FROM child_access_invites) AS i,
      (SELECT count(*)::int FROM consent_events) AS e`)).rows[0];
  eq(left, { c: 0, s: 0, r: 0, g: 0, i: 0, e: 2 });
});

finish();
