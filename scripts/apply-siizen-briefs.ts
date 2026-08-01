/**
 * Siizen — نص خطة المحتوى على الكروت.
 *
 * الخطة كانت مبعوتة عالتوبيك من نوال (21/7، `Siizen_Content_Plan.pdf`) وأنا
 * قلت «Siizen بلا خطة» — غلط، وما دوّرت. الشركة موقوفة (ما بلّشنا)، بس كروتها
 * معبّاية، فلازم يكون معها المحتوى ليوم ما تبلّش.
 *
 * الخطة: 6 ريل + 6 بوست — كلها تشويق ما قبل الإطلاق وبعدين إطلاق مباشر.
 *
 *   npx tsx scripts/apply-siizen-briefs.ts --apply
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

/** [النوع، رقم القطعة، العنوان، السكريبت/فكرة التصوير، الكابشن] */
const PLAN: [string, number, string, string, string][] = [
  ["REEL", 1, "تشويق — هوية البراند (Concept Teaser)",
    "تصوير بدون كلام: تنين لابسين بلوزات Siizen عم يلعبوا شطرنج · زوم بطيء على تفاصيل القماشة وقصة الهودي الأوفر سايز · قطع مفاجئ لشاشة سودا بالأبيض والأسود «Siizen Coming Soon».",
    "Coming soon…. #Siizen #ComingSoon #Style #reels #soon"],
  ["REEL", 2, "تشويق — جودة الخامة (Texture / Quality Teaser)",
    "تصوير بدون كلام: صندوق أسود أنيق عليه شعار بسيط · إيدين بتفتحه ببطء بإضاءة خافتة · لقطات ماكرو عالخياطة والليبل بدون كشف القطعة · الإضاءة تتحول تدريجياً · اللقطة الأخيرة إيد بتلمس القماش وتختفي بالعتمة ويظهر شعار Siizen.",
    "القماش ما بيكذب — لمسة وحدة كافية تحس الفرق. كريستال خيط ماليزي مستورد. #Siizen #comfort #ComingSoon #details"],
  ["REEL", 3, "تشويق — Mirror / Contrast Concept",
    "سبليت سكرين: نص الشاشة خلفية سودا وموديل بالهودي الأسود بإضاءة ظلّية، والنص التاني خلفية بيضا والهودي الأبيض بإضاءة ساطعة · الاتنين عم يمشوا بنفس الحركة (مرآة) ويقتربوا · يلتقوا بنص الشاشة وتسود بالكامل · يطلع شعار Siizen ببطء.",
    "بس ألوان — مو الأبيض والأسود. هني بداية قصة Siizen. #Siizen #BlackAndWhite #ComingSoon #sport #new"],
  ["REEL", 4, "Comfort / Lifestyle Reel",
    "فويس أوفر: «في لبس بيصير جزء منك» — Siizen مصمم من قطن ناعم 100% بقصة أوفر سايز مريحة لأي وقت باليوم: صحيت الصبح، طالع عالجيم، أو قاعد ببيتك. CTA أخير: اطلب هلق قبل ما ينفد الستوك الأول.",
    "الراحة يلي دايماً كنت تدوري عليها — كريستال مستورد بقصة أوفر سايز. الكمية الأولى محدودة. #Siizen #OversizedFit #اطلب_الآن"],
  ["REEL", 5, "Transformation Reel",
    "فويس أوفر: مشهد 1 شخص بتياب عادية ستايل بلا شخصية · ترانزيشن سريع · مشهد 2 نفس الشخص لابس هودي Siizen بوقفة واثقة · لقطات إضافية: صديقين بالأبيض والأسود يمشوا بالشارع بضحك طبيعي.",
    "مو لازم تغيّر كل الخزانة… بس لازم تختار الصح. الفرق بالإحساس، الفرق بالراحة. #Siizen #BeforeAndAfter #OversizedStyle #OrderNow"],
  ["REEL", 6, "Credibility & Sizing Reel",
    "فويس أوفر: طاولة فيها الهوديز مطوية بالأبيض والأسود · ليش أوفر سايز؟ لأن الراحة مو رفاهية هي أساس · كريستال بخيط ماليزي عالي الجودة · المقاسات تبلّش من اللارج. CTA: اختار مقاسك واطلب هلق.",
    "الراحة الصح ما إلها مقاس واحد. Siizen بيبلش من اللارج لأنو الستايل المريح للكل. #Siizen #OversizedFit #OrderNow"],
  ["POST", 1, "تشويق — كشف الهوية (Mystery Reveal)",
    "صورة واحدة بإضاءة خافتة تظهر بس ظل شخص لابس الهودي، بدون كشف أي تفاصيل. شعار Siizen صغير بزاوية الصورة.",
    "شي جديد عم يتحضّر — مو مجرد براند تياب، طريقة جديدة تلبس فيها راحتك. انطرونا. #Siizen #ComingSoon #StayTuned #newbrand"],
  ["POST", 2, "تشويق — كواليس الصنع (Behind the Process)",
    "كاروسيل 3–4 صور: لقطات ماكرو للقماش والخياطة والليبل بالأبيض والأسود، بدون إظهار شكل القطعة كامل.",
    "كل تفصيل بيحكي قصة — من اختيار القماش لغاية آخر غرزة. عم نحضّرلكن شي مختلف. #Siizen #QualityMatters #ComingSoon #details"],
  ["POST", 3, "تشويق — تفاعلي (Engagement / Guessing)",
    "تصميم بسيط: نص الخلفية أسود ونص أبيض، عليه سؤال تفاعلي بخط واضح.",
    "أبيض ولا أسود؟ شاركونا رأيكن بالكومنتات. #Siizen #ComingSoon #كريستال #new"],
  ["POST", 4, "Product Reveal Post",
    "صورة فلات لاي احترافية للهوديز (الأسود والأبيض) تُظهر تفاصيل الخامة والقصة.",
    "وصلنا — Siizen كريستال ماليزي قصة أوفر سايز. اطلب هلق عبر الرسائل. #Siizen #Available #OversizedFit #OrderNow"],
  ["POST", 5, "Styling / Lookbook Post",
    "كاروسيل ستايلينغ: كذا إطلالة مختلفة لنفس الهودي (كاجوال، رياضي، مسائي بسيط) لعرض تنوّع اللبس.",
    "قطعة وحدة… بكذا ستايل. شو رح تختارو تلبسو مع Siizen اليوم؟ #Siizen #StyleInspo #OversizedFit #اطلب_الآن"],
  ["POST", 6, "إطلاق CTA مباشر (Direct Sales / Urgency)",
    "تصميم بسيط «متوفر الآن» مع تفاصيل الطلب والكمية المحدودة.",
    "الكمية الأولى وصلت… ومحدودة. Siizen كريستال بخيط ماليزي مستورد: قصة أوفر سايز بلونين أسود وأبيض. اطلب هلق قبل النفاد. #Siizen #new #OrderNow #OversizedFit"],
];

async function main() {
  const co = await prisma.company.findFirst({ where: { name: { contains: "Siizen" } } });
  if (!co) throw new Error("ما لقيت Siizen");
  let n = 0;
  for (const [type, pieceNo, title, script, caption] of PLAN) {
    const cards = await prisma.task.findMany({
      where: { companyId: co.id, type, pieceNo, kind: "CONTENT", status: { not: "CANCELED" } },
    });
    if (!cards.length) { console.log(`⚠️ ما لقيت ${type} ${pieceNo}`); continue; }
    const brief = `${title}\n${script}\nالكابشن: ${caption}`;
    console.log(`${type} ${pieceNo} ← ${title}`);
    n += cards.length;
    if (APPLY)
      await prisma.task.updateMany({ where: { id: { in: cards.map((c) => c.id) } }, data: { brief } });
  }
  console.log(`\n${APPLY ? "انكتب" : "رح ينكتب"} نص المحتوى على ${n} كرت`);
  if (!APPLY) console.log("تشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
