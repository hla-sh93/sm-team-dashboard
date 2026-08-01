/**
 * التدقيق النهائي الشامل — كل النظام قبل ما يشتغل عليه الفريق.
 *
 * `deep-audit` بيفحص المحرك، و`team-readiness` بيفحص «فيهن يشتغلوا بكرا».
 * هون منغطّي يلي ما انفحص لهلق: **المالية، تقارير الإنجاز للأفراد والشركات،
 * جدول النشر، والأحمال** — وبنطلع بجرد للشركات حتى يتأكد العدد.
 *
 *   npx tsx scripts/final-audit.ts
 */
import { PrismaClient } from "@prisma/client";
import { computeFinance } from "../src/lib/finance";
import { computeWorkload } from "../src/lib/workload";
import { completedCompanyPlanCount } from "../src/lib/progress";
import { derivePublishingSchedule, validatePublishing } from "../src/lib/publishing";
import { isTaskDoneState, isTaskLateState } from "../src/lib/constants";
import { taskDays } from "../src/lib/capacity";
import { dailyTaskEffortDays } from "../src/lib/daily-work";
import { cycleForBucket } from "../src/lib/contract";
import type { Company, Employee, Task } from "../src/types";

const prisma = new PrismaClient();
const Y = 2026, M = 7; // آب
let pass = 0;
const fails: string[] = [];
const notes: string[] = [];
const check = (n: string, ok: boolean, d = "") => {
  if (ok) { pass++; console.log(`  ✅ ${n}`); } else { fails.push(`${n} — ${d}`); console.log(`  ❌ ${n} — ${d}`); }
};
const note = (s: string) => { notes.push(s); console.log(`  ℹ️ ${s}`); };

