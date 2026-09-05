"use server";

import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/auth";
import { employeeSchema, type EmployeeInput } from "@/lib/schemas";
import { revalidateAll } from "@/lib/revalidate";


/** Build the rates JSON (items/day). planDays → PLAN rate = 1/planDays. */
function buildRates(d: EmployeeInput): string | null {
  const r: Record<string, number> = {};
  const src = d.rates ?? {};
  for (const k of ["POST", "STORY", "AI_REEL", "REEL"] as const) {
    const v = src[k];
    if (typeof v === "number" && v > 0) r[k] = v;
  }
  if (d.planDays && d.planDays > 0) r.PLAN = 1 / d.planDays;
  else if (typeof src.PLAN === "number" && src.PLAN > 0) r.PLAN = src.PLAN;
  return Object.keys(r).length ? JSON.stringify(r) : null;
}

export async function createEmployee(input: EmployeeInput) {
  try {
    await assertAdmin();
  } catch {
    return { ok: false as const, error: "غير مصرّح" };
  }
  const parsed = employeeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.errors[0]?.message ?? "بيانات غير صالحة" };
  }
  try {
    const e = await prisma.employee.create({
      data: {
        name: parsed.data.name,
        role: parsed.data.role,
        hoursPerDay: parsed.data.hoursPerDay,
        workDays: JSON.stringify(parsed.data.workDays),
        isScheduled: parsed.data.isScheduled,
        isPhotographer: parsed.data.isPhotographer,
        salary: parsed.data.salary ?? 0,
        costPerReel: parsed.data.costPerReel ?? null,
        color: parsed.data.color ?? null,
        rates: buildRates(parsed.data),
      },
    });
    revalidateAll();
    return { ok: true as const, data: e };
  } catch {
    return { ok: false as const, error: "فشل إنشاء الموظف" };
  }
}

export async function updateEmployee(id: string, input: EmployeeInput) {
  try {
    await assertAdmin();
  } catch {
    return { ok: false as const, error: "غير مصرّح" };
  }
  const parsed = employeeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.errors[0]?.message ?? "بيانات غير صالحة" };
  }
  try {
    const e = await prisma.employee.update({
      where: { id },
      data: {
        name: parsed.data.name,
        role: parsed.data.role,
        hoursPerDay: parsed.data.hoursPerDay,
        workDays: JSON.stringify(parsed.data.workDays),
        isScheduled: parsed.data.isScheduled,
        isPhotographer: parsed.data.isPhotographer,
        salary: parsed.data.salary ?? 0,
        costPerReel: parsed.data.costPerReel ?? null,
        color: parsed.data.color ?? null,
        rates: buildRates(parsed.data),
      },
    });
    revalidateAll();
    return { ok: true as const, data: e };
  } catch {
    return { ok: false as const, error: "فشل تحديث الموظف" };
  }
}

/**
 * Delete an employee — but ONLY when nothing references them. Task.assignee and
 * the company owner relations are `onDelete: SetNull`, so deleting a teammate
 * with history silently orphans their tasks (المسؤول → «غير مُسند») and drops
 * their companies' ownership — workload and accountability vanish with no trace.
 * Mirrors the deleteCompany guard: refuse and steer to reassigning first (or
 * unticking «يدخل الجدولة» to retire them while keeping the record).
 */
export async function deleteEmployee(id: string) {
  try {
    await assertAdmin();
    const [taskCount, companyCount] = await Promise.all([
      prisma.task.count({ where: { assigneeId: id } }),
      prisma.company.count({
        where: {
          OR: [
            { postOwnerId: id },
            { storyOwnerId: id },
            { aiReelOwnerId: id },
            { defaultOwnerId: id },
            { photographerId: id },
          ],
        },
      }),
    ]);
    if (taskCount + companyCount > 0) {
      return {
        ok: false as const,
        error:
          `لا يمكن حذف الموظف — لديه ${taskCount} مهمة و${companyCount} شركة مرتبطة به. ` +
          `أعيدي إسناد مهامه وشركاته أولاً، أو ألغي «يدخل الجدولة» من تعديل الموظف للاحتفاظ بسجلّه.`,
      };
    }
    await prisma.employee.delete({ where: { id } });
    revalidateAll();
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "فشل حذف الموظف" };
  }
}
