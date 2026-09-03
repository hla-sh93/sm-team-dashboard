"use server";

import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/auth";
import { companySchema, reorderSchema, type CompanyInput } from "@/lib/schemas";
import {
  cyclesOf,
  naturalCycleEnd,
  parseRenewals,
  serializeRenewals,
} from "@/lib/contract";
import { formatDateShort, toISODate } from "@/lib/dates";
import { generateCompanySchedule, generateSchedule } from "./schedule";
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

/** أسبوع التحضير بين التوقيع وبدء النشر. */
const PREP_DAYS = 7;

/**
 * بدء النشر — وهو مرساة الدورة.
 *
 * إذا انحطّ صراحةً منستعمله. إذا ما انحطّ وفي تاريخ توقيع، منفترض **أسبوع بعده**
 * («معظمنا منبدأ نشر بعد التوقيع بأسبوع» — القائدة 3/8/2026)، وإلا شركة جديدة
 * بتنعمل بتاريخ عقد وما بينولّد لها ولا كرت وحدا بيفهم ليش. يلي بدها تعليم
 * «النشر ما بلّش» (جدارات، Siizen) بتنفرّغ من الشاشة صراحةً.
 */
function resolvePublishStart(
  publishStartDate: string | null | undefined,
  contractStartDate: string | null | undefined,
  explicit: boolean,
): Date | null {
  const p = parseContractDate(publishStartDate);
  if (p) return p;
  if (explicit) return null; // الشاشة بعتت الحقل فاضي عن قصد
  const c = parseContractDate(contractStartDate);
  if (!c) return null;
  const d = new Date(c);
  d.setDate(d.getDate() + PREP_DAYS);
  return d;
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
        publishStartDate: resolvePublishStart(
          d.publishStartDate,
          d.contractStartDate,
          "publishStartDate" in (input as object),
        ),
        // Only written when explicitly supplied — the company form does not send
        // these, and a plain edit must never wipe the contract's cycle history.
        ...(d.renewals !== undefined ? { renewals: d.renewals } : {}),
        ...(d.contractEndedAt !== undefined
          ? { contractEndedAt: parseContractDate(d.contractEndedAt) }
          : {}),
        preferredShootDay: d.preferredShootDay ?? null,
        contentSupplied: d.contentSupplied,
        color: d.color,
        priority: d.priority,
        status: d.status,
        postOwnerId: d.postOwnerId,
        storyOwnerId: d.storyOwnerId,
        aiReelOwnerId: d.aiReelOwnerId,
        defaultOwnerId: d.defaultOwnerId,
        photographerId: d.photographerId,
        accountOwnerId: d.accountOwnerId,
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
        publishStartDate: resolvePublishStart(
          d.publishStartDate,
          d.contractStartDate,
          "publishStartDate" in (input as object),
        ),
        // Only written when explicitly supplied — the company form does not send
        // these, and a plain edit must never wipe the contract's cycle history.
        ...(d.renewals !== undefined ? { renewals: d.renewals } : {}),
        ...(d.contractEndedAt !== undefined
          ? { contractEndedAt: parseContractDate(d.contractEndedAt) }
          : {}),
        preferredShootDay: d.preferredShootDay ?? null,
        contentSupplied: d.contentSupplied,
        color: d.color,
        priority: d.priority,
        status: d.status,
        postOwnerId: d.postOwnerId,
        storyOwnerId: d.storyOwnerId,
        aiReelOwnerId: d.aiReelOwnerId,
        defaultOwnerId: d.defaultOwnerId,
        photographerId: d.photographerId,
        accountOwnerId: d.accountOwnerId,
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

/**
 * CONTRACT RENEWED — record a new cycle starting on `startDateISO`.
 *
 * A cycle never continues on its own: until this runs, the engine generates
 * nothing past the last recorded cycle. The new cycle runs from the given date
 * (day→day), so renewing late leaves a real, empty gap — which is the point.
 */
export async function renewContract(companyId: string, startDateISO: string) {
  try {
    await assertAdmin();
  } catch {
    return { ok: false as const, error: "غير مصرّح" };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDateISO)) {
    return { ok: false as const, error: "تاريخ غير صالح" };
  }
  try {
    const co = await prisma.company.findUnique({ where: { id: companyId } });
    if (!co) return { ok: false as const, error: "الشركة غير موجودة" };
    if (!co.contractStartDate) {
      return {
        ok: false as const,
        error: "هذه الشركة بلا تاريخ عقد (توزيع شهري) — لا تحتاج تجديداً",
      };
    }
    const start = parseContractDate(startDateISO)!;
    const cycles = cyclesOf(co);
    const last = cycles[cycles.length - 1];
    // A renewal must not start before the CURRENT cycle ends — otherwise it
    // would silently truncate work already planned and published.
    if (last && start.getTime() < last.end.getTime()) {
      return {
        ok: false as const,
        error: `الدورة الحالية تنتهي ${formatDateShort(last.end)} — لا يمكن بدء دورة جديدة قبلها`,
      };
    }
    const starts = [...parseRenewals(co), start];
    const updated = await prisma.company.update({
      where: { id: companyId },
      data: {
        renewals: serializeRenewals(starts),
        contractEndedAt: null, // renewing revives a contract marked "not renewed"
        status: co.status === "paused" ? "active" : co.status,
      },
    });
    revalidateAll();
    // Build the new cycle's tasks right away so the renewal is visible without
    // a manual «إعادة الجدولة».
    await generateSchedule(start.getFullYear(), start.getMonth());
    return { ok: true as const, data: updated };
  } catch {
    return { ok: false as const, error: "فشل تسجيل التجديد" };
  }
}

