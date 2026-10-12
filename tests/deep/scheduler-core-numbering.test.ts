/**
 * ترقيم القطع (`expandPipeline` §4): لكل (شركة، نوع) 1..N بترتيب يوم النشر
 * ثم المفتاح، بلا فجوات ولا تكرار، نفس الرقم على كل مراحل القطعة، والكتابة
 * بلا رقم. وثبات الرقم عند إزاحة موحّدة؛ وتبدّله عند إعادة الترتيب (موثَّق).
 */
import { describe, expect, it } from "vitest";
import { expandPipeline, type PipelineContentItem } from "@/lib/pipeline";
import { mulberry32 } from "./scheduler-core-fixture";

const WD = [0, 1, 2, 3, 4];
const opts = () => ({
  writerId: "e_nawal",
  publisherId: "e_omar",
  editorId: "e_alisar",
  editorWorkDays: WD,
  year: 2026,
  month: 9,
  companyName: (id: string) => id,
  writerWorkDays: WD,
  publisherWorkDays: WD,
});
const day = (d: number) => `2026-10-${String(d).padStart(2, "0")}`;

function genItems(seed: number): PipelineContentItem[] {
  const rng = mulberry32(seed);
  const items: PipelineContentItem[] = [];
  for (const co of ["c_a", "c_b", "c_c"].slice(0, rng.int(1, 3))) {
    for (const type of ["POST", "REEL", "AI_REEL", "STORY"] as const) {
      const n = rng.int(0, 7);
      for (let i = 0; i < n; i++) {
        const d = rng.int(1, 28);
        const pub = rng.chance(0.1) ? null : day(d);
        items.push({ id: `${co}|${type}|${i}`, companyId: co, type, assigneeId: type === "REEL" ? "e_majed" : "e_ayman", publishDate: pub, readyDate: pub ? day(Math.max(1, d - 2)) : null, workDate: pub ? day(Math.max(1, d - 2)) : null, week: 1, status: "NOT_STARTED" });
      }
    }
  }
  return items;
}

