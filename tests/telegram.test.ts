import { STAGES } from "@/lib/constants";
import { readFileSync } from "node:fs";
/**
 * Telegram follow-up (§14) — naming, delivery matching and the morning brief.
 * All three modules are pure, so this suite needs no DB.
 */
import { describe, it, expect } from "vitest";
import {
  assetName,
  assetNameForTask,
  companySlug,
  parseAssetName,
  slugMatches,
} from "@/lib/asset-name";
import { matchDelivery, normalizeMessage, typeHintFrom, type Delivery } from "@/lib/telegram/match";
import { buildDailyBrief, briefMessagesFor } from "@/lib/telegram/brief";
import { splitForTelegram } from "@/lib/telegram/client";
import type { Company, Employee, Task } from "@/types";

const company = (over: Partial<Company> = {}): Company =>
  ({
    id: "co1",
    name: "أغاليا",
    managed: true,
    posts: 10,
    reels: 6,
    stories: 15,
    aiReels: 0,
    contractValue: 150,
    contractStartDate: null,
    renewals: null,
    contractEndedAt: null,
    preferredShootDay: null,
    contentSupplied: false,
    slug: "Agalia",
    telegramChatId: "-100123",
    color: "#fff",
    priority: 1,
    status: "active",
    postOwnerId: null,
    storyOwnerId: null,
    aiReelOwnerId: null,
    defaultOwnerId: null,
    photographerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }) as Company;

const task = (over: Partial<Task> = {}): Task =>
  ({
    id: "t1",
    kind: "CONTENT",
    type: "REEL",
    title: null,
    hours: 0,
    quantity: 1,
    pieceNo: 1,
    priority: "NORMAL",
    status: "NOT_STARTED",
    publishDate: null,
    readyDate: null,
    workDate: null,
    manualDay: null,
    week: 1,
    overflow: false,
    month: 6, // July (0-based)
    year: 2026,
    isPinned: false,
    isAuto: true,
    stage: "SHOOT",
    board: "TODO",
    blockedById: null,
    pipelineKey: "co1|REEL|2026-07-10",
    detKey: null,
    notes: null,
    completedAt: null,
    startedAt: null,
    finishedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    companyId: "co1",
    assigneeId: "e1",
    ...over,
  }) as Task;

const employee = (over: Partial<Employee> = {}): Employee =>
  ({
    id: "e1",
    name: "ماجد",
    role: "مصور",
    hoursPerDay: 8,
    workDays: "[6,0,1,2,3]",
    isScheduled: true,
    isPhotographer: true,
    salary: 300,
    costPerReel: null,
    color: null,
    rates: '{"REEL":2}',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }) as Employee;

const delivery = (over: Partial<Delivery> = {}): Delivery => ({
  id: "-100123:5",
  chatId: "-100123",
  messageId: 5,
  sentAt: new Date(2026, 6, 10, 14, 0),
  senderId: "9",
  senderName: "Elissar",
  kind: "VIDEO",
  fileName: null,
  caption: null,
  fileId: "f1",
  mediaGroupId: null,
  ...over,
});

