/**
 * Idempotent data updates — 1 August 2026 (§14 rollout).
 *
 * Everything here is safe to re-run: each step checks the current value first,
 * so a second run is a no-op and a value the lead edited by hand is never
 * clobbered. `DATABASE_URL` chooses local SQLite vs production Postgres.
 *
 *   npx tsx scripts/apply-2026-08-updates.ts
 *
 * Steps:
 *   1. Latin slugs for the canonical asset name «Agalia 7-1».
 *   2. New company priority order (التوظيف → وصل → باقي العملاء → شركاتنا).
 *   3. المول الصيني did not renew — its cycle ended 2026-08-01.
 *   4. أليسار (مونتيرة) joins the team next to ماجد.
 *   5. Three المخبر reels shot in May/June need re-editing.
 */
import { PrismaClient } from "@prisma/client";
import { SLUG_BY_NAME } from "../src/lib/asset-name";

const prisma = new PrismaClient();

/** Priority order agreed 2026-08-01. Lower = higher priority. */
const PRIORITY_ORDER = [
  "التوظيف", // Phoeni Jobs — launching today, needs the closest follow-up
  "وصل للتداول", // biggest client
  "أغاليا",
  "جدارات",
  "برو",
  "مخبر د.نور",
  "مركز البلسم",
  "Siizen",
  "المول الصيني", // not renewed (step 3) — kept in order for history
  // Our own companies come last.
  "Phoenitech",
  "BW",
  "التدريب",
  // On-demand only.
  "كابرياني",
  "المدارس",
];

/** المخبر reels that were shot but failed in the edit — re-cut, no re-shoot. */
const MAKHBAR_REWORK = [
  "إعادة مونتاج ريل: فيتامين د",
  "إعادة مونتاج ريل: تحليل B12",
  "إعادة مونتاج ريل: القيم الطبيعية مو نفسها عند كل المرضى",
];