describe("ترقيم القطع — خصائص على 200 بذرة", () => {
  const CASES = Array.from({ length: 200 }, (_, i) => ({ seed: i + 1, items: genItems(i + 1) })).map((c) => ({ ...c, out: expandPipeline(c.items, opts()) }));

  it("كرت الكتابة بلا رقم، وكل مراحل القطعة الواحدة بنفس الرقم", () => {
    const bad: string[] = [];
    for (const { seed, out } of CASES) {
      for (const t of out) if (t.stage === "WRITE" && t.pieceNo != null) bad.push(`seed ${seed}: كتابة برقم`);
      const byPk = new Map<string, Set<number | null | undefined>>();
      for (const t of out) if (t.stage !== "WRITE" && t.pipelineKey) byPk.set(t.pipelineKey, new Set([...(byPk.get(t.pipelineKey) ?? []), t.pieceNo]));
      for (const [pk, s] of byPk) if (s.size !== 1) bad.push(`seed ${seed}: ${pk} أرقام ${[...s]}`);
    }
    expect(bad).toEqual([]);
  });

  it("لكل (شركة، نوع): 1..N بلا فجوة ولا تكرار، مرتّبة بيوم النشر ثم المفتاح، والبلا تاريخ آخر الكل", () => {
    const bad: string[] = [];
    for (const { seed, out } of CASES) {
      const groups = new Map<string, { pk: string; no: number; pub: string | null }[]>();
      for (const t of out) {
        if (t.stage !== "PUBLISH" || !t.pipelineKey) continue;
        const g = groups.get(`${t.companyId}|${t.type}`) ?? [];
        g.push({ pk: t.pipelineKey, no: t.pieceNo!, pub: t.publishDate });
        groups.set(`${t.companyId}|${t.type}`, g);
      }
      for (const [k, g] of groups) {
        const nos = g.map((x) => x.no).sort((a, b) => a - b);
        if (nos.some((n, i) => n !== i + 1)) bad.push(`seed ${seed}: ${k} ${nos}`);
        const sorted = [...g].sort((a, b) => (a.pub ?? "9999").localeCompare(b.pub ?? "9999") || a.pk.localeCompare(b.pk));
        if (sorted.some((x, i) => x.no !== i + 1)) bad.push(`seed ${seed}: ${k} الترتيب`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("مراحل القطعة: ريل = تصوير + مونتاج + نشر؛ غير الريل = تصميم + نشر", () => {
    const bad: string[] = [];
    for (const { seed, out } of CASES) {
      const pks = new Set(out.filter((t) => t.stage !== "WRITE" && t.pipelineKey).map((t) => t.pipelineKey!));
      for (const pk of pks) {
        const stages = out.filter((t) => t.pipelineKey === pk && t.stage !== "WRITE").map((t) => t.stage).sort().join(",");
        const type = out.find((t) => t.pipelineKey === pk)!.type;
        const want = type === "REEL" ? "EDIT,PUBLISH,SHOOT" : "DESIGN,PUBLISH";
        if (stages !== want) bad.push(`seed ${seed}: ${pk} ${stages}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("إزاحة موحّدة لكل مواعيد النشر (+٣ أيام) ما بتغيّر ولا رقم", () => {
    const bad: string[] = [];
    for (const { seed, items, out } of CASES) {
      const shifted = items.map((it) => ({ ...it, publishDate: it.publishDate ? day(Number(it.publishDate.slice(8)) + 3) : null }));
      const out2 = expandPipeline(shifted, opts());
      const n1 = new Map(out.filter((t) => t.stage === "PUBLISH").map((t) => [t.pipelineKey!, t.pieceNo]));
      const n2 = new Map(out2.filter((t) => t.stage === "PUBLISH").map((t) => [t.pipelineKey!, t.pieceNo]));
      for (const [pk, n] of n1) if (n2.get(pk) !== n) bad.push(`seed ${seed}: ${pk} ${n}→${n2.get(pk)}`);
    }
    expect(bad).toEqual([]);
  });

  it("[موثَّق SC-09] إعادة تأريخ بتقلب ترتيب قطعتين بتبدّل رقميهما — الرقم هوية بالترتيب لا بالمفتاح (حادثة إعادة الترقيم ٤/١٠)", () => {
    const items: PipelineContentItem[] = [
      { id: "k1", companyId: "c", type: "POST", assigneeId: "e_ayman", publishDate: "2026-10-05", readyDate: "2026-10-03", workDate: "2026-10-03", week: 1, status: "NOT_STARTED" },
      { id: "k2", companyId: "c", type: "POST", assigneeId: "e_ayman", publishDate: "2026-10-12", readyDate: "2026-10-10", workDate: "2026-10-10", week: 2, status: "NOT_STARTED" },
    ];
    const no = (its: PipelineContentItem[]) => Object.fromEntries(expandPipeline(its, opts()).filter((t) => t.stage === "PUBLISH").map((t) => [t.pipelineKey, t.pieceNo]));
    expect(no(items)).toEqual({ k1: 1, k2: 2 });
    items[0].publishDate = "2026-10-20";
    expect(no(items)).toEqual({ k1: 2, k2: 1 });
  });

  it("قطع بلا يوم نشر (نشر مُلغى للشركة): بتاخد الأرقام الأخيرة بترتيب مفتاحها", () => {
    const items: PipelineContentItem[] = [
      { id: "z", companyId: "c", type: "STORY", assigneeId: "e_ayman", publishDate: null, readyDate: null, workDate: null, week: null, status: "NOT_STARTED" },
      { id: "a", companyId: "c", type: "STORY", assigneeId: "e_ayman", publishDate: null, readyDate: null, workDate: null, week: null, status: "NOT_STARTED" },
      { id: "m", companyId: "c", type: "STORY", assigneeId: "e_ayman", publishDate: "2026-10-30", readyDate: "2026-10-28", workDate: "2026-10-28", week: 4, status: "NOT_STARTED" },
    ];
    const out = expandPipeline(items, { ...opts(), skipPublishForCompany: () => true });
    expect(out.filter((t) => t.stage === "PUBLISH")).toHaveLength(0);
    expect(Object.fromEntries(out.filter((t) => t.stage === "DESIGN").map((t) => [t.pipelineKey, t.pieceNo]))).toEqual({ m: 1, a: 2, z: 3 });
  });
});