/**
 * Correct the most recently recorded renewal without touching the original
 * publication anchor or any earlier cycle. This is intentionally separate from
 * updateCompany: editing the company form must never rewrite contract history.
 *
 * Both affected month buckets are rebuilt for THIS company only. The new bucket
 * is written first; the obsolete bucket is removed second, so a transient
 * failure can leave an obvious duplicate to clean up but cannot erase the old
 * cards before the replacement exists.
 */
export async function correctLatestRenewal(companyId: string, startDateISO: string) {
  try {
    await assertAdmin();
  } catch {
    return { ok: false as const, error: "غير مصرّح" };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDateISO)) {
    return { ok: false as const, error: "تاريخ غير صالح" };
  }

  try {
    const start = parseContractDate(startDateISO);
    if (!start || Number.isNaN(start.getTime()) || toISODate(start) !== startDateISO) {
      return { ok: false as const, error: "تاريخ غير صالح" };
    }

    const co = await prisma.company.findUnique({ where: { id: companyId } });
    if (!co) return { ok: false as const, error: "الشركة غير موجودة" };

    const renewals = parseRenewals(co).sort((a, b) => a.getTime() - b.getTime());
    if (renewals.length === 0) {
      return { ok: false as const, error: "لا يوجد تجديد مسجّل لتصحيحه" };
    }

    const oldStart = renewals[renewals.length - 1];
    const previousStart =
      renewals.length > 1
        ? renewals[renewals.length - 2]
        : co.publishStartDate
          ? new Date(co.publishStartDate)
          : null;
    if (!previousStart) {
      return { ok: false as const, error: "لا يوجد تاريخ بدء نشر سابق لبناء الدورة" };
    }
    const earliest = naturalCycleEnd(previousStart);
    if (start.getTime() < earliest.getTime()) {
      return {
        ok: false as const,
        error: `الدورة السابقة تنتهي ${formatDateShort(earliest)} — لا يمكن أن يبدأ التجديد قبلها`,
      };
    }
    if (toISODate(oldStart) === startDateISO) {
      return { ok: true as const, data: co, unchanged: true as const };
    }

    const correctedRenewals = [...renewals.slice(0, -1), start];
    const updated = await prisma.company.update({
      where: { id: companyId },
      data: {
        renewals: serializeRenewals(correctedRenewals),
        contractEndedAt: null,
        status: co.status === "paused" ? "active" : co.status,
      },
    });

    const newBucket = { year: start.getFullYear(), month: start.getMonth() };
    const oldBucket = { year: oldStart.getFullYear(), month: oldStart.getMonth() };
    const built = await generateCompanySchedule(companyId, newBucket.year, newBucket.month);
    if (!built.ok) {
      await prisma.company.update({
        where: { id: companyId },
        data: { renewals: co.renewals, contractEndedAt: co.contractEndedAt, status: co.status },
      });
      return {
        ok: false as const,
        error: `لم يُحفظ التصحيح لأن بناء الدورة الجديدة فشل: ${built.error}`,
      };
    }

    if (oldBucket.year !== newBucket.year || oldBucket.month !== newBucket.month) {
      // التفريغ مقصود كمان: الدورة انزاحت لبكت تاني، فالبكت القديم لازم يفضى.
      const cleaned = await generateCompanySchedule(companyId, oldBucket.year, oldBucket.month, true);
      if (!cleaned.ok) {
        revalidateAll();
        return {
          ok: false as const,
          corrected: true as const,
          error:
            "تَصحّح تاريخ التجديد وبُنيت الدورة الجديدة، لكن بقيت كروت الدورة الخاطئة وتحتاج إعادة المحاولة لتنظيفها.",
        };
      }
    }

    revalidateAll();
    return { ok: true as const, data: updated };
  } catch {
    return { ok: false as const, error: "فشل تصحيح آخر تجديد" };
  }
}

