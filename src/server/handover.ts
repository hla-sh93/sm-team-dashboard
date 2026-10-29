/**
 * «تسليم الشغل» بالمحرّك — مين استلم شغل مين (قرار القائدة ١٢/١٠، D4).
 *
 * الأداة بتنقل الكروت وحقول المسؤولين بالشركات، بس المحرّك بيختار الكاتبة والمونتيرة
 * والناشر **بالدور** (أول موظف دوره بيطابق)، والمصوّر الاحتياطي أول مصوّر — فإعادة
 * الجدولة كانت ترجّع كروتاً للي غادر (مراجعة ١٢/١٠: ٤ من ١٥ مونتاج رجعوا لأليسار).
 * الحلّ بلا حقل جديد: التسليم بينحفظ بـ`Setting` (`employeeHandover:<المغادر>`)، والمحرّك
 * بيبدّل كل مسؤول مولَّد بخلفه. المنجز بيضل باسم يلي عمله (حفظ الحالة).
 *
 * بلا `"use server"` عن قصد: بيناديه المحرّك وأفعال الأدمن، مو المتصفّح.
 */
import { prisma } from "@/lib/db";
import { fromISODate } from "@/lib/dates";
import { withEvidenceLine } from "@/lib/evidence";
import { teamTodayISO } from "@/lib/team-day";

const PREFIX = "employeeHandover:";

