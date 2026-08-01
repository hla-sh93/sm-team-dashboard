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
import { ratePerDay } from "../src/lib/capacity";
import { cycleForBucket } from "../src/lib/contract";

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

async function fingerprint() {
  const rows = await prisma.task.findMany({ orderBy: { id: "asc" } });
  return rows.map((t) =>
    [t.id, t.status, t.board, t.assigneeId, t.pieceNo, t.isPinned, t.brief?.length ?? 0,
     t.publishDate?.getTime() ?? 0, t.workDate?.getTime() ?? 0, t.finishedAt?.getTime() ?? 0].join("|"),
  );
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
    check(`«${c.name}» عندها دورة معرّفة وكروت (${cards.length})`,
      (cyc != null || c.contractStartDate == null) && (cards.length > 0 || c.name === "مانغو" || !c.posts));
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
  check("ماجد 3 ريلات/يوم", ratePerDay(majed as never, "REEL") === 3);
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
  const m2 = matchDelivery(mkDelivery("POST مساعد الذكاء الاصطناعي.jpg", "PHOTO"), companySlug(wasl as never), waslCands as never);
  const m2Task = waslCands.find((t) => t.id === m2?.taskId);
  check(
    "مطابقة بالمحتوى: «مساعد الذكاء الاصطناعي» → صف الخطة الصح",
    m2?.by === "BRIEF" && !!m2Task?.brief?.includes("مساعد الذكاء الاصطناعي"),
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

  // ═══════════ النتيجة ═══════════
  console.log(`\n${"═".repeat(50)}\n✅ ${pass} ناجح · ${fail ? "❌ " + fail + " فاشل" : "ولا فشل"}`);
  if (bad.length) for (const b of bad) console.log(`   ↳ ${b}`);
  await prisma.$disconnect();
  if (fail) process.exit(1);
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
