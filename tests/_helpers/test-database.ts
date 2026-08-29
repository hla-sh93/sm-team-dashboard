/**
 * Fail closed before a test creates a database client that can write.
 *
 * A URL is considered isolated only when its SQLite filename or PostgreSQL
 * database/schema contains an explicit `test` or `e2e` marker. Never include
 * the raw URL in an error: it may contain credentials.
 */
export function assertIsolatedTestDatabaseUrl(raw: string | undefined): string {
  const value = raw?.trim().replace(/^["']|["']$/g, "") ?? "";
  const refuse = () => {
    throw new Error(
      "Refusing database write: DATABASE_URL does not identify an isolated test database",
    );
  };
  if (!value) return refuse();

  const marker = /(?:^|[._-])(test|e2e)(?:[._-]|$)/i;
  if (value.startsWith("file:")) {
    let filename: string;
    try {
      const normalized = value.slice("file:".length).replace(/\\/g, "/");
      filename = decodeURIComponent(normalized.split("/").pop() ?? "");
    } catch {
      return refuse();
    }
    if (!marker.test(filename)) return refuse();
    return value;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return refuse();
  }
  if (!/^postgres(ql)?:$/.test(url.protocol)) return refuse();

  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  const schema = url.searchParams.get("schema") ?? "";
  if (!marker.test(database) && !marker.test(schema)) return refuse();
  return value;
}