export async function recordHandover(fromId: string, toId: string, fromDate: string): Promise<void> {
  const key = `${PREFIX}${fromId}`;
  const value = JSON.stringify({ toId, fromDate });
  await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

export type HandoverRecord = { fromId: string; toId: string; fromDate: string | null };

/** كل التسليمات المسجّلة بتاريخها — لشارة «سلّم شغله لـ…» بصفحة الفريق (المرحلة C). */
export async function loadHandovers(): Promise<HandoverRecord[]> {
  const rows = await prisma.setting.findMany({ where: { key: { startsWith: PREFIX } } });
  const out: HandoverRecord[] = [];
  for (const row of rows) {
    try {
      const v = JSON.parse(row.value) as { toId?: unknown; fromDate?: unknown };
      if (typeof v.toId === "string" && v.toId) {
        out.push({ fromId: row.key.slice(PREFIX.length), toId: v.toId, fromDate: typeof v.fromDate === "string" ? v.fromDate : null });
      }
    } catch {
      /* صفّ تالف = ما في تسليم */
    }
  }
  return out;
}

/** المغادر ← خلفه، من كل التسليمات المسجّلة. */
export async function loadSuccessors(): Promise<Map<string, string>> {
  const rows = await prisma.setting.findMany({ where: { key: { startsWith: PREFIX } } });
  const out = new Map<string, string>();
  for (const row of rows) {
    try {
      const v = JSON.parse(row.value) as { toId?: unknown };
      if (typeof v.toId === "string" && v.toId) out.set(row.key.slice(PREFIX.length), v.toId);
    } catch {
      /* صفّ تالف = ما في تسليم */
    }
  }
  return out;
}

/** خلف الموظف الأخير بالسلسلة (ماجد ← ليلاس ← …)، بحارس للحلقات. */
export function successorOf(successors: Map<string, string>, id: string | null): string | null {
  let cur = id;
  const seen = new Set<string>();
  while (cur && successors.has(cur) && !seen.has(cur)) {
    seen.add(cur);
    cur = successors.get(cur)!;
  }
  return cur;
}

// ─────────────────────────────── التسليم نفسه (مشترك بين «سلّم هلّق» وكرون التسليم المجدول)

const OWNER_FIELDS = ["photographerId", "postOwnerId", "storyOwnerId", "aiReelOwnerId", "defaultOwnerId", "accountOwnerId"] as const;

export type HandoverPlan = NonNullable<Awaited<ReturnType<typeof handoverPlan>>>;

/** شو رح ينتقل: المفتوح كلّه، والمنجز من التاريخ، وحقول المسؤولين بالشركات غير المؤرشفة. */
export async function handoverPlan(fromId: string, toId: string, fromDate: string) {
  const [from, to] = await Promise.all([
    prisma.employee.findUnique({ where: { id: fromId } }),
    prisma.employee.findUnique({ where: { id: toId } }),
  ]);
  if (!from || !to) return null;
  const since = fromISODate(fromDate);
  const open = await prisma.task.findMany({
    where: { assigneeId: fromId, status: { notIn: ["CANCELED", "READY", "PUBLISHED"] }, board: { not: "DONE" } },
    select: { id: true, notes: true },
  });
  const doneSince = await prisma.task.findMany({
    where: {
      assigneeId: fromId,
      OR: [{ status: { in: ["READY", "PUBLISHED"] } }, { board: "DONE" }],
      AND: [{ OR: [{ finishedAt: { gte: since } }, { AND: [{ finishedAt: null }, { completedAt: { gte: since } }] }] }],
    },
    select: { id: true, notes: true },
  });
  const companies = (await prisma.company.findMany()).filter((c) => c.status !== "archived");
  const companyUpdates = companies
    .map((c) => ({ id: c.id, data: Object.fromEntries(OWNER_FIELDS.filter((f) => c[f] === fromId).map((f) => [f, toId])) }))
    .filter((u) => Object.keys(u.data).length > 0);
  const total = open.length + doneSince.length + companyUpdates.length;
  return {
    from,
    to,
    fromDate,
    open,
    doneSince,
    companyUpdates,
    summary: { openCards: open.length, doneSince: doneSince.length, companies: companyUpdates.length, total },
  };
}

export async function executeHandover(plan: HandoverPlan): Promise<void> {
  const line = `انتقل من ${plan.from.name} لـ${plan.to.name} (تسليم الشغل من ${plan.fromDate})`;
  await prisma.$transaction([
    ...[...plan.open, ...plan.doneSince].map((t) =>
      prisma.task.update({ where: { id: t.id }, data: { assigneeId: plan.to.id, notes: withEvidenceLine(t.notes, line) } }),
    ),
    ...plan.companyUpdates.map((u) => prisma.company.update({ where: { id: u.id }, data: u.data })),
    prisma.employee.update({ where: { id: plan.from.id }, data: { isScheduled: false } }),
  ]);
  // المحرّك بيختار الكاتبة/المونتيرة/الناشر بالدور — الخلف بيورث الدور كمان.
  await recordHandover(plan.from.id, plan.to.id, plan.fromDate);
}

// ─────────────────────────────── التسليم المجدول — «عقدها بينتهي ١/١١» (المرحلة C، ٢٩/١٠)

const PLANNED_PREFIX = "employeeHandoverPlanned:";
export type PlannedHandover = { fromId: string; toId: string; fromDate: string };

export async function planHandover(fromId: string, toId: string, fromDate: string): Promise<void> {
  const key = `${PLANNED_PREFIX}${fromId}`;
  const value = JSON.stringify({ toId, fromDate });
  await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

export async function cancelPlannedHandover(fromId: string): Promise<void> {
  await prisma.setting.deleteMany({ where: { key: `${PLANNED_PREFIX}${fromId}` } });
}

export async function loadPlannedHandovers(): Promise<PlannedHandover[]> {
  const rows = await prisma.setting.findMany({ where: { key: { startsWith: PLANNED_PREFIX } } });
  const out: PlannedHandover[] = [];
  for (const row of rows) {
    try {
      const v = JSON.parse(row.value) as { toId?: unknown; fromDate?: unknown };
      if (typeof v.toId === "string" && typeof v.fromDate === "string") {
        out.push({ fromId: row.key.slice(PLANNED_PREFIX.length), toId: v.toId, fromDate: v.fromDate });
      }
    } catch {
      /* صفّ تالف */
    }
  }
  return out;
}

/**
 * بينفّذ التسليمات المجدولة يلي إجا يومها — من كرون الصبح. نفس `executeHandover` حرفياً.
 * التسليم المنفَّذ بينشال من المجدول؛ الفاشل بيضل (بيرجع يتجرّب بكرا) وبيطلع بالنتيجة.
 */
export async function applyDueHandovers(todayISO: string = teamTodayISO()) {
  const applied: (PlannedHandover & { total: number })[] = [];
  const failed: (PlannedHandover & { error: string })[] = [];
  for (const p of await loadPlannedHandovers()) {
    if (p.fromDate > todayISO) continue;
    try {
      const plan = await handoverPlan(p.fromId, p.toId, p.fromDate);
      if (!plan) throw new Error("موظف غير موجود");
      await executeHandover(plan);
      await cancelPlannedHandover(p.fromId);
      applied.push({ ...p, total: plan.summary.total });
    } catch (e) {
      failed.push({ ...p, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { applied, failed };
}
