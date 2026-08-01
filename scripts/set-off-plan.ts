/**
 * Declare a company's off-plan content, and re-open pieces that were credited
 * to it by mistake (§14).
 *
 * وصل publishes the client's own exchange-rate bulletins and economic analysis
 * on the same channels as the contracted plan. Those go out, but they are NOT
 * what the contract counts — so a bulletin landing in the group must never
 * close «بوست-3». Before this rule existed the history import did exactly that,
 * which is why the company read 29/43 produced when the real figure was lower.
 *
 *   npx tsx scripts/set-off-plan.ts وصل "صرف,نشرة,أسعار"
 *   npx tsx scripts/set-off-plan.ts وصل "صرف,نشرة,أسعار" --apply
 *   npx tsx scripts/set-off-plan.ts وصل --clear --apply
 *   …                                   --reset   # reopen non-pinned production
 *                                                 # pieces so a re-import can
 *                                                 # recount them cleanly
 */
import { PrismaClient } from "@prisma/client";
import { parseOffPlanKeywords } from "../src/lib/telegram/match";

const prisma = new PrismaClient();
const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const CLEAR = argv.includes("--clear");
const RESET = argv.includes("--reset");
const positional = argv.filter((a) => !a.startsWith("--"));
const [companyArg, keywordsArg] = positional;

async function main() {
  if (!companyArg) {
    console.error('الاستعمال: npx tsx scripts/set-off-plan.ts <شركة> "كلمة,كلمة" [--apply] [--reset] [--clear]');
    process.exit(1);
  }
  const company = await prisma.company.findFirst({ where: { name: { contains: companyArg } } });
  if (!company) {
    console.error(`ما لقيت شركة اسمها يحتوي «${companyArg}»`);
    process.exit(1);
  }

  const current = parseOffPlanKeywords(company.offPlanKeywords);
  const next = CLEAR ? [] : keywordsArg ? keywordsArg.split(",").map((k) => k.trim()).filter(Boolean) : current;

  console.log(`${company.name}`);
  console.log(`  حالياً: ${current.length ? current.join(" · ") : "— لا شي"}`);
  console.log(`  الجديد: ${next.length ? next.join(" · ") : "— لا شي"}`);

  if (RESET) {
    // Only auto-generated, unpinned production cards: anything the lead pinned
    // or entered by hand is her word and must survive.
    const open = await prisma.task.findMany({
      where: {
        companyId: company.id,
        kind: "CONTENT",
        stage: { in: ["DESIGN", "SHOOT"] },
        isPinned: false,
        status: { not: "CANCELED" },
      },
    });
    const closed = open.filter((t) => t.finishedAt != null || t.board === "DONE");
    console.log(`\n  إعادة فتح ${closed.length} قطعة إنتاج (غير مثبّتة) ليُعاد احتسابها`);
    if (APPLY)
      await prisma.task.updateMany({
        where: { id: { in: closed.map((t) => t.id) } },
        data: {
          status: "NOT_STARTED",
          board: "TODO",
          startedAt: null,
          finishedAt: null,
          completedAt: null,
          notes: null,
        },
      });
  }

  if (APPLY)
    await prisma.company.update({
      where: { id: company.id },
      data: { offPlanKeywords: next.length ? JSON.stringify(next) : null },
    });

  console.log(APPLY ? "\nتم." : "\nتشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
