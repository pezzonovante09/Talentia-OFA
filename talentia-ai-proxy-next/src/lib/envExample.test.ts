import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Страж: `.env.example` описывает ровно те переменные, которые читает код. Ловит и забытую
 * переменную (код читает, а владелец о ней не знает), и мусор удалённого приложения (в файле
 * есть, а код не читает).
 */

const ROOT = path.resolve(__dirname, "../..");
const SRC = path.join(ROOT, "src");
/** Служебные, задаёт платформа — в примере им не место. */
const PLATFORM = new Set(["NODE_ENV", "VERCEL_ENV", "NEXT_RUNTIME"]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

/** Имена, которые код читает: `process.env.X` и обёртки `env("X")`, `envInt("X")`, `configured("A", "B")`, `apiKeyEnv: "X"`. */
function readByCode(): Set<string> {
  const files = [...sourceFiles(SRC), path.join(ROOT, "next.config.ts")];
  const names = new Set<string>();
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) names.add(m[1]);
    // `aiEnabled(env = process.env)` читает через параметр `env.X`
    for (const m of text.matchAll(/\benv\.([A-Z][A-Z0-9_]*)/g)) names.add(m[1]);
    for (const m of text.matchAll(/process\.env\["([A-Z][A-Z0-9_]*)"\]/g)) names.add(m[1]);
    for (const m of text.matchAll(/\b(?:env|envFloat|envInt)\(\s*"([A-Z][A-Z0-9_]*)"/g)) names.add(m[1]);
    for (const m of text.matchAll(/\bconfigured\(([^)]*)\)/g)) {
      for (const n of m[1].matchAll(/"([A-Z][A-Z0-9_]*)"/g)) names.add(n[1]);
    }
    for (const m of text.matchAll(/apiKeyEnv:\s*"([A-Z][A-Z0-9_]*)"/g)) names.add(m[1]);
  }
  for (const n of PLATFORM) names.delete(n);
  return names;
}

function declaredInExample(): Set<string> {
  const text = readFileSync(path.join(ROOT, ".env.example"), "utf8");
  const names = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const m = /^([A-Z][A-Z0-9_]*)=/.exec(line);
    if (m) names.add(m[1]);
  }
  return names;
}

describe(".env.example", () => {
  it("анализ видит переменные (страж не пустой)", () => {
    const read = readByCode();
    expect(read.size).toBeGreaterThan(10);
    for (const must of ["SUPABASE_URL", "ELEVENLABS_VOICE_ID_KY", "TALI_DAILY_REQUESTS_PER_USER", "TALI_AI_ENABLED", "SENTRY_ORG"]) {
      expect(read.has(must), must).toBe(true);
    }
  });

  it("каждая переменная, которую читает код, описана в .env.example", () => {
    const declared = declaredInExample();
    const missing = [...readByCode()].filter((n) => !declared.has(n));
    expect(missing).toEqual([]);
  });

  it("каждая переменная из .env.example где-то читается кодом (нет мусора)", () => {
    const read = readByCode();
    const stale = [...declaredInExample()].filter((n) => !read.has(n));
    expect(stale).toEqual([]);
  });

  it("служебные переменные платформы в примере не описаны", () => {
    const declared = declaredInExample();
    for (const n of PLATFORM) expect(declared.has(n), n).toBe(false);
  });
});
