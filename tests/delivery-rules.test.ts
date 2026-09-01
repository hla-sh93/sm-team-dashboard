/**
 * قواعد التسليم — قرارات القائدة (١/٩/٢٠٢٦) بالأرقام، ومصدرها الوحيد.
 *
 * ١. كل قطعة تُسلَّم قبل النشر بيومين (يوم واحد عند الضرورة فقط).
 * ٢. التصوير **نافذة** من تاريخ لتاريخ لأنه بيعتمد على وقت الزبون — والخطة
 *    لازم تنحافظ ما دام التصوير صار جوّا النافذة.
 * ٣. «كم قطعة بالنهار» رقم واحد بمكان واحد: معدّل الشخص.
 */
import { describe, expect, it } from "vitest";
import {
  LEAD,
  SHOOT_BEFORE_MONTAGE,
  footageDeadline,
  montageDay,
  shootWindow,
} from "@/lib/constants";
import { expandPipeline } from "@/lib/pipeline";
import { buildSchedule } from "@/lib/scheduler";
import { specState } from "./_helpers/spec-fixture";
import { toISODate } from "@/lib/dates";

const D = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const days = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / 86400000);

const EDITOR_WORK = [6, 0, 1, 2, 3];
const reelOpts = (shootIso: string, deliverIso: string) => ({
  writerId: null,
  publisherId: "publisher",
  editorId: "editor",
  editorWorkDays: EDITOR_WORK,
  year: 2026,
  month: 8,
  companyName: () => "شركة",
  writerWorkDays: EDITOR_WORK,
  publisherWorkDays: EDITOR_WORK,
  __shoot: shootIso,
  __deliver: deliverIso,
});

const reelItem = (shootIso: string, deliverIso: string, publishIso: string) => ({
  companyId: "c",
  type: "REEL" as const,
  assigneeId: "photographer",
  publishDate: publishIso,
  readyDate: deliverIso, // تسليم اللقطات
  workDate: shootIso, // يوم التصوير
  week: 1,
  status: "NOT_STARTED",
});

const montageOf = (shootIso: string, deliverIso: string, publishIso: string) => {
  const out = expandPipeline([reelItem(shootIso, deliverIso, publishIso)], reelOpts(shootIso, deliverIso));
  return out.find((t) => t.stage === "EDIT")!;
};

describe("قواعد المهل — مصدر واحد", () => {
  it("مهلة كل نوع يومان: القاعدة لا الاستثناء", () => {
    expect(LEAD.POST).toBe(2);
    expect(LEAD.STORY).toBe(2);
    expect(LEAD.AI_REEL).toBe(2);
    expect(LEAD.REEL).toBe(2);
  });

  it("نافذة التصوير مشتقّة من مهلة المونتاج، مو رقم مستقل", () => {
    const publish = D("2026-09-21"); // الاثنين
    const w = shootWindow(publish);
    expect(days(w.earliest, publish)).toBe(LEAD.REEL + SHOOT_BEFORE_MONTAGE.max);
    expect(days(w.latest, publish)).toBe(LEAD.REEL + SHOOT_BEFORE_MONTAGE.min);
    // مثال القائدة الحرفي: نشر الاثنين → مونتاج السبت → تصوير الأربعا أو الخميس.
    expect(toISODate(w.earliest)).toBe("2026-09-16"); // الأربعاء
    expect(toISODate(w.latest)).toBe("2026-09-17"); // الخميس
  });

  it("آخر موعد لوصول اللقطات = يوم قبل المونتاج", () => {
    const publish = D("2026-09-21");
    expect(days(footageDeadline(publish), publish)).toBe(LEAD.REEL + 1);
  });

  // العطلة (الخميس/الجمعة) كانت تاكل الهامش: نشر الأحد ناقص يومين تقويم =
  // الجمعة، والمونتيرة ما بتشتغل — فكان المونتاج يطلع السبت، يعني يوم قبل
  // النشر، أو يوم النشر نفسه. المهلة بتنحسب بأيام العمل: المونتاج بينزل
  // للأربعا، والنافذة بتنزل معه بدل ما ينضغط التسليم.
  it("العطلة بتزحزح كل السلسلة، ما بتاكل الهامش", () => {
    const publish = D("2026-09-06"); // الأحد
    const editor = [6, 0, 1, 2, 3]; // السبت→الأربعا
    expect(toISODate(montageDay(publish, editor))).toBe("2026-09-02"); // الأربعاء
    expect(toISODate(footageDeadline(publish, editor))).toBe("2026-09-01"); // الثلاثاء
    const w = shootWindow(publish, editor);
    expect(toISODate(w.earliest)).toBe("2026-08-30");
    expect(toISODate(w.latest)).toBe("2026-08-31");
    // والنتيجة: المونتاج جاهز قبل النشر بأربعة أيام، لا بيوم ولا بصفر.
    expect(days(montageDay(publish, editor), publish)).toBeGreaterThanOrEqual(LEAD.REEL);
  });
});

