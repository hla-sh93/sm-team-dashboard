'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { companySchema, reorderSchema, type CompanyInput } from '@/lib/schemas';

export async function createCompany(input: CompanyInput) {
  const parsed = companySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.errors[0]?.message ?? 'بيانات غير صالحة' };
  }
  try {
    // Set priority to last
    const last = await prisma.company.findFirst({ orderBy: { priority: 'desc' } });
    const priority = (last?.priority ?? 0) + 1;
    const company = await prisma.company.create({
      data: { ...parsed.data, priority },
    });
    revalidatePath('/companies');
    revalidatePath('/priorities');
    revalidatePath('/');
    return { ok: true as const, data: company };
  } catch (e) {
    return { ok: false as const, error: 'فشل إنشاء الشركة' };
  }
}

export async function updateCompany(id: string, input: CompanyInput) {
  const parsed = companySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.errors[0]?.message ?? 'بيانات غير صالحة' };
  }
  try {
    const company = await prisma.company.update({
      where: { id },
      data: parsed.data,
    });
    revalidatePath('/companies');
    revalidatePath('/priorities');
    revalidatePath('/');
    return { ok: true as const, data: company };
  } catch (e) {
    return { ok: false as const, error: 'فشل تحديث الشركة' };
  }
}

export async function deleteCompany(id: string) {
  try {
    await prisma.company.delete({ where: { id } });
    // Re-rank remaining
    const all = await prisma.company.findMany({ orderBy: { priority: 'asc' } });
    await Promise.all(
      all.map((c: { id: string }, i: number) =>
        prisma.company.update({ where: { id: c.id }, data: { priority: i + 1 } })
      )
    );
    revalidatePath('/companies');
    revalidatePath('/priorities');
    revalidatePath('/');
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: 'فشل حذف الشركة' };
  }
}

export async function reorderCompanies(orderedIds: string[]) {
  const parsed = reorderSchema.safeParse({ orderedIds });
  if (!parsed.success) {
    return { ok: false as const, error: 'ترتيب غير صالح' };
  }
  try {
    await Promise.all(
      orderedIds.map((id, i) =>
        prisma.company.update({ where: { id }, data: { priority: i + 1 } })
      )
    );
    revalidatePath('/priorities');
    revalidatePath('/companies');
    revalidatePath('/');
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: 'فشل إعادة الترتيب' };
  }
}