describe("asset name «Agalia 7-1»", () => {
  it("builds <slug> <month>-<piece> with a 1-based month", () => {
    expect(assetName("Agalia", 6, 1)).toBe("Agalia 7-1");
    expect(assetNameForTask(company(), task({ pieceNo: 3 }))).toBe("Agalia 7-3");
  });

  it("falls back to the known latin name when no slug is stored", () => {
    expect(companySlug({ name: "وصل للتداول", slug: null })).toBe("Wasl");
    expect(companySlug({ name: "أغاليا", slug: "Custom" })).toBe("Custom");
  });

  it("returns null for work with no deliverable piece", () => {
    expect(assetNameForTask(company(), task({ type: null, stage: "WRITE" }))).toBeNull();
    expect(assetNameForTask(company(), task({ pieceNo: null }))).toBeNull();
  });

  it("parses the name back out of a file name, best reading first", () => {
    const p = parseAssetName("Agalia 7-1.mp4")!;
    expect(p.slug).toBe("Agalia");
    expect(p.readings[0]).toEqual({ month0: 6, pieceNo: 1 });
  });

  it("keeps the OLD piece-first order as a fallback reading", () => {
    // "Agalya 3-7" is ambiguous: month 3 piece 7, or piece 3 month 7. Both are
    // offered so the matcher can pick whichever names a real piece.
    const p = parseAssetName("Agalya 3-7.mp4")!;
    expect(p.readings).toEqual([
      { month0: 2, pieceNo: 7 },
      { month0: 6, pieceNo: 3 },
    ]);
  });

  it("reads `r<N>` with a spelled-out month", () => {
    const p = parseAssetName("balsam r2 julyy.mp4")!;
    expect(p.slug).toBe("balsam");
    expect(p.readings).toContainEqual({ month0: 6, pieceNo: 2 });
  });

  it("ignores text with no numbering", () => {
    expect(parseAssetName("عملتك تاغ")).toBeNull();
    expect(parseAssetName(null)).toBeNull();
  });

  it("tolerates one typo in the company name but never confuses short ones", () => {
    expect(slugMatches("Agalya", "Agalia")).toBe(true); // substitution
    expect(slugMatches("blasam", "Balsam")).toBe(true); // transposition
    expect(slugMatches("Bru", "BW")).toBe(false); // short names stay strict
    expect(slugMatches("Jobs", "Bru")).toBe(false);
  });
});

