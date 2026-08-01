/**
 * جرد ما قبل الرفع: التأخيرات + **الفجوات المعرفية** (شو لسا ما منعرفو).
 *
 * الفكرة إنو الرقم الغلط أخطر من الرقم الناقص. لهيك القسم الثاني بيعدّ الأشياء
 * اللي النظام مو متأكد منها — شركة بلا خطة، دورة عدد كروتها مو مطابق للعقد،
 * كرت بلا مسؤول، قطعة إنتاجها خالص وواقفة عالنشر… — حتى ما ننشر أرقام واثقة
 * وهي مبنية على تخمين.
 *
 *   npx tsx scripts/pre-deploy-audit.ts
 */
import { PrismaClient } from "@prisma/client";
import { isTaskDoneState, isTaskLateState, daysLateOfState } from "../src/lib/constants";

const prisma = new PrismaClient();
const TODAY = new Date();

const TYPE_AR: Record<string, string> = { POST: "بوست", REEL: "ريل", AI_REEL: "ريل AI", STORY: "ستوري" };

async function main() {
  const companies = await prisma.company.findMany({ orderBy: { priority: "asc" } });
  const employees = await prisma.employee.findMany();
  const empName = new Map(employees.map((e) => [e.id, e.name]));
  const coById = new Map(companies.map((c) => [c.id, c]));
  const exempt = new Set(companies.filter((c) => c.lateExemptReason).map((c) => c.id));
  const inactive = new Set(companies.filter((c) => c.status !== "active").map((c) => c.id));

  const all = await prisma.task.findMany({ where: { status: { not: "CANCELED" } } });
  const open = all.filter((t) => !isTaskDoneState(t));

  // ───────────────────────── 1. التأخيرات ─────────────────────────
  const late = open.filter(
    (t) => isTaskLateState(t, TODAY) && !(t.companyId && (exempt.has(t.companyId) || inactive.has(t.companyId))),
  );
  console.log(`\n════════ التأخيرات: ${late.length} كرت ════════`);

  const byPerson = new Map<string, number>();
  for (const t of late) byPerson.set(empName.get(t.assigneeId ?? "") ?? "غير مُسند", (byPerson.get(empName.get(t.assigneeId ?? "") ?? "غير مُسند") ?? 0) + 1);
  console.log("\nحسب الشخص:");
  for (const [k, v] of [...byPerson.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(12)} ${v}`);

  console.log("\nحسب الشركة والمرحلة:");
  const byCo = new Map<string, Map<string, number>>();
  for (const t of late) {
    const co = coById.get(t.companyId ?? "")?.name ?? "—";
    const stage = t.stage === "PUBLISH" ? "نشر" : t.stage === "WRITE" ? "كتابة" : "إنتاج";
    const m = byCo.get(co) ?? new Map();
    m.set(stage, (m.get(stage) ?? 0) + 1);
    byCo.set(co, m);
  }
  for (const [co, m] of [...byCo.entries()].sort((a, b) => [...b[1].values()].reduce((x, y) => x + y, 0) - [...a[1].values()].reduce((x, y) => x + y, 0)))
    console.log(`  ${co.padEnd(16)} ` + [...m.entries()].map(([s, n]) => `${s} ${n}`).join(" · "));

  const oldest = [...late].sort((a, b) => daysLateOfState(b, TODAY) - daysLateOfState(a, TODAY)).slice(0, 5);
  console.log("\nأقدم 5:");
  for (const t of oldest)
    console.log(`  ${daysLateOfState(t, TODAY)} يوم · ${coById.get(t.companyId ?? "")?.name ?? "—"} · ${TYPE_AR[t.type ?? ""] ?? t.stage} ${t.pieceNo ?? ""} · ${empName.get(t.assigneeId ?? "") ?? "—"}`);

  // أسرع مكسب: إنتاجها خالص وواقفة عالنشر بس
  const doneByKey = new Map(all.filter((t) => t.stage !== "PUBLISH" && isTaskDoneState(t)).map((t) => [t.pipelineKey ?? "", true]));
  const readyToPublish = open.filter((t) => t.stage === "PUBLISH" && t.pipelineKey && doneByKey.has(t.pipelineKey) && !inactive.has(t.companyId ?? ""));
  console.log(`\n🚀 جاهز للنشر (إنتاجها خالص وواقفة عالنشر بس): ${readyToPublish.length}`);

  // ─────────────────── 2. الفجوات المعرفية ───────────────────
  console.log(`\n\n════════ شو لسا ما منعرفو ════════`);
  const gaps: string[] = [];

  // (أ) شركات بلا نص خطة — أرقامها مبنية على مطابقة عمياني
  for (const c of companies) {
    if (c.status !== "active") continue;
    const cards = all.filter((t) => t.companyId === c.id && t.kind === "CONTENT" && ["DESIGN", "SHOOT"].includes(t.stage ?? ""));
    if (!cards.length) continue;
    const withBrief = cards.filter((t) => t.brief).length;
    if (withBrief === 0) gaps.push(`«${c.name}» بلا نص خطة إطلاقاً — ${cards.length} كرت أرقامها غير موثوقة`);
    else if (withBrief < cards.length) {
      const cycles = new Set(cards.filter((t) => !t.brief).map((t) => `${t.year}-${t.month + 1}`));
      gaps.push(`«${c.name}» ناقصها نص الخطة لدورات: ${[...cycles].join("، ")}`);
    }
  }

  // (ب) دورة عدد كروتها ما بيطابق العقد
  for (const c of companies) {
    if (c.status !== "active") continue;
    const plan: Record<string, number> = { POST: c.posts, REEL: c.reels, AI_REEL: c.aiReels, STORY: c.stories };
    const cards = all.filter((t) => t.companyId === c.id && t.kind === "CONTENT" && ["DESIGN", "SHOOT"].includes(t.stage ?? ""));
    const cycles = new Map<string, Map<string, number>>();
    for (const t of cards) {
      const k = `${t.year}-${t.month + 1}`;
      const m = cycles.get(k) ?? new Map();
      m.set(t.type ?? "?", (m.get(t.type ?? "?") ?? 0) + 1);
      cycles.set(k, m);
    }
    for (const [cy, m] of cycles)
      for (const [type, n] of m)
        if (plan[type] != null && plan[type] !== n)
          gaps.push(`«${c.name}» دورة ${cy}: ${n} ${TYPE_AR[type] ?? type} بالكروت مقابل ${plan[type]} بالعقد`);
  }

  // (ج) كروت بلا مسؤول
  const unassigned = open.filter((t) => !t.assigneeId && !inactive.has(t.companyId ?? ""));
  if (unassigned.length) {
    const co = [...new Set(unassigned.map((t) => coById.get(t.companyId ?? "")?.name ?? "—"))];
    gaps.push(`${unassigned.length} كرت مفتوح بلا مسؤول — ${co.join("، ")}`);
  }

  // (د) قطعة نشرها مسكّر وإنتاجها لأ — تناقض
  const pubDone = all.filter((t) => t.stage === "PUBLISH" && isTaskDoneState(t) && t.pipelineKey);
  const contradictory = pubDone.filter((p) => all.some((t) => t.pipelineKey === p.pipelineKey && t.stage !== "PUBLISH" && !isTaskDoneState(t)));
  if (contradictory.length) gaps.push(`${contradictory.length} قطعة نشرها مسجّل منجز بينما إنتاجها لسا مفتوح`);

  // (هـ) شركات نشطة بلا كروت بالدورة الحالية
  for (const c of companies) {
    if (c.status !== "active" || !c.managed) continue;
    const cur = all.filter((t) => t.companyId === c.id && t.year === TODAY.getFullYear() && t.month === TODAY.getMonth());
    if (!cur.length) gaps.push(`«${c.name}» ما إلها ولا كرت بالدورة الحالية`);
  }

  for (const g of gaps) console.log(`  ⚠️ ${g}`);
  if (!gaps.length) console.log("  ✅ ما في فجوات.");

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
