/**
 * Export the current local SQLite database to a JSON snapshot.
 *
 * This captures all app-owned tables, including finance fields
 * (company.contractValue, employee.salary/costPerReel) and task state
 * (completed and incomplete cards). Import this snapshot into production with:
 *   npm run db:import-prod
 */
import { mkdir, writeFile } from "fs/promises";
import { dirname, resolve } from "path";
import { loadIsolatedPrismaClient } from "./isolated-prisma-client";

const outputPath = resolve(process.argv[2] ?? "backups/local-db-snapshot.json");

async function main() {
  const { PrismaClient } = await loadIsolatedPrismaClient(
    "prisma/schema.prisma",
    "prisma/.snapshot-sqlite.prisma",
    "../.generated/prisma-sqlite-client",
  );
  const prisma = new PrismaClient();

  const [employees, companies, tasks, photoSessions, settings] = await Promise.all([
    prisma.employee.findMany({ orderBy: { id: "asc" } }),
    prisma.company.findMany({ orderBy: { id: "asc" } }),
    prisma.task.findMany({ orderBy: { id: "asc" } }),
    prisma.photoSession.findMany({ orderBy: { id: "asc" } }),
    prisma.setting.findMany({ orderBy: { key: "asc" } }),
  ]);

  const snapshot = {
    meta: {
      exportedAt: new Date().toISOString(),
      source: "local-sqlite",
      schema: "social-media-team-dashboard/v1",
    },
    employees,
    companies,
    tasks,
    photoSessions,
    settings,
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

  console.log(`✓ exported local DB snapshot: ${outputPath}`);
  console.log(
    JSON.stringify(
      {
        employees: employees.length,
        companies: companies.length,
        tasks: tasks.length,
        photoSessions: photoSessions.length,
        settings: settings.length,
      },
      null,
      2,
    ),
  );

  await prisma.$disconnect();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
