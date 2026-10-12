/**
 * قراءة عدد القطع الموجود بدلاء الدورات المثبّتة — شوف `lib/cycle-plan.ts`.
 *
 * بلا `"use server"` عن قصد: بتنادى من المحرّك ومن صفحات الخادم، مو من المتصفح.
 */
import { prisma } from "@/lib/db";
import { hasLaterCycle, pieceCountsOf, type PlanCounts } from "@/lib/cycle-plan";
import { cycleForBucket, type ContractCompany } from "@/lib/contract";

type Bucket = { companyId: string; year: number; month: number };

export const bucketKey = (b: Bucket) => `${b.companyId}|${b.year}|${b.month}`;

/**
 * عدد القطع المولَّدة الموجود لكل (شركة، دلو). الملغى محسوب: الكرت المحذوف
 * بيضل ملغى ومثبّتاً، وقطعته جزء من خطة الدورة يلي انولّدت عليها.
 */
export async function existingPieceCounts(buckets: Bucket[]): Promise<Map<string, PlanCounts>> {
  const out = new Map<string, PlanCounts>();
  if (buckets.length === 0) return out;
  const rows = await prisma.task.findMany({
    where: {
      isAuto: true,
      type: { not: null },
      OR: buckets.map((b) => ({ companyId: b.companyId, year: b.year, month: b.month })),
    },
    select: { companyId: true, year: true, month: true, type: true, pieceNo: true, pipelineKey: true },
  });
  const grouped = new Map<string, typeof rows>();
  for (const row of rows) {
    if (!row.companyId) continue;
    const key = bucketKey({ companyId: row.companyId, year: row.year, month: row.month });
    const list = grouped.get(key);
    if (list) list.push(row);
    else grouped.set(key, [row]);
  }
  for (const [key, list] of grouped) out.set(key, pieceCountsOf(list));
  return out;
}

/**
 * عدد القطع المثبّت للشركات يلي دورة هالدلو عندها صار بعدها دورة مسجَّلة.
 * الشركة يلي مو بالنتيجة خطتها من السجلّ.
 */
export async function frozenPlanCounts<C extends ContractCompany & { id: string }>(
  companies: C[],
  bucketOf: (co: C) => { year: number; month: number },
): Promise<Map<string, PlanCounts>> {
  const buckets = companies
    .map((co) => ({ companyId: co.id, ...bucketOf(co) }))
    .filter((b, i) => hasLaterCycle(companies[i], b.year, b.month));
  const counts = await existingPieceCounts(buckets);
  const out = new Map<string, PlanCounts>();
  for (const b of buckets) {
    const found = counts.get(bucketKey(b));
    if (found) out.set(b.companyId, found);
  }
  return out;
}

const PLAN_FIELDS = ["posts", "reels", "aiReels", "stories"] as const;
type PlanField = (typeof PLAN_FIELDS)[number];
const TYPE_OF_FIELD: Record<PlanField, string> = {
  posts: "POST",
  reels: "REEL",
  aiReels: "AI_REEL",
  stories: "STORY",
};
export const PLAN_FIELD_LABEL: Record<PlanField, string> = {
  posts: "البوستات",
  reels: "الريلات",
  aiReels: "ريلات AI",
  stories: "الستوريات",
};

/** قطعة «عليها شغل أو وصف» — بداية، إنجاز، أو نصّ خطة. الملغاة مو منها. */
export function pieceHasWorkOrBrief(t: {
  status: string;
  board: string | null;
  brief?: string | null;
}): boolean {
  if (t.status === "CANCELED") return false;
  return t.status !== "NOT_STARTED" || (t.board ?? "TODO") !== "TODO" || Boolean(t.brief?.trim());
}

/**
 * WORK_RULES §٩ — تقليل عدد قطع الدورة **مرفوض** لو القطع يلي رح تنشال (أعلى من
 * العدد الجديد) عليها شغل أو وصف. كانت مطبَّقة بحمولة `planCounts` بس؛ نموذج
 * الشركة كان يكتب العدد بلا فحص، وأول إعادة توليد بالدلو كانت تمحي القطعة المنجزة
 * ووصفها (فحص ١٢/١٠، RG-02). القطعة الملغاة ما بتمنع (PU-15).
 *
 * الدلاء المعنية = دلاء الشركة يلي خطتها من السجلّ: إلها دورة وما انسجّلت بعدها
 * دورة (الدورات الأقدم مثبّتة بكروتها — `lib/cycle-plan.ts`).
 *
 * بيرجّع رسالة الرفض، أو null لما التقليل آمن.
 */
export async function planReductionBlocker(
  company: ContractCompany & { id: string } & Record<PlanField, number>,
  next: Partial<Record<PlanField, number>>,
  only?: { year: number; month: number },
): Promise<string | null> {
  const lowered = PLAN_FIELDS.filter((f) => next[f] != null && next[f]! < company[f]);
  if (lowered.length === 0) return null;
  const buckets = only
    ? [only]
    : (
        await prisma.task.findMany({
          where: { companyId: company.id, isAuto: true },
          distinct: ["year", "month"],
          select: { year: true, month: true },
        })
      ).filter((b) => cycleForBucket(company, b.year, b.month) && !hasLaterCycle(company, b.year, b.month));
  for (const b of buckets) {
    for (const field of lowered) {
      const dropped = await prisma.task.findMany({
        where: {
          companyId: company.id,
          year: b.year,
          month: b.month,
          isAuto: true,
          type: TYPE_OF_FIELD[field],
          pieceNo: { gt: next[field]! },
        },
        select: { status: true, board: true, brief: true },
      });
      if (dropped.some(pieceHasWorkOrBrief)) {
        return `تقليل ${PLAN_FIELD_LABEL[field]} إلى ${next[field]} يحذف قطعاً عليها شغل أو وصف — عالجي كروتها أولاً`;
      }
    }
  }
  return null;
}
