/**
 * وصل — الستوريات اليومية داخلة بالعقد (قرار القائدة 1/8/2026):
 * «اذا مذكورة بالخطة فيك تحسبهن، لأن الزبون موافق على الخطة. وتترك الباقي غير
 * منجز بس تحطه بالوصف».
 *
 * خطة تموز فيها 20 صف ستوري:
 *   • ستوري 1–10 «يومي ثابت» — تحديث أسعار العملات والذهب، مواعيد الأخبار،
 *     Poll اتجاه السوق… وهي **نفسها** ستوريات الصرف والمفكرة اللي بيبعتها أيمن
 *     يومياً (27 ملف بتموز). فبتنحسب: 10/20.
 *   • ستوري 11–20 «اقتراح» — تيزر ريل، تقييم عميل، «خمّن السعر»… محتوى تاني
 *     ما انعمل، فبيضل مفتوح ومعو بريفه.
 *
 * والفائض خارج الخطة بينكتب بوصف الشركة بدل ما يضيع: البوستات اليومية (صرف
 * سوريا/تركيا، المفكرة، نتيجة الخبر، التحليل الفني) شغل حقيقي لأيمن بس مو من
 * عدّاد العقد — لهيك بينوثّق ولا بينحسب.
 *
 *   npx tsx scripts/fix-wasl-stories-from-plan.ts --apply
 */
import { PrismaClient } from "@prisma/client";
import { isTaskDoneState } from "../src/lib/constants";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

/** صفوف «يومي ثابت» بالخطة — انسلّمت كلها وأكتر. */
const DAILY_STORY_ROWS = 10;

/** الفائض خارج الخطة بتموز، من التصدير — للتوثيق مو للحساب. */
const OFF_PLAN_JULY =
  "خارج الخطة (تموز 2026): 42 بوست يومي — صرف تركيا 11 · صرف سوريا 9 · " +
  "المفكرة الاقتصادية 9 · نتيجة الخبر 2 · التحليل الفني 1 (وخبر عاجل 10 محسوبين " +
  "ضمن الخطة). شغل حقيقي لأيمن، بس مو من عدّاد العقد.";

async function main() {
  const co = await prisma.company.findFirst({ where: { name: { contains: "وصل" } } });
  if (!co) throw new Error("ما لقيت وصل");
  const at = new Date(2026, 6, 31);

  const stories = await prisma.task.findMany({
    where: { companyId: co.id, kind: "CONTENT", type: "STORY", stage: "DESIGN", status: { not: "CANCELED" } },
    orderBy: [{ publishDate: "asc" }, { pieceNo: "asc" }],
  });

  for (const [i, s] of stories.entries()) {
    const isDaily = i < DAILY_STORY_ROWS;
    if (!isDaily || isTaskDoneState(s)) continue;
    console.log(`✅ ستوري ${s.pieceNo} → منجز — ${(s.brief ?? "").replace(/\n/g, " ").slice(0, 42)}`);
    if (APPLY)
      await prisma.task.update({
        where: { id: s.id },
        data: {
          status: "READY", board: "DONE", isPinned: true,
          startedAt: s.startedAt && s.startedAt < at ? s.startedAt : at,
          finishedAt: at, completedAt: at,
        },
      });
  }

  const left = stories.slice(DAILY_STORY_ROWS).filter((s) => !isTaskDoneState(s));
  console.log(`\nضلّ مفتوح ${left.length} ستوري («اقتراح») — بريفاتها موجودة على الكروت.`);

  // الفائض خارج الخطة → وصف الشركة، حتى الشغل يكون مرئي بدون ما يضخّم العقد.
  if (APPLY && !co.offPlanKeywords?.includes("__noted")) {
    const prev = (await prisma.company.findUnique({ where: { id: co.id } }))!;
    await prisma.setting.upsert({
      where: { key: `company.offPlanNote:${prev.id}` },
      create: { key: `company.offPlanNote:${prev.id}`, value: OFF_PLAN_JULY },
      update: { value: OFF_PLAN_JULY },
    });
  }
  console.log(`\nتوثيق الفائض: ${OFF_PLAN_JULY}`);

  const after = await prisma.task.findMany({
    where: { companyId: co.id, kind: "CONTENT", stage: { in: ["DESIGN", "SHOOT"] }, status: { not: "CANCELED" } },
  });
  const by: Record<string, { d: number; t: number }> = {};
  for (const t of after) { const k = t.type ?? "?"; by[k] ??= { d: 0, t: 0 }; by[k].t++; if (isTaskDoneState(t)) by[k].d++; }
  console.log("وصل صارت: " + Object.entries(by).map(([k, v]) => `${k} ${v.d}/${v.t}`).join(" · "));
  if (!APPLY) console.log("تشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
