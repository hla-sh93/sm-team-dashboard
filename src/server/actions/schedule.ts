"use server";

import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/auth";
import { buildSchedule } from "@/lib/scheduler";
import { expandPipeline, type PipelineTask } from "@/lib/pipeline";
import { applyPipelinePreservation } from "@/lib/pipeline-preservation";
import {
  retimeEditsAfterActualShoot,
  snapPipelineWorkDatesToAssigneeWorkDays,
} from "@/lib/schedule-retime";
import { isTrainerSuppliedContentCompany } from "@/lib/content-source";
import { loadState } from "@/lib/schedule-data";
import {
  backWorkday,
  formatDateShort,
  forwardWorkday,
  parseWorkDays,
} from "@/lib/dates";
import { cycleForBucket } from "@/lib/contract";
import { revalidatePath } from "next/cache";

function revalidateAll() {
  revalidatePath("/", "layout");
}

const D = (s: string | null): Date | null => {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

// Reported reality (per company|type), in PIECE order by publish date. Applied
// in this precedence, then the rest stay TODO (pending production):
//   published → published to the client (production DONE + publish card DONE),
//   ready     → designed AND approved, waiting to be published (production DONE,
//               publish card stays TODO → it sits in the publishing queue),
//   review    → produced, awaiting approval (design/shoot in REVIEW),
//   doing     → in progress, e.g. a reel shot but not yet delivered (DOING).
type JuneState = { published?: number; ready?: number; review?: number; doing?: number };

// BOOTSTRAP DEFAULTS ONLY — the live source of truth is the Setting table
// (key `achievements:{year}-{month0}`, JSON of the same shape). These built-in
// maps are persisted to Setting on first use and never read again, so future
// months are onboarded by adding a Setting row — no code change, no redeploy.
//
// June carry-over reality (2026-06). برو: 1 reel + 1 post still to produce;
// المول: 2 published + 3 designed-ready posts, 1 reel filmed-not-delivered
// (Albert); المخبر: 3 reels filmed-not-delivered (غسان+مايك). جدارات is handled
// as a TODAY-anchored cycle (JULY_2026) so it is never late.
const JUNE_2026: Record<string, JuneState> = {
  "c_phoenitech|POST": { published: 4 }, // فوني تيك — منتهٍ بالكامل
  "c_phoenitech|REEL": { published: 4 }, // كل الريلات منشورة (لا متبقّي)
  "c_training|POST": { published: 7 }, // التدريب — منجز
  "c_noor|POST": { published: 6 }, // المخبر — كل البوستات منشورة
  "c_noor|REEL": { published: 3, doing: 3 }, // 3 منشورة · 3 مصوّرة لم تُسلَّم (غسان+مايك)
  "c_bw|POST": { published: 4 }, // BW — منتهٍ بالكامل
  "c_bw|REEL": { published: 4 }, // كل الريلات منشورة (لا متبقّي)
  "c_mall|POST": { published: 2, ready: 3 }, // 2 منشور · 3 مصمّمة جاهزة للنشر (أيمن)
  "c_mall|STORY": { published: 2 }, // 2 ستوري منشور
  "c_mall|REEL": { published: 2, doing: 1 }, // 2 منشورة · 1 مصوّرة لم تُسلَّم (ألبير)
  "c_pro|POST": { published: 2 }, // برو — 2 منشور · 1 متبقٍّ للإنتاج
  "c_pro|STORY": { published: 6 }, // كل الستوريز منجزة
  "c_pro|REEL": { published: 7 }, // 7 منشورة · 1 متبقٍّ لم يُصوَّر بعد
};

// جدارات — scheduling starts TODAY (its contractStartDate is set to today), so
// it lives in the July cycle and is never late. Posts are designed+approved
// (ready to publish from today); 3 AI reels are still under review.
const JULY_2026: Record<string, JuneState> = {
  "c_jadarat|POST": { ready: 6 }, // كل البوستات مصمّمة ومعتمدة (سابين) — جاهزة للنشر
  "c_jadarat|AI_REEL": { review: 3 }, // 3 ريلات AI قيد المراجعة
};

/**
 * Reported reality for a month, read from the Setting table
 * (`achievements:{year}-{month0}` → JSON Record<"companyId|TYPE", JuneState>).
 * The 2026 built-in maps above are persisted there on first use (bootstrap),
 * so from then on the DB row is the only source — edit it to onboard a month.
 */
async function achievementsFor(year: number, month: number): Promise<Record<string, JuneState>> {
  const key = `achievements:${year}-${month}`;
  try {
    const row = await prisma.setting.findUnique({ where: { key } });
    if (row?.value) return JSON.parse(row.value) as Record<string, JuneState>;
  } catch {
    // fall through to bootstrap — a broken row must not block scheduling
  }
  const builtin =
    year === 2026 && month === 5 ? JUNE_2026 : year === 2026 && month === 6 ? JULY_2026 : null;
  if (builtin) {
    try {
      await prisma.setting.upsert({
        where: { key },
        update: {}, // never overwrite an existing row — DB wins
        create: { key, value: JSON.stringify(builtin) },
      });
    } catch {
      /* best effort */
    }
    return builtin;
  }
  return {};
}

/**
 * Stamp reported reality onto the pipeline: for each (company,type), the first
 * `published` pieces become DONE (and their PUBLISH card PUBLISHED), the next
 * `review` go to REVIEW (awaiting approval), the next `doing` go to DOING
 * (in progress). Writer cards stay independent and must be completed explicitly.
 */
function applyAchievements(pipe: PipelineTask[], state: Record<string, JuneState>) {
  const publishByKey = new Map<string, PipelineTask>();
  for (const c of pipe) {
    if (c.stage === "PUBLISH" && c.pipelineKey) publishByKey.set(c.pipelineKey, c);
  }
  const groups = new Map<string, PipelineTask[]>();
  for (const c of pipe) {
    if (c.stage === "DESIGN" || c.stage === "SHOOT") {
      const k = `${c.companyId}|${c.type}`;
      const arr = groups.get(k) ?? [];
      arr.push(c);
      groups.set(k, arr);
    }
  }
  for (const [k, arr] of groups) {
    const st = state[k];
    if (!st) continue;
    arr.sort(
      (a, b) =>
        (a.publishDate ?? "").localeCompare(b.publishDate ?? "") || a.id.localeCompare(b.id),
    );
    let i = 0;
    for (let n = st.published ?? 0; n > 0 && i < arr.length; n--, i++) {
      const c = arr[i];
      c.board = "DONE";
      c.status = "READY";
      const p = publishByKey.get(c.pipelineKey ?? "");
      if (p) {
        p.board = "DONE";
        p.status = "PUBLISHED";
      }
    }
    // ready = designed + approved, waiting to publish: the production card is
    // DONE, but the PUBLISH card stays TODO so the piece sits in the publishing
    // queue (ready to schedule) instead of being marked already published.
    for (let n = st.ready ?? 0; n > 0 && i < arr.length; n--, i++) {
      const c = arr[i];
      c.board = "DONE";
      c.status = "READY";
      // publish card left as generated (TODO / NOT_STARTED) → ready to publish.
    }
    for (let n = st.review ?? 0; n > 0 && i < arr.length; n--, i++) {
      arr[i].board = "REVIEW";
      arr[i].status = "AWAITING_APPROVAL";
    }
    for (let n = st.doing ?? 0; n > 0 && i < arr.length; n--, i++) {
      arr[i].board = "DOING";
      arr[i].status = "IN_PROGRESS";
    }
  }

  // Nawal writes each company's plan UP FRONT, before any design/shoot. So once
  // a scope's production has STARTED (any post/story/reel of that scope is
  // designed / shot / in-review / published), her WRITE card for that scope is
  // clearly done — it must not linger as "late" while its own content is already
  // being produced or is live. (For a fresh month with no achievements, nothing
  // is produced yet, so writes correctly stay pending.)
  const isPastWriting = (c: PipelineTask) =>
    c.board === "DONE" || c.board === "REVIEW" || c.board === "DOING";
  for (const w of pipe) {
    if (w.stage !== "WRITE" || !w.pipelineKey) continue;
    const [coId, scope] = w.pipelineKey.split("|");
    const scopePieces = pipe.filter(
      (c) =>
        (c.stage === "DESIGN" || c.stage === "SHOOT") &&
        c.companyId === coId &&
        (scope === "SHOOT" ? c.type === "REEL" : c.type !== "REEL"),
    );
    if (scopePieces.length > 0 && scopePieces.some(isPastWriting)) {
      w.board = "DONE";
      w.status = "READY";
    }
  }
}

/**
 * Auto-generate the month's full pipeline (كتابة → تصميم/تصوير → نشر) from the
 * companies' plans, apply reported achievements, and PRESERVE any manual board
 * moves from a previous run (matched by pipelineKey+stage). Ad-hoc tasks are
 * kept; only their computed workDate/overflow are written back. Re-run anytime
 * after adding/editing tasks, companies or plans — it reschedules everyone.
 */
async function generateScheduleInternal(
  year: number,
  month: number,
  onlyCompanyId: string | null,
) {
  try {
    const state = await loadState(year, month);

    // الشركة يلي المحرّك بيخطّط إلها فعلاً — نفس شرط `scheduler.ts` حرفياً.
    // أي شركة برّا هالشرط ما بينولّد إلها ولا كرت، فحذف كروتها بلا ما ينبني
    // بديل = محو صامت.
    const isPlanned = (c: { managed: boolean; status?: string | null }) =>
      c.managed && (c.status ?? "active") === "active";

    // التوليد المحصور على شركة وحدة بيستبدل نطاق الحذف بـ«هالشركة» — فبيسقط
    // معه استثناء الشركات الراكدة تحت. ولو مرقت شركة راكدة من هون: الحذف
    // بيصير والتوليد بيرجع فاضي، فبتضيع كروتها كلها. هاد يلي صار مع Siizen
    // (٢٦ كرت) قبل، والمول الصيني اليوم مؤرشفة وعندها ٥٨ كرت وعندها تجديدات
    // فبتوصل لنفس المسار. الحارس هون مو شرط لازم حدا يتذكّره بكل نقطة نداء —
    // هو رفض عند المصدر، وبيفشل بصوت بدل ما يمحي بصمت.
    if (onlyCompanyId) {
      const target = state.companies.find((c) => c.id === onlyCompanyId);
      if (!target)
        return { ok: false as const, error: "الشركة غير موجودة في هذه الدورة" };
      if (!isPlanned(target))
        return {
          ok: false as const,
          error:
            "الشركة موقوفة أو مؤرشفة أو غير مُدارة — المحرّك ما بيولّد إلها كروت، " +
            "وإعادة بناء دورتها لحالها بتمحي كروتها بلا بديل. فعّليها أولاً.",
        };
    }

    const result = buildSchedule(state);

    const writerId = state.employees.find((e) => /كات|writer/i.test(e.role))?.id ?? null;
    const writerWorkDays = parseWorkDays(
      state.employees.find((e) => e.id === writerId)?.workDays as string | number[]
    );
    const publisherId =
      state.employees.find((e) => /ناشر|نشر|publisher/i.test(e.role))?.id ?? null;
    const publisherWorkDays = parseWorkDays(
      state.employees.find((e) => e.id === publisherId)?.workDays as string | number[]
    );
    // المونتيرة — كل ريل بينتصوّر بيمرق عليها قبل النشر (قاعدة القائدة 2/8/2026).
    const editorId =
      state.employees.find((e) => /مونتير|مونتاج|editor/i.test(e.role))?.id ?? null;
    const editorWorkDays = parseWorkDays(
      state.employees.find((e) => e.id === editorId)?.workDays as string | number[]
    );
    const coName = (id: string) => state.companies.find((c) => c.id === id)?.name ?? "";
    const trainerSuppliedContent = (id: string) =>
      isTrainerSuppliedContentCompany(state.companies.find((c) => c.id === id));
    // Contract-cycle label for the writer's plan card (e.g. "دورة 20 حزيران – 19
    // تموز"). end is exclusive, so the last shown day is end − 1.
    const cycleLabel = (id: string) => {
      const co = state.companies.find((c) => c.id === id);
      if (!co) return null;
      const cyc = cycleForBucket(co, year, month);
      if (!cyc) return null; // no cycle here (awaiting renewal) → no writer card
      const { start, end } = cyc;
      const last = new Date(end);
      last.setDate(last.getDate() - 1);
      return `دورة ${formatDateShort(start)} – ${formatDateShort(last)}`;
    };
    // Writing never starts before the company's contract start date.
    const notBeforeISO = (id: string) => {
      const cs = state.companies.find((c) => c.id === id)?.contractStartDate;
      if (!cs) return null;
      const d = new Date(cs);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate(),
      ).padStart(2, "0")}`;
    };
    const iso = (d: Date | null) =>
      d
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
        : null;

    const items = result.tasks
      .filter((t) => t.kind === "CONTENT" && t.companyId && t.type)
      .map((t) => ({
        id: t.detKey,
        companyId: t.companyId!,
        type: t.type as "POST" | "REEL" | "AI_REEL" | "STORY",
        assigneeId: t.assigneeId,
        publishDate: iso(t.publishDate),
        readyDate: iso(t.readyDate),
        workDate: iso(t.workDate),
        week: t.week,
        status: t.status,
      }));

    const pipe = expandPipeline(items, {
      writerId,
      publisherId,
      editorId,
      editorWorkDays,
      year,
      month,
      companyName: coName,
      cycleLabel,
      writerWorkDays,
      idPrefix: `${year}_${month}_`, // namespace ids per month (avoid PK clashes)
      skipWritingForCompany: trainerSuppliedContent,
      notBeforeISO,
      publisherWorkDays,
    });
    applyAchievements(pipe, await achievementsFor(year, month));

    // Preserve manual edits from a prior run (matched by pipelineKey+stage).
    // Board/status are always kept; for cards the user PINNED (manual edit via
    // the card's تعديل) we also keep their title / dates / owner / priority so
    // hitting إعادة الجدولة never throws the edit away.
    const existing = await prisma.task.findMany({
      where: {
        isAuto: true,
        year,
        month,
        ...(onlyCompanyId ? { companyId: onlyCompanyId } : {}),
      },
      select: {
        pipelineKey: true,
        stage: true,
        board: true,
        status: true,
        isPinned: true,
        title: true,
        workDate: true,
        readyDate: true,
        manualDay: true,
        assigneeId: true,
        priority: true,
        quantity: true,
        companyId: true,
        type: true,
        publishDate: true,
        kind: true,
        startedAt: true,
        finishedAt: true,
        completedAt: true,
        // Imported once a month from the client's plan and not re-derivable —
        // dropping it here is what turned honest matching back into guessing.
        brief: true,
        // ودليل الإقفال معه — «سُلّم على تلغرام: …» ما بينستنتج بالتوليد.
        notes: true,
        // Piece identity — survives a re-timing that moves every date.
        pieceNo: true,
      },
    });
    applyPipelinePreservation(pipe, existing);
    // المونتاج بيتبع **التصوير الفعلي** مو المخطط: ريل مجدول تصويره 1/6 وانتصوّر
    // 5/7 كان كرت مونتاجه بيطلع مستحق 2/6 — متأخر شهر قبل ما تنوجد المادة أصلاً.
    // بعد ما رجّعت خطوة الحفظ `finishedAt` على كرت التصوير، منعيد تأريخ المونتاج
    // لليوم التالي للتصوير الحقيقي.
    retimeEditsAfterActualShoot(pipe, editorWorkDays);
    snapPipelineWorkDatesToAssigneeWorkDays(pipe, state.employees);

    // Photo-session statuses (تم التصوير/المونتاج/التسليم) must survive the
    // replace below too — matched by detKey, falling back to (company, kind,
    // session no.) when a regenerated shoot date shifted the detKey.
    const existingSessions = await prisma.photoSession.findMany({
      where: {
        isAuto: true,
        year,
        month,
        ...(onlyCompanyId ? { companyId: onlyCompanyId } : {}),
      },
      select: { detKey: true, companyId: true, kind: true, no: true, status: true },
    });
    const sessionStatusByDet = new Map<string, string>();
    const sessionStatusByPos = new Map<string, string>();
    for (const s of existingSessions) {
      if (s.status === "NOT_STARTED") continue;
      if (s.detKey) sessionStatusByDet.set(s.detKey, s.status);
      const pos = `${s.companyId}|${s.kind}|${s.no}`;
      if (!sessionStatusByPos.has(pos)) sessionStatusByPos.set(pos, s.status);
    }

    const adhocTasks = onlyCompanyId
      ? []
      : result.tasks.filter((t) => t.kind === "ADHOC");

    // A dormant company (paused / archived) is NOT planned by the engine, so a
    // blanket delete wipes its cards and nothing regenerates them: Siizen's 26
    // filled-in cards vanished on an unrelated regeneration, plan text and all.
    // Its work is deliberately parked, not cancelled — leave it alone.
    // نفس المقياس تبع المحرّك: كان الاستثناء بيفحص الحالة وبس، والمحرّك بيفحص
    // الحالة **والإدارة** — فشركة نشطة بس غير مُدارة كانت تنحذف كروتها بلا بديل.
    // اليوم كابرياني والمدارس بلا كروت مولّدة فما ظهر الأثر، بس الثغرة مفتوحة.
    const dormantIds = state.companies.filter((c) => !isPlanned(c)).map((c) => c.id);
    const replaceScope = onlyCompanyId
      ? { isAuto: true, year, month, companyId: onlyCompanyId }
      : {
          isAuto: true,
          year,
          month,
          ...(dormantIds.length ? { NOT: { companyId: { in: dormantIds } } } : {}),
        };
    const pipeToWrite = onlyCompanyId
      ? pipe.filter((task) => task.companyId === onlyCompanyId)
      : pipe;
    const sessionsToWrite = onlyCompanyId
      ? result.sessions.filter((session) => session.companyId === onlyCompanyId)
      : result.sessions;

    await prisma.$transaction(async (tx) => {
      // Replace generated cards + auto sessions (keep ad-hoc, isAuto=false).
      await tx.task.deleteMany({ where: replaceScope });
      await tx.photoSession.deleteMany({ where: replaceScope });

      const now = new Date();
      await tx.task.createMany({
        data: pipeToWrite.map((t) => {
          // Preserved work history (or a sensible first-time stamp): started
          // when the card ever left TODO, finished/completed only when DONE.
          const done = t.board === "DONE";
          const finishedAt = done ? (t.finishedAt ?? t.completedAt ?? now) : null;
          const startedAt =
            t.startedAt ?? (t.board !== "TODO" ? (finishedAt ?? now) : null);
          return {
            id: t.id,
            kind: t.kind,
            stage: t.stage,
            board: t.board,
            type: t.type,
            title: t.title,
            companyId: t.companyId,
            assigneeId: t.assigneeId,
            hours: 0,
            quantity: t.quantity,
            pieceNo: t.pieceNo ?? null,
            priority: t.priority,
            status: t.status,
            publishDate: D(t.publishDate),
            readyDate: D(t.readyDate),
            workDate: D(t.workDate),
            manualDay: D(t.manualDay ?? null),
            week: t.week,
            blockedById: t.blockedById,
            pipelineKey: t.pipelineKey,
            overflow: false,
            isAuto: true,
            isPinned: t.isPinned ?? false,
            brief: t.brief ?? null,
            notes: t.notes ?? null,
            startedAt,
            finishedAt,
            completedAt: done ? (t.completedAt ?? finishedAt) : null,
            month,
            year,
          };
        }),
      });

      if (sessionsToWrite.length > 0) {
        await tx.photoSession.createMany({
          data: sessionsToWrite.map((s) => ({
            no: s.no,
            kind: s.kind,
            shootDate: s.shootDate,
            deliverBy: s.deliverBy,
            reelCount: s.reelCount,
            status:
              sessionStatusByDet.get(s.detKey) ??
              sessionStatusByPos.get(`${s.companyId}|${s.kind}|${s.no}`) ??
              s.status,
            month: s.month,
            year: s.year,
            isAuto: true,
            detKey: s.detKey,
            companyId: s.companyId,
          })),
        });
      }

    }, {
      // The atomic replace above is only a few queries (deleteMany + createMany),
      // but give it generous head-room so a slow connection (e.g. Neon) can't trip
      // Prisma's default 5s interactive-transaction limit → "Transaction not found".
      maxWait: 15000,
      timeout: 30000,
    });

    // Stamp ad-hoc tasks' computed workDate/overflow AFTER the transaction. These
    // are independent best-effort updates (ad-hoc rows are isAuto=false, untouched
    // by the replace); keeping the per-row loop OUT of the interactive transaction
    // is what prevents it from timing out when there are many of them.
    for (const a of adhocTasks) {
      if (!a.sourceId) continue;
      await prisma.task.update({
        where: { id: a.sourceId },
        data: { workDate: a.workDate, overflow: a.overflow },
      });
    }

    revalidateAll();
    const stages = {
      write: pipeToWrite.filter((p) => p.stage === "WRITE").length,
      design: pipeToWrite.filter((p) => p.stage === "DESIGN").length,
      shoot: pipeToWrite.filter((p) => p.stage === "SHOOT").length,
      publish: pipeToWrite.filter((p) => p.stage === "PUBLISH").length,
    };
    return { ok: true as const, stages, warnings: result.warnings };
  } catch (e) {
    console.error(e);
    const detail = e instanceof Error ? e.message : String(e);
    return { ok: false as const, error: `فشل توليد الجدول — ${detail}` };
  }
}

/** Rebuild one company's cards inside a month bucket without rewriting any
 * other company's generated rows. The full schedule is still calculated first,
 * so shared workload/capacity decisions stay identical to a normal regeneration;
 * only the persistence scope is narrowed. */
export async function generateCompanySchedule(companyId: string, year: number, month: number) {
  try {
    await assertAdmin();
  } catch {
    return { ok: false as const, error: "غير مصرّح" };
  }
  return generateScheduleInternal(year, month, companyId);
}

export async function generateSchedule(year: number, month: number) {
  return generateScheduleInternal(year, month, null);
}

// retimeEditsAfterActualShoot و snapPipelineWorkDatesToAssigneeWorkDays انتقلوا
// لـ`@/lib/schedule-retime` (تدقيق 11/8): هالملف "use server" فما بيصدّر غير
// async — والقاعدة الجديدة «الكرت المنجز موعده تاريخ مو خطة» لازمها اختبارات
// وحدة مباشرة.
// NOTE: clearMonthSchedule was removed (2026-07-08 audit): it had no UI caller
// but remained a publicly callable server action that wiped a month's generated
// schedule. Regeneration via generateSchedule covers every legitimate use.
