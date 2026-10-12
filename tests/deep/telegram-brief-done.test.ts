/**
 * فحص عميق ١٢/١٠/٢٠٢٦ — محور telegram-reports: رسالة ٠٧:٤٥ (الموجة العامة) وتقرير
 * ٢٠:٠٠ (المنجز)، نقيين بلا قاعدة.
 *
 * المرجع: PROJECT.md §14 «Morning brief» (سطر مجرّد لكل شخص، بلا تواريخ ولا أسماء
 * قطع ولا عدد أيام، ويلي بعطلة **ما بياخد سطر أصلاً**)، مذكّرة «البريف موجتان»،
 * مدخل الهاندوف ١٦/٩ ٢٢:٤٠ (تقرير المساء)، وWORK_RULES §١٠ (يوم دمشق، الإقفال
 * الإداري مستبعد، التصوير لمصوّر الشركة) — نفس «إنجاز اليوم» بتقريرين.
 *
 * `it.fails("[TR-nn] …")` = عطل مثبت بـ`docs/qa/deep-test-2026-10-11/telegram-reports.md`.
 */
import { afterEach, describe, expect, it } from "vitest";
import { buildDailyBrief } from "@/lib/telegram/brief";
import { buildDailyDoneReport } from "@/lib/telegram/done-report";
import { buildPeriodReport, resolvePeriod } from "@/lib/period-report";
import type { Company, Employee, Task } from "@/types";

const emp = (id: string, name: string, over: Record<string, unknown> = {}) =>
  ({ id, name, role: "designer", hoursPerDay: 8, workDays: "[0,1,2,3,4]", isScheduled: true, isPhotographer: false, salary: 200, rates: null, telegramUsername: null, ...over }) as unknown as Employee;
const co = (id: string, name: string, over: Record<string, unknown> = {}) =>
  ({ id, name, slug: name, managed: true, status: "active", posts: 6, reels: 2, stories: 6, aiReels: 0, publishStartDate: new Date(2026, 9, 1), renewals: null, contractEndedAt: null, lateExemptReason: null, priority: 1, photographerId: "ph", ...over }) as unknown as Company;
let seq = 0;
const task = (o: Record<string, unknown>) =>
  ({ id: `t${++seq}`, kind: "CONTENT", type: "POST", stage: "DESIGN", status: "NOT_STARTED", board: "TODO", month: 9, year: 2026, pieceNo: seq, quantity: 1, hours: 1.33, isPinned: false, companyId: "c1", pipelineKey: `c1|POST|${seq}`, ...o }) as unknown as Task;

