/**
 * «صار جاهز إلك» — رسالة تلغرام خاصة لما تنسكّر المرحلة يلي كانت حاجزة كرت حدا.
 *
 * القائدة (٢٩/١٠، خطة التحسينات A): الموظف بيشوف «بانتظار» على اللوح، بس ما بيعرف إمتى
 * انفكّ الحجز إلا إذا فتح اللوحة. هون، بعد كل إقفال (من اللوح أو من تلغرام)، منلاقي الكروت
 * يلي صارت **جاهزة** فعلاً (ولا حاجز مفتوح بكل السلسلة — نفس `makeReadiness`) ومنبعت
 * لكل صاحب كرت رسالة وحدة فيها كل كروته.
 *
 * - **مطفي افتراضياً** (`UNBLOCK_NOTIFY_KEY`) — بينفتح من /admin/telegram.
 * - كل كرت بينبعت مرّة وحدة بس (`UNBLOCK_SENT_KEY`)، حتى لو انفتح الحاجز وانسكّر من جديد.
 * - ما منبعت للشخص عن شغله هو: ليلاس سكّرت تصويرها، مونتاجها ما بدّه رسالة.
 * - برّا ساعات الشغل (يوم عطلته، أو قبل ٩ / بعد ٦ بدمشق) بتوصل **صامتة**.
 * - ما بيوقّع الإقفال أبداً: أي غلط بينبلع (`notifyUnblockedSafely`).
 */
import { prisma } from "@/lib/db";
import { sendMessage } from "@/lib/telegram/client";
import { loadBlockerChain } from "@/lib/late";
import { makeReadiness } from "@/lib/readiness";
import { isTaskDoneState } from "@/lib/constants";
import { parseWorkDays } from "@/lib/dates";
import type { Task } from "@/types";

export const UNBLOCK_NOTIFY_KEY = "telegramUnblockNotify";
export const UNBLOCK_SENT_KEY = "unblockNotified";
const SENT_KEEP_DAYS = 45;
const MAX_DEPTH = 6;
const WORK_HOURS = { from: 9, to: 18 } as const;

export async function isUnblockNotifyOn(): Promise<boolean> {
  const row = await prisma.setting.findUnique({ where: { key: UNBLOCK_NOTIFY_KEY } });
  return row?.value === "on";
}

/** ساعة دمشق (UTC+3 ثابت) ويوم الأسبوع — بلا اعتماد على توقيت السيرفر. */
function damascusClock(now: Date): { hour: number; weekday: number } {
  const d = new Date(now.getTime() + 3 * 3_600_000);
  return { hour: d.getUTCHours(), weekday: d.getUTCDay() };
}

async function loadSent(): Promise<Record<string, string>> {
  const row = await prisma.setting.findUnique({ where: { key: UNBLOCK_SENT_KEY } });
  if (!row) return {};
  try {
    const v = JSON.parse(row.value);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export type UnblockOutcome = { sent: number; ready: number; skipped: string[] };

/**
 * `closedIds` = الكروت يلي انسكّرت هلّق. بيرجّع شو انبعت (للفحوص)؛ ما بيرمي.
 */
export async function notifyUnblocked(closedIds: string[], now: Date = new Date()): Promise<UnblockOutcome> {
  const out: UnblockOutcome = { sent: 0, ready: 0, skipped: [] };
  if (closedIds.length === 0 || !(await isUnblockNotifyOn())) return out;

  const closed = await prisma.task.findMany({ where: { id: { in: closedIds } } });
  const closers = new Set(closed.map((t) => t.assigneeId).filter(Boolean));

  // التابعين لتحت: كرت تابع منجز (تناقض بالداتا، أو انسكّر سوا) منكمّل لتابعينه.
  const candidates: Task[] = [];
  const seen = new Set(closedIds);
  let frontier = closedIds;
  for (let depth = 0; depth < MAX_DEPTH && frontier.length; depth++) {
    const deps = (await prisma.task.findMany({ where: { blockedById: { in: frontier } } })) as unknown as Task[];
    const next: string[] = [];
    for (const d of deps) {
      if (seen.has(d.id)) continue;
      seen.add(d.id);
      if (isTaskDoneState(d)) next.push(d.id);
      else candidates.push(d);
    }
    frontier = next;
  }
  if (candidates.length === 0) return out;

  const chain = (await loadBlockerChain(candidates, (ids) =>
    prisma.task.findMany({ where: { id: { in: ids } } }) as unknown as Promise<Task[]>,
  )) as Task[];
  const readiness = makeReadiness([...candidates, ...chain]);
  const ready = candidates.filter((t) => readiness(t).state === "ready" && t.assigneeId);
  out.ready = ready.length;

  const sent = await loadSent();
  const fresh = ready.filter((t) => !sent[t.id] && !closers.has(t.assigneeId));
  if (fresh.length === 0) return out;

  const [employees, companies] = await Promise.all([
    prisma.employee.findMany({
      where: { id: { in: [...new Set(fresh.map((t) => t.assigneeId!))] } },
      select: { id: true, name: true, telegramUserId: true, workDays: true },
    }),
    prisma.company.findMany({
      where: { id: { in: [...new Set(fresh.map((t) => t.companyId).filter((v): v is string => !!v))] } },
      select: { id: true, name: true },
    }),
  ]);
  const coName = new Map(companies.map((c) => [c.id, c.name]));
  const byOwner = new Map<string, Task[]>();
  for (const t of fresh) byOwner.set(t.assigneeId!, [...(byOwner.get(t.assigneeId!) ?? []), t]);

  const clock = damascusClock(now);
  const stamp = now.toISOString();
  for (const e of employees) {
    const cards = byOwner.get(e.id) ?? [];
    if (!e.telegramUserId) {
      out.skipped.push(`${e.name}: بلا معرّف تلغرام`);
      continue;
    }
    const lines = cards.map((t) => `• ${t.title}${t.companyId && coName.get(t.companyId) ? ` — ${coName.get(t.companyId)}` : ""}`);
    const text = `🔓 ${e.name}، صار جاهز إلك (خلصت المرحلة يلي قبله):\n${lines.join("\n")}`;
    const offHours =
      !parseWorkDays(e.workDays).includes(clock.weekday) || clock.hour < WORK_HOURS.from || clock.hour >= WORK_HOURS.to;
    const r = await sendMessage(e.telegramUserId, text, { silent: offHours });
    if (!r.ok) {
      out.skipped.push(`${e.name}: ${r.error}`);
      continue;
    }
    out.sent++;
    for (const t of cards) sent[t.id] = stamp;
  }

  if (out.sent > 0) {
    const cutoff = now.getTime() - SENT_KEEP_DAYS * 86_400_000;
    const kept = Object.fromEntries(Object.entries(sent).filter(([, at]) => Date.parse(at) >= cutoff));
    const value = JSON.stringify(kept);
    await prisma.setting.upsert({
      where: { key: UNBLOCK_SENT_KEY },
      update: { value },
      create: { key: UNBLOCK_SENT_KEY, value },
    });
  }
  return out;
}

/** للمسارات يلي بتسكّر كروت: الإشعار ما لازم يوقّع الإقفال ولا يأخّر رسالة خطأ. */
export async function notifyUnblockedSafely(closedIds: string[], now?: Date): Promise<void> {
  try {
    await notifyUnblocked(closedIds, now);
  } catch (err) {
    console.error("[unblock-notify]", err);
  }
}
