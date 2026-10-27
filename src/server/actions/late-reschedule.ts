"use server";

import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/auth";
import { revalidateSafely } from "@/lib/revalidate";
import { dayKeyOf, teamTodayISO } from "@/lib/team-day";
import { planLateReschedule, type ReschedulePlan } from "@/lib/late-reschedule";
import type { Task } from "@/types";

/**
 * زرّ «إعادة جدولة المتأخر» — للإدارة بس (القائدة ٢٧/١٠). معاينة أول، والتطبيق بيعيد
 * حساب نفس الخطة وبيرفض إذا تغيّرت الداتا بعد المعاينة (البصمة)، وكل كتابة مشروطة على
 * `updatedAt` يلي انقرا — تعديل من حدا تاني بالنص بيلغي التطبيق كلّه بلا نص كتابة.
 */

type Names = { companies: Record<string, string>; people: Record<string, string> };
export type LateReschedulePreview =
  | { ok: true; plan: ReschedulePlan; names: Names }
  | { ok: false; error: string };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

async function load(fromISO: string, companyIds: (string | null)[] | null) {
  const [tasks, employees, companies] = await Promise.all([
    prisma.task.findMany({ where: { status: { not: "CANCELED" } } }),
    prisma.employee.findMany({
      select: { id: true, name: true, role: true, rates: true, hoursPerDay: true, workDays: true },
    }),
    prisma.company.findMany(),
  ]);
  const plan = planLateReschedule({
    tasks: tasks as unknown as Task[],
    employees,
    companies: companies as never,
    fromISO,
    companyIds,
  });
  const names: Names = {
    companies: Object.fromEntries(companies.map((c) => [c.id, c.name])),
    people: Object.fromEntries(employees.map((e) => [e.id, e.name])),
  };
  return { plan, names, tasks };
}

async function guard(): Promise<string | null> {
  try {
    await assertAdmin();
    return null;
  } catch {
    return "غير مصرّح";
  }
}

function validFrom(fromISO: string | undefined): string | null {
  const from = (fromISO ?? "").trim() || teamTodayISO();
  return ISO.test(from) ? from : null;
}

export async function previewLateReschedule(
  fromISO?: string,
  companyIds?: (string | null)[] | null,
): Promise<LateReschedulePreview> {
  const denied = await guard();
  if (denied) return { ok: false, error: denied };
  const from = validFrom(fromISO);
  if (!from) return { ok: false, error: "تاريخ البداية غير صالح" };
  const { plan, names } = await load(from, companyIds ?? null);
  return { ok: true, plan, names };
}

const dbDate = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const label = (iso: string | null) => (iso ? iso.split("-").reverse().slice(0, 2).join("/") : "—");

export async function applyLateReschedule(
  fromISO: string,
  companyIds: (string | null)[] | null,
  fingerprint: string,
): Promise<{ ok: true; moved: number; synced: number } | { ok: false; error: string }> {
  const denied = await guard();
  if (denied) return { ok: false, error: denied };
  const from = validFrom(fromISO);
  if (!from) return { ok: false, error: "تاريخ البداية غير صالح" };
  const { plan, tasks } = await load(from, companyIds ?? null);
  if (plan.fingerprint !== fingerprint) {
    return { ok: false, error: "الداتا تغيّرت بعد المعاينة — أعيدي المعاينة قبل التطبيق" };
  }
  if (!plan.moves.length && !plan.syncs.length) return { ok: true, moved: 0, synced: 0 };
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const line = (m: ReschedulePlan["moves"][number]) => {
    const was = m.stage === "PUBLISH" ? m.from.publish : m.from.ready;
    const now = m.stage === "PUBLISH" ? m.to.publish : m.to.ready;
    return `إعادة جدولة المتأخر من ${label(from)} (الإدارة): ${label(was)} ← ${label(now)}`;
  };
  try {
    await prisma.$transaction(
      async (tx) => {
        for (const m of plan.moves) {
          const t = byId.get(m.taskId)!;
          const evidence = line(m);
          const kept = (t.notes ?? "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
          const notes = kept.includes(evidence) ? t.notes : [...kept, evidence].join("\n");
          const manual = t.manualDay ? dayKeyOf(t.manualDay) : null;
          const data: Record<string, unknown> = {
            isPinned: true,
            notes,
            ...(m.to.work ? { workDate: dbDate(m.to.work) } : {}),
            ...(m.to.ready ? { readyDate: dbDate(m.to.ready) } : {}),
            ...(m.to.publish ? { publishDate: dbDate(m.to.publish) } : {}),
            // «بدّل» قديم قبل اليوم الجديد ما عاد إلو معنى.
            ...(manual && m.to.work && manual < m.to.work ? { manualDay: null } : {}),
          };
          const r = await tx.task.updateMany({ where: { id: t.id, updatedAt: t.updatedAt }, data });
          if (r.count !== 1) throw new Error("STALE");
        }
        for (const s of plan.syncs) {
          const t = byId.get(s.taskId)!;
          const r = await tx.task.updateMany({
            where: { id: t.id, updatedAt: t.updatedAt },
            data: { publishDate: dbDate(s.publish) },
          });
          if (r.count !== 1) throw new Error("STALE");
        }
      },
      { timeout: 60_000 },
    );
  } catch (e) {
    if (e instanceof Error && e.message === "STALE") {
      return { ok: false, error: "كرت تعدّل بنفس اللحظة — ما انكتب شي، أعيدي المعاينة" };
    }
    console.error("[late-reschedule] apply failed", e);
    return { ok: false, error: "فشل التطبيق — ما انكتب شي" };
  }
  revalidateSafely("/", "layout");
  return { ok: true, moved: plan.moves.length, synced: plan.syncs.length };
}
