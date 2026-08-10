/**
 * مهمّتان من القائدة (8/8): موقع كابرياني · بوست عودة مدارس SKM.
 *
 * ⚠️ **الأولى انضافت من الواجهة وما وصلت القاعدة** — القائدة: «أنا ضفت مهمة
 * لحلا، تصميم موقع كابرياني، 5 أيام… ماطلع ضمن المهام اليومية». والجرد أكّد
 * إنّو ما في ولا كرت بهالاسم، وآخر كرت انعمل لحلا كان 5/8. فالمشكلة مو
 * بالعرض، الكرت أصلاً ما انخزّن.
 *
 * الترميز:
 * • **الوقت بالساعات لا بالأيام.** `WORK_DAY_HOURS = 8`، فخمس أيام = ٤٠ ساعة،
 *   والحزّام بيوزّعهن على أيام حلا (السبت→الأربعاء) لحاله. لو حطّينا ٥
 *   بيصيروا نصف يوم واحد.
 * • **مثبّت** — الكروت الإضافية ما بيولّدها المحرّك، فإعادة الجدولة بتمحيها
 *   إذا ما كانت مثبّتة.
 * • كابرياني والمدارس **شركات غير مُدارة** (بلا خطة شهرية)، وهاد صحيح: شغلهن
 *   عند الطلب. الكرت بينربط فيهن حتى يبان بتقاريرهن، بلا ما يدخل بأي خطة.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const WORK_DAY_HOURS = 8;

/** نصّ البوست كما وصل من الزبون — بينحفظ حرفياً حتى المصمّم يشتغل عليه. */
const SKM_BRIEF = `إعلان عودة — Smart Kids Montessori School

الفكرة: العدّ التنازلي لعودة الفريق يوم ١٨ آب للعام الدراسي الجديد.

النصّ المقترح من الزبون:
"The countdown is on… ⏳✨
Our team will be back on August 18th at Smart Kids Montessori School!
Managers ready to host you!
Let's kick off a new academic year filled with learning, growth, and confidence 📚
See you soon!"

الزبون منفتح على أفكار بديلة للتصميم والصياغة.`;

type NewTask = {
  key: string;
  title: string;
  company: string;
  assignee: string;
  hours: number;
  workDate: string;
  brief?: string;
  notes: string;
};

const TASKS: NewTask[] = [
  {
    key: "capriani-website",
    title: "تصميم موقع كابرياني",
    company: "كابرياني",
    assignee: "e_hla",
    hours: 5 * WORK_DAY_HOURS,
    workDate: "2026-08-09",
    notes: "طلب القائدة 8/8 — ٥ أيام عمل",
  },
  {
    key: "skm-back-to-school",
    title: "بوست عودة العام الدراسي — SKM",
    company: "المدارس",
    assignee: "e_sabin",
    hours: 2,
    // الإعلان عن ١٨/٨، فبيلزم ينزل قبلها بمهلة — والتصميم بيبلّش بكرا.
    workDate: "2026-08-10",
    brief: SKM_BRIEF,
    notes: "طلب الزبون عبر القائدة 8/8 — النشر قبل ١٨/٨",
  },
];

async function main() {
  for (const t of TASKS) {
    const co = await prisma.company.findFirst({ where: { name: { contains: t.company } } });
    if (!co) {
      console.log(`  ⚠️ ${t.company} — ما لقيتها، تخطّي`);
      continue;
    }
    const exists = await prisma.task.findFirst({
      where: { companyId: co.id, kind: "ADHOC", title: t.title },
    });
    if (exists) {
      console.log(`  ${t.title} — موجود أصلاً`);
      continue;
    }
    const at = new Date(t.workDate);
    console.log(
      `  ${t.title}\n     ${t.company} · ${t.assignee} · ${t.hours}س (${t.hours / WORK_DAY_HOURS} يوم) · يبلّش ${t.workDate}`,
    );
    if (!APPLY) continue;
    await prisma.task.create({
      data: {
        kind: "ADHOC",
        stage: "DESIGN",
        title: t.title,
        companyId: co.id,
        assigneeId: t.assignee,
        hours: t.hours,
        quantity: 1,
        month: at.getMonth(),
        year: at.getFullYear(),
        workDate: at,
        status: "NOT_STARTED",
        board: "TODO",
        priority: "NORMAL",
        isPinned: true,
        isAuto: false,
        ...(t.brief ? { brief: t.brief } : {}),
        notes: t.notes,
      },
    });
  }
  console.log(APPLY ? "\n✅ انطبّق" : "\nتشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
