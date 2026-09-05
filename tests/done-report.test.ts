import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { buildDailyDoneReport } from "../src/lib/telegram/done-report";
import type { Company, Employee, Task } from "../src/types";

const emp = (id: string, name: string) => ({ id, name, workDays: "[6,0,1,2,3]" }) as unknown as Employee;
const co = (id: string, name: string) => ({ id, name, managed: true }) as unknown as Company;

const task = (o: Record<string, unknown>) =>
  ({
    id: `t_${Math.abs(JSON.stringify(o).length)}_${o.title ?? o.pieceNo ?? ""}`,
    kind: "CONTENT",
    stage: "PUBLISH",
    status: "NOT_STARTED",
    board: "TODO",
    type: "POST",
    month: 7,
    year: 2026,
    pieceNo: 1,
    ...o,
  }) as unknown as Task;

const EMPS = [emp("e_omar", "عمر"), emp("e_hla", "حلا"), emp("e_sabin", "سابين")];
const COS = [co("c1", "وصل")];
const TODAY = new Date("2026-08-10T18:00:00");
const done = { status: "PUBLISHED", board: "DONE", completedAt: new Date("2026-08-10T12:00:00") };

describe("تقرير المنجَز اليومي", () => {
  it("بيعرض عمر وحلا وبس — مو كل الفريق", () => {
    const r = buildDailyDoneReport(TODAY, EMPS, COS, [
      task({ assigneeId: "e_omar", companyId: "c1", title: "نشر بوست", ...done }),
      task({ assigneeId: "e_sabin", companyId: "c1", title: "تصميم سابين", ...done }),
    ]);
    expect(r.text).toContain("عمر");
    expect(r.text).toContain("حلا");
    expect(r.text).not.toContain("سابين");
  });

  it("«خلص اليوم» بالختم الفعلي لا بالموعد المخطّط", () => {
    const r = buildDailyDoneReport(TODAY, EMPS, COS, [
      // موعده اليوم بس ما انخلص — بينحسب «لسا عليه» مو «خلص».
      task({ assigneeId: "e_omar", companyId: "c1", title: "لسا مفتوح", publishDate: new Date("2026-08-10") }),
      // انخلص اليوم فعلاً.
      task({ assigneeId: "e_omar", companyId: "c1", title: "انخلص", ...done }),
      // انخلص إمبارح — برّا تقرير اليوم.
      task({
        assigneeId: "e_omar",
        companyId: "c1",
        title: "إمبارح",
        status: "PUBLISHED",
        board: "DONE",
        completedAt: new Date("2026-08-09T12:00:00"),
      }),
    ]);
    expect(r.count).toBe(1);
    expect(r.text).toContain("انخلص");
    expect(r.text).toContain("لسا عليه اليوم");
    expect(r.text).not.toContain("إمبارح");
  });

  it("بيقول «ما سجّل ولا إنجاز» بدل ما يسكت", () => {
    // السكوت بيتقرا «ما وصل التقرير»؛ الجملة بتقرا «وصل وما في شي».
    const r = buildDailyDoneReport(TODAY, EMPS, COS, []);
    expect(r.text).toContain("ما سجّل ولا إنجاز اليوم");
    expect(r.count).toBe(0);
  });

  it("المتأخر بالعدد بس — تفصيله بالبريف الصباحي", () => {
    const r = buildDailyDoneReport(TODAY, EMPS, COS, [
      task({ assigneeId: "e_hla", companyId: "c1", title: "متأخر قديم", readyDate: new Date("2026-07-01") }),
    ]);
    expect(r.text).toContain("متأخر عليه: 1");
    expect(r.text).not.toContain("• متأخر قديم");
  });
});

describe("الجدولة والوجهة", () => {
  it("٥ مساءً دمشق = 14:00 UTC", () => {
    const v = JSON.parse(readFileSync("vercel.json", "utf8")) as { crons: { path: string; schedule: string }[] };
    const c = v.crons.find((x) => x.path.includes("done-report"));
    expect(c?.schedule).toBe("0 14 * * *");
    // نفس الفارق يلي عليه البريف الصباحي (04:45 UTC ⇒ 07:45 دمشق).
    expect(v.crons.find((x) => x.path.includes("wave=general"))?.schedule).toBe("45 4 * * *");
  });

  it("بيروح لخاصّ القائدة لا للمجموعة", () => {
    const src = readFileSync("src/lib/telegram/service.ts", "utf8");
    const start = src.indexOf("export async function sendDailyDoneReport");
    const fn = src.slice(start, src.indexOf("\nexport async function", start + 1));
    expect(fn).toContain("getLeadChatId");
    // البحث عن **استعلام توبيك الفريق** بالذات، مو عن كلمة `isTeam` كنصّ:
    // `isTeamOffDay` (حارس العطلة) فيها نفس الحروف وما إلها علاقة بوجهة الرسالة.
    expect(fn).not.toMatch(/isTeam\s*:\s*true/);
    expect(fn).not.toContain("telegramChat.findFirst");
  });
});

