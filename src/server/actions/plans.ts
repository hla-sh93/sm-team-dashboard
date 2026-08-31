"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/auth";
import { fromISODate, toISODate } from "@/lib/dates";
import { revalidatePath } from "next/cache";

const contentType = z.enum(["POST", "REEL", "AI_REEL", "STORY"]);
const pieceRef = z.object({
  type: contentType,
  pieceNo: z.number().int().positive().max(999),
});
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => toISODate(fromISODate(value)) === value, "تاريخ غير صالح");

const planUpdateSchema = z
  .object({
    companyId: z.string().min(1).optional(),
    companyName: z.string().trim().min(1).optional(),
    year: z.number().int().min(2000).max(2100),
    month: z.number().int().min(0).max(11),
    requireComplete: z.boolean().optional(),
    items: z
      .array(
        pieceRef.extend({
          brief: z.string().trim().min(1).max(4000),
        }),
      )
      .min(1)
      .max(300),
    prepareOn: z
      .object({
        date: isoDate,
        items: z.array(pieceRef).min(1).max(100),
      })
      .optional(),
    publishOn: z
      .object({
        date: isoDate,
        item: pieceRef,
      })
      .optional(),
  })
  .refine((value) => Boolean(value.companyId || value.companyName), {
    message: "يلزم تحديد الشركة",
  });

const keyOf = (item: { type: string; pieceNo: number }) => `${item.type}|${item.pieceNo}`;

/**
 * Apply a verified, item-level content plan to an already generated company
 * cycle. Descriptions are copied to every stage of each piece, while optional
 * preparation/publication overrides pin only the exact cards requested.
 *
 * The whole mapping is validated before the transaction. If even one requested
 * piece or stage is missing, nothing is written — this prevents a shifted plan
 * from silently describing the wrong content.
 */
export async function applyCompanyPlanUpdate(input: unknown) {
  try {
    await assertAdmin();
  } catch {
    return { ok: false as const, error: "غير مصرّح" };
  }

  const parsed = planUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.errors[0]?.message ?? "بيانات الخطة غير صالحة",
    };
  }
  const data = parsed.data;
  const itemKeys = data.items.map(keyOf);
  const itemKeySet = new Set(itemKeys);
  if (itemKeySet.size !== itemKeys.length) {
    return { ok: false as const, error: "الخطة تحتوي قطعة مكررة" };
  }

  try {
    const company = data.companyId
      ? await prisma.company.findUnique({ where: { id: data.companyId } })
      : await prisma.company.findUnique({ where: { name: data.companyName! } });
    if (!company) return { ok: false as const, error: "الشركة غير موجودة" };
    const companyId = company.id;

    const tasks = await prisma.task.findMany({
      where: {
        companyId,
        year: data.year,
        month: data.month,
        isAuto: true,
        status: { not: "CANCELED" },
        pieceNo: { not: null },
      },
      select: { id: true, type: true, pieceNo: true, stage: true },
    });
    const taskKeys = new Set(tasks.map((task) => keyOf({ type: task.type ?? "", pieceNo: task.pieceNo! })));
    const missing = [...new Set(itemKeys.filter((key) => !taskKeys.has(key)))];
    if (missing.length > 0) {
      return {
        ok: false as const,
        error: `قطع غير موجودة في دورة ${company.name}: ${missing.join("، ")}`,
      };
    }

    if (data.requireComplete) {
      const undescribed = [...taskKeys].filter((key) => !itemKeySet.has(key));
      if (undescribed.length > 0) {
        return {
          ok: false as const,
          error: `الخطة ناقصة؛ بلا وصف: ${undescribed.join("، ")}`,
        };
      }
    }

    if (data.prepareOn) {
      const missingDesign = data.prepareOn.items
        .map(keyOf)
        .filter(
          (key) =>
            !tasks.some(
              (task) =>
                keyOf({ type: task.type ?? "", pieceNo: task.pieceNo! }) === key &&
                task.stage === "DESIGN",
            ),
        );
      if (missingDesign.length > 0) {
        return {
          ok: false as const,
          error: `لا يوجد كرت تصميم للقطع: ${missingDesign.join("، ")}`,
        };
      }
    }

    if (data.publishOn) {
      const publishKey = keyOf(data.publishOn.item);
      const hasPublish = tasks.some(
        (task) =>
          keyOf({ type: task.type ?? "", pieceNo: task.pieceNo! }) === publishKey &&
          task.stage === "PUBLISH",
      );
      if (!hasPublish) {
        return { ok: false as const, error: `لا يوجد كرت نشر للقطعة ${publishKey}` };
      }
    }

    const writes = data.items.map((item) =>
      prisma.task.updateMany({
        where: {
          companyId,
          year: data.year,
          month: data.month,
          isAuto: true,
          status: { not: "CANCELED" },
          type: item.type,
          pieceNo: item.pieceNo,
        },
        data: { brief: item.brief },
      }),
    );

    if (data.prepareOn) {
      const date = fromISODate(data.prepareOn.date);
      for (const item of data.prepareOn.items) {
        writes.push(
          prisma.task.updateMany({
            where: {
              companyId,
              year: data.year,
              month: data.month,
              isAuto: true,
              status: { not: "CANCELED" },
              type: item.type,
              pieceNo: item.pieceNo,
              stage: "DESIGN",
            },
            data: { workDate: date, manualDay: date, isPinned: true },
          }),
        );
      }
    }

    if (data.publishOn) {
      const date = fromISODate(data.publishOn.date);
      writes.push(
        prisma.task.updateMany({
          where: {
            companyId,
            year: data.year,
            month: data.month,
            isAuto: true,
            status: { not: "CANCELED" },
            type: data.publishOn.item.type,
            pieceNo: data.publishOn.item.pieceNo,
            stage: "PUBLISH",
          },
          data: { publishDate: date, workDate: date, isPinned: true },
        }),
      );
    }

    const results = await prisma.$transaction(writes);
    revalidatePath("/", "layout");
    return {
      ok: true as const,
      company: company.name,
      describedPieces: data.items.length,
      affectedRows: results.reduce((sum, result) => sum + result.count, 0),
    };
  } catch {
    return { ok: false as const, error: "فشل تطبيق خطة المحتوى" };
  }
}
