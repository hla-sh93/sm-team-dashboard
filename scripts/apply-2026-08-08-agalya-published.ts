/**
 * بوستا أغاليا المؤكّدان — إغلاق بدليل نصّي حرفي لا بترجيح.
 *
 * جرد الصفحة (11/7 → 5/8) طلّع خمس بوستات من الفريق مقابل عشرة بالخطة.
 * تنّان منهن بيطابقوا نصّ الخطة حرفياً، والتلاتة الباقية الكابشن ما بيحسمها.
 * القائدة (8/8) اختارت «المؤكّدين فقط» — فما منخمّن الباقي.
 *
 * ليش ما اعتمدنا مطابقة الأداة كما هي؟ لأنها ضمّت كمان منشور «Dr.Maya Emam
 * Coming Soon» على قطعة الأسنان: تمهيد بلا نصّ خطة، والتطابق جا من كلمات
 * الفرع (Beauty · Clinic · Maya) مو من فكرة القطعة. اليقين شرطُه إنّ نصّ
 * المنشور مأخوذ من البريف، وهاد بيتحقّق بتنتين بس.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

/** القطعة ← (تاريخ النشر الفعلي، رمز المنشور، الجملة يلي أثبتت المطابقة). */
const CONFIRMED: { pieceNo: number; date: string; shortcode: string; proof: string }[] = [
  {
    pieceNo: 2,
    date: "2026-07-18",
    shortcode: "Da7iY4rM_qv",
    proof: "العناية ببشرتك مو رفاهية",
  },
  {
    pieceNo: 6,
    date: "2026-08-05",
    shortcode: "DbqRrkRs_5C",
    proof: "من أول استشارة بنبلش نرسم خطة تناسبك",
  },
];

async function main() {
  const co = await prisma.company.findFirst({ where: { name: { contains: "أغاليا" } } });
  if (!co) return console.log("ما لقيت أغاليا — تخطّي");

  for (const c of CONFIRMED) {
    const card = await prisma.task.findFirst({
      where: { companyId: co.id, type: "POST", pieceNo: c.pieceNo, stage: "PUBLISH" },
    });
    if (!card) {
      console.log(`POST#${c.pieceNo} — ما لقيت كرت نشر · تخطّي`);
      continue;
    }
    if (card.notes?.includes(c.shortcode)) {
      console.log(`POST#${c.pieceNo} — مسجّل أصلاً · تخطّي`);
      continue;
    }
    console.log(`POST#${c.pieceNo} → منشور ${c.date} · «${c.proof}»`);
    if (!APPLY) continue;
    const at = new Date(c.date);
    await prisma.task.update({
      where: { id: card.id },
      data: {
        status: "PUBLISHED",
        board: "DONE",
        startedAt: card.startedAt ?? at,
        finishedAt: at,
        completedAt: at,
        isPinned: true,
        notes: [
          card.notes,
          `منشور على انستغرام بـ${c.date} (مطابقة محتوى: «${c.proof}») — instagram.com/p/${c.shortcode}`,
        ]
          .filter(Boolean)
          .join(" · "),
      },
    });
  }
  console.log(APPLY ? "\n✅ انطبّق" : "\nتشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main()
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
