/**
 * القطعة المنشورة إنتاجها منجز — بالضرورة.
 *
 * ما بينشر شي ما انعمل. فكرت نشر مسكّر وكرت تصميمه (أو تصويره أو مونتاجه) لسا
 * مفتوح تناقضٌ بذاته، وأثره مضاعف: الشغل بيبان مستحقاً على المصمّم وهو خالص،
 * وحمله بيطلع أعلى من الحقيقة، والمونتيرة بتظهر «متأخرة» على ريل اننشر.
 *
 * وقعت الحالة من طريقين:
 *   • **المطابقة بالعدد** (`reconcile-by-count`) بتسكّر كروت النشر وبس — أغاليا
 *     أخدت ١٠ قطع منشورة وإنتاجها مفتوح.
 *   • **إقفالات يدوية قديمة** — المخبر ريل ٤ و٥.
 *
 * الاتجاه واحد فقط: **النشر بيسحب الإنتاج معه، مو العكس**. قطعة منتَجة وما
 * انشرت شي طبيعي تماماً (هيك حال أغلب الشغل)، فما منلمس كروت النشر إطلاقاً.
 *
 *   npx tsx scripts/close-production-of-published.ts [--apply]   ← بخطوة البناء
 */
import { PrismaClient } from "@prisma/client";
import { isTaskDoneState, STAGES } from "../src/lib/constants";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main() {
  const all = await prisma.task.findMany({
    where: { status: { not: "CANCELED" } },
    include: { company: { select: { name: true } } },
  });
  const key = (t: (typeof all)[number]) => `${t.companyId}|${t.type}|${t.pieceNo}|${t.month}|${t.year}`;
  const byPiece = new Map<string, typeof all>();
  for (const t of all) byPiece.set(key(t), [...(byPiece.get(key(t)) ?? []), t]);

  /** ترتيب السلسلة: كتابة ← تصميم/تصوير ← مونتاج ← نشر. */
  const rank = (stage: string | null) => STAGES.indexOf(stage as never);

  let n = 0;
  for (const rows of byPiece.values()) {
    if (!rows[0].type) continue; // كروت بلا نوع (الكتابة) بتنعالج بحلقة الحواجز
    // أبعد مرحلة منجزة بالسلسلة — وكل يلي قبلها لازم يكون منجزاً متلها.
    const doneRank = Math.max(-1, ...rows.filter(isTaskDoneState).map((r) => rank(r.stage)));
    if (doneRank < 0) continue;
    const anchor = rows.filter(isTaskDoneState).sort((a, b) => rank(b.stage) - rank(a.stage))[0];
    const open = rows.filter((r) => !isTaskDoneState(r) && rank(r.stage) >= 0 && rank(r.stage) < doneRank);
    if (!open.length) continue;
    const at = anchor.completedAt ?? anchor.finishedAt ?? new Date();
    console.log(
      `  ${rows[0].company?.name ?? "—"} · ${rows[0].type}#${rows[0].pieceNo} → ${open.map((r) => r.stage).join(" + ")}`,
    );
    n += open.length;
    if (!APPLY) continue;
    for (const t of open)
      await prisma.task.update({
        where: { id: t.id },
        data: {
          status: "READY",
          board: "DONE",
          // الإنتاج سبق النشر، فتاريخه تاريخ النشر لا اليوم — وإلا بيطلع
          // الكرت «انخلص بعد ما اننشر».
          startedAt: t.startedAt ?? at,
          finishedAt: at,
          completedAt: at,
          isPinned: true,
          notes: [t.notes, `أُقفل تبعاً لمرحلة لاحقة منجزة (${anchor.stage}): السلسلة ما بتتخطّى`]
            .filter(Boolean)
            .join(" · "),
        },
      });
  }
  // ═══ الحاجز بيخلص لما يخلص كل يلي محجوز عليه ═══
  // كرت الكتابة عند جدارات كرت واحد بيحجز ١٢ تصميماً — مو قطعة-بقطعة، فما
  // بيمرق بمفتاح القطعة فوق. والتصاميم الاتناعش خلصوا، فبقاء الكتابة مفتوحة
  // بيخلّي نوال معلّق عليها شغل انتهى، وبيكسر ثابت «ولا كرت منجز وحاجزه مفتوح».
  const blockers = new Map<string, typeof all>();
  for (const t of all) if (t.blockedById) blockers.set(t.blockedById, [...(blockers.get(t.blockedById) ?? []), t]);
  const byId = new Map(all.map((t) => [t.id, t]));
  for (const [blockerId, deps] of blockers) {
    const blocker = byId.get(blockerId);
    if (!blocker || isTaskDoneState(blocker)) continue;
    if (!deps.every(isTaskDoneState)) continue;
    const at = deps
      .map((d) => d.completedAt ?? d.finishedAt)
      .filter((d): d is Date => !!d)
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? new Date();
    console.log(`  ${blocker.company?.name ?? "—"} · ${blocker.stage} «${(blocker.title ?? "").slice(0, 40)}» → منجز (${deps.length} تابع خلصوا)`);
    n++;
    if (!APPLY) continue;
    await prisma.task.update({
      where: { id: blocker.id },
      data: {
        status: "READY",
        board: "DONE",
        startedAt: blocker.startedAt ?? at,
        finishedAt: at,
        completedAt: at,
        isPinned: true,
        notes: [blocker.notes, `أُقفل تبعاً لتوابعه: ${deps.length} كرت محجوز عليه خلصوا كلهن`]
          .filter(Boolean)
          .join(" · "),
      },
    });
  }

  if (!n) return console.log("✅ ولا قطعة منشورة وإنتاجها مفتوح.");
  console.log(APPLY ? `\n✅ انسكّر ${n} كرت إنتاج` : `\n${n} كرت — تشغيل تجريبي، أضف --apply.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
