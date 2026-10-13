/**
 * الفحص العميق — العمليات · «متأخر» بكل شاشة: نفس الكرت، نفس اليوم، تعريف واحد؟
 *
 * لوحة الاتساق (cross-feature consistency matrix) على تجهيزة صغيرة بشكل مخبر د.نور
 * يوم الأحد ١١/١٠/٢٠٢٦: دورة ٢٣/٩ → ٢٢/١٠ شغّالة بدلو أيلول (m=8).
 *
 *   البريف + لوحة الرئيسية + ملخّص تلغرام → `openLateTasks` (summary.ts) / `makeBlockedPredicate`
 *   «متابعة اليوم» (/today)               → today-client.tsx (الفلتر منسوخ حرفياً)
 *   شريط «متأخر النشر» (/publishing)      → `makeLateClassifier` (lib/late.ts، من ١٢/١٠)
 *   شارة «متأخّر» على اللوح               → `makeLatePredicate` (lib/late.ts، من ١٢/١٠)
 *   تقرير الإنجاز الدوري (§١٠)            → `buildPeriodReport`
 *
 * الاصطلاح: `it.fails` = عطل مفتوح موثَّق ([OP-nn])؛ اقلبه لـ`it` لما ينصلح.
 * التقرير: `docs/qa/deep-test-2026-10-11/operations.md`.
 */
import { describe, expect, it } from "vitest";
import { isTaskDoneState } from "@/lib/constants";
import { isDormantCompany } from "@/lib/company-visibility";
import { toISODate } from "@/lib/dates";
import { buildPeriodReport, resolvePeriod } from "@/lib/period-report";
import { openLateTasks } from "@/lib/telegram/summary";
import { loadBlockerChain, makeLateClassifier, makeLatePredicate } from "@/lib/late";
import { readFileSync } from "node:fs";
import type { Company, Task } from "@/types";

const TODAY = new Date(2026, 9, 11, 9, 0, 0); // الأحد ١١/١٠
const TODAY_ISO = toISODate(TODAY);

const company = {
  id: "co",
  name: "مخبر",
  managed: true,
  status: "active",
  priority: 1,
  contractStartDate: new Date(2026, 8, 23),
  publishStartDate: new Date(2026, 8, 23),
  renewals: null,
  contractEndedAt: null,
  lateExemptReason: null,
  photographerId: null,
  posts: 4,
  reels: 4,
  stories: 0,
  aiReels: 0,
} as unknown as Company;
const companies = [company];

const base = {
  kind: "CONTENT",
  type: "REEL",
  title: null,
  hours: 0,
  quantity: 1,
  priority: "NORMAL",
  status: "NOT_STARTED",
  board: "TODO",
  workDate: null,
  readyDate: null,
  publishDate: null,
  manualDay: null,
  isPinned: false,
  isAuto: true,
  blockedById: null,
  pipelineKey: null,
  pieceNo: null,
  notes: null,
  completedAt: null,
  startedAt: null,
  finishedAt: null,
  companyId: "co",
  year: 2026,
  month: 8,
};
const d = (day: number, m = 9) => new Date(2026, m, day);
const done = { status: "READY", board: "DONE", startedAt: d(9), finishedAt: d(9), completedAt: d(9) };
const task = (over: Record<string, unknown>) => ({ ...base, ...over }) as unknown as Task;

const tasks: Task[] = [
  // سلسلة ريل ١: الكتابة (كرت دورة) مفتوحة، التصوير والمونتاج منجزان → الدور على عمر (§٦).
  task({ id: "write", kind: "CONTENT_WRITING", stage: "WRITE", type: null, assigneeId: "nawal", readyDate: d(20) }),
  task({ id: "shoot1", stage: "SHOOT", assigneeId: "majed", blockedById: "write", ...done }),
  task({ id: "edit1", stage: "EDIT", assigneeId: "alissar", blockedById: "shoot1", ...done }),
  task({ id: "pubChain", kind: "PUBLISH", stage: "PUBLISH", assigneeId: "omar", blockedById: "edit1", publishDate: d(7), readyDate: d(7) }),
  // سلسلة ريل ٢: المونتاج لسا مفتوح (ومو متأخر) → النشر محجوز مباشرة.
  task({ id: "shoot2", stage: "SHOOT", assigneeId: "majed", ...done }),
  task({ id: "edit2", stage: "EDIT", assigneeId: "alissar", blockedById: "shoot2", readyDate: d(15), workDate: d(15) }),
  task({ id: "pubBlocked", kind: "PUBLISH", stage: "PUBLISH", assigneeId: "omar", blockedById: "edit2", publishDate: d(8), readyDate: d(8) }),
  // تصميم فات موعده ولا شي بيحجزه — متأخر بكل تعريف موثَّق.
  task({ id: "designLate", type: "POST", stage: "DESIGN", assigneeId: "sabine", readyDate: d(5), workDate: d(5) }),
  // تصميم فات موعده بس القائدة ثبّتته ليوم لاحق (pinnedForLater · §١٠ «المثبّت بالإيد ليوم أبعد»).
  task({ id: "pinnedLater", type: "POST", stage: "DESIGN", assigneeId: "sabine", readyDate: d(5), workDate: d(14), isPinned: true }),
];

