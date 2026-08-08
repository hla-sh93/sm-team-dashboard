/**
 * تصوير المخبر يوم الأربعاء 5/8 — فيتامين د وB12 (إفادة القائدة 8/8).
 *
 * التلات إعادات كانت مجدولة للأربعاء، واتصوّر منها اتنين. «القيم الطبيعية»
 * بتضل مفتوحة — ما منسكّرها لأنّ الجدول قال أربعاء، الواقع هو المرجع.
 *
 * اللقطات ما وصلت المجموعة (مادة خام بالعادة ما بتنبعت)، فالنظام ما بيقدر
 * يعرف لحالو — لهيك بتنكتب كواقعة بدليلها: مين قال وإيمتى.
 *
 *   npx tsx scripts/apply-2026-08-08-noor-shot.ts [--apply]   ← بخطوة البناء
 *
 * متكافئ: الكرت المسكّر ما بينلمس، وكرت المونتاج بينزاح لأول يوم دوام بعد
 * التصوير الفعلي (مو بعد الموعد المخطّط).
 */
import { PrismaClient } from "@prisma/client";
import { isTaskDoneState } from "../src/lib/constants";
import { parseWorkDays } from "../src/lib/dates";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
/** الأربعاء 5/8/2026 — يوم التصوير الفعلي. */
const SHOT_AT = new Date(2026, 7, 5);
const SHOT: string[] = ["فيتامين د", "تحليل B12"];

async function main() {
  let changes = 0;
  const editor = (await prisma.employee.findMany()).find((e) => /مونتير|مونتاج|editor/i.test(e.role));
  const editorDays = parseWorkDays((editor?.workDays as string) ?? "[6,0,1,2,3]");

  for (const needle of SHOT) {
    const shoot = await prisma.task.findFirst({
      where: { kind: "ADHOC", stage: "SHOOT", title: { contains: needle }, status: { not: "CANCELED" } },
    });
    if (!shoot) {
      console.log(`⚠️ ما لقيت كرت تصوير فيه «${needle}»`);
      continue;
    }
    if (!isTaskDoneState(shoot)) {
      console.log(`✏️  تصوير «${needle}» → منجز (الأربعاء 5/8، ماجد)`);
      changes++;
      if (APPLY)
        await prisma.task.update({
          where: { id: shoot.id },
          data: {
            status: "READY",
            board: "DONE",
            startedAt: shoot.startedAt ?? SHOT_AT,
            finishedAt: SHOT_AT,
            completedAt: SHOT_AT,
            isPinned: true,
            notes: [shoot.notes, "إفادة القائدة 8/8: انتصوّر الأربعاء 5/8"].filter(Boolean).join(" · "),
          },
        });
    }

    // المونتاج بينزاح لأول يوم دوام **بعد التصوير الفعلي** — كان مؤرّخاً على
    // الموعد المخطّط، وتأريخ المونتاج قبل تصويره بيكذب على تقرير المدد.
    const edit = await prisma.task.findUnique({ where: { id: `${shoot.id}_edit` } });
    if (edit && !isTaskDoneState(edit)) {
      const at = new Date(SHOT_AT);
      for (let i = 0; i < 14; i++) {
        at.setDate(at.getDate() + 1);
        if (editorDays.includes(at.getDay())) break;
      }
      const cur = edit.readyDate?.toLocaleDateString("en-CA");
      if (cur !== at.toLocaleDateString("en-CA")) {
        console.log(`   ⏱ مونتاجه: ${cur ?? "—"} → ${at.toLocaleDateString("en-CA")}`);
        changes++;
        if (APPLY)
          await prisma.task.update({
            where: { id: edit.id },
            data: {
              workDate: at,
              readyDate: at,
              month: at.getMonth(),
              year: at.getFullYear(),
              week: Math.ceil(at.getDate() / 7),
            },
          });
      }
    }
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