/**
 * شيل آخر تجديد — دورة انسجّلت وما بلّشت أصلاً.
 *
 * القائدة (٣/٩/٢٠٢٦) عن المخبر: «لا، المشكلة نحنا ما عملنا دورة ١٥/٨–١٥/٩.
 * هاد كله تأخير من دورة ١٥/٧–١٥/٨». فالتطبيق كان فاتح دورة تالتة ما وُجدت،
 * وكروتها بتشوّش على كل حساب: الخطة، والمتأخرات، والحمل.
 *
 * `correctLatestRenewal` بتستبدل التاريخ وما بتقدر تشيله — فهاي أختها.
 *
 * الحارس: الدورة يلي فيها شغل منجز ما بتنشال بالغلط. لازم المُنادي يمرّر عدد
 * الكروت المنجزة يلي شافه (`confirmDoneCards`) — رقم مطابق تماماً، فما بتنشال
 * دورة فيها شغل إلا بقرار واعٍ بعدده.
 */
export async function removeLatestRenewal(companyId: string, confirmDoneCards?: number) {
  try {
    await assertAdmin();
  } catch {
    return { ok: false as const, error: "غير مصرّح" };
  }
  try {
    const co = await prisma.company.findUnique({ where: { id: companyId } });
    if (!co) return { ok: false as const, error: "الشركة غير موجودة" };

    const renewals = parseRenewals(co).sort((a, b) => a.getTime() - b.getTime());
    if (renewals.length === 0) {
      return { ok: false as const, error: "لا يوجد تجديد مسجّل لإزالته" };
    }
    const removed = renewals[renewals.length - 1];
    const bucket = { year: removed.getFullYear(), month: removed.getMonth() };

    const doneCards = await prisma.task.count({
      where: {
        companyId,
        year: bucket.year,
        month: bucket.month,
        board: "DONE",
        status: { not: "CANCELED" },
      },
    });
    if (doneCards > 0 && confirmDoneCards !== doneCards) {
      return {
        ok: false as const,
        error: `دورة ${formatDateShort(removed)} فيها ${doneCards} كرت منجز. إذا كانت فعلاً دورة ما بلّشت، أكّدي بالعدد نفسه.`,
        doneCards,
      };
    }

    const updated = await prisma.company.update({
      where: { id: companyId },
      data: { renewals: serializeRenewals(renewals.slice(0, -1)) },
    });

    // كروت الدورة المشالة بتروح بإعادة توليد دلوها: ما عاد إلها دورة فالمحرّك
    // بيرجع فاضي، والحذف بيمسّ المولَّد تلقائياً بس — الكروت اليدوية بتضل.
    // `true` = التفريغ مقصود: هي الدورة انشالت، فكروتها المولّدة لازم تروح.
    // بلاها بيرفض الحارس الحذف (شوف `allowEmptyRebuild`).
    const cleaned = await generateCompanySchedule(companyId, bucket.year, bucket.month, true);
    if (!cleaned.ok) {
      await prisma.company.update({
        where: { id: companyId },
        data: { renewals: co.renewals },
      });
      return {
        ok: false as const,
        error: `لم تُزَل الدورة لأن تنظيف كروتها فشل: ${cleaned.error}`,
      };
    }

    revalidateAll();
    return { ok: true as const, data: updated, removed: toISODate(removed), doneCards };
  } catch {
    return { ok: false as const, error: "فشلت إزالة آخر تجديد" };
  }
}

/**
 * CONTRACT NOT RENEWED — stop here. Sets a hard cutoff so no cycle can begin
 * on/after today and pauses the company (out of scheduling and finance). Fully
 * reversible: recording a renewal later clears the cutoff and reactivates it.
 */
export async function endContract(companyId: string) {
  try {
    await assertAdmin();
  } catch {
    return { ok: false as const, error: "غير مصرّح" };
  }
  try {
    const now = new Date();
    await prisma.company.update({
      where: { id: companyId },
      data: {
        contractEndedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        status: "paused",
      },
    });
    revalidateAll();
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "فشل إيقاف العقد" };
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
