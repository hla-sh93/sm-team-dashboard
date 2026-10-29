"use server";

import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/auth";
import { employeeSchema, isCalendarDay, type EmployeeInput } from "@/lib/schemas";
import { revalidateAll } from "@/lib/revalidate";
import { fromISODate } from "@/lib/dates";
import { withEvidenceLine } from "@/lib/evidence";
import { recordHandover } from "@/server/handover";


/** Build the rates JSON (items/day). planDays → PLAN rate = 1/planDays. */
function buildRates(d: EmployeeInput): string | null {
  const r: Record<string, number> = {};
  const src = d.rates ?? {};
  for (const k of ["POST", "STORY", "AI_REEL", "REEL", "SHOOT", "EDIT"] as const) {
    const v = src[k];
    if (typeof v === "number" && v > 0) r[k] = v;
  }
  if (d.planDays && d.planDays > 0) r.PLAN = 1 / d.planDays;
  else if (typeof src.PLAN === "number" && src.PLAN > 0) r.PLAN = src.PLAN;
  return Object.keys(r).length ? JSON.stringify(r) : null;
}

const normIdentity = (v: string) => v.normalize("NFKC").replace(/^@/, "").replace(/\s+/g, " ").trim().toLowerCase();

/** «Lilas, ليلاس ,lilas» ← «Lilas, ليلاس» — بلا فراغات زايدة ولا تكرار. */
function cleanAliases(raw: string | null | undefined): string | null {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of (raw ?? "").split(",")) {
    const v = part.replace(/\s+/g, " ").trim();
    if (!v || seen.has(normIdentity(v))) continue;
    seen.add(normIdentity(v));
    out.push(v);
  }
  return out.length ? out.join(", ") : null;
}

/**
 * هوية تلغرام لازم تدلّ على شخص واحد: نفس المعرّف أو اسم المستخدم أو اسم بديل عند موظفين = البوت
 * ما بيعرف مين بعت (`resolveSender` بيرجّع «مجهول» لاسم بيطابق شخصين) — وملفاتهم كلها بتنحجز.
 */
async function telegramIdentityClash(
  selfId: string | null,
  data: { telegramUserId?: string | null; telegramUsername?: string | null; telegramAliases?: string | null },
): Promise<string | null> {
  const others = await prisma.employee.findMany({
    where: selfId ? { id: { not: selfId } } : {},
    select: { name: true, telegramUserId: true, telegramUsername: true, telegramAliases: true },
  });
  const mine = new Set((data.telegramAliases ?? "").split(",").map(normIdentity).filter(Boolean));
  for (const o of others) {
    if (data.telegramUserId && o.telegramUserId === data.telegramUserId)
      return `معرّف تلغرام هاد مربوط أصلاً بـ«${o.name}»`;
    if (data.telegramUsername && o.telegramUsername && normIdentity(o.telegramUsername) === normIdentity(data.telegramUsername))
      return `اسم المستخدم هاد مربوط أصلاً بـ«${o.name}»`;
    const theirs = (o.telegramAliases ?? "").split(",").map(normIdentity).filter(Boolean);
    const shared = theirs.find((a) => mine.has(a));
    if (shared) return `الاسم البديل «${shared}» مستعمل أصلاً عند «${o.name}»`;
  }
  return null;
}

