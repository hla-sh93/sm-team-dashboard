'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { memberSchema, type MemberInput } from '@/lib/schemas';

export async function createMember(input: MemberInput) {
  const parsed = memberSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.errors[0]?.message ?? 'بيانات غير صالحة' };
  }
  try {
    const member = await prisma.teamMember.create({ data: parsed.data });
    revalidatePath('/team');
    revalidatePath('/');
    return { ok: true as const, data: member };
  } catch (e) {
    return { ok: false as const, error: 'فشل إنشاء الموظف' };
  }
}

export async function updateMember(id: string, input: MemberInput) {
  const parsed = memberSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.errors[0]?.message ?? 'بيانات غير صالحة' };
  }
  try {
    const member = await prisma.teamMember.update({
      where: { id },
      data: parsed.data,
    });
    revalidatePath('/team');
    revalidatePath('/');
    return { ok: true as const, data: member };
  } catch (e) {
    return { ok: false as const, error: 'فشل تحديث الموظف' };
  }
}

export async function deleteMember(id: string) {
  try {
    await prisma.teamMember.delete({ where: { id } });
    revalidatePath('/team');
    revalidatePath('/');
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: 'فشل حذف الموظف — قد يكون مرتبط بمهام' };
  }
}
