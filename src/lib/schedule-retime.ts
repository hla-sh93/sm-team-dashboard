/**
 * إعادة تأريخ ما بعد الحفظ — مونتاج يتبع التصوير الفعلي، ومواعيد تُسنَد لأيام
 * الدوام. القاعدة الحاكمة للاتنين: **الكرت المنجز موعده تاريخ، مو خطة** —
 * المحرّك بيملك جدول الشغل المفتوح وبس، أما يلي صار فسجلّه ثابت.
 *
 * الدرسان يلي فرضا القاعدة (تدقيق 11/8):
 *   • ريلات البلسم انصوّرت فعلاً يوم جمعة 31/7؛ «سحبها» ليوم دوام ماجد
 *     (الأربعا 29/7) خلّى السجل يكذب عن يوم الشغل الحقيقي.
 *   • مونتاج BW ريل 68 انجز يوم 10/8؛ إعادة تأريخه «لليوم التالي للتصوير»
 *     (4/8) محت متى اشتغلت أليسار فعلاً.
 *
 * الوحدة نقيّة (بتعدّل على مصفوفة الپايپلاين بالذاكرة) مشان تنفحص مباشرة —
 * `schedule.ts` ملف "use server" فما بيصدّر غير async.
 */
import type { PipelineTask } from "./pipeline";
import { backWorkday, forwardWorkday, parseWorkDays } from "./dates";

const isoOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

