/**
 * سبب الانزياح بالتقرير — قرار القائدة (١/٩): وقت التصوير بيعتمد على الزبون،
 * فإمّا الخطة تنحافظ أو يكون سبب الانزياح واضح.
 */
import { describe, expect, it } from "vitest";
import { scheduleShiftNotes, type ShiftTask } from "@/lib/shift-reason";

const D = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

// نشر الأربعا ٣٠/٩ → نافذة التصوير ٢٥–٢٦/٩ · آخر موعد للقطات ٢٧/٩ · مونتاج ٢٨/٩.
const piece = (o: {
  shootOn: string;
  footageOn: string;
  editOn: string;
  publish?: string;
  key?: string;
}): ShiftTask[] => {
  const publish = o.publish ?? "2026-09-30";
  const key = o.key ?? "c|REEL|1";
  return [
    {
      stage: "SHOOT", type: "REEL", pipelineKey: key, companyId: "c", pieceNo: 1,
      workDate: D(o.shootOn), readyDate: D(o.footageOn), publishDate: D(publish),
    },
    {
      stage: "EDIT", type: "REEL", pipelineKey: key, companyId: "c", pieceNo: 1,
      workDate: D(o.editOn), readyDate: D(o.editOn), publishDate: D(publish),
    },
    {
      stage: "PUBLISH", type: "REEL", pipelineKey: key, companyId: "c", pieceNo: 1,
      workDate: D(publish), readyDate: D(publish), publishDate: D(publish),
    },
  ];
};

describe("سبب انزياح الخطة", () => {
  it("تصوير جوّا نافذته ما بيولّد أي ملاحظة — الخطة محفوظة", () => {
    expect(scheduleShiftNotes(piece({ shootOn: "2026-09-25", footageOn: "2026-09-26", editOn: "2026-09-28" }))).toEqual([]);
    expect(scheduleShiftNotes(piece({ shootOn: "2026-09-26", footageOn: "2026-09-27", editOn: "2026-09-28" }))).toEqual([]);
  });

  it("تصوير بعد نافذته بيشرح نفسه بالتقرير", () => {
    const notes = scheduleShiftNotes(
      piece({ shootOn: "2026-09-28", footageOn: "2026-09-29", editOn: "2026-09-29" }),
    );
    expect(notes).toHaveLength(1);
    expect(notes[0].cause).toBe("SHOOT_LATE");
    expect(notes[0].text).toContain("28/9");
    expect(notes[0].text).toContain("25/9–26/9");
    expect(notes[0].text).toContain("المونتاج انزاح");
  });

  it("تصوير تأخّر بس المونتاج ضل على خطته — الملاحظة بتقول هيك", () => {
    const notes = scheduleShiftNotes(
      piece({ shootOn: "2026-09-27", footageOn: "2026-09-27", editOn: "2026-09-28" }),
    );
    expect(notes).toHaveLength(1);
    expect(notes[0].text).toContain("ضل على خطته");
  });

  it("لقطات متأخرة عن آخر موعد بتنذكر حتى لو التصوير كان بوقته", () => {
    const notes = scheduleShiftNotes(
      piece({ shootOn: "2026-09-25", footageOn: "2026-09-29", editOn: "2026-09-30" }),
    );
    expect(notes).toHaveLength(1);
    expect(notes[0].cause).toBe("FOOTAGE_LATE");
    expect(notes[0].text).toContain("آخر موعد 27/9");
  });

  it("قطعة بلا تاريخ نشر أو بلا تصوير ما بتنهار ولا بتظهر", () => {
    expect(
      scheduleShiftNotes([
        { stage: "PUBLISH", type: "REEL", pipelineKey: "x", companyId: "c", pieceNo: 2, workDate: null, readyDate: null, publishDate: null },
      ]),
    ).toEqual([]);
  });

  it("البوستات ما بتدخل — الانزياح المشروح للريلات", () => {
    expect(
      scheduleShiftNotes([
        { stage: "DESIGN", type: "POST", pipelineKey: "p", companyId: "c", pieceNo: 1, workDate: D("2026-09-29"), readyDate: D("2026-09-29"), publishDate: D("2026-09-30") },
      ]),
    ).toEqual([]);
  });
});