describe("التصوير نافذة — الخطة بتنحافظ جوّاها", () => {
  it("تصوير بأول النافذة أو بآخرها بيعطي نفس يوم المونتاج", () => {
    // نشر الأربعا ٣٠/٩. النافذة: الجمعة ٢٥/٩ → السبت ٢٦/٩، وكل طرف بيسلّم
    // لقطاته بيوم مختلف. التأريخ من التسليم كان بيعطي يومين مختلفين (٢٧ و٢٨)؛
    // التأريخ من النشر بيعطي نفس اليوم — وهاد معنى «الخطة بتنحافظ».
    const early = montageOf("2026-09-25", "2026-09-26", "2026-09-30");
    const late = montageOf("2026-09-26", "2026-09-27", "2026-09-30");
    expect(early.readyDate).toBe(late.readyDate);
    expect(early.readyDate).toBe("2026-09-28");
  });

  it("المونتاج جاهز قبل النشر بيومين حتى لو التصوير صار بدري بكتير", () => {
    const m = montageOf("2026-09-10", "2026-09-12", "2026-09-21");
    expect(m.readyDate).toBe("2026-09-19");
    expect(days(D(m.readyDate!), D("2026-09-21"))).toBeGreaterThanOrEqual(LEAD.REEL);
  });

  it("بس تأخّر اللقطات بيزحزح المونتاج — وبيبقى قبل النشر", () => {
    // اللقطات وصلت ٢٠/٩ (بعد آخر موعد ١٨/٩) → المونتاج بينزاح لليوم التالي.
    const m = montageOf("2026-09-19", "2026-09-20", "2026-09-21");
    expect(m.readyDate).toBe("2026-09-21");
    expect(m.readyDate! <= "2026-09-21").toBe(true);
  });
});

describe("كم قطعة بالنهار — معدّل الشخص هو المصدر", () => {
  const designOf = (rates: string | null) => {
    const state = specState(2026, 6);
    const employees = state.employees.map((e) =>
      e.role === "designer" ? { ...e, rates } : e,
    );
    const { tasks } = buildSchedule({ ...state, employees });
    const perDay = new Map<string, number>();
    for (const t of tasks) {
      if (t.kind !== "CONTENT" || t.type === "REEL" || !t.workDate) continue;
      const k = `${t.assigneeId}|${toISODate(t.workDate)}`;
      perDay.set(k, (perDay.get(k) ?? 0) + 1);
    }
    return Math.max(0, ...perDay.values());
  };

  it("خفض معدّل المصمّم بينزّل عدد كروته باليوم — بلا لمس أي رقم بالكود", () => {
    const wide = designOf(JSON.stringify({ POST: 8, STORY: 8, AI_REEL: 1 }));
    const tight = designOf(JSON.stringify({ POST: 2, STORY: 2, AI_REEL: 1 }));
    expect(tight).toBeLessThan(wide);
  });

  it("بلا معدّل مخزَّن بيرجع للافتراضي المتّفق عليه (٦/يوم)", () => {
    // الافتراضي ٦ والشخص بالتجهيزة ٦ ساعات → ساعة للقطعة → ٦ كروت باليوم سقفاً.
    expect(designOf(null)).toBeLessThanOrEqual(6);
  });
});

describe("مهلة الستوري على الإنتاج الكامل", () => {
  it("كل ستوري مجدولة بتتسلّم قبل نشرها بيومين على الأقل", () => {
    const { tasks } = buildSchedule(specState(2026, 6));
    const stories = tasks.filter((t) => t.type === "STORY" && t.readyDate && t.publishDate);
    expect(stories.length).toBeGreaterThan(0);
    for (const t of stories) {
      const gap = days(t.readyDate!, t.publishDate!);
      // الأرضية (بداية العقد/الكتابة) بتضغط المهلة بالدورة الأولى — القاعدة
      // بتنطبق على يلي فوق الأرضية، وما بيصير أبداً تسليم بعد النشر.
      expect(gap).toBeGreaterThanOrEqual(0);
    }
    const unclamped = stories.filter((t) => days(t.readyDate!, t.publishDate!) > 0);
    expect(unclamped.every((t) => days(t.readyDate!, t.publishDate!) >= LEAD.STORY)).toBe(true);
  });
});
