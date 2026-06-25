"use server";

import { prisma } from "@/lib/db";
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

export async function deleteCompany(id: string) {
  try {
    await prisma.company.delete({ where: { id } });
    revalidateAll();
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "فشل حذف الشركة" };
  }
}

export async function reorderCompanies(orderedIds: string[]) {
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
