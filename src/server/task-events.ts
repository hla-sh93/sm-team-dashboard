/**
 * «مين عمل شو» — أثر الفاعل على تغييرات حالة الكروت (خطة التحسينات F، ٢٩/١٠).
 *
 * صار ١١/١٠ ١٧:٣٨–١٧:٤٠: ٦ مونتاجات انسكّروا بالإيد من قائمة الحالة، ولا ملاحظة ولا رسالة
 * تلغرام — وما في أي طريقة نعرف مين. هون كل تغيير حالة بينكتب بسطر: الكرت، من ← لـ، المصدر
 * (اللوح · تلغرام)، والفاعل.
 *
 * **بلا schema** (نفس قرار المرحلة C): كل حدث صفّ `Setting` مفتاحه `taskEvent:<وقت ISO>:<عشوائي>`
 * — المفتاح بيترتّب بالوقت، فالقراءة والتقليم (`TASK_EVENT_KEEP_DAYS`) بالمقارنة على المفتاح.
 *
 * الفاعل بقسم الموظفين **تصريح مو تحقّق**: الجهاز بيختار «أنا مين» مرّة (كوكي `sm_actor`)
 * — للمحاسبة مو للأمان. بواجهة الإدارة الفاعل هو جلسة المسؤول.
 *
 * بلا `"use server"`: بيناديه السيرفر بس.
 */
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { currentAdmin, listExtraAdmins } from "@/lib/auth";

export const TASK_EVENT_PREFIX = "taskEvent:";
export const TASK_EVENT_KEEP_DAYS = 120;
export const ACTOR_COOKIE = "sm_actor";

export type TaskEventSource = "board" | "status" | "telegram";
export type TaskEvent = {
  taskId: string;
  from: string;
  to: string;
  source: TaskEventSource;
  /** اسم الفاعل كما انعرف لحظتها («ليلاس»، «الإدارة: عمر»، «Lilas (تلغرام)»). */
  actor: string | null;
  actorId: string | null;
  at: string;
};

/** الفاعل من الطلب الحالي: جلسة الإدارة أولاً، وإلا «أنا مين» من الكوكي. ما بيرمي أبداً. */
export async function currentActor(): Promise<{ id: string | null; name: string | null }> {
  try {
    const admin = await currentAdmin();
    if (admin?.kind === "owner") return { id: "admin:owner", name: "الإدارة" };
    if (admin?.kind === "extra") {
      const row = (await listExtraAdmins()).find((a) => a.id === admin.id);
      return { id: `admin:${admin.id}`, name: `الإدارة: ${row?.name ?? "مسؤول"}` };
    }
    const id = (await cookies()).get(ACTOR_COOKIE)?.value ?? null;
    if (!id || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) return { id: null, name: null };
    const e = await prisma.employee.findUnique({ where: { id }, select: { id: true, name: true } });
    return e ? { id: e.id, name: e.name } : { id: null, name: null };
  } catch {
    // برّا طلب (سكربت، فحص) — ما في كوكيز.
    return { id: null, name: null };
  }
}

export async function recordTaskEvent(
  event: Omit<TaskEvent, "at" | "actor" | "actorId"> & { actor?: string | null; actorId?: string | null },
  now: Date = new Date(),
): Promise<void> {
  if (event.from === event.to) return;
  const who = event.actor !== undefined ? { id: event.actorId ?? null, name: event.actor } : await currentActor();
  const at = now.toISOString();
  const value: TaskEvent = { taskId: event.taskId, from: event.from, to: event.to, source: event.source, actor: who.name, actorId: who.id, at };
  const key = `${TASK_EVENT_PREFIX}${at}:${Math.random().toString(36).slice(2, 8)}`;
  await prisma.setting.create({ data: { key, value: JSON.stringify(value) } });
  const cutoff = new Date(now.getTime() - TASK_EVENT_KEEP_DAYS * 86_400_000).toISOString();
  await prisma.setting.deleteMany({ where: { key: { startsWith: TASK_EVENT_PREFIX, lt: `${TASK_EVENT_PREFIX}${cutoff}` } } });
}

/** الأثر ما لازم يوقّع التغيير نفسه. */
export async function recordTaskEventSafely(event: Parameters<typeof recordTaskEvent>[0]): Promise<void> {
  try {
    await recordTaskEvent(event);
  } catch (err) {
    console.error("[task-events]", err);
  }
}

export async function loadTaskEvents(sinceDays = 14, now: Date = new Date()): Promise<TaskEvent[]> {
  const since = new Date(now.getTime() - sinceDays * 86_400_000).toISOString();
  const rows = await prisma.setting.findMany({
    where: { key: { startsWith: TASK_EVENT_PREFIX, gte: `${TASK_EVENT_PREFIX}${since}` } },
    orderBy: { key: "desc" },
    take: 2000,
  });
  const out: TaskEvent[] = [];
  for (const r of rows) {
    try {
      out.push(JSON.parse(r.value) as TaskEvent);
    } catch {
      /* صفّ تالف */
    }
  }
  return out;
}
