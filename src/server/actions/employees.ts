"use server";

import { prisma } from "@/lib/db";
import { employeeSchema, type EmployeeInput } from "@/lib/schemas";
import { revalidatePath } from "next/cache";

function revalidateAll() {
  for (const p of ["/", "/team", "/tasks", "/workload", "/companies"]) {
    revalidatePath(p);
  }
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
        color: parsed.data.color ?? null,
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
        color: parsed.data.color ?? null,
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
