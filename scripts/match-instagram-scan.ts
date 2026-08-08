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
 *   ١. **المحتوى مقابل الخطة** — نصّ المنشور مقابل نصّ الخطة (نفس محرّك
 *      تلغرام). بلا أي قيد تاريخ: القطعة هي القطعة سواء نزلت مبكّر أو متأخر.
 *   ٢. **المحتوى مقابل تلغرام** — نصّ المنشور مقابل نصّ التسليم يلي بعتو
 *      الفريق. القائدة (8/8): «طابق المحتوى بالموجود ضمن الخطة **وعلى
 *      تلغرام**». وهاد مصدر مستقل بيمسك يلي بتفوّتو الخطة: الكابشن المنشور
 *      منقول عن الملف المرسَل أكتر مما هو منقول عن البريف، والقطع الإضافية
 *      (خبر عاجل، حدث طارئ) ما إلها بريف أصلاً بس إلها تسليم.
 *   ٣. **التاريخ** — بس للمنشور يلي ما لقى مطابقة بالمحتوى، وبشرط النوع.
 *   ٤. **بلا نصّ = بلا مطابقة** — التخمين بيسكّر كرت خطة بنشرة يومية.
 *
 * كل إقفال بياخد **تاريخ المنشور الحقيقي** لا تاريخ التسجيل، ودليله رمز
 * المنشور — فبتقدري ترجعي تفتحيه وتتأكدي.
 */
import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";
import { isTaskDoneState } from "../src/lib/constants";
import { rankByContent } from "../src/lib/telegram/match";
import type { ScanResult, ScannedPost } from "./lib/instagram-scan";

const prisma = new PrismaClient();
const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
/** يسمح لطبقة التاريخ تسكّر كمان — مطفية أصلاً لأنها بتغلط (شوف فوق). */
const WITH_DATE = argv.includes("--with-date");
const [file, companyArg] = argv.filter((a) => !a.startsWith("--"));

/** المنشور ممكن ينزل بيومه أو بعده — بس مو قبل موعده بأكتر من هيك. */
const EARLY_DAYS = 2;
/** …ولا بعده بأكتر من هيك (وإلا هو قطعة تانية أصلاً). */
const LATE_DAYS = 21;

/**
 * رابط المنشور بشكله الصحيح — الريل على `/reel/` والصورة على `/p/`.
 *
 * الدليل لازم ينفتح بضغطة: القائدة سألت عن ريل بالجرد «ماشفته على انستغرام»،
 * وكنا كاتبينله `/p/` فما بيوصّل لصفحة الريل متل ما بتعرفها.
 */
const postUrl = (p: ScannedPost) =>
  `instagram.com/${p.kind === "REEL" ? "reel" : "p"}/${p.shortcode}`;

const dayDiff = (a: string, b: string) =>
  Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86400000);

/**
 * المطابقة بالمحتوى لكابشن طويل — أشدّ من نظيرتها لاسم ملف.
 *
 * كابشن انستغرام ٢٥ كلمة أغلبها مفردات القطاع نفسه، فبيتشارك شوية كلمات مع كل
 * بريفات الشركة. المحرّك بياخد الأعلى درجة، والأعلى بهيك حالة ممكن يكون أعلى
 * بالضجيج. فمنشترط تلاتة مع بعض:
 *   • **درجة مطلقة** — مجموع نُدرة الكلمات المشتركة، مو مجرّد عددها؛
 *   • **هيمنة** — الأول لازم يكون ضعف التاني على الأقل، وإلا فالمنشور ملتبس
 *     بين قطعتين والصح إننا ما نخمّن؛
 *   • **عمق** — تلات كلمات مشتركة، حتى ما تكفي جملة مجاملة مشتركة؛
 *   • **حصرية** — كلمتين منهن على الأقل ما بيطلعوا بولا بريف تاني. وهاد يلي
 *     بيفرّق الدلالة عن الحشو: توقيع أغاليا («اللاذقية_شارع الاميركان_قبل
 *     مشفى السيدة») بتلث بريفاتها، فما بيوصل لعتبة «الشيوع» بس بيجمع أربع
 *     كلمات مشتركة لحاله — ومنشور «Coming Soon» طابق فيه قطعة فيلر موعدها
 *     بعد أسبوعين. الكلمة الحصرية ما بتنقال إلا بقطعة وحدة، فما بتنخدع.
 * القيم انضبطت على وقائع وصل المؤكّدة: ريل «المعلومة قبل الخبر» وريل «شو عم
 * يصير للدولار» لازم يمرقوا، والتحاليل الصباحية لازم تنرفض كلها.
 */
const MIN_SCORE = 1.4;
const MIN_SHARED = 3;
const MIN_UNIQUE = 2;
const DOMINANCE = 2;

