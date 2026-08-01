/**
 * وصل — تصحيح الإنجاز بعد ما دخلت خطة تموز كبريف (1/8/2026).
 *
 * قبل البريف كانت المطابقة تشتغل «بالنوع» عمياني: أي صورة من أيمن بتسكّر بوست.
 * فطلع 15/15 بوست بينما الخطة بتقول غير هيك:
 *   • بوست 1–6  = «خبر عاجل» — أيمن بعت خبر عاجل 1..9، فالستة كلهن مسلّمين ✅
 *   • بوست 7–15 = من نحن / مزايا المنصة / الأمان / القنوات / مساعد AI / … —
 *     **ولا وحدة منهن انبعتت**؛ باقي ملفات التوبيك كلها صرف ومفكرة اقتصادية،
 *     وهي محتوى الزبون خارج الخطة (offPlanKeywords).
 *
 * والريلات: القائدة قالت «في ريلين مبعوتين». الملفات بتأكد:
 *   WASL reel 1.mp4 (أيمن 22/7) + wasel july plan 1 final_.mp4 (ماجد 26/7) → ريل 1
 *   wasl 4-7.mp4 (أليسار 1/8) → ريل 4
 * يعني ريل 1 و4 — مو 2 و3 و4 متل ما سكّرتهن المطابقة العمياني.
 *
 *   npx tsx scripts/fix-wasl-from-plan.ts --apply
 */
import { PrismaClient } from "@prisma/client";
import { isTaskDoneState } from "../src/lib/constants";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const DONE_REELS = new Set([1, 4]);
const DONE_POSTS = 6; // بوست 1–6 = صفوف «خبر عاجل»

async function main() {
  const co = await prisma.company.findFirst({ where: { name: { contains: "وصل" } } });
  if (!co) throw new Error("ما لقيت وصل");
  const at = new Date(2026, 6, 26);

  const close = async (c: { id: string; startedAt: Date | null }, when: Date) => {
    if (!APPLY) return;
    await prisma.task.update({
      where: { id: c.id },
      data: {
        status: "READY", board: "DONE", isPinned: true,
        startedAt: c.startedAt && c.startedAt < when ? c.startedAt : when,
        finishedAt: when, completedAt: when,
      },
    });
  };
  const reopen = async (c: { id: string; pipelineKey: string | null }) => {
    if (!APPLY) return;
    await prisma.task.update({
      where: { id: c.id },
      data: { status: "NOT_STARTED", board: "TODO", startedAt: null, finishedAt: null, completedAt: null },
    });
    if (c.pipelineKey)
      await prisma.task.updateMany({
        where: { pipelineKey: c.pipelineKey, stage: "PUBLISH", status: { not: "CANCELED" } },
        data: { status: "NOT_STARTED", board: "TODO", startedAt: null, finishedAt: null, completedAt: null },
      });
  };

  // ---- الريلات: 1 و4 بس ----------------------------------------------------
  const reels = await prisma.task.findMany({
    where: { companyId: co.id, kind: "CONTENT", type: "REEL", stage: "SHOOT", status: { not: "CANCELED" } },
    orderBy: { pieceNo: "asc" },
  });
  for (const r of reels) {
    const want = DONE_REELS.has(r.pieceNo ?? 0);
    const is = isTaskDoneState(r);
    if (want && !is) { console.log(`✅ ريل ${r.pieceNo} → منجز`); await close(r, at); }
    else if (!want && is) { console.log(`↩️ ريل ${r.pieceNo} → رجع مفتوح (ما في ملف يقابله)`); await reopen(r); }
  }

  // ---- البوستات: أول 6 (صفوف خبر عاجل) ------------------------------------
  const posts = await prisma.task.findMany({
    where: { companyId: co.id, kind: "CONTENT", type: "POST", stage: "DESIGN", status: { not: "CANCELED" } },
    orderBy: [{ publishDate: "asc" }, { pieceNo: "asc" }],
  });
  for (const [i, p] of posts.entries()) {
    const want = i < DONE_POSTS;
    const is = isTaskDoneState(p);
    if (want && !is) { console.log(`✅ بوست ${p.pieceNo} → منجز`); await close(p, new Date(2026, 6, 20)); }
    else if (!want && is) { console.log(`↩️ بوست ${p.pieceNo} → رجع مفتوح (${(p.brief ?? "").slice(0, 30)}…)`); await reopen(p); }
  }

  const after = await prisma.task.findMany({
    where: { companyId: co.id, kind: "CONTENT", stage: { in: ["DESIGN", "SHOOT"] }, status: { not: "CANCELED" } },
  });
  const by: Record<string, { d: number; t: number }> = {};
  for (const t of after) { const k = t.type ?? "?"; by[k] ??= { d: 0, t: 0 }; by[k].t++; if (isTaskDoneState(t)) by[k].d++; }
  console.log("\nوصل صارت: " + Object.entries(by).map(([k, v]) => `${k} ${v.d}/${v.t}`).join(" · "));
  if (!APPLY) console.log("تشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
