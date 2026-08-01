/**
 * مسؤولو الحسابات (السيلز) — قرار القائدة 2026-08-01.
 *
 *   «معنا 2 سيلز عم يتابعو مع الزبون: سارة ومايكل. كل شخص مسؤول عن مجموعة
 *    شركات يلي هو جابن. وصل خليه متابعة لعمر لأن هاد ما حدا جابه من السيلز.
 *    وشركاتنا خليهن عندي للمتابعة: توظيف وتدريب وBW وفونيتيك».
 *
 * صاحب الحساب **مو منتِج**: ما بياخد كروت محتوى ولا بيدخل الأحمال. هو مين
 * بتتواصل معه لموعد تصوير، أو موافقة، أو تجديد عقد.
 *
 * كمان بيعلّم المحادثات اللي **مو تبع شركة** (مجموعة الفريق، المحادثات الخاصة،
 * الزباين القدام) كـ`isTeam` حتى يوقف تحذير «رسائل من مجموعات غير مربوطة» —
 * التحذير كان عم يطالب القائدة تربط غرفة فريقها بشركة.
 *
 *   npx tsx scripts/set-account-owners.ts --apply
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

/** سيلز جدد — بيتعرّفوا بمعرّفاتهم الرقمية من الرسائل اللي وصلت فعلاً. */
const SALES = [
  { id: "e_sarah", name: "سارة", telegramUserId: "8998634655", telegramUsername: null },
  { id: "e_michael", name: "مايكل", telegramUserId: "8562858689", telegramUsername: null },
];

/** شركة → صاحب الحساب. */
const OWNERS: Record<string, string> = {
  برو: "e_michael", "مخبر": "e_michael", البلسم: "e_michael", Siizen: "e_michael",
  أغاليا: "e_sarah", جدارات: "e_sarah", مانغو: "e_sarah", "المول": "e_sarah",
  وصل: "e_omar", // ما حدا جابه من السيلز — متابعة عمر
  التوظيف: "e_hla", التدريب: "e_hla", BW: "e_hla", Phoenitech: "e_hla", // شركاتنا
};

/** محادثات مو تبع شركة — بتوقف تحذير «غير مربوطة». */
const NOT_A_CLIENT = [
  "Desgin only (Team)", "Allegro Designs", "Unocode Designs", "فراس",
  "Hellenic Glamor", "ideas", "PLOASM", "باريستا", "الأسطورة",
];

async function main() {
  // ---- 1. السيلز كموظفين غير مجدولين --------------------------------------
  for (const s of SALES) {
    const exists = await prisma.employee.findUnique({ where: { id: s.id } });
    if (exists) { console.log(`= ${s.name} موجود`); continue; }
    console.log(`👤 ${s.name} — سيلز (خارج الجدولة، بلا كروت محتوى)`);
    if (!APPLY) continue;
    await prisma.employee.create({
      data: {
        id: s.id, name: s.name, role: "sales",
        isScheduled: false, isPhotographer: false, // ما بيدخل محرك المحتوى
        hoursPerDay: 8, salary: 0,
        telegramUserId: s.telegramUserId, telegramUsername: s.telegramUsername,
      },
    });
  }

  // ---- 2. إسناد الشركات ----------------------------------------------------
  console.log("\n— أصحاب الحسابات —");
  const companies = await prisma.company.findMany();
  for (const [needle, ownerId] of Object.entries(OWNERS)) {
    const co = companies.find((c) => c.name.includes(needle));
    if (!co) { console.log(`⚠️ ما لقيت «${needle}»`); continue; }
    const owner = await prisma.employee.findUnique({ where: { id: ownerId } });
    console.log(`   ${co.name.padEnd(16)} → ${owner?.name ?? ownerId}`);
    if (APPLY) await prisma.company.update({ where: { id: co.id }, data: { accountOwnerId: ownerId } });
  }

  // ---- 3. محادثات مو تبع شركة ---------------------------------------------
  const chats = await prisma.telegramChat.findMany({ where: { companyId: null } });
  let marked = 0;
  for (const c of chats) {
    // بلا عنوان = محادثة خاصة (البوت شافها من شخص مباشرةً) — كمان مو شركة.
    const isNotClient = !c.title || NOT_A_CLIENT.some((n) => c.title!.includes(n));
    if (!isNotClient || c.isTeam) continue;
    marked++;
    if (APPLY) await prisma.telegramChat.update({ where: { id: c.id }, data: { isTeam: true } });
  }
  console.log(`\n🔕 ${marked} محادثة انعلّمت «مو تبع شركة» — رسائلها ما بتطلع بتحذير الربط.`);
  const stillUnlinked = (await prisma.telegramChat.findMany({ where: { companyId: null, isTeam: false } }))
    .filter((c) => !c.id.startsWith("export"));
  console.log(stillUnlinked.length
    ? `⚠️ لسا ${stillUnlinked.length} توبيك بلا شركة: ${stillUnlinked.map((c) => c.title ?? c.id).join("، ")}`
    : "✅ ما ضل ولا توبيك بدو ربط.");

  if (!APPLY) console.log("\nتشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
