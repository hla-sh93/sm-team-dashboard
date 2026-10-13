/**
 * المهمة الإضافية بتنسكّر **باسمها** على تلغرام — وبس هي (القائدة ١٣/١٠: «ممنوع مهمة بلا
 * وصف واسم (هاد يلي قابل للنسخ مشان تلغرام يلقطه). لأن عم يضيعو الكروت ببعض»).
 *
 * نفس مسار الويبهوك الحي (`ingestUpdate`) على **نسخة** من القاعدة — نفس عقد
 * `telegram-e2e.test.ts`: بصمة الأصل قبل وبعد، والنسخة بتنمحى.
 */
import { copyFileSync, existsSync, readFileSync, rmSync } from "fs";
import { createHash } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assertIsolatedTestDatabaseUrl } from "./_helpers/test-database";

const REAL = "prisma/dev.db";
const COPY = "prisma/.telegram-extra-name-test.db";
const fingerprint = (f: string) => createHash("sha256").update(readFileSync(f)).digest("hex");
const available = existsSync(REAL);

let ingest: typeof import("../src/lib/telegram/ingest");
let db: typeof import("../src/lib/db");
let names: typeof import("../src/lib/asset-name");
let realBefore = "";
let mine = ""; // كرت أيمن
let theirs = ""; // كرت سابين

/** صورة بكابشن على توبيك Siizen المربوط — المرسِل أيمن باسمه البديل. */
const photo = (msgId: number, caption: string) => ({
  update_id: 960000 + msgId,
  message: {
    message_id: msgId,
    date: Math.floor(Date.now() / 1000),
    chat: { id: -1003563508968, type: "supergroup", title: "Desgin only (Team)🎭" },
    message_thread_id: 3584,
    from: { id: 999001, is_bot: false, first_name: "أيمن ديزاينst" },
    photo: [{ file_id: `extra_file_${msgId}`, width: 1080, height: 1350 }],
    caption,
  },
});

beforeAll(async () => {
  if (!available) return;
  realBefore = fingerprint(REAL);
  copyFileSync(REAL, COPY);
  process.env.DATABASE_URL = assertIsolatedTestDatabaseUrl(`file:${process.cwd()}/${COPY}`);
  db = await import("../src/lib/db");
  ingest = await import("../src/lib/telegram/ingest");
  names = await import("../src/lib/asset-name");
  const ayman = await db.prisma.employee.findFirstOrThrow({ where: { name: "أيمن" } });
  const sabine = await db.prisma.employee.findFirstOrThrow({ where: { name: "سابين" } });
  const base = {
    kind: "ADHOC",
    hours: 4,
    month: 9,
    year: 2026,
    isAuto: false,
    isPinned: true,
    brief: "تصميم إضافي للفحص",
    workDate: new Date(2026, 9, 13),
    readyDate: new Date(2026, 9, 13),
  };
  mine = (await db.prisma.task.create({ data: { ...base, title: "فحص اسم إضافي — أيمن", assigneeId: ayman.id } })).id;
  theirs = (await db.prisma.task.create({ data: { ...base, title: "فحص اسم إضافي — سابين", assigneeId: sabine.id } })).id;
});

afterAll(async () => {
  if (!available) return;
  await db?.prisma.$disconnect();
  expect(fingerprint(REAL)).toBe(realBefore);
  for (const ext of ["", "-journal", "-wal", "-shm"]) if (existsSync(COPY + ext)) rmSync(COPY + ext);
});

describe.skipIf(!available)("اسم المهمة الإضافية على تلغرام", () => {
  it("الملف باسمها بيسكّر كرتها هي — بسطر دليل «بالاسم»", async () => {
    const out = await ingest.ingestUpdate(photo(960001, `Team-extra-${names.extraCode(mine)}`) as never);
    expect(out?.taskId).toBe(mine);
    const card = await db.prisma.task.findUniqueOrThrow({ where: { id: mine } });
    expect(card.board).toBe("DONE");
    expect(card.notes ?? "").toContain("سُلّم على تلغرام (بالاسم)");
  });

  it("اسم كرت غيره (سابين) من أيمن: ما بيسكّر — بيستنّى صاحبته أو القائدة (D3)", async () => {
    const out = await ingest.ingestUpdate(photo(960002, `Team-extra-${names.extraCode(theirs)}`) as never);
    expect(out?.held).toBe("NOT_OWNER");
    const card = await db.prisma.task.findUniqueOrThrow({ where: { id: theirs } });
    expect(card.board).toBe("TODO");
  });

  it("اسم إضافي ما بيطابق ولا كرت: ما بيسكّر شي، ولا بيمرق على المطابقة بالنوع", async () => {
    const before = await db.prisma.task.count({ where: { board: "DONE" } });
    let code = "zzzzz";
    for (const c of ["zzzzz", "qqqqq", "xxxxx"]) {
      const taken = (await db.prisma.task.findMany({ where: { kind: "ADHOC" }, select: { id: true } })).some(
        (t) => names.extraCode(t.id) === c,
      );
      if (!taken) {
        code = c;
        break;
      }
    }
    const out = await ingest.ingestUpdate(photo(960003, `Team-extra-${code}`) as never);
    expect(out?.taskId ?? null).toBeNull();
    expect(await db.prisma.task.count({ where: { board: "DONE" } })).toBe(before);
  });
});
