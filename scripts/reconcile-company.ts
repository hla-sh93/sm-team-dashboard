/**
 * مطابقة كروت شركة مع الواقع اللي بتعرفو القائدة — شركة شركة (§14).
 *
 * القائدة (3/8): «خلينا نبدأ بكل شركة لحال، فحص ومطابقة». الواقع اللي بتعرفو
 * هي المرجع، والكروت هي النسخة اللي لازم تلحقو — مو العكس.
 *
 * ليش سكربت مو تعديل يدوي: كل صف بينكتب معه **سببه** على الكرت، فبيضل معروف
 * ليش انسكّر؛ والتشغيل متكافئ (كرت مسكّر أصلاً ما بينلمس).
 *
 *   npx tsx scripts/reconcile-company.ts مخبر            # تشغيل تجريبي
 *   npx tsx scripts/reconcile-company.ts مخبر --apply
 *
 * ⚠️ التاريخ: كرت النشر بياخد تاريخ نشره المخطط، وكرت الإنتاج تاريخ تسليمه —
 * هيك التقارير بتقرا «انخلص وقتها» بدل ما تقول إنّ كل شي صار اليوم.
 */
import { PrismaClient } from "@prisma/client";
import { isTaskDoneState } from "../src/lib/constants";

const prisma = new PrismaClient();
const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const COMPANY = argv.find((a) => !a.startsWith("--"));

/** أي كرت بينطبّق عليه القرار: الشركة، الدورة (سنة-شهر0)، النوع، أرقام القطع، المراحل. */
type Rule = {
  cycle: [number, number];
  type: string;
  pieces: number[];
  stages: string[];
  /** «منشور» لكروت النشر، «منجز» لكروت الإنتاج. */
  as: "PUBLISHED" | "READY";
  why: string;
};

const RULES: Record<string, Rule[]> = {
  // القائدة (3/8): «كل البوستات السابقة خالصة ومنشورة، كل الريلات السابقة خالصة
  // ومنشورة باستثناء الـ3 ريل يلي لازم نعيدهن يوم الأربعا. وفي لسا 3 ريل من خطة
  // الشهر الحالي لم يتم تصويرهم — هاد الوحيد يلي ناقص بخطة المخبر.»
  //
  // يعني: دورة حزيران (15/6 ← 14/7) خالصة كلها، وريلات تموز 1–3 منشورة،
  // وبوستات تموز يلي فات موعد نشرها منشورة. ريلات تموز 4–5–6 بتضل مفتوحة —
  // هنّ التلاتة يلي ما انتصوّروا. وريلات الإعادة كروتها منفصلة (ADHOC).
  مخبر: [
    { cycle: [2026, 5], type: "REEL", pieces: [5, 6], stages: ["SHOOT", "EDIT"], as: "READY", why: "أكّدت القائدة (3/8): كل ريلات الدورات السابقة خالصة" },
    { cycle: [2026, 5], type: "REEL", pieces: [5, 6], stages: ["PUBLISH"], as: "PUBLISHED", why: "أكّدت القائدة (3/8): كل ريلات الدورات السابقة منشورة" },
    { cycle: [2026, 6], type: "REEL", pieces: [1, 2, 3], stages: ["PUBLISH"], as: "PUBLISHED", why: "أكّدت القائدة (3/8): كل الريلات السابقة منشورة عدا التلاتة يلي بدها إعادة" },
    { cycle: [2026, 6], type: "POST", pieces: [1, 2, 3, 4], stages: ["PUBLISH"], as: "PUBLISHED", why: "أكّدت القائدة (3/8): كل البوستات السابقة منشورة" },
  ],
};

