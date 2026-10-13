/**
 * تلخيص الشغل بالشركة والعدد — الجملة المشتركة بين رسالة الصباح وتقرير المساء.
 *
 * القائدة (١٦/٩/٢٠٢٦): «خلي المهام باسم الشركة والعدد بلا ترقيم كل بوست. خلي
 * النشر باسم الشركة ونوع المحتوى فقط. خفف كمية الرسائل». فالسطر بيقول
 * «التوظيف 3 بوست · التدريب 2 تصميم» لا «بوست-8 وبوست-9 وبوست-10».
 *
 * خالص بلا قاعدة بيانات — بينفحص بالاختبارات.
 */
import type { Company, Employee, Task } from "@/types";
import { CONTENT_TYPE_LABELS, type ContentType } from "@/lib/constants";
import { makeLatePredicate } from "@/lib/late";

export type NameOf = (t: Task) => string;

/** كلمة النوع: بوست/ريل/ستوري للقطع، والمرحلة للكروت بلا نوع (تصميم/تصوير/…). */
export function kindWordOf(t: Task): string {
  if (t.type) return CONTENT_TYPE_LABELS[t.type as ContentType] ?? t.type;
  // الكرت اليدوي بلا نوع بيقول نوعه بعنوانه: «تصميم بوست-1 · Phoenitech» بوست،
  // و«ستوري-9-1 · وصل» ستوري. وكرت المتابعة عند الناشر (Outreach) «متابعة».
  const title = t.title ?? "";
  if (/ستوري/.test(title)) return "ستوري";
  if (/ريل/.test(title)) return "ريل";
  if (/بوست/.test(title)) return "بوست";
  if (t.kind === "ADHOC" && t.stage === "PUBLISH") return "متابعة";
  switch (t.stage) {
    case "DESIGN":
      return "تصميم";
    case "SHOOT":
      return "تصوير";
    case "EDIT":
      return "مونتاج";
    case "WRITE":
      return "كتابة";
    case "PUBLISH":
      return "نشر";
    default:
      return "مهمة";
  }
}

/** عنوان الكرت بلا ذيل الشركة والدورة: «كتابة بوستات وستوريز — مانغو · دورة…» ← «كتابة بوستات وستوريز». */
export function shortTitle(t: Task): string {
  return (t.title?.trim() ?? "").split(" · ")[0].split(" — ")[0].trim();
}

/**
 * «التوظيف 3 بوست و1 تصميم · التدريب 2 تصميم» — الشركة ثم العدد بالنوع.
 * الكرت بلا شركة (متابعة حلا) بيطلع بعنوانه. الأكثر شغلاً أولاً، وسقف
 * `max` شركات والباقي «وغيرها» حتى ما يصير السطر جداراً.
 */
export function countByCompany(list: Task[], coName: NameOf, max = 4): string {
  const byLabel = new Map<string, Map<string, number>>();
  for (const t of list) {
    const label = t.companyId ? coName(t) : shortTitle(t);
    if (!label || label === "—") continue;
    const kinds = byLabel.get(label) ?? new Map<string, number>();
    const kind = t.companyId ? kindWordOf(t) : "";
    // كرت قطعة من الخطة (CONTENT/PUBLISH) = قطعة وحدة: كاروسيل ٧ شرائح بوست واحد («10-1-1…7»
    // = بوست 10-1، القائدة ١٣/١٠) — `quantity` على كرت التصميم عدد الشرائح لحمل المصمّم. الكرت
    // الإضافي (ADHOC) كميته عدد حقيقي («٦ ستوريات») فبتنعدّ متل ما هي.
    const pieces = t.kind === "ADHOC" ? Math.max(1, t.quantity ?? 1) : 1;
    kinds.set(kind, (kinds.get(kind) ?? 0) + pieces);
    byLabel.set(label, kinds);
  }
  const total = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);
  const ordered = [...byLabel.entries()].sort((a, b) => total(b[1]) - total(a[1]));
  const parts = ordered.slice(0, max).map(([label, kinds]) => {
    const inner = [...kinds.entries()]
      .filter(([k]) => k)
      .map(([k, n]) => `${n} ${k}`)
      .join(" و");
    return inner ? `${label} ${inner}` : label;
  });
  if (ordered.length > max) parts.push("وغيرها");
  return parts.join(" · ");
}

/** النشر: «وصل (بوست، ستوري) · التوظيف (بوست)» — الشركة ونوع المحتوى فقط. */
export function typesByCompany(list: Task[], coName: NameOf): string {
  const byCo = new Map<string, Set<string>>();
  for (const t of list) {
    const name = coName(t);
    if (!name || name === "—") continue;
    const set = byCo.get(name) ?? new Set<string>();
    set.add(kindWordOf(t));
    byCo.set(name, set);
  }
  return [...byCo.entries()].map(([co, kinds]) => `${co} (${[...kinds].join("، ")})`).join(" · ");
}

/**
 * الكروت المفتوحة المتأخرة يلي فعلاً علينا: بلا الشركات الموقوفة/المؤرشفة،
 * وبلا المعفاة (تأخير الزبون)، وبلا المحجوز وراء مرحلة سابقة.
 */
export function openLateTasks(tasks: Task[], companies: Company[], today: Date): Task[] {
  // التعريف نفسه يلي بتقراه كل الشاشات (`lib/late.ts`).
  return tasks.filter(makeLatePredicate(tasks, companies, today));
}

/** «35 — البلسم 8 · التوظيف 7 · …» — عدد المتأخر بالشركة، الأكثر أولاً. */
export function lateByCompanyLine(late: Task[], coName: NameOf): string {
  const byCo = new Map<string, number>();
  for (const t of late) {
    const name = t.companyId ? coName(t) : "بلا شركة";
    byCo.set(name, (byCo.get(name) ?? 0) + 1);
  }
  const parts = [...byCo.entries()].sort((a, b) => b[1] - a[1]).map(([co, n]) => `${co} ${n}`);
  return `${late.length}${parts.length ? ` — ${parts.join(" · ")}` : ""}`;
}

/** فريق الإنتاج الأساسي: لا سيلز ولا فريلانس بلا شغل — نفس قاعدة القوائم (١/٩). */
export function isCoreTeamMember(e: Employee): boolean {
  if (/sales|سيلز|مبيعات/i.test(e.role)) return false;
  if (!e.isScheduled && (e.salary ?? 0) === 0) return false;
  return true;
}
