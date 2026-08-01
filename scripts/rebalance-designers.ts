/**
 * إعادة توزيع حمل التصميم بين أيمن وسابين — قرار القائدة 2026-08-01.
 *
 *   «حلا أساساً 50% من وقتها إدارة، فما عندها مجال لتستلم إلا ديلين ماكس وهنن
 *    كابرياني والمدارس… فونيتيك حلا اشتغلت كمان بس لازم تكون عند أيمن… بدي
 *    توزع الحمل بالتصميم على المصممين بشكل منطقي وما تخلي واحد عندو عبء
 *    والتاني لا».
 *
 * **الشرط الحاكم**: «مهم إنك تخلي المهمة باسم الشخص يلي عملها» — فتغيير ملكية
 * الشركة بيمسّ **الكروت المفتوحة بس**. أي قطعة منجزة بتضل باسم يلي عملها فعلاً
 * (بوستات فونيتيك آب لحلا، وآخر 3 بوستات المول الصيني لحلا).
 *
 * الحساب (أيام تصميم بالشهر: بوست 10/يوم · ستوري 10/يوم · ريل AI 1/يوم):
 *   قبل → أيمن 11.7 · سابين 8.1 · حلا 0.8
 *   بعد → أيمن 10.3 · سابين 9.5 · حلا 0
 * التحريك: فونيتيك وBW لأيمن (بطلبها)، ومانغو لسابين (لتعديل الكفّة —
 * الفرق بلا هالنقلة 2.2 يوم بالشهر).
 *
 *   npx tsx scripts/rebalance-designers.ts --apply
 */
import { PrismaClient } from "@prisma/client";
import { taskDays } from "../src/lib/capacity";
import { isTaskDoneState } from "../src/lib/constants";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

/** شركة → المصمم المسؤول (بوستات وستوريز). ريلات AI منفصلة. */
const DESIGN_OWNER: Record<string, string> = {
  // أيمن
  "وصل": "e_ayman", BW: "e_ayman", Phoenitech: "e_ayman",
  // سابين
  التوظيف: "e_sabin", أغاليا: "e_sabin", جدارات: "e_sabin", برو: "e_sabin",
  "مخبر": "e_sabin", البلسم: "e_sabin", مانغو: "e_sabin",
};
/** ريلات AI — شغل مصمم كمان، وجدارات تبعها لأيمن بطلب القائدة. */
const AI_REEL_OWNER: Record<string, string> = { جدارات: "e_ayman" };

async function main() {
  const companies = await prisma.company.findMany();
  const employees = await prisma.employee.findMany();
  const nm = (id: string | null) => employees.find((e) => e.id === id)?.name ?? "—";
  const find = (needle: string) => companies.find((c) => c.name.includes(needle));

  // ---- 1. ملكية الشركات ----------------------------------------------------
  console.log("— ملكية التصميم —");
  for (const [needle, ownerId] of Object.entries(DESIGN_OWNER)) {
    const co = find(needle);
    if (!co) { console.log(`⚠️ ما لقيت «${needle}»`); continue; }
    const aiOwner = AI_REEL_OWNER[needle] ?? null;
    const changed = co.postOwnerId !== ownerId || co.storyOwnerId !== ownerId ||
      (aiOwner != null && co.aiReelOwnerId !== aiOwner);
    console.log(`   ${co.name.padEnd(15)} ${nm(co.postOwnerId).padEnd(7)} → ${nm(ownerId)}` +
      (aiOwner ? ` · ريلات AI → ${nm(aiOwner)}` : "") + (changed ? "  ✏️" : ""));
    if (APPLY && changed)
      await prisma.company.update({
        where: { id: co.id },
        data: {
          postOwnerId: ownerId, storyOwnerId: ownerId,
          ...(aiOwner ? { aiReelOwnerId: aiOwner } : {}),
          defaultOwnerId: ownerId,
        },
      });
  }

  // ---- 2. الكروت المفتوحة بس — المنجز بيضل باسم يلي عملو --------------------
  console.log("\n— نقل الكروت (المفتوحة فقط) —");
  let moved = 0, kept = 0;
  for (const [needle, ownerId] of Object.entries(DESIGN_OWNER)) {
    const co = find(needle);
    if (!co) continue;
    const cards = await prisma.task.findMany({
      where: { companyId: co.id, stage: "DESIGN", status: { not: "CANCELED" } },
    });
    for (const t of cards) {
      // ريل AI إلو صاحب تاني
      const want = t.type === "AI_REEL" ? (AI_REEL_OWNER[needle] ?? ownerId) : ownerId;
      if (t.assigneeId === want) continue;
      if (isTaskDoneState(t)) { kept++; continue; } // ← تاريخ الإنجاز مقدّس
      moved++;
      if (APPLY) await prisma.task.update({ where: { id: t.id }, data: { assigneeId: want } });
    }
  }
  console.log(`   ${moved} كرت مفتوح انتقل · ${kept} كرت منجز ضل باسم يلي عملو`);

  // ---- 3. الحمل بعد التوزيع ------------------------------------------------
  const after = await prisma.company.findMany({ where: { status: "active", managed: true } });
  const load = new Map<string, number>();
  const add = (id: string | null, d: number) => { if (d > 0) load.set(nm(id), (load.get(nm(id)) ?? 0) + d); };
  for (const c of after) {
    add(c.postOwnerId, taskDays({}, "POST", c.posts));
    add(c.storyOwnerId, taskDays({}, "STORY", c.stories));
    add(c.aiReelOwnerId ?? c.postOwnerId, taskDays({}, "AI_REEL", c.aiReels));
  }
  console.log("\n— الحمل الشهري بعد التوزيع (أيام تصميم) —");
  const rows = [...load.entries()].sort((a, b) => b[1] - a[1]);
  for (const [k, v] of rows) console.log(`   ${k.padEnd(8)} ${v.toFixed(1)} يوم/شهر`);
  const designers = rows.filter(([k]) => k === "أيمن" || k === "سابين").map(([, v]) => v);
  if (designers.length === 2)
    console.log(`   الفرق بين المصممين: ${Math.abs(designers[0] - designers[1]).toFixed(1)} يوم/شهر`);

  if (!APPLY) console.log("\nتشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
