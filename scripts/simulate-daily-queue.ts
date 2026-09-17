/**
 * بيحاكي «مهام اليوم» لأشخاص محدَّدين بيوم محدَّد على الداتا **المحلية** (المرآة).
 *
 * ليش: قبل ما تنطبّق حمولة على الإنتاج بدنا نعرف شو بيصير بطابور الشخص فعلاً —
 * القائدة بتحكم على الشاشة، مو على الصفوف. الحساب نفسه يلي بتستعمله الصفحة
 * الرئيسية والبريف (`selectDailyWorkTasks` على `loadLiveTasks`)، فالنتيجة هون
 * هي النتيجة هناك. قراءة فقط.
 *
 *   npx tsx scripts/simulate-daily-queue.ts 2026-09-15 سابين ماجد أليسار
 */
import { prisma } from "@/lib/db";
import { loadLiveTasks } from "@/lib/live-tasks";
import { dailyTaskEffortDays, selectDailyWork } from "@/lib/daily-work";
import { fromISODate, toISODate } from "@/lib/dates";
import type { Company, Employee, Task } from "@/types";

async function main() {
  const [dayArg, ...names] = process.argv.slice(2);
  if (!dayArg) {
    console.error("الاستعمال: simulate-daily-queue.ts <YYYY-MM-DD> [اسم ...]");
    process.exit(1);
  }
  const today = fromISODate(dayArg);
  today.setHours(9, 0, 0, 0);
  const [employees, companies, tasks] = await Promise.all([
    prisma.employee.findMany({ orderBy: { name: "asc" } }),
    prisma.company.findMany(),
    loadLiveTasks(today.getFullYear(), today.getMonth(), today),
  ]);
  const coName = new Map(companies.map((c) => [c.id, c.name]));
  const wanted = employees.filter((e) => !names.length || names.includes(e.name));
  console.log(`— محاكاة «مهام اليوم» ${toISODate(today)} على الداتا المحلية —`);
  for (const emp of wanted) {
    const work = selectDailyWork({
      employee: emp as unknown as Employee,
      tasks: tasks as unknown as Task[],
      allTasks: tasks as unknown as Task[],
      companies: companies as unknown as Company[],
      today,
    });
    const picked = work.queue;
    let used = 0;
    // المنجَز اليوم جزء من اليوم: بياخد حصّته من السعة، والقائمة بتعبّي الباقي.
    const doneNote = work.doneToday.length
      ? ` · منجز اليوم ${work.doneToday.length} (${Math.round(work.doneLoad * 100)}٪)${work.dayFull ? " — اليوم ممتلئ" : ""}`
      : "";
    const stateNote =
      picked.length === 0 && work.doneToday.length > 0 ? " ← «تم إنجاز مهام اليوم»" : "";
    console.log(`\n${emp.name} — ${picked.length} كرت${doneNote}${stateNote}`);
    for (const t of work.doneToday) {
      const label = t.pieceNo != null ? `${t.type}#${t.pieceNo} ${t.stage}` : `${t.stage ?? "—"} ${t.title ?? ""}`;
      console.log(`   ✓ ${label.padEnd(34)} ${(t.companyId ? coName.get(t.companyId) : "—") ?? "—"}`);
    }
    for (const t of picked) {
      const effort = dailyTaskEffortDays(emp as unknown as Employee, t);
      used += effort;
      const label = t.pieceNo != null ? `${t.type}#${t.pieceNo} ${t.stage}` : `${t.stage ?? "—"} ${t.title ?? ""}`;
      console.log(
        `   • ${label.padEnd(34)} ${(t.companyId ? coName.get(t.companyId) : "—") ?? "—"}`.padEnd(70) +
          ` شغل ${toISODate(t.workDate ?? today)} · جهوزية ${t.readyDate ? toISODate(t.readyDate) : "—"} · جهد ${effort.toFixed(2)}${t.isPinned ? " · مثبّت" : ""}`,
      );
    }
    console.log(`   = ${Math.round((used + work.doneLoad) * 100)}٪ من اليوم (منها ${Math.round(work.doneLoad * 100)}٪ منجز)`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
