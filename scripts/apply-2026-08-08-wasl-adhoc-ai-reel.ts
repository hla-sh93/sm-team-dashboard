/**
 * ريل وصل الإضافي 23/7 — أيمن عمله بالذكاء الاصطناعي.
 *
 * ظهر بجرد انستغرام كريل منشور بلا كرت: «في عالم التداول… الخبر مو مجرد
 * تريند» (instagram.com/reel/DbIuVG7gsXQ). القائدة (8/8): «هذا شغل إضافي من
 * الفريق، اعمله كرت منجز» ثم «أيمن عمله AI».
 *
 * وغيابه عن تلغرام مو ثغرة بالتسجيل: الشغل المولّد بالذكاء الاصطناعي ما بيمرق
 * بمجموعة التسليم أصلاً، فالمصدر الوحيد يلي بيثبته هو الصفحة نفسها. لهيك
 * الجرد بالمحتوى بيمسك شغلاً ما بيمسكه أي مصدر تاني — وهاد بالضبط قيمته.
 *
 * كرت واحد بمرحلة تصميم على عرف الكروت الإضافية (مو تصوير + مونتاج): ما في
 * تصوير ينعمل، والتوليد والإخراج شغلة وحدة بيد أيمن.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

/** الرمز هو الهوية — إعادة التشغيل ما بتكرّر الكرت. */
const SHORTCODE = "DbIuVG7gsXQ";
const PUBLISHED_ON = new Date("2026-07-23");
const TITLE = "ريل AI إضافي — وصل: «الخبر مو مجرد تريند»";

async function main() {
  const co = await prisma.company.findFirst({ where: { name: { contains: "وصل" } } });
  if (!co) return console.log("ما لقيت وصل — تخطّي");
  const ayman = await prisma.employee.findFirst({ where: { id: "e_ayman" } });
  if (!ayman) return console.log("ما لقيت أيمن — تخطّي");

  const exists = await prisma.task.findFirst({
    where: { companyId: co.id, notes: { contains: SHORTCODE } },
  });
  if (exists) return console.log(`الكرت موجود أصلاً (${exists.id}) — تخطّي`);

  console.log(`${TITLE}\n  أيمن · 23/7 · منجز · instagram.com/reel/${SHORTCODE}`);
  if (!APPLY) return console.log("\nتشغيل تجريبي — أضف --apply.");

  await prisma.task.create({
    data: {
      kind: "ADHOC",
      type: "AI_REEL",
      stage: "DESIGN",
      title: TITLE,
      companyId: co.id,
      assigneeId: ayman.id,
      // ساعتين: التوليد بالذكاء الاصطناعي أسرع من المونتاج اليدوي بس مو مجاني —
      // والصفر بيخفي الشغل من الحمل (باغ معروف بالكروت الإضافية).
      hours: 2,
      quantity: 1,
      month: PUBLISHED_ON.getMonth(),
      year: PUBLISHED_ON.getFullYear(),
      workDate: PUBLISHED_ON,
      publishDate: PUBLISHED_ON,
      status: "PUBLISHED",
      board: "DONE",
      startedAt: PUBLISHED_ON,
      finishedAt: PUBLISHED_ON,
      completedAt: PUBLISHED_ON,
      // مثبّت حتى إعادة الجدولة ما تمحيه — الكروت الإضافية ما بيولّدها المحرّك.
      isPinned: true,
      isAuto: false,
      notes: `شغل إضافي خارج الخطة · أيمن عملُه بالذكاء الاصطناعي (إفادة القائدة 8/8) · منشور 23/7 — instagram.com/reel/${SHORTCODE}`,
    },
  });
  console.log("✅ انطبّق");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
