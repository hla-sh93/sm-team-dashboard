import { describe, expect, it } from "vitest";
import { buildPhotoSessions, type ReelTask } from "@/lib/photographer";
import { shootWindow } from "@/lib/constants";

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

  // قرار القائدة (١/٩): القيد على **عدد** الريلات باليوم، مو على عدد الشركات.
  // «لما ما بيكون عنا شي رح يتأخر، عادي يكونوا لشركة وحدة.» فشركتين بنفس اليوم
  // مسموحة ما دام المجموع ضمن سقف المصوّر.
  it("شركتين بنفس يوم التصوير مسموحة ما دام العدد ضمن السقف", () => {
    const r = buildPhotoSessions(
      2026,
      7,
      [
        co("a", [reel("a", 1, 10), reel("a", 2, 14)]),
        co("b", [reel("b", 1, 10), reel("b", 2, 14)]),
        co("c", [reel("c", 1, 11), reel("c", 2, 15)]),
      ],
      WORK,
      6,
    );
    const reelSessions = r.sessions.filter((s) => s.kind === "REELS");
    const perDay = new Map<string, number>();
    for (const s of reelSessions) {
      const k = iso(s.shootDate);
      perDay.set(k, (perDay.get(k) ?? 0) + s.reelCount);
    }
    // في يوم واحد على الأقل بيجمع أكتر من شركة — القيد القديم كان بيمنعها.
    expect(reelSessions.length).toBeGreaterThan(perDay.size);
    // وما في يوم بيتجاوز السقف.
    for (const count of perDay.values()) expect(count).toBeLessThanOrEqual(6);
  });

  it("ما بيتجاوز سقف المصوّر اليومي بالعدد", () => {
    const r = buildPhotoSessions(
      2026,
      7,
      [
        co("a", [reel("a", 1, 12), reel("a", 2, 12), reel("a", 3, 12)]),
        co("b", [reel("b", 1, 12), reel("b", 2, 12), reel("b", 3, 12)]),
        co("c", [reel("c", 1, 12), reel("c", 2, 12), reel("c", 3, 12)]),
      ],
      WORK,
      3,
    );
    const perDay = new Map<string, number>();
    for (const s of r.sessions.filter((x) => x.kind === "REELS")) {
      const k = iso(s.shootDate);
      perDay.set(k, (perDay.get(k) ?? 0) + s.reelCount);
    }
    for (const count of perDay.values()) expect(count).toBeLessThanOrEqual(3);
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

// القائدة ١٨/١٠: «خلينا نصور 3 باليوم حد أدنى (لكل الشركات) يعني عبي يوم المصورة
// كـ 3 باليوم في حال وجود محتوى» — «منكمّل من شركة تانية». يوم فيه أقل من ٣ بينضمّ
// ليوم تصوير تاني (أي شركة) ضمن نافذة الريل، بلا ما يكسر السقف أو يرجع لقبل اليوم.
describe("يوم المصوّرة ٣ ريلات حد أدنى", () => {
  const reelsPerDay = (r: ReturnType<typeof buildPhotoSessions>) => {
    const m = new Map<string, number>();
    for (const s of r.sessions.filter((x) => x.kind === "REELS")) m.set(iso(s.shootDate), (m.get(iso(s.shootDate)) ?? 0) + s.reelCount);
    return m;
  };
  const near = () => [co("a", [reel("a", 1, 12), reel("a", 2, 14)]), co("b", [reel("b", 1, 15), reel("b", 2, 17)])];

  it("شركتين بريلين ريلين قراب من بعض → يوم واحد فيه ٤", () => {
    const days = reelsPerDay(buildPhotoSessions(2026, 7, near(), WORK));
    expect([...days.values()]).toEqual([4]);
  });

  it("الضمّ ما بيأخّر تصوير ريل لبعد نافذته (قبل المونتاج بيومين)", () => {
    const r = buildPhotoSessions(2026, 7, near(), WORK);
    for (const x of near().flatMap((c) => c.reels)) {
      const d = r.reelDates.get(x.detKey)!;
      const latest = shootWindow(x.publishDate).latest;
      expect(d.shootDate.getTime(), x.detKey).toBeLessThanOrEqual(latest.getTime());
    }
  });

  it("يوم فيه ٣ ما بينفرط، والريل الوحيد القريب بينضمّله", () => {
    const r = buildPhotoSessions(2026, 7, [co("a", [reel("a", 1, 12), reel("a", 2, 13), reel("a", 3, 14)]), co("b", [reel("b", 1, 16)])], WORK);
    expect([...reelsPerDay(r).values()]).toEqual([4]);
  });

  it("ما بيتخطّى سقف المصوّر: سقف ٣ → ريلين وريلين بيضلّوا بيومين", () => {
    const days = reelsPerDay(buildPhotoSessions(2026, 7, near(), WORK, 3));
    expect([...days.values()]).toEqual([2, 2]);
  });

  it("أيام بعيدة (أكتر من ١٠ أيام) ما بتنضمّ — بلا محتوى قريب اليوم بيضل متل ما هو", () => {
    const r = buildPhotoSessions(2026, 7, [co("a", [reel("a", 1, 8), reel("a", 2, 9)]), co("b", [reel("b", 1, 28), reel("b", 2, 29)])], WORK);
    expect([...reelsPerDay(r).values()]).toEqual([2, 2]);
  });

  it("ما بيرجّع نزلة لقبل اليوم، وما بيحرّك نزلة مرق يومها", () => {
    const withToday = buildPhotoSessions(2026, 7, near(), WORK, 6, undefined, undefined, new Date(2026, 7, 9));
    expect([...reelsPerDay(withToday).entries()]).toEqual([["2026-08-05", 2], ["2026-08-10", 2]]);
  });

  it("ولا لأقرب من مهلة طلب الموعد (يومين من اليوم)", () => {
    // اليوم ١/٨ → المهلة لـ٣/٨: يوم ٥/٨ بيستقبل. اليوم ٤/٨ → ٥/٨ بكرا، أقرب من المهلة: ما بيستقبل.
    const early = buildPhotoSessions(2026, 7, near(), WORK, 6, undefined, undefined, new Date(2026, 7, 1));
    expect([...reelsPerDay(early).values()]).toEqual([4]);
    const late = buildPhotoSessions(2026, 7, near(), WORK, 6, undefined, undefined, new Date(2026, 7, 4));
    expect([...reelsPerDay(late).entries()]).toEqual([["2026-08-05", 2], ["2026-08-10", 2]]);
  });

  it("«في حال وجود محتوى»: شركة سكريبتاتها مو مكتوبة نزلاتها ما بتتقدّم — بس يومها بيستقبل غيرها", () => {
    const [a, b] = near();
    const bNoScript = buildPhotoSessions(2026, 7, [a, { ...b, scriptsReady: false }], WORK);
    expect([...reelsPerDay(bNoScript).entries()]).toEqual([["2026-08-05", 2], ["2026-08-10", 2]]);
    const aNoScript = buildPhotoSessions(2026, 7, [{ ...a, scriptsReady: false }, b], WORK);
    expect([...reelsPerDay(aNoScript).values()]).toEqual([4]);
  });

  it("ولا قبل بداية العقد", () => {
    const r = buildPhotoSessions(2026, 7, [near()[0], { ...near()[1], notBefore: new Date(2026, 7, 10) }], WORK);
    const b = r.sessions.find((s) => s.companyId === "b" && s.kind === "REELS")!;
    expect(b.shootDate.getTime()).toBeGreaterThanOrEqual(new Date(2026, 7, 10).getTime());
  });

  it("يوم محجوز بدلو تاني بيعبّي كمان (يوم المصوّرة مو يوم الدورة)", () => {
    const r = buildPhotoSessions(2026, 7, [co("a", [reel("a", 1, 15), reel("a", 2, 17)])], WORK, 6, undefined, new Map([["2026-08-10", 2]]));
    expect(iso(r.sessions.find((s) => s.kind === "REELS")!.shootDate)).toBe("2026-08-10");
  });

  it("نزلتين لنفس الشركة بنفس اليوم = جلسة وحدة، والأرقام متسلسلة", () => {
    const r = buildPhotoSessions(2026, 7, [co("a", [reel("a", 1, 12), reel("a", 2, 14), reel("a", 3, 17), reel("a", 4, 19)])], WORK);
    const reels = r.sessions.filter((s) => s.kind === "REELS");
    expect(reels.map((s) => s.reelCount)).toEqual([4]);
    expect(r.sessions.map((s) => s.no)).toEqual([1, 2]);
    expect(reels[0].detKey).toBe(`a|REELS|${iso(reels[0].shootDate)}|2`);
  });
});
