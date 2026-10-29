"use server";

/**
 * زرّ «تعبئة الأيام» — للإدارة بس (خطة التحسينات D، ٢٩/١٠). بيكتب يوم البداية المتوقّع
 * (`forecastQueues` — نفس طابور «مهام اليوم» يوماً بيوم) على كروت الخطة المفتوحة، فاللوح
 * والتقويم بيحكوا اليوم يلي رح ينشغل فيه الكرت فعلاً.
 *
 * بيكتب `workDate` بس (والتثبيت حتى إعادة التوليد ما ترجّعه): **التسليم والنشر ما بيتحرّكوا**،
 * فما في كرت بيصير متأخر بسبب الزرّ. ما بيلمس: التصوير (موعد زبون)، «بدّل»، المهام الإضافية
 * (يوم بدايتها قرار)، النشر، والكروت يلي ما رح تلحق تسليمها — هيدي بتنعرض «اختناق» لقرار
 * المسؤولة (إعادة جدولة المتأخر أو تسليم لحدا تاني).
 */
import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/auth";
import { revalidateSafely } from "@/lib/revalidate";
import { teamTodayISO } from "@/lib/team-day";
import { loadLiveTasks } from "@/lib/live-tasks";
import { loadBlockerChain } from "@/lib/late";
import { forecastQueues, type ForecastEntry } from "@/lib/queue-forecast";
import { buildReelNumbers, cardLabelFor } from "@/lib/cards";
import { isTaskDoneState } from "@/lib/constants";
import { publicCompanySelect, publicEmployeeSelect } from "@/server/public-rows";
import type { PublicCompany, PublicEmployee, Task } from "@/types";

export type FillMove = ForecastEntry & { label: string; person: string };
export type FillPreview =
  | {
      ok: true;
      fromISO: string;
      moves: FillMove[];
      /** ما بتلحق تسليمها — ما بتنكتب. */
      bottlenecks: FillMove[];
      /** حمل كل شخص بكل يوم بالتوقّع (٠–١). */
      days: { person: string; dayISO: string; load: number }[];
      fingerprint: string;
    }
  | { ok: false; error: string };

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const HORIZON = 21;
const PRODUCTION = new Set(["DESIGN", "EDIT", "WRITE"]);

async function guard(): Promise<string | null> {
  try {
    await assertAdmin();
    return null;
  } catch {
    return "غير مصرّح";
  }
}

/** كرت خطة إنتاج مفتوح بلا قرار يوم — الوحيد يلي الزرّ بيكتب عليه. */
const movable = (t: Task) =>
  t.isAuto &&
  !isTaskDoneState(t) &&
  t.status !== "CANCELED" &&
  !t.manualDay &&
  (PRODUCTION.has(t.stage ?? "") || t.kind === "CONTENT_WRITING");

function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

async function compute(fromISO: string) {
  const [y, m] = fromISO.split("-").map(Number);
  const next = m === 12 ? { y: y + 1, m: 0 } : { y, m };
  const [cur, nxt, employees, companies] = await Promise.all([
    loadLiveTasks(y, m - 1),
    loadLiveTasks(next.y, next.m),
    prisma.employee.findMany({ select: publicEmployeeSelect, orderBy: { createdAt: "asc" } }),
    prisma.company.findMany({ select: publicCompanySelect, orderBy: { priority: "asc" } }),
  ]);
  const byId = new Map<string, Task>();
  for (const t of [...cur, ...nxt] as unknown as Task[]) byId.set(t.id, t);
  const chain = (await loadBlockerChain([...byId.values()], (ids) =>
    prisma.task.findMany({ where: { id: { in: ids } } }) as unknown as Promise<Task[]>,
  )) as Task[];
  for (const t of chain) if (!byId.has(t.id)) byId.set(t.id, t);
  const tasks = [...byId.values()];
  const people = (employees as unknown as PublicEmployee[]).filter((e) => e.isScheduled || tasks.some((t) => t.assigneeId === e.id && !isTaskDoneState(t)));
  const forecast = forecastQueues({
    tasks,
    employees: people,
    companies: companies as unknown as PublicCompany[],
    fromISO,
    horizonDays: HORIZON,
  });
  const reelNum = buildReelNumbers(tasks);
  const coName = (id: string | null) => companies.find((c) => c.id === id)?.name ?? "";
  const personName = (id: string) => employees.find((e) => e.id === id)?.name ?? "—";
  const decorate = (e: ForecastEntry): FillMove => ({
    ...e,
    label: cardLabelFor(byId.get(e.taskId)!, 1, reelNum, coName),
    person: personName(e.assigneeId),
  });
  const candidates = forecast.entries.filter((e) => movable(byId.get(e.taskId)!));
  const moves = candidates.filter((e) => !e.late && e.startISO !== e.fromISO).map(decorate);
  const bottlenecks = forecast.entries.filter((e) => e.late).map(decorate);
  const fingerprint = fnv(
    moves.map((mv) => `${mv.taskId}:${mv.startISO}:${byId.get(mv.taskId)!.updatedAt?.toString()}`).join("|"),
  );
  return {
    moves,
    bottlenecks,
    days: forecast.days.map((d) => ({ person: personName(d.personId), dayISO: d.dayISO, load: d.load })),
    fingerprint,
    byId,
  };
}

export async function previewFillDays(fromISO?: string): Promise<FillPreview> {
  const denied = await guard();
  if (denied) return { ok: false, error: denied };
  const from = (fromISO ?? "").trim() || teamTodayISO();
  if (!ISO.test(from)) return { ok: false, error: "تاريخ البداية غير صالح" };
  if (from < teamTodayISO()) return { ok: false, error: "البداية ما بتكون قبل اليوم" };
  const { moves, bottlenecks, days, fingerprint } = await compute(from);
  return { ok: true, fromISO: from, moves, bottlenecks, days, fingerprint };
}

const dbDate = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

export async function applyFillDays(
  fromISO: string,
  fingerprint: string,
): Promise<{ ok: true; moved: number } | { ok: false; error: string }> {
  const denied = await guard();
  if (denied) return { ok: false, error: denied };
  if (!ISO.test(fromISO ?? "") || fromISO < teamTodayISO()) return { ok: false, error: "تاريخ البداية غير صالح" };
  const { moves, fingerprint: now, byId } = await compute(fromISO);
  if (now !== fingerprint) return { ok: false, error: "الداتا تغيّرت بعد المعاينة — أعيدي المعاينة قبل التطبيق" };
  if (!moves.length) return { ok: true, moved: 0 };
  try {
    await prisma.$transaction(
      async (tx) => {
        for (const mv of moves) {
          const t = byId.get(mv.taskId)!;
          // بلا سطر بالملاحظات عن قصد: يوم البداية خطة مو دليل إقفال، والملاحظة بتخلّي الصفّ
          // «عليه شغل» (`pieceHasWorkOrBrief`) فبتوقّف إعادة التوليد لو الصفّ ما انطابق.
          const r = await tx.task.updateMany({
            where: { id: t.id, updatedAt: t.updatedAt },
            data: { workDate: dbDate(mv.startISO), isPinned: true },
          });
          if (r.count !== 1) throw new Error("STALE");
        }
      },
      { timeout: 60_000 },
    );
  } catch (e) {
    if (e instanceof Error && e.message === "STALE") return { ok: false, error: "كرت تعدّل بنفس اللحظة — ما انكتب شي، أعيدي المعاينة" };
    console.error("[fill-days] apply failed", e);
    return { ok: false, error: "فشل التطبيق — ما انكتب شي" };
  }
  revalidateSafely("/", "layout");
  return { ok: true, moved: moves.length };
}
