/**
 * مطابقة منشورات انستغرام المقروءة مع كروت النشر المفتوحة.
 *
 * الاستعمال: القائدة بتفتح صفحة الشركة بكرومها وبتسكرول، أنا بقرا الشبكة
 * بـ`INSTAGRAM_SCAN_SCRIPT` وبحفظ الناتج بملف، وهاد بيطابق ويسكّر.
 *
 *   npx tsx scripts/match-instagram-scan.ts <scan.json> <الشركة> [--apply]
 *
 * قاعدة المطابقة — التاريخ والنوع، مو الكابشن:
 *   منشور بتاريخ س ونوع ن  ⟷  أقدم كرت نشر مفتوح من نفس النوع موعده ≤ س + مهلة
 * المهلة لأنّ النشر بيصير بيومه أو بعده بيوم-يومين، بس **أبداً قبل موعده**
 * بأكتر من `EARLY_DAYS` — وإلا منسب منشور قديم لقطعة جديدة.
 *
 * كل إقفال بياخد **تاريخ المنشور الحقيقي** لا تاريخ التسجيل، ودليله رمز
 * المنشور — فبتقدري ترجعي تفتحيه وتتأكدي.
 */
import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";
import { isTaskDoneState } from "../src/lib/constants";
import type { ScanResult, ScannedPost } from "./lib/instagram-scan";

const prisma = new PrismaClient();
const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const [file, companyArg] = argv.filter((a) => !a.startsWith("--"));

/** المنشور ممكن ينزل بيومه أو بعده — بس مو قبل موعده بأكتر من هيك. */
const EARLY_DAYS = 2;
/** …ولا بعده بأكتر من هيك (وإلا هو قطعة تانية أصلاً). */
const LATE_DAYS = 21;

const dayDiff = (a: string, b: string) =>
  Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86400000);

async function main() {
  if (!file || !companyArg) {
    console.error("الاستعمال: npx tsx scripts/match-instagram-scan.ts <scan.json> <الشركة> [--apply]");
    process.exit(1);
  }
  const scan = JSON.parse(readFileSync(file, "utf8")) as ScanResult;
  const co = await prisma.company.findFirst({ where: { name: { contains: companyArg } } });
  if (!co) {
    console.error(`ما لقيت شركة «${companyArg}»`);
    process.exit(1);
  }

  const open = (
    await prisma.task.findMany({
      where: { companyId: co.id, stage: "PUBLISH", status: { not: "CANCELED" } },
      orderBy: [{ publishDate: "asc" }],
    })
  ).filter((t) => !isTaskDoneState(t) && t.type);

  const posts = scan.posts
    .filter((p): p is ScannedPost & { date: string } => !!p.date)
    .sort((a, b) => a.date.localeCompare(b.date));

  console.log(`\n■ ${co.name} — @${scan.handle}`);
  console.log(`  المقروء: ${scan.count} منشور (${scan.withDate} بتاريخ) · المفتوح: ${open.length} كرت\n`);

  const used = new Set<string>();
  const pairs: { post: ScannedPost & { date: string }; card: (typeof open)[number] }[] = [];
  const orphanPosts: (ScannedPost & { date: string })[] = [];

  for (const post of posts) {
    // النوع بيحصر أولاً: ريل ⟷ ريل، وصورة ⟷ بوست/ستوري. الريل أحياناً بينحط
    // برابط `/p/` كمان، فبنسمح بالتجاوز **بس** لما ما يكون في مرشّح من نوعه
    // وبنفس اليوم بالضبط — بلا هالقيد صورة بتسكّر كرت ريل، وهاد يلي صار
    // بالتجربة الأولى.
    const inWindow = (t: (typeof open)[number]) => {
      const due = (t.publishDate ?? t.readyDate)?.toISOString().slice(0, 10);
      if (!due) return false;
      const d = dayDiff(post.date, due);
      return d >= -EARLY_DAYS && d <= LATE_DAYS;
    };
    const isReelCard = (t: (typeof open)[number]) => t.type === "REEL" || t.type === "AI_REEL";
    const free = open.filter((t) => !used.has(t.id));
    const sameType = free.filter((t) => (post.kind === "REEL" ? isReelCard(t) : !isReelCard(t)));
    const exactCrossType = free.filter(
      (t) =>
        (post.kind === "REEL" ? !isReelCard(t) : isReelCard(t)) &&
        (t.publishDate ?? t.readyDate)?.toISOString().slice(0, 10) === post.date,
    );
    const pool = sameType.some(inWindow) ? sameType : exactCrossType;
    const candidate = pool
      .filter(inWindow)
      // الأقرب لموعده أولاً؛ وعند التساوي الأقدم.
      .sort((a, b) => {
        const da = Math.abs(dayDiff(post.date, (a.publishDate ?? a.readyDate)!.toISOString().slice(0, 10)));
        const db = Math.abs(dayDiff(post.date, (b.publishDate ?? b.readyDate)!.toISOString().slice(0, 10)));
        return da - db || (a.publishDate ?? new Date()).getTime() - (b.publishDate ?? new Date()).getTime();
      })[0];

    if (!candidate) {
      orphanPosts.push(post);
      continue;
    }
    used.add(candidate.id);
    pairs.push({ post, card: candidate });
  }

  for (const { post, card } of pairs) {
    const due = (card.publishDate ?? card.readyDate)!.toISOString().slice(0, 10);
    const late = dayDiff(post.date, due);
    console.log(
      `  ✅ ${post.date} ${post.kind === "REEL" ? "ريل " : "منشور"} → ${card.type}#${card.pieceNo}` +
        ` (موعده ${due}${late > 0 ? ` · تأخّر ${late} يوم` : late < 0 ? ` · بكّر ${-late}` : " · بوقته"})`,
    );
    if (!APPLY) continue;
    const at = new Date(post.date);
    await prisma.task.update({
      where: { id: card.id },
      data: {
        status: "PUBLISHED",
        board: "DONE",
        startedAt: card.startedAt ?? at,
        finishedAt: at,
        completedAt: at,
        isPinned: true,
        notes: [card.notes, `منشور على انستغرام (${post.date}) — instagram.com/p/${post.shortcode}`]
          .filter(Boolean)
          .join(" · "),
      },
    });
  }

  const stillOpen = open.filter((t) => !used.has(t.id));
  if (orphanPosts.length) {
    console.log(`\n  ⚠️ ${orphanPosts.length} منشور ما لقى كرت (خارج الخطة أو خارج المدى):`);
    for (const p of orphanPosts.slice(0, 8)) console.log(`     ${p.date} · ${(p.alt ?? "").slice(0, 60)}`);
  }
  if (stillOpen.length) {
    console.log(`\n  ⏳ ${stillOpen.length} كرت بقي مفتوح (ما لقيناله منشور):`);
    for (const t of stillOpen.slice(0, 8))
      console.log(`     ${t.type}#${t.pieceNo} — موعده ${(t.publishDate ?? t.readyDate)?.toISOString().slice(0, 10)}`);
  }

  console.log(`\n${APPLY ? "انسكّر" : "رح ينسكّر"} ${pairs.length} كرت.`);
  if (!APPLY) console.log("تشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
