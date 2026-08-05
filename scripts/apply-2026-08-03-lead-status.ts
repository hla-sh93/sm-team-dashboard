/**
 * وقائع القائدة — جولة المطابقة الشاملة (3/8/2026 مساءً).
 *
 * «بشكل عام طابق ما قلته مع المجموعات والخطط. كلشي سابق من شهر تموز أو حزيران
 * أو قبل اعتبره تم انجازه.» — هذا السكربت هو تلك الإفادة، مكتوبة كوقائع قابلة
 * لإعادة التشغيل (WORK_RULES §4): كل إقفال بيحمل سببه، والعدّ «حتى العدد N»
 * فتشغيلة تانية ما بتغيّر شي، والداتا الأحدث من الإفادة ما بتنكسر.
 *
 *   npx tsx scripts/apply-2026-08-03-lead-status.ts           # تجريبي
 *   npx tsx scripts/apply-2026-08-03-lead-status.ts --apply
 *
 * بيمشي بخطوة البناء ليوصل الإنتاج بعد الدمج — متكافئ التشغيل بالتصميم.
 */
import { PrismaClient } from "@prisma/client";
import { isTaskDoneState } from "../src/lib/constants";
import { currentCycleBucket } from "../src/lib/contract";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const TODAY = new Date(2026, 7, 3);
const SRC = "إفادة القائدة 3/8";
let changes = 0;

const say = (s: string) => console.log(s);

/** إقفال كرت بحالة وسبب — بيتخطى المسكّر، بيثبّت، وبينسب لصاحب الشغل إذا سُمّي. */
async function close(
  t: { id: string; stage: string | null; notes: string | null; startedAt: Date | null; publishDate: Date | null; readyDate: Date | null; assigneeId: string | null },
  why: string,
  opts: { publish?: boolean; doerId?: string; at?: Date } = {},
) {
  const when =
    opts.at ?? (t.stage === "PUBLISH" ? (t.publishDate ?? TODAY) : (t.readyDate ?? TODAY));
  const at = when.getTime() > TODAY.getTime() ? TODAY : when; // ما منسجّل إنجاز بالمستقبل
  const started = t.startedAt && t.startedAt.getTime() <= at.getTime() ? t.startedAt : at;
  changes++;
  if (!APPLY) return;
  await prisma.task.update({
    where: { id: t.id },
    data: {
      status: opts.publish ? "PUBLISHED" : "READY",
      board: "DONE",
      startedAt: started,
      finishedAt: at,
      completedAt: at,
      notes: [t.notes, `${SRC}: ${why}`].filter(Boolean).join(" · "),
      isPinned: true,
      ...(opts.doerId && opts.doerId !== t.assigneeId ? { assigneeId: opts.doerId } : {}),
    },
  });
}

/** «سكّر لحد ما يصير العدد N» — بالترتيب رقم القطعة؛ المسكّر أصلاً محسوب. */
async function closeUpTo(
  companyId: string,
  where: { type?: string; stage: string },
  target: number,
  why: string,
  opts: { publish?: boolean; doerId?: string } = {},
) {
  const cards = await prisma.task.findMany({
    where: {
      companyId,
      // كرت النشر kind=PUBLISH والإنتاج kind=CONTENT — النوع والمرحلة بيكفوا.
      kind: { in: ["CONTENT", "PUBLISH"] },
      stage: where.stage,
      ...(where.type ? { type: where.type } : {}),
      status: { not: "CANCELED" },
      // بس الدورة الجارية — البلانكت بيغطي القديم، والمستقبل ما منلمسه.
      year: bucketOf(companyId).year,
      month: bucketOf(companyId).month,
    },
    orderBy: { pieceNo: "asc" },
  });
  const done = cards.filter((t) => isTaskDoneState(t));
  let need = target - done.length;
  if (need < 0)
    say(`  ⚠️ ${where.type ?? ""} ${where.stage}: مسكّر ${done.length} والإفادة بتقول ${target} — ما منفتح شي، بس انتبهي`);
  for (const t of cards) {
    if (need <= 0) break;
    if (isTaskDoneState(t)) continue;
    say(`  ✏️ ${t.type}#${t.pieceNo} ${t.stage} → ${opts.publish ? "منشور" : "منجز"}`);
    await close(t, why, opts);
    need--;
  }
  if (need > 0) say(`  ⚠️ ${where.type ?? ""} ${where.stage}: ناقص ${need} كرت للوصول لـ${target}`);
}

const buckets = new Map<string, { year: number; month: number }>();
const bucketOf = (companyId: string) => buckets.get(companyId)!;

