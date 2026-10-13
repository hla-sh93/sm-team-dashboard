/**
 * «تسليم الشغل» بالمحرّك — مين استلم شغل مين (قرار القائدة ١٢/١٠، D4).
 *
 * الأداة بتنقل الكروت وحقول المسؤولين بالشركات، بس المحرّك بيختار الكاتبة والمونتيرة
 * والناشر **بالدور** (أول موظف دوره بيطابق)، والمصوّر الاحتياطي أول مصوّر — فإعادة
 * الجدولة كانت ترجّع كروتاً للي غادر (مراجعة ١٢/١٠: ٤ من ١٥ مونتاج رجعوا لأليسار).
 * الحلّ بلا حقل جديد: التسليم بينحفظ بـ`Setting` (`employeeHandover:<المغادر>`)، والمحرّك
 * بيبدّل كل مسؤول مولَّد بخلفه. المنجز بيضل باسم يلي عمله (حفظ الحالة).
 *
 * بلا `"use server"` عن قصد: بيناديه المحرّك وأفعال الأدمن، مو المتصفّح.
 */
import { prisma } from "@/lib/db";

const PREFIX = "employeeHandover:";

export async function recordHandover(fromId: string, toId: string, fromDate: string): Promise<void> {
  const key = `${PREFIX}${fromId}`;
  const value = JSON.stringify({ toId, fromDate });
  await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

/** المغادر ← خلفه، من كل التسليمات المسجّلة. */
export async function loadSuccessors(): Promise<Map<string, string>> {
  const rows = await prisma.setting.findMany({ where: { key: { startsWith: PREFIX } } });
  const out = new Map<string, string>();
  for (const row of rows) {
    try {
      const v = JSON.parse(row.value) as { toId?: unknown };
      if (typeof v.toId === "string" && v.toId) out.set(row.key.slice(PREFIX.length), v.toId);
    } catch {
      /* صفّ تالف = ما في تسليم */
    }
  }
  return out;
}

/** خلف الموظف الأخير بالسلسلة (ماجد ← ليلاس ← …)، بحارس للحلقات. */
export function successorOf(successors: Map<string, string>, id: string | null): string | null {
  let cur = id;
  const seen = new Set<string>();
  while (cur && successors.has(cur) && !seen.has(cur)) {
    seen.add(cur);
    cur = successors.get(cur)!;
  }
  return cur;
}
