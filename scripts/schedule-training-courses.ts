/**
 * التدريب — جدولة مدفوعة بتواريخ الدورات، مو بالشهر التقويمي.
 *
 * قاعدة القائدة: «الخطط بتتصمم من منتصف الشهر للشهر اللاحق، والنشر يكون قبل
 * موعد الدورة بـ10 أيام. يعني ما في موعد أو خطة ثابتة، حسب الدورات وتواريخها».
 *
 * التواريخ مقروءة من جدولي البرامج المرسلين على التوبيك:
 *   للتصميم_جدول_البرامج_والورش_التدريبية_لشهر_آب_2026.docx
 *   جدول البرامج التدريبيةلشهر ايلول 9.docx
 *
 * لكل دورة بينتعمل كرتين مثبّتين: **تصميم** (يسلّم قبل النشر بيومين) و**نشر**
 * (بالضبط قبل بداية الدورة بـ10 أيام). مثبّتين و`isAuto=false` فإعادة الجدولة
 * ما بتلمسهن. معرّفات ثابتة → إعادة التشغيل ما بتكرّر.
 *
 *   npx tsx scripts/schedule-training-courses.ts --apply
 *   npx tsx scripts/schedule-training-courses.ts --reset   # يحذف يلي ما انبلش
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const RESET = process.argv.includes("--reset");

/** كم يوم قبل بداية الدورة لازم ينزل الإعلان. */
const PUBLISH_DAYS_BEFORE = 10;
/** التصميم يخلص قبل النشر بهالمدة. */
const DESIGN_DAYS_BEFORE_PUBLISH = 2;

type Course = { slug: string; title: string; start: [number, number, number]; hours: string };

const COURSES: Course[] = [
  // آب 2026
  { slug: "flutter", title: "البرنامج التدريبي Flutter", start: [2026, 7, 1], hours: "50 ساعة" },
  { slug: "films", title: "ورشة صناعة الأفلام القصيرة", start: [2026, 7, 9], hours: "5 ساعات" },
  { slug: "marketing", title: "التسويق الاستراتيجي وإدارة العلامات التجارية", start: [2026, 7, 16], hours: "15 ساعة" },
  { slug: "ai-hr", title: "ورشة الذكاء الاصطناعي والتحول الرقمي في الموارد البشرية", start: [2026, 7, 23], hours: "12 ساعة" },
  // أيلول 2026
  { slug: "teacher", title: "البرنامج التدريبي إعداد معلم", start: [2026, 8, 6], hours: "10 ساعات · أ. عدنان ضوبي" },
  { slug: "ai-admin", title: "توظيف الذكاء الاصطناعي في تطوير المهارات الإدارية", start: [2026, 8, 13], hours: "12 ساعة · أ. سليم البسطامي" },
  { slug: "security", title: "ورشة كيف يعمل المخترقون وكيف تحمي نفسك", start: [2026, 8, 20], hours: "6 ساعات · أ. يحيى الصبيح" },
  { slug: "future-work", title: "ورشة مستقبل العمل والمحتوى الرقمي المعتمد على الذكاء الاصطناعي", start: [2026, 8, 27], hours: "6 ساعات · أ. نديم أبو علي" },
];

const shift = (d: Date, days: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
};
const iso = (d: Date) => d.toLocaleDateString("en-CA");

/**
 * «قبل الدورة بـ10 أيام» ممكن يوقع بعطلة الناشر (عمر بيداوم السبت←الأربعاء،
 * فالخميس مستحيل). منرجع لأقرب يوم دوام **قبله** — النشر الأبكر بيحترم القاعدة،
 * والتأخير لأ.
 */
const backToWorkday = (d: Date, workDays: number[]) => {
  const x = new Date(d);
  for (let i = 0; i < 7 && !workDays.includes(x.getDay()); i++) x.setDate(x.getDate() - 1);
  return x;
};

async function main() {
  const co = await prisma.company.findFirst({ where: { name: "التدريب" } });
  if (!co) throw new Error("ما لقيت التدريب");
  const designer = await prisma.employee.findFirst({ where: { name: "حلا" } });
  const publisher = await prisma.employee.findFirst({ where: { name: "عمر" } });
  if (!designer || !publisher) throw new Error("ما لقيت حلا أو عمر");

  if (RESET) {
    const del = await prisma.task.deleteMany({
      where: { id: { startsWith: "course_" }, status: "NOT_STARTED", startedAt: null },
    });
    console.log(`انحذف ${del.count} كرت دورة (يلي ما انبلش فيه بس).`);
    await prisma.$disconnect();
    return;
  }

  const pubDays: number[] = JSON.parse((publisher.workDays as string) ?? "[6,0,1,2,3]");
  const desDays: number[] = JSON.parse((designer.workDays as string) ?? "[6,0,1,2,3]");

  let created = 0, skipped = 0;
  for (const c of COURSES) {
    const start = new Date(c.start[0], c.start[1], c.start[2]);
    const publishOn = backToWorkday(shift(start, -PUBLISH_DAYS_BEFORE), pubDays);
    const designBy = backToWorkday(shift(publishOn, -DESIGN_DAYS_BEFORE_PUBLISH), desDays);

    const rows: { id: string; stage: "DESIGN" | "PUBLISH"; title: string; who: string; work: Date; due: Date; hours: number }[] = [
      {
        id: `course_${c.slug}_design`, stage: "DESIGN",
        title: `تصميم إعلان: ${c.title}`, who: designer.id,
        work: backToWorkday(shift(designBy, -1), desDays), due: designBy, hours: 2,
      },
      {
        id: `course_${c.slug}_publish`, stage: "PUBLISH",
        title: `نشر إعلان: ${c.title}`, who: publisher.id,
        work: publishOn, due: publishOn, hours: 0.5,
      },
    ];

    for (const r of rows) {
      const exists = await prisma.task.findUnique({ where: { id: r.id } });
      if (exists) { skipped++; continue; }
      created++;
      console.log(
        `${r.stage === "DESIGN" ? "🎨" : "🚀"} ${iso(r.due)} — ${r.title}` +
          (r.stage === "PUBLISH" ? `  (الدورة تبلّش ${iso(start)})` : ""),
      );
      if (!APPLY) continue;
      await prisma.task.create({
        data: {
          id: r.id,
          kind: "ADHOC",
          title: r.title,
          hours: r.hours,
          quantity: 1,
          priority: "NORMAL",
          status: "NOT_STARTED",
          board: "TODO",
          stage: r.stage,
          workDate: r.work,
          readyDate: r.due,
          publishDate: r.stage === "PUBLISH" ? r.due : null,
          month: r.due.getMonth(),
          year: r.due.getFullYear(),
          week: Math.ceil(r.due.getDate() / 7),
          isPinned: true, // مواعيد الدورات ثابتة — المحرك ما بيعيد جدولتها
          isAuto: false,
          companyId: co.id,
          assigneeId: r.who,
          brief: `الدورة: ${c.title}\nتبلّش ${iso(start)} · ${c.hours}\nالنشر لازم يكون قبل البداية بـ${PUBLISH_DAYS_BEFORE} أيام.`,
          notes: "مجدول من جدول البرامج التدريبية — النشر قبل الدورة بـ10 أيام",
        },
      });
    }
  }

  console.log(`\n${APPLY ? "أُنشئ" : "رح يُنشأ"} ${created} كرت` + (skipped ? ` — ${skipped} موجود مسبقاً` : ""));
  if (!APPLY) console.log("تشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
