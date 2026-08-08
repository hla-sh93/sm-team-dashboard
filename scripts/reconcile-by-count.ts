/**
 * مطابقة بالعدد — لما الاقتران قطعة-بقطعة ما بينفع.
 *
 * ═══ ليش العدد وليس الاسم؟ ═══
 * القائدة (8/8): «شرط باقي الشركات هو مطابقة العدد تبع الخطة مع المحتوى
 * المرسل من قبل الفريق، والمنشور على صفحات الزبون. لأن العديد من الزباين
 * بتنشر على صفحاتها لحالها مع وبدوننا».
 *
 * وهاد بيحلّ مأزقاً حقيقياً. صفحة أغاليا فيها ١٢ ريل والخطة ٦: المطابقة
 * قطعة-بقطعة بتفشل لأن نص الصفحة مو شغلنا، والمطابقة بالتاريخ بتسكّر كروتنا
 * بمنشورات الزبون. وبنفس الوقت الفريق سلّم ٨ ريلات فعلاً — فالشغل موجود
 * والإقرار به مستحق.
 *
 * فالعدد المسكَّر = **أصغر التلاتة**:
 *   • ما أرسله الفريق على تلغرام (لأن يلي ما انسلّم ما انعمل)
 *   • ما ظهر على الصفحة (لأن يلي ما نزل ما انتشر)
 *   • ما تطلبه الخطة (لأن العقد سقفه)
 * وأي واحد فيهن بيقيّد لحاله. الترتيب بالأقدم موعداً: الفريق بينشر بترتيب
 * الخطة تقريباً، والقطعة الأقدم هي الأحقّ بالإقرار.
 *
 * ═══ الاستثناء: وصل ═══
 * القائدة: «خلينا نعمل استثنائياً شرط التداول لحال». زبون وصل بيبعت «خبر
 * عاجل» أكتر من الأربعة يلي بالعقد، ونشراته اليومية ٤٧ منشور بالدورة — فالعدّ
 * لحاله بيسكّر خطتها كلها بشغل مو منها. وصل بتضلّ على المطابقة بالمحتوى
 * الحرفية، وهي أصلاً نجحت معها (٧ كروت بدليل نصّي).
 *
 * ═══ الستوري ═══
 * ما بتظهر بالشبكة إطلاقاً، فقيدها التاني ساقط: العدد = أصغر (المرسَل، الخطة).
 * القائدة أكّدت (8/8): «الستوريز المرسلة كلها على التلغرام منشورة».
 *
 *   npx tsx scripts/reconcile-by-count.ts <الشركة> --export <result.json> [--scan <scan.json>] [--apply]
 */
import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";
import { isTaskDoneState } from "../src/lib/constants";
import { buildTopicIndex, matchTopicCompany, normalise, type ExportMessage } from "../src/lib/telegram/export";
import type { ScanResult } from "./lib/instagram-scan";

const prisma = new PrismaClient();
const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const arg = (k: string) => {
  const i = argv.indexOf(k);
  return i >= 0 ? argv[i + 1] : undefined;
};
const companyArg = argv.filter((a) => !a.startsWith("--"))[0];
const exportPath = arg("--export");
const scanPath = arg("--scan");

/** الشركات يلي زبونها بيغرق الصفحة بشغله — العدّ ما بيميّز عندها. */
const COUNT_EXEMPT = [/وصل/];

type Kind = "POST" | "REEL" | "STORY";

/**
 * نوع القطعة — من كلمة صريحة بالاسم، لا من الامتداد.
 *
 * ⚠️ **الامتداد ما بيحدّد النوع.** أول نسخة اعتبرت كل `.jpg` بوستاً، فراحت
 * ستوريات سابين لأغاليا («عروض» · «العملة القديمة» · «عرض الاسنان») لخانة
 * البوستات — فطلع المرسَل ٢١ بوستاً و٣ ستوريات، واستنتجنا غلطاً إنّ ١٢ ستوري
 * ما انعملت. القائدة صحّحتنا: «مستحيل، في قياس ستوري عروض وعملة قديمة وغيرا
 * باعتتهن سابين».
 *
 * والستوري ما إلها إشارة موجبة أصلاً: بريفاتها فاضية بالخطة (الملف فيه نصّ
 * البوستات وبس)، والمصمّم ما بيكتب «story» باسمها. فمنعرّفها **بالباقي**:
 * كل تصميم وصل من منتِج وما انعرف إنّو بوست أو ريل، هو ستوري.
 */
