/**
 * أسبوع التحضير لعقد جديد — قاعدة القائدة (1/8/2026):
 *
 *   «عند توقيع عقد جديد بدك تعطينا أسبوع تحضير، طبعاً تحط فيه مهام بس مو نشر،
 *    ليجهز أول ريل» — «بين ما أخدنا حسابات واللوغو وجهّزنا تيمبليت وكتبنا الخطة
 *    ونزلنا صوّرنا».
 *
 * يعني الأسبوع الأول من أي عقد جديد: **شغل تحضير، وصفر نشر**. الإنتاج (تصميم
 * وتصوير وكتابة) بيمشي عادي — يلي بينزاح هو النشر بس، لأنو أول قطعة ما بتكون
 * جاهزة قبل ما يخلص التحضير.
 *
 *   npx tsx scripts/new-contract-prep-week.ts مانغو            # تجريبي
 *   npx tsx scripts/new-contract-prep-week.ts مانغو --apply
 */
import { PrismaClient } from "@prisma/client";
import { parseWorkDays } from "../src/lib/dates";
import { isTaskDoneState } from "../src/lib/constants";

const prisma = new PrismaClient();
const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const NAME = argv.find((a) => !a.startsWith("--"));
const PREP_DAYS = 7;
const DOW = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const label = (d: Date) => `${DOW[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;

/** مهام التحضير — مين بيعملها بيتحدد بالدور مو بالاسم، فبتشتغل لأي شركة. */
const PREP: { slug: string; title: string; role: "publisher" | "designer" | "writer"; hours: number; brief: string }[] = [
  { slug: "accounts", title: "استلام حسابات التواصل والصلاحيات", role: "publisher", hours: 2,
    brief: "استلام يوزرات وباسوردات الصفحات من الزبون، والتأكد من صلاحية النشر قبل ما تبلّش الدورة." },
  { slug: "brand", title: "استلام اللوغو والهوية البصرية", role: "designer", hours: 2,
    brief: "اللوغو بصيغة متجهة (AI/SVG/PDF)، الألوان، والخطوط. بلاها ما بينفع يتجهّز تيمبليت." },
  { slug: "template", title: "تجهيز التيمبليت (بوست + ستوري + ريل)", role: "designer", hours: 6,
    brief: "قوالب موحّدة للبوست والستوري وكفر الريل — هي أساس كل تصاميم الدورة." },
  { slug: "plan", title: "كتابة خطة الشهر الأول", role: "writer", hours: 8,
    brief: "خطة المحتوى الأولى: نص كل قطعة وسيناريو كل ريل. بتنبعت عالتوبيك حتى تنستورد عالكروت." },
  { slug: "shoot", title: "أول جلسة تصوير (2–3 ريل)", role: "publisher", hours: 1,
    brief: "تنسيق أول موعد تصوير مع الزبون — بيتطلب قبل الجلسة بيومين، والجلسة 2–3 ريلات." },
];

async function main() {
  if (!NAME) { console.error("الاستعمال: npx tsx scripts/new-contract-prep-week.ts <شركة> [--apply]"); process.exit(1); }
  const co = await prisma.company.findFirst({ where: { name: { contains: NAME } } });
  if (!co) { console.error(`ما لقيت «${NAME}»`); process.exit(1); }
  if (!co.contractStartDate) { console.error(`«${co.name}» بلا تاريخ عقد — ما فيني أحدد أسبوع التحضير`); process.exit(1); }

  const employees = await prisma.employee.findMany();
  const pick = (role: "publisher" | "designer" | "writer") => {
    if (role === "publisher") return employees.find((e) => /ناشر|publish/i.test(e.role));
    if (role === "writer") return employees.find((e) => /كات|writer/i.test(e.role));
    // المصمم: صاحب بوستات الشركة، وإلا أول مصمم
    return employees.find((e) => e.id === co.postOwnerId) ?? employees.find((e) => /designer|مصمم/i.test(e.role));
  };

  const start = new Date(co.contractStartDate);
  const prepEnd = new Date(start);
  prepEnd.setDate(prepEnd.getDate() + PREP_DAYS);
  console.log(`${co.name} — العقد ${label(start)} · أسبوع التحضير لحد ${label(prepEnd)}\n`);

  // ---- 1. مهام التحضير ------------------------------------------------------
  let created = 0;
  for (const [i, p] of PREP.entries()) {
    const emp = pick(p.role);
    if (!emp) { console.log(`⚠️ ما لقيت مسؤول لـ«${p.title}»`); continue; }
    const id = `prep_${co.slug ?? co.id}_${p.slug}`;
    if (await prisma.task.findUnique({ where: { id } })) { console.log(`= «${p.title}» موجود`); continue; }
    // موزّعة على أيام الأسبوع بالتسلسل، وكل وحدة بيوم دوام صاحبها
    const work = new Date(start);
    work.setDate(work.getDate() + Math.min(i, PREP_DAYS - 1));
    const days = parseWorkDays(emp.workDays as string);
    for (let k = 0; k < 7 && !days.includes(work.getDay()); k++) work.setDate(work.getDate() + 1);
    console.log(`🔧 ${label(work)} — ${emp.name}: ${p.title}`);
    created++;
    if (!APPLY) continue;
    await prisma.task.create({
      data: {
        id, kind: "ADHOC", title: `${p.title} — ${co.name}`, hours: p.hours, quantity: 1,
        priority: "IMPORTANT", status: "NOT_STARTED", board: "TODO",
        stage: p.role === "publisher" ? "PUBLISH" : p.role === "writer" ? "WRITE" : "DESIGN",
        workDate: work, readyDate: work, month: work.getMonth(), year: work.getFullYear(),
        week: Math.ceil(work.getDate() / 7), isPinned: true, isAuto: false,
        companyId: co.id, assigneeId: emp.id, brief: p.brief,
        notes: "أسبوع التحضير — عقد جديد: شغل تجهيز، ما في نشر",
      },
    });
  }

  // ---- 2. ولا نشر خلال أسبوع التحضير ---------------------------------------
  const early = (await prisma.task.findMany({
    where: { companyId: co.id, stage: "PUBLISH", status: { not: "CANCELED" }, publishDate: { lt: prepEnd } },
    orderBy: { publishDate: "asc" },
  })).filter((t) => !isTaskDoneState(t));
  console.log(`\n📅 ${early.length} كرت نشر واقع داخل أسبوع التحضير — بينزاح لبعده:`);
  const publisher = employees.find((e) => /ناشر|publish/i.test(e.role))!;
  const pubDays = parseWorkDays(publisher.workDays as string);
  const cursor = new Date(prepEnd);
  for (const t of early) {
    while (!pubDays.includes(cursor.getDay())) cursor.setDate(cursor.getDate() + 1);
    const d = new Date(cursor);
    console.log(`   ${t.type} ${t.pieceNo} → ${label(d)}`);
    if (APPLY)
      await prisma.task.update({ where: { id: t.id }, data: { publishDate: d, workDate: d, isPinned: true } });
    cursor.setDate(cursor.getDate() + 1);
  }

  console.log(`\n${APPLY ? "تم" : `رح يُنشأ ${created} كرت تحضير`}`);
  if (!APPLY) console.log("تشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
