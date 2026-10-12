/**
 * الفحص العميق — `retimeEditsAfterActualShoot`: متى بيتحرّك مونتاج **منجز**؟
 *
 * توصيف دقيق للسلوك الحالي (characterization) حتى يصير التناقض المسجَّل
 * بـ`CLAUDE_HANDOFF.md` (١١/١٠: عبادة ريل ١ منجز ومثبّت تحرّك ٢٧/٩ → ١٧/٩)
 * قابلاً للقياس. الحالات مأخوذة من مرآة الإنتاج ١٢:٤٩:
 *   • عبادة REEL#1 (دلو 2026/7): يوم النشر على كرت المونتاج ٢٢/٩ (قديم) بينما كرت
 *     النشر ٢٨/٩ — القاعدة بتقارن بيوم النشر **على كرت المونتاج نفسه** فبتشوف
 *     «مونتاج بعد النشر» وبتسحبه ليوم ما بعد التصوير.
 *   • Phoenitech REEL#3 (2026/8): مونتاج منجز مثبّت ٣٠/٩ وتصويره «أُنهي» ١/١٠
 *     (كرت التصوير انسكّر بملف مونتاج) → بينسحب لـ٤/١٠.
 *   • التوظيف REEL#3 (2026/8): مونتاج منجز مثبّت ٢٠/٩، تصويره أُنهي ٦/١٠، نُشر
 *     ٢٢/٩ → بينسحب ليوم النشر ٢٢/٩.
 *
 * الشرط المستخلَص: كرت مونتاج (منجز أو مثبّت) بيتحرّك إذا وبس إذا
 *   workDate < يوم(تصوير.finishedAt)  أو  (قطعته منشورة و workDate > publishDate تبع كرت المونتاج نفسه)
 * وبيروح لأول يوم دوام للمونتيرة بعد يوم التصوير الفعلي، مقصوصاً على يوم النشر
 * لو القطعة انتشرت. (لو تغيّر هالسلوك بقصد — حارس مقترح بالتقرير — عدّل هالملف.)
 *
 * معرّفات التقرير (`docs/qa/deep-test-2026-10-11/regen-engine.md`):
 *   • RG-03 (علّة): المرساة «بعد النشر» مقروءة من كرت المونتاج نفسه — حالة عبادة.
 *   • RG-06 (تحذير — قرار قائدة): أي ختم `finishedAt` على التصوير بينقرا يوم
 *     تصوير فعلي، ولو كان ختم إقفال متأخّر أو ختم تتابع — حالتا فونيتيك والتوظيف.
 */
import { describe, it, expect } from "vitest";
import { retimeEditsAfterActualShoot } from "@/lib/schedule-retime";
import type { PipelineTask } from "@/lib/pipeline";

const WEEK = [0, 1, 2, 3, 4]; // الأحد → الخميس
const at = (iso: string) => new Date(`${iso}T09:00:00`);

const card = (over: Partial<PipelineTask>): PipelineTask => ({
  id: over.id ?? `${over.stage}`,
  kind: over.stage === "PUBLISH" ? "PUBLISH" : "CONTENT",
  stage: "SHOOT",
  board: "TODO",
  type: "REEL",
  title: null,
  companyId: "c",
  assigneeId: "e",
  publishDate: null,
  readyDate: null,
  workDate: null,
  week: null,
  blockedById: null,
  pipelineKey: "c|REEL|k|1",
  quantity: 1,
  priority: "NORMAL",
  status: "NOT_STARTED",
  month: 8,
  year: 2026,
  ...over,
});

type Piece = {
  shootFinishedAt: string;
  editWork: string;
  editPublishDate: string;
  editPinned: boolean;
  publishBoard: "DONE" | "TODO";
  publishDate: string;
};

function run(p: Piece) {
  const shoot = card({
    stage: "SHOOT",
    board: "DONE",
    status: "READY",
    finishedAt: at(p.shootFinishedAt),
    workDate: p.shootFinishedAt,
    readyDate: p.shootFinishedAt,
    publishDate: p.editPublishDate,
  });
  const edit = card({
    stage: "EDIT",
    board: "DONE",
    status: "READY",
    isPinned: p.editPinned,
    workDate: p.editWork,
    readyDate: p.editWork,
    publishDate: p.editPublishDate,
    finishedAt: at(p.editWork),
  });
  const publish = card({
    stage: "PUBLISH",
    board: p.publishBoard,
    status: p.publishBoard === "DONE" ? "PUBLISHED" : "NOT_STARTED",
    publishDate: p.publishDate,
    readyDate: p.publishDate,
    workDate: p.publishDate,
  });
  retimeEditsAfterActualShoot([shoot, edit, publish], WEEK);
  return edit;
}

