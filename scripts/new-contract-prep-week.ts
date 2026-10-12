/**
 * أسبوع التحضير لعقد جديد — قاعدة القائدة (1/8/2026):
 *
 *   «عند توقيع عقد جديد بدك تعطينا أسبوع تحضير، طبعاً تحط فيه مهام بس مو نشر،
 *    ليجهز أول ريل» — «بين ما أخدنا حسابات واللوغو وجهّزنا تيمبليت وكتبنا الخطة
 *    ونزلنا صوّرنا».
 *
 * يعني الأسبوع الأول من أي عقد جديد: **شغل تحضير، وصفر نشر**. الإنتاج (تصميم
 * وتصوير وكتابة) بيمشي عادي — يلي بينزاح هو النشر بس، لأنو أول قطعة ما بتكون
 * جاهزة قبل ما يخلص التحضير.
 *
 *   npx tsx scripts/new-contract-prep-week.ts مانغو            # تجريبي
 *   npx tsx scripts/new-contract-prep-week.ts مانغو --apply
 */
import { PrismaClient } from "@prisma/client";
import { parseWorkDays } from "../src/lib/dates";
import { isTaskDoneState } from "../src/lib/constants";

const prisma = new PrismaClient();
const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
/**
 * كل شركة عندها كروت تحضير — للاستعمال بالبناء حتى الإنتاج يلحق التصحيحات.
 * كروت التحضير `isAuto: false`، يعني **إعادة الجدولة ما بتلمسها أبداً**، فبلا
 * هالمسار بيضل «استلام اللوغو» على المصمم بالإنتاج للأبد.
 */
