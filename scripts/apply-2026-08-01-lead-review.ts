/**
 * Corrections from the lead's review of the backlog, 2026-08-01.
 *
 * Idempotent — safe to re-run.
 */
import { PrismaClient } from "@prisma/client";
import { isTaskDoneState } from "../src/lib/constants";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const log: string[] = [];

/** Close a set of cards as finished, pinned so regeneration keeps them. */
async function closeTasks(ids: string[], at: Date, publishToo = true) {
  if (!APPLY || !ids.length) return;
  for (const id of ids) {
    const t = await prisma.task.findUnique({ where: { id } });
    if (!t || isTaskDoneState(t)) continue;
    await prisma.task.update({
      where: { id },
      data: {
        status: t.stage === "PUBLISH" && publishToo ? "PUBLISHED" : "READY",
        board: "DONE",
        startedAt: t.startedAt ?? at,
        finishedAt: at,
        completedAt: t.completedAt ?? at,
        isPinned: true,
      },
    });
  }
}

async function main() {
  const co = async (name: string) =>
    prisma.company.findFirst({ where: { name: { contains: name } } });

  // ---- 1. المول الصيني — the plan finished and was not renewed -------------
  // Everything it ever generated is done; nothing is owed. Leaving cards open
  // kept 21 phantom publish delays on a contract that no longer exists.
  const mall = await co("المول");
  if (mall) {
    const open = await prisma.task.findMany({
      where: { companyId: mall.id, status: { not: "CANCELED" } },
    });
    const ids = open.filter((t) => !isTaskDoneState(t)).map((t) => t.id);
    await closeTasks(ids, new Date(2026, 6, 19)); // its cycle ended 19 July
    log.push(`المول الصيني: ${ids.length} كرت أُغلق — الخطة خالصة والعقد ما تجدد`);
  }

  // ---- 2. برو — everything before the 18 July renewal is delivered ---------
  // The team is now working the new cycle (18/7 → 18/8); the previous cycle is
  // finished and closed.
  const bru = await co("برو");
  if (bru) {
    const cutoff = new Date(2026, 6, 18);
    const open = await prisma.task.findMany({
      where: { companyId: bru.id, status: { not: "CANCELED" } },
    });
    const ids = open
      .filter((t) => !isTaskDoneState(t))
      .filter((t) => {
        const d = t.readyDate ?? t.publishDate ?? t.workDate;
        return d != null && d < cutoff;
      })
      .map((t) => t.id);
    await closeTasks(ids, new Date(2026, 6, 17));
    log.push(`برو: ${ids.length} كرت من الدورة السابقة أُغلق (كل شي قبل 18/7)`);
  }

  // ---- 3. وصل — the post templates were the first thing أيمن built ---------
  const wasl = await co("وصل");
  if (wasl) {
    const tpl = await prisma.task.findMany({
      where: { companyId: wasl.id, title: { contains: "تيمبليت" }, status: { not: "CANCELED" } },
    });
    const ids = tpl.filter((t) => !isTaskDoneState(t)).map((t) => t.id);
    await closeTasks(ids, new Date(2026, 6, 15));
    if (ids.length) log.push(`وصل: تيمبليت نماذج البوستات أُغلق (${ids.length})`);
  }

  // ---- 4. نوال's writing — production proves the plan was written ----------
  // A cycle cannot have produced pieces unless its plan was written first, so a
  // WRITE card sitting open while its own cycle has finished work is simply a
  // card nobody remembered to move. This is the rule that was missing: closing
  // production without closing the writing that precedes it.
  const writes = await prisma.task.findMany({
    where: { stage: "WRITE", status: { not: "CANCELED" } },
  });
  const closedWrites: string[] = [];
  for (const w of writes) {
    if (isTaskDoneState(w) || !w.companyId) continue;
    const siblings = await prisma.task.findMany({
      where: {
        companyId: w.companyId,
        year: w.year,
        month: w.month,
        stage: { in: ["DESIGN", "SHOOT"] },
        status: { not: "CANCELED" },
      },
    });
    const produced = siblings.filter((s) => isTaskDoneState(s));
    if (!produced.length) continue;
    // Date it just before the earliest piece it made possible.
    const first = produced
      .map((s) => s.finishedAt ?? s.completedAt)
      .filter((d): d is Date => d != null)
      .sort((a, b) => a.getTime() - b.getTime())[0];
    const at = first ? new Date(first.getTime() - 86400000) : new Date();
    await closeTasks([w.id], at, false);
    closedWrites.push(w.id);
  }
  if (closedWrites.length)
    log.push(`نوال: ${closedWrites.length} كرت كتابة أُغلق — دوراتها فيها إنتاج خالص`);

  console.log(log.length ? log.join("\n") : "لا تغييرات.");
  if (!APPLY) console.log("\nتشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
