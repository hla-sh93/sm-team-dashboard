/**
 * مزامنة المحلي مع لقطة الإنتاج — «حتى يصيرو متوافقين» (القائدة ٢/٩/٢٠٢٦).
 *
 *   npm run backup:sync            # آخر لقطة إنتاج بمجلد backups
 *   npm run backup:sync -- backups/prod-20260902-1200.json
 *
 * الاتجاه معاكس لـ`import-snapshot-to-postgres.ts`: هون الإنتاج هو المصدر
 * والمحلي هو يلي بينكتب فوقه. فأول شي وقبل أي كتابة بتنؤخذ نسخة أمان مبصومة
 * من `prisma/dev.db` — وهاي **برّا تدوير الـ٣** وما بتنحذف تلقائياً أبداً،
 * لأنها الشبكة الأخيرة لو الاستيراد خرب المحلي.
 *
 * ⚠️ ما بتتلمس المنطقة الزمنية: اللحظة بتنمرّر كما هي. إعادة إسقاط التواريخ
 * بهالاتجاه بتزحّط اليوم يوم للورا (تاريخ مكتوب محلياً بيتخزّن 21:00Z لليوم
 * السابق).
 */
import { createHash } from "crypto";
import { copyFileSync, existsSync, readdirSync, readFileSync } from "fs";
import { resolve } from "path";
import { loadIsolatedPrismaClient } from "./isolated-prisma-client";
import { acceptSnapshot, actualCounts, type Snapshot } from "../src/lib/backup";

const BACKUP_DIR = resolve("backups");
const DEV_DB = resolve("prisma/dev.db");

const dateFields = {
  employees: ["createdAt", "updatedAt"],
  companies: ["contractStartDate", "publishStartDate", "contractEndedAt", "createdAt", "updatedAt"],
  tasks: [
    "publishDate", "readyDate", "workDate", "manualDay",
    "completedAt", "startedAt", "finishedAt", "createdAt", "updatedAt",
  ],
  photoSessions: ["shootDate", "deliverBy", "createdAt", "updatedAt"],
  settings: ["updatedAt"],
} as const;

function stamp(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function newestSnapshot(): string {
  const files = readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith("prod-") && f.endsWith(".json"))
    .sort();
  const last = files[files.length - 1];
  if (!last) throw new Error("ما في لقطة إنتاج بمجلد backups — شغّل npm run backup:pull أولاً");
  return resolve(BACKUP_DIR, last);
}

function withDates(rows: Record<string, unknown>[], fields: readonly string[]) {
  return rows.map((row) => {
    const next = { ...row };
    for (const f of fields) if (typeof next[f] === "string") next[f] = new Date(next[f] as string);
    return next;
  });
}

async function main() {
  const arg = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const path = arg ? resolve(arg) : newestSnapshot();
  if (!existsSync(path)) throw new Error(`اللقطة غير موجودة: ${path}`);

  const raw = readFileSync(path, "utf8");
  const snapshot = JSON.parse(raw) as Snapshot;
  const verdict = acceptSnapshot(snapshot, null);
  if (!verdict.ok) throw new Error(`اللقطة مرفوضة: ${verdict.reason} — ما انلمس المحلي`);
  const counts = actualCounts(snapshot);

  // نسخة الأمان قبل أي كتابة — مبصومة ومؤرّخة، وخارج التدوير.
  if (existsSync(DEV_DB)) {
    const safety = resolve(BACKUP_DIR, `dev.db.before-sync-${stamp()}`);
    copyFileSync(DEV_DB, safety);
    const h = createHash("sha256").update(readFileSync(safety)).digest("hex");
    console.log(`✓ نسخة أمان للمحلي: ${safety} (${h.slice(0, 12)})`);
  }

  const { PrismaClient } = await loadIsolatedPrismaClient(
    "prisma/schema.prisma",
    "prisma/.sync-sqlite.prisma",
    "../.generated/prisma-sqlite-client",
  );
  const prisma = new PrismaClient();

  const rows = {
    employees: withDates(snapshot.employees as Record<string, unknown>[], dateFields.employees),
    companies: withDates(snapshot.companies as Record<string, unknown>[], dateFields.companies),
    tasks: withDates(snapshot.tasks as Record<string, unknown>[], dateFields.tasks),
    photoSessions: withDates(snapshot.photoSessions as Record<string, unknown>[], dateFields.photoSessions),
    settings: withDates(snapshot.settings as Record<string, unknown>[], dateFields.settings),
  };

  // كل شي أو لا شي: لو وقع بالنص، المحلي بيرجع لحالته وما بيضل نصّ مستورد.
  await prisma.$transaction(
    async (tx: any) => {
      await tx.task.deleteMany();
      await tx.photoSession.deleteMany();
      await tx.company.deleteMany();
      await tx.employee.deleteMany();
      // مفاتيح الدخول المحلية بتضل: اللقطة أصلاً ما بتحملها.
      await tx.setting.deleteMany({ where: { key: { in: rows.settings.map((s) => s.key as string) } } });

      await tx.employee.createMany({ data: rows.employees });
      await tx.company.createMany({ data: rows.companies });
      await tx.task.createMany({ data: rows.tasks });
      await tx.photoSession.createMany({ data: rows.photoSessions });
      await tx.setting.createMany({ data: rows.settings });
    },
    { maxWait: 20000, timeout: 120000 },
  );

  // تحقّق ما بعد الاستيراد: العدّ الفعلي بالقاعدة مقابل اللقطة.
  const after = {
    employees: await prisma.employee.count(),
    companies: await prisma.company.count(),
    tasks: await prisma.task.count(),
    photoSessions: await prisma.photoSession.count(),
  };
  const mismatch = (Object.keys(after) as (keyof typeof after)[]).filter(
    (k) => after[k] !== counts[k],
  );
  await prisma.$disconnect();
  if (mismatch.length) {
    throw new Error(
      `الاستيراد ناقص: ${mismatch.map((k) => `${k} ${after[k]}/${counts[k]}`).join("، ")} — النسخة الأمان بمجلد backups`,
    );
  }
  console.log(
    `✓ المحلي صار مطابق للقطة ${path.split(/[\\/]/).pop()} — موظفين ${after.employees} · شركات ${after.companies} · كروت ${after.tasks} · نزلات ${after.photoSessions}`,
  );
}

main().catch((e) => {
  console.error(`❌ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
