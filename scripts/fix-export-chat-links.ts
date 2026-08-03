/**
 * تنضيف ربط تلغرام من مفاتيح «export#…».
 *
 * تصدير Telegram Desktop ما فيه دايماً `id` للمحادثة، ووقتها كان
 * `import-telegram-export.ts --apply` يبني مفاتيح وهمية `export#<توبيك>`
 * ويعيد ربط كل شركة عليها — يعني البوت الحي بيوصل رسالة على المفتاح الحقيقي
 * `-100…#<توبيك>` وما بيلاقي شركة. الاستيراد صار ما بيربط إلا بمعرّف حقيقي،
 * وهاد بيرجّع اللي انكتب.
 *
 *   npx tsx scripts/fix-export-chat-links.ts [--apply]
 *
 * متكافئ التشغيل: بلا مفاتيح `export#` بيطلع بلا ما يعمل شي.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main() {
  const stale = await prisma.telegramChat.findMany({ where: { id: { startsWith: "export#" } } });
  if (!stale.length) {
    console.log("ولا مفتاح «export#» — ما في شي للتصحيح.");
    await prisma.$disconnect();
    return;
  }

  const real = await prisma.telegramChat.findMany({ where: { NOT: { id: { startsWith: "export#" } } } });
  const realByThread = new Map(real.filter((c) => c.threadId != null).map((c) => [c.threadId!, c]));

  for (const s of stale) {
    const target = s.threadId != null ? realByThread.get(s.threadId) : null;
    const companies = await prisma.company.findMany({ where: { telegramChatId: s.id } });
    for (const co of companies) {
      if (!target) {
        console.log(`⚠️  ${co.name} مربوطة بـ${s.id} وما في مفتاح حقيقي بنفس التوبيك — بيرجع بلا ربط`);
        if (APPLY) await prisma.company.update({ where: { id: co.id }, data: { telegramChatId: null } });
        continue;
      }
      console.log(`↩️  ${co.name.padEnd(14)} ${s.id} → ${target.id}`);
      if (APPLY) await prisma.company.update({ where: { id: co.id }, data: { telegramChatId: target.id } });
    }
    if (APPLY) {
      await prisma.telegramMessage.deleteMany({ where: { chatId: s.id } });
      await prisma.telegramChat.delete({ where: { id: s.id } });
    }
  }

  console.log(`\n${APPLY ? "انحذفت" : "رح تنحذف"} ${stale.length} محادثة وهمية.`);
  if (!APPLY) console.log("تشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