// ---- الفلاتر كما هي بالشاشات ----
/** شريط «متأخر النشر» و«متابعة اليوم»: المصنّف المشترك (والمحجوز «بانتظار»، مو متأخر). */
const classify = makeLateClassifier(tasks, companies, TODAY);
/** today-client.tsx: `open` ثم `overdue` لكل شركة مُدارة غير راكدة — بالمصنّف المشترك (OP-12). */
const todayOverdue = (ts: Task[]) => {
  const open = ts.filter((t) => !isTaskDoneState(t) && t.status !== "CANCELED");
  return companies
    .filter((c) => c.managed && !isDormantCompany(c))
    .flatMap((co) => open.filter((t) => t.companyId === co.id))
    .filter((t) => classify(t) === "late");
};
const publishingStrip = (ts: Task[]) =>
  ts.filter((t) => t.stage === "PUBLISH" && t.publishDate && classify(t) === "late");
/** شارة «متأخّر» على اللوح. */
const boardIsLate = makeLatePredicate(tasks, companies, TODAY);
const ids = (ts: Task[]) => ts.map((t) => t.id).sort();

const employees = ["nawal", "majed", "alissar", "omar", "sabine"].map((id) => ({
  id,
  name: id,
  role: id === "omar" ? "publisher" : "designer",
  isPhotographer: id === "majed",
  isScheduled: true,
}));
const periodReport = () => {
  const p = resolvePeriod({ kind: "month", date: TODAY_ISO }, TODAY_ISO);
  if (!p.ok) throw new Error(p.error);
  return buildPeriodReport({
    period: p.period,
    tasks: tasks as never,
    employees,
    companies: companies as never,
    deliveries: [],
    now: TODAY,
  });
};

describe("لوحة تعريفات «متأخر» — السلوك الحالي (مرجع للمقارنة)", () => {
  it("كل شاشة بتطلّع مجموعتها هيك اليوم", () => {
    expect(ids(openLateTasks(tasks, companies, TODAY))).toEqual(["designLate", "pubChain"]);
    expect(ids(todayOverdue(tasks))).toEqual(["designLate", "pubChain"]);
    expect(ids(publishingStrip(tasks))).toEqual(["pubChain"]);
    expect(ids(tasks.filter(boardIsLate))).toEqual(["designLate", "pubChain"]);
    const rep = periodReport();
    expect(rep.team.openLate).toBe(2); // designLate + pubChain
    const per = Object.fromEntries(rep.people.map((p) => [p.id, p.openLate]));
    expect([per.omar, per.sabine]).toEqual([1, 1]);
  });
});

describe("[OP-12] «متابعة اليوم» وشريط «متأخر النشر» بيعدّوا المحجوز (B02 راجعة جزئياً)", () => {
  it("[OP-12] /today «متأخر» بيطابق تعريف البريف: بلا المحجوز وبلا المثبّت ليوم لاحق", () => {
    expect(ids(todayOverdue(tasks))).toEqual(ids(openLateTasks(tasks, companies, TODAY)));
    expect(classify(tasks.find((t) => t.id === "pinnedLater")!)).toBeNull();
    const src = readFileSync("src/app/today/today-client.tsx", "utf8");
    expect(src).toMatch(/makeLateClassifier\(tasks, companies, today\)/);
    expect(src).toMatch(/\.filter\(\(t\) => lateClass\(t\) === "late"\)/);
    // الفلتر القديم بالموعد لحاله راح.
    expect(src).not.toMatch(/return d != null && d < todayISO;/);
  });

  it("[OP-12] /publishing «متأخر النشر» ما بيطلب نشر قطعة مونتاجها لسا مفتوح — بتطلع «بانتظار»", () => {
    expect(ids(publishingStrip(tasks))).not.toContain("pubBlocked");
    expect(classify(tasks.find((t) => t.id === "pubBlocked")!)).toBe("waiting");
    const src = readFileSync("src/app/publishing/publishing-client.tsx", "utf8");
    expect(src).toMatch(/makeLateClassifier\(withChain, companies\)/);
  });
});