/** حقول تلغرام يلي **انبعتت** بس — نداء ما بيبعتها (سكربت، نموذج قديم) ما بيمحي الربط الموجود. */
const telegramFields = (d: EmployeeInput) => ({
  ...(d.telegramUserId !== undefined ? { telegramUserId: d.telegramUserId ?? null } : {}),
  ...(d.telegramUsername !== undefined ? { telegramUsername: d.telegramUsername ?? null } : {}),
  ...(d.telegramAliases !== undefined ? { telegramAliases: cleanAliases(d.telegramAliases) } : {}),
});

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
  const clash = await telegramIdentityClash(null, telegramFields(parsed.data));
  if (clash) return { ok: false as const, error: clash };
  try {
    const e = await prisma.employee.create({
      data: {
        ...telegramFields(parsed.data),
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
  const clash = await telegramIdentityClash(id, telegramFields(parsed.data));
  if (clash) return { ok: false as const, error: clash };
  try {
    const e = await prisma.employee.update({
      where: { id },
      data: {
        ...telegramFields(parsed.data),
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

/**
 * «تسليم الشغل» — موظف ترك (أو تغيّر دوره) وموظف تاني استلم من تاريخ.
 *
 * القائدة (١٢/١٠/٢٠٢٦): «ماجد استقال ووظفنا ليلاس مكانه كمصورة جديدة بالشركة بدأت من
 * 1 أكتوبر». سجلّ ماجد كان انعاد تسميته «ليلاس» ٦/١٠، فصار تاريخه كله (١١٥ كرت منجز)
 * باسمها (فحص ١٢/١٠، DA-05). الصح: سجلّ جديد للمستلِم، وتسليم بتاريخ:
 *   • الكروت المفتوحة كلها، والمنجزة بطابع ≥ التاريخ (شغل المستلِم فعلاً) — بسطر دليل؛
 *     المنجز قبل التاريخ بيضل باسم صاحبه.
 *   • حقول المسؤولين بالشركات غير المؤرشفة (المصوّر، المصمّم، مسؤول الحساب…).
 *   • المغادر بيطلع من التوزيع (`isScheduled = false`).
 *
 * `confirm` لازم يساوي العدد يلي رجّعته المعاينة (نفس حارس «تنظيف الكروت اليتيمة»):
 * أوّل نداء بلا `confirm` = معاينة بلا كتابة.
 */
export async function handoverEmployeeWork(input: {
  fromId: string;
  toId: string;
  fromDate: string;
  confirm?: number;
}) {
  try {
    await assertAdmin();
  } catch {
    return { ok: false as const, error: "غير مصرّح" };
  }
  const { fromId, toId, fromDate } = input;
  if (!fromId || !toId || fromId === toId) {
    return { ok: false as const, error: "اختاري موظفَين مختلفين" };
  }
  if (!isCalendarDay(fromDate)) return { ok: false as const, error: "تاريخ غير صالح" };
  try {
    const [from, to] = await Promise.all([
      prisma.employee.findUnique({ where: { id: fromId } }),
      prisma.employee.findUnique({ where: { id: toId } }),
    ]);
    if (!from || !to) return { ok: false as const, error: "الموظف غير موجود" };
    const since = fromISODate(fromDate);

    const open = await prisma.task.findMany({
      where: {
        assigneeId: fromId,
        status: { notIn: ["CANCELED", "READY", "PUBLISHED"] },
        board: { not: "DONE" },
      },
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
    const ownerFields = [
      "photographerId",
      "postOwnerId",
      "storyOwnerId",
      "aiReelOwnerId",
      "defaultOwnerId",
      "accountOwnerId",
    ] as const;
    const companies = (await prisma.company.findMany()).filter((c) => c.status !== "archived");
    const companyUpdates = companies
      .map((c) => ({
        id: c.id,
        data: Object.fromEntries(ownerFields.filter((f) => c[f] === fromId).map((f) => [f, toId])),
      }))
      .filter((u) => Object.keys(u.data).length > 0);

    const total = open.length + doneSince.length + companyUpdates.length;
    const summary = {
      openCards: open.length,
      doneSince: doneSince.length,
      companies: companyUpdates.length,
      total,
    };
    if (input.confirm == null) return { ok: true as const, preview: true as const, ...summary };
    if (input.confirm !== total) {
      return { ok: false as const, error: "الأعداد تغيّرت من وقت المعاينة — أعيدي المعاينة", ...summary };
    }

    const line = `انتقل من ${from.name} لـ${to.name} (تسليم الشغل من ${fromDate})`;
    await prisma.$transaction([
      ...[...open, ...doneSince].map((t) =>
        prisma.task.update({
          where: { id: t.id },
          data: { assigneeId: toId, notes: withEvidenceLine(t.notes, line) },
        }),
      ),
      ...companyUpdates.map((u) => prisma.company.update({ where: { id: u.id }, data: u.data })),
      prisma.employee.update({ where: { id: fromId }, data: { isScheduled: false } }),
    ]);
    // المحرّك بيختار الكاتبة/المونتيرة/الناشر بالدور — الخلف بيورث الدور كمان.
    await recordHandover(fromId, toId, fromDate);
    revalidateAll();
    return { ok: true as const, preview: false as const, ...summary };
  } catch {
    return { ok: false as const, error: "فشل تسليم الشغل" };
  }
}
