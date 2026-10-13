/**
 * The "live set" of tasks for a month bucket — the exact rule every screen uses:
 *   bucket + open tails of adjacent cycles landing in this calendar month
 *   + ALL still-open work carried over from earlier buckets
 *   + the FULL bucket of any cycle that is still running today
 *   − everything that belongs to a paused / archived company.
 *
 * Extracted so the Telegram brief and the «اليوم» screen can never drift from
 * the board/overview (PROJECT.md §10). Done work of a FINISHED cycle stays
 * archived under its own month.
 */
import { prisma } from "@/lib/db";
import { isTaskDoneState } from "@/lib/constants";
import { monthContinuationWhere, openCarryoverWhere } from "@/lib/month";
import { currentCycleBucket } from "@/lib/contract";
import { dormantCompanyIds, isDormantCompany } from "@/lib/company-visibility";
import { teamToday } from "@/lib/team-day";

/**
 * دلاء الدورات الشغّالة اليوم يلي مو نفس الدلو المعروض.
 *
 * دورة سايزن ١٩/٨ → ١٨/٩ يعني دلوها m=7 (آب)، واللوح بيفتح على الشهر التقويمي
 * (أيلول، m=8). فشغلها المفتوح كان يوصل كـ«متأخر» ومنجزها لأ — والنتيجة عمود
 * «منجز» فاضي وكأنّ ما صار شي. صار فعلاً بتلات شركات دورتها بنص الشهر:
 * سايزن ١٥ كرت منجز، ومانغو ٢٩، وعبادة ٢٠ — كلهم مخفيين.
 *
 * قاعدة «المنجز بينأرشف بشهره» بتضل سارية على الدورة **المخلّصة**؛ أما الدورة
 * يلي لساتها شغّالة فإنجازها جزء منها، مو أرشيف.
 *
 * وبنفس القراءة بنعرف الشركات الموقوفة/المؤرشفة: كروتها محفوظة بالقاعدة بس ما
 * بتطلع بولا شاشة حيّة (قرار القائدة ١٥/٩) — لا باللوح ولا اليوم ولا البريف.
 */
async function companyScopes(year: number, month: number, at: Date) {
  const companies = await prisma.company.findMany({
    select: {
      id: true,
      status: true,
      managed: true,
      contractStartDate: true,
      publishStartDate: true,
      renewals: true,
      contractEndedAt: true,
    },
  });
  const running: { companyId: string; year: number; month: number }[] = [];
  for (const company of companies) {
    if (!company.managed || isDormantCompany(company, at)) continue;
    const bucket = currentCycleBucket(company as never, at);
    if (!bucket) continue;
    if (bucket.year === year && bucket.month === month) continue;
    running.push({ companyId: company.id, year: bucket.year, month: bucket.month });
  }
  return { running, dormant: dormantCompanyIds(companies, at) };
}

export async function loadLiveTasks(year: number, month: number, at: Date = teamToday()) {
  const { running, dormant } = await companyScopes(year, month, at);
  const [bucketTasks, continuationRaw, carryover, runningTasks] = await Promise.all([
    prisma.task.findMany({ where: { year, month, status: { not: "CANCELED" } } }),
    prisma.task.findMany({ where: monthContinuationWhere(year, month) }),
    prisma.task.findMany({ where: openCarryoverWhere(year, month) }),
    running.length
      ? prisma.task.findMany({
          where: {
            status: { not: "CANCELED" },
            OR: running.map((r) => ({ companyId: r.companyId, year: r.year, month: r.month })),
          },
        })
      : Promise.resolve([]),
  ]);
  const continuation = continuationRaw.filter((t) => !isTaskDoneState(t));
  const seen = new Set(bucketTasks.map((t) => t.id));
  const extras = [...continuation, ...carryover, ...runningTasks].filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
  return [...bucketTasks, ...extras].filter((t) => !(t.companyId && dormant.has(t.companyId)));
}
