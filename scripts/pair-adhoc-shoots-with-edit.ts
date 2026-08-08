/**
 * كل تصوير إضافي لازم يوصل للمونتيرة (قاعدة القائدة، 8/8).
 *
 * «صورنا للمخبر 2 ريل… ليش ما بيّن عند أليسار إنّ في تسليم 2 ريل؟» — لأنّ
 * كروت التصوير **الإضافية** (إعادة تصوير، تصوير خارج الخطة) بتنعمل لحالها
 * بلا مرحلة مونتاج. خط الإنتاج المخطّط بيفكّ الريل تصوير←مونتاج←نشر، أما
 * الإضافي فبيوقف عند التصوير — فالمصوّر بيصوّر والمونتيرة ما بتشوف شي، وشغلها
 * ما بينحسب بحملها ولا بتقاريرها.
 *
 * القاعدة: **لكل كرت تصوير إضافي، كرت مونتاج إضافي محجوز فيه.** الحجز بيخلّي
 * المونتاج يظهر لأليسار بس بعد ما يخلص التصوير — تماماً متل الريل المخطّط.
 *
 *   npx tsx scripts/pair-adhoc-shoots-with-edit.ts [--apply]   ← بخطوة البناء
 *
 * متكافئ التشغيل: المعرّف مشتقّ من كرت التصوير، فما بينكرّر.
 */
import { PrismaClient } from "@prisma/client";
import { parseWorkDays } from "../src/lib/dates";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

/** المونتيرة: بالدور مو بالاسم، فالبديل بيرث الشغل لحاله. */
async function findEditor() {
  const all = await prisma.employee.findMany();
  return all.find((e) => /مونتير|مونتاج|editor/i.test(e.role)) ?? null;
}

/** أول يوم دوام بعد تاريخ — المونتاج ما بيصير قبل ما يخلص التصوير. */
function nextWorkday(from: Date, workDays: number[]): Date {
  const d = new Date(from);
  for (let i = 0; i < 14; i++) {
    d.setDate(d.getDate() + 1);
    if (workDays.includes(d.getDay())) return d;
  }
  return d;
}

async function main() {
  const editor = await findEditor();
  if (!editor) {
    console.error("ما في مونتيرة بالفريق — ما بينعمل شي");
    process.exit(1);
  }
  const days = parseWorkDays(editor.workDays as string);

  const shoots = await prisma.task.findMany({
    where: { kind: "ADHOC", stage: "SHOOT", status: { not: "CANCELED" } },
    include: { company: true },
  });

  let created = 0;
  for (const s of shoots) {
    const id = `${s.id}_edit`;
    if (await prisma.task.findUnique({ where: { id } })) continue;

    const base = s.finishedAt ?? s.readyDate ?? s.workDate ?? new Date();
    const at = nextWorkday(base, days);
    const title = (s.title ?? "تصوير").replace(/^(إعادة )?تصوير( ريل)?:?\s*/, "");
    console.log(`➕ مونتاج: «${title.slice(0, 40)}» · ${s.company?.name} · ${at.toLocaleDateString("en-CA")}`);
    created++;
    if (!APPLY) continue;
    await prisma.task.create({
      data: {
        id,
        kind: "ADHOC",
        title: `مونتاج: ${title}`,
        hours: s.hours || 3,
        quantity: 1,
        priority: s.priority,
        status: "NOT_STARTED",
        board: "TODO",
        stage: "EDIT",
        workDate: at,
        readyDate: at,
        month: at.getMonth(),
        year: at.getFullYear(),
        week: Math.ceil(at.getDate() / 7),
        isPinned: true, // المحرّك ما بيولّد الإضافي — التثبيت بيحميه من التوليد
        isAuto: false,
        companyId: s.companyId,
        assigneeId: editor.id,
        // محجوز بالتصوير: ما بيظهر بيوم المونتيرة إلا لما يخلص تصويره.
        blockedById: s.id,
        brief: s.brief,
        notes: `مونتاج التصوير الإضافي — بينفتح لما يخلص «${(s.title ?? "").slice(0, 40)}»`,
      },
    });
  }

  console.log(`\n${APPLY ? "انعمل" : "رح ينعمل"} ${created} كرت مونتاج.`);
  if (!APPLY) console.log("تشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
