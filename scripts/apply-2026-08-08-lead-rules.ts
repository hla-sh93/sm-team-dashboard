/**
 * قراران من القائدة (8/8) — تصنيف شغل خارج الخطة.
 *
 * ١) «الأغلفة تبع الريلات اعتبرن شغل إضافي لسابين»: أغلفة الريلات بتوصل
 *    بأرقام أكبر من خطة الشركة («dr nour -reel cover-7-10» والخطة ٦ ريلات)،
 *    فما إلها كرت وبتضل ملفاً بلا مطابقة. صارت كروت إضافية منجزة باسم سابين
 *    بتاريخ إرسالها الفعلي — الشغل بينحسب بالحمل والتقارير بلا ما يلمس عداد
 *    العقد.
 *
 * ٢) «فونيتيك ما بدي أحط ستوريز بالخطة لأن حسب الحاجة»: العقد بيضل ٠ ستوري،
 *    والستوري الواصلة بتنسجّل كشغل إضافي — نفس المنطق: محسوبة كإنتاج، خارج
 *    التعاقد.
 *
 *   npx tsx scripts/apply-2026-08-08-lead-rules.ts [--apply]   ← بخطوة البناء
 *
 * متكافئ التشغيل: المعرّف مشتقّ من اسم الملف، فتشغيلة تانية ما بتكرّر.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

/** شغل إضافي وصل على تلغرام: [الشركة، اسم الملف، الشخص، الساعات، العنوان] */
const EXTRAS: { company: string; file: string; who: string; hours: number; title: string }[] = [
  { company: "مخبر", file: "dr nour -reel cover-7-10.jpg", who: "e_sabin", hours: 1, title: "غلاف ريل — مخبر د.نور (10)" },
  { company: "مخبر", file: "dr nour -reel cover-7-11.jpg", who: "e_sabin", hours: 1, title: "غلاف ريل — مخبر د.نور (11)" },
  { company: "Phoenitech", file: "phoenitech story 5-8.JPG", who: "e_sabin", hours: 1, title: "ستوري حسب الحاجة — Phoenitech (5)" },
];

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

async function main() {
  let changes = 0;
  for (const x of EXTRAS) {
    const co = await prisma.company.findFirst({ where: { name: { contains: x.company } } });
    if (!co) {
      console.log(`⚠️ ما لقيت «${x.company}»`);
      continue;
    }
    const id = `extra_${slug(x.file)}`;
    if (await prisma.task.findUnique({ where: { id } })) continue;

    // تاريخ الإرسال الفعلي من سجل تلغرام — وإلا اليوم.
    const msg = await prisma.telegramMessage.findFirst({
      where: { fileName: x.file },
      orderBy: { sentAt: "asc" },
    });
    const at = msg?.sentAt ?? new Date();

    console.log(`➕ ${x.title} · ${at.toLocaleDateString("en-CA")} · منجز`);
    changes++;
    if (!APPLY) continue;
    await prisma.task.create({
      data: {
        id,
        kind: "ADHOC",
        title: x.title,
        hours: x.hours,
        quantity: 1,
        priority: "NORMAL",
        status: "READY",
        board: "DONE",
        stage: "DESIGN",
        workDate: at,
        readyDate: at,
        startedAt: at,
        finishedAt: at,
        completedAt: at,
        month: at.getMonth(),
        year: at.getFullYear(),
        week: Math.ceil(at.getDate() / 7),
        isPinned: true,
        isAuto: false,
        companyId: co.id,
        assigneeId: x.who,
        notes: `شغل خارج الخطة (قرار القائدة 8/8) — وصل على تلغرام: ${x.file}`,
      },
    });
    // الملف صار إلو كرت — نربطه فيه حتى ما يضل «وصل ولم يُطابق».
    if (msg) await prisma.telegramMessage.update({ where: { id: msg.id }, data: { taskId: id, matchedBy: "TYPE", confirmed: true } });
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
