/**
 * حارس B06 (تدقيق ٦/٩): **حالة خروج فحص اللقطة لازم تطابق نتيجته.**
 *
 * السكربت كان يطبع «✗ ٤ فحص طلع فيه خلل» ويرجّع حالة خروج **صفر** — يعني أي
 * جدولة أو CI بتقرا «نجح» والنص جوّاه فشل. والفشل الصامت أسوأ من الفشل الصاخب:
 * بيخلّي الفحص يبان شغّال وهو ما بيحرس شي.
 *
 * الفحص هون بيفحص **حالة العملية** لا النص المطبوع — لأن النص كان صح من الأصل،
 * والخلل كان بالحالة وحدها. وبيشتغل على لقطات اصطناعية صغيرة بمجلد مؤقت، فما
 * بيلمس `backups/` ولا داتا الشغل.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let dir = "";
const SCRIPT = "scripts/deep-audit-snapshot.ts";
const TSX = "node_modules/tsx/dist/cli.mjs";

/** يشغّل السكربت ويرجّع حالة الخروج بس — بلا ما يرمي على الفشل. */
function exitCodeFor(snapshotPath: string): number {
  try {
    // نود مباشرةً على مدخل tsx — بلا صدفة (تمرير وسائط لصدفة بيخلّيها غير
    // مهرَّبة) وبلا `npx` (اسمه بيختلف بين المنصّات فبيفشل الاستدعاء بصمت،
    // وساعتها فحص «الحالة غير صفرية» بيمرق لسبب غلط).
    execFileSync(process.execPath, [TSX, SCRIPT, snapshotPath], {
      cwd: process.cwd(),
      stdio: "pipe",
    });
    return 0;
  } catch (e) {
    const status = (e as { status?: number }).status;
    return typeof status === "number" ? status : 1;
  }
}

/** أصغر لقطة سليمة: شركة واحدة بلا خطة، وموظف واحد، وولا كرت. */
const cleanSnapshot = {
  companies: [
    {
      id: "c_test",
      name: "شركة الفحص",
      managed: false,
      status: "active",
      posts: 0,
      reels: 0,
      aiReels: 0,
      stories: 0,
      priority: 1,
    },
  ],
  employees: [{ id: "e_test", name: "موظف الفحص", role: "designer", rates: null }],
  tasks: [],
};

/** نفس اللقطة، بس فيها حاجز معلّق — الخلل يلي كشفه التدقيق (B05). */
const failingSnapshot = {
  ...cleanSnapshot,
  tasks: [
    {
      id: "t_orphan",
      kind: "CONTENT",
      stage: "DESIGN",
      type: "POST",
      pieceNo: 1,
      companyId: "c_test",
      assigneeId: "e_test",
      board: "TODO",
      status: "NOT_STARTED",
      blockedById: "t_does_not_exist",
      year: 2026,
      month: 8,
    },
  ],
};

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "snap-audit-"));
});

afterAll(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe("حالة خروج فحص اللقطة", () => {
  it("لقطة نظيفة → حالة خروج صفر", () => {
    const p = join(dir, "clean.json");
    writeFileSync(p, JSON.stringify(cleanSnapshot), "utf8");
    expect(exitCodeFor(p)).toBe(0);
  }, 120_000);

  it("لقطة فيها حاجز معلّق → حالة خروج غير صفرية", () => {
    const p = join(dir, "failing.json");
    writeFileSync(p, JSON.stringify(failingSnapshot), "utf8");
    expect(exitCodeFor(p)).not.toBe(0);
  }, 120_000);

  it("JSON غير صالح → حالة خروج غير صفرية", () => {
    const p = join(dir, "broken.json");
    writeFileSync(p, "{ this is not json", "utf8");
    expect(exitCodeFor(p)).not.toBe(0);
  }, 120_000);

  it("ملف غير موجود → حالة خروج غير صفرية", () => {
    expect(exitCodeFor(join(dir, "missing.json"))).not.toBe(0);
  }, 120_000);
});