describe("delivery matching", () => {
  const reel1 = task({ id: "r1", type: "REEL", pieceNo: 1, readyDate: new Date(2026, 6, 12) });
  const reel2 = task({ id: "r2", type: "REEL", pieceNo: 2, readyDate: new Date(2026, 6, 8) });
  const post3 = task({ id: "p3", type: "POST", pieceNo: 3, stage: "DESIGN", readyDate: new Date(2026, 6, 9) });

  it("matches by canonical name regardless of media type ordering", () => {
    const res = matchDelivery(delivery({ fileName: "Agalia 7-1.mp4" }), "Agalia", [reel1, reel2, post3]);
    expect(res).toEqual({ taskId: "r1", by: "NAME" });
  });

  it("picks the reel, not the story, when both carry the named number", () => {
    const story1 = task({ id: "s1", type: "STORY", pieceNo: 1, stage: "DESIGN" });
    const reel1 = task({ id: "r1", type: "REEL", pieceNo: 1, stage: "SHOOT" });
    expect(matchDelivery(delivery({ fileName: "Bru1-7.mp4" }), "Bru", [story1, reel1])).toEqual({
      taskId: "r1",
      by: "NAME",
    });
  });

  it("stops instead of sliding to another piece when the named one is closed", () => {
    // ريل-1 is already done, so «Bru1-7.mp4» is a re-send of it — never ريل-2.
    // This is what keeps five carousel slides from closing five posts.
    const story1 = task({ id: "s1", type: "STORY", pieceNo: 1, stage: "DESIGN" });
    const reel2 = task({ id: "r2", type: "REEL", pieceNo: 2, readyDate: new Date(2026, 6, 20) });
    expect(
      matchDelivery(delivery({ fileName: "Bru1-7.mp4" }), "Bru", [story1, reel2]),
    ).toBeNull();
  });

  it("gives every slide of a carousel the SAME post", () => {
    const post2 = task({ id: "p2", type: "POST", pieceNo: 2, month: 7, stage: "DESIGN" });
    const post3 = task({ id: "p3", type: "POST", pieceNo: 3, month: 7, stage: "DESIGN" });
    const slide = (n: string) =>
      matchDelivery(
        delivery({ kind: "PHOTO", fileName: `al balsam-carousel ${n} -8-2.jpg` }),
        "Balsam",
        [post2, post3],
      );
    expect(slide("01")).toEqual({ taskId: "p2", by: "NAME" });
    expect(slide("05")).toEqual({ taskId: "p2", by: "NAME" });
    // …and the next file is its own piece.
    expect(
      matchDelivery(
        delivery({ kind: "PHOTO", fileName: "al balsam-post -8-3.jpg" }),
        "Balsam",
        [post2, post3],
      ),
    ).toEqual({ taskId: "p3", by: "NAME" });
  });

  it("ignores a name that belongs to another company", () => {
    const res = matchDelivery(delivery({ fileName: "Wasl 7-1.mp4" }), "Agalia", [reel1, reel2]);
    // Falls through to the type rule → earliest open reel.
    expect(res).toEqual({ taskId: "r2", by: "TYPE" });
  });

  it("matches a video to the most urgent open reel when unnamed", () => {
    expect(matchDelivery(delivery(), "Agalia", [reel1, reel2, post3])).toEqual({
      taskId: "r2",
      by: "TYPE",
    });
  });

  it("matches a photo to a post, never to a reel", () => {
    expect(matchDelivery(delivery({ kind: "PHOTO" }), "Agalia", [reel1, reel2, post3])).toEqual({
      taskId: "p3",
      by: "TYPE",
    });
  });

  it("reads the piece type out of the file name the team already writes", () => {
    expect(typeHintFrom("POST صرف تركيا.jpg")).toBe("POST");
    expect(typeHintFrom("STORY صرف سوريا.jpg")).toBe("STORY");
    expect(typeHintFrom("مخبر تحليل cbc July 3rd reel.mp4")).toBe("REEL");
    expect(typeHintFrom(null, "كاروسيل الأسئلة")).toBe("POST");
    expect(typeHintFrom("عروض الليزر.jpg")).toBeNull();
  });

  it("uses the name's type word to pick a story over a post", () => {
    const post = task({ id: "p", type: "POST", stage: "DESIGN", readyDate: new Date(2026, 6, 5) });
    const story = task({ id: "s", type: "STORY", stage: "DESIGN", readyDate: new Date(2026, 6, 9) });
    // Earliest deadline alone would pick the post; the name says otherwise.
    expect(
      matchDelivery(delivery({ kind: "PHOTO", fileName: "STORY صرف سوريا.jpg" }), "Agalia", [post, story]),
    ).toEqual({ taskId: "s", by: "TYPE" });
  });

  it("never lets a type word in a document name close a piece", () => {
    const post = task({ id: "p", type: "POST", stage: "DESIGN" });
    expect(
      matchDelivery(
        delivery({ kind: "DOCUMENT", fileName: "خطة بوستات تموز.docx" }),
        "Agalia",
        [post],
      ),
    ).toBeNull();
  });

  it("matches by the plan's own words when the file name is unhelpful", () => {
    const planned = task({
      id: "p1",
      type: "POST",
      stage: "DESIGN",
      brief: "خبر عاجل (من الشركة)\nنص التصميم: تغطية الخبر فور وروده",
    });
    const other = task({ id: "p2", type: "POST", stage: "DESIGN", brief: "أكاديمية وصل للتعليم" });
    expect(
      matchDelivery(delivery({ kind: "PHOTO", fileName: "POST خبر عاجل3.jpg" }), "Wasl", [
        other,
        planned,
      ]),
    ).toEqual({ taskId: "p1", by: "BRIEF" });
  });

  it("refuses to guess once the plan text exists — extras stay unmatched", () => {
    // The client sends more breaking-news images than the plan covers; the
    // surplus must NOT be forced onto an unrelated planned post.
    const unrelated = task({ id: "p2", type: "POST", stage: "DESIGN", brief: "أكاديمية وصل للتعليم" });
    expect(
      matchDelivery(delivery({ kind: "PHOTO", fileName: "POST خبر عاجل9.jpg" }), "Wasl", [unrelated]),
    ).toBeNull();
  });

  it("still guesses by type for a company with no plan text", () => {
    const bare = task({ id: "p3", type: "POST", stage: "DESIGN", brief: null });
    expect(
      matchDelivery(delivery({ kind: "PHOTO", fileName: "شي.jpg" }), "Wasl", [bare]),
    ).toEqual({ taskId: "p3", by: "TYPE" });
  });

  it("never matches plain text or an unmatchable document", () => {
    expect(matchDelivery(delivery({ kind: "TEXT" }), "Agalia", [reel1])).toBeNull();
    expect(matchDelivery(delivery({ kind: "DOCUMENT" }), "Agalia", [reel1])).toBeNull();
  });

  it("returns null when the company has no open production work", () => {
    expect(matchDelivery(delivery(), "Agalia", [])).toBeNull();
  });

  it("treats an .mp4 sent as a document as a video", () => {
    const d = normalizeMessage({
      message_id: 7,
      date: 1_780_000_000,
      chat: { id: -100123, type: "supergroup", title: "أغاليا" },
      document: { file_id: "x", file_name: "Agalia 7-2.mp4", mime_type: "video/mp4" },
    });
    expect(d.kind).toBe("VIDEO");
    expect(d.fileName).toBe("Agalia 7-2.mp4");
  });
});

