/**
 * التدريب — شغلها **مدفوع بالدورات**، مو بخطة شهرية ثابتة.
 *
 * القائدة (1/8/2026): «الأرقام مو صحيحة بالتدريب، ما عندي 14 بوست بالشهر ولا 18
 * بأيلول». والسبب ازدواج: الشركة مسجّل عليها `posts: 7` فالمحرك بيولّد 7 كروت
 * تصميم + 7 نشر كل شهر، **وفوقهن** كروت الدورات (`course_*`) يلي هي الشغل
 * الحقيقي — إعلان لكل دورة، والنشر قبل موعدها بـ10 أيام.
 *
 * الحل: `posts = 0` فما بيضل في خطة شهرية آلية، وكروت الدورات بتصير هي كل
 * الخطة. الشهور الماضية (حزيران وتموز) بتضل متل ما هي — سجل تاريخي ما منلمسه.
 *
 *   npx tsx scripts/fix-training-course-driven.ts --apply
 */
import { PrismaClient } from "@prisma/client";
import { generateSchedule } from "../src/server/actions/schedule";
import { isTaskDoneState } from "../src/lib/constants";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
/** الشهور اللي منعيد توليدها (0-based): آب، أيلول، تشرين١. الماضي ما منلمسه. */
const FUTURE = [7, 8, 9];

async function main() {
  const co = await prisma.company.findFirst({ where: { name: "التدريب" } });
  if (!co) throw new Error("ما لقيت التدريب");

  const before = await prisma.task.findMany({ where: { companyId: co.id, status: { not: "CANCELED" } } });
  const autoFuture = before.filter((t) => t.isAuto && FUTURE.includes(t.month) && t.year === 2026);
  console.log(`قبل: ${before.length} كرت · منها ${autoFuture.length} كرت آلي بآب/أيلول/تشرين (وهم الزيادة)`);
  const courses = before.filter((t) => t.id.startsWith("course_"));
  console.log(`كروت الدورات (الشغل الحقيقي): ${courses.length}`);

  if (!APPLY) {
    console.log("\nرح ينعمل: posts=0 · إعادة توليد آب وأيلول وتشرين (بتنحذف الكروت الآلية).");
    console.log("تشغيل تجريبي — أضف --apply.");
    await prisma.$disconnect();
    return;
  }

  await prisma.company.update({ where: { id: co.id }, data: { posts: 0 } });
  for (const m of FUTURE) {
    try { await generateSchedule(2026, m); } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/revalidate|static generation|headers|request scope/i.test(msg)) throw e;
    }
  }

  const after = await prisma.task.findMany({ where: { companyId: co.id, status: { not: "CANCELED" } }, orderBy: [{ year: "asc" }, { month: "asc" }] });
  const by = new Map<string, { d: number; t: number }>();
  for (const t of after) {
    const k = `${t.year}-${String(t.month + 1).padStart(2, "0")}`;
    const v = by.get(k) ?? { d: 0, t: 0 }; v.t++; if (isTaskDoneState(t)) v.d++; by.set(k, v);
  }
  console.log("\nبعد:");
  for (const [k, v] of [...by.entries()].sort()) console.log(`  ${k}: ${v.d}/${v.t} كرت`);
  console.log("\n(آب وأيلول = دورتين × [تصميم + نشر] لكل دورة — النشر قبل الدورة بـ10 أيام)");
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
