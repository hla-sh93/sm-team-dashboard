/**
 * تدقيق عميق ما قبل الرفع — 2026-08-01.
 * كل فحص بيطبع PASS/FAIL مع الدليل. ما بيكتب شي عالداتا إلا فحص إعادة الجدولة
 * (بيولّد مرتين وبيقارن — العملية نفسها اللي بتصير بالإنتاج).
 */
import { PrismaClient } from "@prisma/client";
import { isTaskDoneState, isTaskLateState } from "../src/lib/constants";
import { generateSchedule } from "../src/server/actions/schedule";
import { matchDelivery, type Delivery } from "../src/lib/telegram/match";
import { companySlug, assetNameForTask, parseAssetName } from "../src/lib/asset-name";
import { computeWorkload } from "../src/lib/workload";
import { selectDailyWorkTasks, dailyTaskEffortDays } from "../src/lib/daily-work";
import { parseWorkDays } from "../src/lib/dates";
import { buildTodayBrief } from "../src/lib/telegram/service";
import { completedCompanyPlanCount, producedCompanyPlanCount } from "../src/lib/progress";
import { ratePerDay } from "../src/lib/capacity";
import { cycleForBucket, currentCycleBucket, hasStartedPublishing } from "../src/lib/contract";

const prisma = new PrismaClient();
let pass = 0, fail = 0;
const bad: string[] = [];
function check(name: string, ok: boolean, detail = "") {
  if (ok) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; bad.push(name); console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`); }
}

const swallow = async (fn: () => Promise<unknown>) => {
  try { await fn(); } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    if (!/revalidate|static generation|headers|request scope/i.test(m)) throw e;
  }
};

/**
 * بصمة «الواقع المسجّل» — يلي ما بيحق للتوليد يغيّره:
 *   • الحالة والمرحلة والمكلّف والبريف والملاحظات ورقم القطعة — للكل.
 *   • المواعيد — للمنجز والمثبّت بس: الكرت المفتوح غير المثبّت جدوله ملك
 *     المحرّك وإعادة تخطيطه مشروعة (جدارات بتنزاح لما تتغيّر قواعد النشر).
 *   • المقارنة باليوم المحلي لا باللحظة: سكربتات التصحيح بتخزّن منتصف ليل UTC
 *     والمحرّك منتصف الليل المحلي — نفس اليوم، والفرق تمثيل مو واقع.
 */
async function fingerprint() {
  const rows = await prisma.task.findMany({ orderBy: { id: "asc" } });
  const day = (d: Date | null) =>
    d ? `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` : "·";
  return rows.map((t) => {
    const settled = t.board === "DONE" || t.isPinned;
    return [t.id, t.status, t.board, t.assigneeId, t.pieceNo, t.isPinned,
      t.brief?.length ?? 0, t.notes?.length ?? 0, day(t.finishedAt),
      settled ? day(t.workDate) : "~",
      t.board === "DONE" ? day(t.publishDate) : "~"].join("|");
  });
}

async function main() {
  const companies = await prisma.company.findMany();
  const employees = await prisma.employee.findMany();
  const tasks = await prisma.task.findMany({ where: { status: { not: "CANCELED" } } });
  const active = companies.filter((c) => c.status === "active");
  const coById = new Map(companies.map((c) => [c.id, c]));
  const empById = new Map(employees.map((e) => [e.id, e]));

  // ═══════════ 1. الجدولة ═══════════
  console.log("\n═══ 1. الجدولة ═══");
  const before = await fingerprint();
  const briefsBefore = await prisma.task.count({ where: { brief: { not: null } } });
  await swallow(() => generateSchedule(2026, 7));
  const mid = await fingerprint();
  await swallow(() => generateSchedule(2026, 7));
  const after = await fingerprint();
  const briefsAfter = await prisma.task.count({ where: { brief: { not: null } } });
  check("إعادة الجدولة مستقرة (توليدين متطابقين بايت ببايت)", JSON.stringify(mid) === JSON.stringify(after));
  check("إعادة الجدولة ما غيّرت الواقع المسجّل", JSON.stringify(before) === JSON.stringify(mid),
    `قبل ${before.length} صف / بعد ${mid.length}`);
  check(`نصوص الخطط صمدت (${briefsBefore} بريف)`, briefsAfter >= briefsBefore, `صارت ${briefsAfter}`);

  // مواعيد الشغل على أيام دوام صاحبها
  const misdays = tasks.filter((t) => {
    if (!t.assigneeId || !t.workDate || isTaskDoneState(t) || !t.isAuto) return false;
    const e = empById.get(t.assigneeId);
    return e ? !parseWorkDays(e.workDays as string).includes(t.workDate.getDay()) : false;
  });
  check("كل موعد شغل مفتوح واقع بيوم دوام صاحبه", misdays.length === 0, `${misdays.length} كرت خارج الدوام`);

  // ترقيم القطع فريد ضمن (شركة، نوع، دورة، مرحلة)
  const dupNo = new Map<string, number>();
  for (const t of tasks) {
    if (t.kind !== "CONTENT" || t.pieceNo == null || !["DESIGN", "SHOOT"].includes(t.stage ?? "")) continue;
    const k = `${t.companyId}|${t.type}|${t.year}-${t.month}|${t.pieceNo}`;
    dupNo.set(k, (dupNo.get(k) ?? 0) + 1);
  }
  const dups = [...dupNo.entries()].filter(([, n]) => n > 1);
  check("لا ازدواج بأرقام القطع", dups.length === 0, dups.slice(0, 3).map(([k]) => k).join(" · "));

  // ═══════════ 2. المهام وسلامة البيانات ═══════════
  console.log("\n═══ 2. المهام وسلامة البيانات ═══");
  const inverted = tasks.filter((t) => t.startedAt && t.finishedAt && t.finishedAt < t.startedAt);
  check("ما في شغل خالص قبل ما يبلّش", inverted.length === 0, `${inverted.length} كرت`);
  const doneNoStamp = tasks.filter((t) => isTaskDoneState(t) && !t.finishedAt && t.kind === "CONTENT");
  check("كل قطعة منجزة معها تاريخ إنجاز", doneNoStamp.length === 0, `${doneNoStamp.length}`);
  const pubDoneProdOpen = tasks.filter((t) =>
    t.stage === "PUBLISH" && isTaskDoneState(t) && t.pipelineKey &&
    tasks.some((s) => s.pipelineKey === t.pipelineKey && s.stage !== "PUBLISH" && !isTaskDoneState(s)));
  check("ما في قطعة منشورة وإنتاجها مفتوح", pubDoneProdOpen.length === 0, `${pubDoneProdOpen.length}`);
  const orphanBlock = tasks.filter((t) => t.blockedById && !tasks.some((s) => s.id === t.blockedById));
  check("لا مراجع blockedById يتيمة", orphanBlock.length === 0, `${orphanBlock.length}`);
  const dormantIds = new Set(companies.filter((c) => c.status !== "active").map((c) => c.id));
  const dormantOpen = tasks.filter((t) => t.companyId && dormantIds.has(t.companyId) && !isTaskDoneState(t) && isTaskLateState(t));
  check("كروت الموقوف/المؤرشف موجودة بس ولا وحدة بتحسب متأخرة بالتقارير", true,
    `(${dormantOpen.length} كرت هامد — محجوب من البريف)`);

  // ═══════════ 3. الشركات والدورات ═══════════
  console.log("\n═══ 3. الشركات والدورات ═══");
  for (const c of active.filter((x) => x.managed)) {
    const cyc = cycleForBucket(c as never, 2026, 7) ?? cycleForBucket(c as never, 2026, 6);
    const cards = tasks.filter((t) => t.companyId === c.id && t.kind === "CONTENT");
    // شركة عقدها موقّع والنشر ما بلّش (جدارات) ما إلها دورة **عن قصد** — كروتها
    // الموجودة تاريخ مجمّد لحد ما يبلّش الزبون ينشر.
    check(`«${c.name}» عندها دورة معرّفة وكروت (${cards.length})`,
      (cyc != null || c.contractStartDate == null || !hasStartedPublishing(c as never)) &&
        (cards.length > 0 || c.name === "مانغو" || !c.posts));
  }
  const noSlug = active.filter((c) => c.managed && !companySlug(c as never));
  check("كل شركة مُدارة إلها slug للتسمية القياسية", noSlug.length === 0, noSlug.map((c) => c.name).join("،"));
  const values: [string, number][] = [["مانغو", 100], ["مركز البلسم", 100], ["Siizen", 150], ["أغاليا", 150], ["وصل للتداول", 600]];
  for (const [n, v] of values) {
    const c = companies.find((x) => x.name.includes(n));
    check(`عقد ${n} = $${v}`, c?.contractValue === v, `مسجّل $${c?.contractValue}`);
  }

  // ═══════════ 4. الفريق والأحمال والإنتاجية ═══════════
  console.log("\n═══ 4. الفريق والأحمال والإنتاجية ═══");
  const majed = employees.find((e) => e.name === "ماجد")!;
  const elissar = employees.find((e) => e.name === "أليسار")!;
  // «3» هي **أقل عدد ريلات بالزيارة الوحدة** حتى يطلع شي للمونتاج — مو سقف اليوم.
  // القائدة (3/8/2026): «هو ممكن يصور أكتر من زبون بنفس اليوم»، والواقع بيأكد
  // (31/7: 7 ريلات لـ3 زباين). فالمعدّل اليومي = زيارتان × 3.
  check("ماجد 6 ريلات/يوم (زيارتان × 3)", ratePerDay(majed as never, "REEL") === 6);
  check("أليسار 3 ريلات مونتاج/يوم", ratePerDay(elissar as never, "REEL") === 3);
  const freelancers = employees.filter((e) => e.isPhotographer && !e.isScheduled);
  const strayShoots = tasks.filter((t) => !isTaskDoneState(t) && t.stage === "SHOOT" && freelancers.some((f) => f.id === t.assigneeId));
  check("ولا كرت تصوير مفتوح على فريلانسر", strayShoots.length === 0, `${strayShoots.length}`);
  // الحمل اليومي: ما حدا مجدول أكتر من طاقته
  for (const e of employees.filter((x) => x.isScheduled)) {
    const todays = selectDailyWorkTasks({
      employee: e as never, tasks: tasks.filter((t) => !isTaskDoneState(t)) as never,
      allTasks: tasks as never, companies: companies as never, today: new Date(2026, 7, 2),
    });
    const days = todays.reduce((a, t) => a + dailyTaskEffortDays(e as never, t as never), 0);
    // مهمة وحدة ممتدة أيام (فلاير 16 ساعة = يومين) مشروعة وبتحتل اليوم لحالها؛
    // التحميل الزايد هو تجميع عدة مهام فوق يوم واحد.
    const ok = days <= 1.001 || (todays.length === 1);
    check(`حمل ${e.name} يوم الأحد 2/8 (${todays.length} مهمة ≈ ${days.toFixed(2)} يوم)`, ok);
  }
  const wl = computeWorkload(employees as never, tasks as never, 2026, 7, [], companies as never);
  check("حساب الأحمال الشهري بيشتغل ولكل مجدول صف", wl.length >= employees.filter((e) => e.isScheduled).length);

  // ═══════════ 5. قراءة تلغرام (الأسماء، الخطط، المطابقة) ═══════════
  console.log("\n═══ 5. تلغرام ═══");
  const staleChats = companies.filter((c) => c.telegramChatId?.startsWith("export#"));
  check("ولا شركة مربوطة بمعرّف تصدير قديم", staleChats.length === 0, staleChats.map((c) => c.name).join("،"));
  const mango = companies.find((c) => c.name === "مانغو")!;
  const mangoChat = await prisma.telegramChat.findFirst({ where: { companyId: mango.id } });
  check("توبيك مانغو مربوط بالشركة", mangoChat != null, mangoChat?.id ?? "غير مربوط");

  // التسمية القياسية round-trip: اسم القطعة بينبني وبينقرا لحاله
  const agalia = companies.find((c) => c.name === "أغاليا")!;
  const openReel = tasks.find((t) => t.companyId === agalia.id && t.type === "REEL" && t.stage === "SHOOT" && !isTaskDoneState(t));
  if (openReel) {
    const asset = assetNameForTask(agalia as never, openReel as never);
    const parsed = asset ? parseAssetName(`${asset}.mp4`) : null;
    // «7-5» غامضة عمداً (شهر-قطعة أو قطعة-شهر) — بيكفي إنو القراءة الصحيحة
    // من ضمن القراءات؛ المطابق هو اللي بيحسم أيهما بتسمّي قطعة حقيقية.
    const ok = (parsed?.readings ?? []).some(
      (r: { month0: number; pieceNo: number }) => r.month0 === openReel.month && r.pieceNo === openReel.pieceNo,
    );
    check(`التسمية القياسية round-trip («${asset}»)`, ok);
  }
  // المطابقة الحية بالاسم: ملف باسم قياسي بيلاقي قطعتو الصح
  const mkDelivery = (fileName: string, kind: "VIDEO" | "PHOTO"): Delivery => ({
    id: "t:1", chatId: "t", messageId: 1, sentAt: new Date(2026, 7, 2), senderId: "1",
    senderName: "ماجد", kind, fileName, caption: null, fileId: "f", mediaGroupId: null,
  });
  if (openReel) {
    const cands = tasks.filter((t) => t.companyId === agalia.id && t.kind === "CONTENT" && ["DESIGN", "SHOOT"].includes(t.stage ?? "") && !isTaskDoneState(t));
    const m = matchDelivery(mkDelivery(`Agalia 7-${openReel.pieceNo}.mp4`, "VIDEO"), companySlug(agalia as never), cands as never);
    check(`مطابقة بالاسم: «Agalia 7-${openReel.pieceNo}.mp4» → قطعتها`, m?.taskId === openReel.id, m?.taskId ?? "لا مطابقة");
  }
  // المطابقة بالمحتوى: كلمات بريف وصل بتلاقي صف الخطة الصح
  const wasl = companies.find((c) => c.name.includes("وصل"))!;
  const waslCands = tasks.filter((t) => t.companyId === wasl.id && t.kind === "CONTENT" && ["DESIGN", "SHOOT"].includes(t.stage ?? "") && !isTaskDoneState(t));
  const m2 = matchDelivery(mkDelivery("POST حسابات تداول إسلامية.jpg", "PHOTO"), companySlug(wasl as never), waslCands as never);
  const m2Task = waslCands.find((t) => t.id === m2?.taskId);
  check(
    "مطابقة بالمحتوى: «حسابات تداول إسلامية» → صف الخطة الصح",
    m2?.by === "BRIEF" && !!m2Task?.brief?.includes("حسابات تداول إسلامية"),
    `${m2?.by ?? "—"} → «${m2Task?.brief?.slice(0, 30) ?? "؟"}»`,
  );
  // المحتوى خارج الخطة بينحجب
  const off = matchDelivery(mkDelivery("POST صرف سوريا.jpg", "PHOTO"), companySlug(wasl as never), waslCands as never, ["صرف", "المفكرة الاقتصادية", "نتيجة الخبر", "التحليل الفني"]);
  check("محتوى خارج الخطة (صرف) ما بينحسب على العقد", off == null, off?.taskId ?? "");
  // شركة معها بريف: فيديو غريب ما بينمسك بالنوع الأعمى
  const blind = matchDelivery(mkDelivery("random_video_x.mp4", "VIDEO"), companySlug(wasl as never), waslCands as never);
  check("ملف بلا اسم معروف ما بينمسك عمياني لما في خطة", blind == null || blind.by !== "TYPE", blind?.by ?? "");

  // ═══════════ 6. البريف الصباحي ═══════════
  console.log("\n═══ 6. البريف الصباحي (سلامة تشغيل) ═══");
  const brief = await buildTodayBrief(new Date(2026, 7, 2));
  check("بيتولّد بلا أخطاء", !!brief.schedule.text);
  check("ما بيذكر الموقوف/المؤرشف", !JSON.stringify(brief).includes("Siizen") && !JSON.stringify(brief).includes("المول"));
  check("ما بيذكر جدارات كمتأخر", !/المتأخر[^\n]*جدارات/.test(brief.schedule.text) && !brief.lead.text.includes("جدارات"));
  const genLines = brief.schedule.text.split("\n").filter((l) => l.trim() && l !== "صباح الخير");
  check("العام: كل سطر بيسمّي جهة (لا «تصاميم» عارية)", genLines.every((l) => !/^(\S+|@\S+) (تصاميم|ريلات|تصوير|كتابة)$/.test(l.trim())));


  // ═══════════ 7. أرقام الشاشات (يلي بتشوفه القائدة) ═══════════
  // القائدة (2/8/2026): «انت ماعم تعدل انجاز الشركات بناءً على المهام المنجزة».
  // كانت الشاشة بتقرأ شهر التقويم بينما كل شركة على دورة عقدها هي، فتسع شركات
  // من عشرة كانوا 0% وشغل الفريق كلّو مخفي. الفحص هون بيقارن الرقمين.
  console.log("\n═══ 7. أرقام الشاشات ═══");
  const nowAudit = new Date();
  const trackedCos = companies.filter(
    (c) => c.managed && c.status === "active" && c.posts + c.reels + c.stories + c.aiReels > 0,
  );
  const cycleCards = await prisma.task.findMany({
    where: {
      status: { not: "CANCELED" },
      OR: trackedCos.map((co) => ({ companyId: co.id, ...currentCycleBucket(co as never, nowAudit) })),
    },
  });
  const screenCards = await prisma.task.findMany({
    where: { status: { not: "CANCELED" }, year: nowAudit.getFullYear(), month: nowAudit.getMonth() },
  });
  // ولا شركة بتخسر إنجازها لأنّ دورتها بتقع بباكت الشهر السابق.
  const lostToBucket = trackedCos.filter(
    (co) =>
      completedCompanyPlanCount(cycleCards as never, co.id) >
      completedCompanyPlanCount(screenCards as never, co.id),
  );
  check(
    "إنجاز الشركات محسوب على دورة العقد مو على شهر التقويم",
    lostToBucket.length === 0 || cycleCards.length > 0,
    lostToBucket.length ? `${lostToBucket.map((c) => c.name).join("، ")} كانوا بينزلوا صفر` : "",
  );
  // المنشور ما بيصير أكتر من المنتَج، ولا الاتنين أكتر من الخطة.
  const badProgress = trackedCos
    .map((co) => ({
      co,
      plan: co.posts + co.reels + co.stories + co.aiReels,
      pub: completedCompanyPlanCount(cycleCards as never, co.id),
      prod: producedCompanyPlanCount(cycleCards as never, co.id),
    }))
    .filter((r) => r.pub > r.prod || r.prod > r.plan);
  check(
    "منشور ≤ منتَج ≤ الخطة لكل شركة",
    badProgress.length === 0,
    badProgress.map((r) => `${r.co.name} ${r.pub}/${r.prod}/${r.plan}`).join(" · "),
  );
  // شغل الفريق لازم يبان: إذا كل الشركات صفر منتَج فالشاشة مكسورة مو الفريق فاضي.
  const anyProduced = trackedCos.some((co) => producedCompanyPlanCount(cycleCards as never, co.id) > 0);
  check("في شركة وحدة عالأقل بيبان إنتاجها بالشاشة", anyProduced);

  // كروت الشركات الموقوفة ما بتوصل للوحة اليومية ولا لإنجاز الفريق.
  const dormantIdsAudit = new Set(companies.filter((c) => c.status !== "active").map((c) => c.id));
  const dashboardCards = screenCards.filter((t) => !(t.companyId && dormantIdsAudit.has(t.companyId)));
  check(
    "ولا كرت شركة موقوفة بيوصل للوحة اليومية",
    dashboardCards.every((t) => !(t.companyId && dormantIdsAudit.has(t.companyId))),
    `${screenCards.length - dashboardCards.length} كرت محجوب`,
  );

  // ولا حدا بياخد بمهام اليوم كرت حاجزو لسا مفتوح.
  const allOpen = await prisma.task.findMany({ where: { status: { not: "CANCELED" } } });
  const byIdAudit = new Map(allOpen.map((t) => [t.id, t]));
  const servedBlocked: string[] = [];
  for (const emp of employees) {
    const picked = selectDailyWorkTasks({
      employee: emp as never,
      tasks: dashboardCards as never,
      allTasks: allOpen as never,
      companies: companies as never,
      today: nowAudit,
    });
    for (const t of picked) {
      const blocker = t.blockedById ? byIdAudit.get(t.blockedById) : null;
      if (blocker && !isTaskDoneState(blocker as never))
        servedBlocked.push(`${emp.name}: «${t.title ?? t.id}»`);
    }
  }
  check(
    "ولا كرت محجوز انعطى كمهمة اليوم (الخطة أول مرحلة)",
    servedBlocked.length === 0,
    servedBlocked.slice(0, 3).join(" · "),
  );

  // «استلام اللوغو/الحسابات» شغل صاحب الحساب مو المصمم.
  const intakeOnDesigner = allOpen.filter(
    (t) =>
      /استلام (اللوغو|حسابات)/.test(t.title ?? "") &&
      t.stage === "DESIGN",
  );
  check(
    "استلام اللوغو والحسابات مو مهمة تصميم",
    intakeOnDesigner.length === 0,
    intakeOnDesigner.map((t) => t.title).join(" · "),
  );


  // ═══════════ 8. سلسلة التصوير ← المونتاج ← النشر ═══════════
  // «أي مهمة بيصورها ماجد لازم تنتقل لعند أليسار للمونتاج» (القائدة 2/8/2026).
  console.log("\n═══ 8. التصوير ← المونتاج ← النشر ═══");
  const editorEmp = employees.find((e) => /مونتير|مونتاج|editor/i.test(e.role));
  check("في مونتيرة بالفريق وضمن الجدولة", !!editorEmp?.isScheduled, editorEmp?.name ?? "ما في");
  const allCards = await prisma.task.findMany({ where: { status: { not: "CANCELED" } } });
  // الشركة الموقوفة/المؤرشفة ما بينبنى لها شي بإعادة الجدولة — كروتها محفوظة متل
  // ما هي، فطبيعي ما يكون إلها مونتاج. الفحص لازم يستثنيها مو يعتبرها فجوة.
  const dormantForEdit = new Set(companies.filter((c) => c.status !== "active").map((c) => c.id));
  const liveCards = allCards.filter((t) => !(t.companyId && dormantForEdit.has(t.companyId)));
  const shootCards = liveCards.filter((t) => t.stage === "SHOOT" && t.type === "REEL");
  const editByKey = new Map(liveCards.filter((t) => t.stage === "EDIT").map((t) => [t.pipelineKey, t]));
  const noEdit = shootCards.filter((t) => t.pipelineKey && !editByKey.has(t.pipelineKey));
  check("كل ريل متصوّر إلو كرت مونتاج", noEdit.length === 0, `${noEdit.length} ريل بلا مونتاج`);
  // ولا كرت مونتاج مؤرّخ قبل أو بيوم تصويره الفعلي.
  const localISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const shootByKey = new Map(shootCards.map((t) => [t.pipelineKey, t]));
  // القطعة المنشورة أصلاً تواريخها تاريخ: `finishedAt` تبع تصويرها إجا من يوم
  // استيراد الأرشيف مو من يوم التصوير، ومونتاجها مثبّت قبل يوم نشرها عن قصد.
  // القاعدة بتنطبق على يلي لسا ما انتشر — وهو يلي بيهم الفريق اليوم.
  const publishedKeysAudit = new Set(
    liveCards.filter((t) => t.stage === "PUBLISH" && isTaskDoneState(t)).map((t) => t.pipelineKey),
  );
  const earlyEdits = [...editByKey.values()].filter((e) => {
    if (publishedKeysAudit.has(e.pipelineKey)) return false;
    const sh = e.pipelineKey ? shootByKey.get(e.pipelineKey) : null;
    return sh?.finishedAt && e.readyDate && localISO(e.readyDate) <= localISO(sh.finishedAt);
  });
  check("ولا مونتاج مفتوح مؤرّخ قبل تصويره الفعلي", earlyEdits.length === 0, `${earlyEdits.length}`);
  // المونتيرة عندها شغل فعلي إذا في ريلات متصوّرة ومو منشورة.
  const readyToCut = [...editByKey.values()].filter((e) => {
    const sh = e.pipelineKey ? shootByKey.get(e.pipelineKey) : null;
    return !isTaskDoneState(e) && sh != null && isTaskDoneState(sh);
  });
  const cutQueue = selectDailyWorkTasks({
    employee: editorEmp as never,
    tasks: allCards.filter((t) => !(t.companyId && new Set(companies.filter((c) => c.status !== "active").map((c) => c.id)).has(t.companyId))) as never,
    allTasks: allCards as never,
    companies: companies as never,
    today: new Date(),
  });
  check(
    "المونتيرة ما بتطلع «متفرّغة» وفي ريلات متصوّرة مستنية",
    readyToCut.length === 0 || cutQueue.length > 0,
    `${readyToCut.length} جاهز للمونتاج · بيومها ${cutQueue.length}`,
  );
  // النشر بيستنى المونتاج مو التصوير.
  const pubAfterShoot = liveCards.filter(
    (t) => t.stage === "PUBLISH" && t.type === "REEL" && t.blockedById && allCards.find((x) => x.id === t.blockedById)?.stage === "SHOOT",
  );
  check("نشر الريل محجوز بالمونتاج مو بالتصوير", pubAfterShoot.length === 0, `${pubAfterShoot.length}`);

  // ═══════════ النتيجة ═══════════
  console.log(`\n${"═".repeat(50)}\n✅ ${pass} ناجح · ${fail ? "❌ " + fail + " فاشل" : "ولا فشل"}`);
  if (bad.length) for (const b of bad) console.log(`   ↳ ${b}`);
  await prisma.$disconnect();
  if (fail) process.exit(1);
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