async function main() {
  const employees = (await prisma.employee.findMany()) as unknown as Employee[];
  const companies = (await prisma.company.findMany({ orderBy: { priority: "asc" } })) as unknown as Company[];
  const tasks = (await prisma.task.findMany({ where: { status: { not: "CANCELED" } } })) as unknown as Task[];

  // ═══ 1. جرد الشركات ═══
  console.log("\n═══ 1. الشركات ═══");
  const activeManaged = companies.filter((c) => c.managed && c.status === "active");
  const withPlan = activeManaged.filter((c) => c.posts + c.reels + c.stories + c.aiReels > 0);
  console.log(`  المجموع ${companies.length} · مدارة ونشطة ${activeManaged.length} · منها بخطة ${withPlan.length}`);
  for (const c of companies)
    console.log(`     ${c.name.padEnd(15)} ${c.managed ? "مدارة" : "غير مدارة"} · ${c.status} · ${c.posts}P/${c.reels}R/${c.aiReels}AI/${c.stories}S · $${c.contractValue}`);
  const unmanagedActive = companies.filter((c) => !c.managed && c.status === "active");
  if (unmanagedActive.length)
    note(`«غير مدارة» ونشطة: ${unmanagedActive.map((c) => c.name).join("، ")} — ما بتدخل الجدولة ولا المالية`);
  const noValue = activeManaged.filter((c) => c.contractValue === 0);
  if (noValue.length) note(`بلا قيمة عقد: ${noValue.map((c) => c.name).join("، ")} — بتنحسب تكلفة بلا إيراد`);
  const planless = activeManaged.filter((c) => c.posts + c.reels + c.stories + c.aiReels === 0);
  if (planless.length) note(`مدارة بلا خطة شهرية: ${planless.map((c) => c.name).join("، ")}`);

  // ═══ 2. المالية ═══
  console.log("\n═══ 2. المالية ═══");
  const fin = computeFinance(employees, companies, Y, M);
  console.log(`  إيراد ${fin.totalRevenue} · رواتب ${fin.totalSalaries} · متغيّر ${fin.totalVariable} · تكلفة ${fin.totalCost} · ربح ${fin.netProfit} (${fin.marginPct.toFixed(1)}%)`);
  const expectedRev = activeManaged.reduce((a, c) => a + c.contractValue, 0);
  check("الإيراد = مجموع عقود الشركات المدارة النشطة", Math.abs(fin.totalRevenue - expectedRev) < 0.01, `${fin.totalRevenue} مقابل ${expectedRev}`);
  check("التكلفة = رواتب + متغيّر", Math.abs(fin.totalCost - (fin.totalSalaries + fin.totalVariable)) < 0.01);
  check("الربح = إيراد − تكلفة", Math.abs(fin.netProfit - (fin.totalRevenue - fin.totalCost)) < 0.01);
  check("عدد العقود = الشركات المدارة النشطة", fin.numContracts === activeManaged.length, `${fin.numContracts} مقابل ${activeManaged.length}`);
  check("ما في نسبة ربح لانهائية أو NaN", Number.isFinite(fin.marginPct));
  check("الطاقة محسوبة لكل دور", fin.capacity.length > 0 && fin.capacity.every((r) => Number.isFinite(r.maxContracts)));
  if (fin.breakEvenContracts != null)
    note(`نقطة التعادل ${fin.breakEvenContracts} عقد · الحالي ${fin.numContracts} → ${fin.aboveBreakEven ? "فوقها ✅" : "تحتها ⚠️"}`);
  note(`سقف الفريق ${fin.teamMaxContracts} عقد · فاضل ${fin.extraContracts}`);

  // ═══ 3. الأحمال ═══
  console.log("\n═══ 3. الأحمال ═══");
  const wl = computeWorkload(employees, tasks, Y, M, [], companies);
  for (const r of wl) {
    if (!r.itemCount) continue;
    console.log(`  ${r.employee.name.padEnd(10)} ملتزم ${r.committedDays.toFixed(1)} / طاقة ${r.capacityDays} يوم (${Math.round(r.pct)}%)${r.level === "over" ? "  ⚠️ فوق الطاقة" : ""}`);
  }
  const over = wl.filter((r) => r.committedDays > r.capacityDays + 0.01);
  check("ولا حمل شهري فوق الطاقة", over.length === 0,
    over.map((r) => `${r.employee.name} ${r.committedDays.toFixed(1)}/${r.capacityDays}`).join("، "));
  // توازن المصممين
  const dLoad = new Map<string, number>();
  for (const c of activeManaged) {
    const add = (id: string | null | undefined, d: number) => { if (id && d > 0) dLoad.set(id, (dLoad.get(id) ?? 0) + d); };
    add(c.postOwnerId, taskDays({}, "POST", c.posts));
    add(c.storyOwnerId, taskDays({}, "STORY", c.stories));
    add(c.aiReelOwnerId ?? c.postOwnerId, taskDays({}, "AI_REEL", c.aiReels));
  }
  const designers = [...dLoad.entries()].map(([id, d]) => ({ name: employees.find((e) => e.id === id)?.name ?? id, d }))
    .filter((x) => x.name === "أيمن" || x.name === "سابين");
  const gap = designers.length === 2 ? Math.abs(designers[0].d - designers[1].d) : 0;
  console.log(`  نظري (الخطة الشهرية): ${designers.map((x) => `${x.name} ${x.d.toFixed(1)}`).join(" · ")} → فرق ${gap.toFixed(1)} يوم`);
  // الحمل الفعلي = الكروت المفتوحة فعلاً (بما فيها المتراكم من دورات سابقة).
  // هو يلي بيحسّه الفريق؛ النظري بيوصف الوضع المستقر بعد ما يفضى المتراكم.
  const realLoad = new Map<string, number>();
  for (const t of tasks) {
    if (isTaskDoneState(t) || !t.assigneeId || t.stage === "PUBLISH") continue;
    const e = employees.find((x) => x.id === t.assigneeId);
    if (!e || !/designer|مصمم/i.test(e.role)) continue;
    realLoad.set(e.name, (realLoad.get(e.name) ?? 0) + dailyTaskEffortDays(e as never, t as never));
  }
  const realRows = [...realLoad.entries()].filter(([k]) => k === "أيمن" || k === "سابين");
  const realGap = realRows.length === 2 ? Math.abs(realRows[0][1] - realRows[1][1]) : 0;
  console.log(`  فعلي (كروت مفتوحة): ${realRows.map(([k, v]) => `${k} ${v.toFixed(1)}`).join(" · ")} → فرق ${realGap.toFixed(1)} يوم`);
  check("حمل المصممين متوازن (النظري أو الفعلي ≤ 2 يوم)", gap <= 2 || realGap <= 2,
    `نظري ${gap.toFixed(1)} · فعلي ${realGap.toFixed(1)}`);
  if (gap > 2) note(`تنبيه استقرار: بعد ما يفضى المتراكم، الخطة الشهرية بتخلي ${designers.sort((a, b) => b.d - a.d)[0].name} أثقل بـ${gap.toFixed(1)} يوم — راجعي التوزيع وقتها`);

  // ═══ 4. النشر ═══
  console.log("\n═══ 4. النشر ═══");
  const pubTasks = tasks.filter((t) => t.stage === "PUBLISH");
  const sched = derivePublishingSchedule(tasks as never);
  check("جدول النشر بيتبنى بلا أخطاء", sched instanceof Map);
  // التحقق لازم يكون **لكل دورة على حدة** — تمرير كل الكروت بيجمع دورات آب
  // وأيلول وتشرين ويطلع «30 مقابل خطة 10». نفس درس التقارير: العقد شهري.
  let pubProblems = 0;
  for (const [y, m] of [[Y, 6], [Y, M]] as [number, number][]) {
    const scoped = tasks.filter((t) => t.year === y && t.month === m);
    const v = validatePublishing(scoped as never, companies as never, { year: y, month: m });
    if (v.problems.length) {
      pubProblems += v.problems.length;
      console.log(`     دورة ${y}-${m + 1}: ${v.problems.slice(0, 3).join(" · ")}`);
    }
  }
  check("النشر مطابق للخطة وبلا انقطاع (لكل دورة)", pubProblems === 0, `${pubProblems} مشكلة`);
  const noDate = pubTasks.filter((t) => !isTaskDoneState(t) && !t.publishDate && t.kind === "CONTENT");
  check("كل قطعة مفتوحة إلها موعد نشر", noDate.length === 0, `${noDate.length} بلا موعد`);
  const dormant = new Set(companies.filter((c) => c.status !== "active").map((c) => c.id));
  const latePub = pubTasks.filter((t) => !isTaskDoneState(t) && isTaskLateState(t) && !(t.companyId && dormant.has(t.companyId)));
  note(`نشر متأخر: ${latePub.length} قطعة — أكبر مكسب سريع`);

  // ═══ 5. تقارير الإنجاز ═══
  console.log("\n═══ 5. تقارير الإنجاز ═══");
  console.log("  — الشركات (الدورة الحالية) —");
  for (const c of activeManaged) {
    // دورة الشركة الحالية ممكن تكون بسلّة تموز (عقد بدأ 18/7 مثلاً) — منختار
    // آخر سلّة فيها كروت بدل ما نفترض الشهر التقويمي.
    const mine = tasks.filter((t) => t.companyId === c.id && t.kind === "CONTENT" && ["DESIGN", "SHOOT"].includes(t.stage ?? "") && t.year === Y);
    const buckets = [...new Set(mine.map((t) => t.month))].sort((a, b) => b - a);
    const bucket = buckets.find((b) => b <= M);
    const cur = bucket == null ? [] : mine.filter((t) => t.month === bucket);
    if (!cur.length) { console.log(`     ${c.name.padEnd(15)} — ما في كروت بالدورة الحالية`); continue; }
    const done = cur.filter(isTaskDoneState).length;
    // دالة التقدّم الرسمية: كم قطعة **مكتملة** (إنتاج + نشر) — هي يلي بتظهر
    // بالتقارير، فلازم تتطابق مع عدّ الكروت.
    // لازم تنحصر بنفس الدورة — بدونها بتجمع كل الشهور وبتطلع «إنتاج 1/17
    // ومنشور 17» (المنشور من دورة حزيران).
    const bucketTasks = tasks.filter((t) => t.companyId === c.id && t.year === Y && t.month === bucket);
    const published = completedCompanyPlanCount(bucketTasks as never, c.id);
    const AR = ["ك٢","شباط","آذار","نيسان","أيار","حزيران","تموز","آب","أيلول","ت١","ت٢","ك١"];
    console.log(`     ${c.name.padEnd(15)} دورة ${AR[bucket!]} · إنتاج ${done}/${cur.length} (${Math.round((done / cur.length) * 100)}%) · مكتمل ومنشور ${published}`);
  }
  console.log("  — الأفراد (المنجز هالشهر) —");
  for (const e of employees) {
    const mine = tasks.filter((t) => t.assigneeId === e.id && t.year === Y && t.month === M);
    if (!mine.length) continue;
    const done = mine.filter(isTaskDoneState).length;
    console.log(`     ${e.name.padEnd(10)} ${done}/${mine.length} كرت`);
  }
  const ghost = tasks.filter((t) => isTaskDoneState(t) && !t.assigneeId);
  check("كل قطعة منجزة منسوبة لشخص", ghost.length === 0, `${ghost.length} بلا صاحب`);

  // ═══ النتيجة ═══
  console.log(`\n${"═".repeat(54)}`);
  console.log(`✅ ${pass} فحص ناجح` + (fails.length ? ` · ❌ ${fails.length} فاشل` : "") + (notes.length ? ` · ℹ️ ${notes.length} ملاحظة` : ""));
  if (fails.length) { console.log("\nفواشل:"); for (const f of fails) console.log(`   ❌ ${f}`); }
  await prisma.$disconnect();
  if (fails.length) process.exit(1);
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
