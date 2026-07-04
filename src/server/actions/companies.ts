"use server";

import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/auth";
import { companySchema, reorderSchema, type CompanyInput } from "@/lib/schemas";
import { revalidatePath } from "next/cache";

function revalidateAll() {
  revalidatePath("/", "layout");
}

/** Parse a YYYY-MM-DD form string into a LOCAL-midnight Date (or null). */
function parseContractDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export async function createCompany(input: CompanyInput) {
  try {
    await assertAdmin();
  } catch {
    return { ok: false as const, error: "غير مصرّح" };
  }
  const parsed = companySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.errors[0]?.message ?? "بيانات غير صالحة" };
  }
  try {
    const d = parsed.data;
    const c = await prisma.company.create({
      data: {
        name: d.name,
        managed: d.managed,
        posts: d.posts,
        reels: d.reels,
        aiReels: d.aiReels,
        stories: d.stories,
        contractValue: d.contractValue ?? 0,
        contractStartDate: parseContractDate(d.contractStartDate),
        preferredShootDay: d.preferredShootDay ?? null,
        color: d.color,
        priority: d.priority,
        status: d.status,
        postOwnerId: d.postOwnerId,
        storyOwnerId: d.storyOwnerId,
        aiReelOwnerId: d.aiReelOwnerId,
        defaultOwnerId: d.defaultOwnerId,
        photographerId: d.photographerId,
      },
    });
    revalidateAll();
    return { ok: true as const, data: c };
  } catch {
    return { ok: false as const, error: "فشل إنشاء الشركة (قد يكون الاسم مكرراً)" };
  }
}

export async function updateCompany(id: string, input: CompanyInput) {
  try {
    await assertAdmin();
  } catch {
    return { ok: false as const, error: "غير مصرّح" };
  }
  const parsed = companySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.errors[0]?.message ?? "بيانات غير صالحة" };
  }
  try {
    const d = parsed.data;
    const c = await prisma.company.update({
      where: { id },
      data: {
        name: d.name,
        managed: d.managed,
        posts: d.posts,
        reels: d.reels,
        aiReels: d.aiReels,
        stories: d.stories,
        contractValue: d.contractValue ?? 0,
        contractStartDate: parseContractDate(d.contractStartDate),
        preferredShootDay: d.preferredShootDay ?? null,
        color: d.color,
        priority: d.priority,
        status: d.status,
        postOwnerId: d.postOwnerId,
        storyOwnerId: d.storyOwnerId,
        aiReelOwnerId: d.aiReelOwnerId,
        defaultOwnerId: d.defaultOwnerId,
        photographerId: d.photographerId,
      },
    });
    revalidateAll();
    return { ok: true as const, data: c };
  } catch {
    return { ok: false as const, error: "فشل تحديث الشركة" };
  }
}

/**
 * Delete a company — but ONLY when it has no history. A company row cascades to
 * its tasks and photo sessions (schema onDelete: Cascade), so deleting a client
 * that ever had work would IRREVERSIBLY wipe its published history, reports and
 * financial trail. We refuse that and steer the manager to archiving instead
 * (status='archived' hides it from scheduling/finance while keeping the record).
 */
export async function deleteCompany(id: string) {
  try {
    await assertAdmin();
    const taskCount = await prisma.task.count({ where: { companyId: id } });
    const sessionCount = await prisma.photoSession.count({ where: { companyId: id } });
    if (taskCount + sessionCount > 0) {
      return {
        ok: false as const,
        error:
          `لا يمكن حذف الشركة لأن لديها ${taskCount + sessionCount} مهمة/جلسة وتاريخاً محفوظاً. ` +
          `للحفاظ على السجل، استخدم «الأرشفة» بدل الحذف (تختفي من الجدولة والمالية ويبقى تاريخها).`,
        canArchive: true as const,
      };
    }
    await prisma.company.delete({ where: { id } });
    revalidateAll();
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "فشل حذف الشركة" };
  }
}

/** Archive a company: keep all its history but remove it from scheduling,
 *  publishing and finance (managed companies are filtered by status='active'). */
export async function archiveCompany(id: string) {
  try {
    await assertAdmin();
    await prisma.company.update({ where: { id }, data: { status: "archived" } });
    revalidateAll();
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "فشل أرشفة الشركة" };
  }
}

export async function reorderCompanies(orderedIds: string[]) {
  try {
    await assertAdmin();
  } catch {
    return { ok: false as const, error: "غير مصرّح" };
  }
  const parsed = reorderSchema.safeParse({ orderedIds });
  if (!parsed.success) return { ok: false as const, error: "ترتيب غير صالح" };
  try {
    await prisma.$transaction(
      parsed.data.orderedIds.map((id, i) =>
        prisma.company.update({ where: { id }, data: { priority: i + 1 } }),
      ),
    );
    revalidateAll();
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "فشل إعادة الترتيب" };
  }
}
