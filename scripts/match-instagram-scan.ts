/**
 * مطابقة منشورات انستغرام المقروءة مع كروت النشر المفتوحة.
 *
 * الاستعمال: القائدة بتفتح صفحة الشركة بكرومها وبتسكرول، أنا بقرا الشبكة
 * بـ`INSTAGRAM_SCAN_SCRIPT` وبحفظ الناتج بملف، وهاد بيطابق ويسكّر.
 *
 *   npx tsx scripts/match-instagram-scan.ts <scan.json> <الشركة> [--apply]
 *
 * ═══ القاعدة: المحتوى أولاً، والتاريخ مساعد ═══
 * القائدة (8/8): «الهدف المطابقة بالمحتوى مو بالتاريخ مع الكل — كل الشركات
 * بدي ياها مطابقة بالمحتوى وكابشن وتصميم مو بس تاريخ».
 *
 * وهي محقّة لسبب بنيوي: التاريخ بيكذب باتجاهين. وصل نشرت «أبرز مزايا منصة
 * التداول» قبل موعدها بيوم و«تعرف على قنواتنا» قبل موعدها بأربعة — فالمطابقة
 * بالتاريخ بترفضهن كأنّهن ما نزلوا. وبالمقابل، النشرات اليومية بتنزل كل يوم
 * فبتلتقط أي كرت موعده قريب وتسكّرو غلط.
 *
 * فالترتيب:
 *   ١. **المحتوى** — نصّ المنشور مقابل نصّ الخطة (نفس محرّك تلغرام). بلا أي
 *      قيد تاريخ: القطعة هي القطعة سواء نزلت مبكّر أو متأخر.
 *   ٢. **التاريخ** — بس للمنشور يلي ما لقى مطابقة بالمحتوى، وبشرط النوع.
 *   ٣. **بلا نصّ = بلا مطابقة** — التخمين بيسكّر كرت خطة بنشرة يومية.
 *
 * كل إقفال بياخد **تاريخ المنشور الحقيقي** لا تاريخ التسجيل، ودليله رمز
 * المنشور — فبتقدري ترجعي تفتحيه وتتأكدي.
 */
