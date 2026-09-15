/**
 * كروت الدورات — حساب خالص بلا قاعدة بيانات.
 *
 * شغل التدريب مدفوع بمواعيد الدورات لا بخطة شهرية (قرار القائدة ١/٨/٢٠٢٦):
 * لكل دورة كرت **تصميم** إعلان وكرت **نشر** قبل بدايتها بعدد أيام محدَّد.
 * الحساب هون مستعمل من مسار الحمولة على الخادم ومن فحص ما قبل التطبيق
 * (`preflight-payload.ts`) — رقم واحد بمكان واحد، فالفحص بيقول بالضبط شو
 * رح يكتب الخادم.
 *
 * قواعد ملزمة:
 * - النشر «قبل الدورة بـN أيام» بينزلق لأقرب يوم دوام **قبله** عند الناشر —
 *   الأبكر بيحترم القاعدة، والتأخير لا.
 * - يوم التصميم قرار القائدة لا حساب آلي، ولازم يكون يوم دوام للمصمّم وقبل
 *   النشر. أقل من يومين بين التصميم والنشر = الكرت مستعجل (قاعدة اليومين).
 * - المعرّفات ثابتة (`course_<slug>_design` / `course_<slug>_publish`) فإعادة
 *   التطبيق ما بتكرّر الكروت.
 */
import { backWorkday, fromISODate, isWorkDay, shiftDays, toISODate } from "@/lib/dates";

export const COURSE_SLUG = /^[a-z0-9][a-z0-9-]{0,39}$/;

export type CourseItem = {
  slug: string;
  title: string;
  start: string;
  end?: string;
  details?: string;
  designOn: string;
  designHours: number;
};

export type CoursePoster = {
  slug: string;
  title: string;
  designOn: string;
  hours: number;
  details?: string;
};

export type CourseBlock = {
  publishDaysBefore: number;
  items: CourseItem[];
  poster?: CoursePoster;
};

export type CourseCard = {
  id: string;
  stage: "DESIGN" | "PUBLISH";
  title: string;
  assigneeId: string;
  workDate: Date;
  readyDate: Date;
  publishDate: Date | null;
  hours: number;
  priority: "NORMAL" | "URGENT";
  brief: string;
};

type Person = { id: string; name: string; workDays: number[] };

const DAY_MS = 86_400_000;
const daysBetween = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / DAY_MS);

/**
 * بيحوّل كتلة الدورات لكروت جاهزة للكتابة، أو بيرجع كل المشاكل دفعة وحدة —
 * مشكلة وحدة كافية لرفض الحمولة كلها.
 */
export function planCourseCards(
  block: CourseBlock,
  designer: Person,
  publisher: Person,
): { ok: true; cards: CourseCard[] } | { ok: false; error: string } {
  const problems: string[] = [];
  const cards: CourseCard[] = [];

  const slugs = [...block.items.map((item) => item.slug), ...(block.poster ? [block.poster.slug] : [])];
  if (new Set(slugs).size !== slugs.length) problems.push("معرّف دورة مكرّر");

  for (const item of block.items) {
    const start = fromISODate(item.start);
    const publishOn = backWorkday(shiftDays(start, -block.publishDaysBefore), publisher.workDays);
    const designOn = fromISODate(item.designOn);
    if (!isWorkDay(designOn, designer.workDays)) {
      problems.push(`«${item.title}»: يوم التصميم ${item.designOn} ليس يوم دوام لـ${designer.name}`);
    }
    const gap = daysBetween(designOn, publishOn);
    if (gap <= 0) {
      problems.push(`«${item.title}»: التصميم ${item.designOn} ليس قبل النشر ${toISODate(publishOn)}`);
    }
    if (item.end && fromISODate(item.end).getTime() < start.getTime()) {
      problems.push(`«${item.title}»: نهاية الدورة ${item.end} قبل بدايتها ${item.start}`);
    }
    const brief = [
      `الدورة: ${item.title}`,
      `تبدأ ${item.start}` + (item.end ? ` وتنتهي ${item.end}` : ""),
      item.details,
      `النشر قبل البداية بـ${block.publishDaysBefore} أيام: ${toISODate(publishOn)}.`,
    ]
      .filter((line): line is string => Boolean(line))
      .join("\n");
    cards.push({
      id: `course_${item.slug}_design`,
      stage: "DESIGN",
      title: `تصميم إعلان: ${item.title}`,
      assigneeId: designer.id,
      workDate: designOn,
      readyDate: designOn,
      publishDate: null,
      hours: item.designHours,
      // قاعدة اليومين: التسليم قبل النشر بيومين على الأقل، ويوم واحد مستعجل.
      priority: gap >= 2 ? "NORMAL" : "URGENT",
      brief,
    });
    cards.push({
      id: `course_${item.slug}_publish`,
      stage: "PUBLISH",
      title: `نشر إعلان: ${item.title}`,
      assigneeId: publisher.id,
      workDate: publishOn,
      readyDate: publishOn,
      publishDate: publishOn,
      hours: 0.5,
      priority: "NORMAL",
      brief,
    });
  }

  if (block.poster) {
    const designOn = fromISODate(block.poster.designOn);
    if (!isWorkDay(designOn, designer.workDays)) {
      problems.push(`«${block.poster.title}»: يوم التصميم ${block.poster.designOn} ليس يوم دوام لـ${designer.name}`);
    }
    cards.push({
      id: `course_${block.poster.slug}_design`,
      stage: "DESIGN",
      title: block.poster.title,
      assigneeId: designer.id,
      workDate: designOn,
      readyDate: designOn,
      publishDate: null,
      hours: block.poster.hours,
      priority: "NORMAL",
      brief: block.poster.details ?? block.poster.title,
    });
  }

  if (problems.length) return { ok: false, error: `كروت الدورات: ${problems.join(" · ")}` };
  return { ok: true, cards };
}

/** موعد استحقاق الكرت — النشر لكرت النشر، والجهوزية لكرت التصميم. */
export function courseCardDue(card: Pick<CourseCard, "stage" | "readyDate" | "publishDate">): Date {
  return card.stage === "PUBLISH" && card.publishDate ? card.publishDate : card.readyDate;
}

/** حقول الدلو المشتقّة من موعد الاستحقاق — نفس قاعدة الكروت القديمة. */
export function courseCardBucket(card: Pick<CourseCard, "stage" | "readyDate" | "publishDate">) {
  const due = courseCardDue(card);
  return { month: due.getMonth(), year: due.getFullYear(), week: Math.ceil(due.getDate() / 7) };
}
