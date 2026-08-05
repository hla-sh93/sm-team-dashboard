/**
 * إعادة مطابقة الرسائل المخزّنة بلا مطابقة — بعد ربط التوبيكات.
 *
 * الرسائل اللي وصلت **قبل** الربط انخزنت بلا شركة فولا وحدة طابقت (وصل لحالها
 * 29 ملف بيوم). هاد بيمرّرها على نفس مسار المطابقة الحي (`rematchStoredMessage`)
 * — نفس القواعد والدليل والكريدت — من الأحدث للأقدم حتى الملف الصحيح-الاسم
 * ياخد قطعته قبل التخمينات.
 *
 *   npx tsx scripts/rematch-unmatched.ts [--hours 96] [--apply]   ← بخطوة البناء
 *
 * متكافئ: المطابَق بينتخطى، والنص بيضل نص (ما بيسكّر شي).
 */
import { PrismaClient } from "@prisma/client";
import { rematchStoredMessage } from "../src/lib/telegram/ingest";

const prisma = new PrismaClient();
const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const HOURS = Number(argv[argv.indexOf("--hours") + 1]) || 96;

async function main() {
  const since = new Date(Date.now() - HOURS * 3600_000);
  const linked = await prisma.telegramChat.findMany({ where: { companyId: { not: null } } });
  const linkedIds = linked.map((c) => c.id);
  const coName = new Map(linked.map((c) => [c.id, c.companyId]));

  const pending = await prisma.telegramMessage.findMany({
    where: {
      chatId: { in: linkedIds },
      taskId: null,
      kind: { not: "TEXT" },
      sentAt: { gte: since },
    },
    orderBy: { sentAt: "asc" },
  });

  console.log(`رسائل بلا مطابقة بآخر ${HOURS} ساعة (بتوبيكات مربوطة): ${pending.length}`);
  let matched = 0;
  for (const m of pending) {
    if (!APPLY) {
      console.log(`  · ${m.sentAt.toISOString().slice(5, 16)} ${m.fileName ?? m.kind} (${coName.get(m.chatId)})`);
      continue;
    }
    const by = await rematchStoredMessage(m.id);
    if (by) {
      matched++;
      console.log(`  ✅ ${m.fileName ?? m.kind} → طابق (${by})`);
    }
  }
  console.log(APPLY ? `\nطابق ${matched} من ${pending.length}.` : "\nتشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
