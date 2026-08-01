/**
 * ليلة 1/8/2026 — شغلتين:
 *
 * 1. **محتوى ريلات برو**: «ما بدي مهام بلا وصف» — خطة التصوير
 *    (BRU_Shooting_Plan.pdf، نوال 23/7) فيها 6 ريلات بسيناريوهاتها، وهنّ
 *    الستة الباقيين بدورة 18/7 → منكتبهن على كروت ريل 3–8 بالترتيب.
 *
 * 2. **أول ريل توظيف انتشر**: ماجد بعت «phoenijobs 1-8 edited» والقائدة ردّت
 *    «تم النشر» (8:34 م). القراءة: قطعة 1 بشهر 8 = ريل 1 آب. الويبهوك الحي
 *    عالإنتاج بيلقطها لحالو من هلق — هون منسجّلها محلياً حتى تتطابق النسختين.
 *
 *   npx tsx scripts/apply-bru-briefs-and-jobs-reel1.ts --apply
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

/** [رقم كرت الريل بالدورة، عنوان الخطة، ملخص السيناريو] */
const BRU_BRIEFS: [number, string, string][] = [
  [3, "قهوتك مو طلب... هية مود", "POV سريع بيربط كل مود بمشروب: «قلّي مودك وأنا بقلّك مشروبك» — اسبريسو للصحيان، لاتيه للنفسية الحلوة، آيس للجو الحر، ميلك شيك للتدليل. تصوير عمودي، zoom in/whip pan، أوديو تريند. ختام: أي مود ما كان... إلو مشروب من عنا."],
  [4, "ASMR القهوة", "بدون كلام نهائياً: طحن الحب → تنقيط الاسبريسو → رغوة الحليب بالستيمر → تكسير التلج → رج الشيكر. ماكرو قريب + مايك قريب من الصوت، بلا موسيقى إطلاقاً. تكست أول الريل: «حط السماعات 🎧». ختام: BRU — كل رشفة إلها صوتها الخاص."],
  [5, "من الحبة للكوب — سينمائي", "رحلة حبة القهوة من الخام للكوب بأسلوب درامي: تساقط الحبوب سلو موشن → الطحن → البودرة لاسبريسو → الحليب/الآيس بانسيابية → الكوب بإيد الباريستا مع اللوغو. Low angle + spotlight وخلفية معتمة، موسيقى سينمائية وcross-dissolve."],
  [6, "تحدي الدقيقة الواحدة", "تحدي سرعة بين باريستيين لنفس المشروب، عداد 40 ثانية وsplit screen. ما منبيّن مين ربح — المتابعين يحزروا بالكومنتس والنتيجة عالستوري. لقطات: البداية سوا، الأيدي بسرعة، العداد من فوق، ردة فعل الفريق، الكوبين جنب بعض."],
  [7, "جولة الزبون — لقطة وحدة متواصلة", "One shot من دخول الزبون لأول رشفة: الباب → الديكور والألوان → الكاونتر والطلب (بلا صوت، موسيقى بس) → التحضير من بعيد → الطاولة. Gimbal بلا أي قطع. افتتاح: «يوم عادي بكافيه BRU» — ختام: «زورونا... الفايب هون مختلف»."],
  [8, "الخدعة اللي بتوقف السكرول", "ماجيك ترانزيشن: كاميرا ثابتة 100% عالترايبود، حدا يمرق قدام الكاميرا والكوب بيتبدل لنكهة تانية، وتكرار لنكهة تالتة. ختام: صف الأكواب التلاتة + «جرب كل نكهات BRU... شو رح تختار؟». أهم شي: صفر اهتزاز بين اللقطات."],
];

async function main() {
  // ---- 1. برو ---------------------------------------------------------------
  const bru = await prisma.company.findFirst({ where: { name: "برو" } });
  if (!bru) throw new Error("ما لقيت برو");
  for (const [pieceNo, title, brief] of BRU_BRIEFS) {
    const shoot = await prisma.task.findFirst({
      where: { companyId: bru.id, type: "REEL", stage: "SHOOT", pieceNo, year: 2026, month: 6, status: { not: "CANCELED" } },
    });
    if (!shoot) { console.log(`⚠️ ما لقيت برو ريل ${pieceNo}`); continue; }
    console.log(`برو ريل ${pieceNo} ← «${title}»`);
    if (!APPLY) continue;
    const text = `${title}\n${brief}`;
    await prisma.task.updateMany({
      where: { pipelineKey: shoot.pipelineKey ?? "", status: { not: "CANCELED" } },
      data: { brief: text },
    });
  }

  // ---- 2. التوظيف ريل 1 آب — مصوّر ومنشور -----------------------------------
  const jobs = await prisma.company.findFirst({ where: { name: "التوظيف" } });
  const at = new Date(2026, 7, 1, 20, 34);
  const shoot1 = await prisma.task.findFirst({
    where: { companyId: jobs!.id, type: "REEL", stage: "SHOOT", pieceNo: 1, year: 2026, month: 7, status: { not: "CANCELED" } },
  });
  if (shoot1 && APPLY) {
    await prisma.task.update({
      where: { id: shoot1.id },
      data: {
        status: "READY", board: "DONE", isPinned: true,
        startedAt: shoot1.startedAt ?? at, finishedAt: at, completedAt: at,
        notes: [shoot1.notes, "تسليم: phoenijobs 1-8 edited · ماجد · 1/8"].filter(Boolean).join(" · "),
      },
    });
    await prisma.task.updateMany({
      where: { pipelineKey: shoot1.pipelineKey ?? "", stage: "PUBLISH", status: { not: "CANCELED" } },
      data: { status: "PUBLISHED", board: "DONE", startedAt: at, finishedAt: at, completedAt: at, isPinned: true },
    });
    console.log("التوظيف ريل 1 (آب): مصوّر (ماجد) + منشور (تأكيد القائدة «تم النشر» 8:34 م) ✅");
  }

  if (!APPLY) console.log("\nتشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
