/**
 * جرد مواعيد التصوير الأسبوعي (طلب القائدة 1/8/2026).
 *
 * القواعد:
 *  - الموعد يُطلب من الزبون **قبل يومين عالأقل** من التصوير.
 *  - كل موعد بيتصور فيه **2–3 ريلات** من قبل ماجد.
 *  - الجرد بيصير الخميس أو السبت، حتى تُطلب المواعيد من أول الأسبوع.
 *
 * لكل شركة نشطة: شو ريلات بدها تصوير (كروت SHOOT مفتوحة + إعادات التصوير)،
 * شو عالمونتاج عند أليسار، واقتراح جلسات محترم يوم الشركة المفضّل، مع آخر
 * موعد لطلب الجلسة من الزبون. **بيقرأ بس** — القرار للقائدة.
 *
 *   npx tsx scripts/shoot-week.ts               # أسبوع من اليوم
 *   npx tsx scripts/shoot-week.ts 2026-08-01
 */
import { PrismaClient } from "@prisma/client";
import { isTaskDoneState } from "../src/lib/constants";
import { ARABIC_DAYS } from "../src/lib/dates";
import { cycleForBucket } from "../src/lib/contract";

const prisma = new PrismaClient();
const REQUEST_DAYS_BEFORE = 2;
const SESSION_MAX = 3;
const REELS_PER_DAY = 3; // طاقة ماجد

const arg = process.argv[2];
const START = arg && /^\d{4}-\d{2}-\d{2}$/.test(arg)
  ? new Date(Number(arg.slice(0, 4)), Number(arg.slice(5, 7)) - 1, Number(arg.slice(8, 10)))
  : new Date();

