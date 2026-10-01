/**
 * استيراد خطة الشهر من ملف Word — بلا `"use server"` عن قصد (نفس سبب
 * `plan-update.ts`: كل تصدير من ملف `"use server"` بيصير نقطة نهاية عامة).
 *
 * القائدة (١٨/٩): «نوال تحمّل القالب، تعبّيه، ترفعه — وبيطلع الكرت مهمة نوال
 * تسكر، ضروري تحسبه على الانجاز. وبعدها تقدر تولّد كروت الفريق».
 *
 * **تصحيح مهم بالسلسلة:** كروت الفريق مولّدة أصلاً من بداية الدورة، بس محجوزة
 * وراء كرت الكتابة (قاعدة «الخطة أول مرحلة»). فالرفع ما بيولّد شي — بينزّل
 * النصوص وبيسكّر كرت نوال، والحجز بينفكّ لحاله فتطلع الكروت بمهام اليوم.
 *
 * والكتابة كلها بتمرق من `applyPlanUpdatePayload`: نفس التحقّق، نفس شرط
 * كل-أو-لا-شي، نفس سطر الدليل. الملف بيتحوّل لحمولة وبس.
 */
import JSZip from "jszip";
import { prisma } from "@/lib/db";
import { DONE_STATUSES } from "@/lib/constants";
import { currentCycleBucket, cycleForBucket } from "@/lib/contract";
import { toISODate } from "@/lib/dates";
import {
  extractDocxBlocks,
  parsePlanDocument,
  piecesToPayloadItems,
  summarisePieces,
  PIECE_TYPE_LABEL,
  type PieceType,
  type PlanDocxPiece,
} from "@/lib/plan-docx";
import { applyPlanUpdatePayload } from "@/server/plan-update";
import { frozenPlanCounts } from "@/server/cycle-plan";

/** نطاق الكتابة يلي بيغطّيه كل نوع — نفس تقسيم `pipeline.ts`. */
const SCOPE_OF = (type: PieceType): "DESIGN" | "SHOOT" => (type === "REEL" ? "SHOOT" : "DESIGN");
const SCOPE_LABEL: Record<"DESIGN" | "SHOOT", string> = {
  DESIGN: "كتابة بوستات وستوريز",
  SHOOT: "سيناريو تصوير",
};

export type PlanDocxCount = { type: PieceType; label: string; inFile: number; inContract: number };

export type PlanDocxPreview = {
  ok: true;
  company: string;
  companyId: string;
  cycleLabel: string | null;
  year: number;
  month: number;
  counts: PlanDocxCount[];
  pieces: { type: PieceType; label: string; pieceNo: number; head: string }[];
  /** كروت الكتابة يلي رح تنسكّر، بأسماء أصحابها. */
  writeCards: { id: string; title: string; assignee: string | null; alreadyDone: boolean }[];
  warnings: string[];
};

export type PlanDocxFailure = { ok: false; error: string };

const fail = (error: string): PlanDocxFailure => ({ ok: false, error });

/** أول سطر محتوى بالوصف — للمعاينة. */
function headline(piece: PlanDocxPiece): string {
  const line = piece.brief.split("\n").find((value) => value.trim() && !value.trim().endsWith(":"));
  return (line ?? "").trim().slice(0, 120);
}

async function readDocx(fileBase64: string): Promise<string | null> {
  try {
    const zip = await JSZip.loadAsync(Buffer.from(fileBase64, "base64"));
    const entry = zip.file("word/document.xml");
    return entry ? entry.async("string") : null;
  } catch {
    return null;
  }
}

/**
 * يقرأ الملف ويفرجي شو رح يصير — **بلا أي كتابة**.
 *
 * المعاينة إلزامية بالواجهة: الملف بينزّل نصوصاً على كروت شغل حقيقية، وأي
 * انحراف بالقراءة بينتبّه عليه هون لا بعد النشر.
 */
