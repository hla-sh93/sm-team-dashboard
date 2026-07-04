/**
 * Carry-over reconciliation (as of 2026-07-04) — integrates the remaining June
 * work for برو / المول / المخبر / جدارات into the live workflow. Idempotent.
 *
 *   DATABASE_URL="file:./dev.db" npx tsx scripts/reconcile-carryover-2026-07.ts
 *
 * What it does (the per-piece STATES come from schedule.ts → JUNE_2026 /
 * JULY_2026 achievements; this script sets the data those rely on + the bits the
 * achievements model can't express):
 *  1) Photographer routing: المول reels → ألبير, المخبر reels → غسان+مايك.
 *  2) جدارات is anchored to TODAY (contractStartDate) so it schedules/publishes
 *     from today and is NEVER late; its posts are ready-to-publish, AI reels
 *     under review (JULY_2026 achievements).
 *  3) Regenerate June (2026-05) and July (2026-06) so the achievements apply.
 *  4) Photo-session statuses: the filmed-but-not-delivered reel batches → SHOT,
 *     the already-delivered ones → DELIVERED.
 *  5) برو's 1 remaining reel + 1 remaining post → pending production with fresh
 *     "next action" dates FROM TODAY (assigned; pinned so regen keeps them).
 */
import { PrismaClient } from "@prisma/client";
import { generateSchedule } from "../src/server/actions/schedule";

const db = new PrismaClient();
// All reconciliation dates are UTC-midnight so they read as the SAME calendar
// day locally AND on Vercel's UTC runtime. A local-midnight value serialises to
// 2026-07-03T21:00Z and would read as day-3 under UTC — reintroducing false
// "late" edges after the local→prod sync.
const TODAY = new Date("2026-07-04T00:00:00Z"); // 2026-07-04
const JADARAT_ANCHOR = TODAY;
const ALBERT = "cmqt6605500005ugouv9pului";
const GHASSAN_MIKE = "e_photo";
const MAJED = "e_majed";
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

async function regen(year: number, month: number) {
  await db.task.deleteMany({ where: { year, month, isAuto: true } });
  try {
    await generateSchedule(year, month);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/revalidate|static generation|headers|request scope/i.test(msg)) throw e;
  }
}

