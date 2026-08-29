import { describe, expect, it } from "vitest";
import { assertIsolatedTestDatabaseUrl } from "./_helpers/test-database";

describe("isolated test database guard", () => {
  it("accepts disposable SQLite database names", () => {
    expect(() =>
      assertIsolatedTestDatabaseUrl("file:C:/workspace/prisma/test-operations-123.db"),
    ).not.toThrow();
    expect(() =>
      assertIsolatedTestDatabaseUrl("file:C:/workspace/prisma/.telegram-e2e.db"),
    ).not.toThrow();
  });

  it("refuses the normal development SQLite database", () => {
    expect(() =>
      assertIsolatedTestDatabaseUrl("file:C:/workspace/prisma/dev.db"),
    ).toThrow(/isolated test database/i);
  });

  it("accepts an explicitly named PostgreSQL test database or schema", () => {
    expect(() =>
      assertIsolatedTestDatabaseUrl("postgresql://user:secret@localhost/app_test"),
    ).not.toThrow();
    expect(() =>
      assertIsolatedTestDatabaseUrl("postgresql://user:secret@localhost/app?schema=qa_test"),
    ).not.toThrow();
  });

  it("refuses production-looking PostgreSQL targets and missing URLs", () => {
    expect(() =>
      assertIsolatedTestDatabaseUrl("postgresql://user:secret@db.example/app"),
    ).toThrow(/isolated test database/i);
    expect(() => assertIsolatedTestDatabaseUrl(undefined)).toThrow(/isolated test database/i);
  });
});

