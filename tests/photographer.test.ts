import { describe, expect, it } from "vitest";
import { buildPhotoSessions, type ReelTask } from "@/lib/photographer";

/**
 * جدولة التصوير كانت بلا ولا اختبار — وهي يلي بتحدد أيام ماجد وبتغذّي كرت
 * التصوير بتاريخه، وبعده المونتاج والنشر. أي خلل فيها بيمشي بصمت لآخر السلسلة.
 */
const WORK = [6, 0, 1, 2, 3]; // السبت→الأربعاء (ولا تصوير خميس/جمعة)
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const reel = (co: string, n: number, day: number): ReelTask => ({
  detKey: `${co}-reel-${n}`,
  companyId: co,
  publishDate: new Date(2026, 7, day),
});

const co = (id: string, reels: ReelTask[], extra: Record<string, unknown> = {}) => ({
  companyId: id,
  companyName: id,
  reels,
  ...extra,
});

describe("جدولة جلسات التصوير", () => {
  it("ولا جلسة بتوقع بيوم مو يوم دوام المصوّر", () => {
    const r = buildPhotoSessions(2026, 7, [co("a", [reel("a", 1, 10), reel("a", 2, 14), reel("a", 3, 20)])], WORK);
    expect(r.sessions.length).toBeGreaterThan(0);
    for (const s of r.sessions) expect(WORK).toContain(s.shootDate.getDay());
  });

  it("التسليم ما بيسبق التصوير أبداً", () => {
    const r = buildPhotoSessions(2026, 7, [co("a", [reel("a", 1, 10), reel("a", 2, 18)])], WORK);
    for (const s of r.sessions) expect(s.deliverBy.getTime()).toBeGreaterThanOrEqual(s.shootDate.getTime());
  });

  it("كل ريل بياخد موعد تصوير وتسليم", () => {
    const reels = [reel("a", 1, 8), reel("a", 2, 12), reel("a", 3, 16), reel("a", 4, 20)];
    const r = buildPhotoSessions(2026, 7, [co("a", reels)], WORK);
    for (const x of reels) {
      const d = r.reelDates.get(x.detKey);
      expect(d, `${x.detKey} بلا موعد`).toBeDefined();
      expect(d!.deliverBy.getTime()).toBeGreaterThanOrEqual(d!.shootDate.getTime());
    }
  });

  it("التصوير بيسبق موعد النشر", () => {
    const reels = [reel("a", 1, 12), reel("a", 2, 18), reel("a", 3, 24)];
    const r = buildPhotoSessions(2026, 7, [co("a", reels)], WORK);
    for (const x of reels) {
      const d = r.reelDates.get(x.detKey)!;
      expect(d.shootDate.getTime()).toBeLessThan(x.publishDate.getTime());
    }
  });

  it("مصوّر واحد ما بيصوّر شركتين بنفس اليوم", () => {
    const r = buildPhotoSessions(
      2026,
      7,
      [
        co("a", [reel("a", 1, 10), reel("a", 2, 14)]),
        co("b", [reel("b", 1, 10), reel("b", 2, 14)]),
        co("c", [reel("c", 1, 11), reel("c", 2, 15)]),
      ],
      WORK,
    );
    const days = r.sessions.filter((s) => s.kind === "REELS").map((s) => iso(s.shootDate));
    expect(new Set(days).size).toBe(days.length);
  });

  it("ولا تصوير ولا تسليم قبل بداية العقد", () => {
    const notBefore = new Date(2026, 7, 10);
    const r = buildPhotoSessions(
      2026,
      7,
      [co("new", [reel("new", 1, 16), reel("new", 2, 22)], { notBefore })],
      WORK,
    );
    for (const s of r.sessions) {
      expect(s.shootDate.getTime()).toBeGreaterThanOrEqual(notBefore.getTime());
      expect(s.deliverBy.getTime()).toBeGreaterThanOrEqual(notBefore.getTime());
    }
    for (const [, d] of r.reelDates)
      expect(d.shootDate.getTime()).toBeGreaterThanOrEqual(notBefore.getTime());
  });

  it("شركة بلا ريلات ما بتولّد ولا جلسة", () => {
    const r = buildPhotoSessions(2026, 7, [co("empty", [])], WORK);
    expect(r.sessions).toHaveLength(0);
    expect(r.reelDates.size).toBe(0);
  });

  it("حتمية — نفس المدخل بيعطي نفس المخرج", () => {
    const input = () => [co("a", [reel("a", 1, 10), reel("a", 2, 15), reel("a", 3, 21)])];
    const a = buildPhotoSessions(2026, 7, input(), WORK);
    const b = buildPhotoSessions(2026, 7, input(), WORK);
    expect(a.sessions.map((s) => `${s.detKey}|${iso(s.shootDate)}|${iso(s.deliverBy)}`)).toEqual(
      b.sessions.map((s) => `${s.detKey}|${iso(s.shootDate)}|${iso(s.deliverBy)}`),
    );
  });

  it("أرقام الجلسات متسلسلة لكل شركة", () => {
    const r = buildPhotoSessions(
      2026,
      7,
      [co("a", [reel("a", 1, 8), reel("a", 2, 12), reel("a", 3, 16), reel("a", 4, 20), reel("a", 5, 24)])],
      WORK,
    );
    const nos = r.sessions.filter((s) => s.companyId === "a").map((s) => s.no).sort((x, y) => x - y);
    expect(nos).toEqual(nos.map((_, i) => i + 1));
  });

  // الفوتوسشن جلسة تصوير بوستات وستوريز — `reelCount = 0` فيها صح، مو خلل.
  it("جلسة الريلات إلها ريل واحد عالأقل، والفوتوسشن صفر", () => {
    const r = buildPhotoSessions(2026, 7, [co("a", [reel("a", 1, 10), reel("a", 2, 20)])], WORK);
    for (const s of r.sessions) {
      if (s.kind === "REELS") expect(s.reelCount).toBeGreaterThan(0);
      else expect(s.reelCount).toBe(0);
    }
    expect(r.sessions.some((s) => s.kind === "REELS")).toBe(true);
  });

  it("مجموع ريلات الجلسات = عدد الريلات المطلوبة", () => {
    const reels = [reel("a", 1, 8), reel("a", 2, 12), reel("a", 3, 16), reel("a", 4, 22)];
    const r = buildPhotoSessions(2026, 7, [co("a", reels)], WORK);
    const total = r.sessions.filter((s) => s.kind === "REELS").reduce((a, s) => a + s.reelCount, 0);
    expect(total).toBe(reels.length);
  });
});