describe("morning brief", () => {
  const today = new Date(2026, 6, 10); // Friday 10 July 2026
  const base = {
    today,
    companies: [company()],
    employees: [employee()],
  };

  it("lists what publishes today per company, with the responsible person", () => {
    const publish = task({
      id: "pub",
      stage: "PUBLISH",
      pieceNo: 3,
      publishDate: today,
      assigneeId: "e1",
    });
    const brief = buildDailyBrief({ ...base, tasks: [publish] });
    expect(brief.companies).toHaveLength(1);
    expect(brief.companies[0].text).toContain("🚀 ينزل اليوم");
    expect(brief.companies[0].text).toContain("Agalia 7-3");
    expect(brief.companies[0].text).toContain("ماجد");
  });

  it("flags a piece publishing within two days whose production is still open", () => {
    const soon = new Date(2026, 6, 11);
    const production = task({ id: "prod", stage: "SHOOT", pipelineKey: "pk", readyDate: soon });
    const publish = task({
      id: "pub",
      stage: "PUBLISH",
      pipelineKey: "pk",
      publishDate: soon,
    });
    const brief = buildDailyBrief({ ...base, tasks: [production, publish] });
    expect(brief.lead.text).toContain("معرّض للتأخير");
    expect(brief.lead.text).toContain("الإنتاج لسا مفتوح");
  });

  it("says nothing is at risk when production is already closed", () => {
    const soon = new Date(2026, 6, 11);
    const done = task({
      id: "prod",
      stage: "SHOOT",
      pipelineKey: "pk",
      status: "READY",
      board: "DONE",
      finishedAt: today,
    });
    const publish = task({ id: "pub", stage: "PUBLISH", pipelineKey: "pk", publishDate: soon });
    const brief = buildDailyBrief({ ...base, tasks: [done, publish] });
    expect(brief.lead.text).toContain("ما في قطعة معرّضة للتأخير");
  });

  it("reports overdue work with the number of days late", () => {
    const late = task({ id: "late", readyDate: new Date(2026, 6, 7) });
    const brief = buildDailyBrief({ ...base, tasks: [late] });
    expect(brief.lead.text).toContain("متأخرات (1)");
    expect(brief.companies[0].text).toContain("متأخر 3 يوم");
  });

  it("produces no message for a company with nothing due", () => {
    const brief = buildDailyBrief({ ...base, tasks: [] });
    expect(brief.companies).toHaveLength(0);
  });

  it("never targets a client group — messages are keyed by company, not chat", () => {
    const publish = task({ id: "pub", stage: "PUBLISH", publishDate: today });
    const brief = buildDailyBrief({ ...base, tasks: [publish] });
    expect(brief.companies[0].key).toBe("co1");
    expect(JSON.stringify(brief)).not.toContain("-100123");
  });
});

