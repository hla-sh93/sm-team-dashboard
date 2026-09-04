/**
 * فحص عميق على **لقطة الإنتاج** — كل الشركات وكل العلاقات، بلا ما يلمس الداتا.
 *
 * `deep-audit.ts` القديم بيشغّل التوليد فعلاً فبيكتب على الداتا. هاد بيقرا لقطة
 * وبس، فبينفع ينشغّل بأي وقت وعلى الإنتاج بلا خطر.
 *
 *   npx tsx scripts/deep-audit-snapshot.ts [مسار اللقطة]
 */
import { readFileSync, readdirSync } from "node:fs";
import { cycleForBucket, hasStartedPublishing } from "@/lib/contract";
import { assetNameForTask } from "@/lib/asset-name";
import { DONE_STATUSES } from "@/lib/constants";

type T = Record<string, any>;

const latest = () =>
  "backups/" +
  readdirSync("backups")
    .filter((n) => n.startsWith("prod-") && n.endsWith(".json"))
    .sort()
    .pop()!;
const file = process.argv[2] ?? latest();
const snap = JSON.parse(readFileSync(file, "utf8"));
const tasks = snap.tasks as T[];
const companies = snap.companies as T[];
const employees = snap.employees as T[];

const D = (v: any): Date | null => (v ? new Date(v) : null);
const L = (v: any) => {
  const d = D(v);
  return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "—";
};
const co = new Map(companies.map((c) => [c.id, c]));
const em = new Map(employees.map((e) => [e.id, e]));
const nm = (id: string) => co.get(id)?.name ?? id;
const live = tasks.filter((t) => t.status !== "CANCELED");
const content = live.filter((t) => t.kind === "CONTENT" && t.type && t.companyId);
const isDone = (t: T) => t.board === "DONE" || DONE_STATUSES.includes(t.status);

let failed = 0;
function check(title: string, bad: string[]) {
  if (bad.length) failed++;
  console.log(`${bad.length ? "✗" : "✓"} ${title}: ${bad.length}`);
  bad.slice(0, 6).forEach((b) => console.log(`      ${b}`));
  if (bad.length > 6) console.log(`      … و${bad.length - 6} غيرها`);
}

console.log(`لقطة: ${file}`);
console.log(`${tasks.length} كرت · ${companies.length} شركة · ${employees.length} موظف\n`);

console.log("── ١· السلامة المرجعية ──");
check("كرت بيشير لشركة مو موجودة", live.filter((t) => t.companyId && !co.has(t.companyId)).map((t) => t.id));
check("كرت مسنَد لموظف مو موجود", live.filter((t) => t.assigneeId && !em.has(t.assigneeId)).map((t) => t.id));
check(
  "كرت محجوز بكرت مو موجود",
  live.filter((t) => t.blockedById && !tasks.some((x) => x.id === t.blockedById)).map((t) => `${nm(t.companyId)} ${t.stage}`),
);
check(
  "قطعة مكسورة على مفتاحين",
  (() => {
    const g = new Map<string, Set<string>>();
    for (const t of content.filter((x) => x.pieceNo)) {
      const k = `${nm(t.companyId)}|${t.year}-${t.month}|${t.type}#${t.pieceNo}`;
      g.set(k, (g.get(k) ?? new Set()).add(String(t.pipelineKey)));
    }
    return [...g].filter(([, v]) => v.size > 1).map(([k]) => k);
  })(),
);

console.log("\n── ٢· الدورات والتواريخ ──");
check(
  "قطعة مولّدة برّا دورة شركتها",
  content
    .filter((t) => {
      const c = co.get(t.companyId);
      if (!c?.contractStartDate || !t.publishDate || !t.isAuto || t.isPinned) return false;
      if (!hasStartedPublishing(c as any)) return false;
      const cy = cycleForBucket(c as any, t.year, t.month);
      if (!cy) return true;
      const p = D(t.publishDate)!.getTime();
      return p < cy.start.getTime() || p >= cy.end.getTime();
    })
    .map((t) => `${nm(t.companyId)} ${t.type}#${t.pieceNo} ${t.stage} نشر ${L(t.publishDate)}`),
);
check(
  "نشر يوم جمعة",
  content.filter((t) => t.isAuto && t.publishDate && D(t.publishDate)!.getDay() === 5).map((t) => `${nm(t.companyId)} ${t.type}#${t.pieceNo} ${L(t.publishDate)}`),
);
check(
  "إنتاج مجدول على جمعة أو سبت",
  content
    .filter((t) => t.stage && t.stage !== "PUBLISH" && !isDone(t) && t.workDate && [5, 6].includes(D(t.workDate)!.getDay()))
    .map((t) => `${nm(t.companyId)} ${t.type}#${t.pieceNo} ${t.stage} ${L(t.workDate)}`),
);
check(
  "إنتاج يومه بعد يوم النشر",
  content
    .filter((t) => t.stage && t.stage !== "PUBLISH" && !isDone(t) && t.workDate && t.publishDate && D(t.workDate)! > D(t.publishDate)!)
    .map((t) => `${nm(t.companyId)} ${t.type}#${t.pieceNo} ${t.stage} شغل ${L(t.workDate)} نشر ${L(t.publishDate)}`),
);
check(
  "تاريخ نشر القطعة بيختلف بين مراحلها",
  (() => {
    const g = new Map<string, Map<string, string>>();
    for (const t of content.filter((x) => x.pieceNo && x.publishDate && !isDone(x))) {
      const k = `${nm(t.companyId)} ${t.year}-${t.month} ${t.type}#${t.pieceNo}`;
      const m = g.get(k) ?? new Map<string, string>();
      m.set(String(t.stage), L(t.publishDate));
      g.set(k, m);
    }
    return [...g]
      .filter(([, m]) => new Set(m.values()).size > 1)
      .map(([k, m]) => `${k}: ${[...m].map(([a, b]) => `${a}=${b}`).join(" · ")}`);
  })(),
);
check(
  "يوم الشغل بعد موعد الجهوزية (كرت مو مثبّت)",
  live.filter((t) => !t.isPinned && t.workDate && t.readyDate && D(t.workDate)! > D(t.readyDate)!).map((t) => `${nm(t.companyId)} ${t.stage} ${L(t.workDate)} > ${L(t.readyDate)}`),
);

