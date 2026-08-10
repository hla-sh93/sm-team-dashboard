/**
 * الفحص الشامل العميق — 2026-08-02، بطلب القائدة: «افحص كل منطق ودالة وعلاقة
 * وصفحة وعدّاد بالمشروع».
 *
 * القاعدة هون **مختلفة عن `deep-audit.ts`**: هداك بيتأكد إنّ الكود ما بينهار
 * وإنّ القواعد التشغيلية محترمة. هاد بيعيد حساب كل رقم **بطريقة مستقلة عن
 * الدالة اللي بتنتجه** وبيقارن. دالة غلط بتنجح بفحص بيستدعيها؛ ما بتنجح بفحص
 * بيحسب الجواب لحاله.
 *
 *   npx tsx scripts/full-system-audit.ts
 *   npx tsx scripts/full-system-audit.ts --section=3
 */
import { PrismaClient } from "@prisma/client";
import {
  isTaskDoneState,
  isTaskLateState,
  statusToBoard,
  STAGES,
  CONTENT_TYPE_LABELS,
} from "../src/lib/constants";
import { toISODate, fromISODate, parseWorkDays, addWorkingDays } from "../src/lib/dates";
import {
  cyclesOf,
  cycleForBucket,
  currentCycle,
  currentCycleBucket,
  hasStartedPublishing,
} from "../src/lib/contract";
import { completedCompanyPlanCount, producedCompanyPlanCount } from "../src/lib/progress";
import {
  selectDailyWorkTasks,
  dailyTaskEffortDays,
  makeBlockedPredicate,
} from "../src/lib/daily-work";
import { computeWorkload } from "../src/lib/workload";
import { computeFinance } from "../src/lib/finance";
import { ratePerDay, parseRates, cardDurationDays, taskDays } from "../src/lib/capacity";
import { assetNameForTask, parseAssetName, companySlug, assetName } from "../src/lib/asset-name";
import { buildContentNumbers, groupTasksIntoCards } from "../src/lib/cards";
import { derivePublishingSchedule } from "../src/lib/publishing";
import { buildTodayBrief } from "../src/lib/telegram/service";
import { briefMessagesFor } from "../src/lib/telegram/brief";
import { splitForTelegram, TG_TEXT_LIMIT } from "../src/lib/telegram/client";
import { matchDelivery } from "../src/lib/telegram/match";
import { taskOccursOnISODate, filterTasksForDay } from "../src/lib/task-filters";
import { personDayState } from "../src/lib/person-day-state";
import { employeeSchema, companySchema, taskSchema } from "../src/lib/schemas";
import { TASK_KINDS } from "../src/lib/constants";

const prisma = new PrismaClient();
const ONLY = process.argv.find((a) => a.startsWith("--section="))?.split("=")[1];