/**
 * The 07:45 message is the one the lead forwards to the team group verbatim, so
 * it has to read like she wrote it: «صباح الخير» then one bare line per person
 * («أيمن ريلات جدارات»). Everything with a piece name, a date or a day-count in
 * it belongs to the 08:00 wave. These tests pin that boundary.
 */
describe("العام (07:45) — the message the lead forwards as-is", () => {
  const workday = new Date(2026, 6, 11); // Saturday — a work day for [6,0,1,2,3]
  const designer = employee({
    id: "d1",
    name: "أيمن",
    role: "designer",
    isPhotographer: false,
    rates: null,
  });
  const base = { today: workday, companies: [company()], employees: [designer] };

  it("opens with صباح الخير and carries no header emoji or date", () => {
    const brief = buildDailyBrief({ ...base, tasks: [] });
    expect(brief.schedule.text.split("\n")[0]).toBe("صباح الخير");
    expect(brief.schedule.text).not.toContain("🗓️");
    expect(brief.schedule.text).not.toContain("11/7");
  });

  it("writes «<اسم> <شغل> <شركة>» with no bullet and no colon", () => {
    const design = task({
      id: "d",
      stage: "DESIGN",
      type: "POST",
      readyDate: workday,
      workDate: workday,
      assigneeId: "d1",
    });
    const line = buildDailyBrief({ ...base, tasks: [design] }).schedule.text
      .split("\n")
      .find((l) => l.includes("أيمن"))!;
    // علامة RTL بأول السطر مقصودة: منشن لاتيني (Nawal، @Omar_ORR) كان بيقلب
    // اتجاه السطر بعرض تلغرام فيطلع «خطة مانغو Nawal» والاسم بالآخر.
    expect(line.startsWith("‏")).toBe(true);
    expect(line.replace(/‏/g, "")).toBe("أيمن تصاميم أغاليا");
  });

  it("كل سطر بيبلّش بعلامة RTL حتى يضل الاسم أول شي", () => {
    const design = task({
      id: "d",
      stage: "DESIGN",
      type: "POST",
      readyDate: workday,
      workDate: workday,
      assigneeId: "d1",
    });
    const lines = buildDailyBrief({ ...base, tasks: [design] })
      .schedule.text.split("\n")
      .filter((l: string) => l.trim() && l !== "صباح الخير");
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) expect(l.startsWith("‏")).toBe(true);
  });

  it("mentions the person by @handle when one is stored", () => {
    const withHandle = employee({ ...designer, telegramUsername: "Ayman_D" } as Partial<Employee>);
    const design = task({ id: "d", stage: "DESIGN", type: "POST", readyDate: workday, assigneeId: "d1" });
    const brief = buildDailyBrief({ ...base, employees: [withHandle], tasks: [design] });
    expect(brief.schedule.text).toContain("@Ayman_D تصاميم أغاليا");
  });

  // ماجد shoots THREE reels a day, so with more overdue reels than that, the
  // first three land in today's queue and the rest become the chase — the very
  // situation the lead writes «الريلات يلي خبرتني انن جاهزين ما بعتوهن» about.
  const photographer = employee({ rates: '{"REEL":3}' }); // ماجد
  const reels = (specs: { id: string; co: Company; day: number }[]) =>
    specs.map((s) =>
      task({
        id: s.id,
        stage: "SHOOT",
        type: "REEL",
        readyDate: new Date(2026, 6, s.day),
        companyId: s.co.id,
        assigneeId: "e1",
        pipelineKey: `${s.co.id}|REEL`,
      }),
    );
  const wasl = company({ id: "co2", name: "وصل", slug: "Wasl", telegramChatId: null });
  const bru = company({ id: "co3", name: "برو", slug: "Bru", telegramChatId: null });
  const jadarat = company({ id: "co4", name: "جدارات", slug: "Jadarat", telegramChatId: null });

  // Three وصل reels fill the shooting day; برو's is pushed out and chased.
  const overloadedDay = () =>
    reels([
      { id: "r1", co: wasl, day: 1 },
      { id: "r2", co: wasl, day: 1 },
      { id: "r3", co: wasl, day: 1 },
      { id: "r4", co: bru, day: 2 },
    ]);

  it("turns work it can't reach today into a bare chase clause", () => {
    const brief = buildDailyBrief({
      today: workday,
      companies: [company(), wasl, bru],
      employees: [photographer],
      tasks: overloadedDay(),
    });
    expect(brief.schedule.text).toContain("ماجد تصوير وصل، والمتأخر برو");
  });

  it("never puts piece names or day-counts in the general message", () => {
    const brief = buildDailyBrief({
      today: workday,
      companies: [company(), wasl, bru],
      employees: [photographer],
      tasks: overloadedDay(),
    });
    expect(brief.schedule.text).not.toMatch(/\d+-\d+/);
    expect(brief.schedule.text).not.toMatch(/\d+ يوم/);
    // …while the detailed wave still carries exactly that.
    expect(brief.employees[0].text).toMatch(/Bru 7-\d/);
    expect(brief.employees[0].text).toMatch(/متأخر \d+ يوم/);
  });

  it("caps the chase at two companies so one line can't become a wall", () => {
    const tasks = [
      ...overloadedDay(),
      ...reels([
        { id: "r5", co: jadarat, day: 3 },
        { id: "r6", co: company(), day: 4 },
      ]),
    ];
    const brief = buildDailyBrief({
      today: workday,
      companies: [company(), wasl, bru, jadarat],
      employees: [photographer],
      tasks,
    });
    const line = brief.schedule.text.split("\n").find((l) => l.includes("ماجد"))!;
    expect(line).toContain("وغيرها");
    expect(line.length).toBeLessThan(60);
  });

  it("drops a company whose delay is the client's fault, not ours", () => {
    const blocked = company({
      id: "co4",
      name: "جدارات",
      slug: "Jadarat",
      telegramChatId: null,
      lateExemptReason: "الزبون لسا ما أعطانا أكسس على الصفحة",
    });
    const tasks = reels([
      { id: "r1", co: wasl, day: 1 },
      { id: "r2", co: blocked, day: 1 }, // overdue, but not our fault
      { id: "r3", co: blocked, day: 11 }, // due today → its sheet is rendered
    ]);
    const brief = buildDailyBrief({
      today: workday,
      companies: [company(), wasl, blocked],
      employees: [photographer],
      tasks,
    });
    // Still real work that still has to be shot — it just never counts as late,
    // so it stays out of the chase clause and out of her overdue list.
    expect(brief.schedule.text).toContain("تصوير جدارات");
    expect(brief.schedule.text).not.toMatch(/المتأخر[^\n]*جدارات/);
    // Both reels are past due, but only وصل's is counted — جدارات's is the
    // client's hold-up, so it is absent from her overdue list entirely.
    expect(brief.lead.text).toContain("متأخرات (1)");
    expect(brief.lead.text).not.toContain("جدارات");
    // …and its own company sheet says why it shows nothing overdue.
    const sheet = brief.companies.find((c) => c.title === "جدارات");
    expect(sheet?.text).toContain("التأخير مو محسوب");
  });

  it("leaves idle people out of the group message but tells the lead privately", () => {
    const brief = buildDailyBrief({ ...base, tasks: [] });
    expect(brief.schedule.text).not.toContain("أيمن");
    expect(brief.lead.text).toContain("فاضي اليوم: أيمن");
  });

  it("gives the publisher his standing line without a piece count", () => {
    const publisher = employee({ id: "p1", name: "عمر", role: "publisher", isPhotographer: false, telegramUsername: "Omar_ORR" } as Partial<Employee>);
    const publish = task({ id: "pub", stage: "PUBLISH", publishDate: workday, assigneeId: "p1" });
    const brief = buildDailyBrief({ ...base, employees: [publisher], tasks: [publish] });
    expect(brief.schedule.text).toContain("@Omar_ORR متابعة الصفحات والنشر");
    expect(brief.schedule.text).not.toMatch(/\d+ قطعة/);
  });
});

