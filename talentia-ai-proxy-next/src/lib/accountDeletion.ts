import { z } from "zod";

/**
 * Удаление аккаунта взрослого. Спецификация — PARENT.md, «Удаление и экспорт» и
 * «Решения после проверки схемы».
 *
 * Логика отделена от роута и от Supabase: всё, что ходит в базу, приходит через
 * `AccountDeletionPort`, поэтому правила проверяются тестом без живого проекта.
 *
 * Что делает база сама, триггерами, — и потому здесь не повторяется: непереданные
 * дети удаляются вместе со строкой владельца, идентификаторы в журналах согласий и
 * доступа заменяются псевдонимами, согласия получают срок хранения.
 */

/** Сколько секунд после выдачи токена он годится для удаления: окно свежести гейта. */
export const FRESH_TOKEN_SECONDS = 5 * 60;

/** Больше детей на аккаунт база не допускает. */
const MAX_CHILDREN = 10;

const ChildDecisionSchema = z.discriminatedUnion("action", [
  z.object({ childId: z.uuid(), action: z.literal("delete") }),
  z.object({ childId: z.uuid(), action: z.literal("transfer"), newOwnerId: z.uuid() }),
]);

/**
 * Тело запроса. `user_id` в нём нет и быть не может: удаляется только владелец
 * JWT. `confirm` — защита от случайного вызова, а не от атаки: от атаки защищают
 * свежий токен и гейт в приложении.
 */
export const AccountDeletionBodySchema = z
  .object({
    confirm: z.literal("DELETE_MY_ACCOUNT"),
    children: z.array(ChildDecisionSchema).max(MAX_CHILDREN),
  })
  .strict();

export type AccountDeletionBody = z.infer<typeof AccountDeletionBodySchema>;
export type ChildDecision = z.infer<typeof ChildDecisionSchema>;

/** Доступ к базе. Первые два метода — от имени пользователя, `deleteUser` — service-role. */
export interface AccountDeletionPort {
  /** Дети, где пользователь — владелец. Читается под его JWT, через RLS. */
  ownedChildren(): Promise<string[]>;
  /** `transfer_child_ownership` под JWT пользователя: право проверяет база. */
  transfer(childId: string, newOwnerId: string): Promise<void>;
  /** Жёсткое удаление: на мягкое триггеры не срабатывают, и данные остаются. */
  deleteUser(userId: string): Promise<void>;
}

export type DeletionResult =
  | { ok: true; transferred: string[]; deletedChildren: string[] }
  | { ok: false; status: 400 | 409 | 502; error: string; transferred?: string[] };

/**
 * Решение по каждому ребёнку обязательно и ровно одно. Молчаливое «удалить всех,
 * про кого не сказали» — ровно та ошибка, которую выбор и должен исключить: удалить
 * ребёнка, которого собирались передать.
 */
export function checkDecisions(owned: readonly string[], decisions: readonly ChildDecision[]): string | null {
  const seen = new Set<string>();
  for (const d of decisions) {
    if (seen.has(d.childId)) return "duplicate decision";
    seen.add(d.childId);
    if (!owned.includes(d.childId)) return "decision for a child you do not own";
  }
  const missing = owned.filter((id) => !seen.has(id));
  if (missing.length) return "every owned child needs a decision";
  return null;
}

/**
 * Удалить аккаунт.
 *
 * Сначала передачи, затем удаление. Если передача не удалась, аккаунт не
 * удаляется: иначе ребёнок, которого собирались передать, ушёл бы вместе с
 * аккаунтом. Уже выполненные передачи остаются — каждую родитель выбрал сам.
 */
export async function deleteAccount(
  userId: string,
  body: AccountDeletionBody,
  port: AccountDeletionPort,
): Promise<DeletionResult> {
  const owned = await port.ownedChildren();
  const problem = checkDecisions(owned, body.children);
  if (problem) return { ok: false, status: 409, error: problem };

  const transferred: string[] = [];
  for (const d of body.children) {
    if (d.action !== "transfer") continue;
    try {
      await port.transfer(d.childId, d.newOwnerId);
      transferred.push(d.childId);
    } catch {
      return { ok: false, status: 409, error: "transfer failed; account was not deleted", transferred };
    }
  }

  try {
    await port.deleteUser(userId);
  } catch {
    return { ok: false, status: 502, error: "account deletion failed", transferred };
  }
  const deletedChildren = body.children.filter((d) => d.action === "delete").map((d) => d.childId);
  return { ok: true, transferred, deletedChildren };
}

/**
 * Время выдачи токена. Подпись уже проверил `auth.getUser` — здесь только чтение
 * поля `iat` из тела JWT.
 */
export function tokenIssuedAt(jwt: string): number | null {
  const payload = jwt.split(".")[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { iat?: unknown };
    return typeof json.iat === "number" ? json.iat : null;
  } catch {
    return null;
  }
}

/**
 * Свежий ли токен. Гейт уровня 2 в приложении обновляет сессию сразу после
 * подтверждения биометрией или PIN; токен старше пяти минут значит, что
 * подтверждения не было — или телефон с открытой сессией взял кто-то другой.
 */
export function isFreshToken(iat: number | null, nowSeconds: number): boolean {
  if (iat === null) return false;
  return iat <= nowSeconds + 30 && nowSeconds - iat <= FRESH_TOKEN_SECONDS;
}
