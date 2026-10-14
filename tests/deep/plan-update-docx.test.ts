/**
 * فحص عميق ١٢/١٠/٢٠٢٦ — استيراد خطة Word: القارئ (بلا قاعدة) ثم الرفع على قاعدة معزولة.
 *
 * حالة فونيتيك: عنوان «جدول الستوريز (15)» و١٤ صفاً؛ ترويسات إنجليزية؛ أرقام هندية؛
 * خانات فاضية؛ رقم مكرّر؛ ثم: إعادة الرفع بتمحي ملاحظات كرت الكتابة (PU-14)،
 * والدلو من ساعة الجهاز: رفع خطة الدورة الجاية قبل بدايتها بينزل على الدورة الحالية (PU-16).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Packer } from "docx";

const scratch = await vi.hoisted(async () => {
  const { copyFileSync, existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const source = resolve(process.cwd(), "prisma", "dev.db");
  const target = resolve(process.cwd(), "prisma", `test-deep-pu-docx-${process.pid}.db`);
  const available = existsSync(source);
  if (available) copyFileSync(source, target);
  return { target, available };
});

vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("@/lib/auth", () => ({ assertAdmin: async () => {}, requireAdminPage: async () => {}, isAuthenticated: async () => true }));
vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const { assertIsolatedTestDatabaseUrl } = await import("../_helpers/test-database");
  const url = assertIsolatedTestDatabaseUrl(`file:${scratch.target}`);
  return { prisma: new PrismaClient({ datasources: { db: { url } } }) };
});

type Section = { heading: string | null; headers: string[]; body: string[][] };

async function docxBase64(sections: Section[]): Promise<string> {
  const { AlignmentType, Document, Paragraph, Table, TableCell, TableRow, TextRun } = await import("docx");
  const cell = (text: string) => new TableCell({ children: [new Paragraph({ bidirectional: true, alignment: AlignmentType.RIGHT, children: [new TextRun({ text, rightToLeft: true })] })] });
  const children = sections.flatMap((s) => [
    ...(s.heading ? [new Paragraph({ bidirectional: true, children: [new TextRun({ text: s.heading, rightToLeft: true })] })] : []),
    new Table({ rows: [s.headers, ...s.body].map((r) => new TableRow({ children: r.map(cell) })) }),
  ]);
  const doc = new Document({ sections: [{ children }] });
  return (await Packer.toBuffer(doc)).toString("base64");
}
async function parseDocx(b64: string) {
  const JSZip = (await import("jszip")).default;
  const { extractDocxBlocks, parsePlanDocument } = await import("@/lib/plan-docx");
  const zip = await JSZip.loadAsync(Buffer.from(b64, "base64"));
  const xml = await zip.file("word/document.xml")!.async("string");
  return parsePlanDocument(extractDocxBlocks(xml));
}
const AR = ["رقم", "الهوك", "السكريبت", "الكابشن", "الهاشتاغات", "ملاحظة"];
const rows = (n: number, label: string, from = 1) => Array.from({ length: n }, (_, i) => [String(from + i), `هوك ${label} ${from + i}`, `نص ${label} ${from + i}`, `كابشن ${label} ${from + i}`, "", ""]);

describe("قارئ القالب (بلا قاعدة)", () => {
  it("فونيتيك: «جدول الستوريز (15)» و١٤ صفاً → ١٤ ستوري و١٠ بوستات بلا تحذير — الرقم بالعنوان مو عدّاً", async () => {
    const r = await parseDocx(await docxBase64([
      { heading: "جدول البوستات", headers: AR, body: rows(10, "بوست") },
      { heading: "جدول الستوريز (15)", headers: AR, body: rows(14, "ستوري") },
    ]));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.pieces.filter((p) => p.type === "STORY").length).toBe(14);
    expect(r.pieces.filter((p) => p.type === "POST").length).toBe(10);
    expect(r.warnings).toEqual([]);
    expect(r.pieces.find((p) => p.type === "STORY" && p.pieceNo === 14)?.brief).toContain("نص ستوري 14");
  });
  it("ترويسات إنجليزية («No»): ما في عمود «رقم» → الملف مرفوض برسالة واضحة (PU-17، توثيق: القالب عربي فقط)", async () => {
    const r = await parseDocx(await docxBase64([{ heading: "جدول البوستات", headers: ["No", "Hook", "Script", "Caption", "Hashtags", "Note"], body: rows(2, "p") }]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("رقم");
  });
  it("رقم بالأرقام الهندية «٣» → «ما في رقم للقطعة» والملف كله مرفوض (PU-17)", async () => {
    const body = rows(3, "بوست");
    body[2][0] = "٣";
    const r = await parseDocx(await docxBase64([{ heading: "جدول البوستات", headers: AR, body }]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("ما في رقم");
  });
  it("صف برقم وبلا محتوى بينتخطّى (قطعة لسا ما انكتبت) — القالب بيطلع معبّى بالأرقام (القائدة ١٤/١٠)", async () => {
    const body = rows(3, "بوست");
    body[1] = ["2", "", "", "", "", ""];
    const r = await parseDocx(await docxBase64([{ heading: "جدول البوستات", headers: AR, body }]));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.pieces.map((p) => p.pieceNo)).toEqual([1, 3]);
    expect(r.warnings.join(" ")).toContain("فجوة");
  });
  it("رقم مكرّر → مرفوض؛ وجدول بلا «النوع» وبلا عنوان → مرفوض؛ وفجوة بالترقيم تحذير لا رفض", async () => {
    const dup = rows(3, "بوست");
    dup[2][0] = "2";
    const r1 = await parseDocx(await docxBase64([{ heading: "جدول البوستات", headers: AR, body: dup }]));
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.error).toContain("مكرّر");
    const r2 = await parseDocx(await docxBase64([{ heading: null, headers: AR, body: rows(2, "بوست") }]));
    expect(r2.ok).toBe(false);
    const r3 = await parseDocx(await docxBase64([{ heading: "جدول الريلات", headers: AR, body: [...rows(1, "ريل"), ...rows(1, "ريل", 3)] }]));
    expect(r3.ok).toBe(true);
    if (r3.ok) expect(r3.warnings.join(" ")).toContain("فجوة");
  });
  it("«النوع» بعمود بيغلب عنوان الجدول، وAI reel بتنقرا AI_REEL", async () => {
    const r = await parseDocx(await docxBase64([{ heading: "جدول البوستات", headers: ["رقم", "النوع", ...AR.slice(1)], body: [["1", "Reel AI", "هوك", "نص", "", "", ""], ["2", "ستوري", "هوك", "نص", "", "", ""]] }]));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.pieces.map((p) => p.type)).toEqual(["AI_REEL", "STORY"]);
  });
});

// ------------------------------------------------------------------ DB-backed
let prisma: any;
let preview: (companyId: string, file: string, target?: { year: number; month: number }) => Promise<any>;
let applyDocx: (input: { companyId: string; fileBase64: string; fileName: string; source: string; at?: Date; target?: { year: number; month: number } }) => Promise<any>;
const uniq = `فحص-عميق-وورد-${process.pid}`;
let companyId = "";
let writerId = "";
const skip = () => !scratch.available;
const P = `ddx${process.pid}`;

beforeAll(async () => {
  if (skip()) return;
  prisma = (await import("@/lib/db")).prisma;
  ({ previewPlanDocx: preview, applyPlanDocx: applyDocx } = await import("@/server/plan-docx-import"));
  writerId = (await prisma.employee.create({ data: { name: `${uniq} كاتبة`, role: "writer", workDays: "[0,1,2,3,4]", rates: '{"PLAN":0.5}' } })).id;
  // دورة ١٣/٩ → ١٢/١٠ (m=8) وتجديد مبكر ١٣/١٠ (m=9) — نفس فونيتيك.
  companyId = (
    await prisma.company.create({
      data: { name: `${uniq} شركة`, managed: true, posts: 2, reels: 0, stories: 0, publishStartDate: new Date(2026, 8, 13), renewals: JSON.stringify(["2026-10-13"]) },
    })
  ).id;
  const mk = (month: number) => [
    { id: `${P}_w_${month}`, kind: "CONTENT_WRITING", stage: "WRITE", pipelineKey: `${companyId}|DESIGN`, title: "كتابة بوستات وستوريز", companyId, assigneeId: writerId, status: "NOT_STARTED", board: "TODO", year: 2026, month, notes: `دليل سابق على كرت الكتابة m=${month}` },
    ...[1, 2].flatMap((n) => [
      { id: `${P}_d_${month}_${n}`, kind: "CONTENT", stage: "DESIGN", type: "POST", pieceNo: n, isAuto: true, companyId, status: "NOT_STARTED", board: "TODO", year: 2026, month },
      { id: `${P}_p_${month}_${n}`, kind: "CONTENT", stage: "PUBLISH", type: "POST", pieceNo: n, isAuto: true, companyId, status: "NOT_STARTED", board: "TODO", year: 2026, month },
    ]),
  ];
  await prisma.task.createMany({ data: [...mk(8), ...mk(9)] });
});

afterAll(async () => {
  vi.useRealTimers();
  if (!prisma) return;
  await prisma.task.deleteMany({ where: { companyId } });
  await prisma.company.deleteMany({ where: { name: { contains: uniq } } });
  await prisma.employee.deleteMany({ where: { name: { contains: uniq } } });
  await prisma.$disconnect();
  const { rmSync } = await import("node:fs");
  for (const s of ["", "-journal", "-wal", "-shm"]) rmSync(`${scratch.target}${s}`, { force: true });
});

describe("الرفع على القاعدة", () => {
  it.skipIf(skip())("PU-16: آخر يوم بالدورة الحالية (١٢/١٠) مع تجديد ١٣/١٠ مسجَّل → المعاينة بتعرض الدورتين وبتنبّه؛ الافتراض الحالية m=8", async () => {
    vi.setSystemTime(new Date(2026, 9, 12, 9, 0));
    const file = await docxBase64([{ heading: "جدول البوستات", headers: AR, body: rows(2, "بوست") }]);
    const p = await preview(companyId, file);
    expect(p.ok, p.error).toBe(true);
    expect(p.month).toBe(8);
    expect(p.targets.map((t: { month: number; current: boolean }) => [t.month, t.current])).toEqual([[8, true], [9, false]]);
    expect(p.warnings.some((w: string) => w.includes("دورة جاية مسجَّلة"))).toBe(true);
    // دلو مو من الدورتين = رفض.
    expect((await preview(companyId, file, { year: 2026, month: 7 })).ok).toBe(false);
    const r = await applyDocx({ companyId, fileBase64: file, fileName: "plan-oct.docx", source: "فحص", at: new Date(2026, 9, 12, 9, 0) });
    expect(r.ok, r.error).toBe(true);
    const oldCycle = await prisma.task.findUnique({ where: { id: `${P}_d_8_1` } });
    const newCycle = await prisma.task.findUnique({ where: { id: `${P}_d_9_1` } });
    expect(oldCycle.brief).toContain("نص بوست 1");
    expect(newCycle.brief).toBeNull();
    vi.setSystemTime(new Date(2026, 9, 13, 9, 0));
    const p2 = await preview(companyId, file);
    expect(p2.month).toBe(9);
  });
  it.skipIf(skip())("PU-16: باختيار الجاية صراحةً (١٢/١٠) الخطة بتنزل على دلو الدورة الجاية m=9", async () => {
    vi.setSystemTime(new Date(2026, 9, 12, 9, 0));
    const file = await docxBase64([{ heading: "جدول البوستات", headers: AR, body: rows(2, "بوست الجاية") }]);
    const p = await preview(companyId, file, { year: 2026, month: 9 });
    expect([p.ok, p.month]).toEqual([true, 9]);
    const r = await applyDocx({ companyId, fileBase64: file, fileName: "plan-next.docx", source: "فحص", at: new Date(2026, 9, 12, 9, 0), target: { year: 2026, month: 9 } });
    expect(r.ok, r.error).toBe(true);
    expect((await prisma.task.findUnique({ where: { id: `${P}_d_9_1` } })).brief).toContain("نص بوست الجاية 1");
    vi.useRealTimers();
  });
  it("PU-14 مُصلَح: إقفال كرت الكتابة بالرفع بيضيف الدليل وما بيمحي الملاحظات الموجودة (قاعدة ٢)", async () => {
    if (skip()) throw new Error("skip");
    const w = await prisma.task.findUnique({ where: { id: `${P}_w_8` } });
    expect(w.status).toBe("READY");
    expect(w.notes).toContain("دليل سابق على كرت الكتابة m=8");
  });
  it.skipIf(skip())("الرفع التاني بيكتب الوصف فوق القديم (استبدال لا دمج) وما بيعيد إقفال كرت الكتابة", async () => {
    vi.setSystemTime(new Date(2026, 9, 12, 10, 0));
    const w0 = await prisma.task.findUnique({ where: { id: `${P}_w_8` } });
    const file = await docxBase64([{ heading: "جدول البوستات", headers: AR, body: rows(2, "نسخة٢") }]);
    const r = await applyDocx({ companyId, fileBase64: file, fileName: "plan-oct-v2.docx", source: "فحص", at: new Date(2026, 9, 12, 10, 0) });
    expect(r.ok, r.error).toBe(true);
    expect(r.closedWriteCards).toBe(0);
    const d = await prisma.task.findUnique({ where: { id: `${P}_d_8_1` } });
    expect(d.brief).toContain("نص نسخة٢ 1");
    expect(d.brief).not.toContain("نص بوست 1");
    const w1 = await prisma.task.findUnique({ where: { id: `${P}_w_8` } });
    expect(w1.notes).toBe(w0.notes);
    expect(String(w1.completedAt)).toBe(String(w0.completedAt));
  });
  it.skipIf(skip())("خطة أكبر من العقد: المعاينة بتحذّر والتطبيق بيرجع بلا كتابة", async () => {
    vi.setSystemTime(new Date(2026, 9, 12, 10, 0));
    const file = await docxBase64([{ heading: "جدول البوستات", headers: AR, body: rows(3, "زيادة") }]);
    const p = await preview(companyId, file);
    expect(p.ok).toBe(true);
    expect(p.warnings.join(" ")).toContain("الزائد لا كرت له");
    const before = await prisma.task.findUnique({ where: { id: `${P}_d_8_1` } });
    const r = await applyDocx({ companyId, fileBase64: file, fileName: "big.docx", source: "فحص" });
    expect(r.ok).toBe(false);
    expect((await prisma.task.findUnique({ where: { id: `${P}_d_8_1` } })).brief).toBe(before.brief);
  });
});