describe("brief waves", () => {
  const brief = {
    schedule: { key: "schedule", title: "", text: "s" },
    detail: { key: "detail", title: "", text: "d" },
    lead: { key: "lead", title: "", text: "l" },
    companies: [{ key: "co1", title: "", text: "c" }],
    employees: [{ key: "e1", title: "", text: "e" }],
    dateLabel: "",
  };

  it("sends the forwardable message and her private report at 07:45", () => {
    expect(briefMessagesFor(brief, "general").map((m) => m.key)).toEqual(["schedule", "lead"]);
  });

  it("sends the detail and the per-person sheets at 08:00", () => {
    expect(briefMessagesFor(brief, "detail").map((m) => m.key)).toEqual(["detail", "co1", "e1"]);
  });

  it("«ابعتيلي البريف هلق» sends everything, each message exactly once", () => {
    const keys = briefMessagesFor(brief, "all").map((m) => m.key);
    expect(keys).toEqual(["schedule", "lead", "detail", "co1", "e1"]);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

// On the first real run (2026-08-02) عمر's sheet was 22,769 characters. Telegram
// caps sendMessage at 4096, so it was rejected — and the sender used to abort
// the whole wave on the first failure, which cost ماجد and سارة their sheets.
describe("no sheet may be lost to Telegram's 4096 limit", () => {
  it("keeps a short message whole", () => {
    expect(splitForTelegram("سطر واحد")).toEqual(["سطر واحد"]);
  });

  it("splits a long message on line boundaries, never mid-line", () => {
    const line = "• Wasl 7-1 · ستوري · وصل للتداول — متأخر 17 يوم";
    const parts = splitForTelegram(Array.from({ length: 400 }, () => line).join("\n"), 500);
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts)
      for (const l of p.split("\n"))
        expect(l === "" || l === line || /^\(تتمة \d+\)$/.test(l)).toBe(true);
  });

  it("keeps every part under the limit and loses no line", () => {
    const lines = Array.from({ length: 900 }, (_, i) => `بند رقم ${i}`);
    const parts = splitForTelegram(lines.join("\n"), 300);
    for (const p of parts) expect([...p].length).toBeLessThanOrEqual(300 + 12);
    const back = parts.join("\n").replace(/\(تتمة \d+\)\n/g, "");
    for (const l of lines) expect(back).toContain(l);
  });

  it("hard-cuts a single line that is itself longer than the limit", () => {
    const parts = splitForTelegram("ا".repeat(1000), 300);
    expect(parts.length).toBe(4);
    for (const p of parts) expect([...p].length).toBeLessThanOrEqual(300 + 12);
  });
});

/**
 * المونتاج انضاف كمرحلة 2/8، و`PRODUCTION_STAGES` بالبوت ضلّت [DESIGN, SHOOT] —
 * يعني كل ريل بتبعتو أليسار كان بينخزّن وما بيسكّر ولا كرت، بصمت.
 */
describe("مراحل الإنتاج بالبوت مربوطة بخط الأنابيب", () => {
  const src = readFileSync("src/lib/telegram/ingest.ts", "utf8");
  const declared = src.match(/PRODUCTION_STAGES\s*=\s*\[([^\]]*)\]/)?.[1] ?? "";
  const inBot = [...declared.matchAll(/"([A-Z_]+)"/g)].map((m) => m[1]);

  it("بتشمل كل مرحلة إنتاج بخط الأنابيب", () => {
    const production = STAGES.filter((s) => s !== "WRITE" && s !== "PUBLISH");
    expect([...production].sort()).toEqual([...inBot].sort());
  });

  it("ما بتشمل الكتابة ولا النشر", () => {
    expect(inBot).not.toContain("WRITE");
    expect(inBot).not.toContain("PUBLISH");
  });
});