async function main() {
  const key = COMPANY && Object.keys(RULES).find((k) => k.includes(COMPANY) || COMPANY.includes(k));
  if (!key) {
    console.error(`الاستعمال: npx tsx scripts/reconcile-company.ts <شركة> [--apply]\nالمتوفّر: ${Object.keys(RULES).join("، ")}`);
    process.exit(1);
  }
  const co = await prisma.company.findFirst({ where: { name: { contains: key } } });
  if (!co) {
    console.error(`ما لقيت «${key}»`);
    process.exit(1);
  }
  console.log(`\n═══ ${co.name} ═══`);

  let changed = 0;
  let already = 0;
  for (const rule of RULES[key]) {
    for (const pieceNo of rule.pieces) {
      const cards = await prisma.task.findMany({
        where: {
          companyId: co.id,
          year: rule.cycle[0],
          month: rule.cycle[1],
          type: rule.type,
          pieceNo,
          stage: { in: rule.stages },
          status: { not: "CANCELED" },
        },
      });
      if (!cards.length) console.log(`⚠️  ما في كرت: ${rule.type}#${pieceNo} ${rule.stages.join("/")} بدورة ${rule.cycle[0]}-${rule.cycle[1] + 1}`);
      for (const c of cards) {
        // وقت الإنجاز الحقيقي: كرت النشر بتاريخ نشره، والإنتاج بتاريخ تسليمه.
        const when = (c.stage === "PUBLISH" ? c.publishDate : (c.readyDate ?? c.publishDate)) ?? new Date();
        // …بس ما بيصير يخلص قبل ما يبلّش. كرت كان عليه `startedAt` أحدث من
        // موعد تسليمه (اشتغلوا عليه متأخرين) كان بياخد نهاية أقدم من بدايته.
        const started = c.startedAt ?? when;
        const finished = c.finishedAt ?? (when.getTime() < started.getTime() ? started : when);

        if (isTaskDoneState(c)) {
          already++;
          // كرت سكّرناه نحنا بتشغيل سابق: بنعيد تثبيت تاريخه القانوني (تاريخ
          // النشر لكرت النشر) — هيك التشغيل بيوصل لنفس النتيجة مهما تكرّر، ولو
          // كانت مرّة سابقة زحّطت التاريخ.
          const ours = (c.notes ?? "").includes(rule.why);
          if (ours && c.finishedAt && c.finishedAt.getTime() !== when.getTime()) {
            console.log(`🔧 ${rule.type}#${pieceNo} ${c.stage} — تاريخ ${c.finishedAt.toLocaleDateString("en-CA")} → ${when.toLocaleDateString("en-CA")} (المخطط)`);
            if (APPLY)
              await prisma.task.update({
                where: { id: c.id },
                data: { finishedAt: when, completedAt: when, startedAt: started.getTime() > when.getTime() ? when : started },
              });
          } else if (c.startedAt && c.finishedAt && c.finishedAt.getTime() < c.startedAt.getTime()) {
            console.log(`🔧 ${rule.type}#${pieceNo} ${c.stage} — نهاية قبل بداية، بتنضبط على ${c.startedAt.toLocaleDateString("en-CA")}`);
            if (APPLY)
              await prisma.task.update({
                where: { id: c.id },
                data: { finishedAt: c.startedAt, completedAt: c.completedAt ?? c.startedAt },
              });
          }
          continue;
        }
        changed++;
        console.log(
          `✏️  ${rule.type}#${pieceNo} ${String(c.stage).padEnd(7)} ${c.status}/${c.board} → ${rule.as}/DONE  [${when.toLocaleDateString("en-CA")}]`,
        );
        if (!APPLY) continue;
        await prisma.task.update({
          where: { id: c.id },
          data: {
            status: rule.as,
            board: "DONE",
            startedAt: started,
            finishedAt: finished,
            completedAt: c.completedAt ?? finished,
            notes: [c.notes, rule.why].filter(Boolean).join(" · "),
            isPinned: true, // ما بيرجع يتفتح بإعادة الجدولة
          },
        });
      }
    }
  }

  // ── ترتيب السلسلة: التصوير قبل المونتاج، والمونتاج قبل النشر ──
  //
  // مرّتان، والترتيب بينهن مقصود:
  //
  // (١) **رجوعاً**: تاريخ النشر هو المرساة — القطعة انّنشرت فعلاً بهاليوم. فإذا
  //     كان المونتاج مسجّل خالص **بعد** نشره (2/8 لريل انّنشر 19/7 — رقم إجا من
  //     إقفال جماعي متأخر، مو من الواقع)، بينزل لتاريخ النشر: ما بينشر شي قبل
  //     ما يخلص.
  // (٢) **تقدّماً**: بعدها، أي مرحلة لسا أقدم من يلي قبلها بتنزحّط لقدّام —
  //     مونتاج ريل ٦ كان مسلّمو مخطط 4/7 وتصويره 5/7، والاتنين مخطط بلا مرساة.
  const STAGE_ORDER = ["WRITE", "DESIGN", "SHOOT", "EDIT", "PUBLISH"];
  const chainCards = await prisma.task.findMany({
    where: { companyId: co.id, pipelineKey: { not: null }, status: { not: "CANCELED" } },
  });
  const chains = new Map<string, typeof chainCards>();
  for (const c of chainCards) {
    const arr = chains.get(c.pipelineKey!) ?? [];
    arr.push(c);
    chains.set(c.pipelineKey!, arr);
  }
  let clamped = 0;
  const setFinished = async (c: (typeof chainCards)[number], to: Date, why: string) => {
    clamped++;
    console.log(`🔗 ${c.type}#${c.pieceNo} ${c.stage} — ${c.finishedAt?.toLocaleDateString("en-CA")} ${why} → ${to.toLocaleDateString("en-CA")}`);
    c.finishedAt = to;
    if (APPLY)
      await prisma.task.update({
        where: { id: c.id },
        data: {
          finishedAt: to,
          completedAt: to,
          startedAt: c.startedAt && c.startedAt.getTime() > to.getTime() ? to : c.startedAt,
        },
      });
  };

  for (const group of chains.values()) {
    const ordered = [...group]
      .filter((c) => isTaskDoneState(c) && c.finishedAt)
      .sort((a, b) => STAGE_ORDER.indexOf(a.stage ?? "") - STAGE_ORDER.indexOf(b.stage ?? ""));
    // (١) رجوعاً من النشر
    let ceiling: Date | null = null;
    for (const c of [...ordered].reverse()) {
      if (ceiling && c.finishedAt!.getTime() > ceiling.getTime())
        await setFinished(c, ceiling, "بعد المرحلة يلي بعدو");
      else ceiling = c.finishedAt!;
    }
    // (٢) تقدّماً من أول مرحلة
    let floor: Date | null = null;
    for (const c of ordered) {
      if (floor && c.finishedAt!.getTime() < floor.getTime())
        await setFinished(c, floor, "قبل المرحلة يلي قبلو");
      else floor = c.finishedAt!;
    }
  }

  console.log(`\n${APPLY ? "انعدّل" : "رح يتعدّل"} ${changed} كرت · ${already} كانوا مسكّرين أصلاً${clamped ? ` · ${clamped} تاريخ انزحّط لترتيب السلسلة` : ""}.`);
  if (!APPLY) console.log("تشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
