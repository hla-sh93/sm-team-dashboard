/**
 * حالة الإنتاج **لكل دورة على حدة** — مو مجموع الشهور.
 *
 * القائدة انتبهت (1/8/2026): «فونيتيك خطتهم 4 بوست مو 8، وبرو 8 مو 16. انت عم
 * تدمج الخطط كلها؟». وهي محقة: كروت حزيران وتموز وآب بتتجمّع إذا حسبناها سوا،
 * فيطلع رقم ما بيقابل ولا عقد. العقد شهري، فالمراجعة لازم تكون شهر بشهر.
 *
 *   npx tsx scripts/cycle-status.ts            # كل الشركات، كل الدورات
 *   npx tsx scripts/cycle-status.ts 2026 7     # سنة وشهر محددين (0-based)
 *   npx tsx scripts/cycle-status.ts --current  # الدورة الحالية بس
 */
import { PrismaClient } from "@prisma/client";
import { isTaskDoneState } from "../src/lib/constants";

const prisma = new PrismaClient();
const argv = process.argv.slice(2);
const CURRENT_ONLY = argv.includes("--current");
const nums = argv.filter((a) => !a.startsWith("--")).map(Number);
const [YEAR, MONTH] = nums.length === 2 ? nums : [null, null];

const AR_MONTH = [
  "كانون٢", "شباط", "آذار", "نيسان", "أيار", "حزيران",
  "تموز", "آب", "أيلول", "تشرين١", "تشرين٢", "كانون١",
];
const TYPE_AR: Record<string, string> = { POST: "بوست", REEL: "ريل", AI_REEL: "ريل AI", STORY: "ستوري" };

async function main() {
  const now = new Date();
  const companies = await prisma.company.findMany({ orderBy: { priority: "asc" } });

  for (const co of companies) {
    const cards = await prisma.task.findMany({
      where: {
        companyId: co.id,
        kind: "CONTENT",
        stage: { in: ["DESIGN", "SHOOT"] },
        status: { not: "CANCELED" },
        ...(YEAR != null ? { year: YEAR, month: MONTH! } : {}),
        ...(CURRENT_ONLY ? { year: now.getFullYear(), month: now.getMonth() } : {}),
      },
      orderBy: [{ year: "asc" }, { month: "asc" }],
    });
    if (!cards.length) continue;

    // الخطة المتعاقد عليها شهرياً — الرقم اللي لازم كل دورة تقابله.
    const plan: Record<string, number> = {};
    if (co.posts) plan.POST = co.posts;
    if (co.reels) plan.REEL = co.reels;
    if (co.aiReels) plan.AI_REEL = co.aiReels;
    if (co.stories) plan.STORY = co.stories;
    const planLine = Object.entries(plan).map(([t, n]) => `${n} ${TYPE_AR[t] ?? t}`).join(" · ");

    const tag = co.status !== "active" ? ` [${co.status}]` : co.lateExemptReason ? " [التأخير مو محسوب]" : "";
    console.log(`\n══ ${co.name}${tag} — العقد: ${planLine || "بلا خطة"} بالشهر ══`);

    // كل دورة لحالها.
    const buckets = new Map<string, typeof cards>();
    for (const c of cards) {
      const k = `${c.year}-${c.month}`;
      buckets.set(k, [...(buckets.get(k) ?? []), c]);
    }
    for (const [k, list] of [...buckets.entries()].sort()) {
      const [y, m] = k.split("-").map(Number);
      const by: Record<string, { d: number; t: number }> = {};
      for (const c of list) {
        const t = c.type ?? "?";
        by[t] ??= { d: 0, t: 0 };
        by[t].t++;
        if (isTaskDoneState(c)) by[t].d++;
      }
      const parts = Object.entries(by).map(([t, v]) => {
        const expected = plan[t];
        // تنبيه لما عدد الكروت بالدورة ما بيساوي المتعاقد عليه.
        const mismatch = expected != null && v.t !== expected ? ` ⚠️(العقد ${expected})` : "";
        return `${TYPE_AR[t] ?? t} ${v.d}/${v.t}${mismatch}`;
      });
      const done = Object.values(by).reduce((a, v) => a + v.d, 0);
      const total = Object.values(by).reduce((a, v) => a + v.t, 0);
      const pct = total ? Math.round((done / total) * 100) : 0;
      console.log(`   ${AR_MONTH[m]} ${y}:  ${parts.join(" · ")}   →  ${done}/${total} (${pct}%)`);
    }
  }
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
