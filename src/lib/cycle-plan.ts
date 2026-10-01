/**
 * عدد قطع الدورة — السجلّ لآخر دورة مسجَّلة، والدورات الأقدم بتحتفظ بعددها.
 *
 * عدد القطع (بوست/ريل/ريل AI/ستوري) حقل واحد بسجلّ الشركة، والمحرّك كان يقرأه
 * لأي دلو بينعاد توليده. فلما القائدة عدّلت عدد بوستات BW لخطة تشرين الأول
 * (١/١٠/٢٠٢٦: «عدّلت على عدد بوستات BW وفونيتيك لهذا الشهر») ودورة أيلول لسا
 * شغّالة حتى ٩/١٠، أي إعادة جدولة لدلو أيلول — وهي بتصير مع كل تعديل كرت — كانت
 * رح تزرع بوستات تشرين الزائدة جوّا دورة أيلول.
 *
 * القاعدة: رقم السجلّ هو خطة **آخر دورة مسجَّلة** (ويلي بعدها). الدورة يلي
 * انسجّلت بعدها دورة صارت خطتها مثبّتة بكروتها الموجودة — ما بتكبر ولا بتصغر
 * بتعديل السجلّ.
 */
import { cycleForBucket, cyclesOf, type ContractCompany } from "./contract";

export type PlanCounts = { posts: number; reels: number; aiReels: number; stories: number };

const FIELD_OF: Record<string, keyof PlanCounts> = {
  POST: "posts",
  REEL: "reels",
  AI_REEL: "aiReels",
  STORY: "stories",
};

export const planTotal = (c: PlanCounts) => c.posts + c.reels + c.aiReels + c.stories;

/** هل انسجّلت دورة بعد دورة هالدلو؟ (شركة على شهر التقويم ما إلها دورات → لا.) */
export function hasLaterCycle(co: ContractCompany, year: number, month: number): boolean {
  const cycle = cycleForBucket(co, year, month);
  if (!cycle) return false;
  return cyclesOf(co).some((c) => c.start.getTime() > cycle.start.getTime());
}

type PieceCard = {
  type: string | null;
  pieceNo?: number | null;
  pipelineKey?: string | null;
};

/** عدد القطع الفعلي من كروت دلو — القطعة الواحدة إلها عدة كروت (تصميم، نشر…). */
export function pieceCountsOf(cards: PieceCard[]): PlanCounts {
  const seen: Record<keyof PlanCounts, Set<string>> = {
    posts: new Set(),
    reels: new Set(),
    aiReels: new Set(),
    stories: new Set(),
  };
  for (const card of cards) {
    const field = card.type ? FIELD_OF[card.type] : undefined;
    if (!field) continue;
    const id = card.pieceNo != null ? `#${card.pieceNo}` : card.pipelineKey;
    if (id) seen[field].add(id);
  }
  return {
    posts: seen.posts.size,
    reels: seen.reels.size,
    aiReels: seen.aiReels.size,
    stories: seen.stories.size,
  };
}

/**
 * خطة دلو: السجلّ، إلا لو الدورة مثبّتة (بعدها دورة مسجَّلة) وإلها كروت —
 * وقتها عددها هو عدد قطعها الموجودة. دلو بلا كروت بيتبني من السجلّ.
 */
export function planCountsForBucket(
  co: ContractCompany & PlanCounts,
  year: number,
  month: number,
  existing: PlanCounts | null | undefined,
): PlanCounts {
  const record = { posts: co.posts, reels: co.reels, aiReels: co.aiReels, stories: co.stories };
  if (!existing || planTotal(existing) === 0) return record;
  return hasLaterCycle(co, year, month) ? existing : record;
}
