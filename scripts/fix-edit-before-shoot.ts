/**
 * المونتاج ما بيسبق تصويره.
 *
 * ثلاث سلاسل عند البلسم مونتاجها مؤرّخ ١/٨ وتصويرها ٤/٨ و٢١/٨ — يعني الكرت
 * بيطلب من أليسار تمنتج ريلاً ما انتصوّر بعد. والأثر مو تجميلياً: الكرت
 * بيظهر بشغلها اليوم، وبيتحسب متأخراً، وبيدخل حملها — وكلّه على شغل ما بيقدر
 * يبلّش.
 *
 * الإصلاح بيحرّك **المونتاج للأمام** لا التصوير للخلف: موعد التصوير متّفق
 * عليه مع الزبون (القائدة بتبعت الجدول أسبوعياً)، فهو المرساة. والمونتاج
 * بياخد يوم عمل بعد التصوير.
 *
 *   npx tsx scripts/fix-edit-before-shoot.ts [--apply]   ← بخطوة البناء
 */
import { PrismaClient } from "@prisma/client";
import { isTaskDoneState } from "../src/lib/constants";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

/** المونتاج بيبلّش بعد التصوير بيوم. */
const EDIT_LAG_DAYS = 1;

async function main() {
  const rows = await prisma.task.findMany({
    where: { stage: { in: ["SHOOT", "EDIT"] }, pipelineKey: { not: null }, status: { not: "CANCELED" } },
    include: { company: { select: { name: true } } },
  });
  const byPipe = new Map<string, typeof rows>();
  for (const t of rows) byPipe.set(t.pipelineKey!, [...(byPipe.get(t.pipelineKey!) ?? []), t]);

  let n = 0;
  for (const [, list] of byPipe) {
    const shoot = list.find((t) => t.stage === "SHOOT");
    const edit = list.find((t) => t.stage === "EDIT");
    if (!shoot || !edit) continue;
    // نفس قاعدة الفحص: المرحلة المنجزة تاريخها ختمها الفعلي، والمفتوحة تخطيطها.
    const eff = (t: (typeof rows)[number]) =>
      isTaskDoneState(t)
        ? (t.finishedAt ?? t.completedAt ?? t.readyDate ?? t.workDate)
        : (t.readyDate ?? t.workDate);
    const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const shotOn = eff(shoot);
    const editOn = eff(edit);
    if (!shotOn || !editOn || day(editOn) >= day(shotOn)) continue;

    // ═══ الحالة المعكوسة: المونتاج **خلص** والتصوير مؤرّخ بعده ═══
    // مونتاج البلسم انسلّم ٣١/٧ بدليل تلغرام، وكرت تصويره مؤرّخ ٢١/٨ — تاريخ
    // من المحرّك ما انصحّح لما وصل التسليم. الواقع إنّو انتصوّر قبل، فتأخير
    // المونتاج هون بيكذّب دليلاً موجوداً. المرساة بتنقلب: التصوير بيرجع لوراء.
    if (isTaskDoneState(edit)) {
      const at = edit.completedAt ?? edit.finishedAt ?? editOn;
      console.log(
        `  ${edit.company?.name ?? "—"} · ${edit.type}#${edit.pieceNo} · تصوير ${shotOn.toISOString().slice(0, 10)}` +
          ` → ${at.toISOString().slice(0, 10)} (مونتاجه خلص قبله)`,
      );
      n++;
      if (!APPLY) continue;
      await prisma.task.update({
        where: { id: shoot.id },
        data: {
          workDate: at,
          readyDate: shoot.readyDate && shoot.readyDate > at ? at : shoot.readyDate,
          // الفحص بيقارن **تاريخ الإنجاز الفعلي** للمرحلة المنجزة لا تخطيطها،
          // فتحريك `workDate` لحاله ما بيحلّ شي: لازم ختم التصوير يرجع كمان.
          //
          // ⚠️ والختم بينتنسخ **كما هو** من المونتاج، ما بينحسب من جديد: التواريخ
          // مخزّنة منتصف ليل محلي (٢١:٠٠ من اليوم السابق بالعالمي)، فمقارنة
          // بالعالمي بتقول «متساويين» ومقارنة بالمحلي بتقول «التصوير بعده بيوم».
          // نسخ نفس القيمة بينهي الالتباس من أصله.
          // وتاريخ البدء بينسحب معه: كرت «بلّش ١/٨ وخلص ٣١/٧» تناقض تاني.
          startedAt: shoot.startedAt && shoot.startedAt < at ? shoot.startedAt : at,
          ...(isTaskDoneState(shoot)
            ? { finishedAt: at, completedAt: at }
            : { status: "READY", board: "DONE", finishedAt: at, completedAt: at }),
          isPinned: true,
          notes: [shoot.notes, `أُرجع لتاريخ مونتاجه (${at.toISOString().slice(0, 10)}): المونتاج ما بيسبق التصوير`]
            .filter(Boolean)
            .join(" · "),
        },
      });
      continue;
    }

    const target = new Date(shotOn);
    target.setDate(target.getDate() + EDIT_LAG_DAYS);
    console.log(
      `  ${edit.company?.name ?? "—"} · ${edit.type}#${edit.pieceNo} · مونتاج ${editOn.toISOString().slice(0, 10)}` +
        ` → ${target.toISOString().slice(0, 10)} (تصوير ${shotOn.toISOString().slice(0, 10)})`,
    );
    n++;
    if (!APPLY) continue;
    await prisma.task.update({
      where: { id: edit.id },
      data: {
        workDate: target,
        // الجاهزية ما بتتقدّم على الشغل — وإلا رجع التناقض من الباب التاني.
        readyDate: edit.readyDate && edit.readyDate < target ? target : edit.readyDate,
        isPinned: true,
        notes: [edit.notes, `أُخّر ليتبع تصويره (${shotOn.toISOString().slice(0, 10)})`]
          .filter(Boolean)
          .join(" · "),
      },
    });
  }
  if (!n) return console.log("✅ ولا مونتاج سابق لتصويره.");
  console.log(APPLY ? `\n✅ انصلح ${n}` : `\n${n} — تشغيل تجريبي، أضف --apply.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