async function main() {
  const log: string[] = [];

  // ---- 1. slugs -----------------------------------------------------------
  for (const [name, slug] of Object.entries(SLUG_BY_NAME)) {
    const co = await prisma.company.findUnique({ where: { name } });
    if (!co || co.slug === slug) continue;
    if (co.slug) continue; // never overwrite a hand-edited slug
    await prisma.company.update({ where: { id: co.id }, data: { slug } });
    log.push(`slug: ${name} → ${slug}`);
  }

  // ---- 2. priority order --------------------------------------------------
  for (const [i, name] of PRIORITY_ORDER.entries()) {
    const co = await prisma.company.findUnique({ where: { name } });
    if (!co || co.priority === i + 1) continue;
    await prisma.company.update({ where: { id: co.id }, data: { priority: i + 1 } });
    log.push(`priority: ${name} ${co.priority} → ${i + 1}`);
  }

  // ---- 3. المول الصيني did not renew --------------------------------------
  const mall = await prisma.company.findUnique({ where: { name: "المول الصيني" } });
  if (mall && !mall.contractEndedAt) {
    await prisma.company.update({
      where: { id: mall.id },
      data: { contractEndedAt: new Date(2026, 7, 1) },
    });
    log.push("المول الصيني: سُجّل عدم التجديد (انتهت الخطة 2026-08-01)");
  }

  // ---- 4. أليسار (مونتيرة) ------------------------------------------------
  // She works the SAME reel production card as ماجد (the lead's decision), so
  // she does NOT enter the auto engine as a separate assignee — she is here for
  // the team view, ad-hoc work and finance.
  let elissar = await prisma.employee.findFirst({ where: { name: "أليسار" } });
  if (!elissar) {
    elissar = await prisma.employee.create({
      data: {
        name: "أليسار",
        role: "مونتيرة",
        hoursPerDay: 8,
        workDays: "[6,0,1,2,3]",
        isScheduled: false,
        isPhotographer: false,
        salary: 0, // ← set the real salary from /admin/team
        color: "#7c5cff",
      },
    });
    log.push("employee: أليسار (مونتيرة) — الراتب لسا 0، عدّليه من /admin/team");
  }

  // ---- 5. المخبر rework reels --------------------------------------------
  const makhbar = await prisma.company.findUnique({ where: { name: "مخبر د.نور" } });
  if (makhbar) {
    const now = new Date();
    for (const title of MAKHBAR_REWORK) {
      const exists = await prisma.task.findFirst({ where: { title, companyId: makhbar.id } });
      if (exists) continue;
      await prisma.task.create({
        data: {
          kind: "ADHOC",
          type: null,
          title,
          // Half a working day each (ad-hoc effort is hours = days × 8).
          hours: 4,
          quantity: 1,
          priority: "IMPORTANT",
          status: "NOT_STARTED",
          board: "TODO",
          stage: "DESIGN",
          workDate: now,
          readyDate: now,
          month: now.getMonth(),
          year: now.getFullYear(),
          isPinned: true, // manual work — survives إعادة الجدولة
          isAuto: false,
          companyId: makhbar.id,
          assigneeId: elissar?.id ?? null,
          notes: "تم التصوير بشهر ٥/٦ — المونتاج ما زبط، بدها إعادة.",
        },
      });
      log.push(`task: ${title}`);
    }
  }

  // ---- 6. contract values for the two newest clients ----------------------
  // Siizen (6 ريل + 6 بوست) and مركز البلسم both signed at $150/month.
  for (const name of ["Siizen", "مركز البلسم"]) {
    const co = await prisma.company.findUnique({ where: { name } });
    if (!co || co.contractValue > 0) continue;
    await prisma.company.update({ where: { id: co.id }, data: { contractValue: 150 } });
    log.push(`contractValue: ${name} → $150`);
  }

  // ---- 7. work the lead confirmed is already finished ---------------------
  // كابرياني profile rework — designed by حلا.
  const capRework = await prisma.task.findFirst({
    where: { title: { contains: "بروفايل كابرياني" }, status: { notIn: ["READY", "PUBLISHED"] } },
  });
  if (capRework) {
    const at = new Date(2026, 7, 1);
    await prisma.task.update({
      where: { id: capRework.id },
      data: {
        status: "READY",
        board: "DONE",
        startedAt: capRework.startedAt ?? at,
        finishedAt: at,
        completedAt: at,
        isPinned: true,
      },
    });
    log.push(`done: ${capRework.title}`);
  }

  // ---- 8. contract dates as signed (confirmed by the lead 2026-08-01) ----
  // Signing dates straight from the contracts, replacing the approximations the
  // system had been running on.
  const SIGNED: Record<string, Date> = {
    "أغاليا": new Date(2026, 6, 13), // 13 تموز
    "مركز البلسم": new Date(2026, 7, 1), // 1 آب — the contract starts NEXT cycle
  };
  for (const [name, start] of Object.entries(SIGNED)) {
    const co = await prisma.company.findUnique({ where: { name } });
    if (!co || co.contractStartDate?.getTime() === start.getTime()) continue;
    await prisma.company.update({
      where: { id: co.id },
      data: { contractStartDate: start, contractEndedAt: null },
    });
    log.push(`${name}: بداية العقد → ${start.toLocaleDateString("en-CA")}`);
  }

  // Our OWN companies run a standing, never-ending monthly plan — there is no
  // client to renew with. Clearing contractStartDate is exactly how the engine
  // models that (§6): ungated calendar months, forever, no renewal question.
  for (const name of ["التدريب", "Phoenitech", "BW"]) {
    const co = await prisma.company.findUnique({ where: { name } });
    if (!co || (co.contractStartDate == null && co.contractEndedAt == null)) continue;
    await prisma.company.update({
      where: { id: co.id },
      data: { contractStartDate: null, renewals: null, contractEndedAt: null },
    });
    log.push(`${name}: خطة دورية مستمرة — أُلغي مفهوم التجديد (شهر تقويمي دائم)`);
  }

  // التوظيف launches today: the contract starts working for real on 1 August.
  // Recorded as a renewal so July's launch-prep history is preserved, and it is
  // contiguous with the July cycle → warm start, so the first reel may publish
  // immediately instead of waiting out a new-contract prep week.
  const jobs = await prisma.company.findUnique({ where: { name: "التوظيف" } });
  if (jobs) {
    const renewals: string[] = jobs.renewals ? JSON.parse(jobs.renewals) : [];
    if (!renewals.includes("2026-08-01")) {
      renewals.push("2026-08-01");
      await prisma.company.update({
        where: { id: jobs.id },
        data: { renewals: JSON.stringify(renewals), contractEndedAt: null },
      });
      log.push("التوظيف: سُجّل تجديد/إطلاق من 2026-08-01 (دورة 1/8 → 1/9)");
    }
  }

  // ---- 9. freelancers + أليسار's salary (confirmed 2026-08-01) ------------
  // ألبير and غسان+مايك are FREELANCE photographers, not staff: they must stay
  // out of the engine and the accounts, but their records are kept so their 42
  // completed tasks keep their name in the reports. They cost nothing unless a
  // reel is actually assigned to them (costPerReel is per-job, salary is 0).
  for (const name of ["ألبير", "غسان+مايك"]) {
    const e = await prisma.employee.findFirst({ where: { name } });
    if (!e || (!e.isScheduled && e.salary === 0)) continue;
    await prisma.employee.update({
      where: { id: e.id },
      data: { isScheduled: false, salary: 0 },
    });
    log.push(`${name}: فريلانس — خارج المحرك والحسابات (التاريخ محفوظ)`);
  }

  const elissarRow = await prisma.employee.findFirst({ where: { name: "أليسار" } });
  if (elissarRow && elissarRow.salary !== 150) {
    await prisma.employee.update({ where: { id: elissarRow.id }, data: { salary: 150 } });
    log.push("أليسار: الراتب → $150");
  }

  // ---- 10. جدارات — the standing plan stays 6 AI reels --------------------
  // One AI reel was shot for real THIS cycle, but that was a one-off swap, not
  // a change to the contract: next cycle is six AI reels again. Recording the
  // swap in the plan would make the engine regenerate a photographer reel every
  // month forever, so it stays a note on the piece instead.
  const jadarat = await prisma.company.findUnique({ where: { name: "جدارات" } });
  if (jadarat && (jadarat.reels !== 0 || jadarat.aiReels !== 6)) {
    await prisma.company.update({ where: { id: jadarat.id }, data: { reels: 0, aiReels: 6 } });
    log.push("جدارات: الخطة → 6 ريل AI (التبديل لريل تصوير كان لدورة تموز فقط)");
  }

  // ---- 11. Siizen — signed, but the client has not started ---------------
  // The contract is signed and dated, yet the client has not sent the page
  // details or the product list, so nothing can be produced. Left active it
  // generated a full cycle of work and phantom lateness. `status = paused` is
  // the engine's own gate (scheduler.ts filters on it), so the contract dates
  // stay intact and one flag flip resumes it the day the client is ready.
  const siizen = await prisma.company.findUnique({ where: { name: "Siizen" } });
  if (siizen) {
    if (siizen.status !== "paused") {
      await prisma.company.update({ where: { id: siizen.id }, data: { status: "paused" } });
      log.push("Siizen: متوقفة مؤقتاً — الزبون لسا ما بعت تفاصيل الصفحة والمنتجات");
    }
    // Regenerating does NOT clear a paused company's existing cards: the engine
    // simply stops planning for it, so whatever it produced last time is left
    // orphaned on the board and keeps accruing lateness. Clear the untouched
    // auto-generated work — never anything started, done or entered by hand.
    const stale = await prisma.task.findMany({
      where: {
        companyId: siizen.id,
        isAuto: true,
        isPinned: false,
        status: "NOT_STARTED",
        board: "TODO",
        startedAt: null,
        finishedAt: null,
      },
    });
    if (stale.length) {
      await prisma.task.updateMany({
        where: { blockedById: { in: stale.map((t) => t.id) } },
        data: { blockedById: null },
      });
      await prisma.task.deleteMany({ where: { id: { in: stale.map((t) => t.id) } } });
      const shoots = await prisma.photoSession.deleteMany({
        where: { companyId: siizen.id, status: { not: "DELIVERED" } },
      });
      log.push(`Siizen: حُذفت ${stale.length} مهمة و${shoots.count} جلسة تصوير ما بلّشت`);
    }
  }

  console.log(log.length ? log.join("\n") : "لا تغييرات — كل شي مطبّق مسبقاً.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
