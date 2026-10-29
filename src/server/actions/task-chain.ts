"use server";

/**
 * «سلسلة مراحل» — مهمة إضافية بمراحل مربوطة (خطة التحسينات B، ٢٩/١٠). للإدارة بس: بتوزّع
 * شغل على أكتر من شخص بمرّة.
 *
 * المعاينة والإنشاء بيحسبوا بنفس الدالّة النقية (`planTaskChain`) على نفس الحمل، فالإنشاء
 * بيرفض إذا تغيّرت المواعيد بين المعاينة والتأكيد (`expected`) بدل ما يكتب شي ما انشاف.
 */
import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/auth";
import { revalidateAll } from "@/lib/revalidate";
import { fromISODate, parseWorkDays, utcMidnight } from "@/lib/dates";
import { dayKeyOf, teamTodayISO } from "@/lib/team-day";
import { dailyTaskEffortDays } from "@/lib/daily-work";
import { isTaskDoneState } from "@/lib/constants";
import { WORK_DAY_HOURS } from "@/lib/capacity";
import { extraAssetName } from "@/lib/asset-name";
import {
  CHAIN_STAGE_LABELS,
  buildLoadLedger,
  planTaskChain,
  type ChainStage,
  type ChainStepInput,
  type PlannedStep,
} from "@/lib/task-chain";
import { generateScheduleInternal, isLiveBucket } from "@/server/schedule-engine";
import type { Employee, Task } from "@/types";

export type TaskChainInput = {
  title: string;
  brief: string;
  companyId: string | null;
  priority: "NORMAL" | "IMPORTANT" | "URGENT";
  targetISO: string;
  steps: ChainStepInput[];
};

export type ChainPreviewStep = PlannedStep & { assigneeName: string; label: string };

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

const STAGES = new Set<ChainStage>(["WRITE", "DESIGN", "SHOOT", "EDIT", "PUBLISH"]);
const PRIORITIES = new Set(["NORMAL", "IMPORTANT", "URGENT"]);

async function guard(): Promise<string | null> {
  try {
    await assertAdmin();
    return null;
  } catch {
    return "غير مصرّح";
  }
}

function checkInput(input: TaskChainInput): string | null {
  if (!input || typeof input !== "object") return "بيانات غير صالحة";
  if (!input.title?.trim() || input.title.trim().length > 120) return "العنوان إجباري (لحدّ ١٢٠ حرف)";
  if (!input.brief?.trim()) return "الوصف إجباري — هو يلي بيشتغل عليه كل واحد بالسلسلة";
  if (!PRIORITIES.has(input.priority)) return "أولوية غير صالحة";
  if (!Array.isArray(input.steps) || input.steps.some((s) => !STAGES.has(s?.stage) || typeof s.assigneeId !== "string")) {
    return "مراحل غير صالحة";
  }
  return null;
}

async function computePlan(input: TaskChainInput) {
  const todayISO = teamTodayISO();
  const ids = [...new Set(input.steps.map((s) => s.assigneeId))];
  const employees = (await prisma.employee.findMany({ where: { id: { in: ids } } })) as unknown as Employee[];
  const empById = new Map(employees.map((e) => [e.id, e]));
  const open = (await prisma.task.findMany({
    where: {
      assigneeId: { in: ids },
      status: { notIn: ["CANCELED", "READY", "PUBLISHED"] },
      board: { not: "DONE" },
      OR: [{ readyDate: { gte: utcMidnight(fromISODate(todayISO)) } }, { workDate: { gte: utcMidnight(fromISODate(todayISO)) } }],
    },
  })) as unknown as Task[];
  const load = buildLoadLedger(
    open
      .filter((t) => !isTaskDoneState(t) && t.stage !== "PUBLISH" && t.kind !== "PUBLISH")
      .map((t) => ({
        task: t,
        assigneeId: t.assigneeId,
        workDate: t.workDate ? dayKeyOf(t.workDate) : null,
        readyDate: t.readyDate ? dayKeyOf(t.readyDate) : null,
      })),
    (id) => parseWorkDays(empById.get(id)?.workDays),
    (row) => {
      const e = row.assigneeId ? empById.get(row.assigneeId) : undefined;
      return e ? dailyTaskEffortDays(e, row.task) : 0;
    },
  );
  const plan = planTaskChain({
    steps: input.steps.map((s) => ({ ...s, days: Number(s.days) || 0 })),
    targetISO: input.targetISO,
    todayISO,
    people: employees.map((e) => ({ id: e.id, name: e.name, workDays: parseWorkDays(e.workDays) })),
    loadOf: load,
  });
  return { plan, empById };
}