function typeOfFile(name: string): Kind | null {
  const n = normalise(name);
  if (/\bstory\b|ستوري/.test(n)) return "STORY";
  if (/\breels?\b|ريل/.test(n)) return "REEL";
  if (/\bposts?\b|بوست/.test(n)) return "POST";
  // الفيديو ريل بأمان — الستوري المصوّرة بتحمل كلمة «story» عادةً (ماجد بيلتزم).
  if (/\.(mp4|mov|avi)$/i.test(name)) return "REEL";
  return null;
}

/**
 * هوية التسليم — النسخة المعدّلة مو تسليم تاني.
 * القائدة (8/8): «ماتعد التعديلات انو مرتين .. هو نفس الريل بس معدل».
 */
function deliveryIdentity(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/\b(edited|edit|final|v\d+|copy)\b/g, "")
    .replace(/_\d+$/, "")
    .replace(/[\s_-]+/g, " ")
    .trim();
}

async function main() {
  if (!companyArg || !exportPath) {
    console.error(
      "الاستعمال: npx tsx scripts/reconcile-by-count.ts <الشركة> --export <result.json> [--scan <scan.json>] [--apply]",
    );
    process.exit(1);
  }
  const co = await prisma.company.findFirst({ where: { name: { contains: companyArg } } });
  if (!co) {
    console.error(`ما لقيت شركة «${companyArg}»`);
    process.exit(1);
  }
  if (COUNT_EXEMPT.some((re) => re.test(co.name))) {
    console.log(`■ ${co.name} مستثناة من المطابقة بالعدد — زبونها بينشر بكثافة، فالعدّ بيكذب.`);
    console.log("  استعملي: npx tsx scripts/match-instagram-scan.ts <scan.json> " + co.name);
    return;
  }

  // ---- ١. المرسَل من الفريق -------------------------------------------
  const raw = JSON.parse(readFileSync(exportPath, "utf8")) as { messages: ExportMessage[] };
  const messages = raw.messages ?? [];
  const { titles, topicOf } = buildTopicIndex(messages);
  const mine = new Set(
    [...titles.entries()].filter(([, t]) => matchTopicCompany(t, [co])?.id === co.id).map(([id]) => id),
  );
  const employees = await prisma.employee.findMany();
  const producers = employees.filter((e) => e.isScheduled || e.isPhotographer);
  const namesOf = (e: (typeof employees)[number]) => [
    e.name,
    ...(e.telegramAliases ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  ];
  const isProducer = (s: string | null | undefined) =>
    !!s && producers.some((e) => namesOf(e).some((n) => normalise(s).includes(normalise(n))));

  const sentIds = new Map<Kind, Set<string>>([
    ["POST", new Set()],
    ["REEL", new Set()],
    ["STORY", new Set()],
  ]);
  let unnamedDesigns = 0;
  for (const m of messages) {
    const t = topicOf(m as never);
    if (t == null || !mine.has(t)) continue;
    if (!isProducer((m as { from?: string }).from)) continue;
    const name = (m as { file_name?: string }).file_name;
    if (!name) {
      // تلغرام بيشيل اسم أي ملف بينبعت **كصورة** — بيصير `photos/photo_12@…`.
      // فالتصميم يلي انبعت صورة بيوصل بلا اسم إطلاقاً، وتجاهله بيخسّرنا شغلاً
      // حقيقياً: سابين لحالها بعتت ٩ صور بلا اسم لأغاليا. وبما إنّ التصميم بلا
      // اسم ما بيقدر يثبت إنّو بوست، بينحسب بالباقي (ستوري).
      if ((m as { photo?: string }).photo) unnamedDesigns++;
      continue;
    }
    const kind = typeOfFile(name);
    if (kind) sentIds.get(kind)!.add(deliveryIdentity(name));
    else unnamedDesigns++;
  }
  /** الباقي = ستوري: تصميم من منتِج ما أثبت إنّو بوست أو ريل. */
  const storyLeftover = unnamedDesigns;

  // ---- ٢. المنشور على الصفحة ------------------------------------------
  const scan = scanPath ? (JSON.parse(readFileSync(scanPath, "utf8")) as ScanResult) : null;
  const onPage: Record<Kind, number | null> = {
    POST: scan ? scan.posts.filter((p) => p.kind === "POST").length : null,
    REEL: scan ? scan.posts.filter((p) => p.kind === "REEL").length : null,
    // الستوري ما بتظهر بالشبكة — فما بتقيّد. القائدة أكّدت إنّ المرسَل كلّه منشور.
    STORY: null,
  };

  // ---- ٣. الخطة --------------------------------------------------------
  const cards = await prisma.task.findMany({
    where: { companyId: co.id, stage: "PUBLISH", status: { not: "CANCELED" }, type: { not: null } },
    orderBy: [{ publishDate: "asc" }, { pieceNo: "asc" }],
  });

  console.log(`\n■ ${co.name} — مطابقة بالعدد\n`);
  console.log("   النوع   مرسَل  صفحة  خطة  منجز  ⇒ يسكّر");
  const toClose: typeof cards = [];
  for (const kind of ["POST", "REEL", "STORY"] as Kind[]) {
    const all = cards.filter((c) => c.type === kind || (kind === "REEL" && c.type === "AI_REEL"));
    if (!all.length) continue;
    const done = all.filter(isTaskDoneState);
    const open = all.filter((c) => !isTaskDoneState(c));
    const sent = sentIds.get(kind)!.size + (kind === "STORY" ? storyLeftover : 0);
    const page = onPage[kind];
    // أصغر القيود — والصفحة بتنحسب بس لما يكون في جرد.
    const cap = Math.min(sent, page ?? Number.POSITIVE_INFINITY, all.length);
    const extra = Math.max(0, cap - done.length);
    const picked = open.slice(0, extra);
    toClose.push(...picked);
    console.log(
      `   ${kind.padEnd(6)} ${String(sent).padStart(5)} ${String(page ?? "—").padStart(5)}` +
        ` ${String(all.length).padStart(4)} ${String(done.length).padStart(5)}  ⇒ ${picked.length}`,
    );
  }

  if (!toClose.length) {
    console.log("\nولا كرت يستحق الإقفال — العدد مطابق أصلاً.");
    return;
  }
  console.log(`\n— الكروت (${toClose.length}) —`);
  for (const t of toClose)
    console.log(`   ${t.type}#${t.pieceNo} · موعده ${t.publishDate?.toISOString().slice(0, 10) ?? "—"}`);

  if (!APPLY) return console.log("\nتشغيل تجريبي — أضف --apply.");
  for (const t of toClose) {
    // التاريخ = موعد النشر المخطّط، لا اليوم: العدّ بيثبت **إنّو صار**، ما
    // بيثبت **إيمتى** — وختمه باليوم بيزوّر التأخير كأنه ما كان.
    // بس مو أبعد من اليوم: قطعة موعدها ١١/٨ ممكن تكون نزلت بكّير (وهاد بيصير
    // فعلاً)، إنما ختمها بتاريخ ما إجا بعد بيخلّي «أُنجز» بالمستقبل — ورقم
    // ما بيصحّ بأي تقرير.
    const planned = t.publishDate ?? t.readyDate ?? new Date();
    const at = planned > new Date() ? new Date() : planned;
    await prisma.task.update({
      where: { id: t.id },
      data: {
        status: "PUBLISHED",
        board: "DONE",
        startedAt: t.startedAt ?? at,
        finishedAt: at,
        completedAt: at,
        isPinned: true,
        notes: [t.notes, `مطابقة بالعدد 8/8: الفريق سلّم والصفحة نشرت (بلا اقتران قطعة-بقطعة)`]
          .filter(Boolean)
          .join(" · "),
      },
    });
  }
  console.log(`\n✅ انسكّر ${toClose.length} كرت`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
