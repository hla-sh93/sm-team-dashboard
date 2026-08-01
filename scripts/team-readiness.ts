/**
 * فحص جاهزية الفريق — «هل كل واحد فيه يفتح المنصة بكرا ويشتغل؟»
 *
 * مو تكرار لـdeep-audit (يلي بيفحص سلامة المحرك والبيانات). هون منسأل أسئلة
 * الاستعمال: كل مهمة إلها صاحب؟ فيها وصف؟ موعدها منطقي؟ المعرّفات كاملة؟
 * الشخص عندو شغل بكرا فعلاً؟ الشركة مربوطة بتوبيكها؟
 *
 *   npx tsx scripts/team-readiness.ts [YYYY-MM-DD]
 */
import { PrismaClient } from "@prisma/client";
import { isTaskDoneState, isTaskLateState } from "../src/lib/constants";
import { selectDailyWorkTasks } from "../src/lib/daily-work";
import { parseWorkDays } from "../src/lib/dates";

const prisma = new PrismaClient();
const arg = process.argv[2];
const DAY = arg ? new Date(Number(arg.slice(0, 4)), Number(arg.slice(5, 7)) - 1, Number(arg.slice(8, 10))) : new Date();
const DOW = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

let ok = 0;
const warn: string[] = [];
const stop: string[] = [];
const check = (name: string, pass: boolean, detail: string, blocking = false) => {
  if (pass) { ok++; console.log(`  ✅ ${name}`); return; }
  console.log(`  ${blocking ? "❌" : "⚠️"} ${name} — ${detail}`);
  (blocking ? stop : warn).push(`${name}: ${detail}`);
};

