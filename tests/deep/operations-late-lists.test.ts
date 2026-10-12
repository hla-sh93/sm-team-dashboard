/**
 * الفحص العميق — العمليات · «متأخر» بكل شاشة: نفس الكرت، نفس اليوم، تعريف واحد؟
 *
 * لوحة الاتساق (cross-feature consistency matrix) على تجهيزة صغيرة بشكل مخبر د.نور
 * يوم الأحد ١١/١٠/٢٠٢٦: دورة ٢٣/٩ → ٢٢/١٠ شغّالة بدلو أيلول (m=8).
 *
 *   البريف + لوحة الرئيسية + ملخّص تلغرام → `openLateTasks` (summary.ts) / `makeBlockedPredicate`
 *   «متابعة اليوم» (/today)               → today-client.tsx (الفلتر منسوخ حرفياً)
 *   شريط «متأخر النشر» (/publishing)      → publishing-client.tsx (الفلتر منسوخ حرفياً)
 *   شارة «متأخّر» على اللوح               → KanbanBoard.tsx `isLate` (منسوخ حرفياً)
 *   تقرير الإنجاز الدوري (§١٠)            → `buildPeriodReport`
 *
 * الاصطلاح: `it.fails` = عطل مفتوح موثَّق ([OP-nn])؛ اقلبه لـ`it` لما ينصلح.
 * التقرير: `docs/qa/deep-test-2026-10-11/operations.md`.
 */
import { describe, expect, it } from "vitest";
import { isTaskDoneState, isTaskLateState } from "@/lib/constants";
import { isDormantCompany } from "@/lib/company-visibility";
import { cycleForBucket } from "@/lib/contract";
import { toISODate } from "@/lib/dates";
import { buildPeriodReport, resolvePeriod } from "@/lib/period-report";
import { openLateTasks } from "@/lib/telegram/summary";
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

// ---- الفلاتر كما هي بالشاشات (منسوخة حرفياً) ----
const iso = (v: Date | null) => (v ? toISODate(v) : null);
/** today-client.tsx: `open` ثم `overdue` لكل شركة مُدارة غير راكدة. */
const todayOverdue = (ts: Task[]) => {
  const open = ts.filter((t) => !isTaskDoneState(t) && t.status !== "CANCELED");
  const deadlineOf = (t: Task) =>
    t.stage === "PUBLISH" ? (iso(t.publishDate) ?? iso(t.readyDate)) : (iso(t.readyDate) ?? iso(t.publishDate));
  return companies
    .filter((c) => c.managed && !isDormantCompany(c))
    .flatMap((co) => open.filter((t) => t.companyId === co.id))
    .filter((t) => {
      const dl = deadlineOf(t);
      return dl != null && dl < TODAY_ISO;
    });
};
/** publishing-client.tsx `overdue` (الشقّ «تجاوز موعده»). */
const publishingStrip = (ts: Task[]) =>
  ts.filter(
    (t) => t.stage === "PUBLISH" && t.publishDate && !isTaskDoneState(t) && toISODate(new Date(t.publishDate)) < TODAY_ISO,
  );
/** KanbanBoard.tsx `isLate` (مع اليوم الثابت بدل `new Date()`). */
const boardIsLate = (t: Task) => {
  if (!isTaskLateState(t, TODAY)) return false;
  if (isDormantCompany(company)) return false;
  const cyc = cycleForBucket(company, t.year, t.month);
  const activeCycle = !!cyc && TODAY >= cyc.start && TODAY < cyc.end;
  if (activeCycle && t.board === "TODO" && t.status === "NOT_STARTED") return false;
  return true;
};
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
    expect(ids(openLateTasks(tasks, companies, TODAY))).toEqual(["designLate"]);
    expect(ids(todayOverdue(tasks))).toEqual(["designLate", "pinnedLater", "pubBlocked", "pubChain"]);
    expect(ids(publishingStrip(tasks))).toEqual(["pubBlocked", "pubChain"]);
    expect(ids(tasks.filter(boardIsLate))).toEqual([]);
    const rep = periodReport();
    expect(rep.team.openLate).toBe(2); // designLate + pubChain
    const per = Object.fromEntries(rep.people.map((p) => [p.id, p.openLate]));
    expect([per.omar, per.sabine]).toEqual([1, 1]);
  });
});

describe("[OP-12] «متابعة اليوم» وشريط «متأخر النشر» بيعدّوا المحجوز (B02 راجعة جزئياً)", () => {
  it.fails("[OP-12] /today «متأخر» لازم يطابق تعريف البريف: بلا المحجوز وبلا المثبّت ليوم لاحق — عطل مفتوح", () => {
    expect(ids(todayOverdue(tasks))).toEqual(ids(openLateTasks(tasks, companies, TODAY)));
  });

  it.fails("[OP-12] /publishing «متأخر النشر» ما لازم يطلب نشر قطعة مونتاجها لسا مفتوح — عطل مفتوح", () => {
    expect(ids(publishingStrip(tasks))).not.toContain("pubBlocked");
  });
});

describe("[OP-16] شارة «متأخّر» على اللوح بتسكت عن كل كرت «لم يبدأ» بدورة شغّالة", () => {
  it.fails("[OP-16] تصميم موعده ٥/١٠ ولا شي بيحجزه: البريف والرئيسية و§١٠ بيقولوا متأخر، واللوح لازم يقول متلهن — عطل مفتوح", () => {
    expect(boardIsLate(tasks.find((t) => t.id === "designLate")!)).toBe(true);
  });
});

describe("[OP-10] الحجز «بالسلسلة» (البريف/الرئيسية) مقابل الحاجز المباشر (§١٠)", () => {
  it("التقرير الدوري بيعدّ نشر الريل يلي مونتاجه منجز متأخراً على عمر", () => {
    const rep = periodReport();
    expect(rep.people.find((p) => p.id === "omar")?.openLate).toBe(1);
  });

  it.fails("[OP-10] البريف/الرئيسية لازم يشوفوا نفس الكرت متأخر — السلسلة بتعبر المونتاج المنجز لكتابة الدورة المفتوحة — عطل مفتوح", () => {
    expect(ids(openLateTasks(tasks, companies, TODAY))).toContain("pubChain");
  });
});
