/**
 * فحص عميق ٣٠/١٠ — حرّاس لكل ثغرة انصلحت:
 *  - صفحات الإدارة: كل صفحة بتتحقّق من الجلسة بحالها، مو بس بالـlayout (الـlayout ما بيحمي الصفحة —
 *    انأكّد محلياً بكوكي مزوّرة: الصفحة رجّعت داتا الشركات بلا تحويل للدخول).
 *  - نافذة التعديل: خانة الحالة ما بتسكّر مرحلة قبل يلي قبلها، وبتكتب «مين عمل شو».
 *  - تسليم هلّق بيلغي التسليم المجدول القديم.
 *  - «تم النشر» مرتين بنفس اللحظة ← قطعتين، مو نفس الكرت مرتين.
 *  - المحرّك: مهمة إضافية بلا يوم مثبّت ما بتنحطّ بيوم مرق؛ بداية يوم عطلة بتمشي لقدّام.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { buildSchedule, type SchedulerState } from "@/lib/scheduler";
import { toISODate } from "@/lib/dates";
import { team } from "./deep/scheduler-core-fixture";

describe("صفحات الإدارة: تحقّق الجلسة بكل صفحة", () => {
  const root = join(process.cwd(), "src", "app", "admin");
  const pages = [join(root, "page.tsx"), ...readdirSync(root).map((d) => join(root, d, "page.tsx"))].filter(existsSync);

  it("كل page.tsx تحت /admin بتنادي requireAdminPage بأول الدالة", () => {
    expect(pages.length).toBeGreaterThanOrEqual(15);
    // أول `await` بالدالة الافتراضية لازم يكون الحارس — قبل أي قراءة أو كتابة.
    const missing = pages.filter((p) => {
      const body = readFileSync(p, "utf8").split("export default async function")[1] ?? "";
      return !body.slice(body.indexOf("await ")).startsWith("await requireAdminPage(");
    });
    expect(missing).toEqual([]);
  });
});

describe("المحرّك: المهمة الإضافية واليوم", () => {
  const sabin = team().find((e) => e.id === "e_sabin")!;
  const state = (adhoc: SchedulerState["adhoc"], today: Date | null): SchedulerState => ({
    year: 2026,
    month: 9,
    employees: [sabin],
    companies: [],
    adhoc,
    today,
  });
  const card = (o: Partial<NonNullable<SchedulerState["adhoc"]>[number]>) => ({
    id: "a1", title: "إضافية", companyId: null, assigneeId: sabin.id, hours: 8, priority: "NORMAL" as const,
    status: "NOT_STARTED" as const, readyDate: new Date(2026, 10, 3), ...o,
  });
  const dayOf = (r: ReturnType<typeof buildSchedule>, id = "a1") => {
    const t = r.tasks.find((x) => x.detKey === `adhoc:${id}`)!;
    return toISODate(t.workDate!);
  };

  it("بلا يوم مثبّت يوم ٣٠/١٠ ← أول يوم دوام من اليوم (كانت ٢٨/٩)", () => {
    expect(dayOf(buildSchedule(state([card({})], new Date(2026, 9, 30))))).toBe("2026-11-01");
  });

  it("بلا «اليوم» (اختبارات صافية/دلو قديم) ← نفس السلوك القديم", () => {
    expect(dayOf(buildSchedule(state([card({})], null))) < "2026-10-30").toBe(true);
  });

  it("منجزة ما بتتأثّر بالأرضية (ما بتاكل طاقة اليوم)", () => {
    expect(dayOf(buildSchedule(state([card({ status: "READY" })], new Date(2026, 9, 30)))) < "2026-10-30").toBe(true);
  });

  it("بداية مثبّتة يوم سبت ← الأحد بعدها (§١٦)، مو الخميس قبلها", () => {
    const r = buildSchedule(state([card({ isPinned: true, workDate: new Date(2026, 9, 31) })], new Date(2026, 9, 25)));
    expect(dayOf(r)).toBe("2026-11-01");
  });
});

// ───────────────────────────── قاعدة معزولة

const scratch = await vi.hoisted(async () => {
  const { copyFileSync, existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const source = resolve(process.cwd(), "prisma", "dev.db");
  const target = resolve(process.cwd(), "prisma", `test-deep-audit-1030-${process.pid}.db`);
  const available = existsSync(source);
  if (available) copyFileSync(source, target);
  return { target, available };
});
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  assertAdmin: async () => {},
  currentAdmin: async () => null,
  isOwnerSession: async () => true,
  listExtraAdmins: async () => [],
}));
vi.mock("@/lib/telegram/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/telegram/client")>()),
  sendMessage: async () => ({ ok: true as const, result: { message_id: 1 } }),
}));
vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const { assertIsolatedTestDatabaseUrl } = await import("./_helpers/test-database");
  return { prisma: new PrismaClient({ datasources: { db: { url: assertIsolatedTestDatabaseUrl(`file:${scratch.target}`) } } }) };
});

let prisma: import("@prisma/client").PrismaClient;
let tasks: typeof import("@/server/actions/tasks");
let events: typeof import("@/server/task-events");
const ids = { emp: "", co: "", omar: "" };
const CHAT = -1009990222;
const TOPIC = 802;

beforeAll(async () => {
  if (!scratch.available) return;
  prisma = (await import("@/lib/db")).prisma as never;
  tasks = await import("@/server/actions/tasks");
  events = await import("@/server/task-events");
  ids.emp = (await prisma.employee.create({ data: { name: "فحص-٣٠-مونتيرة", role: "مونتيرة", workDays: "[0,1,2,3,4]" } })).id;
  ids.omar = (await prisma.employee.create({ data: { name: "فحص-٣٠-ناشر", role: "publisher", workDays: "[0,1,2,3,4]", telegramUserId: "774000001" } })).id;
  ids.co = (await prisma.company.create({ data: { name: "شركة-فحص-٣٠", slug: "Audit30", status: "active", managed: false } as never })).id;
  await prisma.telegramChat.create({ data: { id: `${CHAT}#${TOPIC}`, chatId: String(CHAT), threadId: TOPIC, title: "Audit30", companyId: ids.co } });
});
afterAll(async () => {
  await prisma?.$disconnect();
  if (scratch.available) {
    const { rmSync } = await import("node:fs");
    for (const ext of ["", "-journal", "-wal", "-shm"]) rmSync(scratch.target + ext, { force: true });
  }
});

const mk = (data: Record<string, unknown>) =>
  prisma.task.create({
    data: { kind: "CONTENT", type: "REEL", title: "كرت فحص", hours: 4, year: 2026, month: 9, isAuto: true, status: "NOT_STARTED", board: "TODO", assigneeId: ids.emp, companyId: ids.co, ...data } as never,
  });

describe.skipIf(!scratch.available)("نافذة التعديل: نفس حارس الترتيب", () => {
  it("مونتاج تصويره مفتوح ← «جاهز» من نافذة التعديل مرفوض والكرت ما بيتحرّك", async () => {
    const shoot = await mk({ stage: "SHOOT", title: "تصوير ٣٠" });
    const edit = await mk({ stage: "EDIT", blockedById: shoot.id, title: "مونتاج ٣٠" });
    const r = await tasks.updateTaskDetails([edit.id], { status: "READY", expectedStatus: "NOT_STARTED" } as never);
    expect(r.ok).toBe(false);
    expect("error" in r ? r.error : "").toContain("قبل ما يخلص");
    expect((await prisma.task.findUniqueOrThrow({ where: { id: edit.id } })).status).toBe("NOT_STARTED");

    // بعد ما يتسكّر التصوير ← مسموح، وبينكتب الأثر بمصدر «status».
    expect((await tasks.updateTaskDetails([shoot.id], { status: "READY", expectedStatus: "NOT_STARTED" } as never)).ok).toBe(true);
    expect((await tasks.updateTaskDetails([edit.id], { status: "READY", expectedStatus: "NOT_STARTED" } as never)).ok).toBe(true);
    const ev = (await events.loadTaskEvents(1)).filter((e) => e.taskId === edit.id || e.taskId === shoot.id);
    expect(ev.map((e) => [e.taskId, e.to, e.source]).sort()).toEqual([[edit.id, "READY", "status"], [shoot.id, "READY", "status"]].sort());
  });

  it("دفعة فيها كرت محجوز ← الحفظ كلّه مرفوض، ولا كرت بيتغيّر", async () => {
    const shoot = await mk({ stage: "SHOOT", title: "تصوير دفعة" });
    const edit = await mk({ stage: "EDIT", blockedById: shoot.id, title: "مونتاج دفعة" });
    const free = await mk({ kind: "ADHOC", type: null, stage: null, isAuto: false, title: "حرّة دفعة" });
    const r = await tasks.updateTaskDetails([free.id, edit.id], { status: "READY", expectedStatus: "NOT_STARTED" } as never);
    expect(r.ok).toBe(false);
    expect("error" in r ? r.error : "").toContain("مونتاج دفعة");
    const after = await prisma.task.findMany({ where: { id: { in: [free.id, edit.id] } } });
    expect(after.every((t) => t.status === "NOT_STARTED")).toBe(true);
  });
});

describe.skipIf(!scratch.available)("التسليم", () => {
  it("تسليم هلّق بيلغي التسليم المجدول القديم لنفس الشخص", async () => {
    const employees = await import("@/server/actions/employees");
    const handover = await import("@/server/handover");
    const from = (await prisma.employee.create({ data: { name: "فحص-٣٠-مغادرة", role: "مونتيرة", workDays: "[0,1,2,3,4]" } })).id;
    const heirA = (await prisma.employee.create({ data: { name: "فحص-٣٠-خلف١", role: "مونتيرة", workDays: "[0,1,2,3,4]" } })).id;
    const heirB = (await prisma.employee.create({ data: { name: "فحص-٣٠-خلف٢", role: "مونتيرة", workDays: "[0,1,2,3,4]" } })).id;
    await handover.planHandover(from, heirA, "2099-01-01");
    const probe = await employees.handoverEmployeeWork({ fromId: from, toId: heirB, fromDate: "2026-10-01" });
    if (!probe.ok || !("total" in probe)) throw new Error("probe");
    expect((await employees.handoverEmployeeWork({ fromId: from, toId: heirB, fromDate: "2026-10-01", confirm: probe.total })).ok).toBe(true);
    expect((await handover.loadPlannedHandovers()).filter((p) => p.fromId === from)).toEqual([]);
    expect((await handover.loadHandovers()).find((h) => h.fromId === from)?.toId).toBe(heirB);
  });
});

describe.skipIf(!scratch.available)("تأكيد النشر بالتوازي", () => {
  it("«تم النشر» مرتين بنفس اللحظة ← أقدم قطعتين مستحقّتين، كل وحدة مرة", async () => {
    const ingest = await import("@/lib/telegram/ingest");
    const past = (d: number) => new Date(Date.now() - d * 86_400_000);
    const p1 = await mk({ type: "POST", stage: "PUBLISH", pieceNo: 1, publishDate: past(3), readyDate: past(3), assigneeId: ids.omar, title: "نشر ١" });
    const p2 = await mk({ type: "POST", stage: "PUBLISH", pieceNo: 2, publishDate: past(2), readyDate: past(2), assigneeId: ids.omar, title: "نشر ٢" });
    const msg = (n: number) => ({
      update_id: 995000 + n,
      message: {
        message_id: 9500 + n,
        date: Math.floor(Date.now() / 1000) - 20,
        chat: { id: CHAT, type: "supergroup", title: "Team" },
        message_thread_id: TOPIC,
        from: { id: 774000001, is_bot: false, first_name: "Omar" },
        text: "تم النشر",
      },
    });
    await Promise.all([ingest.ingestUpdate(msg(1) as never), ingest.ingestUpdate(msg(2) as never)]);
    const after = await prisma.task.findMany({ where: { id: { in: [p1.id, p2.id] } } });
    expect(after.map((t) => t.status).sort()).toEqual(["PUBLISHED", "PUBLISHED"]);
  });
});

describe.skipIf(!scratch.available)("حمل الدلاء التانية: كرت الخطة بينقسم على نطاقاته", () => {
  it("كرتين كتابة لنفس الشركة بنفس الدورة = يوم كتابة واحد بالمجموع، مو يومين", async () => {
    const engine = await import("@/server/schedule-engine");
    const writer = await prisma.employee.create({ data: { name: "فحص-٣٠-كاتبة", role: "كاتبة", workDays: "[0,1,2,3,4,5,6]" } });
    const day = new Date(Date.UTC(2026, 11, 7));
    for (const scope of ["DESIGN", "SHOOT"]) {
      await prisma.task.create({
        data: { kind: "CONTENT", stage: "WRITE", title: `خطة ${scope}`, hours: 8, year: 2026, month: 11, isAuto: true, status: "NOT_STARTED", board: "TODO", assigneeId: writer.id, companyId: ids.co, workDate: day, readyDate: day } as never,
      });
    }
    const employees = (await prisma.employee.findMany({ where: { id: writer.id } })) as never;
    const load = await engine.externalLoadFor(2026, 10, new Date(Date.UTC(2026, 9, 30)), { year: 2026, month: 10, employees, companies: [] } as never, [ids.co]);
    const total = Object.values(load[writer.id] ?? {}).reduce((s, h) => s + h, 0);
    // المتوقَّع من نفس دالة الطابور: كرت خطة واحد كامل (نصّين). بلا القسمة كان ضعفه.
    const { dailyTaskEffortDays } = await import("@/lib/daily-work");
    const { effectiveHours } = await import("@/lib/capacity");
    const one = await prisma.task.findFirstOrThrow({ where: { assigneeId: writer.id } });
    const full = dailyTaskEffortDays(writer as never, one as never) * effectiveHours(writer as never);
    expect(full).toBeGreaterThan(0);
    expect(total).toBeCloseTo(full, 5);
  });
});