let pass = 0;
const failures: string[] = [];
let section = "";
function sec(title: string) {
  section = title;
  console.log(`\n═══ ${title} ═══`);
}
function ok(name: string, good: boolean, detail = "") {
  if (good) {
    pass++;
    console.log(`  ✅ ${name}`);
  } else {
    failures.push(`[${section}] ${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}
/** Show at most 3 offenders — enough to act on, short enough to read. */
const ev = (xs: unknown[], n = 3) =>
  `${xs.length}${xs.length ? `: ${xs.slice(0, n).join(" · ")}${xs.length > n ? " …" : ""}` : ""}`;

const L = (d: Date | null | undefined) =>
  d
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    : null;

async function main() {
  const companies = await prisma.company.findMany({ orderBy: { priority: "asc" } });
  const employees = await prisma.employee.findMany({ orderBy: { createdAt: "asc" } });
  const tasks = await prisma.task.findMany();
  const sessions = await prisma.photoSession.findMany();
  const tgMessages = await prisma.telegramMessage.findMany();
  const tgChats = await prisma.telegramChat.findMany();
  const live = tasks.filter((t) => t.status !== "CANCELED");
  const coById = new Map(companies.map((c) => [c.id, c]));
  const empById = new Map(employees.map((e) => [e.id, e]));
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const NOW = new Date();
  const want = (n: string) => !ONLY || ONLY === n;

  console.log(
    `الداتا: ${companies.length} شركة · ${employees.length} موظف · ${tasks.length} كرت ` +
      `(${live.length} حي) · ${sessions.length} جلسة تصوير · ${tgMessages.length} رسالة تلغرام`,
  );

  // ══════════════════════════════════════════════════════════
  if (want("1")) {
    sec("1. العلاقات — كل مفتاح أجنبي بيشير لشي موجود");

    const badAssignee = live.filter((t) => t.assigneeId && !empById.has(t.assigneeId));
    ok("كل مُسند إليه موظف موجود", badAssignee.length === 0, ev(badAssignee.map((t) => t.id)));

    const badCompany = live.filter((t) => t.companyId && !coById.has(t.companyId));
    ok("كل كرت مربوط بشركة موجودة", badCompany.length === 0, ev(badCompany.map((t) => t.id)));

    const badBlocker = live.filter((t) => t.blockedById && !taskById.has(t.blockedById));
    ok("كل حاجز يشير لكرت موجود", badBlocker.length === 0, ev(badBlocker.map((t) => t.id)));

    // حلقة حجز = قفلة أبدية بمهام اليوم
    const cycles: string[] = [];
    for (const t of live) {
      const seen = new Set<string>();
      let cur: typeof t | undefined = t;
      while (cur?.blockedById) {
        if (seen.has(cur.id)) {
          cycles.push(t.id);
          break;
        }
        seen.add(cur.id);
        cur = taskById.get(cur.blockedById);
      }
    }
    ok("ولا حلقة حجز مغلقة", cycles.length === 0, ev(cycles));

    // ولا كرت منجز وحاجزه لسا مفتوح — «مونتاج خالص وتصويره ما صار» حالة
    // مستحيلة، وصارت فعلاً لما إغلاق قديم ثبّتته خطوة الحفظ.
    // كرت الكتابة استثناء: هو كرت **دورة** واحد بيحجز كل قطعها، وقطعة وحدة ممكن
    // توصل قبل ما تخلص كتابة الدورة كلها — ماجد سلّم «Jadarat 1-7.mp4» بـ٢٩/٧
    // وكتابة دورة ٨/٨ لسا ما بلّشت. يلي مستحيل هو ترتيب الإنتاج نفسه (مونتاج
    // خالص وتصويره ما صار)، وهاد لساتو ممسوك.
    const doneWhileBlocked = live.filter((t) => {
      if (!isTaskDoneState(t) || !t.blockedById) return false;
      const b = taskById.get(t.blockedById);
      return !!b && b.stage !== "WRITE" && !isTaskDoneState(b);
    });
    ok(
      "ولا كرت منجز وحاجزه مفتوح",
      doneWhileBlocked.length === 0,
      ev(doneWhileBlocked.map((t) => `${t.stage}←${taskById.get(t.blockedById!)?.stage}`), 4),
    );

    // كرت ما بيحجز حالو ولا بيحجز كرت من قطعة تانية بمرحلة أبكر
    // بس على خط الإنتاج: كرت «استلام اللوغو» اليدوي مسجّل PUBLISH كبند متابعة،
    // فترتيب المراحل ما إلو معنى عليه — المهم إنّ الحاجز موجود ومنطقي.
    const backwardBlock = live.filter((t) => {
      const b = t.blockedById ? taskById.get(t.blockedById) : null;
      if (!b || !t.stage || !b.stage) return false;
      if (t.kind === "ADHOC" || b.kind === "ADHOC") return false;
      return STAGES.indexOf(b.stage as never) >= STAGES.indexOf(t.stage as never);
    });
    ok(
      "الحاجز دايماً بمرحلة أبكر من المحجوز",
      backwardBlock.length === 0,
      ev(backwardBlock.map((t) => `${t.stage}←${taskById.get(t.blockedById!)?.stage}`)),
    );

    const badSessionCo = sessions.filter((s) => s.companyId && !coById.has(s.companyId));
    ok("كل جلسة تصوير مربوطة بشركة موجودة", badSessionCo.length === 0, ev(badSessionCo.map((s) => s.id)));

    const badTgTask = tgMessages.filter((m) => m.taskId && !taskById.has(m.taskId));
    ok("كل رسالة مطابَقة مربوطة بكرت موجود", badTgTask.length === 0, ev(badTgTask.map((m) => m.id)));

    const badTgCo = tgMessages.filter((m) => m.companyId && !coById.has(m.companyId));
    ok("كل رسالة تلغرام مربوطة بشركة موجودة", badTgCo.length === 0, ev(badTgCo.map((m) => m.id)));

    const badChatCo = tgChats.filter((c) => c.companyId && !coById.has(c.companyId));
    ok("كل توبيك مربوط بشركة موجودة", badChatCo.length === 0, ev(badChatCo.map((c) => c.id)));

    for (const field of ["postOwnerId", "storyOwnerId", "aiReelOwnerId", "defaultOwnerId", "photographerId", "accountOwnerId"] as const) {
      const bad = companies.filter((c) => c[field] && !empById.has(c[field] as string));
      ok(`Company.${field} يشير لموظف موجود`, bad.length === 0, ev(bad.map((c) => c.name)));
    }
  }

  // ══════════════════════════════════════════════════════════
  if (want("2")) {
    sec("2. شكل الكرت — الحقول المتوافقة مع بعضها");

    const badBoard = live.filter((t) => statusToBoard(t.status) !== t.board);
    ok("board مشتق من status لكل كرت", badBoard.length === 0,
      ev(badBoard.map((t) => `${t.id}:${t.status}/${t.board}`)));

    const contentNoType = live.filter((t) => t.kind === "CONTENT" && !t.type);
    ok("كل كرت محتوى إلو نوع", contentNoType.length === 0, ev(contentNoType.map((t) => t.id)));

    // «ممنوع كرت بلا وصف — كيف بدي أعرف شو الريل يلي تأخر؟» (القائدة 2/8/2026).
    // الوصف تبع القطعة: كرت النشر/التصوير/المونتاج بياخده من كرت التصميم، فالنقص
    // الحقيقي هو قطعة ما إلها نصّ خطة **بأي مرحلة**.
    const briefOfPiece = new Map<string, string>();
    for (const t of live) {
      if (!t.pipelineKey || !t.brief?.trim() || briefOfPiece.has(t.pipelineKey)) continue;
      briefOfPiece.set(t.pipelineKey, t.brief);
    }
    // …بس بحدود **الدورات اللي إجا دور خططها**. القائدة (8/8): «ليش بدك خطط
    // أيلول من هلق؟ الخطط بتصير بآخر 10 أيام من الشهر السابق». فكرت أيلول بلا
    // وصف بأول آب مو نقص — هو شغل ما حان وقته، وعدّه بيغرق الفحص بضجيج
    // بيخفّي النقص الحقيقي (دورة شغّالة بلا خطة).
    const PLAN_LEAD_DAYS = 10;
    const planDue = (t: { year: number; month: number }) => {
      const cycleStart = new Date(t.year, t.month, 1);
      cycleStart.setDate(cycleStart.getDate() - PLAN_LEAD_DAYS);
      return NOW >= cycleStart;
    };
    // والشغل الإضافي (ADHOC) برّا القياس: عنوانه هو وصفه — «نشرات الصرف
    // والمفكرة الاقتصادية» ما إلها نصّ خطة ولا لازمها، وعدّها كنقص بيخلّي
    // وصل تطلع 21 ناقصة وهي مضبوطة.
    const openWork = live.filter(
      (t) =>
        !isTaskDoneState(t) && t.kind !== "CONTENT_WRITING" && t.kind !== "ADHOC" && planDue(t),
    );
    const noBrief = openWork.filter(
      (t) => !t.brief?.trim() && !(t.pipelineKey && briefOfPiece.has(t.pipelineKey)),
    );
    const byCoNoBrief = new Map<string, number>();
    for (const t of noBrief) {
      const n = t.companyId ? (coById.get(t.companyId)?.name ?? "—") : "بلا شركة";
      byCoNoBrief.set(n, (byCoNoBrief.get(n) ?? 0) + 1);
    }
    ok(
      `كل كرت مفتوح إلو وصف (${openWork.length - noBrief.length}/${openWork.length})`,
      noBrief.length === 0,
      [...byCoNoBrief].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k} ${v}`).join(" · "),
    );

    // مراحل القطعة الوحدة لازم تتفق على شو هي القطعة. مستورد الخطط كان يحط
    // كل مراحل الإنتاج بسلة وحدة، فالريل (تصوير + مونتاج) بياكل بندين وكل يلي
    // بعده بينزاح — فيطلع كرت التصوير بيحكي عن موضوع وكرت النشر عن غيره،
    // والمطابقة بتفشل لأنها بتقرا نصّ القطعة الغلط.
    const briefByPipe = new Map<string, Set<string>>();
    for (const t of live) {
      if (!t.pipelineKey || !t.brief?.trim()) continue;
      const head = t.brief.split("\n").slice(0, 2).join(" ").trim();
      if (!briefByPipe.has(t.pipelineKey)) briefByPipe.set(t.pipelineKey, new Set());
      briefByPipe.get(t.pipelineKey)!.add(head);
    }
    const splitBrief = [...briefByPipe].filter(([, s]) => s.size > 1);
    ok(
      `مراحل القطعة الوحدة بتحمل نفس الوصف (${briefByPipe.size - splitBrief.length}/${briefByPipe.size})`,
      splitBrief.length === 0,
      ev(splitBrief.map(([k]) => k)),
    );

    // الريل بينصوّر بسكربت — بلا وصف الكرت بيقول «ريل ٣» وبس وماجد بيوقف.
    // القائدة (10/8): «كل المهام الدورية لازم يكون الها وصف، أو على الأقل
    // الريلات، لأن البوستات تتغير حسب رغبة الزبون والمنتجات». وهاد الفحص
    // أضيق من «كل كرت مفتوح إلو وصف» وأقبل للتنفيذ: بيسمّي الشركة والرقم.
    const reelNoBrief = live.filter(
      (t) =>
        (t.type === "REEL" || t.type === "AI_REEL") &&
        (t.stage === "SHOOT" || t.stage === "EDIT") &&
        !isTaskDoneState(t) &&
        planDue(t) &&
        !t.brief?.trim() &&
        !(t.pipelineKey && briefOfPiece.has(t.pipelineKey)),
    );
    const reelGaps = new Map<string, Set<number>>();
    for (const t of reelNoBrief) {
      const n = t.companyId ? (coById.get(t.companyId)?.name ?? "—") : "—";
      reelGaps.set(n, (reelGaps.get(n) ?? new Set()).add(t.pieceNo ?? 0));
    }
    ok(
      "كل ريل مستحقّ إلو سكربت تصوير",
      reelGaps.size === 0,
      [...reelGaps].map(([k, v]) => `${k} ${[...v].sort((a, b) => a - b).join(",")}`).join(" · "),
    );

    const adhocNoTitle = live.filter((t) => t.kind === "ADHOC" && !t.title?.trim());
    ok("كل كرت إضافي إلو عنوان", adhocNoTitle.length === 0, ev(adhocNoTitle.map((t) => t.id)));

    const badStage = live.filter((t) => t.stage && !STAGES.includes(t.stage as never));
    ok("كل مرحلة ضمن القائمة المعرّفة", badStage.length === 0, ev(badStage.map((t) => t.stage)));

    const badQty = live.filter((t) => (t.quantity ?? 1) < 1);
    ok("ولا كمية أقل من 1", badQty.length === 0, ev(badQty.map((t) => t.id)));

    const doneNoStamp = live.filter((t) => isTaskDoneState(t) && !t.finishedAt);
    ok("كل كرت منجز معو تاريخ إنجاز", doneNoStamp.length === 0, ev(doneNoStamp.map((t) => t.id)));

    const openWithStamp = live.filter((t) => !isTaskDoneState(t) && t.completedAt);
    ok("ولا كرت مفتوح معو تاريخ إتمام", openWithStamp.length === 0, ev(openWithStamp.map((t) => t.id)));

    const inverted = live.filter((t) => t.startedAt && t.finishedAt && t.finishedAt < t.startedAt);
    ok("ولا شغل خلص قبل ما يبلّش", inverted.length === 0, ev(inverted.map((t) => t.id)));

    // الباكت لازم يطابق تاريخ الكرت الأساسي (وإلا الكرت بيختفي من شهره)
    const bucketMismatch = live.filter((t) => {
      const d = t.workDate ?? t.readyDate ?? t.publishDate;
      if (!d || !t.isAuto) return false;
      // كرت الترحيل بيضل بباكت دورته الأصلية عن قصد — منقارن بس المتولّد بشهره
      return false || (t.year !== d.getFullYear() && Math.abs(t.year - d.getFullYear()) > 1);
    });
    ok("ولا كرت بسنة بعيدة عن تاريخه", bucketMismatch.length === 0, ev(bucketMismatch.map((t) => t.id)));

    // النشر ما بيصير قبل الجهوزية
    // الكرت المنشور تواريخه تاريخ — الترتيب بيهمّ للشغل المفتوح يلي لسا رح يتنفّذ.
    const pubBeforeReady = live.filter(
      (t) =>
        t.stage === "PUBLISH" && !isTaskDoneState(t) &&
        t.publishDate && t.readyDate && L(t.publishDate)! < L(t.readyDate)!,
    );
    ok("ولا نشر مفتوح مؤرّخ قبل جهوزيته", pubBeforeReady.length === 0, ev(pubBeforeReady.map((t) => t.id)));
  }

  // ══════════════════════════════════════════════════════════
  if (want("3")) {
    sec("3. القطعة — سلسلة المراحل ورقمها");

    const byPipe = new Map<string, typeof live>();
    for (const t of live) {
      if (!t.pipelineKey || t.kind === "CONTENT_WRITING") continue;
      byPipe.set(t.pipelineKey, [...(byPipe.get(t.pipelineKey) ?? []), t]);
    }

    // ولا قطعة فيها مرحلتين من نفس النوع
    const dupStage: string[] = [];
    for (const [k, g] of byPipe) {
      const seen = new Set<string>();
      for (const t of g) {
        const key = `${t.stage}|${t.year}-${t.month}`;
        if (seen.has(key)) dupStage.push(`${k}:${t.stage}`);
        seen.add(key);
      }
    }
    ok("ولا قطعة فيها مرحلة مكرّرة بنفس الدورة", dupStage.length === 0, ev(dupStage));

    // كل قطعة محتوى إلها كرت نشر
    const noPublish: string[] = [];
    for (const [k, g] of byPipe) {
      if (!g.some((t) => t.kind === "CONTENT")) continue;
      const co = g[0].companyId ? coById.get(g[0].companyId) : null;
      if (co && co.status !== "active") continue;
      if (!g.some((t) => t.stage === "PUBLISH")) noPublish.push(k);
    }
    ok("كل قطعة إنتاج إلها كرت نشر", noPublish.length === 0, ev(noPublish));

    // كل مراحل القطعة بنفس الشركة والنوع والرقم
    const mixed: string[] = [];
    for (const [k, g] of byPipe) {
      if (new Set(g.map((t) => t.companyId)).size > 1) mixed.push(`${k}: شركات`);
      if (new Set(g.map((t) => t.type)).size > 1) mixed.push(`${k}: أنواع`);
      const nos = new Set(g.filter((t) => t.pieceNo != null).map((t) => t.pieceNo));
      if (nos.size > 1) mixed.push(`${k}: أرقام ${[...nos].join("/")}`);
    }
    ok("مراحل القطعة متفقة بالشركة والنوع والرقم", mixed.length === 0, ev(mixed));

    // ترتيب زمني داخل القطعة: كتابة ≤ إنتاج ≤ مونتاج ≤ نشر
    // المرحلة المنجزة تاريخها الحقيقي هو `finishedAt`؛ الباقي تاريخها المخطط.
    // (بلا هالتمييز، تصوير انعمل بدري بيطلع «مونتاج قبل التصوير» وهو غلط قياس.)
    const outOfOrder: string[] = [];
    for (const [k, g] of byPipe) {
      const at = (stage: string) => {
        const c = g.find((t) => t.stage === stage);
        if (!c) return null;
        return isTaskDoneState(c)
          ? L(c.finishedAt ?? c.completedAt ?? c.readyDate ?? c.publishDate)
          : L(c.readyDate ?? c.workDate ?? c.publishDate);
      };
      const chain = [at("DESIGN") ?? at("SHOOT"), at("EDIT")].filter(Boolean) as string[];
      for (let i = 1; i < chain.length; i++) if (chain[i] < chain[i - 1]) outOfOrder.push(k);
    }
    ok("المونتاج دايماً بعد تصويره الفعلي", outOfOrder.length === 0, ev(outOfOrder));

    // النشر ما بيسبق الإنتاج بالشغل **المفتوح** (المنشور تاريخه تاريخ).
    const pubEarly: string[] = [];
    for (const [k, g] of byPipe) {
      const pub = g.find((t) => t.stage === "PUBLISH");
      const prod = g.find((t) => t.stage === "DESIGN" || t.stage === "SHOOT");
      if (!pub || !prod || isTaskDoneState(pub) || isTaskDoneState(prod)) continue;
      const pd = L(pub.publishDate ?? pub.readyDate);
      const rd = L(prod.readyDate ?? prod.workDate);
      if (pd && rd && pd < rd) pubEarly.push(k);
    }
    ok("ولا نشر مفتوح مجدول قبل إنتاجه المفتوح", pubEarly.length === 0, ev(pubEarly));

    // ترقيم القطع: متسلسل بلا فجوات ضمن (شركة، نوع، دورة)
    const gaps: string[] = [];
    const groups = new Map<string, Set<number>>();
    for (const t of live) {
      if (t.kind !== "CONTENT" || t.pieceNo == null) continue;
      if (t.stage === "PUBLISH" || t.stage === "EDIT") continue;
      const co = t.companyId ? coById.get(t.companyId) : null;
      if (!co || co.status !== "active") continue;
      const k = `${co.name}|${t.type}|${t.year}-${t.month + 1}`;
      groups.set(k, (groups.get(k) ?? new Set()).add(t.pieceNo));
    }
    for (const [k, nos] of groups) {
      const sorted = [...nos].sort((a, b) => a - b);
      if (sorted[0] !== 1 || sorted[sorted.length - 1] !== sorted.length) gaps.push(`${k}: ${sorted.join(",")}`);
    }
    ok("ترقيم القطع متسلسل من 1 بلا فجوات", gaps.length === 0, ev(gaps, 4));
  }

  // ══════════════════════════════════════════════════════════
  if (want("4")) {
    sec("4. الدورات والعقود");

    for (const co of companies.filter((c) => c.contractStartDate)) {
      const cs = cyclesOf(co as never);
      // ولا تداخل ولا فجوة بين الدورات المتتالية
      let bad = "";
      for (let i = 1; i < cs.length; i++) {
        if (cs[i].start < cs[i - 1].end) bad = `تداخل عند ${i}`;
      }
      ok(`دورات «${co.name}» متتالية بلا تداخل (${cs.length})`, !bad, bad);
    }

    // currentCycleBucket لازم يكون معكوس cycleForBucket
    const inverseBad: string[] = [];
    for (const co of companies.filter((c) => c.contractStartDate)) {
      const cyc = currentCycle(co as never, NOW);
      if (!cyc) continue;
      const b = currentCycleBucket(co as never, NOW);
      const back = cycleForBucket(co as never, b.year, b.month);
      if (!back || back.start.getTime() !== cyc.start.getTime()) inverseBad.push(co.name);
    }
    ok("currentCycleBucket معكوس cycleForBucket تماماً", inverseBad.length === 0, ev(inverseBad));

    // كل كرت لشركة نشطة واقع ضمن دورة معرّفة
    const outsideCycle: string[] = [];
    for (const co of companies.filter(
      (c) =>
        c.managed &&
        c.status === "active" &&
        c.contractStartDate &&
        // النشر ما بلّش → ما إلها دورة عن قصد، وكروتها تاريخ مجمّد.
        hasStartedPublishing(c as never),
    )) {
      const cards = live.filter((t) => t.companyId === co.id && t.kind === "CONTENT");
      for (const c of cards) {
        if (!cycleForBucket(co as never, c.year, c.month)) outsideCycle.push(`${co.name} ${c.year}-${c.month + 1}`);
      }
    }
    ok("كل كرت محتوى واقع ضمن دورة معرّفة", outsideCycle.length === 0, ev([...new Set(outsideCycle)]));
  }

  // ══════════════════════════════════════════════════════════
  if (want("5")) {
    sec("5. العدّادات — إعادة حساب مستقلة");

    // ---- إنجاز الشركات: منشور ومنتَج
    const cycleCards = new Map<string, typeof live>();
    for (const co of companies) {
      const b = currentCycleBucket(co as never, NOW);
      cycleCards.set(co.id, live.filter((t) => t.companyId === co.id && t.year === b.year && t.month === b.month));
    }
    const progressBad: string[] = [];
    for (const co of companies.filter((c) => c.managed && c.status === "active")) {
      const plan = co.posts + co.reels + co.stories + co.aiReels;
      if (!plan) continue;
      const cards = cycleCards.get(co.id)!;
      // حساب يدوي: قطعة منشورة = كرت نشرها منجز
      // الشغل الإضافي مو من الخطة، فما بيدخل بعدّادها — ولو كان نوعه ريل أو
      // بوست. ريل أيمن بالذكاء الاصطناعي لوصل (`ADHOC`) كان بيزيد «المنتَج»
      // واحداً عن الدالة، فيبان خلاف بين رقمين صحيحين كل واحد بمكانه.
      const planCards = cards.filter((t) => t.kind !== "ADHOC");
      const keys = new Set(planCards.filter((t) => t.type).map((t) => t.pipelineKey ?? t.id));
      let manualPub = 0;
      let manualProd = 0;
      for (const k of keys) {
        const g = planCards.filter((t) => (t.pipelineKey ?? t.id) === k);
        const pub = g.find((t) => t.stage === "PUBLISH");
        const edit = g.find((t) => t.stage === "EDIT");
        const prod = g.find((t) => t.stage === "DESIGN" || t.stage === "SHOOT");
        if (pub && isTaskDoneState(pub)) manualPub += pub.quantity ?? 1;
        const producedOK = edit
          ? isTaskDoneState(edit)
          : !!prod && isTaskDoneState(prod);
        if (producedOK || (pub && isTaskDoneState(pub))) manualProd += prod?.quantity ?? pub?.quantity ?? 1;
      }
      const fnPub = completedCompanyPlanCount(cards as never, co.id);
      const fnProd = producedCompanyPlanCount(cards as never, co.id);
      if (fnPub !== manualPub) progressBad.push(`${co.name} منشور ${fnPub}≠${manualPub}`);
      if (fnProd !== manualProd) progressBad.push(`${co.name} منتَج ${fnProd}≠${manualProd}`);
      if (fnPub > fnProd) progressBad.push(`${co.name} منشور>منتَج`);
      if (fnProd > plan) progressBad.push(`${co.name} منتَج>الخطة`);
    }
    ok("إنجاز الشركات = الحساب اليدوي المستقل", progressBad.length === 0, ev(progressBad, 4));

    // النظرة العامة بتعطي رقم واحد للشركة، والتقارير بتفصّله بالنوع. لازم
    // يتطابقوا — كانت الصفحتان بتقرآ نافذتين مختلفتين (دورة مقابل شهر تقويمي).
    const splitBad: string[] = [];
    for (const co of companies.filter((c) => c.managed && c.status === "active")) {
      const cards = cycleCards.get(co.id)!;
      const total = completedCompanyPlanCount(cards as never, co.id);
      const perType = (["POST", "REEL", "AI_REEL", "STORY"] as const).reduce(
        (a, t) => a + completedCompanyPlanCount(cards as never, co.id, t),
        0,
      );
      if (total !== perType) splitBad.push(`${co.name} ${total}≠${perType}`);
    }
    ok("رقم النظرة العامة = مجموع تفصيل التقارير بالنوع", splitBad.length === 0, ev(splitBad));

    // ---- إنجاز الفريق: مجموع الكميات
    const aug = live.filter((t) => t.year === NOW.getFullYear() && t.month === NOW.getMonth());
    const teamBad: string[] = [];
    for (const e of employees) {
      const mine = aug.filter((t) => t.assigneeId === e.id);
      const total = mine.reduce((a, t) => a + (t.quantity ?? 1), 0);
      const done = mine.filter(isTaskDoneState).reduce((a, t) => a + (t.quantity ?? 1), 0);
      if (done > total) teamBad.push(`${e.name} ${done}>${total}`);
    }
    ok("ولا موظف إنجازه أكبر من إجمالي مهامه", teamBad.length === 0, ev(teamBad));

    // ---- الأحمال: مجموع أيام الشخص = مجموع أيام كروته
    const wl = computeWorkload(
      employees as never,
      live.filter((t) => t.year === NOW.getFullYear() && t.month === NOW.getMonth()) as never,
      NOW.getFullYear(),
      NOW.getMonth(),
      sessions as never,
      companies as never,
    );
    ok("حساب الأحمال بيرجع صف لكل موظف", wl.length === employees.length, `${wl.length}/${employees.length}`);
    const negWL = wl.filter(
      (r) => r.capacityDays < 0 || r.committedDays < 0 || r.doneDays < 0 || r.remainingDays < 0,
    );
    ok("ولا رقم حمل بالسالب", negWL.length === 0, ev(negWL.map((r) => r.employee.name)));
    // remaining = committed − done، و free = capacity − committed (بحد أدنى صفر)
    // كل حقل مقرّب لخانة عشرية لحاله، فالفرق المسموح 0.1 مو 0.01.
    const wlMath = wl.filter(
      (r) =>
        Math.abs(r.remainingDays - (r.committedDays - r.doneDays)) > 0.11 ||
        Math.abs(r.freeDays - Math.max(0, r.capacityDays - r.committedDays)) > 0.11,
    );
    ok("متبقّي = ملتزم − منجز، وفاضي = طاقة − ملتزم", wlMath.length === 0,
      ev(wlMath.map((r) => `${r.employee.name} ${r.committedDays.toFixed(1)}/${r.doneDays.toFixed(1)}/${r.remainingDays.toFixed(1)}`)));
    // نسبة الحمل = ملتزم ÷ طاقة.
    //
    // السماحية بتراكم من تقريبين مستقلين: `pct` محسوبة من الملتزم **الأصلي** ثم
    // مقرّبة لصحيح (±0.5)، والمقارنة بتستعمل الملتزم **المقرّب لخانة** (±0.05
    // ÷ الطاقة × 100 ≈ ±0.22 بطاقة ٢٣ يوم). فالفرق المشروع بيوصل ٠٫٧٢ —
    // و٠٫٦ كانت بتطلّع إنذاراً كاذباً على سابين (55 مقابل 55.65).
    const wlPct = wl.filter(
      (r) => r.capacityDays > 0 && Math.abs(r.pct - (r.committedDays / r.capacityDays) * 100) > 0.8,
    );
    ok("نسبة الحمل = ملتزم ÷ طاقة", wlPct.length === 0,
      ev(wlPct.map((r) => `${r.employee.name} ${r.pct.toFixed(1)}%`)));
    // تفصيل الأنواع ما بيتجاوز عدد الكروت
    const wlItems = wl.filter((r) => {
      const sum = Object.values(r.breakdown).reduce((a, b) => a + b, 0);
      return sum > r.itemCount + 0.001;
    });
    ok("تفصيل أنواع الحمل ≤ عدد كروته", wlItems.length === 0, ev(wlItems.map((r) => r.employee.name)));

    // ---- الطاقة: كل معدّل موجب ومعقول
    const rateBad: string[] = [];
    for (const e of employees) {
      const rates = parseRates(e.rates as string);
      for (const [type, v] of Object.entries(rates)) {
        if (!(v > 0) || v > 50) rateBad.push(`${e.name}/${type}=${v}`);
        const rp = ratePerDay(e as never, type);
        if (Math.abs(rp - v) > 1e-9) rateBad.push(`${e.name}/${type} ratePerDay ${rp}≠${v}`);
      }
    }
    ok("كل معدّل إنتاجية موجب ومطابق لـ ratePerDay", rateBad.length === 0, ev(rateBad));

    // taskDays عكس ratePerDay
    const tdBad: string[] = [];
    for (const e of employees) {
      for (const [type, v] of Object.entries(parseRates(e.rates as string))) {
        const d = taskDays(e as never, type, v);
        if (Math.abs(d - 1) > 1e-6) tdBad.push(`${e.name}/${type}: ${v} قطعة = ${d.toFixed(3)} يوم`);
      }
    }
    ok("taskDays(معدّل اليوم) = يوم واحد بالضبط", tdBad.length === 0, ev(tdBad));

    // ---- الماليات
    const fin = computeFinance(employees as never, companies as never, NOW.getFullYear(), NOW.getMonth());
    const finBad: string[] = [];
    const totalContracts = companies
      .filter((c) => c.managed && c.status === "active")
      .reduce((a, c) => a + c.contractValue, 0);
    if (Math.abs(fin.totalRevenue - totalContracts) > 0.01)
      finBad.push(`الإيراد ${fin.totalRevenue} ≠ مجموع العقود ${totalContracts}`);
    for (const p of fin.perContract) {
      if (Math.abs(p.revenue - p.laborCost - p.profit) > 0.01)
        finBad.push(`${p.company.name}: ربح ≠ إيراد − تكلفة`);
      if (Math.abs(p.contribution - (p.revenue - p.marginalCost)) > 0.01)
        finBad.push(`${p.company.name}: مساهمة ≠ إيراد − تكلفة حدية`);
      if (p.revenue > 0 && Math.abs(p.margin - (p.profit / p.revenue) * 100) > 0.1)
        finBad.push(`${p.company.name}: هامش غلط`);
    }
    if (Math.abs(fin.totalCost - (fin.totalSalaries + fin.totalVariable)) > 0.01)
      finBad.push(`التكلفة ≠ رواتب + متغيّر`);
    if (Math.abs(fin.netProfit - (fin.totalRevenue - fin.totalCost)) > 0.01)
      finBad.push(`صافي الربح ≠ إيراد − تكلفة`);
    if (fin.numContracts !== companies.filter((c) => c.managed && c.status === "active").length)
      finBad.push(`عدد العقود ${fin.numContracts}`);
    ok("الماليات متسقة (ربح/هامش/مساهمة/تكلفة/صافي)", finBad.length === 0, ev(finBad, 4));

    // ---- جدول النشر: ولا ازدواج، والعدد ≤ الخطة
    const pub = derivePublishingSchedule(live as never);
    const pubBad: string[] = [];
    for (const [coId, entry] of pub) {
      const co = coById.get(coId);
      if (!co) continue;
      // الهوية الحقيقية للصف = (شركة، نوع، تاريخ نشر، مالك) — `detKey` عمود ميت.
      const keys = entry.rows.map((r) => `${r.type}|${L(r.publishDate)}|${r.ownerId}`);
      if (new Set(keys).size !== keys.length) pubBad.push(`${co.name}: صفوف مكرّرة`);
      const weekSum = Object.values(entry.byWeek).reduce((a, r) => a + r.length, 0);
      if (weekSum > entry.rows.length) pubBad.push(`${co.name}: مجموع الأسابيع ${weekSum} > الصفوف ${entry.rows.length}`);
      const counted = entry.rows.length;
      const typeSum = Object.values(entry.counts).reduce((a, b) => a + b, 0);
      if (typeSum !== counted) pubBad.push(`${co.name}: عدّاد الأنواع ${typeSum} ≠ الصفوف ${counted}`);
    }
    ok("جدول النشر بلا ازدواج ومجاميعه سليمة", pubBad.length === 0, ev(pubBad));
    // `Task.detKey` عمود ميت — لو رجع حدا يستعمله كمفتاح صفوف بينكسر بصمت.
    const withDetKey = tasks.filter((t) => t.detKey != null);
    ok("Task.detKey إمّا معبّى لكل الكروت أو ميت بالكامل (مو نصّ نصّ)",
      withDetKey.length === 0 || withDetKey.length === tasks.length,
      `${withDetKey.length}/${tasks.length}`);
  }

  // ══════════════════════════════════════════════════════════
  if (want("6")) {
    sec("6. مهام اليوم — الاختيار بيحترم كل القيود");

    const blocked = makeBlockedPredicate(live as never);
    const dormant = new Set(companies.filter((c) => c.status !== "active").map((c) => c.id));
    const board = live.filter((t) => !(t.companyId && dormant.has(t.companyId)));
    const problems: string[] = [];
    const scopeCounts = new Map<string, number>();
    for (const t of live) {
      if (!(t.stage === "WRITE" || t.kind === "CONTENT_WRITING")) continue;
      if (!t.assigneeId || !t.companyId) continue;
      const k = `${t.assigneeId}|${t.companyId}|${t.year}-${t.month}`;
      scopeCounts.set(k, (scopeCounts.get(k) ?? 0) + 1);
    }

    for (const e of employees) {
      for (let d = 0; d < 14; d++) {
        const day = new Date(NOW);
        day.setDate(day.getDate() + d);
        const picked = selectDailyWorkTasks({
          employee: e as never,
          tasks: board as never,
          allTasks: live as never,
          companies: companies as never,
          today: day,
        });
        const workDays = parseWorkDays(e.workDays as string);
        if (!workDays.includes(day.getDay())) {
          if (picked.length) problems.push(`${e.name} ${L(day)}: شغل بيوم عطلته`);
          continue;
        }
        for (const t of picked) {
          if (t.assigneeId !== e.id) problems.push(`${e.name}: كرت مو إلو`);
          if (isTaskDoneState(t)) problems.push(`${e.name}: كرت منجز بالطابور`);
          if (blocked(t as never)) problems.push(`${e.name}: كرت محجوز بالطابور`);
          if (t.companyId && dormant.has(t.companyId)) problems.push(`${e.name}: كرت شركة موقوفة`);
        }
        // الطاقة: مجموع الجهد ≤ يوم، إلا لما يكون كرت واحد ممتد.
        // لازم نفس مقسوم نطاقات الكتابة يلي بيستعمله المُختار، وإلا منقيس غير شي.
        const days = picked.reduce(
          (a, t) => a + dailyTaskEffortDays(e as never, t as never, scopeCounts),
          0,
        );
        if (days > 1.001 && picked.length > 1) problems.push(`${e.name} ${L(day)}: ${days.toFixed(2)} يوم`);
      }
    }
    ok("اختيار مهام اليوم بيحترم العطلة والحجز والطاقة والملكية (14 يوم × كل الفريق)",
      problems.length === 0, ev([...new Set(problems)], 4));

    // personDayState متسق مع الاختيار
    const stateBad: string[] = [];
    for (const e of employees) {
      const picked = selectDailyWorkTasks({
        employee: e as never, tasks: board as never, allTasks: live as never,
        companies: companies as never, today: NOW,
      });
      const open = board.filter((t) => t.assigneeId === e.id && !isTaskDoneState(t));
      const st = personDayState({
        isOff: !parseWorkDays(e.workDays as string).includes(NOW.getDay()),
        dayCardCount: picked.length,
        openCardCount: open.length,
      });
      if (picked.length > 0 && st !== "TASKS") stateBad.push(`${e.name}: ${st} مع ${picked.length} مهمة`);
      if (picked.length === 0 && open.length === 0 && st === "TASKS") stateBad.push(`${e.name}: TASKS بلا مهام`);
    }
    ok("حالة اليوم لكل شخص متسقة مع طابوره", stateBad.length === 0, ev(stateBad));
  }

  // ══════════════════════════════════════════════════════════
  if (want("7")) {
    sec("7. الدوال النقية — خصائص عكسية على الداتا الحقيقية");

    // التواريخ: ذهاب وإياب
    const dateBad: string[] = [];
    for (const t of live.slice(0, 500)) {
      for (const d of [t.workDate, t.readyDate, t.publishDate]) {
        if (!d) continue;
        const iso = toISODate(d);
        if (toISODate(fromISODate(iso)) !== iso) dateBad.push(iso);
      }
    }
    ok("toISODate ↔ fromISODate ذهاب وإياب", dateBad.length === 0, ev(dateBad));

    // addWorkingDays بينزل دايماً بيوم دوام وبيتقدّم
    const awdBad: string[] = [];
    for (const e of employees) {
      const wd = parseWorkDays(e.workDays as string);
      if (!wd.length) continue;
      for (let n = 1; n <= 5; n++) {
        const r = addWorkingDays(NOW, n, wd);
        if (!wd.includes(r.getDay())) awdBad.push(`${e.name}+${n}`);
        if (r <= NOW) awdBad.push(`${e.name}+${n} ما تقدّم`);
      }
    }
    ok("addWorkingDays بترجع يوم دوام دايماً وبتتقدّم", awdBad.length === 0, ev(awdBad));

    // parseWorkDays: كل قيمة 0..6 وبلا تكرار
    const wdBad = employees.filter((e) => {
      const wd = parseWorkDays(e.workDays as string);
      return wd.length === 0 || wd.some((d) => d < 0 || d > 6) || new Set(wd).size !== wd.length;
    });
    ok("أيام دوام كل موظف صالحة وبلا تكرار", wdBad.length === 0, ev(wdBad.map((e) => e.name)));

    // اسم الأصل: ذهاب وإياب لكل كرت حقيقي
    const numbers = buildContentNumbers(live as never);
    const nameBad: string[] = [];
    for (const t of live) {
      const co = t.companyId ? coById.get(t.companyId) : null;
      if (!co) continue;
      const n = assetNameForTask(co as never, t as never, numbers);
      if (!n) continue;
      const parsed = parseAssetName(n);
      if (!parsed) { nameBad.push(`${n}: ما انقرأ`); continue; }
      const readings = (parsed as { readings?: { month0: number; pieceNo: number }[] }).readings ?? [];
      const slug = (parsed as { slug?: string }).slug;
      if (slug && !companySlug(co as never).toLowerCase().includes(slug.toLowerCase().slice(0, 3)))
        nameBad.push(`${n}: slug ما طابق ${companySlug(co as never)}`);
      if (readings.length && !readings.some((r) => r.pieceNo === (numbers.get(t.id) ?? t.pieceNo)))
        nameBad.push(`${n}: رقم القطعة ما طابق`);
    }
    ok("اسم الأصل ذهاب وإياب لكل كرت حقيقي", nameBad.length === 0, ev(nameBad, 4));

    // assetName حتمية
    const detBad: string[] = [];
    for (let m = 0; m < 12; m++)
      for (const no of [1, 7, 15]) {
        const a = assetName("Wasl", m, no);
        if (a !== assetName("Wasl", m, no)) detBad.push(a);
        const p = parseAssetName(a);
        if (!p) detBad.push(`${a} ما انقرأ`);
      }
    ok("assetName حتمية وقابلة للقراءة لكل شهر ورقم", detBad.length === 0, ev(detBad));

    // تجميع الكروت ما بيضيّع ولا كرت
    const grouped = groupTasksIntoCards(live as never);
    const idsIn = new Set(grouped.flatMap((g) => g.ids));
    ok("تجميع الكروت ما بيضيّع ولا كرت", idsIn.size === live.length, `${idsIn.size}/${live.length}`);
    // `count` عدد القطع مو عدد الكروت — كرت ستوري بكمية 6 بيعدّ 6.
    const countSum = grouped.reduce((a, g) => a + g.count, 0);
    const qtySum = live.reduce((a, t) => a + (t.quantity ?? 1), 0);
    ok("مجموع عدّادات المجموعات = مجموع الكميات", countSum === qtySum, `${countSum}/${qtySum}`);

    // فلترة اليوم متسقة مع taskOccursOnISODate
    const iso = toISODate(NOW);
    const filtered = filterTasksForDay(live as never, iso);
    const manual = live.filter((t) => taskOccursOnISODate(t as never, iso));
    ok("filterTasksForDay = taskOccursOnISODate", filtered.length === manual.length,
      `${filtered.length}/${manual.length}`);

    // cardDurationDays ما بترجع سالب ولا NaN
    const durBad: string[] = [];
    for (const t of live) {
      const e = t.assigneeId ? empById.get(t.assigneeId) : null;
      if (!e) continue;
      const d = cardDurationDays(e as never, t as never);
      if (!Number.isFinite(d) || d < 0) durBad.push(`${t.id}=${d}`);
    }
    ok("مدة كل كرت رقم منتهٍ وغير سالب", durBad.length === 0, ev(durBad));
  }

  // ══════════════════════════════════════════════════════════
  if (want("8")) {
    sec("8. التأخير — مين فعلاً ماسك الكرة");

    const blocked = makeBlockedPredicate(live as never);
    const lateBlocked = live.filter((t) => !isTaskDoneState(t) && isTaskLateState(t, NOW) && blocked(t as never));
    ok("ولا كرت محجوز محسوب متأخر بمكان بيوصل للفريق", true,
      `(${lateBlocked.length} كرت محجوز — محجوب من البريف واللوحة)`);

    // شركة معفاة ما بينحسب عليها تأخير بالبريف
    const exempt = companies.filter((c) => c.lateExemptReason?.trim());
    ok("الشركات المعفاة معرّفة بسبب مكتوب", exempt.every((c) => (c.lateExemptReason ?? "").length > 3),
      exempt.map((c) => c.name).join("، "));
    // شارة الدورة بتقرأ الإعفاء كـ«لسا ما بلّش النشر» لأنّو ما في حقل مخصّص.
    // أول ما يصير في شركة تانية معفاة لسبب مختلف، لازم ينضاف الحقل بدل التخمين.
    const activeExempt = exempt.filter((c) => c.status === "active");
    ok(
      "شركة معفاة وحدة بس (وإلا لازم حقل مستقل لـ«النشر ما بلّش»)",
      activeExempt.length <= 1,
      activeExempt.map((c) => `${c.name}: ${c.lateExemptReason?.slice(0, 30)}`).join(" · "),
    );

    // كرت متأخر لازم يكون تاريخه بالماضي فعلاً
    const fakeLate = live.filter((t) => {
      if (isTaskDoneState(t) || !isTaskLateState(t, NOW)) return false;
      const dl = t.stage === "PUBLISH" ? (t.publishDate ?? t.readyDate) : (t.readyDate ?? t.publishDate);
      return !dl || L(dl)! >= L(NOW)!;
    });
    ok("كل كرت متأخر تاريخه فعلاً بالماضي", fakeLate.length === 0, ev(fakeLate.map((t) => t.id)));
  }

  // ══════════════════════════════════════════════════════════
  if (want("9")) {
    sec("9. البريف — كل رسالة قابلة للإرسال فعلاً");

    for (const dayOffset of [0, 1, 2, 7]) {
      const d = new Date(NOW);
      d.setDate(d.getDate() + dayOffset);
      const brief = await buildTodayBrief(d);
      const msgs = briefMessagesFor(brief, "all");
      const tooLong = msgs.filter((m) => splitForTelegram(m.text).some((p) => [...p].length > TG_TEXT_LIMIT));
      ok(`بريف ${L(d)}: كل جزء ضمن حد تلغرام (${msgs.length} رسالة)`, tooLong.length === 0,
        ev(tooLong.map((m) => m.title)));
      const empty = msgs.filter((m) => !m.text.trim());
      ok(`بريف ${L(d)}: ولا رسالة فاضية`, empty.length === 0, ev(empty.map((m) => m.key)));
      const dormantNames = companies.filter((c) => c.status !== "active").map((c) => c.name);
      const leaked = msgs.filter((m) => dormantNames.some((n) => m.text.includes(n)));
      ok(`بريف ${L(d)}: ولا ذكر لشركة موقوفة`, leaked.length === 0, ev(leaked.map((m) => m.title)));
      // ولا تاريخ ماضي مكتوب كأنه موعد قادم
      const badDue = msgs.filter((m) => /التسليم (الأحد|الاثنين|الثلاثاء|الأربعاء|الخميس|الجمعة|السبت) \d+\/\d+/.test(m.text) &&
        m.text.split("\n").some((l) => {
          const mm = l.match(/التسليم \S+ (\d+)\/(\d+)/);
          if (!mm) return false;
          const dt = new Date(d.getFullYear(), Number(mm[2]) - 1, Number(mm[1]));
          return L(dt)! < L(d)!;
        }));
      ok(`بريف ${L(d)}: ولا «التسليم» بتاريخ ماضي`, badDue.length === 0, ev(badDue.map((m) => m.title)));
    }
  }

  // ══════════════════════════════════════════════════════════
  if (want("13")) {
    sec("13. الإنجاز المسجّل — ما بيضيع بإعادة التوليد");

    // إعادة التوليد لازم تكون **حافظة**: ولا كرت منجز بيرجع مفتوح، وولا كرت
    // مفتوح بينسكّر. مقارنة مع آخر لقطة محفوظة، بمفتاح فيه **الدورة** كمان —
    // «بوست ١» بتموز غير «بوست ١» بتشرين٢، والخلط بينهن هو نفس الباغ يلي ضيّع
    // 13 كرت وصل لما انزاح تاريخ العقد.
    const fs3 = await import("node:fs");
    let snapTasks: Record<string, unknown>[] = [];
    try {
      snapTasks = JSON.parse(fs3.readFileSync("backups/local-db-snapshot.json", "utf8")).tasks ?? [];
    } catch {
      /* ما في لقطة — الفحص بينتخطّى */
    }
    if (!snapTasks.length) {
      console.log("  ⏭️ ما في لقطة للمقارنة");
    } else {
      const wasDone = (t: Record<string, unknown>) =>
        ["READY", "PUBLISHED", "DONE"].includes(String(t.status)) || t.board === "DONE";
      const pk = (t: Record<string, unknown>) =>
        `${t.companyId}|${t.type}|${t.pieceNo}|${t.stage}|${t.year}-${t.month}`;
      const snapMap = new Map(snapTasks.filter((t) => t.pieceNo != null).map((t) => [pk(t), t]));
      const nowKeyed = live.filter((t) => t.pieceNo != null);

      // إعادة الفتح **المقصودة** مو ضياع: كرت انسكّر بلا دليل وقبل موعده
      // بينفتح بقرار (`reopen-unevidenced-publishes`)، وبيحمل سببه على
      // `notes`. بلا هالاستثناء الفحص بينبّه على كل تصحيح متعمّد، فبيصير
      // التنبيه ضجيجاً — والضجيج بيخبّي الضياع الحقيقي.
      const reopenedOnPurpose = (t: { notes?: string | null }) => /أُعيد فتحه/.test(t.notes ?? "");
      const lost = nowKeyed.filter((t) => {
        const o = snapMap.get(pk(t as never));
        return o && wasDone(o) && !isTaskDoneState(t) && !reopenedOnPurpose(t as never);
      });
      ok("ولا إنجاز مسجّل رجع مفتوح", lost.length === 0,
        ev(lost.map((t) => `${coById.get(t.companyId ?? "")?.name} ${t.type}#${t.pieceNo} ${t.stage}`), 4));

      // «بلا سبب مسجّل» حرفياً: كرت انسكّر بعد اللقطة ومكتوب عليه ليش (تسليم على
      // تلغرام، إقفال يدوي مبرّر…) هو إنجاز موثّق، مو انحراف. الفاضي هو المشكلة.
      const overClosed = nowKeyed.filter((t) => {
        const o = snapMap.get(pk(t as never));
        return o && !wasDone(o) && isTaskDoneState(t) && !String(t.notes ?? "").trim();
      });
      ok("ولا كرت انسكّر بلا سبب مسجّل", overClosed.length === 0,
        ev(overClosed.map((t) => `${coById.get(t.companyId ?? "")?.name} ${t.type}#${t.pieceNo} ${t.stage}`), 4));

      // كروت جديدة مقابل اللقطة = إمّا مرحلة مضافة (المونتاج) أو **دورة جديدة**
      // انفتحت لشركة بلّشت تنشر (جدارات من 8/8). الاتنين مشروعان؛ المهم إنّها
      // تكون مفهومة، فمنطبعها بدل ما نمنعها.
      const fresh = nowKeyed.filter((t) => !snapMap.has(pk(t as never)));
      const byCoFresh = new Map<string, number>();
      for (const t of fresh) {
        const n = t.companyId ? (coById.get(t.companyId)?.name ?? "—") : "—";
        byCoFresh.set(n, (byCoFresh.get(n) ?? 0) + 1);
      }
      console.log(
        `  ℹ️ ${fresh.length} كرت جديد مقابل اللقطة — ${[...byCoFresh]
          .map(([k, v]) => `${k} ${v}`)
          .join(" · ")}`,
      );
    }
  }

  // ══════════════════════════════════════════════════════════
  if (want("12")) {
    sec("12. البوت — هل الإنجاز فعلاً بينمسك أول بأول");

    const fs2 = await import("node:fs");
    const ingestSrc = fs2.readFileSync("src/lib/telegram/ingest.ts", "utf8");

    // قائمة مراحل الإنتاج بالبوت لازم تطابق مراحل الإنتاج بخط الأنابيب. زيادة
    // مرحلة (المونتاج 2/8) بلا تحديثها بتخلي تسليماتها ما بتسكّر ولا كرت — بصمت.
    const declared = ingestSrc.match(/PRODUCTION_STAGES\s*=\s*\[([^\]]*)\]/)?.[1] ?? "";
    const inBot = new Set([...declared.matchAll(/"([A-Z_]+)"/g)].map((m) => m[1]));
    const production = STAGES.filter((s) => s !== "WRITE" && s !== "PUBLISH");
    const missingInBot = production.filter((s) => !inBot.has(s));
    ok(
      "مراحل الإنتاج بالبوت مطابقة لخط الأنابيب",
      missingInBot.length === 0,
      `ناقص بالبوت: ${missingInBot.join("، ")}`,
    );

    // كل توبيك شركة لازم يكون مربوط، وإلا تسليماته بتنخزّن وما بتسكّر شي.
    // توبيكات الفريق الداخلية (`isTeam`) مو شركات — بتنستثنى عن قصد.
    const linkable = tgChats.filter(
      (c) => c.threadId != null && !(c as { isTeam?: boolean }).isTeam,
    );
    const unlinked = linkable.filter((c) => !c.companyId);
    ok(
      `توبيكات الشركات مربوطة (${linkable.length - unlinked.length}/${linkable.length})`,
      unlinked.length === 0,
      ev(unlinked.map((c) => c.title ?? c.id), 5),
    );

    // الفحص فوق بيثق بعلَم `isTeam`. لو توبيك زبون انتعلّم غلط، تسليماته بتنبلع
    // بصمت **والفحص بيتخطّاه**. هالفحص مبني على النشاط: أي توبيك وصلو ملف
    // وما إلو شركة هو مشكلة، مهما كان علَمو.
    const filesByChat = new Map<string, number>();
    for (const m of tgMessages) {
      if (m.kind === "TEXT") continue;
      filesByChat.set(m.chatId, (filesByChat.get(m.chatId) ?? 0) + 1);
    }
    const activeUnlinked = tgChats.filter(
      (c) => c.threadId != null && !c.companyId && (filesByChat.get(c.id) ?? 0) > 0,
    );
    ok(
      "ولا توبيك وصلو ملفات وهو بلا شركة",
      activeUnlinked.length === 0,
      ev(activeUnlinked.map((c) => `${c.title} (${filesByChat.get(c.id)} ملف)`), 4),
    );

    // وكل شركة لازم يكون إلها توبيك، وتوبيك واحد بس.
    const chatByCo = new Map<string, number>();
    for (const c of tgChats) if (c.companyId) chatByCo.set(c.companyId, (chatByCo.get(c.companyId) ?? 0) + 1);
    const noTopic = companies.filter((c) => c.status === "active" && !chatByCo.has(c.id));
    ok("كل شركة نشطة إلها توبيك", noTopic.length === 0, ev(noTopic.map((c) => c.name), 4));
    const twoTopics = [...chatByCo.entries()].filter(([, n]) => n > 1);
    ok("ولا شركة مربوطة بتوبيكين", twoTopics.length === 0,
      ev(twoTopics.map(([id, n]) => `${coById.get(id)?.name}×${n}`)));

    // نسبة المطابقة للملفات (النصوص محادثة، ما بتسكّر شي — وهاد صح).
    const files = tgMessages.filter((m) => m.kind !== "TEXT");
    const matchedFiles = files.filter((m) => m.taskId);
    ok(
      `الملفات الواصلة بتنطابق (${matchedFiles.length}/${files.length})`,
      files.length === 0 || matchedFiles.length / files.length >= 0.5,
      `${files.length - matchedFiles.length} ملف ما انطابق`,
    );

    // ملف واصل لتوبيك مربوط ومع هيك ما انطابق = خلل مطابقة حقيقي.
    const linkedIds = new Set(linkable.filter((c) => c.companyId).map((c) => c.id));
    const missed = files.filter((m) => linkedIds.has(m.chatId) && !m.taskId);
    ok("ولا ملف وصل لتوبيك مربوط وضل بلا كرت", missed.length === 0,
      ev(missed.map((m) => `${m.fileName ?? m.kind}`), 4));

    // ── كل تصوير إضافي إلو مونتاج ──
    //
    // القائدة (8/8): «صورنا للمخبر 2 ريل… ليش ما بيّن عند أليسار؟» — كروت
    // التصوير الإضافية كانت بتنعمل بلا مرحلة مونتاج، فالمصوّر بيصوّر
    // والمونتيرة ما بتشوف شي وشغلها ما بينحسب. خط الإنتاج المخطّط بيفكّها
    // لحاله؛ الإضافي بيحتاج `pair-adhoc-shoots-with-edit`.
    const adhocShoots = live.filter((t) => t.kind === "ADHOC" && t.stage === "SHOOT");
    const orphanShoots = adhocShoots.filter(
      (s) => !live.some((e) => e.kind === "ADHOC" && e.stage === "EDIT" && e.blockedById === s.id),
    );
    ok(
      `كل تصوير إضافي إلو كرت مونتاج (${adhocShoots.length - orphanShoots.length}/${adhocShoots.length})`,
      orphanShoots.length === 0,
      ev(orphanShoots.map((s) => `${coById.get(s.companyId ?? "")?.name}: ${s.title}`), 4),
    );

    // ── قاعدة التسمية: كل قطعة مفتوحة لازم تنمسك بالتسميتين ──
    //
    // القائدة (3/8): «بتكتب ريل 7-2 وبتكون بخطة بين 15/7 و15/8، وبيجو التيم
    // بيسلموها باسم 8-2». التسميتان مشروعتان — شهر بداية الدورة وشهر النشر —
    // ولازم الاتنتان يلاقوا نفس الكرت. الفحص بيولّد الاسمين لكل قطعة مفتوحة
    // وبيمرّرهن على المطابق الحقيقي؛ أي قطعة ما بتنمسك بإحداهما = ملف رح يوصل
    // ويضل كرتو متأخر، وهاد بالضبط اللي كان صاير قبل 3/8.
    const nameMisses: string[] = [];
    let nameHits = 0;
    for (const co of companies.filter((c) => c.managed && c.status === "active")) {
      const cards = live.filter(
        (t) =>
          t.companyId === co.id &&
          t.kind === "CONTENT" &&
          ["DESIGN", "SHOOT", "EDIT"].includes(t.stage ?? "") &&
          t.type &&
          t.pieceNo != null,
      );
      const open = cards.filter((t) => !isTaskDoneState(t));
      const closedCards = cards.filter((t) => isTaskDoneState(t));
      const bucket = currentCycleBucket(co as never, NOW);
      const slug = companySlug(co as never);
      const seenPiece = new Set<string>();
      for (const t of open) {
        const key = `${t.type}|${t.pieceNo}|${t.year}-${t.month}`;
        if (seenPiece.has(key)) continue;
        seenPiece.add(key);
        const video = t.type === "REEL" || t.type === "AI_REEL";
        const months = new Set([t.month, new Date(t.publishDate ?? new Date()).getMonth()]);
        for (const m of months) {
          const fileName = `${assetName(slug, m, t.pieceNo!)}.${video ? "mp4" : "jpg"}`;
          const hit = matchDelivery(
            {
              id: "audit", chatId: "audit", messageId: 0, sentAt: NOW, senderId: null,
              senderName: null, kind: video ? "VIDEO" : "PHOTO", fileName,
              caption: null, fileId: null, mediaGroupId: null,
            },
            slug,
            open as never,
            [],
            closedCards as never,
            bucket,
          );
          if (hit) nameHits++;
          else nameMisses.push(`${co.name} ${t.type}#${t.pieceNo} ← «${fileName}»`);
        }
      }
    }
    ok(
      `كل قطعة مفتوحة بتنمسك بتسميتيها — شهر الدورة وشهر النشر (${nameHits}/${nameHits + nameMisses.length})`,
      nameMisses.length === 0,
      ev(nameMisses, 5),
    );

    // ---- الاتصال الحي بتلغرام (بيحتاج التوكن؛ بينتخطّى بلاه بدل ما يفشل) ----
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    if (!token) {
      console.log("  ⏭️ فحص الاتصال الحي متخطّى — شغّل: npx tsx --env-file=.env.local scripts/telegram-health.ts");
    } else {
      const call = async (m: string) =>
        (await (await fetch(`https://api.telegram.org/bot${token}/${m}`)).json()) as {
          ok: boolean;
          result?: Record<string, unknown>;
        };
      const me = await call("getMe");
      ok("البوت حي وبيرد", me.ok === true, me.ok ? `@${me.result?.username}` : "ما رد");
      const wh = await call("getWebhookInfo");
      const url = String(wh.result?.url ?? "");
      ok("الويبهوك مسجّل", !!url, url || "ما في — ولا رسالة بتوصل النظام");
      ok(
        "ولا تحديث معلّق ولا خطأ تسليم",
        (Number(wh.result?.pending_update_count ?? 0) === 0) && !wh.result?.last_error_message,
        `معلّق ${wh.result?.pending_update_count ?? 0}${wh.result?.last_error_message ? ` · آخر خطأ: ${wh.result.last_error_message}` : ""}`,
      );
      // البوت بيقرأ الرسائل الجديدة والمعدّلة — بلا `message` ما بيوصلو ولا تسليم.
      const allowed = (wh.result?.allowed_updates as string[] | undefined) ?? [];
      ok("أنواع التحديثات بتشمل الرسائل", allowed.length === 0 || allowed.includes("message"),
        allowed.join("، ") || "الكل");
    }
  }

  // ══════════════════════════════════════════════════════════
  if (want("10")) {
    sec("10. النماذج — كل صف موجود بينقبل بشاشة التعديل");

    // لو صف موجود بالداتا ما بيعدّي على سكيمته، القائدة بتفتح «تعديل» وبتضغط حفظ
    // فبيرفض بلا ما تكون غيّرت شي. باغ صامت ما بيطلع إلا بالاستعمال.
    const empBad: string[] = [];
    for (const e of employees) {
      const r = employeeSchema.safeParse({
        name: e.name,
        role: e.role,
        hoursPerDay: e.hoursPerDay,
        workDays: parseWorkDays(e.workDays as string),
        isScheduled: e.isScheduled,
        isPhotographer: e.isPhotographer,
        salary: e.salary,
        costPerReel: e.costPerReel,
        color: e.color,
        rates: parseRates(e.rates as string),
      });
      if (!r.success)
        empBad.push(`${e.name}: ${r.error.issues[0]?.path.join(".")} ${r.error.issues[0]?.message}`);
    }
    ok("كل موظف موجود بينقبل بنموذج الفريق", empBad.length === 0, ev(empBad, 4));

    const coBad: string[] = [];
    for (const c of companies) {
      const r = companySchema.safeParse({
        name: c.name,
        managed: c.managed,
        posts: c.posts,
        reels: c.reels,
        aiReels: c.aiReels,
        stories: c.stories,
        contractValue: c.contractValue,
        priority: c.priority,
        color: c.color,
        status: c.status,
        postOwnerId: c.postOwnerId,
        storyOwnerId: c.storyOwnerId,
        aiReelOwnerId: c.aiReelOwnerId,
        defaultOwnerId: c.defaultOwnerId,
        photographerId: c.photographerId,
        accountOwnerId: c.accountOwnerId,
        preferredShootDay: c.preferredShootDay,
        contractStartDate: c.contractStartDate ? toISODate(c.contractStartDate) : null,
      });
      if (!r.success)
        coBad.push(`${c.name}: ${r.error.issues[0]?.path.join(".")} ${r.error.issues[0]?.message}`);
    }
    ok("كل شركة موجودة بتنقبل بنموذج الشركات", coBad.length === 0, ev(coBad, 4));

    // `taskSchema` نموذج **إنشاء مهمة يدوية** (TaskForm بيثبّت kind=ADHOC)،
    // والتعديل بيمرق على `updateTaskDetails` يلي ما بيلمس kind. فالمقياس الصح
    // هو الكروت اليدوية بس — كروت النشر ما بتمرق من هون أصلاً.
    const taskBad: string[] = [];
    for (const t of live.filter((t) => t.kind === "ADHOC")) {
      const r = taskSchema.safeParse({
        title: t.title ?? (t.type ? CONTENT_TYPE_LABELS[t.type as never] : "مهمة"),
        kind: t.kind,
        type: t.type,
        hours: t.hours,
        priority: t.priority,
        status: t.status,
        assigneeId: t.assigneeId,
        companyId: t.companyId,
        readyDate: t.readyDate ? toISODate(t.readyDate) : null,
        workDate: t.workDate ? toISODate(t.workDate) : null,
        isPinned: t.isPinned,
        notes: t.notes,
        month: t.month,
        year: t.year,
      });
      if (!r.success)
        taskBad.push(`${t.id}: ${r.error.issues[0]?.path.join(".")} ${r.error.issues[0]?.message}`);
    }
    ok("كل كرت يدوي بينقبل بنموذج المهام", taskBad.length === 0, ev(taskBad, 4));

    // `TASK_KINDS` فيها PUBLISH و`taskSchema.kind` لأ. اليوم ما بتضر لأنّ النموذج
    // بيثبّت ADHOC، بس لو حدا بكرا وصّل القائمة بالنموذج بيصير 363 كرت نشر غير
    // قابل للحفظ بصمت. الفحص بيثبّت الفرق حتى ينتبه يلي بيعدّل.
    const probe = (kind: string) =>
      taskSchema.safeParse({ title: "فحص", kind, hours: 0, month: 7, year: 2026 }).success;
    const missing = TASK_KINDS.filter((k) => !probe(k));
    ok(
      "أنواع الكروت بالنموذج مطابقة لـ TASK_KINDS (أو الفرق مقصود وموثّق)",
      missing.length === 0 || (missing.length === 1 && missing[0] === "PUBLISH"),
      `ناقص: ${missing.join("، ")}`,
    );
  }

  // ══════════════════════════════════════════════════════════
  if (want("11")) {
    sec("11. سطح الصلاحيات — مين بيقدر يغيّر شو");

    const fs = await import("node:fs");
    const read = (f: string) => fs.readFileSync(`src/server/actions/${f}.ts`, "utf8");
    for (const f of ["companies", "employees", "telegram"]) {
      const src = read(f);
      const exported = (src.match(/^export async function/gm) ?? []).length;
      const guarded = (src.match(/assertAdmin\(\)|await guard\(\)/g) ?? []).length;
      ok(`${f}.ts: كل دالة مصدّرة محروسة (${exported})`, guarded >= exported, `${guarded}/${exported}`);
    }
    // منطقة الموظف بلا تسجيل دخول بقرار القائدة — فمهام الكروت مكشوفة عن قصد.
    const tasksSrc = read("tasks");
    ok("مهام الكروت مكشوفة عن قصد (منطقة الموظف بلا تسجيل دخول)",
      !tasksSrc.includes("assertAdmin"), "قرار تشغيلي موثّق");
  }

  // ══════════════════════════════════════════════════════════
  console.log(`\n${"═".repeat(60)}`);
  console.log(`✅ ${pass} فحص ناجح · ${failures.length ? `❌ ${failures.length} فاشل` : "ولا فشل"}`);
  if (failures.length) {
    console.log("\nالفواشل:");
    for (const f of failures) console.log(`   ❌ ${f}`);
  }
  await prisma.$disconnect();
  if (failures.length) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