const D = (d: Date, days: number) => { const x = new Date(d); x.setDate(x.getDate() + days); return x; };
const label = (d: Date) => `${ARABIC_DAYS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;

async function main() {
  const companies = await prisma.company.findMany({ where: { status: "active", managed: true }, orderBy: { priority: "asc" } });
  const majed = await prisma.employee.findFirst({ where: { name: "ماجد" } });
  const weekEnd = D(START, 6);
  console.log(`\n📅 جرد مواعيد التصوير — ${label(START)} ← ${label(weekEnd)}`);
  console.log(`القاعدة: الموعد يُطلب قبل يومين · كل جلسة 2–3 ريلات\n${"─".repeat(58)}`);

  // الأيام المتاحة لماجد، والمحجوز فعلاً = المثبّت يدوياً بس (manualDay).
  // مواعيد المحرك الآلية مو حجوزات مع زبون — هي بالضبط يلي عم نرتبو هون.
  const majedDays: number[] = JSON.parse((majed?.workDays as string) ?? "[6,0,1,2,3]");
  const booked = new Map<string, number>(); // iso → عدد ريلات محجوزة
  const preBooked = await prisma.task.findMany({
    where: { assigneeId: majed?.id, stage: "SHOOT", status: { notIn: ["CANCELED"] }, manualDay: { gte: START, lte: weekEnd } },
  });
  for (const t of preBooked.filter((x) => !isTaskDoneState(x))) {
    const d = t.manualDay!.toLocaleDateString("en-CA");
    booked.set(d, (booked.get(d) ?? 0) + 1);
  }

  const AR_MONTH = ["ك٢", "شباط", "آذار", "نيسان", "أيار", "حزيران", "تموز", "آب", "أيلول", "ت١", "ت٢", "ك١"];

  /**
   * يحجز جلسة بأول يوم مناسب — بيرجع [التاريخ، كم ريل].
   * قاعدة القائدة (1/8): «وقت نروح لعند زبون منصور 3 ريلات أو 2 في حال ما كان
   * في 3» — الزيارة بريل واحد ممنوعة إلا إذا الشركة كلها ما ضل عندها غيرو،
   * فيوم ما بيسع إلا ريل واحد بينتخطى لصالح يوم أوسع.
   */
  const bookSession = (queueLen: number, preferredDay: number | null): [Date, number] | null => {
    let cursor = D(START, REQUEST_DAYS_BEFORE);
    while (cursor <= weekEnd) {
      const day = cursor.toLocaleDateString("en-CA");
      const free = REELS_PER_DAY - (booked.get(day) ?? 0);
      const dayOk = majedDays.includes(cursor.getDay()) &&
        (preferredDay == null || cursor.getDay() === preferredDay);
      const n = Math.min(SESSION_MAX, free, queueLen);
      const bigEnough = n >= 2 || queueLen === 1;
      if (dayOk && free > 0 && bigEnough) {
        booked.set(day, (booked.get(day) ?? 0) + n);
        return [new Date(cursor), n];
      }
      cursor = D(cursor, 1);
    }
    return null;
  };

  type Entry = { co: (typeof companies)[number]; unshot: import("@prisma/client").Task[]; onEdit: import("@prisma/client").Task[]; cycles: Set<string>; lines: string[] };
  const entries: Entry[] = [];
  let totalNeed = 0;
  for (const co of companies) {
    // ريلات حقيقية بس — ريل AI شغل مصمم مو جلسة تصوير.
    const all = await prisma.task.findMany({
      where: { companyId: co.id, stage: "SHOOT", type: { not: "AI_REEL" }, status: { not: "CANCELED" } },
      orderBy: [{ year: "asc" }, { month: "asc" }, { pieceNo: "asc" }],
    });
    // دورة لسا ما بلّشت (أيلول، تشرين…) مو موضوع جرد هالأسبوع.
    const started = all.filter((t) => {
      const cyc = cycleForBucket(co as never, t.year, t.month);
      const cycStart = cyc?.start ?? new Date(t.year, t.month, 1);
      return cycStart <= weekEnd;
    });
    const shoots = started;
    const cycles = new Set(shoots.map((t) => `${t.year}-${t.month}`));
    const unshot = shoots.filter((t) => !isTaskDoneState(t) && t.status !== "IN_PROGRESS");
    const onEdit = shoots.filter((t) => t.status === "IN_PROGRESS");
    if (!unshot.length && !onEdit.length) continue;
    totalNeed += unshot.length;
    entries.push({ co, unshot, onEdit, cycles, lines: [] });
  }

  const names = (e: Entry, list: import("@prisma/client").Task[]) =>
    list
      .map((t) => {
        if (t.pieceNo == null) return `«${(t.title ?? "").slice(0, 28)}»`;
        // لما يكون في أكتر من دورة، الرقم لحاله بيلخبط — منلحقه بشهر دورته.
        return `ريل ${t.pieceNo}${e.cycles.size > 1 ? ` (${AR_MONTH[t.month]})` : ""}`;
      })
      .join("، ");

  // توزيع عادل عالطاقة: (أ) المثبّت يدوياً محجوز أصلاً، (ب) أصحاب اليوم
  // المفضّل بياخدوا يومهن قبل الكل، (ج) جلسة وحدة لكل شركة بالدور، (د) الفاضل
  // بيتعبّى بالأولوية. غير هيك الشركة الأولى بتبلع الأسبوع والباقي بيجوعوا.
  const queues = new Map<string, import("@prisma/client").Task[]>();
  for (const e of entries) {
    const fixed = e.unshot.filter((t) => t.manualDay);
    if (fixed.length) {
      const d = fixed[0].manualDay!;
      e.lines.push(`   ✔ جلسة مثبّتة: ${label(d)} — ${names(e, fixed)} (طلب الموعد كان لازم ${label(D(d, -REQUEST_DAYS_BEFORE))})`);
    }
    queues.set(e.co.id, [...e.unshot.filter((t) => !t.manualDay)]);
  }
  const propose = (e: Entry) => {
    const q = queues.get(e.co.id)!;
    if (!q.length) return false;
    const slot = bookSession(q.length, e.co.preferredShootDay);
    if (!slot) return false;
    const chunk = q.splice(0, slot[1]);
    e.lines.push(`   ◻ جلسة مقترحة: ${label(slot[0])} — ${names(e, chunk)}  ← اطلب الموعد: ${label(D(slot[0], -REQUEST_DAYS_BEFORE))}`);
    return true;
  };
  for (const e of entries.filter((x) => x.co.preferredShootDay != null)) propose(e);
  for (const e of entries.filter((x) => x.co.preferredShootDay == null)) propose(e);
  let moved = true;
  while (moved) { moved = false; for (const e of entries) if (propose(e)) moved = true; }

  for (const e of entries) {
    const pref = e.co.preferredShootDay != null ? ` · اليوم المفضّل: ${ARABIC_DAYS[e.co.preferredShootDay]}` : "";
    console.log(`\n■ ${e.co.name} — ${e.unshot.length} بدها تصوير${e.onEdit.length ? ` · ${e.onEdit.length} عالمونتاج` : ""}${pref}`);
    console.log(`   للتصوير: ${names(e, e.unshot)}`);
    if (e.onEdit.length) console.log(`   عالمونتاج: ${names(e, e.onEdit)}`);
    for (const l of e.lines) console.log(l);
    const left = queues.get(e.co.id)!;
    if (left.length) console.log(`   ↩ بيتبقى ${left.length} (${names(e, left)}) — للأسبوع الجاي أو يوم إضافي`);
  }

  console.log(`\n${"─".repeat(58)}\nالمجموع: ${totalNeed} ريل بدها تصوير · طاقة ماجد ${REELS_PER_DAY}/يوم`);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
