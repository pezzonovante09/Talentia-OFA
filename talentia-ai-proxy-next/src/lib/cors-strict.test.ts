import { afterEach, describe, expect, it, vi } from "vitest";

describe("buildCorsHeaders", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("echoes Origin only when listed in ALLOWED_CORS_ORIGINS", async () => {
    vi.stubEnv("ALLOWED_CORS_ORIGINS", "https://app.example.com,https://other.test");
    const { buildCorsHeaders } = await import("./cors-strict");
    const req = new Request("http://localhost/api/x", {
      headers: { origin: "https://app.example.com" },
    });
    const headers = buildCorsHeaders(req);
    expect(headers["Access-Control-Allow-Origin"]).toBe("https://app.example.com");
  });

  it("does not set ACAO for unknown origins (no wildcard)", async () => {
    vi.stubEnv("ALLOWED_CORS_ORIGINS", "https://app.example.com");
    const { buildCorsHeaders } = await import("./cors-strict");
    const req = new Request("http://localhost/api/x", {
      headers: { origin: "https://evil.example" },
    });
    const headers = buildCorsHeaders(req);
    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("omits ACAO when Origin is missing (native clients)", async () => {
    vi.stubEnv("ALLOWED_CORS_ORIGINS", "https://app.example.com");
    const { buildCorsHeaders } = await import("./cors-strict");
    const req = new Request("http://localhost/api/x");
    const headers = buildCorsHeaders(req);
    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });
});
