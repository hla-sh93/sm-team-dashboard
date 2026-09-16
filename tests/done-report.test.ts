/**
 * تقرير الإنجاز المسائي — القائدة (١٦/٩/٢٠٢٦): «المسا الساعة 8 تقرير الإنجاز.
 * باختصار وبساطة» و«خلي المهام باسم الشركة والعدد بلا ترقيم كل بوست».
 */
import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { buildDailyDoneReport } from "../src/lib/telegram/done-report";
import type { Company, Employee, Task } from "../src/types";

const emp = (id: string, name: string, over: Record<string, unknown> = {}) =>
  ({ id, name, role: "designer", workDays: "[0,1,2,3,4]", isScheduled: true, salary: 200, ...over }) as unknown as Employee;
const co = (id: string, name: string) => ({ id, name, managed: true, status: "active", publishStartDate: new Date(2026, 6, 1) }) as unknown as Company;

let seq = 0;
const task = (o: Record<string, unknown>) =>
  ({
    id: `t_${++seq}`,
    kind: "CONTENT",
    stage: "DESIGN",
    status: "NOT_STARTED",
    board: "TODO",
    type: "POST",
    month: 7,
    year: 2026,
    pieceNo: seq,
    quantity: 1,
    ...o,
  }) as unknown as Task;

const EMPS = [
  emp("e_omar", "عمر", { role: "publisher" }),
  emp("e_hla", "حلا", { role: "تيم ليدر + نص مصمم" }),
  emp("e_sabin", "سابين"),
  emp("e_sales", "سارة", { role: "sales", isScheduled: false }),
  emp("e_free", "ألبير", { role: "photographer", isScheduled: false, salary: 0 }),
];
const COS = [co("c1", "وصل"), co("c2", "البلسم"), co("c3", "التدريب")];
const TODAY = new Date("2026-08-10T20:00:00");
const done = { status: "READY", board: "DONE", completedAt: new Date("2026-08-10T12:00:00") };