describe("retimeEditsAfterActualShoot — توصيف تحريك المونتاج المنجز", () => {
  it("عبادة ريل ١ — السلوك الحالي (RG-03): منجز ومثبّت ومتّسق مع يوم النشر الحقيقي (٢٨/٩)، بس يوم النشر على كرته قديم (٢٢/٩) → بينسحب لـ١٧/٩", () => {
    const edit = run({
      shootFinishedAt: "2026-09-16",
      editWork: "2026-09-27",
      editPublishDate: "2026-09-22",
      editPinned: true,
      publishBoard: "DONE",
      publishDate: "2026-09-28",
    });
    expect(edit.workDate).toBe("2026-09-17");
    expect(edit.readyDate).toBe("2026-09-17");
    expect(edit.board).toBe("DONE");
  });

  it.fails("[RG-03] …والصحيح: المرساة يوم نشر **القطعة** (كرت النشر ٢٨/٩)، فالمونتاج المنجز المثبّت ٢٧/٩ بيضل مكانه", () => {
    const edit = run({
      shootFinishedAt: "2026-09-16",
      editWork: "2026-09-27",
      editPublishDate: "2026-09-22",
      editPinned: true,
      publishBoard: "DONE",
      publishDate: "2026-09-28",
    });
    expect(edit.workDate).toBe("2026-09-27");
  });

  it("…ونفس الكرت ما بيتحرّك لو يوم النشر على كرته = يوم كرت النشر (٢٨/٩): المحرّك بيقرأ المرساة من كرت المونتاج لا من كرت النشر", () => {
    const edit = run({
      shootFinishedAt: "2026-09-16",
      editWork: "2026-09-27",
      editPublishDate: "2026-09-28",
      editPinned: true,
      publishBoard: "DONE",
      publishDate: "2026-09-28",
    });
    expect(edit.workDate).toBe("2026-09-27");
  });

  it("RG-06 · فونيتيك ريل ٣: مونتاج منجز مثبّت ٣٠/٩ وتصويره «أُنهي» ١/١٠ وقطعته ما نُشرت → بينسحب لأول دوام بعد التصوير (الأحد ٤/١٠)", () => {
    const edit = run({
      shootFinishedAt: "2026-10-01",
      editWork: "2026-09-30",
      editPublishDate: "2026-10-13",
      editPinned: true,
      publishBoard: "TODO",
      publishDate: "2026-10-13",
    });
    expect(edit.workDate).toBe("2026-10-04");
  });

  it("RG-06 · التوظيف ريل ٣: مونتاج منجز مثبّت ٢٠/٩، تصويره أُنهي ٦/١٠، نُشر ٢٢/٩ → بينقصّ على يوم النشر ٢٢/٩", () => {
    const edit = run({
      shootFinishedAt: "2026-10-06",
      editWork: "2026-09-20",
      editPublishDate: "2026-09-22",
      editPinned: true,
      publishBoard: "DONE",
      publishDate: "2026-09-22",
    });
    expect(edit.workDate).toBe("2026-09-22");
  });

  it("الحالة المتّسقة (تصوير ١٥/٩ → مونتاج ١٧/٩ → نشر ٢٠/٩) ما بتتحرّك، مثبّتة أو لا", () => {
    for (const pinned of [true, false]) {
      const edit = run({
        shootFinishedAt: "2026-09-15",
        editWork: "2026-09-17",
        editPublishDate: "2026-09-20",
        editPinned: pinned,
        publishBoard: "DONE",
        publishDate: "2026-09-20",
      });
      expect(edit.workDate, `pinned=${pinned}`).toBe("2026-09-17");
    }
  });

  it("نمط حزيران (مونتاج منجز غير مثبّت يومه = يوم النشر، وختم التصوير بعده): بينحسب كأنه تحرّك بس بيرجع لنفس اليوم (القصّ على يوم النشر)", () => {
    const edit = run({
      shootFinishedAt: "2026-07-22",
      editWork: "2026-07-13",
      editPublishDate: "2026-07-13",
      editPinned: false,
      publishBoard: "DONE",
      publishDate: "2026-07-13",
    });
    expect(edit.workDate).toBe("2026-07-13");
  });

  it("مونتاج مفتوح غير مثبّت بعد تصوير فعلي بينتأرّخ لليوم التالي للتصوير (الغاية الأصلية للقاعدة)", () => {
    const shoot = card({ stage: "SHOOT", board: "DONE", status: "READY", finishedAt: at("2026-09-16"), workDate: "2026-09-16" });
    const edit = card({ stage: "EDIT", board: "TODO", workDate: "2026-09-10", readyDate: "2026-09-10", publishDate: "2026-09-25" });
    const publish = card({ stage: "PUBLISH", board: "TODO", publishDate: "2026-09-25", readyDate: "2026-09-25", workDate: "2026-09-24" });
    retimeEditsAfterActualShoot([shoot, edit, publish], WEEK);
    expect(edit.workDate).toBe("2026-09-17");
    expect(edit.board).toBe("TODO");
  });

  it("مونتاج منجز وتصويره مفتوح وقطعته ما نُشرت → بينفتح وبتنمسح أختامه (قاعدة «ما في منجز وحاجزه مفتوح»)", () => {
    const shoot = card({ stage: "SHOOT", board: "TODO", workDate: "2026-09-16" });
    const edit = card({ stage: "EDIT", board: "DONE", status: "READY", workDate: "2026-09-17", finishedAt: at("2026-09-17"), startedAt: at("2026-09-17"), completedAt: at("2026-09-17"), notes: "سُلّم" });
    const publish = card({ stage: "PUBLISH", board: "TODO", publishDate: "2026-09-25" });
    retimeEditsAfterActualShoot([shoot, edit, publish], WEEK);
    expect([edit.board, edit.status]).toEqual(["TODO", "NOT_STARTED"]);
    expect(edit.startedAt ?? edit.finishedAt ?? edit.completedAt).toBeNull();
    // الملاحظات (دليل التسليم) بتضل على الكرت رغم فتحه — بس الأختام راحت
    expect(edit.notes).toBe("سُلّم");
  });
});
