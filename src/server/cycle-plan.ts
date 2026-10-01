/**
 * قراءة عدد القطع الموجود بدلاء الدورات المثبّتة — شوف `lib/cycle-plan.ts`.
 *
 * بلا `"use server"` عن قصد: بتنادى من المحرّك ومن صفحات الخادم، مو من المتصفح.
 */
import { prisma } from "@/lib/db";
import { hasLaterCycle, pieceCountsOf, type PlanCounts } from "@/lib/cycle-plan";
import type { ContractCompany } from "@/lib/contract";

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
