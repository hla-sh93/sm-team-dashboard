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
    // كلمة النوع جزء من الاسم: أرقام القطع بتبلّش من ١ لكل نوع، فبلاها
    // «Agalia 7-1» بيوصف البوست والستوري سوا.
    expect(assetName("Agalia", 6, 1, "POST")).toBe("Agalia-post-7-1");
    expect(assetName("Agalia", 6, 1, "STORY")).toBe("Agalia-story-7-1");
    expect(assetName("Agalia", 6, 1, "REEL")).toBe("Agalia-reel-7-1");
    // بلا نوع بيرجع الشكل القديم — لسا مقبول بالمطابقة للملفات القديمة.
    expect(assetName("Agalia", 6, 1)).toBe("Agalia 7-1");
    expect(assetNameForTask(company(), task({ pieceNo: 3 }))).toBe("Agalia-reel-7-3");
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

  /** الإرسال من صاحب الكروت (`e1`) — طبقة «النوع» تخمين، فبتلزمها مرسِل معروف (D3). */
  const byOwner = (d: Delivery, cards: Task[], foreign: string[] = []) =>
    matchDelivery(d, "Agalia", cards, [], [], null, false, "e1", foreign);

  it("ignores a name that belongs to another company — even as the owner's type guess", () => {
    // كان بيوقع لطبقة النوع ويسكّر أبكر ريل هون (فحص ١٢/١٠، TR-02): «الاسم الصريح أقوى
    // من مكان الإرسال».
    expect(byOwner(delivery({ fileName: "Wasl 7-1.mp4" }), [reel1, reel2], ["Wasl"])).toBeNull();
    expect(matchDelivery(delivery({ fileName: "Wasl 7-1.mp4" }), "Agalia", [reel1, reel2])).toBeNull();
  });

  it("matches a video to the most urgent open reel when unnamed", () => {
    expect(byOwner(delivery(), [reel1, reel2, post3])).toEqual({ taskId: "r2", by: "TYPE" });
  });

  it("matches a photo to a post, never to a reel", () => {
    expect(byOwner(delivery({ kind: "PHOTO" }), [reel1, reel2, post3])).toEqual({
      taskId: "p3",
      by: "TYPE",
    });
  });

  it("guesses by type only for a known sender, and only among their own cards (D3)", () => {
    // بلا مرسِل معروف ما في تخمين.
    expect(matchDelivery(delivery(), "Agalia", [reel1, reel2])).toBeNull();
    // كرت غيره ما بينخمَّن: صورة المونتيرة ما بتسكّر تصميم المصمّم (فونيتيك ١٩/٨).
    const theirs = task({ id: "p9", type: "POST", stage: "DESIGN", assigneeId: "e2" });
    expect(byOwner(delivery({ kind: "PHOTO" }), [theirs])).toBeNull();
  });

  it("never counts a raw camera/phone file as finished work (TR-02)", () => {
    for (const fileName of ["IMG_1342.jpg", "DSC03882.JPG", "PXL_20260810_101010.jpg", "Screenshot 2026-08-10.png"])
      expect(byOwner(delivery({ kind: "PHOTO", fileName }), [post3]), fileName).toBeNull();
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
      byOwner(delivery({ kind: "PHOTO", fileName: "STORY صرف سوريا.jpg" }), [post, story]),
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
    expect(byOwner(delivery({ kind: "PHOTO", fileName: "شي.jpg" }), [bare])).toEqual({
      taskId: "p3",
      by: "TYPE",
    });
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
    expect(brief.companies[0].text).toContain("Agalia-reel-7-3");
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

  // القائدة (5/8): «ما فيك تقول سابين لازم تصمم البلسم وبرو وأغاليا — المهمة
  // لازم تكون حسب المطلوب». السطر بيسمّي القطع المطلوبة مجمّعة تحت شركتها.
  it("يكتب «<اسم> <شركة>: <القطع المطلوبة>» بلا نقطة ولا رمز", () => {
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
    // (١٦/٩) الشركة والعدد والنوع — بلا ترقيم كل بوست.
    expect(line.replace(/‏/g, "")).toBe("أيمن أغاليا 1 بوست");
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
    expect(brief.schedule.text).toContain("@Ayman_D أغاليا 1 بوست");
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
    // اليوم ٣ ريلات وصل، والمتأخر ريل برو — بالشركة والعدد لا بأرقام القطع (١٦/٩).
    const line = brief.schedule.text.split(String.fromCharCode(10)).find((l) => l.includes("ماجد"))!;
    expect(line).toContain("وصل 3 ريل");
    expect(line).toContain("ومتأخر: برو 1 ريل");
  });

  // تغيّرت القاعدة (5/8): أسماء القطع مطلوبة بالموجة الأولى — الممنوع هو
  // التواريخ وعدد أيام التأخير، فهي شغل تقرير الثمانية.
  it("no dates or day-counts in the general message", () => {
    const brief = buildDailyBrief({
      today: workday,
      companies: [company(), wasl, bru],
      employees: [photographer],
      tasks: overloadedDay(),
    });
    expect(brief.schedule.text).not.toMatch(/\d+ يوم/);
    expect(brief.schedule.text).not.toMatch(/\d+\/\d+/);
    expect(brief.schedule.text).not.toMatch(/ريل-\d/);
    // …while the detailed wave still carries exactly that.
    expect(brief.employees[0].text).toMatch(/Bru-reel-7-\d/);
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
    // ٣ شركات متأخرة بقطعة لكل وحدة: كلها بتنعرض (السقف ٣)، والسطر بيضل مقروء.
    expect(line).toContain("ومتأخر:");
    expect(line.length).toBeLessThan(150);
  });

  it("نصّ «سبب الإعفاء» لحاله ما بيعفي شركة شغّالة — نفس قاعدة تقرير ٢٠:٠٠ (القائدة ١٣/١٠)", () => {
    // السبب بينكتب بس مع «أوقف النشر» وبينمحى مع «رجّع النشر»؛ والموقوفة مستبعدة أصلاً.
    // سطر باقي على شركة شغّالة (داتا قديمة) ما بيخبّي تأخيرها الصبح وهو بينعدّ المسا.
    const leftover = company({
      id: "co4",
      name: "جدارات",
      slug: "Jadarat",
      telegramChatId: null,
      lateExemptReason: "الزبون لسا ما أعطانا أكسس على الصفحة",
    });
    const tasks = reels([
      { id: "r1", co: wasl, day: 1 },
      { id: "r2", co: leftover, day: 1 },
      { id: "r3", co: leftover, day: 11 },
    ]);
    const brief = buildDailyBrief({
      today: workday,
      companies: [company(), wasl, leftover],
      employees: [photographer],
      tasks,
    });
    expect(brief.schedule.text).toMatch(/جدارات \d+ ريل/);
    expect(brief.lead.text).toContain("متأخرات (2)");
    const sheet = brief.companies.find((c) => c.title === "جدارات");
    expect(sheet?.text).not.toContain("التأخير مو محسوب");
  });

  it("leaves idle people out of the group message but tells the lead privately", () => {
    const brief = buildDailyBrief({ ...base, tasks: [] });
    expect(brief.schedule.text).not.toContain("أيمن");
    expect(brief.lead.text).toContain("فاضي اليوم: أيمن");
  });

  // (١٦/٩) «خلي النشر باسم الشركة ونوع المحتوى فقط».
  it("gives the publisher company + content type only, no counts and no piece names", () => {
    const publisher = employee({ id: "p1", name: "عمر", role: "publisher", isPhotographer: false, telegramUsername: "Omar_ORR" } as Partial<Employee>);
    const publish = task({ id: "pub", stage: "PUBLISH", kind: "PUBLISH", publishDate: workday, assigneeId: "p1" });
    const story = task({ id: "pub2", stage: "PUBLISH", kind: "PUBLISH", type: "STORY", pieceNo: 2, publishDate: workday, assigneeId: "p1", pipelineKey: "co1|STORY|x" });
    const brief = buildDailyBrief({ ...base, employees: [publisher], tasks: [publish, story] });
    expect(brief.schedule.text).toContain("@Omar_ORR نشر: أغاليا (ريل، ستوري)");
    expect(brief.schedule.text).not.toMatch(/ريل-\d|\d+ ريل/);
  });

  it("gives the publisher his standing line when nothing publishes today", () => {
    const publisher = employee({ id: "p1", name: "عمر", role: "publisher", isPhotographer: false, telegramUsername: "Omar_ORR" } as Partial<Employee>);
    const brief = buildDailyBrief({ ...base, employees: [publisher], tasks: [] });
    expect(brief.schedule.text).toContain("@Omar_ORR متابعة الصفحات والنشر");
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

  // (١٦/٩) «بدي الصبح بس توزيع المهام» — رسالة وحدة، وتقرير القائد للمعاينة فقط.
  it("sends ONLY the distribution message at 07:45", () => {
    expect(briefMessagesFor(brief, "general").map((m) => m.key)).toEqual(["schedule"]);
  });

  // موجة ٨:٠٠ كانت تبعت أوراق الشركات والأشخاص كمان — ١٩ رسالة كل صباح. حكم
  // القائدة (3/8): «كل يوم عم يوصلني كتييير مسجات باسلوب عشوائي ما عم استفيد
  // منه». الأوراق بقيت على DailyBrief للمعاينة والإرسال عند الطلب من
  // /admin/telegram، بس ما بتنبعت آلياً أبداً.
  it("sends ONLY the sectioned detail sheet at 08:00 — per-company/person sheets are on-demand", () => {
    expect(briefMessagesFor(brief, "detail").map((m) => m.key)).toEqual(["detail"]);
  });

  it("«ابعتيلي البريف هلق» sends both waves, each message exactly once", () => {
    const keys = briefMessagesFor(brief, "all").map((m) => m.key);
    expect(keys).toEqual(["schedule", "detail"]);
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
    const production = STAGES.filter((s) => s !== "PUBLISH");
    expect([...production].sort()).toEqual([...inBot].sort());
  });

  // الكتابة انضافت 5/8: تسليمها ملف خطة، وكانت مستثناة فكرت «كتابة بوستات
  // وستوريز — مانغو» بيضل متأخراً بينما الخطة واصلة. النشر بيضل برّا — بينسكّر
  // برد «نشر» على الملف، مو بوصول ملف.
  it("بتشمل الكتابة وما بتشمل النشر", () => {
    expect(inBot).toContain("WRITE");
    expect(inBot).not.toContain("PUBLISH");
  });
});

/**
 * دورة العقد بتقع على شهرين: وصل 21/7 → 20/8، فالاسم القياسي «Wasl 7-2» بينما
 * الريل بينشر بآب. أليسار سمّت ريلاتها «Wasl 8-2» — والمطابقة كانت بتشترط تطابق
 * الشهر ثم **توقف**، فالملف بينخزّن وما بيسكّر ولا كرت.
 */
describe("اسم القطعة عبر حدود الشهر", () => {
  const co = "Wasl";
  const reel = (pieceNo: number, month: number) =>
    ({
      id: `r${pieceNo}-${month}`,
      type: "REEL",
      stage: "SHOOT",
      month,
      pieceNo,
      publishDate: new Date(2026, 7, pieceNo + 1),
      readyDate: new Date(2026, 6, 25),
      brief: null,
      quantity: 1,
    }) as never;

  const deliver = (fileName: string) =>
    ({ kind: "VIDEO", fileName, caption: null, chatId: "c", messageId: 1 }) as never;

  it("«Wasl 7-2» بتطابق قطعة تموز متل قبل", () => {
    const hit = matchDelivery(deliver("Wasl 7-2.mp4"), co, [reel(2, 6)], []);
    expect(hit?.taskId).toBe("r2-6");
  });

  it("«Wasl 8-2» بتطابق نفس القطعة لما تكون وحدة بلا لبس", () => {
    const hit = matchDelivery(deliver("Wasl 8-2.mp4"), co, [reel(2, 6)], []);
    expect(hit?.taskId).toBe("r2-6");
    expect(hit?.by).toBe("NAME");
  });

  it("بس ما بتخمّن لما يكون في قطعتين بنفس الرقم وولا وحدة بشهر الاسم", () => {
    // دورتان قديمتان (حزيران وتموز) وكلتاهما فيها «قطعة 2»، والاسم بيقول آب —
    // ما في مرجّح، فالمطابقة بتوقف بدل ما تخمّن.
    const hit = matchDelivery(deliver("Wasl 8-2.mp4"), co, [reel(2, 5), reel(2, 6)], []);
    expect(hit).toBeNull();
  });

  it("رقم مو موجود بيضل ما بيطابق شي", () => {
    expect(matchDelivery(deliver("Wasl 8-9.mp4"), co, [reel(2, 6)], [])).toBeNull();
  });

  const sentInAugust = (fileName: string) =>
    ({
      kind: "VIDEO",
      fileName,
      caption: null,
      chatId: "c",
      messageId: 1,
      sentAt: new Date(2026, 7, 1),
    }) as never;

  /**
   * «1-8» بتنقرأ «شهر ٨ قطعة ١» و«شهر ١ قطعة ٨». لما تكون قطعة آب الأولى
   * مسكّرة، القراءة التانية كانت بتمرّر رقم القطعة ٨ فتسكّر ريل ٨ بملف اسمه
   * ريل ١. شهر كانون بملف انبعت بآب مو قراءة تانية، غلط قراءة.
   */
  it("ما بتمرّر رقم قطعة من قراءة شهرها بعيد عن تاريخ الإرسال", () => {
    expect(
      matchDelivery(sentInAugust("phoenijobs 1-8 edited.mp4"), "PhoeniJobs", [reel(8, 7)], []),
    ).toBeNull();
  });

  it("…وبتقبل القراءة لما يكون شهرها جنب تاريخ الإرسال", () => {
    expect(matchDelivery(sentInAugust("Wasl 8-2.mp4"), co, [reel(2, 6)], [])?.taskId).toBe("r2-6");
  });

  /**
   * «BW reel 2 July.mp4» انبعت ٢٢/٧ وريل تموز ٢ مسلّم من زمان — فرقم القطعة كان
   * بيمرق ويسكّر **ريل آب ٢**، تسليم ما صار. إعادة إرسال شغل مسلّم نسخة تانية
   * منه، مو قطعة جديدة.
   */
  it("ما بتسكّر قطعة تانية لما تكون قطعة الاسم مسلّمة أصلاً", () => {
    const delivered = reel(2, 6); // ريل تموز ٢ — مسكّر
    const august = { ...(reel(2, 7) as object), id: "r2-7" } as never;
    const file = { ...(sentInAugust("BW reel 2 July.mp4") as object), sentAt: new Date(2026, 6, 22) } as never;
    expect(matchDelivery(file, "BW", [august], [], [delivered])).toBeNull();
  });
});

/**
 * قاعدة الدورة (القائدة 3/8): «بتكتب ريل 7-2 وبتكون بخطة بين 15/7 و15/8، وبيجو
 * التيم بيسلموها باسم 8-2… لازم نراعي تاريخ الدورة وايمت عم ينرسل الملف».
 *
 * الهوية = الشركة + النوع + رقم القطعة + الدورة الشغّالة وقت الإرسال. رقم
 * الشهر بالاسم تسمية بشرية: مقبول إذا كان شهر بداية الدورة أو شهر النشر.
 */
describe("قاعدة الدورة — التسمية بشهر النشر بتلاقي كرتها", () => {
  // دورة المخبر 15/7 ← 14/8، فكروتها بباكت تموز (month = 6) وبتنشر بآب.
  const JULY_BUCKET = { year: 2026, month: 6 };
  const piece = (id: string, stage: string, pieceNo: number, publishDay: number, month = 6) =>
    ({
      id,
      type: "REEL",
      stage,
      month,
      year: 2026,
      pieceNo,
      readyDate: new Date(2026, month, 20),
      publishDate: new Date(2026, 7, publishDay), // بتنشر بآب
      brief: null,
      quantity: 1,
    }) as never;

  const sent = (fileName: string, day: number) =>
    ({
      kind: "VIDEO",
      fileName,
      caption: null,
      chatId: "c",
      messageId: 1,
      sentAt: new Date(2026, 7, day),
    }) as never;

  // الريل إلو كرتين بنفس الرقم: تصوير ثم مونتاج.
  const cards = [piece("shoot4", "SHOOT", 4, 6), piece("edit4", "EDIT", 4, 6)];

  it("«Makhbar 8-4» بشهر النشر بتسكّر كرت تصوير القطعة ٤", () => {
    const hit = matchDelivery(sent("Makhbar 8-4.mp4", 3), "Makhbar", cards, [], [], JULY_BUCKET);
    expect(hit?.taskId).toBe("shoot4");
    expect(hit?.by).toBe("NAME");
  });

  it("«Makhbar 7-4» بشهر الدورة بتسكّر نفس القطعة", () => {
    expect(
      matchDelivery(sent("Makhbar 7-4.mp4", 3), "Makhbar", cards, [], [], JULY_BUCKET)?.taskId,
    ).toBe("shoot4");
  });

  it("بعد ما يخلص التصوير، نفس الاسم بيسكّر المونتاج", () => {
    const hit = matchDelivery(sent("Makhbar 8-4.mp4", 3), "Makhbar", [cards[1]], [], [], JULY_BUCKET);
    expect(hit?.taskId).toBe("edit4");
  });

  /** شهر لا هو شهر الدورة ولا شهر النشر = غلطة تسمية، مو تسمية تانية. */
  it("شهر ما بينفسّر لا بالدورة ولا بالنشر ما بيطابق", () => {
    expect(matchDelivery(sent("Makhbar 3-4.mp4", 3), "Makhbar", cards, [], [], JULY_BUCKET)).toBeNull();
  });

  /** إعادة إرسال قطعة مسلّمة ما بتسكّر غيرها — ولا حتى عبر قاعدة الدورة. */
  it("قطعة الدورة المسكّرة ما بتخلّي الملف يمرق على قطعة تانية", () => {
    const delivered = piece("shoot4done", "SHOOT", 4, 6);
    const other = piece("shoot5", "SHOOT", 5, 10);
    expect(
      matchDelivery(sent("Makhbar 8-4.mp4", 3), "Makhbar", [other], [], [delivered], JULY_BUCKET),
    ).toBeNull();
  });

  /**
   * «PHOENIJOBS 2.mp4» — رقم مجرّد بلا شهر، تسمية المصور الفعلية. بتنحصر
   * بالدورة الشغّالة وقت الإرسال: جوّاها بتسكّر قطعتها، برّاها ما بتسكّر شي.
   */
  it("رقم مجرّد بلا شهر بيسكّر قطعته بالدورة الشغّالة", () => {
    const hit = matchDelivery(sent("PHOENIJOBS 2.mp4", 3), "PhoeniJobs", [piece("shoot2", "SHOOT", 2, 10)], [], [], JULY_BUCKET);
    expect(hit?.taskId).toBe("shoot2");
    expect(hit?.by).toBe("NAME");
  });

  it("الرقم المجرّد بلا دورة معروفة ما بيخمّن", () => {
    expect(
      matchDelivery(sent("PHOENIJOBS 2.mp4", 3), "PhoeniJobs", [piece("shoot2", "SHOOT", 2, 10)], [], [], null),
    ).toBeNull();
  });

  it("الرقم المجرّد لقطعة مسلّمة بالدورة = إعادة إرسال، ما بيسكّر غيرها", () => {
    expect(
      matchDelivery(
        sent("PHOENIJOBS 2.mp4", 3),
        "PhoeniJobs",
        [piece("shoot3", "SHOOT", 3, 14)],
        [],
        [piece("done2", "SHOOT", 2, 10)],
        JULY_BUCKET,
      ),
    ).toBeNull();
  });

  /**
   * اللبس القديم: نفس الرقم مفتوح بدورتين. الدورة الشغّالة وقت الإرسال بتحسم،
   * والقطعة المسمّاة صراحةً بشهر الدورة القديمة بتنمسك قبلها بالمطابقة المباشرة.
   */
  it("رقم مفتوح بدورتين: الدورة الشغّالة بتربح، والتسمية الصريحة بتضل تلاقي القديمة", () => {
    const june = piece("shoot4-june", "SHOOT", 4, 1, 5); // دورة حزيران، بتنشر 1/8
    const july = piece("shoot4-july", "SHOOT", 4, 6, 6);
    expect(
      matchDelivery(sent("Makhbar 8-4.mp4", 3), "Makhbar", [june, july], [], [], JULY_BUCKET)?.taskId,
    ).toBe("shoot4-july");
    expect(
      matchDelivery(sent("Makhbar 6-4.mp4", 3), "Makhbar", [june, july], [], [], JULY_BUCKET)?.taskId,
    ).toBe("shoot4-june");
  });
});

/**
 * أرقام القطع بتبلّش من جديد مع كل نوع: بشهر ٨ في «ستوري ٣» و«بوست ٣». الاسم
 * بيحمل النوع («al balsam-post -8-3») فلازم يرجّح — وإلا الاتنين بالسلّة
 * والأقرب موعداً بيربح، فالبوست بيسكّر كرت الستوري.
 */
describe("النوع المكتوب بالاسم بيرجّح بين قطعتين بنفس الرقم", () => {
  const piece = (id: string, type: string, pieceNo: number, readyDay: number) =>
    ({
      id,
      type,
      stage: "DESIGN",
      month: 7,
      year: 2026,
      pieceNo,
      readyDate: new Date(2026, 7, readyDay),
      publishDate: new Date(2026, 7, readyDay + 1),
      brief: null,
      quantity: 1,
    }) as never;

  const sent = (kind: string, fileName: string) =>
    ({
      kind,
      fileName,
      caption: null,
      chatId: "c",
      messageId: 1,
      sentAt: new Date(2026, 7, 1),
    }) as never;
  const photo = (fileName: string) => sent("PHOTO", fileName);

  // الستوري موعدها أبكر، فبلا ترجيح النوع هي يلي بتربح.
  const cards = [piece("story3", "STORY", 3, 2), piece("post3", "POST", 3, 9)];

  it("«al balsam-post -8-3.jpg» بتسكّر البوست مو الستوري", () => {
    const hit = matchDelivery(photo("al balsam-post -8-3.jpg"), "Balsam", cards, []);
    expect(hit?.taskId).toBe("post3");
    expect(hit?.by).toBe("NAME");
  });

  it("«balsam-story-8-3.jpg» بتسكّر الستوري", () => {
    expect(matchDelivery(photo("balsam-story-8-3.jpg"), "Balsam", cards, [])?.taskId).toBe("story3");
  });

  it("بلا كلمة نوع بالاسم بيضل الترجيح بالموعد", () => {
    expect(matchDelivery(photo("balsam 8-3.jpg"), "Balsam", cards, [])?.taskId).toBe("story3");
  });

  /**
   * الكلمة بترجّح جوّا حدود نوع الملف بس: «post» على ملف mp4 مو دليل — الملف
   * نفسه بيقول إنّه ريل.
   */
  it("كلمة بتناقض نوع الملف بتنتجاهل", () => {
    const reelCard = piece("reel3", "REEL", 3, 5);
    const video = sent("VIDEO", "bru-post-8-3.mp4");
    expect(matchDelivery(video, "Bru", [...cards, reelCard], [])?.taskId).toBe("reel3");
  });
});

/**
 * ملف الخطة بيسكّر كرت الكتابة (القائدة 5/8: «نوال بعتت خطة مانغو — ليش ما
 * مسكتها وحسبتها تأخير؟»). المطابقة كانت بتعرف صورة=بوست/ستوري وفيديو=ريل وبس،
 * فأي مستند ما بيلاقي شي وكرت الكتابة بيضل متأخر والخطة واصلة.
 */
describe("ملف الخطة ← كرت الكتابة", () => {
  const writeCard = (id: string, title: string, day: number) =>
    ({
      id,
      type: null,
      stage: "WRITE",
      month: 7,
      year: 2026,
      pieceNo: null,
      readyDate: new Date(2026, 7, day),
      publishDate: null,
      brief: null,
      title,
    }) as never;

  const doc = (fileName: string) =>
    ({
      kind: "DOCUMENT",
      fileName,
      caption: null,
      chatId: "c",
      messageId: 1,
      sentAt: new Date(2026, 7, 5),
    }) as never;

  const posts = writeCard("w_posts", "كتابة بوستات وستوريز — مانغو · دورة 1 آب", 5);
  const shoot = writeCard("w_shoot", "سيناريو تصوير — مانغو · دورة 1 آب", 8);

  it("«3 Scripts For Shooting- Mango.docx» بتسكّر كرت سيناريو التصوير", () => {
    const hit = matchDelivery(doc("3 Scripts For Shooting- Mango.docx"), "Mango", [posts, shoot], []);
    expect(hit?.taskId).toBe("w_shoot");
  });

  it("خطة محتوى عامة بتسكّر كرت البوستات والستوريز", () => {
    const hit = matchDelivery(doc("Mango Content Plan.docx"), "Mango", [posts, shoot], []);
    expect(hit?.taskId).toBe("w_posts");
  });

  it("بلا كرت كتابة مفتوح، المستند ما بيسكّر ولا قطعة إنتاج", () => {
    const design = {
      id: "d1", type: "POST", stage: "DESIGN", month: 7, year: 2026, pieceNo: 1,
      readyDate: new Date(2026, 7, 6), publishDate: new Date(2026, 7, 7), brief: null,
    } as never;
    expect(matchDelivery(doc("Mango Content Plan.docx"), "Mango", [design], [])).toBeNull();
  });
});

/**
 * تأكيد النشر مشروط بالمرسل (القائدة 8/8): «"نشرت" ممكن تكون سؤال إذا ما كان
 * عمر باعتها… وأحياناً حلا بتقول تم النشر». فالصيغة الملتبسة بتلزمها صلاحية،
 * والصريحة لأ — وعلامة الاستفهام بتلغي التأكيد مهما كان المرسل.
 */
describe("صلاحية تأكيد النشر", () => {
  const src = readFileSync("src/lib/telegram/ingest.ts", "utf8");
  /**
   * الاختبار بيقرأ التعبير من الكود مباشرةً — لأنّ نسخة عنه بالاختبار بتفترق
   * بصمت أول ما يتعدّل الأصل، والحارس بيصير كذبة.
   */
  const rx = (name: string) => {
    const at = src.indexOf(`const ${name} =`);
    const body = src.slice(at).match(/\/(.+)\/i;/)![1];
    return new RegExp(body, "i");
  };
  const explicit = rx("PUBLISHED_EXPLICIT");
  const loose = rx("PUBLISHED_LOOSE");

  it("«تم النشر» و«اننشر» و✅ صريحة (والصلاحية بتلزم كل الصيغ — D3)", () => {
    for (const t of ["تم النشر", "اننشر", "✅"]) expect(explicit.test(t), t).toBe(true);
  });

  it("«نشرت» و«نزل» ملتبسة — بتلزمها صلاحية", () => {
    for (const t of ["نشرت ستوري 16", "نزل الريل"]) {
      expect(explicit.test(t), `${t} صريحة؟`).toBe(false);
      expect(loose.test(t), `${t} ملتبسة؟`).toBe(true);
    }
  });

  it("ولا وحدة بتمسك الوصف: «منشور» و«ناشر»", () => {
    for (const t of ["المنشور حلو", "ناشر الصفحة"]) {
      expect(explicit.test(t), t).toBe(false);
      expect(loose.test(t), t).toBe(false);
    }
  });

  it("المخوّلون: الناشر والقائدة فقط", () => {
    const fn = src.match(/function mayConfirmPublish[\s\S]*?\n}/)![0];
    expect(fn).toMatch(/ناشر|publish/);
    expect(fn).toMatch(/ليدر|lead|قائد/);
  });
});