import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";
import { isTaskDoneState } from "../src/lib/constants";
import { matchByContent } from "../src/lib/telegram/match";
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

  const allPub = await prisma.task.findMany({
    where: { companyId: co.id, stage: "PUBLISH", status: { not: "CANCELED" } },
    orderBy: [{ publishDate: "asc" }],
  });
  // ⚠️ الستوري ما بتظهر بالشبكة إطلاقاً — بتختفي بعد ٢٤ ساعة. إدخال كروتها
  // بالمطابقة بيخلّي منشوراً واحداً يسكّر كرت ستوري بالغلط، ووصل لحالها عندها
  // ٢٠ ستوري بالدورة. الشبكة بتثبت البوستات والريلات وبس.
  const open = allPub.filter((t) => !isTaskDoneState(t) && t.type && t.type !== "STORY");
  const openStories = allPub.filter((t) => !isTaskDoneState(t) && t.type === "STORY");
  /** المسكّر أصلاً — منشور بيوافقه هو **تأكيد** مو يتيم. */
  const closed = allPub.filter((t) => isTaskDoneState(t) && t.type);

  /**
   * النشرة اليومية مو قطعة خطة — بس التمييز أدقّ مما بيبيّن.
   *
   * وصل بتنشر «أسعار الذهب والعملات» و«التقويم الاقتصادي» كل يوم عمل: 82
   * منشور بـ25 يوم مقابل خطة 15 بوست. لو طابقناهن بالتاريخ، النشرات بتسكّر
   * كروت الخطة فتطلع الشركة 100% وهي متأخرة.
   *
   * ⚠️ بس **مو كل خبر اقتصادي نشرة يومية**: القائدة (8/8) «موجود أخبار
   * عاجلة» — وفعلاً بخطة وصل 4 بنود «خبر عاجل (من الشركة)». فالتمييز مو
   * بالموضوع، بالشكل: النشرة اليومية جدول أسعار مؤرّخ (رقم.رقم.سنة + أرقام
   * صرف)، والقطعة خبر مكتوب بجملة. لهيك الشرط: **جدول مؤرّخ**، لا مجرّد
   * ذكر «أسعار» أو «اقتصاد».
   */
  const DAILY_BULLETIN = /[0-9]{1,2}\.[0-9]{1,2}\.20[0-9][0-9]|الذهب و ?العملات|التقويم ?الإ?قتصادي|أهم أحداث التقويم/;
  const isBulletin = (p: ScannedPost) => !!p.alt && DAILY_BULLETIN.test(p.alt);

  const allDated = scan.posts.filter((p): p is ScannedPost & { date: string } => !!p.date);
  const bulletins = allDated.filter(isBulletin);
  const posts = allDated.filter((p) => !isBulletin(p)).sort((a, b) => a.date.localeCompare(b.date));

  console.log(`\n■ ${co.name} — @${scan.handle}`);
  console.log(
    `  المقروء: ${scan.count} منشور (${scan.withDate} بتاريخ)` +
      (bulletins.length ? ` · منها ${bulletins.length} نشرة يومية (خارج الخطة)` : "") +
      ` · المفتوح: ${open.length} كرت
`,
  );
  const noAlt = allDated.filter((p) => !p.alt).length;
  if (noAlt)
    console.log(`  ⚠️ ${noAlt} منشور بلا نصّ — ما منقدر نميّز نشرة يومية من قطعة خطة، فما منطابقهن.
`);

  const used = new Set<string>();
  const pairs: { post: ScannedPost & { date: string }; card: (typeof open)[number]; by: "محتوى" | "تاريخ" }[] = [];
  const orphanPosts: (ScannedPost & { date: string })[] = [];

  for (const post of posts) {
    // بلا نصّ ما منقدر نجزم إذا نشرة يومية — والتخمين بيسكّر كرت خطة بنشرة.
    if (!post.alt) continue;

    // ═══ المحتوى قبل التاريخ ═══
    // خطة وصل فيها 4 بنود «خبر عاجل» بتواريخ مختلفة — التاريخ لحالو بيحطّ
    // المنشور بأقرب كرت زمنياً، وممكن يكون الخبر العاجل الغلط. نصّ المنشور
    // مقابل نصّ الخطة بيحسمها؛ ونفس محرّك المطابقة يلي بيشتغل على تلغرام،
    // فقاعدة وحدة بالمكانين.
    const free0 = open.filter((t) => !used.has(t.id));
    const byContent = matchByContent({ fileName: null, caption: post.alt }, free0 as never);
    if (byContent) {
      const card = free0.find((t) => t.id === byContent.taskId)!;
      used.add(card.id);
      pairs.push({ post, card, by: "محتوى" });
      continue;
    }
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
    const sameType = free.filter((t) => (post.kind === "REEL" ? isReelCard(t) : t.type === "POST"));
    // التجاوز مسموح بفارق يوم واحد بالكتير — مو تطابق تام. الشبكة بتحط بعض
    // الريلات برابط `/p/`، وريل موعده 2/8 نزل 3/8 كان بيضل مفتوحاً بينما
    // منشوره قدّامنا (القائدة أكّدته). يوم واحد ضيّق كفاية ما يخلط قطعتين
    // متتاليتين — الخطة ما بتحط قطعتين بيوم وبعده.
    const CROSS_TYPE_SLACK = 1;
    const exactCrossType = free.filter((t) => {
      if (post.kind === "REEL" ? isReelCard(t) : t.type === "POST") return false;
      const due = (t.publishDate ?? t.readyDate)?.toISOString().slice(0, 10);
      return due != null && Math.abs(dayDiff(post.date, due)) <= CROSS_TYPE_SLACK;
    });
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
    pairs.push({ post, card: candidate, by: "تاريخ" });
  }

  for (const { post, card, by } of pairs) {
    const due = (card.publishDate ?? card.readyDate)!.toISOString().slice(0, 10);
    const late = dayDiff(post.date, due);
    // طريقة المطابقة بتنطبع: «محتوى» يقين و«تاريخ» ترجيح — فالقائدة بتراجع
    // الترجيحات لحالها بدل ما تصدّق الكل بالتساوي.
    console.log(
      `  ${by === "محتوى" ? "✅" : "🕐"} ${post.date} ${post.kind === "REEL" ? "ريل " : "منشور"}` +
        ` → ${card.type}#${card.pieceNo} (موعده ${due}` +
        `${late > 0 ? ` · تأخّر ${late}` : late < 0 ? ` · بكّر ${-late}` : " · بوقته"}) · ${by}`,
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
        notes: [card.notes, `منشور على انستغرام بـ${post.date} (مطابقة ${by}) — instagram.com/p/${post.shortcode}`]
          .filter(Boolean)
          .join(" · "),
      },
    });
  }

  const stillOpen = open.filter((t) => !used.has(t.id));

  // اليتيم على نوعين، والخلط بينهن بيخلّي التقرير مخيف بلا سبب: منشور بيوافق
  // كرتاً **مسكّراً أصلاً** هو تأكيد إنّ تسجيلنا صح، مو شغل ضايع.
  const confirms: typeof orphanPosts = [];
  const trulyOrphan: typeof orphanPosts = [];
  for (const p of orphanPosts) {
    const hit = closed.find((t) => {
      const d = (t.publishDate ?? t.finishedAt ?? t.readyDate)?.toISOString().slice(0, 10);
      return d != null && Math.abs(dayDiff(p.date, d)) <= 3;
    });
    (hit ? confirms : trulyOrphan).push(p);
  }
  if (confirms.length)
    console.log(`
  ☑️ ${confirms.length} منشور بيوافق قطعاً مسجّلة منشورة أصلاً — تأكيد إنّ الأرقام صح`);
  if (trulyOrphan.length) {
    console.log(`
  ⚠️ ${trulyOrphan.length} منشور ما إلو كرت إطلاقاً (شغل خارج الخطة؟):`);
    for (const p of trulyOrphan.slice(0, 8))
      console.log(`     ${p.date} · ${p.kind === "REEL" ? "ريل" : "منشور"} · instagram.com/p/${p.shortcode}`);
  }
  if (stillOpen.length) {
    console.log(`\n  ⏳ ${stillOpen.length} كرت بقي مفتوح (ما لقيناله منشور):`);
    for (const t of stillOpen.slice(0, 8))
      console.log(`     ${t.type}#${t.pieceNo} — موعده ${(t.publishDate ?? t.readyDate)?.toISOString().slice(0, 10)}`);
  }

  if (openStories.length)
    console.log(
      `
  📵 ${openStories.length} كرت ستوري برّا المطابقة — الستوري ما بتظهر بالشبكة`,
    );

  const byContentN = pairs.filter((x) => x.by === "محتوى").length;
  console.log(
    `
${APPLY ? "انسكّر" : "رح ينسكّر"} ${pairs.length} كرت — ${byContentN} بالمحتوى (يقين)` +
      ` و${pairs.length - byContentN} بالتاريخ (ترجيح).`,
  );
  if (!APPLY) console.log("تشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
