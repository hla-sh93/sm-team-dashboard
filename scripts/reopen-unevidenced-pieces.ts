/**
 * إرجاع قطع مسجّلة «منجزة» وما إلها ولا دليل بالمجموعة.
 *
 * القائدة: «تأكد من المحتوى كله قبل ما تحط مهام إنها متأخرة… **إذا ما لقيتها
 * حطها**». والعكس صحيح كمان: قطعة معلّمة منجزة بلا دليل بتكذب على التقارير.
 * انكشفت لما انفتحت الصور وانقرا نصّها بدل الاعتماد على الأسماء.
 *
 *   BW · آب · بوست 1 (الدفع الإلكتروني «دفعة وحدة معلّقة… تعني عميل ضائع»)
 *     دفعة 20/7 الوحيدة محتواها: متجر إلكتروني · منيو ذكي · وكالة سفر · متجر
 *     هدايا. ولا واحد فيهن عن الدفع الإلكتروني.
 *
 *   المخبر · تموز · بوست 6 («إذا عم تعطش طول الوقت… مو طبيعي»)
 *     المسلَّم 7 تصاميم، منها 2 خارج الخطة («ليش طلبوا Ferritin» 15/7 و«وراء كل
 *     نتيجة قرار» 25/7) → 5 على الخطة مقابل 6 صفوف مسكّرة.
 *
 *   npx tsx scripts/reopen-unevidenced-pieces.ts --apply
 */
import { PrismaClient } from "@prisma/client";
import { isTaskDoneState } from "../src/lib/constants";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

/** [الشركة، السنة، الشهر 0-based، النوع، رقم القطعة، السبب] */
const REOPEN: [string, number, number, string, number, string][] = [
  ["BW", 2026, 7, "POST", 1, "ما في تصميم عن الدفع الإلكتروني بدفعة 20/7"],
  ["مخبر", 2026, 6, "POST", 6, "5 تصاميم على الخطة مقابل 6 صفوف مسكّرة"],
  // «BW reel 2 July.mp4» انبعت ٢٢/٧ وريل **تموز** ٢ مسلّم من قبلها؛ استيراد
  // التصدير مرّق رقم القطعة على ريل آب ٢. المطابقة صارت توقف عند هالحالة.
  ["BW", 2026, 7, "REEL", 2, "«BW reel 2 July» هي ريل تموز ٢ المسلّم، مو تسليم لآب"],
];

async function main() {
  for (const [name, year, month, type, pieceNo, why] of REOPEN) {
    const co = await prisma.company.findFirst({ where: { name: { contains: name } } });
    if (!co) { console.log(`⚠️ ما لقيت ${name}`); continue; }
    // الريل بيتسكّر على كرت التصوير، والبوست على التصميم — فمنقبل الاتنين.
    const card = await prisma.task.findFirst({
      where: {
        companyId: co.id,
        type,
        stage: { in: ["DESIGN", "SHOOT"] },
        pieceNo,
        year,
        month,
        status: { not: "CANCELED" },
      },
    });
    if (!card) { console.log(`⚠️ ما لقيت ${co.name} ${type} ${pieceNo}`); continue; }
    if (!isTaskDoneState(card)) { console.log(`= ${co.name} ${type} ${pieceNo} مفتوح أصلاً`); continue; }
    console.log(`↩️ ${co.name} · ${type} ${pieceNo} → رجع مفتوح — ${why}`);
    if (!APPLY) continue;
    await prisma.task.update({
      where: { id: card.id },
      data: {
        status: "NOT_STARTED", board: "TODO",
        startedAt: null, finishedAt: null, completedAt: null,
        notes: [card.notes, `أُعيد فتحه بعد فحص المحتوى: ${why}`].filter(Boolean).join(" · "),
      },
    });
    // كرت النشر بيرجع معه — قطعة مو منتَجة ما بتكون منشورة.
    if (card.pipelineKey && APPLY)
      await prisma.task.updateMany({
        where: { pipelineKey: card.pipelineKey, stage: "PUBLISH", status: { not: "CANCELED" } },
        data: { status: "NOT_STARTED", board: "TODO", startedAt: null, finishedAt: null, completedAt: null },
      });
  }
  if (!APPLY) console.log("\nتشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
