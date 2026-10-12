/**
 * فحص عميق ١٢/١٠/٢٠٢٦ — محور data-audit: ثوابت علائقية لازم تصدق على **أي** داتا إنتاج.
 *
 * قراءة فقط من `prisma/dev.db` بمسار مطلق (مو `.env.local` ولا `DATABASE_URL` — ممكن يأشّروا
 * لقاعدة اختبار تانية). ولا كتابة: `findMany` بس، وبصمة الملف قبل وبعد.
 *
 * `it.fails` = خلل داتا مثبت بالتقرير `docs/qa/deep-test-2026-10-11/data-audit.md` بنفس الرقم.
 * لما تنصلح الداتا بحمولة القائدة، الحالة بتفشل («نجحت بشكل غير متوقّع») — ساعتها شيل `.fails`.
 *
 * قواعد مرجعيّة: WORK_RULES §١ (القطعة = شركة+نوع+رقم+دورة)، §٢ (الإقفال بدليل)، §٨ (لم تجدّد =
 * أرشيف بكروت مقفولة)، والهاندوف §٣ «Raw photographs do not count as finished work» [USER-CONFIRMED].
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { companyLifecycle } from "../../src/lib/company-visibility";

const DB = resolve(process.cwd(), "prisma", "dev.db");
const available = existsSync(DB);
const fingerprint = () => createHash("sha256").update(readFileSync(DB)).digest("hex");

type Row = Record<string, any>;
let prisma: PrismaClient;
let before = "";
let tasks: Row[] = [];
let companies: Row[] = [];
let employees: Row[] = [];
let chats: Row[] = [];
let messages: Row[] = [];

const DONE = new Set(["READY", "PUBLISHED"]);
const isDone = (t: Row) => t.board === "DONE" || DONE.has(t.status);
const STAGE_ORDER: Record<string, number> = { WRITE: 0, DESIGN: 1, SHOOT: 1, EDIT: 2, PUBLISH: 3 };

describe.skipIf(!available)("data-audit — ثوابت علائقية على داتا الإنتاج (قراءة فقط)", () => {
  beforeAll(async () => {
    before = fingerprint();
    prisma = new PrismaClient({ datasources: { db: { url: `file:${DB}` } } });
    [tasks, companies, employees, chats, messages] = await Promise.all([
      prisma.task.findMany(),
      prisma.company.findMany(),
      prisma.employee.findMany(),
      prisma.telegramChat.findMany(),
      prisma.telegramMessage.findMany({ select: { id: true, taskId: true, companyId: true, fileName: true } }),
    ]);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    expect(fingerprint()).toBe(before); // ولا حرف انكتب
  });

  const nameOf = (id: string | null) => companies.find((c) => c.id === id)?.name ?? id ?? "—";
  const pieceKey = (t: Row) => `${t.companyId}|${t.type}|${t.year}-${t.month}|${t.pieceNo}`;

  it("سلسلة الحجز بكروت المحرّك: نفس الشركة، مرحلة أبكر لنفس القطعة أو كرت كتابة، وبلا دوائر", () => {
    const byId = new Map(tasks.map((t) => [t.id, t]));
    const bad: string[] = [];
    for (const t of tasks.filter((x) => x.isAuto && x.blockedById)) {
      const b = byId.get(t.blockedById);
      if (!b) continue; // المعلّق مغطّى بـ data-integrity
      if (b.companyId !== t.companyId) bad.push(`${t.id} ⇢ ${b.id}: شركة تانية`);
      else if (b.stage === "WRITE") continue;
      else if (pieceKey(b) !== pieceKey(t)) bad.push(`${t.id} ⇢ ${b.id}: قطعة تانية`);
      else if ((STAGE_ORDER[b.stage] ?? 9) >= (STAGE_ORDER[t.stage] ?? 9)) bad.push(`${t.id} ⇢ ${b.id}: مرحلة مو أبكر`);
    }
    for (const t of tasks) {
      const seen = new Set<string>();
      let cur: Row | undefined = t;
      while (cur?.blockedById) {
        if (seen.has(cur.id)) {
          bad.push(`دائرة حجز عند ${t.id}`);
          break;
        }
        seen.add(cur.id);
        cur = byId.get(cur.blockedById);
      }
    }
    expect(bad).toEqual([]);
  });

  it("روابط الشركة: توبيك كل محادثة لشركة موجودة، ومحادثة كل شركة غير مؤرشفة موجودة، وصاحب الحساب موظف موجود", () => {
    const co = new Set(companies.map((c) => c.id));
    const ch = new Set(chats.map((c) => c.id));
    const em = new Set(employees.map((e) => e.id));
    const bad = [
      ...chats.filter((c) => c.companyId && !co.has(c.companyId)).map((c) => `توبيك ${c.id} → شركة مفقودة`),
      ...companies
        .filter((c) => c.telegramChatId && companyLifecycle(c as never) !== "archived" && !ch.has(c.telegramChatId))
        .map((c) => `${c.name}.telegramChatId → محادثة مفقودة`),
      ...companies.filter((c) => c.accountOwnerId && !em.has(c.accountOwnerId)).map((c) => `${c.name}.accountOwnerId → موظف مفقود`),
    ];
    expect(bad).toEqual([]);
  });

  it("ترقيم القطع بيبلّش من ١ لكل (شركة، نوع، دلو) — الملغى بيحفظ رقمه", () => {
    const nums = new Map<string, number[]>();
    for (const t of tasks.filter((x) => x.isAuto && x.pieceNo != null && x.type && x.companyId)) {
      const k = `${t.companyId}|${t.type}|${t.year}-${t.month}`;
      nums.set(k, [...(nums.get(k) ?? []), t.pieceNo]);
    }
    const bad = [...nums].filter(([, v]) => Math.min(...v) !== 1).map(([k, v]) => `${nameOf(k.split("|")[0])} ${k} يبدأ بـ${Math.min(...v)}`);
    expect(bad).toEqual([]);
  });

  it("§٨: شركة وصل قرار انتهائها مؤرشفة وما إلها كرت مفتوح", () => {
    const now = new Date();
    const ended = companies.filter((c) => c.contractEndedAt && new Date(c.contractEndedAt) <= now);
    const bad: string[] = [];
    for (const c of ended) {
      if (companyLifecycle(c as never, now) !== "archived") bad.push(`${c.name}: مو مؤرشفة`);
      const open = tasks.filter((t) => t.companyId === c.id && t.status !== "CANCELED" && !isDone(t));
      if (open.length) bad.push(`${c.name}: ${open.length} كرت مفتوح`);
    }
    expect(bad).toEqual([]);
  });

  /**
   * [DA-09] القطعة يلي إلها كرت إنتاج بالمحرّك لازم يكون إلها كرت نشر (حيّ أو ملغى بدليل) — بلاه ما
   * بتنعدّ منشورة ولا بتظهر بقائمة عمر أبداً. فحص الثغرات بـdata-integrity بيلقط الرقم الناقص
   * بالنص بس، وهون منلقط الناقص بالآخر كمان (بلسم بوست ١٠ · ريل ٤ · سايزن ريل ٤ …).
   */
  it.fails("[DA-09] كل قطعة إنتاج بالمحرّك إلها كرت نشر (حيّ أو ملغى)", () => {
    const pieces = new Map<string, Set<string>>();
    for (const t of tasks.filter((x) => x.isAuto && x.pieceNo != null && x.type && x.companyId)) {
      const k = pieceKey(t);
      pieces.set(k, (pieces.get(k) ?? new Set()).add(t.stage));
    }
    const bad = [...pieces]
      .filter(([, st]) => [...st].some((s) => s !== "PUBLISH" && s !== "WRITE") && !st.has("PUBLISH"))
      .map(([k]) => `${nameOf(k.split("|")[0])} ${k.split("|").slice(1).join(" ")}`);
    expect(bad).toEqual([]);
  });

  /** [DA-10] رابط ملف تلغرام لازم يأشّر لكرت موجود — إعادة الترقيم/التوليد بتغيّر المعرّف وبتيتّم الرابط. */
  it.fails("[DA-10] كل رسالة تلغرام مربوطة بكرت، الكرت موجود", () => {
    const ids = new Set(tasks.map((t) => t.id));
    expect(messages.filter((m) => m.taskId && !ids.has(m.taskId)).map((m) => `${m.id} → ${m.taskId}`)).toEqual([]);
  });

  /**
   * [DA-03] «Raw photographs do not count as finished work» [USER-CONFIRMED، الهاندوف §٣]: كرت تصميم
   * منجز دليله الوحيد ملف كاميرا خام (IMG_/DSC/PXL/VID) هو إقفال كاذب — إلا لو انفتح من جديد أو أكّدته القائدة.
   */
  it.fails("[DA-03] ولا كرت تصميم منجز دليله الوحيد صورة خام", () => {
    const RAW = /\b(IMG|DSC|PXL|VID)[_-]?\d{3,}|WhatsApp Image|Screenshot/i;
    const bad: string[] = [];
    for (const t of tasks.filter((x) => x.stage === "DESIGN" && x.status !== "CANCELED" && isDone(x))) {
      const lines = String(t.notes ?? "").split(/\n| \| | · /).map((l) => l.trim()).filter(Boolean);
      const evidence = lines.filter((l) => l.startsWith("سُلّم على تلغرام"));
      const overridden = lines.some((l) => l.includes("فُتح من جديد") || l.includes("أكّدت القائدة"));
      if (evidence.length && evidence.every((l) => RAW.test(l)) && !overridden) {
        bad.push(`${nameOf(t.companyId)} ${t.type}#${t.pieceNo} ${t.year}-${t.month + 1} (${t.id})`);
      }
    }
    expect(bad).toEqual([]);
  });
});