describe("الشغل متعدّد الأيام", () => {
  it("بيضلّ يبان طول مدّته لا بيومه الأول وبس", () => {
    // «تصميم موقع كابرياني» ٤٠ ساعة = خمس أيام بس يومها المخزّن واحد (٩/٨).
    // بلا هالقاعدة بتختفي حلا من التقرير وهي تحت الشغل.
    const multi = task({
      assigneeId: "e_hla",
      kind: "ADHOC",
      stage: "DESIGN",
      title: "تصميم موقع كابرياني",
      hours: 40,
      workDate: new Date("2026-08-09"),
    });
    const day3 = buildDailyDoneReport(new Date("2026-08-11T18:00:00"), EMPS, COS, [multi]);
    expect(day3.text).toContain("تصميم موقع كابرياني");
    // وبعد ما تخلص مدّته ما بيضلّ يطلع.
    const after = buildDailyDoneReport(new Date("2026-08-20T18:00:00"), EMPS, COS, [multi]);
    expect(after.text).not.toContain("تصميم موقع كابرياني");
  });
});

describe("حصيلة الفريق — بقسم حلا وحده", () => {
  const day = { status: "READY", board: "DONE", completedAt: new Date("2026-08-10T12:00:00") };
  const COS2 = [co("c1", "وصل"), co("c2", "البلسم"), co("c3", "برو")];
  const TASKS = [
    task({ assigneeId: "e_sabin", companyId: "c2", stage: "DESIGN", type: "POST", ...day }),
    task({ assigneeId: "e_sabin", companyId: "c2", stage: "DESIGN", type: "POST", pieceNo: 2, ...day }),
    task({ assigneeId: "e_sabin", companyId: "c3", stage: "DESIGN", type: "POST", pieceNo: 3, ...day }),
    task({ assigneeId: "e_majed", companyId: "c1", stage: "SHOOT", type: "REEL", ...day }),
    task({ assigneeId: "e_majed", companyId: "c1", stage: "SHOOT", type: "REEL", pieceNo: 2, ...day }),
  ];

  it("بتجمّع بالمرحلة ثم الشركة مع العدد", () => {
    const r = buildDailyDoneReport(TODAY, EMPS, COS2, TASKS);
    expect(r.text).toContain("حصيلة الفريق اليوم");
    expect(r.text).toContain("تصميم: البلسم 2 بوست · برو 1 بوست");
    expect(r.text).toContain("تصوير: وصل 2 ريل");
  });

  it("بترتيب السلسلة: تصميم قبل تصوير", () => {
    const t = buildDailyDoneReport(TODAY, EMPS, COS2, TASKS).text!;
    expect(t.indexOf("تصميم:")).toBeLessThan(t.indexOf("تصوير:"));
  });

  it("بتطلع بقسم حلا وبس — عمر بيهمّه شغله هو", () => {
    const t = buildDailyDoneReport(TODAY, EMPS, COS2, TASKS).text!;
    expect(t.indexOf("حصيلة الفريق اليوم")).toBeGreaterThan(t.indexOf("■ حلا"));
  });
});

describe("تسليمات تلغرام — التقرير بيشوفها ولو ما طابقت", () => {
  // القائدة (11/8): أيمن بعت صورة على Siizen والتقرير ما ذكرها، ولا شو باعتة
  // سابين. السبب: التقرير كان يقرا الكروت المسكّرة وبس — والملف يلي ما طابق
  // كرتاً ما بيسكّر شي فبيختفي كأنّو ما وصل.
  const d = (o: Partial<import("../src/lib/telegram/done-report").DeliveryLine>) => ({
    senderName: "أيمن", companyName: "Siizen", kind: "PHOTO", fileName: null, matched: false, ...o,
  });

  it("الملف غير المطابق بيظهر معلَّماً — مو مخفياً", () => {
    const r = buildDailyDoneReport(TODAY, EMPS, COS, [], undefined, [d({})]);
    expect(r.text).toContain("تلغرام اليوم: 1 ملف — منها 1 غير مطابق ⚠️");
    expect(r.text).toContain("Siizen: أيمن 1 (1 غير مطابق)");
  });

  it("الصفر بينكتب صراحةً — يوم بلا تسليمات خبرٌ لا فراغ", () => {
    const r = buildDailyDoneReport(TODAY, EMPS, COS, []);
    expect(r.text).toContain("تلغرام اليوم: ولا ملف وصل.");
  });

  it("النصوص ما بتتحسب ملفات", () => {
    const r = buildDailyDoneReport(TODAY, EMPS, COS, [], undefined, [d({ kind: "TEXT" })]);
    expect(r.text).toContain("ولا ملف وصل");
  });
});