const ALL = argv.includes("--all");
/** إصلاح الموجود بس: ولا كرت جديد، ولا تحريك لتواريخ النشر. آمن بالبناء. */
const REPAIR_ONLY = argv.includes("--repair-only");
const NAME = argv.find((a) => !a.startsWith("--"));
const PREP_DAYS = 7;
const DOW = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const label = (d: Date) => `${DOW[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;

/**
 * مهام التحضير — مين بيعملها بيتحدد بالدور مو بالاسم، فبتشتغل لأي شركة.
 *
 * الترتيب هون **ترتيب تبعية مو ترتيب اعتباطي** (قاعدة القائدة 1/8/2026):
 * «الخطة أول مرحلة — قبل الخطة ولا مصمم ولا مصور بيشتغل»، و«استلام اللوغو
 * والحسابات مسؤولية صاحب الحساب (السيلز) — بيبعتهن عالمجموعة — مو المصمم».
 *
 * كانت «استلام اللوغو» مسندة للمصمم بالتعريف، وكانت الخطة رابع كرت بالتواريخ
 * بينما التيمبليت التالت — يعني المصمم ماخد تاريخ تسليم قبل ما تُكتب الخطة يلي
 * بيشتغل عليها. `after` بيمنع هالانقلاب: ما في كرت بياخد تاريخ قبل يلي قبله.
 */
const PREP: {
  slug: string;
  title: string;
  role: "owner" | "publisher" | "designer" | "writer";
  hours: number;
  /** slug الكرت يلي لازم يخلص قبله — بينعكس على `blockedById` وعالتاريخ. */
  after?: string;
  brief: string;
}[] = [
  { slug: "accounts", title: "استلام حسابات التواصل والصلاحيات", role: "owner", hours: 2,
    brief: "استلام يوزرات وباسوردات الصفحات من الزبون، والتأكد من صلاحية النشر قبل ما تبلّش الدورة." },
  { slug: "brand", title: "استلام اللوغو والهوية البصرية", role: "owner", hours: 2,
    brief: "اللوغو بصيغة متجهة (AI/SVG/PDF)، الألوان، والخطوط — بيجيبهن صاحب الحساب من الزبون وبيبعتهن عالتوبيك. بلاها ما بينفع يتجهّز تيمبليت." },
  { slug: "plan", title: "كتابة خطة الشهر الأول", role: "writer", hours: 8, after: "brand",
    brief: "خطة المحتوى الأولى: نص كل قطعة وسيناريو كل ريل. بتنبعت عالتوبيك حتى تنستورد عالكروت." },
  { slug: "template", title: "تجهيز التيمبليت (بوست + ستوري + ريل)", role: "designer", hours: 6, after: "plan",
    brief: "قوالب موحّدة للبوست والستوري وكفر الريل — هي أساس كل تصاميم الدورة. ما بتبلّش قبل ما توصل الخطة والهوية." },
  { slug: "shoot", title: "أول جلسة تصوير (2–3 ريل)", role: "publisher", hours: 1, after: "plan",
    brief: "تنسيق أول موعد تصوير مع الزبون — بيتطلب قبل الجلسة بيومين، والجلسة 2–3 ريلات. ما بينحجز قبل ما تجهز الخطة." },
];

async function main() {
  if (ALL) {
    // كل شركة عندها كروت تحضير أصلاً. بيتنفّذ بالبناء فبيلحق الإنتاج التصحيحات
    // بلا ما حدا يعدّل كرت بإيدو.
    const withPrep = await prisma.task.findMany({
      where: { id: { startsWith: "prep_" } },
      select: { companyId: true },
      distinct: ["companyId"],
    });
    const ids = withPrep.map((t) => t.companyId).filter((v): v is string => !!v);
    const cos = await prisma.company.findMany({ where: { id: { in: ids } } });
    for (const c of cos) await runFor(c);
    console.log(`\n${APPLY ? "تم" : "تشغيل تجريبي — أضف --apply."} (${cos.length} شركة)`);
    return;
  }
  if (!NAME) { console.error("الاستعمال: npx tsx scripts/new-contract-prep-week.ts <شركة|--all> [--repair-only] [--apply]"); process.exit(1); }
  const co = await prisma.company.findFirst({ where: { name: { contains: NAME } } });
  if (!co) { console.error(`ما لقيت «${NAME}»`); process.exit(1); }
  if (!co.contractStartDate) { console.error(`«${co.name}» بلا تاريخ عقد — ما فيني أحدد أسبوع التحضير`); process.exit(1); }
  await runFor(co);
  console.log(`\n${APPLY ? "تم" : "تشغيل تجريبي — أضف --apply."}`);
}

type Co = Awaited<ReturnType<typeof prisma.company.findFirst>> & object;

async function runFor(co: Co) {
  if (!co.contractStartDate) return;
  const employees = await prisma.employee.findMany();
  const pick = (role: "owner" | "publisher" | "designer" | "writer") => {
    // صاحب الحساب (السيلز) هو يلي بيستلم اللوغو والحسابات من الزبون. إذا الشركة
    // بلا صاحب حساب منرجع للناشر — بس أبداً مو للمصمم.
    if (role === "owner")
      return (
        employees.find((e) => e.id === co.accountOwnerId) ??
        employees.find((e) => /ناشر|publish/i.test(e.role))
      );
    if (role === "publisher") return employees.find((e) => /ناشر|publish/i.test(e.role));
    if (role === "writer") return employees.find((e) => /كات|writer/i.test(e.role));
    // المصمم: صاحب بوستات الشركة، وإلا أول مصمم
    return employees.find((e) => e.id === co.postOwnerId) ?? employees.find((e) => /designer|مصمم/i.test(e.role));
  };

  const start = new Date(co.contractStartDate);
  const prepEnd = new Date(start);
  prepEnd.setDate(prepEnd.getDate() + PREP_DAYS);
  console.log(`${co.name} — العقد ${label(start)} · أسبوع التحضير لحد ${label(prepEnd)}\n`);

  // ---- 1. مهام التحضير ------------------------------------------------------
  let created = 0;
  const idOf = (slug: string) => `prep_${co.slug?.split("|")[0].trim() || co.id}_${slug}`;
  /** تاريخ كل كرت بعد ما ينحسب — لازم لحساب تاريخ يلي بيعتمد عليه. */
  const dateOf = new Map<string, Date>();
  for (const [i, p] of PREP.entries()) {
    const emp = pick(p.role);
    if (!emp) { console.log(`⚠️ ما لقيت مسؤول لـ«${p.title}»`); continue; }
    const id = idOf(p.slug);
    // الأبكر يلي بينفع يبلّش فيه: يوم بالتسلسل، وإذا معتمد على غيرو فبعدو بيوم.
    const work = new Date(start);
    work.setDate(work.getDate() + Math.min(i, PREP_DAYS - 1));
    if (p.after) {
      const dep = dateOf.get(p.after);
      // ما بيصير كرت يستحق قبل يلي حاجزو: التيمبليت كان تسليمو 2/8 والخطة يلي
      // بيبني عليها 3/8.
      if (dep) {
        const earliest = new Date(dep);
        earliest.setDate(earliest.getDate() + 1);
        if (work < earliest) work.setTime(earliest.getTime());
      }
    }
    const days = parseWorkDays(emp.workDays as string);
    for (let k = 0; k < 7 && !days.includes(work.getDay()); k++) work.setDate(work.getDate() + 1);
    dateOf.set(p.slug, new Date(work));
    const existing = await prisma.task.findUnique({ where: { id } });
    if (existing) {
      // كروت أُنشئت بالنسخة القديمة (اللوغو على المصمم، والتيمبليت قبل الخطة)
      // بتنصلّح مكانها — بس يلي ما بلّش فيها حدا.
      const want = {
        assigneeId: emp.id,
        stage: p.role === "designer" ? "DESIGN" : p.role === "writer" ? "WRITE" : "PUBLISH",
        readyDate: work,
        workDate: work,
        blockedById: p.after ? idOf(p.after) : null,
        brief: p.brief,
      };
      const drift = (Object.keys(want) as (keyof typeof want)[]).filter((k) => {
        const a = want[k], b = (existing as Record<string, unknown>)[k];
        return a instanceof Date ? (b as Date | null)?.getTime() !== a.getTime() : b !== a;
      });
      if (!drift.length) { console.log(`= «${p.title}» سليم`); continue; }
      if (existing.status !== "NOT_STARTED" || isTaskDoneState(existing)) {
        console.log(`⚠️ «${p.title}» انبلش فيه — ما بلمسو (فرق: ${drift.join("، ")})`);
        continue;
      }
      console.log(`♻️ «${p.title}» → ${emp.name} · ${label(work)}${p.after ? ` (بعد «${p.after}»)` : ""} — صُلّح: ${drift.join("، ")}`);
      if (APPLY)
        await prisma.task.update({
          where: { id },
          data: { ...want, month: work.getMonth(), year: work.getFullYear(), week: Math.ceil(work.getDate() / 7) },
        });
      continue;
    }
    if (REPAIR_ONLY) continue; // إصلاح الموجود بس — ولا كرت جديد
    console.log(`🔧 ${label(work)} — ${emp.name}: ${p.title}${p.after ? ` (بعد «${p.after}»)` : ""}`);
    created++;
    if (!APPLY) continue;
    await prisma.task.create({
      data: {
        id, kind: "ADHOC", title: `${p.title} — ${co.name}`, hours: p.hours, quantity: 1,
        priority: "IMPORTANT", status: "NOT_STARTED", board: "TODO",
        // «استلام» شغل صاحب حساب مو تصميم — بيتسجّل كمتابعة (PUBLISH) متل باقي
        // بنود عمر اليدوية، حتى ما يظهر بقسم التصميم بالبريف ولا بحمل المصمم.
        stage: p.role === "designer" ? "DESIGN" : p.role === "writer" ? "WRITE" : "PUBLISH",
        workDate: work, readyDate: work, month: work.getMonth(), year: work.getFullYear(),
        week: Math.ceil(work.getDate() / 7), isPinned: true, isAuto: false,
        companyId: co.id, assigneeId: emp.id, brief: p.brief,
        ...(p.after ? { blockedById: idOf(p.after) } : {}),
        notes: "أسبوع التحضير — عقد جديد: شغل تجهيز، ما في نشر",
      },
    });
  }

  // ---- 2. ولا نشر خلال أسبوع التحضير ---------------------------------------
  // ما بينشتغل بوضع الإصلاح: `publishDate < prepEnd` بتطابق كل نشر قديم لشركة
  // عقدها من زمان، فتنزاح مئات الكروت — كارثة لو انشغّلت بالبناء.
  if (REPAIR_ONLY) return;
  const early = (await prisma.task.findMany({
    where: { companyId: co.id, stage: "PUBLISH", status: { not: "CANCELED" }, publishDate: { lt: prepEnd } },
    orderBy: { publishDate: "asc" },
  })).filter((t) => !isTaskDoneState(t));
  console.log(`\n📅 ${early.length} كرت نشر واقع داخل أسبوع التحضير — بينزاح لبعده:`);
  const publisher = employees.find((e) => /ناشر|publish/i.test(e.role))!;
  const pubDays = parseWorkDays(publisher.workDays as string);
  const cursor = new Date(prepEnd);
  for (const t of early) {
    while (!pubDays.includes(cursor.getDay())) cursor.setDate(cursor.getDate() + 1);
    const d = new Date(cursor);
    console.log(`   ${t.type} ${t.pieceNo} → ${label(d)}`);
    if (APPLY)
      await prisma.task.update({ where: { id: t.id }, data: { publishDate: d, workDate: d, isPinned: true } });
    cursor.setDate(cursor.getDate() + 1);
  }
  if (!APPLY && created) console.log(`رح يُنشأ ${created} كرت تحضير`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
