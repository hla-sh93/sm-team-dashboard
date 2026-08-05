/**
 * ربط توبيكات تلغرام بشركاتها بالاسم — التصحيح اللي كشفه تشخيص 5/8.
 *
 * على الإنتاج طلعت توبيكات الشركات كلها بلا `companyId` (وصل 99 رسالة و29
 * ملف بيوم واحد، صفر مطابقة): البوت بيخزّن كل شي، بس بلا ربط ما بيعرف لمين
 * الملف — فولا كرت بينسكّر و«المتأخر» بيكبر والفريق فعلياً مسلّم.
 *
 * الربط بالاسم عبر نفس قاموس المطابقة (`TOPIC_ALIASES` + مطابقة الاسم/السلاغ)
 * اللي بيستعمله استيراد التصدير. القواعد:
 *   - ما منكتب فوق ربط موجود — الربط اليدوي من صفحة تلغرام أعلى مرتبة.
 *   - غرفة الفريق (isTeam) والتوبيكات اللي ما إلها شركة بتضل بلا ربط، بالاسم.
 *
 *   npx tsx scripts/link-telegram-topics.ts [--apply]     ← بخطوة البناء
 */
import { PrismaClient } from "@prisma/client";
import { matchTopicCompany } from "../src/lib/telegram/export";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main() {
  const [chats, companies] = await Promise.all([
    prisma.telegramChat.findMany({ where: { companyId: null, isTeam: { not: true } } }),
    prisma.company.findMany(),
  ]);

  let linked = 0;
  const unlinkable: string[] = [];
  for (const chat of chats) {
    const title = chat.title?.trim();
    if (!title) continue;
    const co = matchTopicCompany(title, companies);
    if (!co) {
      unlinkable.push(title);
      continue;
    }
    linked++;
    console.log(`🔗 «${title}» → ${co.name}`);
    if (!APPLY) continue;
    await prisma.telegramChat.update({ where: { id: chat.id }, data: { companyId: co.id } });
    // مؤشر الشركة بيتحدث بس إذا فاضي أو بيشير لمحادثة ميتة — الربط اليدوي أولى.
    const current = co.telegramChatId
      ? await prisma.telegramChat.findUnique({ where: { id: co.telegramChatId } })
      : null;
    if (!current || current.companyId !== co.id)
      await prisma.company.update({ where: { id: co.id }, data: { telegramChatId: chat.id } });
  }

  if (unlinkable.length)
    console.log(`\nبلا شركة (مقصود غالباً): ${[...new Set(unlinkable)].join("، ")}`);
  console.log(`\n${APPLY ? "انربط" : "رح ينربط"} ${linked} توبيك.`);
  if (!APPLY) console.log("تشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
