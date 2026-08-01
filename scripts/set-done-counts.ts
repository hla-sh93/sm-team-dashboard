/**
 * ضبط عدد القطع المنجزة لـ(شركة، نوع) على رقم بالضبط.
 *
 * قاعدة القائدة (1/8/2026): **بالستوري مو مهم الترتيب، المهم الكمية.** الستوري
 * قطع متكافئة — ما بينفع نضيّع وقت نحدد أي ملف هو ستوري رقم كم. نفس الشي بينطبق
 * على أي نوع ما إلو بريف مرقّم. لهيك الأداة بتاخد رقم وبتسكّر الأقدم أولاً.
 *
 *   npx tsx scripts/set-done-counts.ts أغاليا STORY=6 POST=9 [--apply]
 */
import { PrismaClient } from "@prisma/client";
import { isTaskDoneState } from "../src/lib/constants";

const prisma = new PrismaClient();
const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const [companyArg, ...pairs] = argv.filter((a) => !a.startsWith("--"));

async function setDoneCount(companyId: string, type: string, want: number, at: Date) {
  const cards = await prisma.task.findMany({
    where: { companyId, kind: "CONTENT", type, stage: { in: ["DESIGN", "SHOOT"] }, status: { not: "CANCELED" } },
    orderBy: [{ publishDate: "asc" }, { pieceNo: "asc" }],
  });
  const done = cards.filter((c) => isTaskDoneState(c));
  const open = cards.filter((c) => !isTaskDoneState(c));
  if (done.length === want) return `= ${type} ${want}/${cards.length}`;

  if (done.length < want) {
    const toClose = open.slice(0, want - done.length);
    if (APPLY)
      for (const c of toClose) {
        // البداية ما بتنفع تكون بعد النهاية — ناخد الأبكر بين الاتنين.
        const startedAt = c.startedAt && c.startedAt < at ? c.startedAt : at;
        await prisma.task.update({
          where: { id: c.id },
          data: { status: "READY", board: "DONE", startedAt, finishedAt: at, completedAt: at, isPinned: true },
        });
      }
    return `↑ ${type} ${done.length} → ${done.length + toClose.length} من ${cards.length}`;
  }

  const toOpen = done.slice(want);
  if (APPLY)
    for (const c of toOpen) {
      await prisma.task.update({
        where: { id: c.id },
        data: { status: "NOT_STARTED", board: "TODO", startedAt: null, finishedAt: null, completedAt: null },
      });
      if (c.pipelineKey)
        await prisma.task.updateMany({
          where: { pipelineKey: c.pipelineKey, stage: "PUBLISH", status: { not: "CANCELED" } },
          data: { status: "NOT_STARTED", board: "TODO", startedAt: null, finishedAt: null, completedAt: null },
        });
    }
  return `↓ ${type} ${done.length} → ${want} من ${cards.length}`;
}

async function main() {
  if (!companyArg || !pairs.length) {
    console.error('الاستعمال: npx tsx scripts/set-done-counts.ts <شركة> TYPE=N [TYPE=N …] [--apply]');
    process.exit(1);
  }
  const co = await prisma.company.findFirst({ where: { name: { contains: companyArg } } });
  if (!co) { console.error(`ما لقيت شركة «${companyArg}»`); process.exit(1); }

  const at = new Date(2026, 7, 1);
  const out: string[] = [];
  for (const p of pairs) {
    const [type, n] = p.split("=");
    const want = Number(n);
    if (!type || Number.isNaN(want)) { console.error(`صيغة غلط: ${p}`); process.exit(1); }
    out.push(await setDoneCount(co.id, type.toUpperCase(), want, at));
  }
  console.log(`${co.name}: ${out.join(" · ")}`);
  if (!APPLY) console.log("تشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
