import { reportError } from "@/lib/reportError";
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

/** Сколько секунд после подтверждения кодом из письма можно удалить аккаунт. */
export const FRESH_OTP_SECONDS = 5 * 60;

/** Больше детей на аккаунт база не допускает. */
const MAX_CHILDREN = 10;

const ChildDecisionSchema = z.discriminatedUnion("action", [
  z.object({ childId: z.uuid(), action: z.literal("delete") }),
  z.object({ childId: z.uuid(), action: z.literal("transfer"), newOwnerId: z.uuid() }),
]);

/**
 * Тело запроса. `user_id` в нём нет и быть не может: удаляется только владелец
 * JWT. `confirm` — защита от случайного вызова, а не от атаки: от атаки защищает
 * код из письма, подтверждённый за последние пять минут.
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
    } catch (e: unknown) {
      // без id ребёнка и нового владельца: в лог и Sentry — только класс ошибки (раунд 3, В-11)
      console.error("[account/delete] transfer failed", e instanceof Error ? e.name : "unknown");
      reportError("account/delete.transfer", e);
      return { ok: false, status: 409, error: "transfer failed; account was not deleted", transferred };
    }
  }

  try {
    await port.deleteUser(userId);
  } catch (e: unknown) {
    console.error("[account/delete] deleteUser failed", e instanceof Error ? e.name : "unknown");
    reportError("account/delete.deleteUser", e);
    return { ok: false, status: 502, error: "account deletion failed", transferred };
  }
  const deletedChildren = body.children.filter((d) => d.action === "delete").map((d) => d.childId);
  return { ok: true, transferred, deletedChildren };
}

/**
 * Когда пользователь в последний раз подтвердил вход кодом из письма — по claim
 * `amr` из JWT. Подпись уже проверил `auth.getUser`, здесь только чтение.
 *
 * Не `iat`: время выдачи токена обновляется при каждом обновлении сессии, а для
 * него не нужно ничего, кроме открытого приложения. `amr` хранит время настоящего
 * входа и при обновлении не меняется.
 */
export function emailOtpVerifiedAt(jwt: string): number | null {
  const payload = jwt.split(".")[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { amr?: unknown };
    if (!Array.isArray(json.amr)) return null;
    const times = json.amr
      .filter(
        (e): e is { method: string; timestamp: number } =>
          typeof e === "object" &&
          e !== null &&
          (e as { method?: unknown }).method === "otp" &&
          typeof (e as { timestamp?: unknown }).timestamp === "number",
      )
      .map((e) => e.timestamp);
    return times.length ? Math.max(...times) : null;
  } catch {
    return null;
  }
}

/**
 * Подтвердил ли пользователь удаление кодом из письма за последние пять минут.
 *
 * Код приходит на почту владельца аккаунта: ребёнок с разблокированным планшетом и
 * тот, кто унёс сессию, его не получат. Биометрии на устройстве для удаления мало —
 * она подтверждает устройство, а не взрослого.
 */
export function isRecentEmailOtp(verifiedAt: number | null, nowSeconds: number): boolean {
  if (verifiedAt === null) return false;
  return verifiedAt <= nowSeconds + 30 && nowSeconds - verifiedAt <= FRESH_OTP_SECONDS;
}
