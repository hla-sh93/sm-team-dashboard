/**
 * بيفحص حمولة «استيراد خطة JSON» على **لقطة الإنتاج** قبل ما تنطبّق.
 *
 * ليش: معرّف الكرت مو رقم القطعة. `2026_6_d_c_wasl_REEL_5` رقم قطعته ٣، و
 * `..._POST_59` عند Siizen هو بوست ٢. مرّة كتبت تصحيحاً على الكرت الغلط لأني
 * قريت الرقم من المعرّف. الحمولة بتطابق بـ(النوع·رقم القطعة·المرحلة)، وهاد
 * السكربت بيتأكّد إنّ كل بند بيطابق **صفاً واحداً بالضبط** وبيفرجيك عليه.
 *
 *   npx tsx scripts/preflight-payload.ts backups/prod-<آخر لقطة>.json scripts/data/<file>.json ...
 */
import { readFileSync } from "node:fs";
import { parseWorkDays, toISODate } from "@/lib/dates";
import { planCourseCards, type CourseItem, type CoursePoster } from "@/lib/course-cards";

type Row = Record<string, unknown>;
const WEEKDAY = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const L = (v: unknown) => {
  if (!v) return "—";
  const d = new Date(v as string);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const [snapshotPath, ...files] = process.argv.slice(2);
if (!snapshotPath || !files.length) {
  console.error("الاستعمال: preflight-payload.ts <لقطة الإنتاج> <حمولة> [...]");
  process.exit(1);
}
const snap = JSON.parse(readFileSync(snapshotPath, "utf8"));
const tasks = snap.tasks as Row[];
const companies = snap.companies as Row[];

let problems = 0;
for (const file of files) {
  const payload = JSON.parse(readFileSync(file, "utf8"));
  const company = companies.find(
    (c) => c.name === payload.companyName || c.id === payload.companyId,
  );
  console.log(`\n■ ${file} — ${payload.companyName ?? payload.companyId} m=${payload.month}`);
  if (!company) {
    console.log("   ✗ الشركة مو موجودة باللقطة");
    problems++;
    continue;
  }
  for (const spec of (payload.pieceStates ?? []) as Row[]) {
    const hits = tasks.filter(
      (t) =>
        t.companyId === company.id &&
        t.year === payload.year &&
        t.month === payload.month &&
        t.type === spec.type &&
        t.pieceNo === spec.pieceNo &&
        t.stage === spec.stage &&
        t.status !== "CANCELED" &&
        t.isAuto,
    );
    if (hits.length !== 1) {
      console.log(`   ✗ ${spec.type}#${spec.pieceNo} ${spec.stage}: طابق ${hits.length} صف`);
      problems++;
      continue;
    }
    const t = hits[0];
    const bits = [String(t.id)];
    if (spec.pinned !== undefined) bits.push(`مثبّت ${t.isPinned}→${spec.pinned}`);
    if (spec.status) bits.push(`حالة ${t.status}→${spec.status}`);
    if (spec.date) bits.push(`إنجاز → ${spec.date}`);
    if (spec.workDate) bits.push(`شغل ${L(t.workDate)}→${spec.workDate}`);
    if (spec.readyDate) bits.push(`جهوزية ${L(t.readyDate)}→${spec.readyDate}`);
    if (spec.publishDate) bits.push(`نشر ${L(t.publishDate)}→${spec.publishDate}`);
    if (spec.removeEvidence) {
      const n = String(t.notes ?? "")
        .split(/\r?\n/)
        .filter((line) => line.trim() === String(spec.removeEvidence).trim()).length;
      bits.push(`بيشيل ${n} سطر`);
      if (!n) {
        console.log(`   ⚠️ ${spec.type}#${spec.pieceNo}: السطر المطلوب شيلو مو موجود على الكرت`);
      }
    }
    const dup = String(t.notes ?? "")
      .split(/\r?\n/)
      .filter((line) => line.trim() === String(spec.evidence).trim()).length;
    if (dup) bits.push(`الدليل موجود أصلاً (${dup})`);
    console.log(
      `   ✓ ${String(spec.type).padEnd(5)}#${String(spec.pieceNo).padEnd(3)} ${String(spec.stage).padEnd(7)} · ${bits.join(" · ")}`,
    );
  }
  // نفس قاعدة الخادم (`plan-update.ts`): دلو الحمولة، بلا رقم قطعة، مو ملغى،
  // المرحلة إن انذكرت، والعنوان **يحتوي** النصّ. كان الفحص بيقارن العنوان
  // بالمساواة وبكل الدلاء، فرفض «سيناريو تصوير — BW» (عنوانه بيكمل «· دورة
  // ١٠ أيلول…») رغم إنّ الخادم بيقبله — فحص أشدّ من الخادم بيوقف حمولة صحيحة.
  for (const spec of (payload.adhocStates ?? []) as Row[]) {
    const needle = String(spec.title).trim();
    const hits = tasks.filter(
      (t) =>
        t.companyId === company.id &&
        t.year === payload.year &&
        t.month === payload.month &&
        t.pieceNo == null &&
        t.status !== "CANCELED" &&
        (spec.stage == null || t.stage === spec.stage) &&
        String(t.title ?? "").includes(needle),
    );
    if (hits.length !== 1) {
      console.log(`   ✗ «${needle}» (${spec.stage ?? "بلا مرحلة"}): طابق ${hits.length} كرت`);
      problems++;
    } else {
      const t = hits[0];
      const bits = [t.id, `«${t.title}»`, `${t.status}`];
      if (spec.status) bits.push(`حالة ${t.status}→${spec.status}`);
      if (spec.hours != null) bits.push(`ساعات ${t.hours}→${spec.hours}`);
      console.log(`   ✓ خارج الخطة · ${bits.join(" · ")}`);
    }
  }
  // كروت الدورات: نفس الحساب يلي بيكتبه الخادم (`course-cards.ts`) — بيفرجيك
  // لكل كرت هل رح ينخلق، أو ينعاد توقيته، أو يضل متل ما هو لأنه منجز/ملغى.
  type LooseBlock = {
    designer: string;
    publisher: string;
    publishDaysBefore?: number;
    items: (Omit<CourseItem, "designHours"> & { designHours?: number })[];
    poster?: Omit<CoursePoster, "hours"> & { hours?: number };
  };
  const block = payload.courses as LooseBlock | undefined;
  if (block) {
    const employees = snap.employees as Row[];
    const person = (name: string) => employees.find((e) => e.name === name);
    const designer = person(block.designer);
    const publisher = person(block.publisher);
    if (!designer || !publisher) {
      console.log(`   ✗ الدورات: ${!designer ? `المصمّم «${block.designer}»` : `الناشر «${block.publisher}»`} مو موجود باللقطة`);
      problems++;
    } else {
      const plan = planCourseCards(
        {
          publishDaysBefore: block.publishDaysBefore ?? 10,
          items: block.items.map((item) => ({ ...item, designHours: item.designHours ?? 2 })),
          poster: block.poster ? { ...block.poster, hours: block.poster.hours ?? 3 } : undefined,
        },
        { id: String(designer.id), name: String(designer.name), workDays: parseWorkDays(designer.workDays as string) },
        { id: String(publisher.id), name: String(publisher.name), workDays: parseWorkDays(publisher.workDays as string) },
      );
      if (!plan.ok) {
        console.log(`   ✗ ${plan.error}`);
        problems++;
      } else {
        for (const card of plan.cards) {
          const t = tasks.find((row) => row.id === card.id);
          const settled =
            t &&
            (t.status === "CANCELED" ||
              t.board === "DONE" ||
              t.finishedAt != null ||
              ["READY", "PUBLISHED"].includes(String(t.status)));
          const day = card.stage === "PUBLISH" ? card.publishDate! : card.readyDate;
          const when = `${toISODate(day)} ${WEEKDAY[day.getDay()]}`;
          const who = card.stage === "PUBLISH" ? publisher.name : designer.name;
          const verdict = !t
            ? "جديد"
            : settled
              ? `منجز/ملغى (${t.status}) — ما بينلمس`
              : t.companyId !== company.id
                ? "✗ تبع شركة تانية"
                : `مفتوح — يعاد توقيته ${L(card.stage === "PUBLISH" ? t.publishDate : t.readyDate)}→${toISODate(day)}`;
          if (verdict.startsWith("✗")) problems++;
          console.log(
            `   ${verdict.startsWith("✗") ? "✗" : "✓"} ${card.stage === "PUBLISH" ? "🚀" : "🎨"} ${when} · ${who} · ${card.hours}س${card.priority === "URGENT" ? " · مستعجل" : ""} · ${card.title} — ${verdict}`,
          );
        }
      }
    }
  }
}
console.log(problems ? `\n✗ ${problems} مشكلة — ما تطبّق` : "\n✓ كل بند بيطابق صفاً واحداً بالضبط");
process.exit(problems ? 1 : 0);