describe("[OP-16] شارة «متأخّر» على اللوح بتسكت عن كل كرت «لم يبدأ» بدورة شغّالة", () => {
  it("[OP-16] تصميم موعده ٥/١٠ ولا شي بيحجزه: البريف والرئيسية و§١٠ واللوح كلهن بيقولوا متأخر", () => {
    expect(boardIsLate(tasks.find((t) => t.id === "designLate")!)).toBe(true);
    const src = readFileSync("src/components/KanbanBoard.tsx", "utf8");
    expect(src).toMatch(/makeLatePredicate\(tasks, companies\)/);
    expect(src).not.toMatch(/t\.board === "TODO" && t\.status === "NOT_STARTED"\) \{\s*return false/);
  });
});

describe("[OP-10] الحجز «بالسلسلة» (البريف/الرئيسية) مقابل الحاجز المباشر (§١٠)", () => {
  it("التقرير الدوري بيعدّ نشر الريل يلي مونتاجه منجز متأخراً على عمر", () => {
    const rep = periodReport();
    expect(rep.people.find((p) => p.id === "omar")?.openLate).toBe(1);
  });

  it("[OP-10] البريف/الرئيسية بيشوفوا نفس الكرت متأخر — السلسلة ما بتعبر المونتاج المنجز لكتابة الدورة المفتوحة", () => {
    expect(ids(openLateTasks(tasks, companies, TODAY))).toContain("pubChain");
  });
});

describe("[OP-12 · مراجعة F–H] شريط النشر بيحمّل كروت النشر بس — لازم يجيب سلسلة الحاجز", () => {
  const publishOnly = tasks.filter((t) => t.stage === "PUBLISH");
  const fetchFrom = (pool: Task[]) => async (wanted: string[]) => pool.filter((t) => wanted.includes(t.id));

  it("بلا السلسلة: المحجوز بيطلع «متأخر» (هاد يلي كان صاير بالصفحة)", () => {
    expect(makeLateClassifier(publishOnly, companies, TODAY)(publishOnly.find((t) => t.id === "pubBlocked")!)).toBe("late");
  });

  it("`loadBlockerChain` بيجيب الحاجز وحاجزه بالترتيب، وبلا تكرار", async () => {
    const chain = await loadBlockerChain(publishOnly, fetchFrom(tasks));
    expect(ids(chain)).toEqual(["edit1", "edit2", "shoot1", "shoot2", "write"]);
  });

  it("مع السلسلة: «بانتظار» للمحجوز، و«متأخر» لريل ١ يلي مراحله منجزة (كرت الكتابة ما بيحجز)", async () => {
    const chain = await loadBlockerChain(publishOnly, fetchFrom(tasks));
    const classifyPage = makeLateClassifier([...publishOnly, ...chain], companies, TODAY);
    expect(classifyPage(publishOnly.find((t) => t.id === "pubBlocked")!)).toBe("waiting");
    expect(classifyPage(publishOnly.find((t) => t.id === "pubChain")!)).toBe("late");
  });

  it("الصفحة نفسها بتمرّر السلسلة للمصنّف (مو بس الملف المساعد)", () => {
    const page = readFileSync("src/app/publishing/page.tsx", "utf8");
    const client = readFileSync("src/app/publishing/publishing-client.tsx", "utf8");
    expect(page).toMatch(/loadBlockerChain\(/);
    expect(page).toMatch(/chainTasks=\{chainTasks\}/);
    expect(client).toMatch(/makeLateClassifier\(withChain/);
    expect(client).toMatch(/makeHeldReason\(withChain/);
  });
});