/** كرت إضافي منجز بمعرّف حتمي — التشغيلة التانية ما بتكرّره. */
async function adhocDone(
  id: string,
  companyId: string,
  assigneeId: string,
  title: string,
  hours: number,
  opts: { open?: boolean; stage?: string; at?: Date } = {},
) {
  const exists = await prisma.task.findUnique({ where: { id } });
  if (exists) return;
  const at = opts.at ?? TODAY;
  say(`  ➕ ${title} (${opts.open ? "مفتوح" : "منجز"})`);
  changes++;
  if (!APPLY) return;
  await prisma.task.create({
    data: {
      id,
      kind: "ADHOC",
      title,
      hours,
      quantity: 1,
      priority: "NORMAL",
      status: opts.open ? "NOT_STARTED" : "READY",
      board: opts.open ? "TODO" : "DONE",
      stage: opts.stage ?? "DESIGN",
      workDate: at,
      readyDate: at,
      ...(opts.open ? {} : { startedAt: at, finishedAt: at, completedAt: at }),
      month: at.getMonth(),
      year: at.getFullYear(),
      week: Math.ceil(at.getDate() / 7),
      isPinned: true,
      isAuto: false,
      companyId,
      assigneeId,
      notes: `${SRC}`,
    },
  });
}

async function main() {
  const companies = await prisma.company.findMany();
  const co = (name: string) => companies.find((c) => c.name.includes(name))!;
  for (const c of companies) buckets.set(c.id, currentCycleBucket(c as never, TODAY));

  // ═══ ٠. البلانكت: كل شي قبل الدورة الجارية منجز ═══
  // «كلشي سابق من شهر تموز أو حزيران أو قبل اعتبره تم انجازه». «سابق» بمعناه
  // الدقيق: الدورات اللي خلصت — دورة تموز الجارية لوصل والمخبر مو «سابقة».
  say("\n═══ ٠. الدورات المنتهية — كلها منجزة ═══");
  for (const c of companies) {
    // الموقوفة مستثناة: Siizen خطتها جاهزة والزبون مو جاهز — شغلها **ما انعمل**،
    // هو مركون. «موقوفة» أصلاً بتعفيها من التأخير واللوحة اليومية، وبس يبدأ
    // النشر بيبدأ عداد المهام (القائدة 3/8). تسكيرها بيكذب على تقرير الإنجاز.
    if (c.status !== "active") continue;
    const b = bucketOf(c.id);
    const old = await prisma.task.findMany({
      where: {
        companyId: c.id,
        status: { not: "CANCELED" },
        OR: [{ year: { lt: b.year } }, { year: b.year, month: { lt: b.month } }],
      },
    });
    const open = old.filter((t) => !isTaskDoneState(t));
    if (!open.length) continue;
    say(`  ${c.name}: ${open.length} كرت من دورات منتهية بينسكّر`);
    for (const t of open)
      await close(t, "دورة منتهية — كل السابق منجز", { publish: t.stage === "PUBLISH" });
  }

  // ═══ ١. مخبر د.نور ═══
  // «3 ريلات تم تصويرن فقط الأول تم نشره» — تصحيح فوق مطابقة الصبح اللي
  // اعتبرت ريلات ١–٣ منشورة. منرجّع نشر ٢ و٣ مفتوح — بس إذا كان إقفالنا نحنا
  // (العلامة بالملاحظة)، مو إقفال حقيقي أحدث.
  say("\n═══ ١. مخبر د.نور ═══");
  {
    const c = co("مخبر");
    const morningMark = "كل الريلات السابقة منشورة عدا التلاتة";
    for (const no of [2, 3]) {
      const t = await prisma.task.findFirst({
        where: { companyId: c.id, type: "REEL", stage: "PUBLISH", pieceNo: no, year: 2026, month: 6, status: { not: "CANCELED" } },
      });
      if (t && isTaskDoneState(t) && (t.notes ?? "").includes(morningMark)) {
        say(`  ↩️ ريل ${no} نشر → مفتوح (تصحيح الإفادة: «فقط الأول تم نشره»)`);
        changes++;
        if (APPLY)
          await prisma.task.update({
            where: { id: t.id },
            data: {
              status: "NOT_STARTED", board: "TODO", startedAt: null, finishedAt: null, completedAt: null,
              notes: [t.notes, `${SRC}: فقط الريل الأول منشور — رجع مفتوح`].filter(Boolean).join(" · "),
            },
          });
      }
    }
    // «التصاميم خالصة كلها ومنشورة» — بوستات دورة تموز الستة.
    await closeUpTo(c.id, { type: "POST", stage: "DESIGN" }, 6, "كل التصاميم خالصة");
    await closeUpTo(c.id, { type: "POST", stage: "PUBLISH" }, 6, "كل التصاميم منشورة", { publish: true });
  }

  // ═══ ٢. وصل للتداول ═══
  say("\n═══ ٢. وصل للتداول ═══");
  {
    const c = co("وصل");
    await closeUpTo(c.id, { type: "REEL", stage: "SHOOT" }, 8, "ماجد صوّر كل الريلات", { doerId: "e_majed" });
    // ٢ منشورة + ٣ جاهزة من أليسار = ٥ مونتاجها خالص.
    await closeUpTo(c.id, { type: "REEL", stage: "EDIT" }, 5, "منشوران + ٣ جاهزة للجدولة من أليسار");
    await closeUpTo(c.id, { type: "REEL", stage: "PUBLISH" }, 2, "تم نشر ريلين فقط", { publish: true });
    // «التصاميم فيك تتابع المجموعة» — الدليل الموجود مطبّق أصلاً؛ ما منخمّن فوقه.
  }

  // ═══ ٣. التوظيف ═══
  say("\n═══ ٣. التوظيف ═══");
  {
    const c = co("التوظيف");
    // الريل الأول منشور + تصاميم سابين العشرة — محقّقة أصلاً بدليل المجموعة؛
    // العدّ بيثبّتها بلا ما يكرّرها.
    await closeUpTo(c.id, { type: "POST", stage: "DESIGN" }, 10, "التصاميم العشرة الأولى — سابين", { doerId: "e_sabin" });
    await closeUpTo(c.id, { type: "REEL", stage: "PUBLISH" }, 1, "تم نشر الريل الأول", { publish: true });
    // «المطبوعات كلها تم انجازها من قبل حلا» — شغل بلا كرت؛ منسجّله ليوم كامل.
    await adhocDone("adhoc_jobs_e_hla_2026-08-03_prints", c.id, "e_hla", "تجهيز المطبوعات — التوظيف", 8);
  }

  // ═══ ٤. برو ═══
  say("\n═══ ٤. برو ═══");
  {
    const c = co("برو");
    // «تم نشر 2 ريل» — القطعة المنشورة لازم كل مراحلها تنسكّر معها، وإلا فحص
    // «نشرها منجز وإنتاجها مفتوح» بينذر بحق. العدّ لحاله كان بيسكّر نشر ١ و٢
    // بينما التصوير المسكّر أصلاً لقطع تانية.
    const pubs = await prisma.task.findMany({
      where: { companyId: c.id, type: "REEL", stage: "PUBLISH", year: bucketOf(c.id).year, month: bucketOf(c.id).month, status: { not: "CANCELED" } },
      orderBy: { pieceNo: "asc" },
    });
    const alreadyPub = pubs.filter((t) => isTaskDoneState(t)).length;
    for (const pub of pubs.filter((t) => !isTaskDoneState(t)).slice(0, Math.max(0, 2 - alreadyPub))) {
      const stages = await prisma.task.findMany({
        where: { companyId: c.id, type: "REEL", pieceNo: pub.pieceNo, year: pub.year, month: pub.month, status: { not: "CANCELED" } },
      });
      for (const t of stages.filter((t) => !isTaskDoneState(t))) {
        say(`  ✏️ REEL#${t.pieceNo} ${t.stage} → ${t.stage === "PUBLISH" ? "منشور" : "منجز"}`);
        await close(t as never, "تم نشر ريلين — القطعة بكل مراحلها", { publish: t.stage === "PUBLISH" });
      }
    }
    await closeUpTo(c.id, { type: "POST", stage: "DESIGN" }, 1, "بوست واحد صمّمته سابين", { doerId: "e_sabin" });
  }

  // ═══ ٥. المول الصيني — ما جدّد، وآخر ٣ بوستات لحلا ═══
  say("\n═══ ٥. المول الصيني ═══");
  {
    const c = co("المول");
    if (!c.contractEndedAt) {
      say("  📋 contractEndedAt → 2026-07-20 (نهاية دورة حزيران، ما جدّد)");
      changes++;
      if (APPLY)
        await prisma.company.update({ where: { id: c.id }, data: { contractEndedAt: new Date(2026, 6, 20) } });
    }
    const last3 = await prisma.task.findMany({
      where: { companyId: c.id, type: "POST", stage: "DESIGN", status: { not: "CANCELED" } },
      orderBy: { pieceNo: "desc" },
      take: 3,
    });
    for (const t of last3)
      if (t.assigneeId !== "e_hla") {
        say(`  👤 بوست ${t.pieceNo} → حلا (الكريدت لمين عمل الشغل)`);
        changes++;
        if (APPLY)
          await prisma.task.update({
            where: { id: t.id },
            data: { assigneeId: "e_hla", isPinned: true, notes: [t.notes, `${SRC}: آخر ٣ بوستات صمّمتهن حلا`].filter(Boolean).join(" · ") },
          });
      }
  }

  // ═══ ٦. التدريب ═══
  say("\n═══ ٦. التدريب ═══");
  {
    const c = co("التدريب");
    const shoot = await prisma.task.findFirst({
      where: { companyId: c.id, kind: "ADHOC", stage: "SHOOT", title: { contains: "تصوير ريل" }, status: { not: "CANCELED" } },
    });
    if (shoot && !isTaskDoneState(shoot)) {
      say("  ✏️ تصوير الريل → منجز (ماجد)");
      await close(shoot as never, "أُنجز ريل تصوير واحد", { doerId: "e_majed", at: TODAY });
    }
    await adhocDone("adhoc_training_e_sabin_2026-08-03_sept-plan", c.id, "e_sabin", "تصميم جدول برامج أيلول — التدريب", 8);
  }

  // ═══ ٧. جدارات ═══
  say("\n═══ ٧. جدارات ═══");
  {
    const c = co("جدارات");
    await closeUpTo(c.id, { type: "POST", stage: "DESIGN" }, 6, "تم تصميم كل شيء");
    await closeUpTo(c.id, { type: "AI_REEL", stage: "DESIGN" }, 5, "٥ ريلات منجزة، باقي السادس");
    await adhocDone("adhoc_jadarat_e_hla_2026-08-03_highlights", c.id, "e_hla", "تصميم هايلايتس الصفحة — جدارات", 4);
  }

  // ═══ ٨. أغاليا — إعادة تصوير ريل الليزر ═══
  say("\n═══ ٨. أغاليا ═══");
  {
    const c = co("أغاليا");
    // ريل التغذية أصلاً هو الوحيد المفتوح تصويراً (5/6 ✓) — منضيف بس الإعادة.
    await adhocDone("adhoc_agalia_e_majed_2026-08-03_laser-redo", c.id, "e_majed", "إعادة تصوير ريل: الليزر — أغاليا", 3, { open: true, stage: "SHOOT" });
  }

  // ═══ ٩. مركز البلسم ═══
  say("\n═══ ٩. مركز البلسم ═══");
  {
    const c = co("البلسم");
    await closeUpTo(c.id, { type: "POST", stage: "DESIGN" }, 10, "تم تصميم جميع البوستات");
    // ٣ ريلات مصوّرة البارحة ✓ (بالدليل) — المونتاج مفتوح عند أليسار عمداً.
  }

  // ═══ ١٠. عبادة لتجهيزات الأسنان — عقد جديد ═══
  say("\n═══ ١٠. عبادة لتجهيزات الأسنان ═══");
  {
    const exists = companies.find((c) => c.name.includes("عبادة"));
    if (!exists) {
      say("  ➕ شركة جديدة: 3 ريل · 5 بوست · 10 ستوري · 100$ · المصور ماجد · أسبوع تحضير ثم النشر من 10/8");
      changes++;
      if (APPLY)
        await prisma.company.create({
          data: {
            id: "c_obada",
            name: "عبادة لتجهيزات الأسنان",
            slug: "Obada",
            managed: true,
            status: "active",
            priority: companies.length + 1,
            posts: 5,
            reels: 3,
            stories: 10,
            aiReels: 0,
            contractValue: 100,
            // قاعدة ماجد المصور الوحيد من الإنشاء — لا اعتماد على fallback.
            photographerId: "e_majed",
            // عقد جديد = أسبوع تحضير بلا نشر (feedback_new_contract_prep_week).
            contractStartDate: new Date(2026, 7, 3),
            publishStartDate: new Date(2026, 7, 10),
            accountOwnerId: "e_sarah",
            // سابين أخف حملاً نسبةً لطاقتها بعد إقفالات اليوم (13.1/23 مقابل
            // أيمن 14.8/22) — وrebalance-designers بخطوة البناء بيصحّح لو انقلب.
            postOwnerId: "e_sabin",
            storyOwnerId: "e_sabin",
          },
        });
    }
    // التشغيلة الأولى أنشأت الشركة قبل هالإضافة — منكمّل الملكية للموجودة كمان.
    const obada = exists ?? (APPLY ? await prisma.company.findFirst({ where: { name: { contains: "عبادة" } } }) : null);
    if (obada && (!obada.postOwnerId || !obada.storyOwnerId)) {
      say("  👤 عبادة: مالك البوست والستوري → سابين");
      changes++;
      if (APPLY)
        await prisma.company.update({
          where: { id: obada.id },
          data: { postOwnerId: obada.postOwnerId ?? "e_sabin", storyOwnerId: obada.storyOwnerId ?? "e_sabin" },
        });
    }
  }

  // ═══ ١٠-ب. تصحيح Siizen — البلانكت الأول سكّرها غلط ═══
  // «هي قلتلك ناطرين الزبون، خطتها جاهزة بس لسا ما بلشنا تصميم وتصوير» —
  // التشغيلة الأولى (قبل استثناء الموقوفة) علّمت 26 كرت «منجز» وهنّ مركونين.
  // منرجّعهن مفتوحين — بس يلي علامتنا عليهن، فما منمسّ أي إقفال حقيقي.
  say("\n═══ ١٠-ب. Siizen — الشغل مركون مو منجز ═══");
  {
    const c = co("Siizen");
    const wronglyClosed = await prisma.task.findMany({
      where: { companyId: c.id, notes: { contains: `${SRC}: دورة منتهية` } },
    });
    for (const t of wronglyClosed) {
      say(`  ↩️ ${t.type ?? t.kind}#${t.pieceNo ?? ""} ${t.stage} → مفتوح (ناطرين الزبون)`);
      changes++;
      if (APPLY)
        await prisma.task.update({
          where: { id: t.id },
          data: {
            status: "NOT_STARTED",
            board: "TODO",
            startedAt: null,
            finishedAt: null,
            completedAt: null,
            notes:
              (t.notes ?? "")
                .split(" · ")
                .filter((n) => !n.includes("دورة منتهية"))
                .join(" · ") || null,
          },
        });
    }
  }

  // ═══ ١٠-ج. توبيك عبادة ═══
  // القائدة بعثت الرابط: t.me/c/3563508968/4524 → التوبيك 4524 بمجموعة الفريق.
  say("\n═══ ١٠-ج. توبيك عبادة ═══");
  {
    const obada = await prisma.company.findFirst({ where: { name: { contains: "عبادة" } } });
    const key = "-1003563508968#4524";
    if (obada && obada.telegramChatId !== key) {
      say(`  🔗 عبادة ← ${key}`);
      changes++;
      if (APPLY) {
        await prisma.telegramChat.upsert({
          where: { id: key },
          create: {
            id: key,
            chatId: "-1003563508968",
            threadId: 4524,
            title: "عبادة لتجهيزات الأسنان",
            type: "supergroup",
            companyId: obada.id,
          },
          update: { companyId: obada.id },
        });
        await prisma.company.update({ where: { id: obada.id }, data: { telegramChatId: key } });
      }
    }
  }

  // ═══ ١١. مسؤولو العقود (سيلز) ═══
  // «سارة: أغاليا، مانغو، عبادة، جدارات، المول الصيني. مايكل: برو، البلسم،
  // Siizen، المخبر. التدريب ووصل لحلا.» أليغرو مو شركة عنا (توبيك غير مربوط
  // وما جدّدوا) — ما منخترع صف إلها.
  say("\n═══ ١١. مسؤولو العقود ═══");
  const OWNERS: [string, string][] = [
    ["أغاليا", "e_sarah"], ["مانغو", "e_sarah"], ["عبادة", "e_sarah"], ["جدارات", "e_sarah"], ["المول", "e_sarah"],
    ["برو", "e_michael"], ["البلسم", "e_michael"], ["Siizen", "e_michael"], ["مخبر", "e_michael"],
    ["التدريب", "e_hla"], ["وصل", "e_hla"],
  ];
  for (const [name, ownerId] of OWNERS) {
    const c = await prisma.company.findFirst({ where: { name: { contains: name } } });
    if (!c) { say(`  ⚠️ ما لقيت «${name}»`); continue; }
    if (c.accountOwnerId === ownerId) continue;
    say(`  👤 ${c.name} → مسؤول العقد ${ownerId}`);
    changes++;
    if (APPLY) await prisma.company.update({ where: { id: c.id }, data: { accountOwnerId: ownerId } });
  }

  say(`\n${APPLY ? "انطبّق" : "رح ينطبّق"} ${changes} تغيير.`);
  if (!APPLY) say("تشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
