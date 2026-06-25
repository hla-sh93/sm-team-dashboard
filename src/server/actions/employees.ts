"use server";

import { prisma } from "@/lib/db";
import { employeeSchema, type EmployeeInput } from "@/lib/schemas";
import { revalidatePath } from "next/cache";

function revalidateAll() {
  revalidatePath("/", "layout");
}

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

export async function deleteEmployee(id: string) {
  try {
    await prisma.employee.delete({ where: { id } });
    revalidateAll();
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "فشل حذف الموظف" };
  }
}
