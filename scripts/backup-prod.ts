/**
 * سحب نسخة الإنتاج الاحتياطية — يشتغل محلياً كل يوم ١٢ ظهراً.
 *
 *   npm run backup:pull
 *
 * السرّ بيتقرا من البيئة (`CRON_SECRET`، عادةً من `.env.local`) وما بينطبع
 * ولا بينكتب بالسجل. العنوان من `PROD_BASE_URL` وإلا الاسم الحيّ الافتراضي.
 *
 * الترتيب مقصود: سحب ← تحقّق ← كتابة ← **بعدها** تدوير. الحذف ما بيصير إلا
 * بعد ما تنجح النسخة الجديدة وتنتحقّق بصمتها؛ نسخة بتنكتب فوق كارثة هي كارثة
 * تانية.
 */
import { createHash } from "crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, appendFileSync } from "fs";
import { resolve } from "path";
import { acceptSnapshot, actualCounts, snapshotsToDelete, type Snapshot } from "../src/lib/backup";

const BACKUP_DIR = resolve("backups");
const LOG = resolve(BACKUP_DIR, "backup-log.txt");
const KEEP = Number(process.env.BACKUP_KEEP ?? 3);
const PREFIX = "prod-";

function loadEnvFile(path: string) {
  const full = resolve(path);
  if (!existsSync(full)) return;
  // تنظيف دفاعي: ملف كُتب بـPowerShell بيطلع UTF-16، فكل محرف وراه بايت
  // صفري والمفتاح ما بينقرا — والنتيجة «السرّ ناقص» وهو موجود.
  const NUL = String.fromCharCode(0);
  const BOM = String.fromCharCode(0xff) + String.fromCharCode(0xfe);
  const cleaned = readFileSync(full, "latin1").split(BOM).join("").split(NUL).join("");
  const text = Buffer.from(cleaned, "latin1").toString("utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const key = trimmed.slice(0, trimmed.indexOf("=")).trim();
    const value = trimmed.slice(trimmed.indexOf("=") + 1).trim().replace(/^['"]|['"]$/g, "");
    if (value && !process.env[key]) process.env[key] = value;
  }
}

function stamp(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function log(line: string) {
  mkdirSync(BACKUP_DIR, { recursive: true });
  appendFileSync(LOG, `${new Date().toISOString()} ${line}\n`, "utf8");
  console.log(line);
}

/** أحدث لقطة إنتاج موجودة — مرجع حارس الانكماش. */
function latestExisting(): { file: string; snapshot: Snapshot } | null {
  if (!existsSync(BACKUP_DIR)) return null;
  const files = readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith(PREFIX) && f.endsWith(".json"))
    .sort();
  const last = files[files.length - 1];
  if (!last) return null;
  try {
    return { file: last, snapshot: JSON.parse(readFileSync(resolve(BACKUP_DIR, last), "utf8")) };
  } catch {
    return null; // ملف معطوب ما بيصير يصير مرجعاً
  }
}

async function main() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");

  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    log("❌ فشل: CRON_SECRET مو محطوط بالبيئة المحلية — حطّيه بـ.env.local");
    process.exitCode = 1;
    return;
  }
  // سرّ فيه محارف تحكّم بيوقع الطلب برسالة غامضة (UND_ERR_INVALID_ARG) بدل ما
  // يقول السبب. صار بينمسك هون: غالباً السطر انكتب بترميز UTF-16 من PowerShell.
  if (!/^[!-~]+$/.test(secret)) {
    log(
      "❌ فشل: قيمة CRON_SECRET فيها محارف غير صالحة لترويسة HTTP — غالباً السطر " +
        "انكتب بترميز UTF-16. افتحي .env.local بمحرّر نصّي واكتبي السطر يدوياً، " +
        "أو استعملي: Add-Content .env.local 'CRON_SECRET=<القيمة>' -Encoding utf8",
    );
    process.exitCode = 1;
    return;
  }
  const base = (process.env.PROD_BASE_URL ?? "https://socialmediateam.vercel.app").replace(/\/$/, "");
  const url = `${base}/api/backup/export`;

  const res = await fetch(url, {
    headers: { authorization: `Bearer ${secret}` },
    cache: "no-store",
  });
  if (!res.ok) {
    log(
      `❌ فشل السحب: ${res.status} ${res.statusText} — ما انكتب ولا انحذف شي.` +
        (res.status === 401
          ? " القيمة المحلية مو مطابقة لقيمة Vercel: تأكّدي إنّ النشر خلص (Ready) وإنّ المتغيّر محفوظ لبيئة Production."
          : ""),
    );
    process.exitCode = 1;
    return;
  }
  const body = await res.text();
  let snapshot: Snapshot;
  try {
    snapshot = JSON.parse(body);
  } catch {
    log("❌ الرد مو JSON صالح — ما انكتب شي");
    process.exitCode = 1;
    return;
  }

  const previous = latestExisting();
  const verdict = acceptSnapshot(snapshot, previous?.snapshot ?? null);
  if (!verdict.ok) {
    log(`❌ اللقطة مرفوضة: ${verdict.reason} — ما انكتب ولا انحذف شي`);
    process.exitCode = 1;
    return;
  }

  const counts = actualCounts(snapshot);
  const hash = createHash("sha256").update(body).digest("hex");
  const name = `${PREFIX}${stamp()}.json`;
  mkdirSync(BACKUP_DIR, { recursive: true });
  writeFileSync(resolve(BACKUP_DIR, name), body, "utf8");
  writeFileSync(resolve(BACKUP_DIR, `${name}.sha256`), `${hash}  ${name}\n`, "utf8");

  // تحقّق ما بعد الكتابة: الملف على القرص هو يلي منعتمد عليه، مو الرد بالذاكرة.
  const onDisk = createHash("sha256").update(readFileSync(resolve(BACKUP_DIR, name), "utf8")).digest("hex");
  if (onDisk !== hash) {
    log(`❌ الملف المكتوب بصمته ما طابقت — ما انحذف شي`);
    process.exitCode = 1;
    return;
  }

  log(
    `✓ ${name} · موظفين ${counts.employees} · شركات ${counts.companies} · كروت ${counts.tasks} · نزلات ${counts.photoSessions} · إعدادات ${counts.settings} · ${hash.slice(0, 12)}`,
  );

  // التدوير بعد النجاح فقط — واللقطات وحدها، نسخ dev.db برّاه عن قصد.
  const jsons = readdirSync(BACKUP_DIR).filter((f) => f.startsWith(PREFIX) && f.endsWith(".json"));
  for (const old of snapshotsToDelete(jsons, KEEP)) {
    rmSync(resolve(BACKUP_DIR, old), { force: true });
    rmSync(resolve(BACKUP_DIR, `${old}.sha256`), { force: true });
    log(`  ↳ انحذفت النسخة القديمة ${old} (بنخلي آخر ${KEEP})`);
  }
}

main().catch((e) => {
  log(`❌ خطأ غير متوقع: ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
});