describe("تقرير الإنجاز — سطر لكل شخص بالشركة والعدد", () => {
  it("بيجمع المنجَز بالشركة والنوع بلا أسماء قطع، وبيسمّي مين ما سجّل شي", () => {
    const r = buildDailyDoneReport(TODAY, EMPS, COS, [
      task({ assigneeId: "e_sabin", companyId: "c2", ...done }),
      task({ assigneeId: "e_sabin", companyId: "c2", ...done }),
      task({ assigneeId: "e_sabin", companyId: "c2", type: "STORY", ...done }),
      task({ assigneeId: "e_sabin", companyId: "c3", kind: "ADHOC", type: null, title: "تصميم إعلان: التحول الرقمي", ...done }),
      task({ assigneeId: "e_omar", companyId: "c1", stage: "PUBLISH", status: "PUBLISHED", board: "DONE", completedAt: done.completedAt }),
    ]);
    expect(r.count).toBe(5);
    expect(r.text).toContain("تقرير الإنجاز — الاثنين 10/8");
    expect(r.text).toContain("سابين: البلسم 2 بوست و1 ستوري · التدريب 1 تصميم");
    expect(r.text).toContain("عمر (نشر): وصل 1 بوست");
    expect(r.text).toContain("بلا إنجاز مسجَّل اليوم: حلا");
    // بلا ترقيم قطع ولا عناوين كروت.
    expect(r.text).not.toMatch(/بوست-\d/);
    expect(r.text).not.toContain("التحول الرقمي");
  });

  it("لكل فريق الإنتاج — السيلز والفريلانس برّا", () => {
    const r = buildDailyDoneReport(TODAY, EMPS, COS, []);
    expect(r.text).toContain("عمر");
    expect(r.text).toContain("سابين");
    expect(r.text).not.toContain("سارة");
    expect(r.text).not.toContain("ألبير");
  });

  it("«خلص اليوم» بالختم الفعلي لا بالموعد المخطّط", () => {
    const r = buildDailyDoneReport(TODAY, EMPS, COS, [
      task({ assigneeId: "e_omar", companyId: "c1", stage: "PUBLISH", publishDate: new Date("2026-08-10") }),
      task({ assigneeId: "e_omar", companyId: "c1", stage: "PUBLISH", status: "PUBLISHED", board: "DONE", completedAt: done.completedAt }),
      task({ assigneeId: "e_omar", companyId: "c1", stage: "PUBLISH", status: "PUBLISHED", board: "DONE", completedAt: new Date("2026-08-09T12:00:00") }),
    ]);
    expect(r.count).toBe(1);
    expect(r.text).toContain("عمر (نشر): وصل 1 بوست");
    expect(r.text).toContain("لسا مفتوح على اليوم: عمر 1");
  });

  it("المتأخر بالعدد بالشركة — بلا قوائم", () => {
    const r = buildDailyDoneReport(TODAY, EMPS, COS, [
      task({ assigneeId: "e_hla", companyId: "c1", title: "متأخر قديم", readyDate: new Date("2026-07-01") }),
      task({ assigneeId: "e_sabin", companyId: "c2", readyDate: new Date("2026-08-01") }),
      task({ assigneeId: "e_sabin", companyId: "c2", readyDate: new Date("2026-08-02") }),
    ]);
    expect(r.text).toContain("متأخر مفتوح: 3 — البلسم 2 · وصل 1");
    expect(r.text).not.toContain("متأخر قديم");
  });

  it("الشغل متعدّد الأيام بيضلّ «مفتوح على اليوم» طول مدّته", () => {
    const multi = task({ assigneeId: "e_hla", kind: "ADHOC", type: null, title: "تصميم موقع كابرياني", hours: 40, workDate: new Date("2026-08-09") });
    expect(buildDailyDoneReport(new Date("2026-08-11T20:00:00"), EMPS, COS, [multi]).text).toContain("لسا مفتوح على اليوم: حلا 1");
    expect(buildDailyDoneReport(new Date("2026-08-20T20:00:00"), EMPS, COS, [multi]).text).not.toContain("لسا مفتوح على اليوم");
  });

  it("ولا ملفات تلغرام ولا حصيلة بالمرحلة — المرسَل للتقرير بينتجاهل", () => {
    const r = buildDailyDoneReport(TODAY, EMPS, COS, [], undefined, [
      { senderName: "أيمن", companyName: "Siizen", kind: "PHOTO", fileName: null, matched: false },
    ]);
    expect(r.text).not.toContain("تلغرام");
    expect(r.text).not.toContain("حصيلة");
  });
});

describe("الجدولة والوجهة", () => {
  it("٨ مساءً دمشق = 17:00 UTC، والصبح رسالة وحدة ٧:٤٥", () => {
    const v = JSON.parse(readFileSync("vercel.json", "utf8")) as { crons: { path: string; schedule: string }[] };
    expect(v.crons.find((x) => x.path.includes("done-report"))?.schedule).toBe("0 17 * * *");
    expect(v.crons.find((x) => x.path.includes("wave=general"))?.schedule).toBe("45 4 * * *");
    // موجة التفاصيل ما عادت مجدولة (القائدة ١٦/٩: «خفف كمية الرسائل»).
    expect(v.crons.find((x) => x.path.includes("wave=detail"))).toBeUndefined();
  });

  it("بيروح لخاصّ القائدة لا للمجموعة", () => {
    const src = readFileSync("src/lib/telegram/service.ts", "utf8");
    const start = src.indexOf("export async function sendDailyDoneReport");
    const fn = src.slice(start, src.indexOf("\nexport async function", start + 1));
    expect(fn).toContain("getLeadChatId");
    expect(fn).not.toMatch(/isTeam\s*:\s*true/);
    expect(fn).not.toContain("telegramChat.findFirst");
  });
});
