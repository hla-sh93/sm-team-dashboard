/**
 * استرجاع حالات الإنجاز الضائعة من اللقطة المحفوظة.
 *
 * إعادة التوليد بعد تصحيح تاريخ عقد وصل ضيّعت 13 كرت منجز: مفتاح الجدولة
 * (`pipelineKey` وفيه تاريخ النشر) انزاح، فكرت ورث حالة قطعة تانية. الكود
 * انصلّح (رقم القطعة صار يسبق الجدولة)، وهاد بيرجّع يلي ضاع قبل الإصلاح.
 *
 * بيطابق على **هوية القطعة** (شركة، نوع، رقم، مرحلة) وبيرجّع الحالة والطوابع
 * الزمنية للكروت المفتوحة حالياً بس. ما بيفتح ولا كرت منجز.
 *
 *   npx tsx scripts/restore-done-from-snapshot.ts            # تجريبي
 *   npx tsx scripts/restore-done-from-snapshot.ts --apply
 */
import { PrismaClient } from "@prisma/client";
import { isTaskDoneState } from "../src/lib/constants";
import { readFileSync } from "node:fs";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const wasDone = (t: { status: string; board: string }) =>
  ["READY", "PUBLISHED", "DONE"].includes(t.status) || t.board === "DONE";

async function main() {
  const snap = JSON.parse(readFileSync("backups/local-db-snapshot.json", "utf8"));
  const old: Record<string, string | null>[] = snap.tasks ?? snap.Task ?? [];
  const cos = await prisma.company.findMany();
  const now = await prisma.task.findMany({ where: { status: { not: "CANCELED" } } });
  // الباكت جزء من الهوية: BW عندها «بوست #1» بتموز و«بوست #1» بتشرين٢ — قطعتان
  // مختلفتان. بلا السنة والشهر بالمفتاح، الاسترجاع بيسكّر قطعة الدورة الجاية
  // بحالة قطعة قديمة. (نفس خطأ التصادم يلي انصلّح بـ`pipeline-preservation`.)
  const key = (t: Record<string, unknown>) =>
    `${t.companyId}|${t.type}|${t.pieceNo}|${t.stage}|${t.year}-${t.month}`;
  const byKey = new Map(now.filter((t) => t.pieceNo != null).map((t) => [key(t as never), t]));

  let restored = 0;
  let reverted = 0;
  const perCo = new Map<string, number>();
  const bump = (co: string) => perCo.set(co, (perCo.get(co) ?? 0) + 1);
  const nameOf = (id: string | null | undefined) =>
    cos.find((c) => c.id === id)?.name ?? String(id);

  // اتجاه ١: كرت كان منجز باللقطة وصار مفتوح → رجّع الإنجاز.
  for (const o of old) {
    if (!wasDone(o as never) || o.pieceNo == null || !o.companyId) continue;
    const cur = byKey.get(key(o));
    if (!cur || isTaskDoneState(cur)) continue;
    bump(nameOf(o.companyId));
    restored++;
    console.log(`  ↩ ${nameOf(o.companyId)} · ${o.type} #${o.pieceNo} ${o.stage} ${o.year}-${Number(o.month) + 1} → ${o.status}`);
    if (APPLY)
      await prisma.task.update({
        where: { id: cur.id },
        data: {
          status: String(o.status),
          board: String(o.board),
          startedAt: o.startedAt ? new Date(o.startedAt) : cur.startedAt,
          finishedAt: o.finishedAt ? new Date(o.finishedAt) : new Date(),
          completedAt: o.completedAt ? new Date(o.completedAt) : new Date(),
          isPinned: true,
        },
      });
  }

  // اتجاه ٢: كرت صار منجز وما كان باللقطة → افتحه مرجّعاً حالته الأصلية.
  // مراحل جديدة (المونتاج) ما إلها مقابل باللقطة إطلاقاً — بتنترك بحالها.
  const oldMap = new Map(old.filter((t) => t.pieceNo != null).map((t) => [key(t), t]));
  for (const cur of now) {
    if (cur.pieceNo == null || !isTaskDoneState(cur)) continue;
    const o = oldMap.get(key(cur as never));
    if (!o || wasDone(o as never)) continue;
    bump(nameOf(cur.companyId));
    reverted++;
    console.log(`  ↪ ${nameOf(cur.companyId)} · ${cur.type} #${cur.pieceNo} ${cur.stage} ${cur.year}-${cur.month + 1} → ${o.status} (كان مفتوح)`);
    if (APPLY)
      await prisma.task.update({
        where: { id: cur.id },
        data: {
          status: String(o.status),
          board: String(o.board),
          startedAt: o.startedAt ? new Date(o.startedAt) : null,
          finishedAt: o.finishedAt ? new Date(o.finishedAt) : null,
          completedAt: o.completedAt ? new Date(o.completedAt) : null,
          isPinned: Boolean(o.isPinned),
        },
      });
  }

  console.log(`
↩ ${restored} رجّعت إنجازها · ↪ ${reverted} رجعت مفتوحة`);
  if (perCo.size) console.log(`   ${[...perCo].map(([k, v]) => `${k} ${v}`).join(" · ")}`);
  if (!APPLY) console.log("تشغيل تجريبي — أضف --apply.");
}

main().finally(() => prisma.$disconnect());