function matchCaption(
  caption: string,
  candidates: { id: string; brief?: string | null }[],
): { taskId: string; score: number } | null {
  const ranked = rankByContent({ fileName: null, caption }, candidates as never, true);
  const [top, second] = ranked;
  if (!top || top.score < MIN_SCORE || top.shared < MIN_SHARED || top.unique < MIN_UNIQUE) return null;
  if (second && top.score < second.score * DOMINANCE) return null;
  return top;
}

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
  // «أهم الأحداث الاقتصادية» اسم قالب، لا موضوع — القائدة (8/8) على منشور
  // 23/7: «هي نفسها قالب المفكرة الاقتصادية». وبنعرّفه باسمه لا بتاريخه:
  // جرّبنا نضيف «أي تاريخ بمائل» فبان إنّو شرط فضفاض بيبلع أي قطعة خطة بتذكر
  // يوماً. جدول الأسعار بيضلّ ينعرف بتاريخ النقطة لأنّو جزء من الصورة نفسها.
  const DAILY_BULLETIN =
    /[0-9]{1,2}\.[0-9]{1,2}\.20[0-9][0-9]|الذهب و ?العملات|التقويم ?الإ?قتصادي|أهم أحداث التقويم|أهم الأحداث الاقتصادية/;
  /**
   * …والنشرة مو بس جدول أسعار: وصل بتنشر **تحليلاً صباحياً** كل يوم عمل كمان،
   * نصّاً لا جدولاً — «ابدأ يومك…»، «التحليل الصباحي…»، «تقريرنا الصباحي…».
   * هدول ١٤ ريل بالدورة، وكلهن بيحكوا لغة الخطة نفسها (سوق، ذهب، تداول)، فلو
   * دخلوا المطابقة بيبلعوا كروت الخطة وحدة وحدة. شغل حقيقي — بس متكرّر
   * ويومي، مو قطعة من العقد.
   */
  const DAILY_ANALYSIS =
    /التحليل ?الصباحي|تحليل الذهب الصباحي|تقريرنا الصباحي|التقرير الصباحي|المفكرة الاقتصادية|ابدأ يومك|ابدأ تداولك|نفتتح تداولات|يفتتح تقرير/;
  const isBulletin = (p: ScannedPost) =>
    !!p.alt && (DAILY_BULLETIN.test(p.alt) || DAILY_ANALYSIS.test(p.alt));

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

  /**
   * التسليمات المطابَقة على تلغرام، مربوطة بكرت النشر تبع نفس القطعة.
   *
   * الملف بيوصل على كرت إنتاج (تصوير/مونتاج/تصميم)، والنشر كرت تاني بنفس
   * القطعة. فمنعمل جسر: نصّ التسليم ← قطعته ← كرت نشرها المفتوح.
   */
  const deliveries = await prisma.telegramMessage.findMany({
    where: { companyId: co.id, taskId: { not: null } },
    select: { caption: true, fileName: true, taskId: true },
  });
  const prodTasks = await prisma.task.findMany({
    where: { id: { in: deliveries.map((d) => d.taskId!).filter(Boolean) } },
    select: { id: true, type: true, pieceNo: true, month: true, year: true },
  });
  const pieceOf = new Map(prodTasks.map((t) => [t.id, t]));
  /** نصّ التسليم بيلبس شكل «بريف» حتى يمرق بنفس المحرّك — قاعدة وحدة بالمكانين. */
  const tgCandidates = deliveries.flatMap((d) => {
    const piece = pieceOf.get(d.taskId!);
    if (!piece?.type || piece.pieceNo == null) return [];
    const pub = open.find(
      (t) =>
        t.type === piece.type &&
        t.pieceNo === piece.pieceNo &&
        t.month === piece.month &&
        t.year === piece.year,
    );
    const text = `${d.fileName ?? ""} ${d.caption ?? ""}`.trim();
    if (!pub || !text) return [];
    return [{ ...pub, brief: text }];
  });

  const used = new Set<string>();
  const pairs: {
    post: ScannedPost & { date: string };
    card: (typeof open)[number];
    by: "محتوى" | "تلغرام" | "تاريخ";
  }[] = [];
  const orphanPosts: (ScannedPost & { date: string })[] = [];

  const alreadyDone: { post: ScannedPost & { date: string }; card: (typeof closed)[number] }[] = [];

  for (const post of posts) {
    // بلا نصّ ما منقدر نجزم إذا نشرة يومية — والتخمين بيسكّر كرت خطة بنشرة.
    if (!post.alt) continue;

    // ═══ المفتوح والمسكّر بمقارنة وحدة، ومحصورين بالنوع ═══
    //
    // النوع شرط لا رفاهية: كابشن بوست «أبرز مزايا منصة التداول» طابق كرت
    // **ريل** مسكّر لما تركناه حرّاً، وسكّر بوستاً غلط. الريل ريل والبوست بوست.
    //
    // ولازم يتنافسوا سوا: القطعة المسجّلة منشورة أصلاً إذا هي الأقرب، فالمنشور
    // **تأكيد** مو شغل جديد. بلا هالخطوة بينزل لطبقة التاريخ وبيسكّر كرتاً
    // تاني صدفةً موعده نفس اليوم — وهاد يلي صار مع ريل «المعلومة قبل الخبر».
    const sameKind = (t: { type: string | null }) =>
      post.kind === "REEL" ? t.type === "REEL" || t.type === "AI_REEL" : t.type === "POST";
    const openTyped = open.filter((t) => !used.has(t.id) && sameKind(t));
    const closedTyped = closed.filter(sameKind);
    const hit = matchCaption(post.alt, [...openTyped, ...closedTyped]);
    if (hit) {
      const done = closedTyped.find((t) => t.id === hit.taskId);
      if (done) {
        alreadyDone.push({ post, card: done });
        continue;
      }
      const card = openTyped.find((t) => t.id === hit.taskId)!;
      used.add(card.id);
      pairs.push({ post, card, by: "محتوى" });
      continue;
    }

    // ═══ ثم نصّ التسليم على تلغرام ═══
    // الكابشن المنشور غالباً منقول عن الملف يلي بعتو الفريق، لا عن البريف —
    // والقطع الإضافية (خبر عاجل، حدث طارئ) ما إلها بريف بالخطة بس إلها تسليم.
    const tgFree = tgCandidates.filter((t) => !used.has(t.id));
    const byTelegram = matchCaption(post.alt, tgFree);
    if (byTelegram) {
      const card = open.find((t) => t.id === byTelegram.taskId)!;
      used.add(card.id);
      pairs.push({ post, card, by: "تلغرام" });
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
      `  ${by === "محتوى" ? "✅" : by === "تلغرام" ? "📨" : "🕐"} ${post.date} ${post.kind === "REEL" ? "ريل " : "منشور"}` +
        ` → ${card.type}#${card.pieceNo} (موعده ${due}` +
        `${late > 0 ? ` · تأخّر ${late}` : late < 0 ? ` · بكّر ${-late}` : " · بوقته"}) · ${by}`,
    );
    // ⚠️ **التاريخ ما بيسكّر.** القائدة (8/8): «الهدف المطابقة بالمحتوى مو
    // بالتاريخ». وهاد مو تفضيل: طبقة التاريخ لحالها جرّبناها فحطّت ريل «المعلومة
    // قبل الخبر» على كرت بوست، وريل الذهب على كرت الدولار — لأن وصل بتنشر كل
    // يوم فأي كرت موعده اليوم بيلقط أول منشور بيمرق. فصارت تُعرَض للمراجعة
    // بس، إلا إذا القائدة طلبتها صراحةً بـ`--with-date`.
    if (!APPLY || (by === "تاريخ" && !WITH_DATE)) continue;
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
        notes: [card.notes, `منشور على انستغرام بـ${post.date} (مطابقة ${by}) — ${postUrl(post)}`]
          .filter(Boolean)
          .join(" · "),
      },
    });
  }

  // كرت انربط بالتاريخ بس ما انسكّر بيضلّ مفتوحاً فعلياً — لازم يبيّن بالقائمة.
  const closedNow = new Set(
    pairs.filter((p) => p.by !== "تاريخ" || WITH_DATE).map((p) => p.card.id),
  );
  const stillOpen = open.filter((t) => !closedNow.has(t.id));

  if (alreadyDone.length) {
    console.log(`
  ☑️ ${alreadyDone.length} منشور طابق قطعة مسجّلة منشورة أصلاً — تأكيد بالمحتوى:`);
    for (const { post, card } of alreadyDone)
      console.log(`     ${post.date} → ${card.type}#${card.pieceNo}`);
  }

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
      console.log(`     ${p.date} · ${p.kind === "REEL" ? "ريل" : "منشور"} · ${postUrl(p)}`);
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

  const n = (k: string) => pairs.filter((x) => x.by === k).length;
  const sure = n("محتوى") + n("تلغرام");
  console.log(
    `
${APPLY ? "انسكّر" : "رح ينسكّر"} ${WITH_DATE ? pairs.length : sure} كرت` +
      ` — ${n("محتوى")} بالخطة و${n("تلغرام")} بتلغرام.` +
      (n("تاريخ")
        ? `\n🕐 و${n("تاريخ")} ترجيح بالتاريخ **ما انسكّر** — راجعيهن، وإذا صحّ أضف --with-date.`
        : ""),
  );
  if (!APPLY) console.log("تشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
