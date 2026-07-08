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

  const [employees, companies, tasks, photoSessions, allSettings] = await Promise.all([
    prisma.employee.findMany({ orderBy: { id: "asc" } }),
    prisma.company.findMany({ orderBy: { id: "asc" } }),
    prisma.task.findMany({ orderBy: { id: "asc" } }),
    prisma.photoSession.findMany({ orderBy: { id: "asc" } }),
    prisma.setting.findMany({ orderBy: { key: "asc" } }),
  ]);

  // NEVER ship the LOCAL admin credentials/signing secret: the prod import
  // wipes Setting and reloads the snapshot's rows, so exporting these would
  // silently replace the PRODUCTION admin password with the local one. The
  // import script explicitly preserves prod's own auth keys whenever the
  // snapshot doesn't carry them — so we omit them here.
  const AUTH_KEYS = new Set(["authSecret", "adminPasswordHash", "adminEmail"]);
  const settings = allSettings.filter((s) => !AUTH_KEYS.has(s.key));

  // Timezone normalisation: schedule dates are stored at LOCAL midnight (e.g.
  // 2026-07-04 on a GMT+3 machine → 2026-07-03T21:00Z). Read back on Vercel's
  // UTC runtime after the import, that becomes July 3 — the whole calendar
  // shifts a day and on-time work can flip to "late". So we snap every CALENDAR
  // date to UTC-midnight of its local day here, making the snapshot read the
  // same on any timezone. (Timestamps like createdAt/startedAt are left as-is.)
  const snapDay = (v: unknown) =>
    v instanceof Date ? new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate())) : v;
  const snapFields = <T extends Record<string, any>>(rows: T[], fields: string[]): T[] =>
    rows.map((r) => {
      const next: any = { ...r };
      for (const f of fields) if (next[f] != null) next[f] = snapDay(next[f]);
      return next;
    });

  const snapshot = {
    meta: {
      exportedAt: new Date().toISOString(),
      source: "local-sqlite",
      schema: "social-media-team-dashboard/v1",
    },
    employees,
    companies: snapFields(companies, ["contractStartDate"]),
    tasks: snapFields(tasks, ["publishDate", "readyDate", "workDate"]),
    photoSessions: snapFields(photoSessions, ["shootDate", "deliverBy"]),
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