async function main() {
  const employees = await prisma.employee.findMany();
  const companies = await prisma.company.findMany();
  const tasks = await prisma.task.findMany({ where: { status: { not: "CANCELED" } } });
  const open = tasks.filter((t) => !isTaskDoneState(t));
  const active = companies.filter((c) => c.status === "active" && c.managed);
  const dormant = new Set(companies.filter((c) => c.status !== "active").map((c) => c.id));

  // ═══ 1. كل مهمة إلها صاحب ═══
  console.log("\n═══ 1. الإسناد ═══");
  const noOwner = open.filter((t) => !t.assigneeId && !(t.companyId && dormant.has(t.companyId)));
  check("كل مهمة مفتوحة إلها صاحب", noOwner.length === 0,
    `${noOwner.length} بلا صاحب: ${[...new Set(noOwner.map((t) => companies.find((c) => c.id === t.companyId)?.name ?? "—"))].join("، ")}`, true);

  // مهام معلّقة على **فريلانسر** — بتضيع لأنو ما بيجي إلا وقت الحاجة. عمر ونوال
  // isScheduled=false كمان (ما بيدخلوا محرك المحتوى) بس شغلهن يومي وبيطلع
  // بجدولهن عادي، فما بينحسبوا هون.
  const freelancers = new Set(employees.filter((e) => !e.isScheduled && e.isPhotographer).map((e) => e.id));
  const stray = open.filter((t) => t.assigneeId && freelancers.has(t.assigneeId) && !(t.companyId && dormant.has(t.companyId)));
  check("ما في مهام معلّقة على فريلانسر", stray.length === 0,
    `${stray.length} مهمة عند ${[...new Set(stray.map((t) => employees.find((e) => e.id === t.assigneeId)?.name))].join("، ")}`, true);

  // ═══ 2. المحتوى على المهام ═══
  console.log("\n═══ 2. المحتوى (ما بدنا مهمة بلا وصف) ═══");
  for (const c of active) {
    const prod = open.filter((t) => t.companyId === c.id && t.kind === "CONTENT" && ["DESIGN", "SHOOT"].includes(t.stage ?? ""));
    if (!prod.length) continue;
    // الدورة الحالية بس — الدورات البعيدة خططها لسا ما انكتبت وهاد طبيعي
    const cur = prod.filter((t) => t.year === DAY.getFullYear() && t.month <= DAY.getMonth() + 1);
    const bare = cur.filter((t) => !t.brief);
    check(`«${c.name}» مهام دورتها الحالية فيها محتوى (${cur.length - bare.length}/${cur.length})`,
      bare.length === 0, `${bare.length} بلا وصف — ${[...new Set(bare.map((t) => `${t.type} ${t.pieceNo}`))].slice(0, 4).join("، ")}`);
  }

  // ═══ 3. المعرّفات (تلغرام) ═══
  console.log("\n═══ 3. المعرّفات والربط ═══");
  const producers = employees.filter((e) => e.isScheduled || /مونتير|ناشر|publish/i.test(e.role));
  const noTgId = producers.filter((e) => !e.telegramUserId);
  check("كل منتِج معرّفه الرقمي مسجّل (حتى ينتنسب لو تسليمه)", noTgId.length === 0,
    `بلا معرّف: ${noTgId.map((e) => e.name).join("، ")}`);
  const linked = await prisma.telegramChat.findMany({ where: { companyId: { not: null } } });
  const liveLinked = new Set(linked.filter((c) => !c.id.startsWith("export")).map((c) => c.companyId!));
  const unlinkedCos = active.filter((c) => !liveLinked.has(c.id));
  check("كل شركة نشطة مربوطة بتوبيك حي", unlinkedCos.length === 0,
    `مو مربوطة: ${unlinkedCos.map((c) => c.name).join("، ")}`, true);
  const noSlug = active.filter((c) => !c.slug);
  check("كل شركة إلها slug للتسمية القياسية", noSlug.length === 0, noSlug.map((c) => c.name).join("، "));

  // ═══ 4. شغل بكرا فعلاً ═══
  console.log(`\n═══ 4. شغل ${DOW[DAY.getDay()]} ${DAY.getDate()}/${DAY.getMonth() + 1} ═══`);
  for (const e of employees.filter((x) => x.isScheduled || /ناشر|publish|مونتير|مونتاج/i.test(x.role))) {
    const works = parseWorkDays(e.workDays as string).includes(DAY.getDay());
    if (!works) { console.log(`  ⏸️ ${e.name}: عطلة`); continue; }
    const todays = selectDailyWorkTasks({
      employee: e as never, tasks: open as never, allTasks: tasks as never,
      companies: companies as never, today: DAY,
    });
    const withBrief = todays.filter((t) => t.brief || t.kind === "ADHOC").length;
    console.log(`  ${todays.length ? "✅" : "🟢"} ${e.name}: ${todays.length} مهمة${todays.length ? ` (${withBrief} معها وصف)` : " — فاضي"}`);
    for (const t of todays.slice(0, 3)) {
      const co = companies.find((c) => c.id === t.companyId)?.name ?? "—";
      console.log(`        · ${t.type ?? t.kind} ${t.pieceNo ?? ""} ${co}${t.brief ? "" : t.kind === "ADHOC" ? "" : "  ⚠️ بلا وصف"}`);
    }
  }

  // ═══ 5. مواعيد منطقية ═══
  console.log("\n═══ 5. المواعيد ═══");
  const badDay = open.filter((t) => {
    if (!t.assigneeId || !t.workDate) return false;
    const e = employees.find((x) => x.id === t.assigneeId);
    return e ? !parseWorkDays(e.workDays as string).includes(t.workDate.getDay()) : false;
  });
  check("ولا موعد شغل واقع بعطلة صاحبه", badDay.length === 0, `${badDay.length} كرت`, true);
  const publishBeforeReady = open.filter((t) => {
    if (t.stage !== "PUBLISH" || !t.publishDate || !t.pipelineKey) return false;
    const prod = tasks.find((s) => s.pipelineKey === t.pipelineKey && s.stage !== "PUBLISH");
    return prod?.readyDate != null && prod.readyDate > t.publishDate;
  });
  check("ما في قطعة نشرها قبل جهوزيتها", publishBeforeReady.length === 0, `${publishBeforeReady.length} قطعة`);
  const farLate = open.filter((t) => isTaskLateState(t, DAY) && !(t.companyId && dormant.has(t.companyId)));
  console.log(`  ℹ️ متأخرات فعلية: ${farLate.length} (${farLate.filter((t) => t.stage === "PUBLISH").length} نشر · ${farLate.filter((t) => t.stage !== "PUBLISH").length} إنتاج)`);

  // ═══ النتيجة ═══
  console.log(`\n${"═".repeat(52)}`);
  console.log(`✅ ${ok} فحص ناجح` + (warn.length ? ` · ⚠️ ${warn.length} تنبيه` : "") + (stop.length ? ` · ❌ ${stop.length} مانع` : ""));
  if (stop.length) { console.log("\nموانع لازم تنحل:"); for (const s of stop) console.log(`   ❌ ${s}`); }
  if (warn.length) { console.log("\nتنبيهات (ما بتوقف الشغل):"); for (const w of warn) console.log(`   ⚠️ ${w}`); }
  await prisma.$disconnect();
  if (stop.length) process.exit(1);
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
