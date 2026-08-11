/**
 * BW — كل ما موعده مضى صار منجزاً (إفادة القائدة 10/8).
 *
 * «سكر كل كروت شهر تموز كنشر ومهام لbw» ثم، لمّا بان إنّ تموز مسكّر أصلاً
 * (٢٢ من ٢٣) وإنّ المتأخر كلّه من آب: «كل ما موعده مضى».
 *
 * والجرد سنَد جزءاً منه بدليل: بوست ١ نزل 6/8 وبوست ٢ نزل 20/7، والاتنان
 * انطابقوا بالمحتوى على صفحة `bw.marketingservices`. الباقي (تصوير ريل ١ و٢،
 * مونتاجهما، نشر ريل ١) على إفادة القائدة — وهي الأدرى بشغل فريقها.
 *
 * التاريخ موعد الكرت نفسه لا اليوم: الشغل خلص بموعده أو قريباً منه، وختمه
 * باليوم بيمحي التأخير من السجل وبيزوّر تقرير الأداء.
 */
import { PrismaClient } from "@prisma/client";
import { isTaskDoneState, taskDeadline } from "../src/lib/constants";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

/** دليل الجرد لمن ثبت نشره على الصفحة — الباقي بإفادة القائدة. */
const SCANNED: Record<string, string> = {
  "POST|1": "منشور على انستغرام 2026-08-06 (مطابقة محتوى) — instagram.com/p/DbsugTUAPNj",
  "POST|2": "منشور على انستغرام 2026-07-20 (مطابقة محتوى) — instagram.com/p/DbAem1xAIHO",
};

async function main() {
  const co = await prisma.company.findFirst({ where: { name: { contains: "BW" } } });
  if (!co) return console.log("ما لقيت BW — تخطّي");

  const today = new Date();
  const all = await prisma.task.findMany({
    where: { companyId: co.id, status: { not: "CANCELED" } },
  });
  // استحقاق الكرت بقاعدة النظام نفسها (`taskDeadline`): المرحلة الإنتاجية
  // موعدها **تسليمها** لا نشر قطعتها. تفضيل تاريخ النشر كان بيسقّط تصوير ريل
  // ٢ (مستحقّ 2/8) لأن نشره 11/8 لسا ما إجا — والتصوير هو المتأخر لا النشر.
  const due = all.filter((t) => {
    if (isTaskDoneState(t)) return false;
    const d = taskDeadline(t);
    return d != null && d < today;
  });
  if (!due.length) return console.log("BW — ولا كرت مستحقّ مفتوح");

  console.log(`BW · ${due.length} كرت موعده مضى → منجز\n`);
  for (const t of due) {
    const at = taskDeadline(t)!;
    const proof = t.type && t.pieceNo != null ? SCANNED[`${t.type}|${t.pieceNo}`] : undefined;
    console.log(
      `  ${t.stage} ${t.type ?? ""}${t.pieceNo ?? ""} · ${at.toISOString().slice(0, 10)}` +
        (proof ? " · بدليل الجرد" : " · بإفادة القائدة"),
    );
    if (!APPLY) continue;
    await prisma.task.update({
      where: { id: t.id },
      data: {
        status: t.stage === "PUBLISH" ? "PUBLISHED" : "READY",
        board: "DONE",
        startedAt: t.startedAt ?? at,
        finishedAt: at,
        completedAt: at,
        isPinned: true,
        notes: [t.notes, proof ?? "إفادة القائدة 10/8: كل ما موعده مضى عند BW منجز"]
          .filter(Boolean)
          .join(" · "),
      },
    });
  }
  console.log(APPLY ? `\n✅ انسكّر ${due.length}` : "\nتشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
