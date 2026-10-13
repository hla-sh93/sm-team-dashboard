/**
 * فحص عميق ١٢/١٠/٢٠٢٦ — محور security-api: التحقّق من المدخلات على حدود الأفعال.
 *
 * المراجع: QA-005 (`taskDetailsSchema` صارم على حدّ الفعل) و QA-006 (حقن صيغ CSV)
 * بـ`docs/qa/FINAL_QA_REPORT.md` §6؛ تعليق `src/lib/csv.ts` («Exported names/titles
 * are untrusted text»)؛ ومنطقة الموظفين بلا دخول (PROJECT.md §2) — يعني كل مدخل
 * لأفعال الموظف وارد من أي زائر.
 *
 * الجزء بلا قاعدة بيشتغل دايماً؛ فحص ملف Word الضخم بدّه نسخة `prisma/dev.db`.
 */
import { afterAll, describe, expect, it, vi } from "vitest";
import { existsSync } from "node:fs";
import JSZip from "jszip";
import { taskSchema, taskDetailsSchema, companySchema, employeeSchema } from "@/lib/schemas";
import { toCSV } from "@/lib/csv";
import { fromISODate } from "@/lib/dates";

const HAS_DB = existsSync("prisma/dev.db");
const scratch = vi.hoisted(() => ({ target: "", available: false }));

vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("@/lib/db", async () => {
  const g = globalThis as any;
  if (!g.__secInputPrisma) {
    const { PrismaClient } = await import("@prisma/client");
    const { assertIsolatedTestDatabaseUrl } = await import("../_helpers/test-database");
    const { copyDevDb, fileUrl } = await import("./security-fixture");
    const copy = copyDevDb("input");
    scratch.target = copy.target;
    scratch.available = copy.available;
    g.__secInputPrisma = new PrismaClient({
      datasources: { db: { url: assertIsolatedTestDatabaseUrl(fileUrl(copy.target)) } },
    });
  }
  return { prisma: g.__secInputPrisma };
});

import { removeDb } from "./security-fixture";

afterAll(async () => {
  const g = globalThis as any;
  await g.__secInputPrisma?.$disconnect();
  delete g.__secInputPrisma;
  if (scratch.target) removeDb(scratch.target);
});

const baseTask = { title: "مهمة فحص", brief: "وصف فحص", month: 9, year: 2026 };

describe("مخطّط إنشاء المهمة (createTask — مفتوح للزوّار)", () => {
  it("المفاتيح الغريبة بتنشال بالصمت (ما بتوصل للقاعدة): id / isAuto / pipelineKey / completedAt", () => {
    const r = taskSchema.parse({ ...baseTask, id: "x", isAuto: true, pipelineKey: "k", completedAt: "2020-01-01" });
    expect(r).not.toHaveProperty("id");
    expect(r).not.toHaveProperty("isAuto");
    expect(r).not.toHaveProperty("pipelineKey");
    expect(r).not.toHaveProperty("completedAt");
  });

  it("التعدادات والحدود الرقمية مضبوطة: حالة/أولوية غريبة، ساعات سالبة/NaN/ضخمة، سنة خارج المدى", () => {
    for (const bad of [
      { status: "HACKED" }, { priority: "P0" }, { kind: "DELETE" }, { type: "TWEET" },
      { hours: -1 }, { hours: 481 }, { hours: Number.NaN }, { days: 61 },
      { month: 12 }, { month: -1 }, { year: 1999 }, { year: 2101 }, { title: "" }, { title: "x".repeat(201) },
    ]) {
      expect(taskSchema.safeParse({ ...baseTask, ...bad }).success, JSON.stringify(bad)).toBe(false);
    }
  });

  it("[SA-10 مُصلَح] الملاحظات بحدّ أعلى: ١ مليون حرف بينرفض", () => {
    expect(taskSchema.safeParse({ ...baseTask, notes: "ن".repeat(1_000_000) }).success).toBe(false);
  });

  it("[SA-10 مُصلَح] تاريخ مستحيل (30 شباط) بينرفض بدل ما ينقلب لـ2 آذار بالصمت", () => {
    expect(fromISODate("2026-02-30").getMonth()).toBe(2); // الدليل: بينقلب لآذار
    expect(taskSchema.safeParse({ ...baseTask, readyDate: "2026-02-30" }).success).toBe(false);
  });

  it("[SA-10 مُصلَح] سنة بخانتين بالتاريخ (0026-01-01) بتنرفض", () => {
    expect(fromISODate("0026-01-01").getFullYear()).toBe(1926);
    expect(taskSchema.safeParse({ ...baseTask, workDate: "0026-01-01" }).success).toBe(false);
  });
});

