/**
 * Child-safety post-filter for Tali replies.
 * Prompt guardrails are necessary but not sufficient — refuse unsafe model output
 * and let the client fall back to offline safe copy when we return a filtered flag.
 */

const BLOCK_PATTERNS: RegExp[] = [
  /\b(kill|murder|suicide|self[-\s]?harm)\b/i,
  /\b(sex|porn|nude|naked)\b/i,
  /\b(drug|cocaine|heroin|meth)\b/i,
  /\b(weapon|gun|bomb|terror)\b/i,
  /\b(hate\s*speech|nazi|racist)\b/i,
  /(уби[йь]|убийств|суицид|самоубий)/i,
  /(секс|порно|голы[йе])/i,
  /(наркотик|кокаин|героин)/i,
  /(оружие|бомб|террор)/i,
];

export type TaliFilterResult =
  | { ok: true; reply: string }
  | { ok: false; reason: "blocked" | "empty" };

export function filterTaliReply(raw: string | null | undefined): TaliFilterResult {
  const reply = (raw ?? "").trim();
  if (!reply) return { ok: false, reason: "empty" };
  for (const re of BLOCK_PATTERNS) {
    if (re.test(reply)) return { ok: false, reason: "blocked" };
  }
  return { ok: true, reply };
}

/** Safe short fallbacks when the model output is filtered (language-aware). */
export function taliSafeFallback(language: string): string {
  if (language === "en") {
    return "Let's stay on our lesson — try the next small step together!";
  }
  if (language === "ky") {
    return "Сабакка кайталы — кичине бир кадам менен аракет кылалы!";
  }
  return "Давай вернёмся к уроку — сделаем ещё один маленький шаг вместе!";
}
