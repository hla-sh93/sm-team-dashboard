"use server";

/**
 * «فكّ الحجز يدوياً» — للإدارة بس (خطة A، ٢٩/١٠). كرت ناطر مرحلة سابقة بيصير جاهز بقرار
 * المشرفة وبسبب مكتوب (مثلاً «الوصف وصل شفهياً»). القرار سطر دليل على الكرت
 * (`MANUAL_UNBLOCK_PREFIX`) — بيعيش إعادة التوليد، وبينشاف، وبينشال بـ«رجّع الحجز».
 */
import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/auth";
import { revalidateAll } from "@/lib/revalidate";
import { MANUAL_UNBLOCK_PREFIX, isManuallyUnblocked } from "@/lib/daily-work";
import { teamTodayISO } from "@/lib/team-day";
import { recordTaskEventSafely, currentActor } from "@/server/task-events";

type Result = { ok: true } | { ok: false; error: string };

async function guard(): Promise<string | null> {
  try {
    await assertAdmin();
    return null;
  } catch {
    return "غير مصرّح";
  }
}

export async function manualUnblock(taskId: string, reason: string): Promise<Result> {
  const denied = await guard();
  if (denied) return { ok: false, error: denied };
  const why = (reason ?? "").replace(/\s+/g, " ").trim();
  if (why.length < 3) return { ok: false, error: "اكتبي السبب — ليش الكرت بيقدر يبلّش قبل المرحلة يلي قبله" };
  if (why.length > 200) return { ok: false, error: "السبب طويل (لحدّ ٢٠٠ حرف)" };
  const t = await prisma.task.findUnique({ where: { id: taskId }, select: { id: true, notes: true, blockedById: true, board: true } });
  if (!t) return { ok: false, error: "الكرت غير موجود" };
  if (!t.blockedById) return { ok: false, error: "هالكرت مو محجوز" };
  if (isManuallyUnblocked(t)) return { ok: true };
  const who = (await currentActor()).name ?? "الإدارة";
  const line = `${MANUAL_UNBLOCK_PREFIX} (${who} ${teamTodayISO()}): ${why}`;
  await prisma.task.update({ where: { id: t.id }, data: { notes: [t.notes?.trim(), line].filter(Boolean).join("\n") } });
  await recordTaskEventSafely({ taskId: t.id, from: "بانتظار", to: "جاهز (فكّ يدوي)", source: "board" });
  revalidateAll();
  return { ok: true };
}

export async function undoManualUnblock(taskId: string): Promise<Result> {
  const denied = await guard();
  if (denied) return { ok: false, error: denied };
  const t = await prisma.task.findUnique({ where: { id: taskId }, select: { id: true, notes: true } });
  if (!t) return { ok: false, error: "الكرت غير موجود" };
  if (!isManuallyUnblocked(t)) return { ok: true };
  const kept = (t.notes ?? "").split(/\r?\n/).filter((l) => !l.trim().startsWith(MANUAL_UNBLOCK_PREFIX));
  await prisma.task.update({ where: { id: t.id }, data: { notes: kept.join("\n").trim() || null } });
  await recordTaskEventSafely({ taskId: t.id, from: "جاهز (فكّ يدوي)", to: "بانتظار", source: "board" });
  revalidateAll();
  return { ok: true };
}
