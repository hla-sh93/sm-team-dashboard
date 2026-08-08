/**
 * قائمة جرد النشر — أي شركة دورها، وشو المفتوح عندها، وحسابها محفوظ ولا لأ.
 *
 * القائدة (8/8): «بدنا نكرر هي البروسيس على باقي الشركات». الجرد بيحتاج منها
 * تسكرول صفحة كل شركة، فالترتيب لازم يكون بالأولوية لا عشوائياً: الشركة يلي
 * عندها كروت نشر مفتوحة أكتر هي يلي أرقامها أبعد عن الحقيقة.
 *
 *   npx tsx scripts/instagram-worklist.ts
 *   npx tsx scripts/instagram-worklist.ts --set "أغاليا=aghalia.clinic"
 */
import { PrismaClient } from "@prisma/client";
import { isTaskDoneState } from "../src/lib/constants";

const prisma = new PrismaClient();
const argv = process.argv.slice(2);

async function setHandles() {
  // بنقسم عند **أول** `=` وبس: رابط انستغرام يلي بتنسخه القائدة بيجي بذيل
  // `?igsh=...` وأحياناً بينتهي بـ`==`، فالتقسيم الكامل بيفتّته وبيسقط السطر
  // بصمت. صار الاسم قبل أول علامة والباقي كلّه رابط.
  const pairs = argv
    .filter((a) => !a.startsWith("--") && a.includes("="))
    .map((a) => [a.slice(0, a.indexOf("=")), a.slice(a.indexOf("=") + 1)] as const);
  for (const [name, handle] of pairs) {
    const co = await prisma.company.findFirst({ where: { name: { contains: name.trim() } } });
    if (!co) {
      console.log(`  ⚠️ ما لقيت شركة «${name}»`);
      continue;
    }
    // بنقبل الرابط كامل أو الاسم لحاله — القائدة بتنسخ من المتصفح عادةً.
    const clean = handle.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/[/@?].*$/, "");
    await prisma.company.update({ where: { id: co.id }, data: { instagramHandle: clean } });
    console.log(`  ✅ ${co.name} → @${clean}`);
  }
}

async function main() {
  if (argv.includes("--set")) {
    await setHandles();
    console.log("");
  }

  const companies = await prisma.company.findMany({
    where: { managed: true },
    select: { id: true, name: true, instagramHandle: true, publishStartDate: true },
  });
  const tasks = await prisma.task.findMany({
    where: { stage: "PUBLISH", status: { not: "CANCELED" }, type: { not: null } },
    select: { companyId: true, type: true, status: true, board: true, publishDate: true },
  });

  const today = new Date().toISOString().slice(0, 10);
  const rows = companies.map((co) => {
    const mine = tasks.filter((t) => t.companyId === co.id);
    // الستوري برّا الجرد — ما بتظهر بالشبكة.
    const grid = mine.filter((t) => t.type !== "STORY");
    const open = grid.filter((t) => !isTaskDoneState(t));
    // المستحق = موعده مرق ولساتُه مفتوح؛ هدول يلي الجرد ممكن يقلب حالهن.
    const due = open.filter((t) => t.publishDate && t.publishDate.toISOString().slice(0, 10) <= today);
    return { co, open: open.length, due: due.length, total: grid.length };
  });

  const active = rows.filter((r) => r.total > 0).sort((a, b) => b.due - a.due || b.open - a.open);
  const parked = rows.filter((r) => r.total === 0);

  console.log("■ قائمة جرد النشر — الأولوية للمستحقّ المفتوح\n");
  console.log("   الشركة                 مستحق  مفتوح  الحساب");
  for (const r of active) {
    const h = r.co.instagramHandle ? `@${r.co.instagramHandle}` : "⚠️ ناقص";
    console.log(
      `   ${r.co.name.padEnd(22)} ${String(r.due).padStart(4)}  ${String(r.open).padStart(5)}  ${h}`,
    );
  }
  if (parked.length)
    console.log(`\n   موقوفة (بلا كروت نشر): ${parked.map((r) => r.co.name).join(" · ")}`);

  const missing = active.filter((r) => !r.co.instagramHandle);
  if (missing.length) {
    console.log(`\n⚠️ ${missing.length} شركة بلا حساب محفوظ — بلاه ما منعرف أي صفحة نجرد:`);
    console.log(`   npx tsx scripts/instagram-worklist.ts --set "${missing[0].co.name}=الحساب"`);
  }
  await prisma.$disconnect();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