const D = (s: string | null): Date | null => {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/**
 * Re-date every مونتاج card to the working day after its shoot ACTUALLY
 * finished, once preservation has restored `finishedAt` onto the shoot card.
 *
 * `expandPipeline` can only use planned dates, so a reel planned for 1/6 and
 * shot on 5/7 produced a montage card due 2/6 — a month "late" before the
 * footage existed. Cards whose shoot has not happened yet keep their planned
 * date; they are blocked anyway.
 */
export function retimeEditsAfterActualShoot(pipe: PipelineTask[], editorWorkDays: number[]) {
  // A reel that is already PUBLISHED was obviously cut — its montage card is a
  // new stage on an old piece, and must not resurface as open work on أليسار.
  const publishedKeys = new Set(
    pipe
      .filter((t) => t.stage === "PUBLISH" && (t.board === "DONE" || t.status === "PUBLISHED"))
      .map((t) => t.pipelineKey),
  );
  for (const t of pipe) {
    if (t.stage !== "EDIT" || !publishedKeys.has(t.pipelineKey)) continue;
    t.board = "DONE";
    t.status = "READY";
  }

  // …وبالعكس: مونتاج مسجّل «منجز» وتصويره لسا ما صار وقطعته ما انتشرت هو حالة
  // مستحيلة. صارت لما كرت مونتاج انسكّر بجولة سابقة ثم رجع التصوير مفتوح —
  // وخطوة الحفظ بتعيد تثبيت الإغلاق للأبد. القاعدة: ما في كرت بيضل منجز
  // وحاجزه مفتوح إلا إذا النشر أثبت إنّو صار.
  const shotDone = new Set(
    pipe.filter((t) => t.stage === "SHOOT" && (t.board === "DONE" || t.status === "READY"))
      .map((t) => t.pipelineKey),
  );
  for (const t of pipe) {
    if (t.stage !== "EDIT" || t.board !== "DONE") continue;
    if (publishedKeys.has(t.pipelineKey) || shotDone.has(t.pipelineKey)) continue;
    t.board = "TODO";
    t.status = "NOT_STARTED";
    t.startedAt = null;
    t.finishedAt = null;
    t.completedAt = null;
  }

  // كرت النشر «جهوزيته» هي يوم نشره — ما إلها معنى تاني. تثبيت قديم كان بيجمّد
  // `readyDate` على تاريخ منقرض فيطلع «نشر 10/8 وجهوزيته 19/8».
  for (const t of pipe) {
    if (t.stage !== "PUBLISH" || !t.publishDate) continue;
    t.readyDate = t.publishDate;
    // ويوم شغله ما بيصير **بعد** يوم نشره: النشر هو الشغل نفسه، فما حدا بينشر
    // قطعة ثم يشتغل عليها. بتصير لما ينتصحّح يوم النشر لواقعه (من إنستغرام أو
    // من إقفال بدليل) ويضل يوم الشغل على يوم الخطة — ٢٨ كرت بالإنتاج طلعوا
    // هيك، منهم وصل بوست ١٥: نشر ٢٠/٨ وشغل ٣٠/٩.
    //
    // ما منستثني المثبّت هون، متل سطر الجهوزية فوقه بالضبط: التثبيت سلطة
    // القائدة على **شو صار**، ويوم النشر يلي ثبّتته ما بينمسّ — يلي بينمشي
    // معه هو اليوم المشتَقّ منه. والسحب ليوم دوام بيجي بالخطوة الجاية.
    if (t.workDate && t.workDate > t.publishDate) t.workDate = t.publishDate;
  }

  // ومونتاج مؤرّخ **قبل** تصويره المخطّط حالة مستحيلة كمان — بيصير لما تثبيت
  // قديم يضل معلّق بعد ما ينزاح موعد التصوير. منعيد تأريخه لليوم التالي للتصوير.
  // (المنجز بيتحاكم بالكتلة الجاية على يوم التصوير **الفعلي** مو الخطة؛
  // والمثبّت قرار قائدة صريح — فونيتيك ريل مثبّت 10/8 كان ينسحب 9/8 كل توليد.)
  const shootPlan = new Map<string, string>();
  for (const t of pipe) {
    if (t.stage !== "SHOOT" || !t.pipelineKey) continue;
    const d = t.readyDate ?? t.workDate;
    if (d) shootPlan.set(t.pipelineKey, d);
  }
  for (const t of pipe) {
    if (t.stage !== "EDIT" || !t.pipelineKey || t.board === "DONE" || t.isPinned) continue;
    const shoot = shootPlan.get(t.pipelineKey);
    const own = t.readyDate ?? t.workDate;
    if (!shoot || !own || own > shoot) continue;
    const d = new Date(`${shoot}T00:00:00`);
    let guard = 0;
    do {
      d.setDate(d.getDate() + 1);
      guard++;
    } while (!editorWorkDays.includes(d.getDay()) && guard < 14);
    const iso = isoOf(d);
    t.workDate = iso;
    t.readyDate = iso;
  }

  const shotAt = new Map<string, Date>();
  for (const t of pipe) {
    if (t.stage !== "SHOOT" || !t.pipelineKey || !t.finishedAt) continue;
    shotAt.set(t.pipelineKey, t.finishedAt);
  }
  // The publish-date clamp below is ONLY legitimate for a piece that already
  // went out: it must have been cut beforehand. For a piece still unpublished
  // whose shoot landed late, clamping would date the montage BEFORE the footage
  // exists — the honest reading is that the montage is simply late too.
  for (const t of pipe) {
    if (t.stage !== "EDIT" || !t.pipelineKey) continue;
    const done = shotAt.get(t.pipelineKey);
    if (!done) continue;
    const isPublished = publishedKeys.has(t.pipelineKey);
    // الكرت **المحسوم** — منجز (سجلّ واقع) أو مثبّت (قرار قائدة) — تاريخه
    // بيثبت ما دام صادقاً: يوم التصوير الفعلي أو بعده، ومو بعد نشر قطعة
    // انتشرت. بنصلّح بس المستحيل: مونتاج مؤرّخ قبل وجود المادة، أو بعد يوم
    // النشر (كروت حزيران المستوردة أخدت ختم يوم الاستيراد لا يوم القص).
    if (
      (t.board === "DONE" || t.isPinned) &&
      t.workDate &&
      t.workDate >= isoOf(done) &&
      !(isPublished && t.publishDate && t.workDate > t.publishDate)
    )
      continue;
    const d = new Date(done);
    let guard = 0;
    do {
      d.setDate(d.getDate() + 1);
      guard++;
    } while (!editorWorkDays.includes(d.getDay()) && guard < 14);
    const iso = isoOf(d);
    // …لكن أبداً بعد يوم النشر **لقطعة انتشرت فعلاً**: كروت حزيران المنشورة
    // إجاها `finishedAt` من يوم استيراد الأرشيف (5/7) مو من يوم التصوير، فطلع
    // مونتاج برو مؤرّخ 5/7 لريل انتشر 12/6.
    t.workDate = isPublished && t.publishDate && iso > t.publishDate ? t.publishDate : iso;
    t.readyDate = t.workDate;
  }
}

export function snapPipelineWorkDatesToAssigneeWorkDays(
  pipe: PipelineTask[],
  employees: { id: string; workDays: string | number[] }[],
) {
  const workDaysByEmployee = new Map(
    employees.map((e) => [e.id, parseWorkDays(e.workDays)]),
  );
  // هالدالة بتلمس `workDate` **وبس** — يوم ما بيشتغل الشخص. `publishDate` ما
  // بينمسّ أبداً.
  //
  // وهاد الفرق هو كل القصة بكرت النشر: القائدة (٥/٩) «النشر مسموح يوم السبت،
  // في إمكانية الجدولة». يعني القطعة بتنزل السبت وعمر بيجدولها قبلها بيوم
  // دوام — فيوم شغله بينسحب للخميس ويوم نشرها بيضل السبت. كنت استثنيت كروت
  // النشر من السحب ظنّاً إنه بيزحزح تاريخ النشر؛ ما بيزحزحه، فالاستثناء كان
  // بيحطّ شغل عمر على يوم عطلته بلا فايدة.
  for (const task of pipe) {
    // الشغل بينخطّط على أيام الدوام، بس الواقع بيصير وين ما صار: كرت منجز
    // موعده هو يوم الشغل الفعلي — تحريكه ليوم دوام «أنظف» تزوير للسجل.
    if (task.board === "DONE") continue;
    // الصف المثبّت سلطة يدوية — التوليد ما بيمسّه، ولا حتى ليصلّح يومه. لو
    // ثبّتّي كرتاً على يوم عطلة فهاد قرارك، والفحص العميق بيوقّفك عليه بدل ما
    // يغيّره من ورا ظهرك.
    if (task.isPinned) continue;
    if (!task.assigneeId || !task.workDate) continue;
    const workDays = workDaysByEmployee.get(task.assigneeId);
    if (!workDays) continue;
    const d = D(task.workDate);
    if (!d || workDays.includes(d.getDay())) continue;
    const snapped = task.readyDate || task.publishDate
      ? backWorkday(d, workDays)
      : forwardWorkday(d, workDays);
    task.workDate = isoOf(snapped);
  }
}
