/**
 * وقائع 5/8: نصوص مانغو، شهرا التوظيف ٩ و١٠، وتصحيح تواريخ عبادة.
 *
 * تصحيحات القائدة على تقرير الرفع:
 * - «خطة التوظيف كنت باعتة خطة 3 أشهر (8 و9 و10)» — صح: «خطة جوبس.docx» فيها
 *   الشهر الأول/الثاني/الثالث، والاستيراد الآلي تخطّاها لأنها نثر أسبوعي مو
 *   جدول مرقّم. البنود هون منقولة منها حرفياً، بالترتيب، ومربوطة بأسبوعها.
 * - «مانغو انرسلت مبارح» — «3 Scripts For Shooting- Mango.docx» (4/8، بعد آخر
 *   تصدير عندي 3/8 10:16) — التلات سكريبتات على ريلات مانغو.
 * - «عبادة مبارح توقع العقد، الخطة لازم يومين لـ3 من التوقيع» — التوقيع 4/8
 *   (مو 3/8 متل ما انحط أول مرة)، فالنشر من 11/8 وكتابة الخطة مستحقة 6/8.
 *
 * متكافئ التشغيل وبخطوة البناء — النص بينكتب عالفاضي بس (ما بيكتب فوق تعديل
 * حد)، والتواريخ بتتصحح بس إذا لسا على قيمها القديمة الغلط.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
let changes = 0;

/** برييف لقطعة بهويتها — عالفاضي بس، ولكل مراحلها (الإنتاج والنشر). */
async function setBrief(
  companyId: string,
  type: string,
  month0: number,
  year: number,
  pieceNo: number,
  brief: string,
) {
  const cards = await prisma.task.findMany({
    where: { companyId, type, month: month0, year, pieceNo, status: { not: "CANCELED" } },
  });
  if (!cards.length) {
    console.log(`  ⚠️ ما في كروت: ${type}#${pieceNo} (${year}-${month0 + 1})`);
    return;
  }
  for (const t of cards) {
    if (t.brief?.trim()) continue; // نص موجود = ملك صاحبه
    changes++;
    if (APPLY) await prisma.task.update({ where: { id: t.id }, data: { brief } });
  }
  console.log(`  ✏️ ${type}#${pieceNo} (${year}-${month0 + 1}) ← ${brief.split("\n")[0].slice(0, 50)}…`);
}

// ═════════ مانغو — التلات سكريبتات (وصلت 4/8) ═════════
const MANGO_REELS: string[] = [
  [
    "(تصوير — مرجع: instagram.com/reel/DbTCQ22oa3E)",
    "أول شي نصور قارمة المحل، وبعدين مايكل طالع من المحل مع ورد وتيك أوي من عندون.",
  ].join("\n"),
  [
    "(تصوير — مرجع: instagram.com/reel/DZVTGkKNDSk)",
    "مع أصوات ASMR لكل شي.",
  ].join("\n"),
  [
    "(تصوير — «بسطة المنغا»)",
    "مايكل لابس لبس قديم وبالأبيض والأسود، أوديو قديم، ومعه متل بسطة منغا عم ينادي",
    "ويبيع، وحدا بيقول إنو صار شوب ليندبورد وبقصلو منغاية — وهون بيطلع إنو تبع",
    "المحل عم يحلم أو يتخيل. منرجع للواقع بأغنية من أغاني الشامي وهو فايق على صوت",
    "زبونة بتطلب مشروب اسمه إنكليزي وطويل، فبيصير يحضّره ببروسيس طويلة وبيتحسر",
    "قديش كان الموضوع أسهل من قبل.",
  ].join("\n"),
];

// ═════════ التوظيف — الشهر الثاني (أيلول) والثالث (تشرين١) من «خطة جوبس» ═════════
const JOBS_M2_REELS = [
  "قصة نجاح أولى — «يوم في حياة موظف وجد شغله عبر PhoeniJobs» (الأسبوع ١)",
  "«شكلك لسا ما سمعت عن فوني جوبز» — استهداف الباحثين عن Part-time وRemote (الأسبوع ٢)",
  "تعاون مع مؤثر موثوق: مراجعة حقيقية للمنصة (الأسبوع ٣)",
  "تعاون مع مؤثر شبابي: ريل «جربت أدور شغل عبر PhoeniJobs» (الأسبوع ٣)",
  "تعاون مع مؤثرة lifestyle (+20K): «كيف لقيت شغل Remote وأنا بسورية» (الأسبوع ٤)",
  "ريل Re-targeting: نسخة إعلانية محسّنة للزوار غير المسجلين (الأسبوع ٤)",
];
const JOBS_M2_POSTS = [
  "Story يومية: شرح إكمال الملف الشخصي — خطوة خطوة (الأسبوع ١)",
  "بوست وظائف يومي بالقالب الثابت",
  "كاروسيل: «كيف تكمل ملفك على PhoeniJobs خلال 5 دقائق» (الأسبوع ٢)",
  "بوست تفاعلي: «هل تؤمن بالعمل عن بعد؟» — تصويت (الأسبوع ٢)",
  "كاروسيل: «أكثر الوظائف طلباً هذا الأسبوع على PhoeniJobs» (الأسبوع ٣)",
  "بوست: أول قصة نجاح حقيقية (الأسبوع ٣)",
  "بوست: تقرير الشهر الثاني — أرقام حقيقية وشفافة (الأسبوع ٤)",
];
const JOBS_M3_REELS = [
  "سلسلة «من صفر لعقد»: قصة موظف من بدء البحث حتى التوقيع (الأسبوع ١)",
  "«يوم في حياة موظف Remote سوري وجد شغله عبر PhoeniJobs» (الأسبوع ١)",
  "«هل أنت طالب جامعي؟ PhoeniJobs بيساعدك تلاقي أول فرصة قبل التخرج» (الأسبوع ٢)",
  "قصة نجاح ثانية — بتخصص مختلف عن الأولى (الأسبوع ٣)",
];
const JOBS_M3_POSTS = [
  "«أول X توظيف عبر PhoeniJobs — شكراً للجميع» (الأسبوع ١)",
  "بوست وظائف يومي بالقالب الثابت",
  "إعلان شراكة: «PhoeniJobs شريك التوظيف الرسمي لجهة X» (الأسبوع ٢)",
  "المسابقة الشهرية — الجائزة كتابة CV احترافي (الأسبوع ٢)",
  "إطلاق ميزة Featured Job — بوست يشرح المزايا للشركات (الأسبوع ٣)",
  "تقرير بصري شامل: «90 يوم من PhoeniJobs — الأرقام الحقيقية» (الأسبوع ٤)",
  "بوست تكريم: أوائل الشركات والباحثين المسجلين (الأسبوع ٤)",
  "«شو اللي رح يتغير بالشهر الرابع؟» — بناء ترقب (الأسبوع ٤)",
];

