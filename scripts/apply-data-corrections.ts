/**
 * تطبيق وقائع `backups/data-corrections.json` — بسياسة **تقدّم-فقط**.
 *
 * بيمشي بخطوة البناء على الإنتاج (وبلا ضرر محلياً). القواعد الصارمة، لأنّ
 * الفريق بيشتغل على الإنتاج مباشرة وأي كتابة عمياء بتمسح شغلهم:
 *
 *   ١. ولا كرت بيرجع مفتوح — الواقعة بتقفل بس، ما بتفتح.
 *   ٢. النص (وصف/ملاحظة) بينكتب بس عالفاضي؛ الملاحظات بتنضاف بلا تكرار.
 *   ٣. الكريدت بينتقل بس لما يكون كرت الإنتاج مو مثبّت (تثبيت = قرار بشري أحدث).
 *   ٤. كرت مو موجود بينتخطى مع تقرير — ما منخترع كروت آلية؛ الإضافية اليدوية
 *      (معرّفات حتمية) هي الوحيدة اللي بتنخلق.
 *
 *   npx tsx scripts/apply-data-corrections.ts            # تجريبي
 *   npx tsx scripts/apply-data-corrections.ts --apply
 */
import { existsSync, readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";
import { isTaskDoneState } from "../src/lib/constants";
import type { AdhocFact, PieceFact } from "./export-data-corrections";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const FILE = "backups/data-corrections.json";

async function main() {
  if (!existsSync(FILE)) {
    console.log(`ما في ${FILE} — ولا شي للتطبيق.`);
    await prisma.$disconnect();
    return;
  }
  const data = JSON.parse(readFileSync(FILE, "utf8")) as { pieces: PieceFact[]; adhoc: AdhocFact[] };
  const companies = await prisma.company.findMany();
  const coId = new Map(companies.map((c) => [c.name, c.id]));

  let advanced = 0, filled = 0, credited = 0, created = 0, missing = 0, untouched = 0;

  // ── القطع ──
  for (const f of data.pieces) {
    const companyId = coId.get(f.company);
    if (!companyId) { missing++; continue; }
    const t = await prisma.task.findFirst({
      where: {
        companyId,
        isAuto: true,
        year: f.year,
        month: f.month,
        stage: f.stage || null,
        status: { not: "CANCELED" },
        ...(f.pieceNo != null ? { type: f.type, pieceNo: f.pieceNo } : { title: f.title }),
      },
    });
    if (!t) { missing++; continue; }

    const patch: Record<string, unknown> = {};
    // ١. تقدّم الحالة — أبداً بالعكس.
    if (f.done && !isTaskDoneState(t)) {
      patch.status = f.publish ? "PUBLISHED" : "READY";
      patch.board = "DONE";
      patch.startedAt = t.startedAt ?? (f.startedAt ? new Date(f.startedAt) : new Date(f.finishedAt ?? Date.now()));
      patch.finishedAt = t.finishedAt ?? (f.finishedAt ? new Date(f.finishedAt) : new Date());
      patch.completedAt = t.completedAt ?? patch.finishedAt;
      patch.isPinned = true;
      advanced++;
    }
    // ٢. النص عالفاضي بس.
    if (f.brief && !t.brief?.trim()) { patch.brief = f.brief; filled++; }
    if (f.notes && !(t.notes ?? "").includes(f.notes.slice(0, 40))) {
      patch.notes = [t.notes, f.notes].filter(Boolean).join(" · ");
      filled++;
    }
    // ٣. الكريدت لغير المثبّت بس.
    if (f.assigneeId && !t.isPinned && t.assigneeId !== f.assigneeId) {
      patch.assigneeId = f.assigneeId;
      patch.isPinned = true;
      credited++;
    }
    if (f.quantity != null && (t.quantity ?? 1) < f.quantity) patch.quantity = f.quantity;

    if (!Object.keys(patch).length) { untouched++; continue; }
    if (APPLY) await prisma.task.update({ where: { id: t.id }, data: patch });
  }

  // ── الإضافية: إنشاء إذا ناقصة، وتقدّم الحالة إذا موجودة ──
  for (const f of data.adhoc) {
    const t = await prisma.task.findUnique({ where: { id: f.id } });
    if (t) {
      if (["READY", "PUBLISHED"].includes(f.status) && !isTaskDoneState(t)) {
        advanced++;
        if (APPLY)
          await prisma.task.update({
            where: { id: f.id },
            data: {
              status: f.status, board: "DONE",
              startedAt: t.startedAt ?? (f.startedAt ? new Date(f.startedAt) : new Date()),
              finishedAt: t.finishedAt ?? (f.finishedAt ? new Date(f.finishedAt) : new Date()),
              completedAt: t.completedAt ?? (f.finishedAt ? new Date(f.finishedAt) : new Date()),
            },
          });
      } else untouched++;
      continue;
    }
    const companyId = f.company ? coId.get(f.company) : null;
    if (f.company && !companyId) { missing++; continue; }
    created++;
    if (APPLY)
      await prisma.task.create({
        data: {
          id: f.id,
          kind: "ADHOC",
          title: f.title,
          hours: f.hours,
          quantity: 1,
          priority: "NORMAL",
          status: f.status,
          board: f.board,
          stage: f.stage,
          workDate: f.workDate ? new Date(f.workDate) : null,
          readyDate: f.readyDate ? new Date(f.readyDate) : null,
          publishDate: f.publishDate ? new Date(f.publishDate) : null,
          startedAt: f.startedAt ? new Date(f.startedAt) : null,
          finishedAt: f.finishedAt ? new Date(f.finishedAt) : null,
          completedAt: f.finishedAt ? new Date(f.finishedAt) : null,
          month: f.month,
          year: f.year,
          week: f.workDate ? Math.ceil(new Date(f.workDate).getDate() / 7) : null,
          isPinned: true,
          isAuto: false,
          companyId: companyId ?? null,
          assigneeId: f.assigneeId,
          notes: f.notes,
          brief: f.brief,
        },
      });
  }

  console.log(
    `${APPLY ? "انطبّق" : "رح ينطبّق"}: تقدّم ${advanced} · نص ${filled} · كريدت ${credited} · ` +
      `إنشاء ${created} · بلا لمس ${untouched} · مو موجود (بينتظر إعادة الجدولة) ${missing}`,
  );
  if (!APPLY) console.log("تشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
