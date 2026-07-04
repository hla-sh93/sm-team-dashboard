/**
 * Replace a production Postgres database with a previously exported local
 * snapshot. This is intentionally destructive for app-owned tables so Vercel
 * becomes an exact copy of local data.
 *
 * Usage:
 *   prisma generate --schema=prisma/schema.postgres.prisma
 *   tsx scripts/import-snapshot-to-postgres.ts backups/local-db-snapshot.json --confirm
 */
import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { loadIsolatedPrismaClient } from "./isolated-prisma-client";

// Setting key that records which snapshot has already been imported, so leaving
// IMPORT_LOCAL_SNAPSHOT=1 on the build permanently is SAFE: each unique local
// export imports exactly once. Re-syncing prod later = re-export locally and
// commit the new snapshot (its hash changes → one fresh import on next deploy).
const IMPORTED_MARKER_KEY = "snapshotImported";
// Exit code the build wrapper reads to decide whether to still run the normal
// (non-destructive) seed afterwards.
const EXIT_SKIPPED = 3;

type JsonRow = Record<string, unknown>;
type Snapshot = {
  employees: JsonRow[];
  companies: JsonRow[];
  tasks: JsonRow[];
  photoSessions: JsonRow[];
  settings: JsonRow[];
};

const args = process.argv.slice(2);
const snapshotArg = args.find((a) => !a.startsWith("--")) ?? "backups/local-db-snapshot.json";
const snapshotPath = resolve(snapshotArg);
const confirmed = args.includes("--confirm");
const envFileArg =
  args.find((a) => a.startsWith("--env-file="))?.split("=", 2)[1] ??
  (args.includes("--env-file") ? args[args.indexOf("--env-file") + 1] : undefined);