const fingerprintOf = (steps: PlannedStep[]) =>
  steps.map((s) => `${s.stage}:${s.assigneeId}:${s.workISO}:${s.readyISO}:${s.publishISO ?? ""}:${s.urgent ? 1 : 0}`).join("|");

export async function previewTaskChain(
  input: TaskChainInput,
): Promise<Result<{ steps: ChainPreviewStep[]; warnings: string[]; fingerprint: string }>> {
  const denied = await guard();
  if (denied) return { ok: false, error: denied };
  const bad = checkInput(input);
  if (bad) return { ok: false, error: bad };
  const { plan, empById } = await computePlan(input);
  if (!plan.ok) return plan;
  return {
    ok: true,
    warnings: plan.warnings,
    fingerprint: fingerprintOf(plan.steps),
    steps: plan.steps.map((s) => ({
      ...s,
      assigneeName: empById.get(s.assigneeId)?.name ?? "—",
      label: CHAIN_STAGE_LABELS[s.stage],
    })),
  };
}

export async function createTaskChain(
  input: TaskChainInput,
  expected: string,
): Promise<Result<{ ids: string[]; fileNames: string[]; warning?: string }>> {
  const denied = await guard();
  if (denied) return { ok: false, error: denied };
  const bad = checkInput(input);
  if (bad) return { ok: false, error: bad };
  const { plan } = await computePlan(input);
  if (!plan.ok) return plan;
  if (fingerprintOf(plan.steps) !== expected) {
    return { ok: false, error: "المواعيد تغيّرت من وقت المعاينة (انضاف شغل لحدا) — اعرضي المعاينة من جديد" };
  }
  const company = input.companyId
    ? await prisma.company.findUnique({ where: { id: input.companyId }, select: { id: true, name: true, slug: true } })
    : null;
  if (input.companyId && !company) return { ok: false, error: "الشركة غير موجودة" };

  // الدلو = شهر الموعد (متل كروت الخطة: تصميم بوست تشرين التاني بدلو تشرين التاني ولو انعمل آخر تشرين الأول).
  const target = fromISODate(input.targetISO);
  const bucket = { year: target.getFullYear(), month: target.getMonth() };
  const pipelineKey = `chain_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const route = plan.steps.map((s) => CHAIN_STAGE_LABELS[s.stage]).join(" ← ");
  const note = `سلسلة «${route}» — أنشأتها الإدارة ${teamTodayISO()}`;
  const day = (iso: string | null) => (iso ? utcMidnight(fromISODate(iso)) : null);

  const ids = await prisma.$transaction(async (tx) => {
    const out: string[] = [];
    let prev: string | null = null;
    for (const s of plan.steps) {
      const card: { id: string } = await tx.task.create({
        data: {
          kind: "ADHOC",
          // الكتابة كرت إضافي عادي بلا مرحلة: مرحلة WRITE بتاخد مدّتها من معدّل الخطة مو من الساعات.
          stage: s.stage === "WRITE" ? null : s.stage,
          type: null,
          title: `${CHAIN_STAGE_LABELS[s.stage]}: ${input.title.trim()}`,
          hours: s.stage === "PUBLISH" ? 0.5 : Math.round(s.days * WORK_DAY_HOURS * 10) / 10,
          quantity: 1,
          priority: s.urgent ? "URGENT" : input.priority,
          status: "NOT_STARTED",
          board: "TODO",
          workDate: day(s.workISO),
          readyDate: day(s.readyISO),
          publishDate: day(s.publishISO),
          isPinned: true,
          isAuto: false,
          brief: input.brief.trim(),
          notes: note,
          companyId: company?.id ?? null,
          assigneeId: s.assigneeId,
          blockedById: prev,
          pipelineKey,
          month: bucket.month,
          year: bucket.year,
        },
        select: { id: true },
      });
      out.push(card.id);
      prev = card.id;
    }
    return out;
  });

  let warning: string | undefined;
  if (await isLiveBucket(bucket.year, bucket.month)) {
    const built = await generateScheduleInternal(bucket.year, bucket.month, null);
    if (!built.ok) warning = `انخلقت السلسلة، بس إعادة الجدولة ما مرقت: ${"error" in built ? built.error : "الدلو تغيّر"}`;
  }
  revalidateAll();
  return {
    ok: true,
    ids,
    fileNames: plan.steps.map((s, i) => (s.stage === "PUBLISH" ? "—" : extraAssetName(company, { id: ids[i] }))),
    ...(warning ? { warning } : {}),
  };
}