const ORIGINAL_TZ = process.env.TZ;
afterEach(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

describe("٠٧:٤٥ — الموجة العامة", () => {
  const SUNDAY = new Date(2026, 9, 11, 7, 45);
  const EMPS = [
    emp("a", "أيمن"),
    emp("s", "سابين"),
    emp("o", "عمر", { role: "publisher", isScheduled: false, salary: 400, telegramUsername: "Omar_ORR" }),
    emp("ph", "ماجد", { role: "مصور", isPhotographer: true, telegramUsername: "Majic71" }),
  ];
  const COS = [co("c1", "وصل"), co("c2", "البلسم"), co("c3", "Siizen", { status: "paused", publishStartDate: null }), co("c4", "جدارات", { lateExemptReason: "بانتظار تاريخ النشر" })];
  const day = (d: number) => new Date(2026, 9, d);
  const TASKS = [
    // اليوم
    ...[1, 2, 3].map((n) => task({ assigneeId: "a", workDate: day(11), readyDate: day(13), publishDate: day(15), pieceNo: n })),
    task({ assigneeId: "a", type: "STORY", workDate: day(11), readyDate: day(12), publishDate: day(14), companyId: "c2", pieceNo: 1 }),
    // متأخر من قبل
    task({ assigneeId: "s", workDate: day(2), readyDate: day(3), publishDate: day(5), companyId: "c2", pieceNo: 7 }),
    task({ assigneeId: "s", type: "STORY", workDate: day(1), readyDate: day(2), publishDate: day(4), companyId: "c1", pieceNo: 9 }),
    // موقوفة ومعفاة — ولا وحدة لازم تبان
    task({ assigneeId: "a", workDate: day(11), readyDate: day(5), publishDate: day(6), companyId: "c3", pieceNo: 3 }),
    task({ assigneeId: "a", workDate: day(11), readyDate: day(5), publishDate: day(6), companyId: "c4", pieceNo: 4 }),
    // نشر اليوم ومتراكم
    task({ assigneeId: "o", kind: "PUBLISH", stage: "PUBLISH", publishDate: day(11), readyDate: day(11), workDate: day(11), pieceNo: 1 }),
    task({ assigneeId: "o", kind: "PUBLISH", stage: "PUBLISH", type: "STORY", publishDate: day(6), readyDate: day(6), workDate: day(6), companyId: "c2", pieceNo: 2 }),
    // تصوير اليوم
    task({ assigneeId: "ph", type: "REEL", stage: "SHOOT", workDate: day(11), readyDate: day(12), publishDate: day(16), pieceNo: 1 }),
  ];
  const brief = (employees = EMPS, today = SUNDAY) =>
    buildDailyBrief({ today, companies: COS, employees, tasks: TASKS, deliveries: { matched: 3, unmatched: 1 } }).schedule.text;

  it("خاصية: ولا تاريخ ولا عدد أيام ولا اسم قطعة ولا رمز بأي سطر — والموقوفة غايبة والمعفاة بلا «متأخر»", () => {
    const text = brief();
    const lines = text.split("\n");
    expect(lines.slice(0, 2)).toEqual(["صباح الخير", ""]);
    for (const l of lines.slice(2)) {
      expect(l.startsWith("‏")).toBe(true);
      expect(l).not.toMatch(/\d{1,2}\/\d{1,2}|\d+\s*يوم|[A-Za-z]+-(post|story|reel)-\d|(بوست|ستوري|ريل)-\d|[•▪️⏰📋🚀]/u);
      expect(l).not.toMatch(/Siizen/); // موقوفة: ولا أثر
      expect(l.split("متأخر")[1] ?? "").not.toMatch(/جدارات/); // معفاة: شغلها بيضل، تأخيرها لأ
    }
    expect(text).toContain("‏أيمن وصل 3 بوست · جدارات 1 بوست · البلسم 1 ستوري");
    // المتأخر يلي بيوصل لطابور اليوم بينعدّ مع شغل اليوم (selectDailyWork)، مو كـ«متأخر».
    expect(text).toContain("‏سابين وصل 1 ستوري · البلسم 1 بوست");
    expect(text).toContain("‏@Omar_ORR نشر: البلسم (ستوري) · وصل (بوست)");
  });

  it("الترتيب ثابت (ترتيب الموظفين) ومتكافئ بين تشغيلين", () => {
    expect(brief()).toBe(brief());
    const order = brief().split("\n").slice(2).map((l) => l.slice(1).split(" ")[0]);
    expect(order).toEqual(["أيمن", "سابين", "@Omar_ORR", "@Majic71"]);
  });

  describe("[TR-25] جملة المطاردة («ومتأخر: …») — PROJECT.md §14 ومذكّرة «البريف موجتان»", () => {
    const cos = [...COS, co("c5", "عبادة"), co("c6", "BW")];
    const late = (companyId: string, k: number, d = 1) =>
      task({ assigneeId: "a", companyId, workDate: day(d), readyDate: day(d + 1), publishDate: day(d + 3), pieceNo: 60 + k });
    const run = (tasks: Task[]) =>
      buildDailyBrief({ today: SUNDAY, companies: cos, employees: [EMPS[0]], tasks }).schedule.text;

    it.fails("[TR-25] شركة انذكرت بنصّ اليوم ما بتنعاد بالمطاردة", () => {
      // باللقطة ١١/١٠: «‏أليسار مخبر د.نور 3 ريل، ومتأخر: مخبر د.نور 1 ريل».
      const text = run(["c1", "c2", "c5", "c6", "c6", "c5", "c2", "c1"].map((c, k) => late(c, k)));
      const [today, chase = ""] = text.split("، ومتأخر: ");
      for (const name of chase.split(" · ").map((p) => p.replace(/ \d+ .*/, "")))
        expect(today, name).not.toContain(name);
    });

    it.fails("[TR-25] حد أقصى شركتين بالمطاردة (الكود ٣)", () => {
      // ستّ متأخرات وصل الأقدم بتعبّي اليوم، والباقي بثلاث شركات تانية.
      const text = run([...Array.from({ length: 6 }, (_, k) => late("c1", k)), late("c2", 10, 3), late("c5", 11, 3), late("c6", 12, 3)]);
      const chase = text.split("، ومتأخر: ")[1] ?? "";
      expect(chase).not.toBe("");
      expect(chase.split(" · ").filter((p) => p !== "وغيرها").length).toBeLessThanOrEqual(2);
    });
  });

  it.fails("[TR-15] الشخص يلي بعطلته اليوم ما بياخد سطر — ولو عليه متأخر", () => {
    // سابين دوامها الاثنين→الخميس بهالسيناريو، فالأحد عطلتها.
    const offSunday = EMPS.map((e) => (e.id === "s" ? emp("s", "سابين", { workDays: "[1,2,3,4]" }) : e));
    expect(brief(offSunday)).not.toContain("سابين");
  });
});

describe("٢٠:٠٠ — تقرير المنجز", () => {
  const EMPS = [emp("d", "مصمّمة"), emp("e", "مونتيرة", { role: "مونتيرة", isScheduled: false, salary: 150 }), emp("ph", "مصوّر", { role: "مصور", isPhotographer: true })];
  const COS = [co("c1", "وصل")];
  const doneAt = (iso: string, o: Record<string, unknown> = {}) =>
    task({ status: "READY", board: "DONE", finishedAt: new Date(iso), completedAt: new Date(iso), assigneeId: "d", ...o });

  it("بيعدّ المنجز بختم اليوم المحلي، و«بلا إنجاز» بيسمّي يلي ما سجّل", () => {
    const r = buildDailyDoneReport(new Date(2026, 8, 23, 20, 0), EMPS, COS, [doneAt("2026-09-23T09:00:00Z"), doneAt("2026-09-22T09:00:00Z")]);
    expect(r.count).toBe(1);
    expect(r.text).toContain("مصمّمة: وصل 1 بوست");
    expect(r.text).toContain("بلا إنجاز مسجَّل اليوم: مونتيرة · مصوّر");
  });

  it.fails("[TR-16] على خادم UTC (Vercel) مونتاج انسلّم ١:٠٩ بعد منتصف ليل دمشق بينعدّ بتقرير يومه", () => {
    // BW ريل ٣ مونتاج: ٢٣/٩ ٠١:٠٩ دمشق = ٢٢/٩ ٢٢:٠٩Z. التقرير بينبعت ١٧:٠٠Z (٢٠:٠٠ دمشق) يوم ٢٣/٩.
    process.env.TZ = "UTC";
    const r = buildDailyDoneReport(new Date("2026-09-23T17:00:00Z"), EMPS, COS, [
      doneAt("2026-09-22T22:09:51Z", { assigneeId: "e", type: "REEL", stage: "EDIT" }),
    ]);
    expect(r.count).toBe(1);
  });

  it.fails("[TR-16] نفس اليوم بتقريرين: الإقفال الإداري ما بينعدّ إنجازاً بتقرير ٢٠:٠٠ متل التقرير اليومي (§١٠)", () => {
    const tasks = [
      doneAt("2026-09-20T09:00:00Z", { notes: "أُغلق بقرار القائدة: نفدت منتجات الزبون فلن يُنتَج الستوري — أُغلق إدارياً." }),
      doneAt("2026-09-20T10:00:00Z", { notes: "سُلّم على تلغرام (بالاسم): wasl-post-9-3.jpg" }),
    ];
    const evening = buildDailyDoneReport(new Date(2026, 8, 20, 20, 0), EMPS, COS, tasks);
    const p = resolvePeriod({ kind: "day", date: "2026-09-20" }, "2026-10-12");
    if (!p.ok) throw new Error(p.error);
    const daily = buildPeriodReport({
      period: p.period, tasks: tasks as never, deliveries: [], now: new Date("2026-10-12T09:00:00Z"),
      employees: EMPS.map((e) => ({ id: e.id, name: e.name, role: e.role, isPhotographer: e.isPhotographer, isScheduled: e.isScheduled })),
      companies: COS as never,
    });
    expect(evening.count).toBe(daily.team.productionUnits + daily.team.published);
  });

  it.fails("[TR-16] «متأخر مفتوح» بتقرير ٢٠:٠٠ ما بيعدّ ستوري لسا جوّا دورتها (الستوري بالعدد لا بالترتيب، §١٠)", () => {
    // ستوري تصميمها بتاريخ المحرّك ٥/١٠ ودورتها ١/١٠ → ٣١/١٠: التقرير الدوري ما بيعدّها متأخرة،
    // وسطر ٢٠:٠٠ بيعدّها (باللقطة: ١٣/١٠ «24» مقابل ٢٢ بالتقرير اليومي — ستوري فونيتيك ١ وعبادة ٤/٧).
    const r = buildDailyDoneReport(new Date(2026, 9, 12, 20, 0), EMPS, COS, [
      task({ type: "STORY", assigneeId: "d", readyDate: new Date(2026, 9, 5), publishDate: new Date(2026, 9, 7), workDate: new Date(2026, 9, 4) }),
    ]);
    expect(r.text ?? "").not.toContain("متأخر مفتوح");
  });

  it.fails("[TR-16] تصوير مسجَّل على المونتيرة بينحسب لمصوّر الشركة بتقرير ٢٠:٠٠ متل §١٠", () => {
    const r = buildDailyDoneReport(new Date(2026, 8, 20, 20, 0), EMPS, COS, [
      doneAt("2026-09-20T09:00:00Z", { assigneeId: "e", type: "REEL", stage: "SHOOT" }),
    ]);
    expect(r.text).toContain("مصوّر: وصل 1 ريل");
  });
});
