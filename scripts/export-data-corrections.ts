/**
 * تصدير حقيقة الداتا المحلية → `backups/data-corrections.json` (بالمستودع).
 *
 * المشكلة اللي بيحلها: البوت ما بيشوف قبل 1/8، فكل تاريخ تموز/حزيران — نصوص
 * الخطط، إقفالات الأدلة، الكريدتات، الملاحظات — انبنى **محلياً** من تصدير
 * تلغرام وملفات الخطط وإفادات القائدة. اللقطة الكاملة مجمّدة عمداً (استيرادها
 * مدمّر)، فهاد التصدير هو القناة: **وقائع** معنونة بهوية القطعة، بيطبّقها
 * `apply-data-corrections.ts` على الإنتاج بسياسة «تقدّم-فقط» — ما بيرجّع كرت،
 * وما بيكتب فوق نص موجود، وما بينقل كرت مثبّت.
 *
 *   npx tsx scripts/export-data-corrections.ts        # بيكتب الملف
 *
 * شغّله بعد أي جولة مطابقة محلية، وكمّت الملف — البناء الجاي بيوصّله.
 */
import { writeFileSync } from "fs";
import { PrismaClient } from "@prisma/client";
import { isTaskDoneState } from "../src/lib/constants";

const prisma = new PrismaClient();

/** هوية قطعة مستقرة عبر القواعد: الشركة بالاسم (فريد)، والكرت بمكانه بالخطة. */
export type PieceFact = {
  company: string;
  year: number;
  month: number; // 0-based
  stage: string;
  /** null لكروت الكتابة — وقتها العنوان جزء من الهوية. */
  type: string | null;
  pieceNo: number | null;
  title: string | null;
  // الوقائع — كلها اختيارية، والاستيراد بيطبّق يلي بيقدر عليه بلا تراجع.
  done: boolean;
  publish: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  notes: string | null;
  brief: string | null;
  assigneeId: string | null;
  pinned: boolean;
  quantity: number | null;
};

export type AdhocFact = {
  id: string; // معرّف حتمي — الإنشاء إذا ناقص، وبس
  company: string | null;
  title: string;
  stage: string | null;
  hours: number;
  assigneeId: string | null;
  status: string;
  board: string;
  workDate: string | null;
  readyDate: string | null;
  publishDate: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  notes: string | null;
  brief: string | null;
  month: number;
  year: number;
};

const iso = (d: Date | null) => (d ? d.toISOString() : null);

async function main() {
  const companies = await prisma.company.findMany();
  const coName = new Map(companies.map((c) => [c.id, c.name]));

  // ── القطع: كل كرت آلي معه معلومة ما بيقدر المحرّك يولّدها ──
  const tasks = await prisma.task.findMany({
    where: { isAuto: true, status: { not: "CANCELED" }, companyId: { not: null } },
  });
  const pieces: PieceFact[] = [];
  for (const t of tasks) {
    const done = isTaskDoneState(t);
    const hasFacts = done || t.notes?.trim() || t.brief?.trim() || t.isPinned;
    if (!hasFacts) continue;
    pieces.push({
      company: coName.get(t.companyId!)!,
      year: t.year,
      month: t.month,
      stage: t.stage ?? "",
      type: t.type,
      pieceNo: t.pieceNo,
      title: t.pieceNo == null ? (t.title ?? null) : null,
      done,
      publish: t.status === "PUBLISHED",
      startedAt: iso(t.startedAt),
      finishedAt: iso(t.finishedAt),
      notes: t.notes?.trim() || null,
      brief: t.brief?.trim() || null,
      assigneeId: t.isPinned ? t.assigneeId : null,
      pinned: t.isPinned,
      quantity: t.quantity !== 1 ? t.quantity : null,
    });
  }

  // ── الإضافية: يدوية بمعرّفات حتمية — بتنخلق عالإنتاج إذا ناقصة ──
  const adhocRows = await prisma.task.findMany({
    where: { isAuto: false, status: { not: "CANCELED" } },
  });
  const adhoc: AdhocFact[] = adhocRows.map((t) => ({
    id: t.id,
    company: t.companyId ? (coName.get(t.companyId) ?? null) : null,
    title: t.title ?? "",
    stage: t.stage,
    hours: t.hours,
    assigneeId: t.assigneeId,
    status: t.status,
    board: t.board,
    workDate: iso(t.workDate),
    readyDate: iso(t.readyDate),
    publishDate: iso(t.publishDate),
    startedAt: iso(t.startedAt),
    finishedAt: iso(t.finishedAt),
    notes: t.notes?.trim() || null,
    brief: t.brief?.trim() || null,
    month: t.month,
    year: t.year,
  }));

  const out = {
    exportedAt: new Date().toISOString(),
    note: "وقائع الداتا المحلية — بتنطبّق بالإنتاج بسياسة تقدّم-فقط (apply-data-corrections.ts)",
    pieces,
    adhoc,
  };
  writeFileSync("backups/data-corrections.json", JSON.stringify(out, null, 1), "utf8");
  console.log(`انكتب backups/data-corrections.json — ${pieces.length} واقعة قطعة · ${adhoc.length} كرت إضافي`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
