/**
 * معاينة رسالتي تلغرام اليوميتين على الداتا **المحلية** (المرآة) — بلا إرسال.
 *
 * ليش: القائدة بتحكم على شكل الرسالة لا على الكود. قبل ما ينبعت شي بالصبح أو
 * بالمسا بدنا نشوف النصّ نفسه كما رح يوصلها.
 *
 *   npx tsx scripts/preview-telegram.ts 2026-09-16
 */
import { prisma } from "@/lib/db";
import { loadLiveTasks } from "@/lib/live-tasks";
import { buildDailyBrief, briefMessagesFor } from "@/lib/telegram/brief";
import { buildDailyDoneReport } from "@/lib/telegram/done-report";
import { fromISODate } from "@/lib/dates";
import type { Company, Employee, Task } from "@/types";

async function main() {
  const dayArg = process.argv[2];
  const today = dayArg ? fromISODate(dayArg) : new Date();
  today.setHours(9, 0, 0, 0);
  const [employees, companies, tasks] = await Promise.all([
    prisma.employee.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.company.findMany({ orderBy: { priority: "asc" } }),
    loadLiveTasks(today.getFullYear(), today.getMonth(), today),
  ]);
  const brief = buildDailyBrief({
    today,
    companies: companies as unknown as Company[],
    employees: employees as unknown as Employee[],
    tasks: tasks as unknown as Task[],
  });
  console.log("═══ الصبح ٧:٤٥ — توزيع المهام ═══");
  for (const m of briefMessagesFor(brief, "general")) console.log(m.text, "\n");
  const evening = new Date(today);
  evening.setHours(20, 0, 0, 0);
  const report = buildDailyDoneReport(
    evening,
    employees as unknown as Employee[],
    companies as unknown as Company[],
    tasks as unknown as Task[],
  );
  console.log("═══ المسا ٨:٠٠ — تقرير الإنجاز ═══");
  console.log(report.text ?? "(لا شيء)");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
