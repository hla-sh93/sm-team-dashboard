"use server";

import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/auth";
import { companySchema, reorderSchema, type CompanyInput } from "@/lib/schemas";
import {
  cycleForBucket,
  cyclesOf,
  naturalCycleEnd,
  parseRenewals,
  serializeRenewals,
} from "@/lib/contract";
import { formatDateShort, toISODate } from "@/lib/dates";
import { DONE_STATUSES } from "@/lib/constants";
import { companyLifecycle, contractHasEnded } from "@/lib/company-visibility";
import { archiveCompanyContract } from "@/server/company-lifecycle";
import { generateCompanySchedule } from "./schedule";
// أكشنات الشركات كلها بتحرس بـ`assertAdmin` أول سطر، فالصلاحية مثبتة قبل ما
// نوصل هون — بننادي المحرّك مباشرةً بدل حراسة تانية بلا معنى.
import { generateScheduleInternal } from "@/server/schedule-engine";
import { revalidateAll } from "@/lib/revalidate";


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
        instagramHandle: d.instagramHandle ?? null,
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
    const before = await prisma.company.findUnique({
      where: { id },
      select: { status: true, contractEndedAt: true },
    });
    if (!before) return { ok: false as const, error: "الشركة غير موجودة" };
    // شركة لم تجدّد ما بترجع نشطة من حقل الحالة: الرجوع بـ«جدّد» بتاريخ دورة
    // جديدة، وإلا بتصير نشطة بلا دورة وبقرار انتهاء لسا مسجَّل.
    if (d.status === "active" && contractHasEnded(before)) {
      return {
        ok: false as const,
        error: "الشركة لم تجدّد عقدها — لإعادتها استعملي «جدّد» بتاريخ الدورة الجديدة",
      };
    }
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
        instagramHandle: d.instagramHandle ?? null,
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
    // الأرشفة من النموذج = نفس الأرشفة من «لم يُجدد»: الكروت المفتوحة بتنقفل.
    if (d.status === "archived" && before.status !== "archived") {
      await archiveCompanyContract(id, new Date());
    }
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
    // مرساة الدورات تاريخ **بدء النشر** لا توقيع العقد (قاعدة ٣/٨). الحارس كان
    // يقرأ تاريخ العقد، فشركة بتنشر بلا تاريخ عقد (BW من ١٠/٩) كانت رح تنرفض
    // عند «جدّد» مع إنّ دوراتها شغّالة وبتنتهي.
    if (!co.publishStartDate) {
      return {
        ok: false as const,
        error: "هذه الشركة بلا تاريخ بدء نشر (توزيع شهري) — لا تحتاج تجديداً",
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
        status: co.status === "paused" || co.status === "archived" ? "active" : co.status,
      },
    });
    revalidateAll();
    // Build the new cycle's tasks right away so the renewal is visible without
    // a manual «إعادة الجدولة».
    await generateScheduleInternal(start.getFullYear(), start.getMonth(), null);
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
        status: co.status === "paused" || co.status === "archived" ? "active" : co.status,
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
    // لم يُجدد = أرشيف، لا إيقاف: الشركة واقفة من حالها وكروتها المفتوحة بتنقفل
    // تلقائياً (قرار القائدة ١٥/٩). الإيقاف للنشطة يلي طلب زبونها التوقّف.
    const r = await archiveCompanyContract(
      companyId,
      new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    );
    revalidateAll();
    return { ok: true as const, closedTasks: r.closedTasks };
  } catch {
    return { ok: false as const, error: "فشل إنهاء العقد" };
  }
}

/** Archive a company: keep all its history but remove it from scheduling,
 *  publishing and finance. Open cards close automatically — same rule as «لم يُجدد». */
