import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("repository safety gates", () => {
  it("keeps the production build free of schema and application-data mutations", () => {
    const pkg = JSON.parse(readFileSync(resolve("package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    const build = pkg.scripts.build ?? "";

    expect(build).toMatch(/next build/);
    expect(build).not.toMatch(/prisma\s+db\s+(push|seed|execute)|--accept-data-loss/i);
    expect(build).not.toMatch(/seed|import|repair|fix-|apply-|reconcile|rebalance|rematch/i);
  });

  it("defines baseline browser security headers", () => {
    const config = readFileSync(resolve("next.config.js"), "utf8");

    expect(config).toContain("X-Content-Type-Options");
    expect(config).toContain("X-Frame-Options");
    expect(config).toContain("Referrer-Policy");
    expect(config).toContain("Permissions-Policy");
    expect(config).toContain("Strict-Transport-Security");
  });
});
