/**
 * استرجاع حالات الإنجاز اللي ضاعت بإعادة توليد قبل إصلاح الحفظ.
 *
 * نقل ملكية الشركات (rebalance-designers) أعاد توقيت كل الكروت، ومفتاحا الحفظ
 * وقتها كانا مبنيين على تاريخ النشر — فانكسروا وضاع معهن **البريف وحالة
 * الإنجاز**. البريف انسترجع بإعادة استيراد الخطط؛ حالة الإنجاز مصدرها الوحيد
 * سناب‌شوت ما قبل العملية.
 *
 * المطابقة بهوية القطعة (شركة | نوع | رقم القطعة | دورة | مرحلة) — نفس المفتاح
 * اللي صار الحفظ يعتمد عليه، فما بيتأثر بإعادة التوقيت.
 *
 *   npx tsx scripts/restore-done-states.ts <snapshot.json> [--apply]
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { isTaskDoneState } from "../src/lib/constants";

const prisma = new PrismaClient();
const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const SNAP = argv.find((a) => !a.startsWith("--"));

type Row = {
  companyId: string | null; type: string | null; pieceNo: number | null;
  year: number; month: number; stage: string | null; kind: string;
  status: string; board: string;
  startedAt: string | null; finishedAt: string | null; completedAt: string | null;
  assigneeId: string | null; isPinned: boolean;
};
const key = (t: Row) => `${t.companyId}|${t.type}|${t.pieceNo}|${t.year}-${t.month}|${t.stage}`;
const D = (s: string | null) => (s ? new Date(s) : null);

async function main() {
  if (!SNAP) { console.error("الاستعمال: npx tsx scripts/restore-done-states.ts <snapshot.json> [--apply]"); process.exit(1); }
  const snap = JSON.parse(readFileSync(SNAP, "utf8")) as { tasks: Row[] };
  const wasDone = snap.tasks.filter((t) => t.kind === "CONTENT" && t.pieceNo != null && isTaskDoneState(t as never));
  console.log(`النسخة القديمة: ${wasDone.length} قطعة منجزة\n`);

  const byKey = new Map<string, Row>();
  for (const t of wasDone) if (!byKey.has(key(t))) byKey.set(key(t), t);

  const current = await prisma.task.findMany({ where: { kind: "CONTENT", status: { not: "CANCELED" } } });
  const companies = new Map((await prisma.company.findMany()).map((c) => [c.id, c.name]));
  let restored = 0, already = 0, missing = 0;
  const perCo = new Map<string, number>();

  for (const t of current) {
    if (t.pieceNo == null) continue;
    const old = byKey.get(key(t as never));
    if (!old) continue;
    if (isTaskDoneState(t)) { already++; continue; }
    restored++;
    const co = companies.get(t.companyId ?? "") ?? "—";
    perCo.set(co, (perCo.get(co) ?? 0) + 1);
    if (!APPLY) continue;
    await prisma.task.update({
      where: { id: t.id },
      data: {
        status: old.status, board: old.board,
        startedAt: D(old.startedAt), finishedAt: D(old.finishedAt), completedAt: D(old.completedAt),
        // الكريدت يرجع لصاحبه الأصلي — «المهمة باسم الشخص يلي عملها».
        ...(old.assigneeId ? { assigneeId: old.assigneeId } : {}),
        isPinned: true, // مثبّتة حتى ما تضيع تاني
      },
    });
  }

  for (const [k, mBy] of [...byKey.entries()]) {
    if (!current.some((t) => t.pieceNo != null && key(t as never) === k)) missing++;
    void mBy;
  }

  console.log(`${APPLY ? "استُرجع" : "رح يُسترجع"} ${restored} قطعة · ${already} كانت سليمة · ${missing} ما لقيت كرت مقابل`);
  for (const [co, n] of [...perCo.entries()].sort((a, b) => b[1] - a[1])) console.log(`   ${co}: ${n}`);
  if (!APPLY) console.log("\nتشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