describe("مخطّط تعديل الكرت (updateTaskDetails — صارم، QA-005)", () => {
  it("مفتاح غريب بينرفض (strict) — نظيف", () => {
    expect(taskDetailsSchema.safeParse({ title: "x", companyId: "c_other" }).success).toBe(false);
    expect(taskDetailsSchema.safeParse({ notes: "x" }).success).toBe(false);
  });
  it("[SA-10 مُصلَح] عنوان فاضي بينرفض (\"\" كان بيصير كرت بلا اسم)", () => {
    expect(taskDetailsSchema.safeParse({ title: "" }).success).toBe(false);
  });
});

describe("مخطّطات الإدارة (للسجلّ)", () => {
  it("اسم الشركة/الموظف محدود ١٠٠؛ اللون hex؛ الحساب بلا @ ولا رابط", () => {
    expect(companySchema.safeParse({ name: "x".repeat(101) }).success).toBe(false);
    expect(companySchema.safeParse({ name: "ش", color: "red; background:url(x)" }).success).toBe(false);
    expect(companySchema.safeParse({ name: "ش", instagramHandle: "https://evil.example/x" }).success).toBe(false);
    expect(employeeSchema.safeParse({ name: "x".repeat(101), role: "r", workDays: [0] }).success).toBe(false);
  });
});

describe("CSV (QA-006)", () => {
  it("البادئات = + - @ بتتحيّد، والأرقام السالبة بتضل أرقام — نظيف", () => {
    const csv = toCSV(["h"], [["=1+1"], ["+1"], ["-1+1"], ["@SUM(A1)"], [" =1"], ["\t=1"], [-5]]);
    const lines = csv.replace(/^﻿/, "").split("\r\n").slice(1);
    expect(lines.slice(0, 6).every((l) => l.startsWith("'") || l.startsWith("\"'"))).toBe(true);
    expect(lines[6]).toBe("-5");
  });
  it("[SA-11 مُصلَح] خانة فيها «;» بتنحاط بين علامتي تنصيص — Excel بلغة فاصلها «;» ما بيقسمها", () => {
    const csv = toCSV(["h"], [["x;=1+1"]]);
    const line = csv.replace(/^﻿/, "").split("\r\n")[1];
    expect(line.startsWith("\"")).toBe(true);
  });
});

describe("ملف Word للخطة (previewCompanyPlanDocx — بلا بوابة، PU-18)", () => {
  it.skipIf(!HAS_DB)(
    "[SA-09 مُصلَح] ملف صغير (<٢٠٠KB) بيفكّ لـ٦٤MB XML: القارئ بيرفض الحجم قبل ما يفكّ",
    async () => {
      const { prisma } = await import("@/lib/db");
      const { currentCycleBucket } = await import("@/lib/contract");
      const companies = await prisma.company.findMany({ where: { managed: true, status: "active" } });
      const company = companies.find((c: any) => c.publishStartDate && currentCycleBucket(c, new Date()));
      expect(company, "شركة نشطة بدورة شغّالة").toBeTruthy();
      const para = "<w:p><w:r><w:t>" + "a".repeat(60) + "</w:t></w:r></w:p>";
      const xml = `<w:document><w:body>${para.repeat(Math.ceil((64 * 1024 * 1024) / para.length))}</w:body></w:document>`;
      const zip = new JSZip();
      zip.file("word/document.xml", xml);
      const b64 = (await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 9 } })).toString("base64");
      expect(b64.length).toBeLessThan(400 * 1024); // أقل بكتير من حدّ الـ٢MB للأفعال
      const { previewCompanyPlanDocx } = await import("@/server/actions/plans");
      const t0 = performance.now();
      const r: any = await previewCompanyPlanDocx(company!.id, b64);
      const ms = performance.now() - t0;
      expect(r.ok).toBe(false);
      // رفض سريع بسبب الحجم، بلا فكّ كامل ولا تحليل.
      expect(r.error).toMatch(/حجم|كبير|size/i);
      // الفكّ الكامل كان ~٢.٥ ثانية و+١GB؛ الرفض بالحجم أسرع بكتير — بس التوقيت تحت
      // حمل الطقم الكامل بيتأرجح، فالحدّ واسع والرسالة هي الفاصل الحقيقي.
      expect(ms).toBeLessThan(1000);
    },
    60_000,
  );
});