const SRC2 = "من «خطة جوبس» (خطة الأشهر الثلاثة)";

async function main() {
  // ── مانغو ──
  console.log("═══ مانغو — سكريبتات الريلات الثلاثة ═══");
  const mango = await prisma.company.findFirst({ where: { name: "مانغو" } });
  if (mango)
    for (let i = 0; i < MANGO_REELS.length; i++)
      await setBrief(mango.id, "REEL", 7, 2026, i + 1, MANGO_REELS[i]);

  // ── التوظيف ٩ و١٠ ──
  console.log("\n═══ التوظيف — الشهر الثاني (أيلول) ═══");
  const jobs = await prisma.company.findFirst({ where: { name: "التوظيف" } });
  if (jobs) {
    for (let i = 0; i < JOBS_M2_REELS.length; i++)
      await setBrief(jobs.id, "REEL", 8, 2026, i + 1, `${JOBS_M2_REELS[i]}\n${SRC2}`);
    for (let i = 0; i < JOBS_M2_POSTS.length; i++)
      await setBrief(jobs.id, "POST", 8, 2026, i + 1, `${JOBS_M2_POSTS[i]}\n${SRC2}`);
    console.log("\n═══ التوظيف — الشهر الثالث (تشرين١) ═══");
    for (let i = 0; i < JOBS_M3_REELS.length; i++)
      await setBrief(jobs.id, "REEL", 9, 2026, i + 1, `${JOBS_M3_REELS[i]}\n${SRC2}`);
    for (let i = 0; i < JOBS_M3_POSTS.length; i++)
      await setBrief(jobs.id, "POST", 9, 2026, i + 1, `${JOBS_M3_POSTS[i]}\n${SRC2}`);
  }

  // ── عبادة: التوقيع 4/8 والنشر من 11/8 ──
  console.log("\n═══ عبادة — تصحيح التواريخ ═══");
  const obada = await prisma.company.findFirst({ where: { name: { contains: "عبادة" } } });
  if (obada) {
    const wrongSign = obada.contractStartDate?.toLocaleDateString("en-CA") === "2026-08-03";
    if (wrongSign) {
      console.log("  📋 التوقيع 3/8 → 4/8، النشر 10/8 → 11/8 (أسبوع التحضير من التوقيع الفعلي)");
      changes++;
      if (APPLY)
        await prisma.company.update({
          where: { id: obada.id },
          data: { contractStartDate: new Date(2026, 7, 4), publishStartDate: new Date(2026, 7, 11) },
        });
    }
    // «الخطة لازم يومين لـ3 من التوقيع» — كرت كتابة خطة عبادة مستحق 6/8.
    const plan = await prisma.task.findFirst({
      where: { companyId: obada.id, stage: "WRITE", status: { not: "CANCELED" } },
    });
    if (plan && plan.readyDate?.toLocaleDateString("en-CA") !== "2026-08-06") {
      console.log(`  ⏱ كرت الخطة: ${plan.readyDate?.toLocaleDateString("en-CA") ?? "—"} → 2026-08-06 (يومان من التوقيع)`);
      changes++;
      if (APPLY)
        await prisma.task.update({
          where: { id: plan.id },
          data: { readyDate: new Date(2026, 7, 6), workDate: new Date(2026, 7, 5), isPinned: true },
        });
    }
    if (!plan) console.log("  ⚠️ ما في كرت كتابة خطة لعبادة بعد — بينوجد بإعادة الجدولة وبيلحقه البناء الجاي");
  }

  console.log(`\n${APPLY ? "انطبّق" : "رح ينطبّق"} ${changes} تغيير.`);
  if (!APPLY) console.log("تشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
