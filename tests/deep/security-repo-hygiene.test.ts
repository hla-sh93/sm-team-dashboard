/**
 * فحص عميق ١٢/١٠/٢٠٢٦ — محور security-api: نظافة المستودع من الأسرار.
 *
 * المراجع: `.gitignore` («لقطات الإنتاج… فيها الداتا كاملة… بتنتجاهل من المصدر»،
 * و«Catch-all: any *.env… never again»)، سجلّ CLAUDE_HANDOFF ١٥/٩
 * («`.env.bak-20260911` is a tracked file… must be rotated and removed from
 * tracking»)، و`src/lib/backup.ts` (`AUTH_KEYS` ما بتطلع بأي لقطة).
 *
 * الفحص بيقرأ **أسماء** الملفات ومفاتيح الإعدادات وأول ١٦ بايت (توقيع SQLite)
 * بس — ولا قيمة سرّ بتنقرا أو بتنطبع. بلا git بالبيئة بيتخطّى.
 */
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { closeSync, existsSync, openSync, readFileSync, readSync, statSync } from "node:fs";

function gitLsFiles(): string[] | null {
  try {
    return execFileSync("git", ["ls-files"], { encoding: "utf8" }).split("\n").filter(Boolean);
  } catch {
    return null;
  }
}
const tracked = gitLsFiles();
const HAS_GIT = tracked !== null;

function isSqlite(path: string): boolean {
  if (!existsSync(path) || statSync(path).size < 16) return false;
  const fd = openSync(path, "r");
  try {
    const buf = Buffer.alloc(16);
    readSync(fd, buf, 0, 16, 0);
    return buf.toString("latin1") === "SQLite format 3\u0000";
  } finally {
    closeSync(fd);
  }
}

describe.skipIf(!HAS_GIT)("[SA-02] أسرار ومواد حسّاسة بالملفات المتتبَّعة", () => {
  it.fails("[SA-02] ولا ملف بيئة متتبَّع غير .env.example (اليوم: .env.bak-20260911)", () => {
    const envLike = tracked!.filter((f) => /(^|\/)\.env(\.|$)|\.env$/.test(f) && !f.endsWith(".env.example"));
    expect(envLike).toEqual([]);
  });

  it.fails("[SA-02] ولا قاعدة SQLite متتبَّعة (اليوم: نسخة ٨/٧ فيها authSecret وبصمة كلمة المرور)", () => {
    const dbs = tracked!.filter((f) => /\.(db|bak|sqlite)$/i.test(f) || /dev\.db/.test(f)).filter(isSqlite);
    expect(dbs).toEqual([]);
  });

  it("اللقطة المتتبَّعة الحالية (local-db-snapshot.json) ما فيها مفاتيح الدخول — نظيف", () => {
    const path = "backups/local-db-snapshot.json";
    if (!existsSync(path)) return;
    const snap = JSON.parse(readFileSync(path, "utf8")) as { settings?: { key: string }[] };
    const keys = (snap.settings ?? []).map((s) => s.key);
    for (const k of ["authSecret", "adminPasswordHash", "adminEmail"]) expect(keys).not.toContain(k);
  });

  it(".gitignore بيغطّي ملفات البيئة ولقطات الإنتاج وقواعد الفحص — نظيف", () => {
    const ignored = (p: string) => {
      try {
        execFileSync("git", ["check-ignore", "-q", "--no-index", p]);
        return true;
      } catch {
        return false;
      }
    };
    for (const p of [".env", ".env.local", ".env.production.local", "telegram.env.local", "backups/prod-20261011-1249.json", "prisma/test-deep-security-x.db"]) {
      expect(ignored(p), p).toBe(true);
    }
  });

  it.fails("[SA-02] .gitignore لازم يغطّي أي .env.* (اليوم .env.bak-* بيفلت)", () => {
    let ok = false;
    try {
      execFileSync("git", ["check-ignore", "-q", "--no-index", ".env.bak-20990101"]);
      ok = true;
    } catch {
      ok = false;
    }
    expect(ok).toBe(true);
  });
});