export async function archiveCompany(id: string) {
  try {
    await assertAdmin();
    const r = await archiveCompanyContract(id, new Date());
    revalidateAll();
    return { ok: true as const, closedTasks: r.closedTasks };
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

/**
 * إيقاف نشر شركة مؤقتاً — وتنظيف كروتها المفتوحة.
 *
 * قرار القائدة (٤/٩): «بدي أقدر أوقف النشر من اللوحة وأنظّف كل الكروت، لحدّ ما
 * أرجّعها. جدارات هلق، ويمكن فونيتيك وBW».
 *
 * شو بيصير:
 *   • الحالة بتصير `paused` وتاريخ بدء النشر بينفرّغ — فما في دورة، وما في
 *     تأخير بينحسب علينا، والمحرّك ما بيولّد إلها ولا كرت جديد.
 *   • الكروت **غير المنجزة** بتنشال من كل بكتاتها.
 *
 * وشو **ما** بيصير: الشغل المنجَز أو المنشور **ما بينلمس**. «نظّف الكروت» يعني
 * شيل الشغل المعلّق عن الفريق، مو محو تاريخ إنتاج صار فعلاً — وإلا بتضيع
 * أرقام الإنجاز وحصيلة كل شخص. الكروت اليدوية كمان بتضل (مهام أحداث وإعادات).
 */
export async function pauseCompanyPublishing(companyId: string) {
  try {
    await assertAdmin();
  } catch {
    return { ok: false as const, error: "غير مصرّح" };
  }
  try {
    const co = await prisma.company.findUnique({ where: { id: companyId } });
    if (!co) return { ok: false as const, error: "الشركة غير موجودة" };
    // الإيقاف للشركة النشطة يلي طلب زبونها التوقّف. المؤرشفة (لم تجدّد) واقفة
    // من حالها — ما إلها إيقاف ولا إرجاع.
    if (companyLifecycle(co) === "archived") {
      return { ok: false as const, error: "الشركة مؤرشفة (لم تجدّد) — لا يُوقف نشرها؛ تعود بـ«جدّد»" };
    }
    if (co.status === "paused") {
      return { ok: false as const, error: "الشركة موقوفة أصلاً" };
    }

    const removed = await prisma.task.deleteMany({
      where: {
        companyId,
        isAuto: true,
        board: { not: "DONE" },
        status: { notIn: [...DONE_STATUSES] },
      },
    });
    const sessions = await prisma.photoSession.deleteMany({
      where: { companyId, isAuto: true, status: "NOT_STARTED" },
    });

    const updated = await prisma.company.update({
      where: { id: companyId },
      data: {
        status: "paused",
        publishStartDate: null,
        lateExemptReason: "النشر موقوف بقرار — بينتظر تاريخ بدء نشر جديد",
      },
    });
    revalidateAll();
    return {
      ok: true as const,
      data: updated,
      removedTasks: removed.count,
      removedSessions: sessions.count,
    };
  } catch {
    return { ok: false as const, error: "فشل إيقاف نشر الشركة" };
  }
}

/**
 * إرجاع شركة موقوفة للعمل — بتاريخ بدء نشر **جديد**.
 *
 * التاريخ إلزامي وهو مرساة كل شي: منه بتتحدّد الدورة، ومنه بيرتّب المحرّك
 * التصميم والتصوير والمونتاج والنشر. بلا تاريخ ما في دورة، فما في كروت — ولهيك
 * ما منقبل إرجاعاً بلا تاريخ بدل ما نرجّعها لحالة نصّها معلّق.
 */
export async function resumeCompanyPublishing(companyId: string, startDateISO: string) {
  try {
    await assertAdmin();
  } catch {
    return { ok: false as const, error: "غير مصرّح" };
  }
  const start = parseContractDate(startDateISO);
  if (!start) return { ok: false as const, error: "تاريخ بدء النشر غير صالح" };
  try {
    const co = await prisma.company.findUnique({ where: { id: companyId } });
    if (!co) return { ok: false as const, error: "الشركة غير موجودة" };
    if (companyLifecycle(co) === "archived") {
      return { ok: false as const, error: "الشركة لم تجدّد عقدها — تعود بـ«جدّد» بتاريخ الدورة الجديدة" };
    }
    if (co.status !== "paused") {
      return { ok: false as const, error: "الشركة ليست موقوفة" };
    }

    const updated = await prisma.company.update({
      where: { id: companyId },
      data: {
        status: "active",
        publishStartDate: start,
        lateExemptReason: null,
        // الدورة بتبلّش من جديد من هالتاريخ، فتاريخ التجديدات القديم ما عاد
        // يوصف شي — تركه بيخلّي المحرّك يحسب دورات ما إلها وجود.
        renewals: null,
        contractEndedAt: null,
      },
    });

    // بكت الدورة الجديدة = بكت شهر بدايتها.
    const built = await generateCompanySchedule(companyId, start.getFullYear(), start.getMonth());
    if (!built.ok) {
      return {
        ok: false as const,
        resumed: true as const,
        error: `رجعت الشركة للعمل، بس بناء دورتها فشل: ${built.error}`,
      };
    }
    revalidateAll();
    return { ok: true as const, data: updated, from: toISODate(start) };
  } catch {
    return { ok: false as const, error: "فشل إرجاع الشركة للعمل" };
  }
}

/**
 * تنظيف الكروت اليتيمة — المولَّدة ببكت ما إله دورة عند شركتها.
 *
 * الكرت المولَّد لازم يقع جوّا دورة شركته: الدورة هي يلي بتحدّد الخطة والمواعيد
 * والحساب. الكرت ببكت بلا دورة ما بينتمي لشي — ما بينعاد بناؤه ولا بينحسب
 * بالإنجاز، وبيضل يطلع بالفحوص وبالأرقام كأنه شغل حقيقي.
 *
 * بيصير بحالتين: تاريخ بدء النشر انتغيّر فانتقلت الدورة لبكت تاني (Siizen ٤/٩)،
 * أو انولّدت كروت بشهر تقويمي قبل ما يصير للشركة تاريخ نشر أصلاً (التدريب).
 *
 * الحارس: بيرجّع العدد أول مرة بدل ما يحذف، ولازم تأكيد بنفس العدد. والكروت
 * اليدوية ما بتنلمس أبداً — هي شغل حدا كتبه بإيده، مو توليد.
 */
export async function purgeOrphanCards(companyId: string, confirmCount?: number) {
  try {
    await assertAdmin();
  } catch {
    return { ok: false as const, error: "غير مصرّح" };
  }
  try {
    const co = await prisma.company.findUnique({ where: { id: companyId } });
    if (!co) return { ok: false as const, error: "الشركة غير موجودة" };

    // ═══ حارس: «يتيم» بيعني شاذّ، مو «الشركة ما إلها دورة» ═══
    //
    // الشركة بلا تاريخ بدء نشر ما إلها دورة بأي بكت — فبحرفية القاعدة **كل**
    // كروتها يتيمة. BW وPhoeniTech هيك: ١٠٥ و١١٤ كرت فيهن تاريخ نشر كامل،
    // وتنظيفهن بهالمنطق بيمحي أرشيف شهور. والحالة الحقيقية إنّ التاريخ ناقص
    // بالسجل، مو إنّ الشغل ما بينتمي.
    //
    // فالأداة بتشتغل بس لما يكون في دورة فعلاً وبعض البكتات برّاها — وهي
    // الحالة يلي انبنت إلها (Siizen بعد ما انتقلت دورتها لبكت تاني).
    if (!co.publishStartDate) {
      return {
        ok: false as const,
        error:
          "هالشركة ما إلها تاريخ بدء نشر، يعني ما إلها دورة بأي شهر — فكل كروتها " +
          "رح تنعدّ يتيمة ويتمحي أرشيفها كله. حطّي تاريخ بدء النشر أولاً.",
      };
    }

    const buckets = await prisma.task.groupBy({
      by: ["year", "month"],
      where: { companyId, isAuto: true },
      _count: true,
    });
    const orphanBuckets = buckets.filter((b) => cycleForBucket(co, b.year, b.month) == null);
    if (orphanBuckets.length === 0) {
      return { ok: true as const, removed: 0, buckets: [] as string[] };
    }

    const where = {
      companyId,
      isAuto: true,
      OR: orphanBuckets.map((b) => ({ year: b.year, month: b.month })),
    };
    const count = await prisma.task.count({ where });
    if (confirmCount !== count) {
      return {
        ok: false as const,
        error: `في ${count} كرت مولَّد ببكتات ما إلها دورة. أكّدي بالعدد نفسه.`,
        orphanCount: count,
        buckets: orphanBuckets.map((b) => `${b.year}-${b.month + 1}`),
      };
    }

    const removed = await prisma.task.deleteMany({ where });
    await prisma.photoSession.deleteMany({
      where: { companyId, isAuto: true, OR: orphanBuckets.map((b) => ({ year: b.year, month: b.month })) },
    });
    revalidateAll();
    return {
      ok: true as const,
      removed: removed.count,
      buckets: orphanBuckets.map((b) => `${b.year}-${b.month + 1}`),
    };
  } catch {
    return { ok: false as const, error: "فشل تنظيف الكروت اليتيمة" };
  }
}
