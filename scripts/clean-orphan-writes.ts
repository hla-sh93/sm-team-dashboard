/**
 * Remove legacy orphan WRITE cards (ids `w_c_*`) — pre-contract-cycle duplicates
 * of the engine's per-cycle write cards. They are `isAuto=false`, so neither the
 * non-destructive seed nor إعادة الجدولة ever clears them, leaving a phantom,
 * mis-dated "كتابة/سيناريو تصوير" card (e.g. المول الصيني تسليم 29 حزيران) that
 * duplicates the correct cycle-aligned card and shows up as falsely "late".
 *
 * Safe & idempotent — run it against local SQLite OR production Postgres by
 * pointing DATABASE_URL at the target:
 *   npm run db:clean-orphans          # local (SQLite)
 *   npm run db:clean-orphans:prod     # production (generates the Postgres client)
 *
 * Nothing depends on these cards (blockedById links are re-pointed to the engine
 * write cards on regenerate), but any stray reference is nulled first for safety.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const orphans = await prisma.task.findMany({
    where: { id: { startsWith: "w_c_" } },
    select: { id: true, title: true },
  });

  if (orphans.length === 0) {
    console.log("✓ no orphan write cards found — already clean");
    return;
  }

  const ids = orphans.map((o) => o.id);
  const nulled = await prisma.task.updateMany({
    where: { blockedById: { in: ids } },
    data: { blockedById: null },
  });
  const deleted = await prisma.task.deleteMany({ where: { id: { in: ids } } });

  console.log(`🧹 removed ${deleted.count} orphan write card(s); nulled ${nulled.count} blockedById reference(s)`);
  for (const o of orphans) console.log(`   - ${o.id} · ${o.title ?? ""}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
