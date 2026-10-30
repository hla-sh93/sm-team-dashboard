/**
 * قرارات المشرفة ٣٠/١٠/٢٠٢٦ — بيانات إنتاج. تشغيل تجريبي افتراضياً؛ `--apply` بيكتب بمعاملة وحدة.
 *
 * ١) «نعم، صحح كروت وساعات أيمن» — ٤٢ مهمة إضافية لأيمن بتشرين (تصاميم فونيتيك) مكتوب عليها ٨ س
 *    (وحدة ٤٠ س) → ١.٣٣ س = تصميم واحد بمعدّله المخزَّن ٦/يوم (قرار ١١/١٠ نفسه). المعرّفات من صفحة
 *    `/tasks` الحية ٢٩/١٠ (`docs/qa/2026-10-29-ayman-workload-audit.md`). **ما انلمسوا:** ٤ «صور من
 *    كتاب العلوم» (٨ س) وريل AI فوني جوبس (٢٤ س) — بانتظار جواب المشرفة شو هنّي.
 * ٢) «ريلات التوظيف الزيادة الغيهم» (٤ ريل بالشهر) — تشرين: ريل ٥–٨ (تصوير/مونتاج/نشر، ولا واحد
 *    تصوّر) + «ريل إضافي ٩ و١٠» (خطة تشرين No.3) → ملغى. وبعدها سجلّ الشركة ٨ → ٤ ريل.
 * ٣) «أليسار … فريلانس (بتقبض ٥$ على الريل)» → تكلفة الريل ٥، والراتب ٠.
 *
 * حرّاس: كل كرت لازم يكون بالحالة يلي انشافت (أيمن: نفس الساعات؛ التوظيف: مو منجز)، وإلا بيوقف
 * كل شي بلا كتابة. نسخة احتياطية قبل (`npm run backup:pull`).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const TODAY = "2026-10-30";

const AYMAN_ID = "e_ayman";
const AYMAN_NEW_HOURS = 1.33;
const AYMAN_CARDS: { id: string; title: string; hours: number }[] = [
  { id: "cmuze2jl9000113yl6ott0q5f", title: "بوست1 - فونيتيك", hours: 8 },
  { id: "cmuze65nr000bbt0632opjw32", title: "كاميرات الرمال الذهبية1", hours: 8 },
  { id: "cmuze36vt0001bt065pt47fpe", title: "بوست2-1 - فونيتيك", hours: 8 },
  { id: "cmuze6o0p0001y042xaha3ku3", title: "كاميرات الرمال الذهبية2", hours: 8 },
  { id: "cmuze3ng700012hyipw5kahbz", title: "بوست2-2 - فونيتيك", hours: 8 },
  { id: "cmuze76c60001fdcz5xepgzax", title: "كاميرات الرمال الذهبية3", hours: 8 },
  { id: "cmuze7jyb000by0420ud6ylpf", title: "كاميرات الرمال الذهبية4", hours: 8 },
  { id: "cmuze46y3000b2hyi4xjkprvc", title: "بوست2-3 - فونيتيك", hours: 8 },
  { id: "cmuze7vt3000bfdcz2riapg2c", title: "كاميرات الرمال الذهبية5", hours: 8 },
  { id: "cmuze4n4r000b13ylkbp8yxk6", title: "بوست2-4 - فونيتيك", hours: 8 },
  { id: "cmuze8dm8000l13yluke7mufg", title: "كاميرات الرمال الذهبية6", hours: 8 },
  { id: "cmv3my19w0001d5hi700xs4j8", title: "بوست2-7 - فونيتيك", hours: 8 },
  { id: "cmv3mx18j0001sp0utml6er6m", title: "بوست2-5 - فونيتيك", hours: 8 },
  { id: "cmv3mxjrs0001g9l0tucffgew", title: "بوست2-6 - فونيتيك", hours: 8 },
  { id: "cmuzvhqfn0001lu1cf6x0h4uo", title: "بوست2-8 - فونيتيك", hours: 40 },
  { id: "cmvb200r6000e9dq53bvg36a2", title: "Phoenitech-post-10-11-4", hours: 8 },
  { id: "cmvb23pcl0001p0o0387v4gb0", title: "Phoenitech-post-10-11-7", hours: 8 },
  { id: "cmvb1v5zt0001124tyrniwujc", title: "Phoenitech-post-10-11-1", hours: 8 },
  { id: "cmvb20rdn0001xvoesg7o86yt", title: "Phoenitech-post-10-11-5", hours: 8 },
  { id: "cmvb23304000196h385qwwoc6", title: "Phoenitech-post-10-11-6", hours: 8 },
  { id: "cmvb1z2wq00019dq5qp8hd7jq", title: "Phoenitech-post-10-11-3", hours: 8 },
  { id: "cmvb1y6hf0001qztjrmgvtdzp", title: "Phoenitech-post-10-11-2", hours: 8 },
  { id: "cmvjnmwu1000e77z9whmpgitz", title: "بنى تحتية-بوست10-3", hours: 8 },
  { id: "cmvjnnr520001hcbk856nu923", title: "بنى تحتية-بوست10-4", hours: 8 },
  { id: "cmvjnoio30001a4uo4i0o88fb", title: "بنى تحتية-بوست10-5", hours: 8 },
  { id: "cmvjnlfrv000177z9i5y5xn54", title: "بنى تحتية-بوست10-1", hours: 8 },
  { id: "cmvjnm8470001bre6mdllamx1", title: "بنى تحتية-بوست10-2", hours: 8 },
  { id: "cmvp1c4p5000114hhu5kcg2w2", title: "phoeni-hardwarei-post-10-4", hours: 8 },
  { id: "cmvp2kunv0001eo4k1go92e0t", title: "phoeni-hardwarei-post-10-7", hours: 8 },
  { id: "cmvp2lm3h000eeo4k4dz6acs7", title: "phoeni-hardwarei-post-10-8", hours: 8 },
  { id: "cmvp19jqu00019uxkc44xojkm", title: "phoeni-hardwarei-post-10-1", hours: 8 },
  { id: "cmvp1dgwp000e14hh3bxix2gj", title: "phoeni-hardwarei-post-10-5", hours: 8 },
  { id: "cmvp1abz8000113kxr621jv3b", title: "phoeni-hardwarei-post-10-2", hours: 8 },
  { id: "cmvp1fdg30001e25y4nnkb49m", title: "phoeni-hardwarei-post-10-6", hours: 8 },
  { id: "cmvp1ayrp000e9uxk3vx043xc", title: "phoeni-hardwarei-post-10-3", hours: 8 },
  { id: "cmvsfh38k000r1499t2jmn0xe", title: "phoeni-hardwarei-post-10-14", hours: 8 },
  { id: "cmvsfedq9000e3yagb21u95i0", title: "phoeni-hardwarei-post-10-11", hours: 8 },
  { id: "cmvsf87l80001ld47ztldyanb", title: "بوست شراكة اغا خان", hours: 8 },
  { id: "cmvsfeyze0001gt9xqitnx1d6", title: "phoeni-hardwarei-post-10-12", hours: 8 },
  { id: "cmvsfd1ww00011499g3n57nb9", title: "phoeni-hardwarei-post-10-9", hours: 8 },
  { id: "cmvsffjxl000e1499ca862i4v", title: "phoeni-hardwarei-post-10-13", hours: 8 },
  { id: "cmvsfdpyv00013yagi5fbz24r", title: "phoeni-hardwarei-post-10-10", hours: 8 },
];

const JOBS_COMPANY = "c_tawzeef";
const JOBS_CANCEL: string[] = [
  "2026_9_d_c_tawzeef_REEL_11",
  "2026_9_e_c_tawzeef_REEL_11",
  "2026_9_p_c_tawzeef_REEL_11",
  "2026_9_d_c_tawzeef_REEL_13",
  "2026_9_e_c_tawzeef_REEL_13",
  "2026_9_p_c_tawzeef_REEL_13",
  "2026_9_d_c_tawzeef_REEL_15",
  "2026_9_e_c_tawzeef_REEL_15",
  "2026_9_p_c_tawzeef_REEL_15",
  "2026_9_d_c_tawzeef_REEL_17",
  "2026_9_e_c_tawzeef_REEL_17",
  "2026_9_p_c_tawzeef_REEL_17",
  "adhoc_jobs-oct-no3-extra-reel-9-shoot",
  "adhoc_jobs-oct-no3-extra-reel-9-edit",
  "adhoc_jobs-oct-no3-extra-reel-9-publish",
  "adhoc_jobs-oct-no3-extra-reel-10-shoot",
  "adhoc_jobs-oct-no3-extra-reel-10-edit",
  "adhoc_jobs-oct-no3-extra-reel-10-publish",
];
const JOBS_REELS_FROM = 8;
const JOBS_REELS_TO = 4;

const ALISSAR_NAME = "أليسار";
const ALISSAR_COST_PER_REEL = 5;
// «بينتهي عقدها ب1/11» (المشرفة ٢٩/١٠) و«انتهى عقدها كموظفة، وصار عنا سعر فريلانس عالريل» (٣٠/١٠):
// الشروط الجديدة من هاليوم؛ قبله المالية بتاخد راتبها القديم (`lib/pay-terms.ts`).
const ALISSAR_FREELANCE_FROM = "2026-11-01";

const DONE = new Set(["READY", "PUBLISHED", "CANCELED"]);
const note = (old: string | null, line: string) => [old?.trim(), line].filter(Boolean).join("\n");

async function main() {
  const problems: string[] = [];

  // ١) أيمن
  const ay = await prisma.task.findMany({ where: { id: { in: AYMAN_CARDS.map((c) => c.id) } } });
  for (const c of AYMAN_CARDS) {
    const t = ay.find((x) => x.id === c.id);
    if (!t) problems.push(`أيمن: الكرت ${c.id} («${c.title}») مش موجود`);
    else if (t.assigneeId !== AYMAN_ID || t.kind !== "ADHOC") problems.push(`أيمن: ${c.id} مو مهمة إضافية لأيمن`);
    else if (Math.abs(t.hours - c.hours) > 1e-6) problems.push(`أيمن: ${c.id} ساعاته ${t.hours} مو ${c.hours} — تغيّر من وقت التدقيق`);
  }

  // ٢) التوظيف
  const jobs = await prisma.task.findMany({ where: { id: { in: JOBS_CANCEL } } });
  for (const id of JOBS_CANCEL) {
    const t = jobs.find((x) => x.id === id);
    if (!t) problems.push(`التوظيف: ${id} مش موجود`);
    else if (t.companyId !== JOBS_COMPANY) problems.push(`التوظيف: ${id} مو للتوظيف`);
    else if (DONE.has(t.status) || t.board === "DONE" || t.finishedAt) problems.push(`التوظيف: ${id} منجز/ملغى أصلاً (${t.status}) — ما بينلغى`);
    else if (t.status !== "NOT_STARTED" || t.startedAt) problems.push(`التوظيف: ${id} بلّش الشغل عليه (${t.status}) — اسألي قبل الإلغاء`);
  }
  // ملف تلغرام مربوط = في شغل انسلّم عالكرت؛ الإلغاء بيخبّيه.
  const withFiles = await prisma.telegramMessage.groupBy({ by: ["taskId"], where: { taskId: { in: JOBS_CANCEL } }, _count: true });
  for (const g of withFiles) problems.push(`التوظيف: ${g.taskId} عليه ${g._count} رسالة تلغرام مربوطة — اسألي قبل الإلغاء`);
  const company = await prisma.company.findUnique({ where: { id: JOBS_COMPANY } });
  if (!company) problems.push("التوظيف: الشركة مش موجودة");
  else if (company.reels !== JOBS_REELS_FROM) problems.push(`التوظيف: عدد الريلات بالسجلّ ${company.reels} مو ${JOBS_REELS_FROM}`);

  // ٣) أليسار
  const alissar = await prisma.employee.findMany({ where: { name: ALISSAR_NAME } });
  if (alissar.length !== 1) problems.push(`أليسار: لقيت ${alissar.length} سجلّ باسم «${ALISSAR_NAME}» (لازم واحد)`);
  else if (await prisma.setting.findUnique({ where: { key: `payChange:${alissar[0].id}` } }))
    problems.push("أليسار: في سجلّ تغيير دفع إلها أصلاً — انطبّق قبل؟");

  console.log(`١) أيمن: ${AYMAN_CARDS.length} كرت → ${AYMAN_NEW_HOURS} س (من ${AYMAN_CARDS.reduce((s, c) => s + c.hours, 0)} س = ${AYMAN_CARDS.reduce((s, c) => s + c.hours, 0) / 8} يوم إلى ${(AYMAN_CARDS.length * AYMAN_NEW_HOURS) / 8} يوم)`);
  console.log(`٢) التوظيف: إلغاء ${JOBS_CANCEL.length} كرت (ريل ٥–٨ + إضافي ٩–١٠)، والسجلّ ${JOBS_REELS_FROM} → ${JOBS_REELS_TO} ريل`);
  console.log(`٣) أليسار: من ${ALISSAR_FREELANCE_FROM} تكلفة الريل ${ALISSAR_COST_PER_REEL}$، الراتب ٠ — والشهور قبل بتضل براتبها (كان: ${alissar[0]?.salary ?? "?"}، تكلفة ${alissar[0]?.costPerReel ?? "—"})`);
  if (problems.length) {
    console.log("\n⛔ ما انكتب شي:\n" + problems.map((p) => "  · " + p).join("\n"));
    process.exitCode = 1;
    return;
  }
  if (!APPLY) {
    console.log("\nتشغيل تجريبي — كل الحرّاس مرقت. أضف --apply للكتابة.");
    return;
  }

  // كل كتابة مشروطة بالحالة يلي انقرت، وأي كتابة ما لقت صفّها (تغيّر بين الفحص والتطبيق)
  // بترمي — المعاملة كلها بترجع وما بينكتب شي (فحص ٣٠/١٠: كانت تمرق بصمت وتكمّل الباقي).
  const expectOne = async (what: string, run: Promise<{ count: number }>) => {
    const r = await run;
    if (r.count !== 1) throw new Error(`⛔ ${what}: تغيّر من وقت الفحص (${r.count} صف) — ما انكتب شي`);
  };
  const ali = alissar[0];
  await prisma.$transaction(async (tx) => {
    for (const c of AYMAN_CARDS) {
      const t = ay.find((x) => x.id === c.id)!;
      await expectOne(`أيمن ${c.id}`, tx.task.updateMany({
        where: { id: c.id, hours: c.hours },
        data: {
          hours: AYMAN_NEW_HOURS,
          notes: note(t.notes, `تصحيح ساعات (المشرفة ${TODAY}): ${c.hours} س ← ${AYMAN_NEW_HOURS} س = تصميم واحد بمعدّل أيمن ٦/يوم (تدقيق ٢٩/١٠)`),
        },
      }));
    }
    for (const id of JOBS_CANCEL) {
      const t = jobs.find((x) => x.id === id)!;
      await expectOne(`التوظيف ${id}`, tx.task.updateMany({
        where: { id, status: "NOT_STARTED", startedAt: null, finishedAt: null, board: { not: "DONE" } },
        data: { status: "CANCELED", notes: note(t.notes, `انلغى (المشرفة ${TODAY}): التوظيف ٤ ريل بالشهر — الريلات الزيادة`) },
      }));
    }
    await expectOne("سجلّ التوظيف", tx.company.updateMany({ where: { id: JOBS_COMPANY, reels: JOBS_REELS_FROM }, data: { reels: JOBS_REELS_TO } }));
    await expectOne("أليسار", tx.employee.updateMany({
      where: { id: ali.id, salary: ali.salary, costPerReel: ali.costPerReel },
      data: { costPerReel: ALISSAR_COST_PER_REEL, salary: 0 },
    }));
    // الشروط القديمة بتنحفظ قبل ما تنمحي — الشهور قبل ١/١١ (وتشرين) بتضل براتبها.
    await tx.setting.create({
      data: {
        key: `payChange:${ali.id}`,
        value: JSON.stringify({ from: ALISSAR_FREELANCE_FROM, before: { salary: ali.salary, costPerReel: ali.costPerReel } }),
      },
    });
  });
  console.log("\n✅ انطبّق. بعدها: إعادة توليد دلو تشرين للتوظيف من صفحة الشركات، وتحقّق بنسخة احتياطية جديدة.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
