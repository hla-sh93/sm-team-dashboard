/**
 * Standing daily work that is NOT part of any content plan (§14).
 *
 * وصل's client supplies exchange-rate bulletins and the economic calendar every
 * trading day; أيمن designs them. That is ~65 designs a month — a real bite out
 * of his capacity — yet it appeared nowhere, because the plan does not contain
 * it. These ad-hoc cards make the work visible in the daily brief, the workload
 * and the cost model without ever counting toward the contract's progress.
 *
 *   npx tsx scripts/add-recurring-task.ts وصل أيمن "نشرات الصرف والمفكرة الاقتصادية" \
 *     --from 2026-08-01 --to 2026-08-31 --days 1,2,3,4,5 --hours 2
 *   …                                                                    --apply
 *
 * `--days` uses getDay(): 0=الأحد … 6=السبت. Idempotent: a day that already has
 * this task is skipped, so re-running only fills the gaps.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const flag = (name: string) => {
  const i = argv.indexOf(name);
  return i > -1 ? argv[i + 1] : null;
};
const flagIdxs = new Set(
  ["--from", "--to", "--days", "--hours"].map((f) => argv.indexOf(f) + 1).filter((i) => i > 0),
);
const [companyArg, personArg, titleArg] = argv.filter(
  (a, i) => !a.startsWith("--") && !flagIdxs.has(i),
);
const FROM = flag("--from");
const TO = flag("--to");
const DAYS = (flag("--days") ?? "1,2,3,4,5").split(",").map(Number);
/** Effort per day, in hours — ad-hoc effort is stored as hours (§5). */
const HOURS = Number(flag("--hours") ?? 2);

async function main() {
  if (!companyArg || !personArg || !titleArg || !FROM || !TO) {
    console.error(
      'الاستعمال: npx tsx scripts/add-recurring-task.ts <شركة> <موظف> "العنوان" --from YYYY-MM-DD --to YYYY-MM-DD [--days 1,2,3,4,5] [--hours 2] [--apply]',
    );
    process.exit(1);
  }
  const company = await prisma.company.findFirst({ where: { name: { contains: companyArg } } });
  const person = await prisma.employee.findFirst({ where: { name: { contains: personArg } } });
  if (!company || !person) {
    console.error("ما لقيت الشركة أو الموظف");
    process.exit(1);
  }

  const [fy, fm, fd] = FROM.split("-").map(Number);
  const [ty, tm, td] = TO.split("-").map(Number);
  const start = new Date(fy, fm - 1, fd);
  const end = new Date(ty, tm - 1, td);

  const existing = await prisma.task.findMany({
    where: { companyId: company.id, assigneeId: person.id, title: titleArg },
  });
  const taken = new Set(
    existing.map((t) => (t.workDate ? t.workDate.toLocaleDateString("en-CA") : "")),
  );

  const created: string[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (!DAYS.includes(d.getDay())) continue;
    const iso = d.toLocaleDateString("en-CA");
    if (taken.has(iso)) continue;
    created.push(iso);
    if (!APPLY) continue;
    const day = new Date(d);
    await prisma.task.create({
      data: {
        // Deterministic id so a re-run can never duplicate a day.
        id: `adhoc_${company.slug ?? company.id}_${person.id}_${iso}`,
        kind: "ADHOC",
        title: titleArg,
        hours: HOURS,
        quantity: 1,
        priority: "NORMAL",
        status: "NOT_STARTED",
        board: "TODO",
        stage: "DESIGN",
        workDate: day,
        readyDate: day,
        month: day.getMonth(),
        year: day.getFullYear(),
        week: Math.ceil(day.getDate() / 7),
        isPinned: true, // survives إعادة الجدولة — the engine never plans this
        isAuto: false,
        companyId: company.id,
        assigneeId: person.id,
        notes: "خارج الخطة — محتوى يومي يزوّدنا فيه الزبون",
      },
    });
  }

  console.log(
    `${company.name} · ${person.name} · «${titleArg}»\n` +
      `${APPLY ? "أُنشئت" : "رح تُنشأ"} ${created.length} مهمة` +
      (existing.length ? ` (${existing.length} موجودة مسبقاً)` : ""),
  );
  if (created.length) console.log(`من ${created[0]} إلى ${created[created.length - 1]}`);
  if (!APPLY) console.log("تشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