export async function previewPlanDocx(
  companyId: string,
  fileBase64: string,
): Promise<PlanDocxPreview | PlanDocxFailure> {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return fail("الشركة غير موجودة");
  if (!company.managed) return fail("هذه الشركة تصميم-فقط، ولا دورة محتوى لها");

  // نفس قاعدة تصدير الخطة: بلا تاريخ بدء نشر ما في دورة أصلاً، والكتابة على
  // شركة بلا دورة بتنزّل النصوص بدلو تقويمي ما حدا بيشوفه.
  if (!company.publishStartDate) {
    return fail("لا يوجد تاريخ بدء نشر لهذه الشركة — حدّدي التاريخ أولاً، فبلا دورة لا كروت لها");
  }
  const at = new Date();
  const bucket = currentCycleBucket(company, at);
  if (!bucket) return fail("لا توجد دورة شغّالة لهذه الشركة — حدّثي تاريخ بدء النشر أو التجديد أولاً");
  const cycle = cycleForBucket(company, bucket.year, bucket.month);

  const xml = await readDocx(fileBase64);
  if (!xml) return fail("الملف ليس مستند Word صالحاً (.docx)");

  const parsed = parsePlanDocument(extractDocxBlocks(xml));
  if (!parsed.ok) return fail(parsed.error);

  const found = summarisePieces(parsed.pieces);
  // عدد الدورة يلي الملف نازل عليها: لو انسجّلت بعدها دورة بعدد مختلف، المقارنة
  // مع قطع هالدورة لا مع رقم السجلّ (يلي صار خطة الدورة الجاية).
  const plan = (await frozenPlanCounts([company], () => bucket)).get(company.id) ?? company;
  const contract: Record<PieceType, number> = {
    POST: plan.posts,
    REEL: plan.reels,
    STORY: plan.stories,
    AI_REEL: plan.aiReels,
  };
  const counts: PlanDocxCount[] = (Object.keys(contract) as PieceType[])
    .filter((type) => contract[type] > 0 || found[type] > 0)
    .map((type) => ({
      type,
      label: PIECE_TYPE_LABEL[type],
      inFile: found[type],
      inContract: contract[type],
    }));

  const warnings = [...parsed.warnings];
  for (const row of counts) {
    if (row.inFile < row.inContract)
      warnings.push(`${row.label}: الملف فيه ${row.inFile} والعقد ${row.inContract}`);
    if (row.inFile > row.inContract)
      warnings.push(`${row.label}: الملف فيه ${row.inFile} والعقد ${row.inContract} — الزائد لا كرت له`);
  }

  const scopes = new Set(parsed.pieces.map((piece) => SCOPE_OF(piece.type)));
  const writeRows = await prisma.task.findMany({
    where: {
      companyId,
      year: bucket.year,
      month: bucket.month,
      stage: "WRITE",
      status: { not: "CANCELED" },
    },
    include: { assignee: { select: { name: true } } },
  });
  const writeCards = writeRows
    .filter((task) => {
      const scope = task.pipelineKey?.split("|")[1];
      return scope ? scopes.has(scope as "DESIGN" | "SHOOT") : true;
    })
    .map((task) => ({
      id: task.id,
      title: task.title ?? SCOPE_LABEL[(task.pipelineKey?.split("|")[1] as "DESIGN" | "SHOOT") ?? "DESIGN"],
      assignee: task.assignee?.name ?? null,
      alreadyDone: task.board === "DONE" || DONE_STATUSES.includes(task.status as never),
    }));

  return {
    ok: true,
    company: company.name,
    companyId,
    cycleLabel: cycle ? `${toISODate(cycle.start)} ← ${toISODate(new Date(cycle.end.getTime() - 86_400_000))}` : null,
    year: bucket.year,
    month: bucket.month,
    counts,
    pieces: parsed.pieces.map((piece) => ({
      type: piece.type,
      label: PIECE_TYPE_LABEL[piece.type],
      pieceNo: piece.pieceNo,
      head: headline(piece),
    })),
    writeCards,
    warnings,
  };
}

export type PlanDocxApplyResult = {
  ok: true;
  company: string;
  describedPieces: number;
  closedWriteCards: number;
  warnings: string[];
};

/**
 * يطبّق الملف: النصوص على القطع، وكرت الكتابة بينسكّر بدليل فيه اسم الملف.
 *
 * الإقفال بينعدّ إنجازاً لنوال (قرار القائدة: «ضروري تحسبه على الانجاز»)،
 * فالدليل لازم يقول من وين إجا — الكرت المنجَز بلا أثر هو بالضبط يلي خلّى
 * تسكير ٣/٩ اليدوي غير قابل للمراجعة.
 */
export async function applyPlanDocx(input: {
  companyId: string;
  fileBase64: string;
  fileName: string;
  /** «رفع نوال من الواجهة» أو «ملف تلغرام من نوال» — بينكتب بالدليل. */
  source: string;
  at?: Date;
}): Promise<PlanDocxApplyResult | PlanDocxFailure> {
  const preview = await previewPlanDocx(input.companyId, input.fileBase64);
  if (!preview.ok) return preview;

  const xml = await readDocx(input.fileBase64);
  if (!xml) return fail("الملف ليس مستند Word صالحاً (.docx)");
  const parsed = parsePlanDocument(extractDocxBlocks(xml));
  if (!parsed.ok) return fail(parsed.error);

  const at = input.at ?? new Date();
  const dayLabel = toISODate(at).split("-").reverse().join("/");
  const shortfall = preview.counts
    .filter((row) => row.inFile !== row.inContract)
    .map((row) => `${row.label} ${row.inFile}/${row.inContract}`)
    .join(" · ");
  const evidence =
    `خطة الشهر وصلت كملف Word «${input.fileName}» (${input.source}) بتاريخ ${dayLabel}` +
    (shortfall ? ` — العدد مقابل العقد: ${shortfall}` : "");

  const result = await applyPlanUpdatePayload({
    companyId: input.companyId,
    year: preview.year,
    month: preview.month,
    items: piecesToPayloadItems(parsed.pieces),
  });
  if (!result.ok) return fail(result.error);

  // كرت الكتابة بينسكّر **بعد** نجاح نزول النصوص: الكرت المنجز بلا نصوص كذبة.
  const toClose = preview.writeCards.filter((card) => !card.alreadyDone);
  if (toClose.length) {
    await prisma.$transaction(
      toClose.map((card) =>
        prisma.task.update({
          where: { id: card.id },
          data: {
            status: "READY",
            board: "DONE",
            startedAt: at,
            finishedAt: at,
            completedAt: at,
            isPinned: true,
            notes: evidence,
          },
        }),
      ),
    );
  }

  return {
    ok: true,
    company: preview.company,
    describedPieces: parsed.pieces.length,
    closedWriteCards: toClose.length,
    warnings: preview.warnings,
  };
}
