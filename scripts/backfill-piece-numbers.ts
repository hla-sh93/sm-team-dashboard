/**
 * Backfill stable piece numbers (`Task.pieceNo`) for EXISTING content rows.
 *
 * New generations assign the number in expandPipeline, but rows created before
 * the column existed have pieceNo = null, so views fall back to computing the
 * number from whatever subset they loaded — which renumbers a June-cycle
 * ستوري-6 as "ستوري-1" once its published siblings are archived out of the
 * live board.
 *
 * Numbering matches what the team saw on the boards: per (year, month,
 * companyId, type), pieces (pipelineKey) ordered by earliest publishDate then
 * key, CANCELED excluded (deleted pieces never appeared in the numbering).
 *
 * Safe & idempotent — only rows with pieceNo IS NULL are touched; run against
 * local SQLite OR production Postgres by pointing DATABASE_URL at the target:
 *   npm run db:backfill-numbers          # local (SQLite)
 *   npm run db:backfill-numbers:prod     # production (generates the Postgres client)
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.task.findMany({
    where: {
      pieceNo: null,
      type: { in: ["POST", "STORY", "REEL", "AI_REEL"] },
      status: { not: "CANCELED" },
      stage: { in: ["DESIGN", "SHOOT", "PUBLISH"] },
    },
    select: {
      id: true,
      year: true,
      month: true,
      companyId: true,
      type: true,
      pipelineKey: true,
      publishDate: true,
    },
  });

  if (rows.length === 0) {
    console.log("✓ no unnumbered content pieces — already backfilled");
    return;
  }

  // Group per (bucket, company, type); pieces keyed by pipelineKey (fallback id).
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = `${r.year}|${r.month}|${r.companyId}|${r.type}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }

  let updated = 0;
  for (const arr of groups.values()) {
    const minPub = new Map<string, number>();
    for (const r of arr) {
      const key = r.pipelineKey ?? r.id;
      const pd = r.publishDate ? r.publishDate.getTime() : Number.MAX_SAFE_INTEGER;
      if (!minPub.has(key) || pd < minPub.get(key)!) minPub.set(key, pd);
    }
    const order = [...minPub.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
    const numOf = new Map<string, number>();
    order.forEach(([key], i) => numOf.set(key, i + 1));

    for (const r of arr) {
      const n = numOf.get(r.pipelineKey ?? r.id)!;
      await prisma.task.update({ where: { id: r.id }, data: { pieceNo: n } });
      updated++;
    }
  }

  console.log(`✓ backfilled pieceNo on ${updated} task row(s) across ${groups.size} (cycle, company, type) group(s)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