async function main() {
  // 1) Photographer routing for the carry-over reels.
  await db.company.update({ where: { id: "c_mall" }, data: { photographerId: ALBERT } });
  await db.company.update({ where: { id: "c_noor" }, data: { photographerId: GHASSAN_MIKE } });

  // 2) جدارات — schedule/publish from TODAY, never late (UTC-stable anchor).
  await db.company.update({ where: { id: "c_jadarat" }, data: { contractStartDate: JADARAT_ANCHOR } });

  // 3) Regenerate both buckets so JUNE_2026 + JULY_2026 achievements apply.
  await regen(2026, 5);
  await regen(2026, 6);

  // 4) Photo-session statuses (filmed-not-delivered → SHOT; delivered → DELIVERED).
  //    Matched by company + REELS batch order (earliest = delivered first).
  const setSessions = async (companyId: string, statuses: string[]) => {
    const sessions = await db.photoSession.findMany({
      where: { companyId, kind: "REELS", year: 2026, month: 5 },
      orderBy: { shootDate: "asc" },
    });
    for (let i = 0; i < sessions.length && i < statuses.length; i++) {
      await db.photoSession.update({ where: { id: sessions[i].id }, data: { status: statuses[i] } });
    }
  };
  // المخبر: batch 1 delivered (published), batch 2 shot-not-delivered.
  await setSessions("c_noor", ["DELIVERED", "SHOT"]);
  // المول: 3-reel batch — 2 delivered + 1 pending; mark the batch SHOT (filmed).
  await setSessions("c_mall", ["SHOT"]);

  // 5) برو — the 1 remaining reel + 1 remaining post become PENDING PRODUCTION
  //    with fresh dates from today (assigned, pinned). Find the auto TODO pieces
  //    left after the achievements (published:7 reel / published:2 post).
  const pinPiece = async (
    type: string,
    prodStage: "SHOOT" | "DESIGN",
    owner: string,
    work: Date,
    ready: Date,
    publish: Date,
  ) => {
    const prod = await db.task.findFirst({
      where: { companyId: "c_pro", year: 2026, month: 5, type, stage: prodStage, board: "TODO", status: { notIn: ["CANCELED"] } },
      orderBy: { publishDate: "asc" },
    });
    if (!prod?.pipelineKey) return;
    const pk = prod.pipelineKey;
    await db.task.updateMany({
      where: { pipelineKey: pk, stage: prodStage },
      data: { assigneeId: owner, workDate: work, readyDate: ready, status: "NOT_STARTED", board: "TODO", isPinned: true },
    });
    await db.task.updateMany({
      where: { pipelineKey: pk, stage: "PUBLISH" },
      data: { workDate: publish, readyDate: publish, publishDate: publish, status: "NOT_STARTED", board: "TODO", isPinned: true },
    });
    await db.task.updateMany({
      where: { pipelineKey: pk, stage: prodStage },
      data: { publishDate: publish },
    });
  };
  // Reel: shoot today → deliver +3 → publish +5. Post: design today → ready +2 → publish +4.
  await pinPiece("REEL", "SHOOT", MAJED, TODAY, addDays(TODAY, 3), addDays(TODAY, 5));
  await pinPiece("POST", "DESIGN", "e_sabin", TODAY, addDays(TODAY, 2), addDays(TODAY, 4));

  // 6) Ready-to-publish posts (designed + approved) → schedule into the
  //    publishing queue FROM TODAY (skip Fridays), pinned. Fixes المول's 3 ready
  //    posts (were dated in the past → false-late) and honours جدارات's rule
  //    that publishing starts today (its first-cycle lead had pushed them out).
  const scheduleReadyFromToday = async (companyId: string, type: string, stepDays: number) => {
    const tasks = await db.task.findMany({ where: { companyId, type, status: { not: "CANCELED" } } });
    const byKey = new Map<string, { prod?: any; pub?: any }>();
    for (const t of tasks) {
      if (t.stage === "WRITE") continue;
      const pc = byKey.get(t.pipelineKey ?? t.id) ?? {};
      if (t.stage === "PUBLISH") pc.pub = t; else pc.prod = t;
      byKey.set(t.pipelineKey ?? t.id, pc);
    }
    const done = (x: any) => x && (["READY", "PUBLISHED", "DELIVERED"].includes(x.status) || x.board === "DONE");
    const ready = [...byKey.entries()]
      .filter(([, pc]) => done(pc.prod) && pc.pub && !done(pc.pub))
      .sort((a, b) => (a[1].pub.publishDate?.getTime() ?? 0) - (b[1].pub.publishDate?.getTime() ?? 0));
    let cur = new Date(TODAY);
    for (const [pk] of ready) {
      while (cur.getUTCDay() === 5) cur = addDays(cur, 1); // no Friday publishing
      const at = new Date(cur);
      await db.task.updateMany({
        where: { pipelineKey: pk, stage: "PUBLISH" },
        data: { publishDate: at, readyDate: at, workDate: at, isPinned: true, status: "NOT_STARTED", board: "TODO" },
      });
      cur = addDays(cur, stepDays);
    }
    return ready.length;
  };
  const mallReady = await scheduleReadyFromToday("c_mall", "POST", 2);
  const jadaratReady = await scheduleReadyFromToday("c_jadarat", "POST", 3);

  console.log(JSON.stringify({
    photographers: { mall: "ألبير", noor: "غسان+مايك" },
    jadarat: "anchored to 2026-07-04 (no delay)",
    regenerated: ["2026-05", "2026-06"],
    sessions: "noor: DELIVERED+SHOT · mall: SHOT",
    bro: "1 reel + 1 post rescheduled to pending-production from today",
    readyPublishFromToday: { mall: mallReady, jadarat: jadaratReady },
  }));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