console.log("\n── ٣· الطوابع والحالة ──");
check("خلص قبل ما يبلّش", live.filter((t) => t.startedAt && t.finishedAt && D(t.finishedAt)! < D(t.startedAt)!).map((t) => t.id));
check("منجز بلا تاريخ إنجاز", live.filter((t) => t.board === "DONE" && !t.finishedAt).map((t) => t.id));
check("منجز بلا طابع بداية", live.filter((t) => t.finishedAt && !t.startedAt && !String(t.id).startsWith("jun_x_")).map((t) => t.id));
check("على لوح DONE وحالته مو منجزة", live.filter((t) => t.board === "DONE" && !DONE_STATUSES.includes(t.status)).map((t) => `${t.id} ${t.status}`));
check("حالته منجزة ومو على لوح DONE", live.filter((t) => t.board !== "DONE" && DONE_STATUSES.includes(t.status)).map((t) => `${t.id} ${t.status}/${t.board}`));
check("ملغى ومو مثبّت (التوليد بيرجّعه)", tasks.filter((t) => t.status === "CANCELED" && t.isAuto && !t.isPinned).map((t) => t.id));

console.log("\n── ٤· منطق النشر والإنتاج ──");
check(
  "منشور وإنتاجه لسا مفتوح",
  (() => {
    const out: string[] = [];
    const byKey = new Map<string, T[]>();
    for (const t of live.filter((x) => x.pipelineKey)) byKey.set(t.pipelineKey, [...(byKey.get(t.pipelineKey) ?? []), t]);
    for (const rows of byKey.values()) {
      const pub = rows.find((r) => r.stage === "PUBLISH");
      if (pub?.status !== "PUBLISHED") continue;
      for (const r of rows) if (r.stage !== "PUBLISH" && !isDone(r)) out.push(`${nm(r.companyId)} ${r.type}#${r.pieceNo} ${r.stage}`);
    }
    return out;
  })(),
);
check(
  "إقفال نشر بلا دليل (تموز وبعده)",
  live.filter((t) => t.stage === "PUBLISH" && t.board === "DONE" && t.year === 2026 && t.month >= 6 && !String(t.notes ?? "").trim()).map((t) => `${nm(t.companyId)} ${t.type}#${t.pieceNo}`),
);
check("كرت محتوى مولّد بلا رقم قطعة", content.filter((t) => t.isAuto && !t.pieceNo).map((t) => `${nm(t.companyId)} ${t.type} ${t.stage}`));
check(
  "اسم ملف واحد على قطعتين مختلفتين",
  (() => {
    const g = new Map<string, Set<string>>();
    for (const t of content.filter((x) => x.pieceNo)) {
      const a = assetNameForTask(co.get(t.companyId) as any, t as any);
      if (!a) continue;
      g.set(a, (g.get(a) ?? new Set()).add(`${t.type}#${t.pieceNo}|${t.year}-${t.month}`));
    }
    return [...g].filter(([, v]) => v.size > 1).map(([k, v]) => `${k} → ${[...v].join("  و  ")}`);
  })(),
);
check("كرت محتوى مفتوح بلا مسؤول", live.filter((t) => !isDone(t) && !t.assigneeId && t.kind === "CONTENT").map((t) => `${nm(t.companyId)} ${t.type}#${t.pieceNo} ${t.stage}`));

console.log("\n── ٥· الطاقة اليومية ──");
const rateOf = (e: T, key: string): number | null => {
  try {
    const r = JSON.parse(e.rates ?? "{}");
    return r[key] ?? null;
  } catch {
    return null;
  }
};
const loads = new Map<string, T[]>();
for (const t of live.filter((x) => x.kind === "CONTENT" && !isDone(x) && x.workDate && x.assigneeId && x.stage !== "PUBLISH")) {
  const k = `${t.assigneeId}|${L(t.workDate)}`;
  loads.set(k, [...(loads.get(k) ?? []), t]);
}
const over: string[] = [];
for (const [k, rows] of loads) {
  const [id, day] = k.split("|");
  const e = em.get(id);
  if (!e) continue;
  let used = 0;
  for (const t of rows) {
    const key = t.stage === "EDIT" || t.stage === "SHOOT" ? "REEL" : String(t.type);
    const rate = rateOf(e, key) ?? (t.stage === "EDIT" ? 3 : 6);
    used += 1 / rate;
  }
  if (used > 1.001) over.push(`${e.name} ${day}: ${rows.length} كرت = ${used.toFixed(2)} يوم`);
}
check("يوم شخص تجاوز طاقته", over.sort());

console.log(`\n${failed === 0 ? "✓ كل الفحوص نظيفة" : `✗ ${failed} فحص طلع فيه خلل`}`);
