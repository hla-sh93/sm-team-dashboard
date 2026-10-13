import { describe, expect, it } from "vitest";
import {
  dailyTaskEffortDays,
  isFinishedOnDay,
  makeBlockedPredicate,
  makeHeldReason,
  selectDailyWork,
  selectDailyWorkTasks,
} from "@/lib/daily-work";

const employee = (overrides: Record<string, unknown> = {}) =>
  ({
    id: "designer",
    name: "مصمم",
    role: "designer",
    hoursPerDay: 8,
    workDays: JSON.stringify([6, 0, 1, 2, 3]),
    isScheduled: true,
    isPhotographer: false,
    salary: 0,
    costPerReel: null,
    color: null,
    rates: JSON.stringify({ POST: 10 }),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as any;

const company = (overrides: Record<string, unknown>) =>
  ({
    id: "company",
    name: "Company",
    managed: true,
    posts: 0,
    reels: 0,
    stories: 0,
    aiReels: 0,
    contractValue: 0,
    contractStartDate: null,
    preferredShootDay: null,
    color: null,
    priority: 99,
    status: "active",
    postOwnerId: null,
    storyOwnerId: null,
    aiReelOwnerId: null,
    defaultOwnerId: null,
    photographerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as any;

const task = (overrides: Record<string, unknown>) =>
  ({
    id: "task",
    kind: "CONTENT",
    type: "POST",
    title: null,
    hours: 0,
    quantity: 1,
    priority: "NORMAL",
    status: "NOT_STARTED",
    publishDate: new Date(2026, 6, 15),
    readyDate: new Date(2026, 6, 12),
    workDate: new Date(2026, 6, 10),
    week: null,
    overflow: false,
    month: 6,
    year: 2026,
    isPinned: false,
    isAuto: true,
    stage: "DESIGN",
    board: "TODO",
    blockedById: null,
    pipelineKey: null,
    detKey: null,
    notes: null,
    completedAt: null,
    startedAt: null,
    finishedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    companyId: "company",
    assigneeId: "designer",
    ...overrides,
  }) as any;

describe("daily work queue", () => {
  it("returns no daily queue on the employee's day off", () => {
    const designer = employee();
    const companies = [company({ id: "company", priority: 1 })];

    const selected = selectDailyWorkTasks({
      employee: designer,
      tasks: [task({ id: "open", workDate: new Date(2026, 6, 3) })],
      companies,
      today: new Date(2026, 6, 3), // Friday, off for Sat→Wed
    });

    expect(selected).toEqual([]);
  });

  it("fills today's queue from unfinished future-dated posts up to the designer capacity", () => {
    const designer = employee();
    const companies = [
      company({ id: "chinese-mall", name: "المول الصيني", priority: 1 }),
      company({ id: "pro", name: "برو", priority: 2 }),
    ];
    const tasks = [
      ...Array.from({ length: 6 }, (_, index) =>
        task({ id: `chinese_${index}`, companyId: "chinese-mall" }),
      ),
      ...Array.from({ length: 6 }, (_, index) =>
        task({ id: `pro_${index}`, companyId: "pro" }),
      ),
    ];

    const selected = selectDailyWorkTasks({
      employee: designer,
      tasks,
      companies,
      today: new Date(2026, 5, 28),
    });

    expect(selected).toHaveLength(10);
    expect(selected.slice(0, 6).map((item) => item.companyId)).toEqual(
      Array(6).fill("chinese-mall"),
    );
    expect(selected.slice(6).map((item) => item.companyId)).toEqual(Array(4).fill("pro"));
  });

  it("uses carousel slide quantity when filling today's design capacity", () => {
    const designer = employee();
    const companies = [company({ id: "chinese-mall", name: "المول الصيني", priority: 1 })];
    const tasks = [
      task({ id: "carousel_3", companyId: "chinese-mall", quantity: 3 }),
      task({ id: "carousel_4", companyId: "chinese-mall", quantity: 4 }),
      ...Array.from({ length: 4 }, (_, index) =>
        task({ id: `single_${index}`, companyId: "chinese-mall" }),
      ),
    ];

    const selected = selectDailyWorkTasks({
      employee: designer,
      tasks,
      companies,
      today: new Date(2026, 5, 28),
    });

    expect(selected.map((item) => item.id)).toEqual([
      "carousel_3",
      "carousel_4",
      "single_0",
      "single_1",
      "single_2",
    ]);
    expect(selected.some((item) => item.id === "single_3")).toBe(false);
    expect(
      selected.reduce((sum, item) => sum + dailyTaskEffortDays(designer, item), 0),
    ).toBeCloseTo(1);
  });

  it("continues in-progress work before starting other cards", () => {
    const designer = employee();
    const companies = [company({ id: "company", priority: 1 })];
    const active = task({
      id: "active",
      board: "DOING",
      workDate: new Date(2026, 6, 25),
      readyDate: new Date(2026, 6, 27),
    });
    const earlier = task({
      id: "earlier",
      workDate: new Date(2026, 6, 1),
      readyDate: new Date(2026, 6, 3),
    });

    const [first] = selectDailyWorkTasks({
      employee: designer,
      tasks: [earlier, active],
      companies,
      today: new Date(2026, 5, 28),
    });

    expect(first.id).toBe("active");
  });

  it("assigns an AI reel as a full exclusive day when it has precedence", () => {
    const designer = employee({ rates: JSON.stringify({ POST: 10, AI_REEL: 1 }) });
    const companies = [company({ id: "company", priority: 1 })];
    const aiReel = task({
      id: "ai_reel",
      type: "AI_REEL",
      workDate: new Date(2026, 6, 1),
      readyDate: new Date(2026, 6, 3),
    });
    const posts = Array.from({ length: 10 }, (_, index) =>
      task({
        id: `post_${index}`,
        type: "POST",
        workDate: new Date(2026, 6, 10),
        readyDate: new Date(2026, 6, 12),
      }),
    );

    const selected = selectDailyWorkTasks({
      employee: designer,
      tasks: [aiReel, ...posts],
      companies,
      today: new Date(2026, 5, 28),
    });

    expect(selected.map((item) => item.id)).toEqual(["ai_reel"]);
  });

  it("does not add a reel after posts have already been selected for the day", () => {
    const designer = employee({ rates: JSON.stringify({ POST: 10, AI_REEL: 1 }) });
    const companies = [
      company({ id: "priority-posts", priority: 1 }),
      company({ id: "next-company", priority: 2 }),
    ];
    const priorityPosts = Array.from({ length: 6 }, (_, index) =>
      task({ id: `priority_post_${index}`, companyId: "priority-posts", type: "POST" }),
    );
    const aiReel = task({
      id: "ai_reel",
      companyId: "next-company",
      type: "AI_REEL",
    });
    const fillPosts = Array.from({ length: 6 }, (_, index) =>
      task({ id: `fill_post_${index}`, companyId: "next-company", type: "POST" }),
    );

    const selected = selectDailyWorkTasks({
      employee: designer,
      tasks: [...priorityPosts, aiReel, ...fillPosts],
      companies,
      today: new Date(2026, 5, 28),
    });

    expect(selected).toHaveLength(10);
    expect(selected.some((item) => item.type === "AI_REEL")).toBe(false);
  });

  it("keeps future publish cards grouped by the nearest publish day instead of dumping all backlog", () => {
    const publisher = employee({ id: "publisher", role: "publisher", rates: null });
    const companies = [company({ id: "company", priority: 1 })];
    const tasks = [
      task({
        id: "publish_1",
        kind: "PUBLISH",
        stage: "PUBLISH",
        assigneeId: "publisher",
        publishDate: new Date(2026, 6, 2),
        readyDate: new Date(2026, 6, 2),
        workDate: new Date(2026, 6, 2),
      }),
      task({
        id: "publish_2",
        kind: "PUBLISH",
        stage: "PUBLISH",
        assigneeId: "publisher",
        publishDate: new Date(2026, 6, 2),
        readyDate: new Date(2026, 6, 2),
        workDate: new Date(2026, 6, 2),
      }),
      task({
        id: "publish_later",
        kind: "PUBLISH",
        stage: "PUBLISH",
        assigneeId: "publisher",
        publishDate: new Date(2026, 6, 5),
        readyDate: new Date(2026, 6, 5),
        workDate: new Date(2026, 6, 5),
      }),
    ];

    const selected = selectDailyWorkTasks({
      employee: publisher,
      tasks,
      companies,
      today: new Date(2026, 5, 28),
    });

    expect(selected.map((item) => item.id)).toEqual(["publish_1", "publish_2"]);
  });

  it("promotes a manualDay==today card above higher-priority/earlier work (بدّل)", () => {
    const designer = employee();
    const companies = [company({ id: "company", priority: 1 })];
    // «jobs» has the earlier deadline AND a higher priority, so it would normally
    // win the day. The lead swapped «aghalia» onto today via manualDay.
    const jobs = task({
      id: "jobs",
      priority: "HIGH",
      workDate: new Date(2026, 6, 1),
      readyDate: new Date(2026, 6, 3),
    });
    const aghalia = task({
      id: "aghalia",
      priority: "NORMAL",
      workDate: new Date(2026, 6, 10),
      readyDate: new Date(2026, 6, 12),
      manualDay: new Date(2026, 6, 5),
    });

    const selected = selectDailyWorkTasks({
      employee: designer,
      tasks: [jobs, aghalia],
      companies,
      today: new Date(2026, 6, 5),
    });

    // The promoted card tops the queue (the actual swap also parks «jobs» on a
    // later day — see the next test — which then drops it from today entirely).
    expect(selected[0].id).toBe("aghalia");
  });

  it("holds a card parked on a FUTURE day out of today's queue (المُستبعَدة)", () => {
    const designer = employee();
    const companies = [company({ id: "company", priority: 1 })];
    // «jobs» was displaced to its owner's next working day; only «aghalia» (its
    // manualDay is today) should surface today.
    const aghalia = task({ id: "aghalia", manualDay: new Date(2026, 6, 5) });
    const jobs = task({
      id: "jobs",
      workDate: new Date(2026, 6, 1),
      readyDate: new Date(2026, 6, 3),
      manualDay: new Date(2026, 6, 6),
    });

    const selected = selectDailyWorkTasks({
      employee: designer,
      tasks: [aghalia, jobs],
      companies,
      today: new Date(2026, 6, 5),
    });

    expect(selected.map((item) => item.id)).toEqual(["aghalia"]);
  });

  it("ignores a manualDay that has already passed (self-expiry)", () => {
    const designer = employee();
    const companies = [company({ id: "company", priority: 1 })];
    // A stale manualDay from an earlier day must not keep pinning the card; normal
    // deadline order resumes.
    const stale = task({
      id: "stale",
      workDate: new Date(2026, 6, 10),
      readyDate: new Date(2026, 6, 12),
      manualDay: new Date(2026, 6, 1),
    });
    const earlier = task({
      id: "earlier",
      workDate: new Date(2026, 6, 2),
      readyDate: new Date(2026, 6, 3),
    });

    const selected = selectDailyWorkTasks({
      employee: designer,
      tasks: [stale, earlier],
      companies,
      today: new Date(2026, 6, 5),
    });

    expect(selected[0].id).toBe("earlier");
  });
});

/**
 * «الخطة أول مرحلة — قبل الخطة ولا مصمم ولا مصور بيشتغل» (القائدة 1/8/2026).
 * `blockedById` was written by the pipeline and shown on the board, but the day
 * queue never read it, so أيمن was handed «تجهيز التيمبليت — مانغو» while نوال's
 * plan card was still NOT_STARTED.
 */
describe("a card whose blocker is still open is not today's work", () => {
  const today = new Date(2026, 7, 2);
  const co = company({ id: "company" });

  it("holds the blocked card back while the blocker is open", () => {
    const plan = task({ id: "plan", stage: "WRITE", assigneeId: "writer", hours: 8 });
    const template = task({ id: "template", blockedById: "plan", hours: 6 });
    const selected = selectDailyWorkTasks({
      employee: employee(),
      tasks: [template],
      allTasks: [plan, template],
      companies: [co],
      today,
    });
    expect(selected).toEqual([]);
  });

  it("releases it the moment the blocker is done", () => {
    const plan = task({ id: "plan", stage: "WRITE", assigneeId: "writer", status: "DONE", board: "DONE" });
    const template = task({ id: "template", blockedById: "plan", hours: 6 });
    const selected = selectDailyWorkTasks({
      employee: employee(),
      tasks: [template],
      allTasks: [plan, template],
      companies: [co],
      today,
    });
    expect(selected.map((t) => t.id)).toEqual(["template"]);
  });

  it("follows the chain: blocked by a card that is itself blocked", () => {
    const brand = task({ id: "brand", stage: "PUBLISH", assigneeId: "owner" });
    const plan = task({ id: "plan", stage: "WRITE", assigneeId: "writer", blockedById: "brand", status: "DONE", board: "DONE" });
    const template = task({ id: "template", blockedById: "plan", hours: 6 });
    const selected = selectDailyWorkTasks({
      employee: employee(),
      tasks: [template],
      allTasks: [brand, plan, template],
      companies: [co],
      today,
    });
    expect(selected).toEqual([]);
  });

  it("ignores a blocker that no longer exists rather than freezing the card", () => {
    const template = task({ id: "template", blockedById: "deleted", hours: 6 });
    const selected = selectDailyWorkTasks({
      employee: employee(),
      tasks: [template],
      allTasks: [template],
      companies: [co],
      today,
    });
    expect(selected.map((t) => t.id)).toEqual(["template"]);
  });

  it("does not hang on a dependency cycle in the data", () => {
    const a = task({ id: "a", blockedById: "b" });
    const b = task({ id: "b", blockedById: "a" });
    expect(() =>
      selectDailyWorkTasks({ employee: employee(), tasks: [a, b], allTasks: [a, b], companies: [co], today }),
    ).not.toThrow();
  });
});

// كرت محجوز ما بينحسب متأخر — المتأخر هو حاجزه. أليسار كانت تطلع «Makhbar 7-4
// متأخر 15 يوم» لريل ماجد لسا ما صوّرو.
describe("makeBlockedPredicate", () => {
  it("بيعتبر الكرت محجوز طالما حاجزه مفتوح", () => {
    const shoot = task({ id: "shoot", stage: "SHOOT", assigneeId: "photographer" });
    const edit = task({ id: "edit", stage: "EDIT", blockedById: "shoot", assigneeId: "editor" });
    expect(makeBlockedPredicate([shoot, edit])(edit)).toBe(true);
  });

  it("بيفكّ الحجز لما التصوير يخلص", () => {
    const shoot = task({ id: "shoot", stage: "SHOOT", status: "DONE", board: "DONE" });
    const edit = task({ id: "edit", stage: "EDIT", blockedById: "shoot" });
    expect(makeBlockedPredicate([shoot, edit])(edit)).toBe(false);
  });

  it("الكرت بلا حاجز مو محجوز", () => {
    const t = task({ id: "solo" });
    expect(makeBlockedPredicate([t])(t)).toBe(false);
  });
});

/**
 * «الإنجاز اليومي بينتهي» — الفريق (١٧/٩/٢٠٢٦): لما الشخص يخلّص مهام اليوم ما
 * كان يطلعله «تم إنجاز مهامك اليوم»، بيضل يعرضله مهام إضافية من الأيام الجاية.
 * السبب: القائمة كانت تنعاد من المفتوح بس، فكل كرت بينقفل بيدخل مكانه غيره.
 */
describe("finished-today work and the next batch (§16)", () => {
  const today = new Date(2026, 8, 17, 14, 0); // Thursday 17/9 — inside the Sun→Thu week used below
  const workingToday = () => employee({ workDays: JSON.stringify([0, 1, 2, 3, 4]), rates: JSON.stringify({ POST: 6 }) });
  const co = company({ id: "company", priority: 1 });
  const doneAt = (d: Date) =>
    ({ status: "READY", board: "DONE", finishedAt: d, completedAt: d }) as const;

  it("counts the cards finished today against the rate and shows only the remainder", () => {
    const finished = Array.from({ length: 4 }, (_, i) =>
      task({ id: `done_${i}`, ...doneAt(new Date(2026, 8, 17, 11, 0)) }),
    );
    const open = Array.from({ length: 10 }, (_, i) => task({ id: `open_${i}` }));
    const work = selectDailyWork({
      employee: workingToday(),
      tasks: open,
      allTasks: [...finished, ...open],
      companies: [co],
      today,
    });
    expect(work.doneToday.map((t) => t.id)).toEqual(finished.map((t) => t.id));
    expect(work.doneLoad).toBeCloseTo(4 / 6);
    expect(work.dayFull).toBe(false);
    expect(work.queue).toHaveLength(2);
  });

  it("خلّص حصّة اليوم وعنده شغل مفتوح → بياخد الدفعة الجاية، ما بيضل فاضي (القائدة ١٣/١٠، §١٦)", () => {
    const finished = Array.from({ length: 6 }, (_, i) =>
      task({ id: `done_${i}`, ...doneAt(new Date(2026, 8, 17, 16, 30)) }),
    );
    const open = Array.from({ length: 10 }, (_, i) => task({ id: `open_${i}` }));
    const work = selectDailyWork({
      employee: workingToday(),
      tasks: open,
      allTasks: [...finished, ...open],
      companies: [co],
      today,
    });
    expect(work.dayFull).toBe(true);
    expect(work.queue).toHaveLength(6);
    expect(work.doneToday).toHaveLength(6);
  });

  it("…ولما ما يضل ولا كرت مفتوح، الطابور فاضي (متفرّغ)", () => {
    const finished = Array.from({ length: 6 }, (_, i) =>
      task({ id: `done_${i}`, ...doneAt(new Date(2026, 8, 17, 16, 30)) }),
    );
    const work = selectDailyWork({ employee: workingToday(), tasks: [], allTasks: finished, companies: [co], today });
    expect(work.queue).toEqual([]);
  });

  it("does not let a partially used day fall back to the whole-first-date dump", () => {
    // 5 of 6 done; the only open cards are full-day reels that cannot fit.
    const finished = Array.from({ length: 5 }, (_, i) =>
      task({ id: `done_${i}`, ...doneAt(new Date(2026, 8, 17, 12, 0)) }),
    );
    const emp = employee({ workDays: JSON.stringify([0, 1, 2, 3, 4]), rates: JSON.stringify({ POST: 6, AI_REEL: 1 }) });
    const reels = [task({ id: "reel_a", type: "AI_REEL" }), task({ id: "reel_b", type: "AI_REEL" })];
    const work = selectDailyWork({ employee: emp, tasks: reels, allTasks: [...finished, ...reels], companies: [co], today });
    expect(work.queue).toEqual([]);
    expect(work.dayFull).toBe(false);
  });

  it("كرت يوم كامل خلص اليوم وعنده بوستات مفتوحة → بياخدهن (ما بيضل فاضي)", () => {
    const emp = employee({ workDays: JSON.stringify([0, 1, 2, 3, 4]), rates: JSON.stringify({ POST: 6, AI_REEL: 1 }) });
    const reel = task({ id: "reel", type: "AI_REEL", ...doneAt(new Date(2026, 8, 17, 9, 0)) });
    const posts = Array.from({ length: 3 }, (_, i) => task({ id: `post_${i}` }));
    const work = selectDailyWork({ employee: emp, tasks: posts, allTasks: [reel, ...posts], companies: [co], today });
    expect(work.dayFull).toBe(true);
    expect(work.queue.map((t) => t.id)).toEqual(["post_0", "post_1", "post_2"]);
  });

  it("ignores work finished on another day", () => {
    const yesterday = Array.from({ length: 6 }, (_, i) =>
      task({ id: `y_${i}`, ...doneAt(new Date(2026, 8, 16, 17, 0)) }),
    );
    const open = Array.from({ length: 10 }, (_, i) => task({ id: `open_${i}` }));
    const work = selectDailyWork({ employee: workingToday(), tasks: open, allTasks: [...yesterday, ...open], companies: [co], today });
    expect(work.doneToday).toEqual([]);
    expect(work.queue).toHaveLength(6);
  });

  it("counts a card the lead pinned to today as today's achievement even when stamped on another date", () => {
    const pinned = task({
      id: "pinned",
      manualDay: new Date(2026, 8, 17),
      ...doneAt(new Date(2026, 8, 15, 10, 0)),
    });
    expect(isFinishedOnDay(pinned, "2026-09-17")).toBe(true);
    expect(isFinishedOnDay(task({ id: "open" }), "2026-09-17")).toBe(false);
  });

  it("still lists every publish card due today after some were published (publishing has no rate)", () => {
    const publisher = employee({ id: "publisher", role: "publisher", rates: null, workDays: JSON.stringify([0, 1, 2, 3, 4]) });
    const pub = (id: string, extra: Record<string, unknown> = {}) =>
      task({
        id,
        kind: "PUBLISH",
        stage: "PUBLISH",
        assigneeId: "publisher",
        publishDate: new Date(2026, 8, 17),
        readyDate: new Date(2026, 8, 17),
        workDate: new Date(2026, 8, 17),
        ...extra,
      });
    const published = pub("p1", { status: "PUBLISHED", board: "DONE", finishedAt: new Date(2026, 8, 17, 10, 0) });
    const due = pub("p2");
    const later = pub("p3", { publishDate: new Date(2026, 8, 20), readyDate: new Date(2026, 8, 20), workDate: new Date(2026, 8, 20) });
    const work = selectDailyWork({ employee: publisher, tasks: [due, later], allTasks: [published, due, later], companies: [co], today });
    expect(work.queue.map((t) => t.id)).toEqual(["p2"]);
    expect(work.doneToday.map((t) => t.id)).toEqual(["p1"]);
  });

  it("reports the day's achievement on a day off without queuing anything", () => {
    const finished = [task({ id: "d", ...doneAt(new Date(2026, 8, 18, 10, 0)) })];
    const friday = new Date(2026, 8, 18, 12, 0);
    const work = selectDailyWork({ employee: workingToday(), tasks: [task({ id: "o" })], allTasks: [...finished, task({ id: "o" })], companies: [co], today: friday });
    expect(work.queue).toEqual([]);
    expect(work.doneToday).toHaveLength(1);
  });
});

/**
 * القائدة (١١/١٠/٢٠٢٦): «ممنوع يكون في بس هيك متبقّي بدون ما تحدّد شو المهام».
 * بعد إعادة جدولة التوظيف من ١٢/١٠ صارت كروت سابين الـ١٢ كلها مثبّتة على أيام
 * لاحقة، فقائمة اليوم فاضية عن حقّ — بس اللوحة كانت تختصر الـ١٢ بعدد. الكرت
 * المستبعَد لازم يقول **ليش ولوين**: مثبّت على أي يوم، أو واقف على مين.
 */
describe("ليش الكرت المفتوح مو بقائمة اليوم (makeHeldReason)", () => {
  const todayISO = "2026-07-05";

  it("كرت مثبّت على يوم لاحق → مثبّت لحدّ هالتاريخ", () => {
    const parked = task({ id: "parked", isPinned: true, workDate: new Date(2026, 6, 6) });
    const reason = makeHeldReason([parked], todayISO)(parked);
    expect(reason).toEqual({ parkedUntil: "2026-07-06", blockedBy: null });
  });

  it("«بدّل» على يوم لاحق نفس الشي، والمثبّت على اليوم أو قبله مو مستبعَد", () => {
    const swapped = task({ id: "swapped", manualDay: new Date(2026, 6, 8) });
    const todayCard = task({ id: "today", isPinned: true, workDate: new Date(2026, 6, 5) });
    const pastCard = task({ id: "past", isPinned: true, workDate: new Date(2026, 6, 1) });
    const reasonOf = makeHeldReason([swapped, todayCard, pastCard], todayISO);
    expect(reasonOf(swapped)?.parkedUntil).toBe("2026-07-08");
    expect(reasonOf(todayCard)).toBeNull();
    expect(reasonOf(pastCard)).toBeNull();
  });

  it("كرت حاجزه مفتوح → بانتظار الحاجز نفسه (بصاحبه)", () => {
    const plan = task({ id: "plan", stage: "WRITE", assigneeId: "writer", status: "NOT_STARTED", board: "TODO" });
    const design = task({ id: "design", blockedById: "plan" });
    const reason = makeHeldReason([plan, design], todayISO)(design);
    expect(reason?.blockedBy?.id).toBe("plan");
    expect(reason?.parkedUntil).toBeNull();
  });

  it("بسلسلة حجز بيرجّع أول حاجز **مفتوح** — يلي الدور عليه فعلاً", () => {
    const shoot = task({ id: "shoot", stage: "SHOOT", assigneeId: "photographer" });
    const edit = task({ id: "edit", stage: "EDIT", assigneeId: "editor", blockedById: "shoot", board: "DONE", status: "READY", finishedAt: new Date(2026, 6, 3) });
    const publish = task({ id: "publish", stage: "PUBLISH", blockedById: "edit" });
    // المونتاج منجز بس التصوير (قبله) لسا مفتوح — تناقض بالداتا، والجواب الصادق هو التصوير.
    expect(makeHeldReason([shoot, edit, publish], todayISO)(publish)?.blockedBy?.id).toBe("shoot");
    const done = task({ id: "shoot2", stage: "SHOOT", board: "DONE", status: "READY", finishedAt: new Date(2026, 6, 3) });
    const edit2 = task({ id: "edit2", stage: "EDIT", blockedById: "shoot2" });
    expect(makeHeldReason([done, edit2], todayISO)(edit2)).toBeNull();
  });

  it("حاجز محذوف/مؤرشف ما بيعتبر حجزاً — متل makeBlockedPredicate", () => {
    const orphan = task({ id: "orphan", blockedById: "gone" });
    expect(makeHeldReason([orphan], todayISO)(orphan)).toBeNull();
  });

  it("الكرتان معاً: مثبّت على يوم لاحق وواقف على غيره", () => {
    const plan = task({ id: "plan", stage: "WRITE", assigneeId: "writer" });
    const both = task({ id: "both", blockedById: "plan", isPinned: true, workDate: new Date(2026, 6, 9) });
    expect(makeHeldReason([plan, both], todayISO)(both)).toEqual({ parkedUntil: "2026-07-09", blockedBy: plan });
  });

  it("لما كل المفتوح مثبّت على أيام لاحقة: القائمة فاضية وكل كرت عندو سبب — ما في «متبقّي» بلا تفسير", () => {
    const designer = employee();
    const companies = [company({ id: "company", priority: 1 })];
    const open = [12, 13, 15, 15, 19].map((day, i) =>
      task({ id: `post-${i}`, isPinned: true, workDate: new Date(2026, 9, day), readyDate: new Date(2026, 9, day) }),
    );
    const today = new Date(2026, 9, 11); // الأحد ١١/١٠ — يوم شغل
    const work = selectDailyWork({ employee: designer, tasks: open, companies, today });
    expect(work.queue).toEqual([]);
    expect(work.doneToday).toEqual([]);
    const reasonOf = makeHeldReason(open, "2026-10-11");
    expect(open.map((t) => reasonOf(t)?.parkedUntil)).toEqual([
      "2026-10-12", "2026-10-13", "2026-10-15", "2026-10-15", "2026-10-19",
    ]);
  });
});

describe("[القائدة ١٣/١٠ · §١٦] كرت كتابة الخطة المفتوح ما بيحجز قطعة نصّها عليها", () => {
  const today = new Date(2026, 8, 17, 14, 0);
  const workingToday = () => employee({ workDays: JSON.stringify([0, 1, 2, 3, 4]), rates: JSON.stringify({ POST: 6 }) });
  const co = company({ id: "company", priority: 1 });
  // سابين: خطة التوظيف — كرت الكتابة (نوال) لسا مفتوح، بس نصوص البوستات انستوردت على
  // كروتها. كانت كل التصاميم محجوزة فطلعلها بوست واحد من شركة تانية.
  const write = task({ id: "write", kind: "CONTENT_WRITING", stage: "WRITE", type: null, assigneeId: "nawal" });
  const briefed = Array.from({ length: 4 }, (_, i) =>
    task({ id: `jobs_${i}`, stage: "DESIGN", blockedById: "write", brief: `نص بوست ${i + 1}` }),
  );
  const noText = task({ id: "jobs_x", stage: "DESIGN", blockedById: "write", brief: null });

  it("البوستات يلي نصّها عليها بتنعطى، والبلا نص بيضل محجوز ورا الكتابة", () => {
    const all = [write, ...briefed, noText];
    const work = selectDailyWork({ employee: workingToday(), tasks: all, allTasks: all, companies: [co], today });
    expect(work.queue.map((t) => t.id).sort()).toEqual(["jobs_0", "jobs_1", "jobs_2", "jobs_3"]);
  });
});