function loadEnvFile(path: string) {
  const fullPath = resolve(path);
  if (!existsSync(fullPath)) throw new Error(`Env file not found: ${fullPath}`);
  const lines = readFileSync(fullPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    const raw = rest.join("=").trim();
    const value = raw.replace(/^['"]|['"]$/g, "");
    if (value) process.env[key.trim()] = value;
  }
}

if (envFileArg) loadEnvFile(envFileArg);

const databaseUrl =
  [
    process.env.DATABASE_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL,
    process.env.DATABASE_URL_UNPOOLED,
    process.env.POSTGRES_URL_NON_POOLING,
  ].find((value) => value && /^postgres(ql)?:\/\//.test(value)) ?? process.env.DATABASE_URL ?? "";
process.env.DATABASE_URL = databaseUrl;
if (!confirmed) {
  throw new Error("Refusing to import without --confirm because this replaces production data.");
}
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set. Point it at the Vercel Postgres database first.");
}
if (databaseUrl.startsWith("file:")) {
  throw new Error("DATABASE_URL points at SQLite. Refusing to overwrite the local database.");
}
if (!/^postgres(ql)?:\/\//.test(databaseUrl)) {
  throw new Error("DATABASE_URL must be a Postgres connection string.");
}
if (!existsSync(snapshotPath)) {
  throw new Error(`Snapshot not found: ${snapshotPath}`);
}

const dateFields = {
  employees: ["createdAt", "updatedAt"],
  companies: ["contractStartDate", "createdAt", "updatedAt"],
  tasks: [
    "publishDate",
    "readyDate",
    "workDate",
    "completedAt",
    "startedAt",
    "finishedAt",
    "createdAt",
    "updatedAt",
  ],
  photoSessions: ["shootDate", "deliverBy", "createdAt", "updatedAt"],
  settings: ["updatedAt"],
} as const;

function requireRows(value: unknown, key: keyof Snapshot): JsonRow[] {
  if (!Array.isArray(value)) throw new Error(`Snapshot is missing array: ${key}`);
  return value as JsonRow[];
}

function withDates(rows: JsonRow[], fields: readonly string[]) {
  return rows.map((row) => {
    const next = { ...row };
    for (const field of fields) {
      if (typeof next[field] === "string") next[field] = new Date(next[field] as string);
    }
    return next;
  });
}

async function createManyInChunks<T extends JsonRow>(
  createMany: (args: { data: T[] }) => Promise<{ count: number }>,
  rows: T[],
  size = 200,
) {
  let count = 0;
  for (let i = 0; i < rows.length; i += size) {
    const result = await createMany({ data: rows.slice(i, i + size) });
    count += result.count;
  }
  return count;
}

async function main() {
  const { PrismaClient } = await loadIsolatedPrismaClient(
    "prisma/schema.postgres.prisma",
    "prisma/.snapshot-postgres.prisma",
    "../.generated/prisma-postgres-client",
  );
  const prisma = new PrismaClient();

  const rawSnapshot = readFileSync(snapshotPath, "utf8");
  const snapshotHash = createHash("sha1").update(rawSnapshot).digest("hex");

  // Already imported this exact snapshot? Then prod already matches this local
  // export — skip the destructive replace and let the caller run the normal
  // seed instead. This is what makes the build flag safe to keep on forever.
  const alreadyImported = await prisma.setting
    .findUnique({ where: { key: IMPORTED_MARKER_KEY } })
    .catch(() => null);
  if (alreadyImported?.value === snapshotHash) {
    console.log(
      `↩︎ snapshot ${snapshotHash.slice(0, 12)} already imported — prod already matches this local export; skipping replace.`,
    );
    await prisma.$disconnect();
    process.exit(EXIT_SKIPPED);
  }

  const parsed = JSON.parse(rawSnapshot) as Partial<Snapshot>;
  const snapshot = {
    employees: withDates(requireRows(parsed.employees, "employees"), dateFields.employees),
    companies: withDates(requireRows(parsed.companies, "companies"), dateFields.companies),
    tasks: withDates(requireRows(parsed.tasks, "tasks"), dateFields.tasks),
    photoSessions: withDates(
      requireRows(parsed.photoSessions, "photoSessions"),
      dateFields.photoSessions,
    ),
    settings: withDates(requireRows(parsed.settings, "settings"), dateFields.settings),
  };

  // Auth config (admin password + session secret) lives in Setting but must
  // NOT be lost when a snapshot without it replaces prod — otherwise a re-sync
  // would silently reset the admin login. Capture prod's values first; restore
  // any key the incoming snapshot doesn't already carry.
  const AUTH_KEYS = ["authSecret", "adminPasswordHash", "adminEmail"];
  const preservedAuth = await prisma.setting
    .findMany({ where: { key: { in: AUTH_KEYS } } })
    .catch(() => [] as { key: string; value: string }[]);
  const snapshotKeys = new Set(snapshot.settings.map((s) => s.key as string));

  const imported = await prisma.$transaction(
    async (tx: any) => {
      await tx.task.deleteMany();
      await tx.photoSession.deleteMany();
      await tx.company.deleteMany();
      await tx.employee.deleteMany();
      await tx.setting.deleteMany();

      const employees = await createManyInChunks((args) => tx.employee.createMany(args as any), snapshot.employees);
      const companies = await createManyInChunks((args) => tx.company.createMany(args as any), snapshot.companies);
      const tasks = await createManyInChunks((args) => tx.task.createMany(args as any), snapshot.tasks);
      const photoSessions = await createManyInChunks(
        (args) => tx.photoSession.createMany(args as any),
        snapshot.photoSessions,
      );
      const settings = await createManyInChunks((args) => tx.setting.createMany(args as any), snapshot.settings);

      return { employees, companies, tasks, photoSessions, settings };
    },
    { maxWait: 30000, timeout: 120000 },
  );

  // Restore preserved auth settings the snapshot didn't provide (keeps the
  // production admin login working across a re-sync from a local export).
  for (const row of preservedAuth) {
    if (snapshotKeys.has(row.key)) continue;
    await prisma.setting.upsert({
      where: { key: row.key },
      update: { value: row.value },
      create: { key: row.key, value: row.value },
    });
  }

  // Record the imported snapshot's hash AFTER the replace (the transaction wiped
  // settings and reloaded the snapshot's own rows; this marker is added on top),
  // so the next deploy with the same snapshot skips the destructive import.
  await prisma.setting.upsert({
    where: { key: IMPORTED_MARKER_KEY },
    update: { value: snapshotHash },
    create: { key: IMPORTED_MARKER_KEY, value: snapshotHash },
  });

  const counts = {
    employees: await prisma.employee.count(),
    companies: await prisma.company.count(),
    tasks: await prisma.task.count(),
    photoSessions: await prisma.photoSession.count(),
    settings: await prisma.setting.count(),
  };

  console.log(`✓ imported snapshot into Postgres: ${snapshotPath}`);
  console.log(JSON.stringify({ imported, counts }, null, 2));

  await prisma.$disconnect();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
