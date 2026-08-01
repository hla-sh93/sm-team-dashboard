/**
 * خطة إطلاق PhoeniJobs («خطة جوبس.docx» / PhoeniTech - JobsPlan.pdf) → مهام.
 *
 * The 3-month launch plan (Build Trust → Activate Users → إثبات القيمة) is
 * week-by-week activity that the content cycles do NOT cover: stories,
 * carousels, LinkedIn posts/articles, the 11 blog articles, the Telegram
 * channel, B2B outreach, ads/influencers and the visual reports. The reels and
 * feed posts the plan mentions are ALREADY the cycle cards (July + August plans
 * are entered with briefs), so they are deliberately absent here — adding them
 * again would double the contract.
 *
 * One ADHOC card per person per channel per week, the week's bullets in
 * `brief`. Pinned, deterministic ids (`jobsplan_<yyyymm>_w<n>_<slot>`) —
 * idempotent, and `--reset` deletes every card of the set that hasn't started.
 *
 *   npx tsx scripts/add-jobs-launch-plan.ts            # dry run
 *   npx tsx scripts/add-jobs-launch-plan.ts --apply
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const RESET = process.argv.includes("--reset");

type Slot = {
  slot: string;
  person: "حلا" | "نوال" | "عمر";
  stage: "DESIGN" | "WRITE" | "PUBLISH";
  title: string;
  hours: number;
  brief: string[];
};
type Week = { week: 1 | 2 | 3 | 4; slots: Slot[] };
type Month = { year: number; month: number; label: string; weeks: Week[] };

const D = "DESIGN" as const, W = "WRITE" as const, P = "PUBLISH" as const;

const PLAN: Month[] = [
  {
    year: 2026, month: 7, label: "الشهر الأول — بناء الثقة (Build Trust)",
    weeks: [
      { week: 1, slots: [
        { slot: "prep", person: "حلا", stage: D, hours: 3, title: "تجهيز ما قبل الإطلاق — القالب اليومي والحسابات",
          brief: [
            "تصميم قالب يومي ثابت لنشر الوظائف (يُستعمل طول الحملة)",
            "Bio الحسابات: كلمة واحدة أو جملة غامضة — لا اسم المنصة بعد",
            "ستوري يومية هالأسبوع: «شو أصعب شي بتواجهك لما تدور شغل؟» — بدون إجابة",
          ] },
        { slot: "channels", person: "عمر", stage: P, hours: 2, title: "تجهيز القنوات قبل الانطلاق",
          brief: [
            "تجهيز صفحات فيسبوك + انستغرام + لينكد إن + أكس + قناة تلغرام جاهزين للإطلاق",
            "التأكد من نقاط الموقع قبل الإطلاق: رقم التواصل الحقيقي (+963 935 614 823)، 20 وظيفة منشورة، 10 شركات مسجلة، اختبار صفحة التسجيل موبايل ولابتوب، تفعيل Google Analytics",
          ] },
        { slot: "linkedin", person: "نوال", stage: W, hours: 2, title: "لينكد إن — بوست «سوق العمل السوري: إحصاءات مثيرة للتفكير»",
          brief: ["بوست مهني بإحصاءات عن سوق العمل السوري — أسبوع الفضول، لا اسم المنصة بعد"] },
      ] },
      { week: 2, slots: [
        { slot: "design", person: "حلا", stage: D, hours: 3, title: "يوم الإطلاق — ستوري التسجيل وأول 10 وظائف",
          brief: [
            "Story: شرح خطوات التسجيل بـ30 ثانية — CTA «سجّل الآن، الرابط بالبايو»",
            "نشر أول 10 وظائف حقيقية بالقالب الموحد",
            "دعم حفل الإطلاق: دعوة الشركات لندوة الإطلاق والتعريف بالخدمات",
          ] },
        { slot: "linkedin", person: "نوال", stage: W, hours: 3, title: "لينكد إن — إطلاق الصفحة + مقال «لماذا أطلقنا PhoeniJobs»",
          brief: [
            "إطلاق صفحة الشركة — بوست رسمي من المؤسسين",
            "مقال في الموقع: «لماذا أطلقنا PhoeniJobs — ومن نحن»",
          ] },
        { slot: "blog", person: "نوال", stage: W, hours: 3, title: "المدونة — المقال 1: «أفضل الوظائف الشاغرة في سورية»",
          brief: ["يُنشر كبوست مختصر على لينكد إن مع رابط المقال"] },
        { slot: "telegram", person: "عمر", stage: P, hours: 2, title: "تلغرام — إطلاق القناة",
          brief: [
            "أول رسالة: «وظائف اليوم على PhoeniJobs»",
            "رسالة ترحيب مع رابط تسجيل مباشر",
          ] },
        { slot: "outreach", person: "عمر", stage: P, hours: 2, title: "Outreach — 10 شركات: عرض الأشهر المجانية",
          brief: ["«أنت أول من يجرب المنصة — X أشهر مجانية كاملة»، وظائف مخصصة: Entry-level للخريجين، مهنية للمحترفين، Remote"] },
      ] },
      { week: 3, slots: [
        { slot: "design", person: "حلا", stage: D, hours: 3, title: "كاروسيل «أكثر 5 أخطاء CV» + ستوري التسجيل بدقيقة",
          brief: [
            "كاروسيل 5 شرائح: «أكثر 5 أخطاء بتخلي CV يتجاهل»",
            "Story: «كيف تسجل على PhoeniJobs خلال دقيقة واحدة»",
          ] },
        { slot: "linkedin", person: "نوال", stage: W, hours: 3, title: "لينكد إن — مقال خفض تكاليف التوظيف + بوست الـ50 متقدم",
          brief: [
            "مقال: «كيف تخفض تكاليف التوظيف بنسبة 40% في سورية»",
            "بوست: «مشهد 50 متقدم ومافي وقت تراجعهم، أديش بيتكرر هالمشهد معك؟»",
          ] },
        { slot: "blog", person: "نوال", stage: W, hours: 3, title: "المدونة — المقال 2: «كيف تكتب CV يقبله أصحاب العمل السوريون»",
          brief: ["الكلمة المفتاحية: كتابة CV بالعربي / سيرة ذاتية احترافية", "يُنشر كبوست لينكد إن مع 3 نصائح مختصرة + رابط المقال"] },
        { slot: "publish", person: "عمر", stage: P, hours: 2, title: "Outreach 5 شركات جديدة + وظائف تلغرام والقالب اليومي",
          brief: ["نشر الوظائف اليومي على تلغرام + بوست الوظائف بالقالب الثابت"] },
      ] },
      { week: 4, slots: [
        { slot: "design", person: "حلا", stage: D, hours: 3, title: "تقرير «أول أسبوعين» البصري + مسابقة CV",
          brief: [
            "تقرير بصري: «أول أسبوعين — X وظيفة، X شركة، X مسجل»",
            "تصميم مسابقة: «شارك CV خاصتك واحصل على تعديل مجاني» (ملاحظات واستشارات حول الـCV)",
          ] },
        { slot: "blog", person: "نوال", stage: W, hours: 3, title: "المدونة — المقال 3: «العمل عن بعد للسوريين — الدليل الشامل 2026»",
          brief: ["الكلمة المفتاحية: عمل عن بعد سورية / Remote work Syria", "يُنشر كبوست لينكد إن مع رابط"] },
        { slot: "publish", person: "عمر", stage: P, hours: 2, title: "إدارة مسابقة الـCV + وظائف تلغرام والقالب اليومي",
          brief: ["متابعة مشاركات المسابقة", "نشر الوظائف اليومي"] },
      ] },
    ],
  },
  {
    year: 2026, month: 8, label: "الشهر الثاني — تفعيل المستخدمين (Activate Users)",
    weeks: [
      { week: 1, slots: [
        { slot: "ads", person: "حلا", stage: D, hours: 3, title: "إطلاق Meta Ads — Lead Generation",
          brief: [
            "استهداف 18–35 سنة، سورية — هدف Lead Generation",
            "الميزانية: ريل ممول واحد أسبوعياً — 4$ يومياً × 10 أيام = 40$ للإعلان",
            "Story يومية: شرح إكمال الملف الشخصي خطوة خطوة",
          ] },
        { slot: "linkedin", person: "نوال", stage: W, hours: 3, title: "لينكد إن — مقال الكوادر السورية + بوست الملف المثالي",
          brief: [
            "مقال: «لماذا الكوادر السورية من أفضل الخيارات للعمل Remote؟»",
            "بوست: «كيف يبدو الملف الشخصي المثالي على PhoeniJobs»",
          ] },
        { slot: "blog", person: "نوال", stage: W, hours: 3, title: "المدونة — المقال 4: «كيف تجتاز مقابلة العمل بنجاح — 10 نصائح عملية»",
          brief: ["الكلمة المفتاحية: مقابلة عمل نصائح", "يُنشر كبوست لينكد إن مع أبرز 3 نصائح"] },
        { slot: "outreach", person: "عمر", stage: P, hours: 2, title: "Outreach 10 شركات (رسالة مع إحصاء متقدمين) + وظائف يومية",
          brief: ["وظائف يومية على تلغرام والقالب الثابت"] },
      ] },
      { week: 2, slots: [
        { slot: "design", person: "حلا", stage: D, hours: 3, title: "كاروسيل «كمّل ملفك خلال 5 دقائق» + بوست تصويت",
          brief: [
            "كاروسيل: «كيف تكمل ملفك على PhoeniJobs خلال 5 دقائق»",
            "بوست تفاعلي: «هل تؤمن بالعمل عن بعد؟» — تصويت",
          ] },
        { slot: "linkedin", person: "نوال", stage: W, hours: 3, title: "لينكد إن — مقال فريق Remote + بوست إحصاءات الشهر الأول",
          brief: [
            "مقال: «كيف تبني فريق Remote ناجح بتكلفة منخفضة»",
            "بوست: إحصاءات الشهر الأول للموقع — شفافية تبني الثقة مع الشركات",
          ] },
        { slot: "blog", person: "نوال", stage: W, hours: 3, title: "المدونة — المقال 5: «أفضل مواقع العمل عن بعد للعرب في 2026»",
          brief: ["الكلمة المفتاحية: مواقع عمل عن بعد عربي"] },
        { slot: "publish", person: "عمر", stage: P, hours: 2, title: "Outreach 10 شركات + تصويت التخصصات والبث الأسبوعي",
          brief: [
            "تلغرام: تصويت «شو أكثر تخصص عم تدور فيه وظيفة؟» — لبناء بيانات",
            "بث أسبوعي: نصائح إكمال الملف الشخصي + وظائف يومية",
          ] },
      ] },
      { week: 3, slots: [
        { slot: "influencers", person: "حلا", stage: D, hours: 3, title: "المؤثرون — تنسيق التعاونين",
          brief: [
            "تعاون مع مؤثر موثوق: مراجعة حقيقية للمنصة",
            "تعاون مع مؤثر شبابي: ريل «جربت أدور شغل عبر PhoeniJobs»",
          ] },
        { slot: "design", person: "حلا", stage: D, hours: 2, title: "كاروسيل «الوظائف الأكثر طلباً» + بوست أول قصة نجاح",
          brief: [
            "كاروسيل: «أكثر الوظائف طلباً هذا الأسبوع على PhoeniJobs»",
            "بوست: أول قصة نجاح حقيقي",
          ] },
        { slot: "linkedin", person: "نوال", stage: W, hours: 2, title: "لينكد إن — بوست العرض الخاص + شهادة أول شركة",
          brief: [
            "بوست: «عرض خاص لأصحاب الشركات — X أشهر مجانية تنتهي قريباً»",
            "بوست: شهادة من أول شركة استخدمت المنصة",
          ] },
        { slot: "blog", person: "نوال", stage: W, hours: 3, title: "المدونة — المقال 6: «الفرق بين العمل المكتبي والعمل عن بعد — أيهما يناسبك؟»",
          brief: ["الكلمة المفتاحية: عمل remote مقابل مكتبي"] },
        { slot: "outreach", person: "عمر", stage: P, hours: 2, title: "Outreach 10 شركات جديدة + وظائف يومية",
          brief: ["وظائف يومية على تلغرام والقالب الثابت"] },
      ] },
      { week: 4, slots: [
        { slot: "ads", person: "حلا", stage: D, hours: 3, title: "مؤثرة lifestyle + إعلانات الصفحات الكبيرة + ريل Re-targeting",
          brief: [
            "تعاون مع مؤثرة lifestyle (20K+): «كيف لقيت موظف يمنتج الريلزات بسوريا»",
            "إعلان على صفحات كبيرة في سوريا + حمالت ممولة مستمرة للريلزات",
            "ريل Re-targeting: نسخة إعلانية محسّنة للزوار غير المسجلين",
            "بوست: تقرير الشهر الثاني للموقع — أرقام حقيقية وشفافة",
          ] },
        { slot: "linkedin", person: "نوال", stage: W, hours: 3, title: "لينكد إن — مقال LinkedIn Profile + ملخص شهر الاكتساب",
          brief: [
            "مقال: «كيف تكتب LinkedIn Profile يجذب أصحاب العمل» — يُنشر أيضاً في المدونة نفس الأسبوع (المقال 7)",
            "بوست: ملخص شهر الاكتساب — ماذا تعلمنا وما الذي سيتغير؟",
          ] },
        { slot: "publish", person: "عمر", stage: P, hours: 2, title: "Outreach متابعة جميع الشركات + استطلاع الميزة",
          brief: [
            "متابعة لجميع الشركات التي تواصلنا معها الأسابيع الماضية",
            "تلغرام: استطلاع «شو الميزة اللي بدك نضيفها للمنصة؟» + وظائف يومية",
          ] },
      ] },
    ],
  },
  {
    year: 2026, month: 9, label: "الشهر الثالث — إثبات القيمة",
    weeks: [
      { week: 1, slots: [
        { slot: "design", person: "حلا", stage: D, hours: 3, title: "سلسلة «من صفر لعقد» + حملة Re-targeting + بوست أول توظيف",
          brief: [
            "إطلاق سلسلة «من صفر لعقد»: قصة موظف من بدء البحث حتى التوقيع",
            "حملة Re-targeting: استهداف كل من زار الموقع ولم يسجل",
            "بوست: «أول X توظيف عبر PhoeniJobs — شكراً للجميع»",
          ] },
        { slot: "linkedin", person: "نوال", stage: W, hours: 3, title: "لينكد إن — دراسة حالة + مقال سوق العمل + شهادات فيديو",
          brief: [
            "دراسة حالة: شركة استخدمت PhoeniJobs ووجدت موظفها خلال مدة X",
            "مقال: «سوق العمل السوري 2026 — الواقع والتوقعات» — يُنشر في المدونة نفس الأسبوع (المقال 8) وكـArticle مطوّل على لينكد إن",
            "بوست: شهادات فيديو من أصحاب الشركات",
          ] },
        { slot: "publish", person: "عمر", stage: P, hours: 2, title: "تلغرام — Poll الاختصاصات الناقصة + وظائف يومية",
          brief: ["Poll: اقتراحات / اختصاصات لم يتم إضافتها بعد"] },
      ] },
      { week: 2, slots: [
        { slot: "design", person: "حلا", stage: D, hours: 3, title: "إعلان الشراكة + المسابقة الشهرية",
          brief: [
            "بوست: «PhoeniJobs شريك التوظيف الرسمي لجهة X» — إعلان شراكة",
            "بوست للطلاب الجامعيين: «PhoeniJobs بيساعدك تلاقي أول فرصة عملك قبل التخرج»",
            "مسابقة شهرية: الجائزة مساعدة في كتابة CV احترافي",
          ] },
        { slot: "linkedin", person: "نوال", stage: W, hours: 3, title: "لينكد إن — بوست شراكة الجامعات + مقال المهن الرقمية",
          brief: [
            "بوست: إعلان شراكة مع جامعات ومراكز تدريب",
            "مقال: «أفضل المهن الرقمية للعمل عن بعد من سورية» — يُنشر في المدونة (المقال 9) وكـArticle على لينكد إن — الكلمة المفتاحية: مهن رقمية / freelance سورية",
          ] },
        { slot: "outreach", person: "عمر", stage: P, hours: 2, title: "Outreach 5 شركات جديدة (أصحاب عمل) + وظائف يومية",
          brief: ["وظائف يومية على تلغرام والقالب الثابت"] },
      ] },
      { week: 3, slots: [
        { slot: "design", person: "حلا", stage: D, hours: 3, title: "إطلاق ميزة Featured Job + دراسة تفعيل الأجور",
          brief: [
            "بوست يشرح مزايا «Featured Job» للشركات",
            "دراسة إمكانية تفعيل الأجور: قياس الأداء قبل إعلان ميزة الدفع — اقتراحان: الدفع عند نشر وظيفة أو نسبة عند التوظيف الفعلي",
          ] },
        { slot: "linkedin", person: "نوال", stage: W, hours: 3, title: "لينكد إن — بوست باقات الشركات + المقال 10",
          brief: [
            "إطلاق باقات الشركات: بوست يوضح الفرق بين Free / Basic / Pro",
            "المدونة — المقال 10: «كيف تبني فريق Remote ناجح بتكلفة منخفضة» — موجه للـStartups، يُنشر كـArticle على لينكد إن مع CTA لباقة Pro",
          ] },
        { slot: "outreach", person: "عمر", stage: P, hours: 2, title: "Outreach مخصص للشركات التي نشرت ولم تجدد + وظائف يومية",
          brief: ["وظائف يومية على تلغرام والقالب الثابت"] },
      ] },
      { week: 4, slots: [
        { slot: "design", person: "حلا", stage: D, hours: 3, title: "تقرير «90 يوم» + بوست التكريم + تشويق الشهر الرابع",
          brief: [
            "تقرير بصري شامل: «90 يوم من PhoeniJobs — الأرقام الحقيقية»",
            "بوست تكريم: أوائل الشركات والباحثين المسجلين",
            "بوست: «شو اللي رح يتغير بالشهر الرابع؟» — بناء ترقب جديد",
          ] },
        { slot: "linkedin", person: "نوال", stage: W, hours: 3, title: "لينكد إن — مقال «ماذا تعلمنا في 90 يوم» + دعوة Q&A + المقال 11",
          brief: [
            "مقال: «ماذا تعلمنا في أول 90 يوم من PhoeniJobs»",
            "بوست: دعوة الشركات لجلسة Q&A مباشرة",
            "المدونة — المقال 11: «أكثر المهارات المطلوبة في سوق العمل السوري» — الكلمة المفتاحية: مهارات مطلوبة سورية",
            "مراجعة SEO: أي المقالات حقق ترتيباً — ابنِ عليها في الشهر الرابع",
          ] },
        { slot: "publish", person: "عمر", stage: P, hours: 2, title: "Outreach متابعة شركات الأشهر الثلاثة + الاستطلاع النهائي",
          brief: [
            "متابعة جميع الشركات التي تواصلنا معها خلال 3 أشهر",
            "تلغرام: استطلاع نهائي «كيف قيّم تجربتك مع المنصة؟» + وظائف يومية",
          ] },
      ] },
    ],
  },
];

async function main() {
  const co = await prisma.company.findFirst({ where: { name: "التوظيف" } });
  if (!co) throw new Error("ما لقيت شركة التوظيف");
  const people = new Map<string, string>();
  for (const name of ["حلا", "نوال", "عمر"]) {
    const e = await prisma.employee.findFirst({ where: { name } });
    if (!e) throw new Error(`ما لقيت ${name}`);
    people.set(name, e.id);
  }

  if (RESET) {
    const del = await prisma.task.deleteMany({
      where: { id: { startsWith: "jobsplan_" }, status: "NOT_STARTED", startedAt: null },
    });
    console.log(`حُذف ${del.count} كرت (اللي ما انبلش فيه بس).`);
    await prisma.$disconnect();
    return;
  }

  let created = 0, skipped = 0;
  for (const m of PLAN) {
    console.log(`\n=== ${m.label} — ${m.year}-${m.month + 1} ===`);
    for (const w of m.weeks) {
      // الأسبوع n يشتغل من يوم (n-1)*7+1 وينجز قبل نهايته.
      const workDate = new Date(m.year, m.month, (w.week - 1) * 7 + 1);
      const readyDate = new Date(m.year, m.month, w.week * 7);
      for (const s of w.slots) {
        const id = `jobsplan_${m.year}${String(m.month + 1).padStart(2, "0")}_w${w.week}_${s.slot}_${s.person === "حلا" ? "h" : s.person === "نوال" ? "n" : "o"}`;
        const exists = await prisma.task.findUnique({ where: { id } });
        console.log(
          `  w${w.week} · ${s.person} · ${s.title} (${s.hours}h)` + (exists ? "  [موجود]" : ""),
        );
        if (exists) { skipped++; continue; }
        created++;
        if (!APPLY) continue;
        await prisma.task.create({
          data: {
            id,
            kind: "ADHOC",
            title: s.title,
            hours: s.hours,
            quantity: 1,
            priority: "NORMAL",
            status: "NOT_STARTED",
            board: "TODO",
            stage: s.stage,
            workDate,
            readyDate,
            month: m.month,
            year: m.year,
            week: w.week,
            isPinned: true, // خطة الإطلاق ثابتة — الجدولة الآلية ما بتلمسها
            isAuto: false,
            companyId: co.id,
            assigneeId: people.get(s.person)!,
            brief: s.brief.map((b) => `• ${b}`).join("\n"),
            notes: "خطة إطلاق PhoeniJobs (خطة جوبس) — خارج عدّاد خطة المحتوى",
          },
        });
      }
    }
  }

  console.log(`\n${APPLY ? "أُنشئ" : "رح يُنشأ"} ${created} كرت` + (skipped ? ` — ${skipped} موجود مسبقاً` : ""));
  if (!APPLY) console.log("تشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
