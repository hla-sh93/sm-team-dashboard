/**
 * الفحص العميق — WORK_RULES §٣ «قاعدة الحفظ»: أي عمود على `Task` بينكتب من برّا
 * المحرّك لازم يمرق بتلات أماكن وإلا بينمحى بصمت عند إعادة التوليد:
 *   ١. `ExistingPipelineTaskState` (`src/lib/pipeline-preservation.ts`)
 *   ٢. الـ`select` على الصفوف الموجودة بـ`src/server/schedule-engine.ts`
 *   ٣. `PipelineTask` (`src/lib/pipeline.ts`)
 *   + ٤. الـ`data` يلي بينكتب بـ`createMany` بالمحرّك نفسه (وإلا الحفظ بلا كتابة).
 *
 * الفحص ثابت (static): بيقرأ أعمدة `Task` من `prisma/schema.prisma` وبيستثني
 * الأعمدة يلي المحرّك صاحبها (مشتقّة أو هوية الصفّ)، وبيقارن الباقي مع
 * الأماكن الأربعة بالنصّ. أي عمود جديد على `Task` بيفشّل الفحص لحتى ينضاف
 * للأماكن الأربعة أو لقائمة الاستثناء بقرار واعٍ.
 *
 * الفجوة المعروفة (١٢/١٠/٢٠٢٦): `reviewedAt` و`reviewedById` — بيكتبهم
 * `setPieceReviewed` على كرت النشر وما بيمرقوا بولا مكان، فبيضيعوا بأول إعادة
 * توليد. مثبّتة هون صراحةً حتى يبيّن الفحص لحظة إصلاحها (أو أي فجوة جديدة).
 * معرّفها بالتقرير RG-07، وتكرارها الحيّ (ختم بينمحى فعلاً) بـ`regen-findings.test.ts`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

function taskColumns(): string[] {
  const schema = read("prisma/schema.prisma");
  const block = schema.match(/model Task \{([\s\S]*?)\n\}/)?.[1] ?? "";
  return block
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("//") && !l.startsWith("@@"))
    .map((l) => l.split(/\s+/)[0])
    .filter((name) => !["company", "assignee"].includes(name)); // علاقات، مو أعمدة
}

function keysOfBlock(src: string, start: RegExp, end: string): string[] {
  const from = src.search(start);
  if (from < 0) throw new Error(`block not found: ${start}`);
  const rest = src.slice(from);
  const to = rest.indexOf(end);
  const body = rest.slice(0, to < 0 ? undefined : to);
  const keys = new Set<string>();
  // `key: value` أو `key?: type` أو الاختصار `key,` (startedAt, finishedAt بالـcreateMany)
  for (const m of body.matchAll(/^\s+(\w+)\??\s*:/gm)) keys.add(m[1]);
  for (const m of body.matchAll(/^\s+(\w+),\s*$/gm)) keys.add(m[1]);
  return [...keys];
}

/** الأعمدة يلي المحرّك صاحبها: هوية الصفّ أو مشتقّة من الجدولة، ما حدا بيكتبها من برّا. */
const ENGINE_OWNED = new Set([
  "id",
  "kind",
  "stage",
  "type",
  "companyId",
  "hours",
  "week",
  "overflow",
  "month",
  "year",
  "isAuto",
  "pipelineKey",
  "blockedById",
  "detKey",
  "createdAt",
  "updatedAt",
]);

/** الفجوة المعروفة — شوف رأس الملف. */
const KNOWN_GAPS = ["reviewedAt", "reviewedById"];

describe("WORK_RULES §٣ — حقول Task المكتوبة من برّا المحرّك بتمرق بالأماكن الأربعة", () => {
  const columns = taskColumns();
  const userWritten = columns.filter((c) => !ENGINE_OWNED.has(c));

  const preservation = read("src/lib/pipeline-preservation.ts");
  const engine = read("src/server/schedule-engine.ts");
  const pipeline = read("src/lib/pipeline.ts");

  const stateKeys = keysOfBlock(preservation, /export type ExistingPipelineTaskState = \{/, "\n};");
  const selectKeys = keysOfBlock(engine, /const existing = await prisma\.task\.findMany\(\{/, "\n    });");
  const pipelineKeys = keysOfBlock(pipeline, /export type PipelineTask = \{/, "\n};");
  const writtenKeys = keysOfBlock(engine, /data: pipeToWrite\.map\(\(t\) => \{/, "\n        }),\n      });");

  it("قراءة الأماكن الأربعة نجحت (حارس على تغيّر الشكل)", () => {
    expect(columns.length).toBeGreaterThan(20);
    expect(stateKeys).toContain("brief");
    expect(selectKeys).toContain("brief");
    expect(pipelineKeys).toContain("brief");
    expect(writtenKeys).toContain("brief");
  });

  it("كل عمود مكتوب من برّا المحرّك موجود بالأماكن الأربعة — إلا الفجوة المعروفة حرفياً", () => {
    const missing = userWritten.filter(
      (c) =>
        !stateKeys.includes(c) ||
        !selectKeys.includes(c) ||
        !pipelineKeys.includes(c) ||
        !writtenKeys.includes(c),
    );
    expect(missing.sort()).toEqual([...KNOWN_GAPS].sort());
  });

  it("الأعمدة المحميّة فعلاً (وصف، ملاحظات، أختام، تثبيت، يوم يدوي، رقم القطعة…) كلها بالأماكن الأربعة", () => {
    for (const c of [
      "title",
      "quantity",
      "pieceNo",
      "priority",
      "status",
      "board",
      "publishDate",
      "readyDate",
      "workDate",
      "manualDay",
      "isPinned",
      "notes",
      "brief",
      "startedAt",
      "finishedAt",
      "completedAt",
      "assigneeId",
    ]) {
      expect(stateKeys, `${c} ∉ ExistingPipelineTaskState`).toContain(c);
      expect(selectKeys, `${c} ∉ select`).toContain(c);
      expect(pipelineKeys, `${c} ∉ PipelineTask`).toContain(c);
      expect(writtenKeys, `${c} ∉ createMany data`).toContain(c);
    }
  });

  it("الأعمدة يلي المحرّك صاحبها فعلاً موجودة على الجدول (ما في اسم قديم بالاستثناء)", () => {
    for (const c of ENGINE_OWNED) expect(columns, c).toContain(c);
  });
});
