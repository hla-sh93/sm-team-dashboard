import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The project keeps two Prisma schemas that MUST stay in sync at the model level:
 *   - prisma/schema.prisma          (SQLite — local dev)
 *   - prisma/schema.postgres.prisma (Postgres — production / Vercel build)
 * Only the datasource/generator blocks (and inline comments) may differ. This
 * test fails if a model/field/index drifts between the two so a change to one
 * schema isn't silently forgotten in the other.
 */

const read = (rel: string) =>
  readFileSync(resolve(__dirname, "..", rel), "utf8");

/** model name → set of normalized definition lines (comments + alignment stripped). */
function extractModels(src: string): Map<string, string[]> {
  // Drop // line comments so doc differences between the files don't count.
  const noComments = src.replace(/\/\/.*$/gm, "");
  const models = new Map<string, string[]>();
  const re = /model\s+(\w+)\s*\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(noComments)) !== null) {
    const [, name, body] = m;
    const lines = body
      .split("\n")
      .map((l) => l.trim().replace(/\s+/g, " ")) // collapse alignment whitespace
      .filter((l) => l.length > 0)
      .sort(); // field order is irrelevant to the schema
    models.set(name, lines);
  }
  return models;
}

describe("prisma schema sync (sqlite ↔ postgres)", () => {
  const sqlite = extractModels(read("prisma/schema.prisma"));
  const postgres = extractModels(read("prisma/schema.postgres.prisma"));

  it("defines the same set of models in both schemas", () => {
    expect([...postgres.keys()].sort()).toEqual([...sqlite.keys()].sort());
  });

  it("has at least the core models", () => {
    for (const name of ["Employee", "Company", "Task", "PhotoSession", "Setting"]) {
      expect(sqlite.has(name)).toBe(true);
    }
  });

  for (const name of ["Employee", "Company", "Task", "PhotoSession", "Setting"]) {
    it(`model ${name} is identical in both schemas`, () => {
      expect(postgres.get(name)).toEqual(sqlite.get(name));
    });
  }
});
