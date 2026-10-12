/**
 * عامل فرعي لـ`scheduler-core-tz.test.ts` (مو ملف اختبار): بيبني جدول شركات الإنتاج
 * بمواعيد متل يلي بيرجّعها Prisma (منتصف ليل UTC) تحت أي TZ حطّه الأب، وبيطبع صورة
 * قانونية بأيام محلية (toISODate) + لحظات UTC لعيّنة.
 * التشغيل: node --import tsx tests/deep/scheduler-core-tz-worker.ts
 */
import { buildSchedule, type CompanyInput } from "@/lib/scheduler";
import { cyclesOf, currentCycleBucket } from "@/lib/contract";
import { addWorkdaysFor, WORK_WEEK, toISODate } from "@/lib/dates";
import { team, productionCompanies, canon } from "./scheduler-core-fixture";

const asPrisma = (d: Date | string | null | undefined): Date | null => (d instanceof Date ? new Date(`${toISODate(d)}T00:00:00.000Z`) : (d as null));
const companies: CompanyInput[] = productionCompanies().map((c) => ({
  ...c,
  publishStartDate: asPrisma(c.publishStartDate as Date | null),
  contractStartDate: asPrisma(c.contractStartDate as Date | null),
}));
const out: Record<string, unknown> = {};
out.offsetMin = new Date(2026, 9, 11).getTimezoneOffset();
out.cycles = companies.map((c) => cyclesOf(c).map((x) => `${toISODate(x.start)}→${toISODate(x.end)}${x.coldStart ? "*" : ""}`).join(" "));
// 00:30 بدمشق يوم 10/10 (بداية دورة BW) = 21:30Z يوم 9/10
out.bwBucketAt0030Damascus = currentCycleBucket(companies.find((c) => c.id === "c_bw")!, new Date("2026-10-09T21:30:00.000Z"));
out.workdays = toISODate(addWorkdaysFor(new Date("2026-10-29T00:00:00.000Z"), 2, WORK_WEEK));
const schedules: string[] = [];
for (const month of [8, 9]) schedules.push(canon(buildSchedule({ year: 2026, month, employees: team(), companies, adhoc: [] })));
out.schedule = schedules;
const r = buildSchedule({ year: 2026, month: 9, employees: team(), companies, adhoc: [] });
out.firstPublishInstant = r.tasks.filter((t) => t.publishDate).map((t) => t.publishDate!.toISOString()).sort()[0];
console.log(JSON.stringify(out));
