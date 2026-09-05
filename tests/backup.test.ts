/**
 * النسخة الاحتياطية اليومية — قرار القائدة (٢/٩/٢٠٢٦): «backup يومي ١٢ ظهراً
 * للداتا في Vercel وتنزيلها على اللوكال، والاحتفاظ بآخر ٣ نسخ. ما بدي أي
 * بيانات تروح».
 *
 * الفحوص هون بتحرس الجملة الأخيرة: لقطة ناقصة ما بتنكتب، ولا بينحذف شي إلا
 * بعد نجاح الجديدة.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  AUTH_KEYS,
  SNAPSHOT_SCHEMA,
  acceptSnapshot,
  actualCounts,
  buildSnapshot,
  snapshotsToDelete,
  type Snapshot,
} from "@/lib/backup";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: {} }));

const snap = (over: Partial<Snapshot> = {}, counts?: Partial<Snapshot["meta"]["counts"]>): Snapshot => {
  const employees = over.employees ?? [{ id: "e1" }];
  const companies = over.companies ?? [{ id: "c1" }];
  const tasks = over.tasks ?? [{ id: "t1" }, { id: "t2" }];
  const photoSessions = over.photoSessions ?? [];
  const settings = over.settings ?? [];
  const telegramChats = over.telegramChats ?? [];
  const telegramMessages = over.telegramMessages ?? [];
  return {
    meta: {
      exportedAt: "2026-09-02T09:00:00.000Z",
      source: "vercel-postgres",
      schema: SNAPSHOT_SCHEMA,
      counts: {
        employees: employees.length,
        companies: companies.length,
        tasks: tasks.length,
        photoSessions: photoSessions.length,
        settings: settings.length,
        telegramChats: telegramChats.length,
        telegramMessages: telegramMessages.length,
        ...counts,
      },
    },
    employees,
    companies,
    tasks,
    photoSessions,
    settings,
    telegramChats,
    telegramMessages,
  };
};

describe("بناء اللقطة", () => {
  it("بتاخد كل الجداول وبتحسب عدّاداتها، وبتشيل مفاتيح الدخول", async () => {
    const db = {
      employee: { findMany: async () => [{ id: "e1" }, { id: "e2" }] },
      company: { findMany: async () => [{ id: "c1" }] },
      task: { findMany: async () => [{ id: "t1" }] },
      photoSession: { findMany: async () => [] },
      telegramChat: { findMany: async () => [{ id: "c1#1" }] },
      telegramMessage: { findMany: async () => [{ id: "1:2" }, { id: "1:3" }] },
      setting: {
        findMany: async () => [
          { key: "achievements:2026-8", value: "{}" },
          { key: "adminPasswordHash", value: "سرّ" },
          { key: "authSecret", value: "سرّ" },
        ],
      },
    };
    const s = await buildSnapshot(db as never, "test");
    expect(s.meta.schema).toBe(SNAPSHOT_SCHEMA);
    expect(s.meta.counts).toEqual({
      employees: 2, companies: 1, tasks: 1, photoSessions: 0, settings: 1,
      telegramChats: 1, telegramMessages: 2,
    });
    // مفاتيح الدخول ما بتنسخ: نسخة فيها هاش كلمة سرّ بيئة تانية بتقدر تستبدل
    // مالك الحساب لو انستوردت.
    const keys = (s.settings as { key: string }[]).map((x) => x.key);
    for (const forbidden of AUTH_KEYS) expect(keys).not.toContain(forbidden);
    expect(keys).toEqual(["achievements:2026-8"]);
  });
});

describe("حارس قبول اللقطة", () => {
  it("بيقبل لقطة سليمة", () => {
    expect(acceptSnapshot(snap(), null).ok).toBe(true);
  });

  it("بيرفض شكل لقطة غير معروف", () => {
    const bad = snap();
    bad.meta.schema = "شي تاني";
    expect(acceptSnapshot(bad, null)).toMatchObject({ ok: false });
  });

  it("بيرفض لقطة مبتورة — العدّاد المكتوب مو مطابق للموجود", () => {
    const bad = snap({}, { tasks: 500 });
    const verdict = acceptSnapshot(bad, null);
    expect(verdict.ok).toBe(false);
    expect((verdict as { reason: string }).reason).toMatch(/مبتورة/);
  });

  it("بيرفض جدول أساسي فاضي مهما كان السبب", () => {
    const verdict = acceptSnapshot(snap({ tasks: [] }), null);
    expect(verdict.ok).toBe(false);
    expect((verdict as { reason: string }).reason).toMatch(/فاضي/);
  });

  it("بيرفض انكماشاً مفاجئاً مقابل آخر نسخة ناجحة", () => {
    const previous = snap({ tasks: Array.from({ length: 100 }, (_, i) => ({ id: `t${i}` })) });
    const next = snap({ tasks: Array.from({ length: 50 }, (_, i) => ({ id: `t${i}` })) });
    const verdict = acceptSnapshot(next, previous);
    expect(verdict.ok).toBe(false);
    expect((verdict as { reason: string }).reason).toMatch(/نقص/);
  });

  it("بيقبل نقصاً طبيعياً ضمن الحدّ — إعادة التوليد بتحذف كروت", () => {
    const previous = snap({ tasks: Array.from({ length: 100 }, (_, i) => ({ id: `t${i}` })) });
    const next = snap({ tasks: Array.from({ length: 90 }, (_, i) => ({ id: `t${i}` })) });
    expect(acceptSnapshot(next, previous).ok).toBe(true);
  });

  it("العدّ الفعلي من المصفوفات لا من الترويسة", () => {
    expect(actualCounts(snap()).tasks).toBe(2);
  });
});

describe("تدوير النسخ — بالأيام مو بعدد الملفات", () => {
  const daily = [
    "prod-20260830-1200.json",
    "prod-20260831-1200.json",
    "prod-20260901-1200.json",
    "prod-20260902-1200.json",
  ];

  it("بيخلي آخر يومين كاملين وآخر لقطة من كل يوم أقدم", () => {
    expect(snapshotsToDelete(daily, 14)).toEqual([]);
    expect(snapshotsToDelete(daily, 3)).toEqual(["prod-20260830-1200.json"]);
  });

  it("ما بيحذف شي لما تكون النسخ جوّا النافذة", () => {
    expect(snapshotsToDelete(daily.slice(1), 3)).toEqual([]);
    expect(snapshotsToDelete([], 3)).toEqual([]);
  });

  /**
   * الباغ يلي خلّى النسخة الاحتياطية بلا فايدة: ست سحبات بيوم واحد كانت تمحي
   * تاريخ الأسبوع كله وتخلّي أقدم نسخة عمرها ساعات.
   */
  it("ست لقطات بيوم واحد ما بتمحي أيام قبلها", () => {
    const files = [
      "prod-20260825-1200.json",
      "prod-20260826-1200.json",
      "prod-20260827-1200.json",
      "prod-20260904-1030.json",
      "prod-20260904-1130.json",
      "prod-20260904-1230.json",
      "prod-20260904-1330.json",
      "prod-20260904-1430.json",
      "prod-20260905-0900.json",
    ];
    const gone = snapshotsToDelete(files, 14);
    expect(gone).toEqual([]);
    // والأيام القديمة بتضل موجودة مهما زادت سحبات اليوم
    expect(gone).not.toContain("prod-20260825-1200.json");
  });

  it("اليوم القديم بيضل منه آخر لقطة وبس", () => {
    const files = [
      "prod-20260901-0900.json",
      "prod-20260901-1500.json",
      "prod-20260901-1800.json",
      "prod-20260904-1200.json",
      "prod-20260905-1200.json",
    ];
    expect(snapshotsToDelete(files, 14)).toEqual([
      "prod-20260901-0900.json",
      "prod-20260901-1500.json",
    ]);
  });

  it("برّا نافذة الأيام بينمحي اليوم كله", () => {
    const files = [
      "prod-20260101-1200.json",
      "prod-20260903-1200.json",
      "prod-20260904-1200.json",
      "prod-20260905-1200.json",
    ];
    expect(snapshotsToDelete(files, 3)).toEqual(["prod-20260101-1200.json"]);
  });
});

describe("مسار التصدير — الحماية", () => {
  beforeEach(() => vi.stubEnv("CRON_SECRET", ""));
  afterEach(() => vi.unstubAllEnvs());

  const call = async (headers?: Record<string, string>) => {
    const { GET } = await import("@/app/api/backup/export/route");
    return GET(new Request("http://localhost/api/backup/export", { headers }));
  };

  it("بلا سرّ بيفشل مغلقاً (٥٠٣) — لا داتا بتطلع", async () => {
    const res = await call();
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ ok: false, error: "backup_not_configured" });
  });

  it("بسرّ خاطئ ٤٠١", async () => {
    vi.stubEnv("CRON_SECRET", "qa-secret");
    const res = await call({ authorization: "Bearer wrong" });
    expect(res.status).toBe(401);
  });

  it("بلا ترويسة أصلاً ٤٠١", async () => {
    vi.stubEnv("CRON_SECRET", "qa-secret");
    const res = await call();
    expect(res.status).toBe(401);
  });
});
