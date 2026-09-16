/**
 * الفحص البنيوي — العلاقات بين الوحدات (طلب القائدة 3/8/2026).
 *
 * «بدي فحص بنيوي ومنطقي والعلاقات. أي تغيير بأي قيمة وشو ممكن يأثر على باقي
 * الوحدات المتعلقة فيها.» — فكل اختبار هون بيحرس **علاقة** لا وحدة: بيغيّر
 * قيمة بطرف وبيتحقق من الطرف التاني. الوحدات لحالها مفحوصة بملفاتها
 * (pipeline.test.ts، workload.test.ts…)؛ هون الخريطة اللي بتربطها:
 *
 *   خطة الشركة ──► المحرّك ──► كروت خط الإنتاج ──► الحفظ عبر إعادة الجدولة
 *        │                          │                      │
 *        ▼                          ▼                      ▼
 *   دورة العقد ◄── المطابقة ──► إقفال الكروت ──► الإنجاز (منتَج/منشور)
 *        │                                              │
 *        ▼                                              ▼
 *   البريف الصباحي ◄──────────────────────────── الحمل الشهري
 *
 * كل قاعدة محروسة هون موثّقة بـ WORK_RULES.md مع الغلطة اللي ولّدتها.
 */
import { describe, expect, it } from "vitest";
import { buildSchedule, type SchedulerState } from "@/lib/scheduler";
import { expandPipeline, type PipelineTask } from "@/lib/pipeline";
import { applyPipelinePreservation } from "@/lib/pipeline-preservation";
import { computeWorkload } from "@/lib/workload";
import { completedCompanyPlanCount, producedCompanyPlanCount } from "@/lib/progress";
import { currentCycleBucket, cyclesOf } from "@/lib/contract";
import { matchDelivery, type Delivery, type MatchCandidate } from "@/lib/telegram/match";
import { assetName } from "@/lib/asset-name";
import { briefMessagesFor, buildDailyBrief, type DailyBrief } from "@/lib/telegram/brief";
import { specState, specCompanies, EMP } from "./_helpers/spec-fixture";

// ════════════════════════════════════════════════════════ أدوات مشتركة

const delivery = (fileName: string, kind: "VIDEO" | "PHOTO", day = 3): Delivery => ({
  id: "x",
  chatId: "c",
  messageId: 1,
  sentAt: new Date(2026, 7, day),
  senderId: null,
  senderName: null,
  kind,
  fileName,
  caption: null,
  fileId: null,
  mediaGroupId: null,
});

/** كرت مطابقة بأقل ما يلزم — نفس شكل Task اللي بيوصل للمطابق. */
const candidate = (o: Partial<MatchCandidate> & { id: string }): MatchCandidate =>
  ({
    type: "REEL",
    stage: "SHOOT",
    month: 6,
    year: 2026,
    pieceNo: 1,
    readyDate: new Date(2026, 6, 20),
    publishDate: new Date(2026, 7, 5),
    brief: null,
    ...o,
  }) as MatchCandidate;

/** كرت كامل بشكل Prisma — للإنجاز والحمل. */
const task = (o: Record<string, unknown>) =>
  ({
    id: `t_${Math.random().toString(36).slice(2)}`,
    kind: "CONTENT",
    type: "POST",
    title: null,
    hours: 0,
    quantity: 1,
    pieceNo: null,
    priority: "NORMAL",
    status: "NOT_STARTED",
    board: "TODO",
    stage: "DESIGN",
    publishDate: null,
    readyDate: null,
    workDate: null,
    manualDay: null,
    week: null,
    overflow: false,
    month: 6,
    year: 2026,
    isPinned: false,
    isAuto: true,
    blockedById: null,
    pipelineKey: null,
    detKey: null,
    notes: null,
    brief: null,
    startedAt: null,
    finishedAt: null,
    completedAt: null,
    companyId: "c1",
    assigneeId: null,
    ...o,
  }) as never;

// ════════════════════════════════ ١. خطة الشركة ← المحرّك (وشعاع التغيير)

describe("العلاقة: خطة الشركة ← المحرّك", () => {
  const count = (state: SchedulerState, coId: string, type: string) =>
    buildSchedule(state).tasks.filter((t) => t.companyId === coId && t.type === type).length;

  it("عدد كروت كل نوع = رقم الخطة بالضبط، لكل شركة", () => {
    const state = specState();
    const r = buildSchedule(state);
    for (const co of state.companies) {
      for (const [type, plan] of [
        ["POST", co.posts],
        ["REEL", co.reels],
        ["STORY", co.stories],
        ["AI_REEL", co.aiReels],
      ] as const) {
        const got = r.tasks.filter((t) => t.companyId === co.id && t.type === type).length;
        expect(got, `${co.name} ${type}`).toBe(plan);
      }
    }
  });

  it("شعاع التغيير: posts 4→6 بيزيد كرتين للشركة نفسها وولا كرت لغيرها", () => {
    const before = specState();
    const after = specState();
    after.companies = specCompanies().map((c) => (c.id === "c_bw" ? { ...c, posts: 6 } : c));

    expect(count(after, "c_bw", "POST")).toBe(count(before, "c_bw", "POST") + 2);
    // باقي الشركات ما بتتأثر ولا بكرت — العزل جزء من العقد.
    for (const co of before.companies.filter((c) => c.id !== "c_bw")) {
      const b = buildSchedule(before).tasks.filter((t) => t.companyId === co.id).length;
      const a = buildSchedule(after).tasks.filter((t) => t.companyId === co.id).length;
      expect(a, co.name).toBe(b);
    }
  });

  it("الحتمية: نفس المدخلات مرتين = نفس المفاتيح بايت ببايت", () => {
    const keys = () =>
      buildSchedule(specState())
        .tasks.map((t) => t.detKey)
        .join("|");
    expect(keys()).toBe(keys());
  });

  it("ولا موعد شغل بيقع برّا أيام دوام صاحبه", () => {
    const state = specState();
    const byId = new Map(state.employees.map((e) => [e.id, e]));
    for (const t of buildSchedule(state).tasks) {
      if (!t.assigneeId || !t.workDate) continue;
      const days = byId.get(t.assigneeId)!.workDays as number[];
      expect(days, `${t.title} → ${t.workDate.toDateString()}`).toContain(t.workDate.getDay());
    }
  });
});

// ═══════════════════════════ ٢. دورة العقد ← الباكت ← الإنجاز (شعاع التاريخ)

describe("العلاقة: تاريخ العقد ← الدورة ← وين بينقرا الإنجاز", () => {
  const co = (contractStartDate: Date | null) =>
    ({
      id: "c1",
      name: "شركة",
      contractStartDate,
      publishStartDate: contractStartDate,
      renewals: null,
      contractEndedAt: null,
    }) as never;

  it("شركة عقدها 15/7: يوم 3/8 لسا بدورة تموز — مو بشهر آب التقويمي", () => {
    const b = currentCycleBucket(co(new Date(2026, 6, 15)), new Date(2026, 7, 3));
    expect([b.year, b.month]).toEqual([2026, 6]);
  });

  it("شركة بلا عقد بتمشي على شهر التقويم", () => {
    const b = currentCycleBucket(co(null), new Date(2026, 7, 3));
    expect([b.year, b.month]).toEqual([2026, 7]);
  });

  it("شعاع التغيير: تحريك تاريخ العقد بينقل الباكت — والإنجاز لازم ينقرا من الجديد", () => {
    // نفس اليوم (3/8)، تاريخا عقد مختلفان → دورتان مختلفتان. أي شاشة بتقرا
    // إنجاز «الدورة الحالية» لازم تلحق الباكت، وإلا بتطلع «0/15» لشركة نصّ
    // دورتها خالص — الغلطة اللي صارت بالتقارير وفحص ما قبل النشر.
    const early = currentCycleBucket(co(new Date(2026, 6, 1)), new Date(2026, 7, 3));
    const late = currentCycleBucket(co(new Date(2026, 6, 15)), new Date(2026, 7, 3));
    expect(early.month).toBe(7); // دورة 1/7 خلصت، صرنا بدورة 1/8
    expect(late.month).toBe(6); // دورة 15/7 لسا شغّالة

    const publishedInJuly = [
      task({ stage: "PUBLISH", month: 6, year: 2026, status: "PUBLISHED", board: "DONE", pieceNo: 1, pipelineKey: "p1" }),
    ];
    // بباكت تموز القطعة بتنحسب؛ بباكت آب ما في شي — الرقمان مختلفان بالضرورة.
    expect(completedCompanyPlanCount(publishedInJuly as never, "c1")).toBe(1);
    expect(
      completedCompanyPlanCount(
        (publishedInJuly as { month: number }[]).filter((t) => t.month === 7) as never,
        "c1",
      ),
    ).toBe(0);
  });

  it("الدورات متعاقبة يوم-بيوم بلا فجوة ولا تداخل", () => {
    const c = co(new Date(2026, 5, 15));
    const cycles = cyclesOf(c as never);
    for (let i = 1; i < cycles.length; i++)
      expect(cycles[i].start.getTime(), `دورة ${i}`).toBe(cycles[i - 1].end.getTime());
  });
});

// ═══════════════════ ٣. خط الإنتاج: السلسلة + الحفظ عبر إعادة الجدولة

describe("العلاقة: كروت القطعة ← بعضها ← إعادة الجدولة", () => {
  const baseItem = {
    id: "c_x|REEL|2026-07-07|1",
    companyId: "c_x",
    type: "REEL" as const,
    assigneeId: "e_photo",
    publishDate: "2026-07-07",
    readyDate: "2026-07-05",
    workDate: "2026-07-03",
    week: 1,
    status: "NOT_STARTED",
  };
  const opts = {
    writerId: "e_writer",
    publisherId: "e_pub",
    editorId: "e_editor",
    editorWorkDays: [0, 1, 2, 3, 4],
    writerWorkDays: [0, 1, 2, 3, 4],
    year: 2026,
    month: 6,
    companyName: () => "شركة",
  } as never;

  const pipeOf = () => expandPipeline([{ ...baseItem }] as never, opts);

  it("الريل بيتفكك تصوير ← مونتاج ← نشر، وكل مرحلة محجوزة باللي قبلها", () => {
    const pipe = pipeOf();
    const stages = pipe.map((t) => t.stage);
    expect(stages).toContain("SHOOT");
    expect(stages).toContain("EDIT");
    expect(stages).toContain("PUBLISH");
    const by = new Map(pipe.map((t) => [t.stage, t]));
    expect(by.get("EDIT")!.blockedById).toBe(by.get("SHOOT")!.id);
    expect(by.get("PUBLISH")!.blockedById).toBe(by.get("EDIT")!.id);
  });

  it("شعاع التغيير: إعادة جدولة بتغيّر كل التواريخ — الحالة والدليل والنص بيلحقوا القطعة", () => {
    // تغيير مصمم الشركة بيعيد توقيت كل الكروت، فمفتاح الجدول (pipelineKey)
    // بيتغيّر. القطعة رقم ١ بتضل رقم ١ — وعليها بتنحفظ الحالة والوصف والدليل.
    const pipe = expandPipeline(
      [{ ...baseItem, id: "c_x|REEL|2026-07-20|1", publishDate: "2026-07-20" }] as never,
      opts,
    );
    applyPipelinePreservation(pipe, [
      {
        pipelineKey: "OLD|2026-07-07", // مفتاح قديم ما عاد موجود
        stage: "SHOOT",
        board: "DONE",
        status: "READY",
        isPinned: false,
        title: null,
        workDate: null,
        readyDate: null,
        assigneeId: null,
        priority: null,
        quantity: 1,
        companyId: "c_x",
        type: "REEL",
        publishDate: new Date(2026, 6, 7),
        kind: "CONTENT",
        pieceNo: 1,
        brief: "نصّ الخطة",
        notes: "سُلّم على تلغرام (بالاسم): X 7-1.mp4",
        finishedAt: new Date(2026, 6, 5),
      },
    ]);
    const shoot = pipe.find((t) => t.stage === "SHOOT")!;
    expect(shoot.board).toBe("DONE");
    expect(shoot.brief).toBe("نصّ الخطة");
    expect(shoot.notes).toContain("سُلّم على تلغرام");
    expect(shoot.finishedAt?.getTime()).toBe(new Date(2026, 6, 5).getTime());
  });
});

// ══════════════════════ ٤. المطابقة ← إقفال الكروت ← الإنجاز (السلسلة كاملة)

describe("العلاقة: ملف على تلغرام ← الكرت ← رقم الإنجاز", () => {
  // دورة 15/7←14/8: الكروت بباكت تموز والنشر بآب — الحالة اللي ولّدت قاعدة الدورة.
  const BUCKET = { year: 2026, month: 6 };
  const shoot = candidate({ id: "shoot1", stage: "SHOOT" });
  const edit = candidate({ id: "edit1", stage: "EDIT", readyDate: new Date(2026, 6, 22) });

  it("التسميتان — شهر الدورة وشهر النشر — بيوصلوا لنفس القطعة", () => {
    for (const name of [assetName("Makhbar", 6, 1), assetName("Makhbar", 7, 1)]) {
      const hit = matchDelivery(delivery(`${name}.mp4`, "VIDEO"), "Makhbar", [shoot, edit], [], [], BUCKET);
      expect(hit?.taskId, name).toBe("shoot1");
    }
  });

  /**
   * القطعة إلها كذا مرحلة بنفس تاريخ النشر، فترتيب «الأبكر موعداً» بيقع بتعادل
   * وبيربح أول كرت بالصدفة. صار فعلاً بالتوظيف (٣/٩): مونتاج أليسار
   * «phoenijobs 1-9.mp4» سكّر كرت **التصوير** وضلّ كرت **المونتاج** مفتوح،
   * والقائدة قرأتها «الريل ما انلقط». مين بعت بيحسم أي مرحلة خلصت.
   */
  it("مرحلة المرسِل بتربح التعادل: مونتاج المونتيرة بيسكّر المونتاج مو التصوير", () => {
    const ELISSAR = "e_elissar";
    const MAJED = "e_majed";
    // نفس تاريخ النشر للمرحلتين — التعادل يلي كان بيوقع الغلط.
    const sameDay = new Date(2026, 8, 5);
    const sh = candidate({ id: "shoot1", stage: "SHOOT", publishDate: sameDay, assigneeId: MAJED });
    const ed = candidate({ id: "edit1", stage: "EDIT", publishDate: sameDay, assigneeId: ELISSAR });
    const file = `${assetName("Makhbar", 6, 1)}.mp4`;

    // بلا مرسِل معروف: الترتيب القديم (التصوير أولاً) — ما بينكسر شي.
    expect(matchDelivery(delivery(file, "VIDEO"), "Makhbar", [sh, ed], [], [], BUCKET)?.taskId).toBe("shoot1");
    // من المونتيرة → المونتاج.
    expect(
      matchDelivery(delivery(file, "VIDEO"), "Makhbar", [sh, ed], [], [], BUCKET, undefined, ELISSAR)?.taskId,
    ).toBe("edit1");
    // من المصوّر → التصوير.
    expect(
      matchDelivery(delivery(file, "VIDEO"), "Makhbar", [sh, ed], [], [], BUCKET, undefined, MAJED)?.taskId,
    ).toBe("shoot1");
    // مرسِل ما إلو ولا مرحلة بهالقطعة → الترتيب القديم، بلا تخريب.
    expect(
      matchDelivery(delivery(file, "VIDEO"), "Makhbar", [sh, ed], [], [], BUCKET, undefined, "e_gharib")?.taskId,
    ).toBe("shoot1");
  });

  it("دورة حياة القطعة: تصوير ← مونتاج ← إعادة إرسال مرفوضة — وكل خطوة بتحرّك «منتَج»", () => {
    const name = `${assetName("Makhbar", 7, 1)}.mp4`;
    // ١: القطعة كلها مفتوحة → الملف بيسكّر التصوير.
    expect(matchDelivery(delivery(name, "VIDEO"), "Makhbar", [shoot, edit], [], [], BUCKET)?.taskId).toBe("shoot1");
    // ٢: التصوير مسكّر → نفس الاسم بيسكّر المونتاج (مو «إعادة إرسال»).
    expect(matchDelivery(delivery(name, "VIDEO"), "Makhbar", [edit], [], [shoot], BUCKET)?.taskId).toBe("edit1");
    // ٣: القطعة خالصة → نفس الاسم إعادة إرسال، ممنوع يسكّر قطعة تانية.
    const other = candidate({ id: "shoot2", stage: "SHOOT", pieceNo: 2, publishDate: new Date(2026, 7, 10) });
    expect(matchDelivery(delivery(name, "VIDEO"), "Makhbar", [other], [], [shoot, edit], BUCKET)).toBeNull();

    // …والإنجاز بيلحق: قبل الإقفال منتَج 0، بعد تصوير+مونتاج منتَج 1 ومنشور 0،
    // وبعد النشر منشور 1. نفس القطعة، تلات أرقام بتتحرك بالترتيب الصح.
    const pk = "c1|REEL|2026-08-05";
    const mk = (stage: string, done: boolean, published = false) =>
      task({
        stage,
        type: "REEL",
        pieceNo: 1,
        pipelineKey: pk,
        status: done ? (published ? "PUBLISHED" : "READY") : "NOT_STARTED",
        board: done ? "DONE" : "TODO",
      });
    const openAll = [mk("SHOOT", false), mk("EDIT", false), mk("PUBLISH", false)];
    const produced1 = [mk("SHOOT", true), mk("EDIT", true), mk("PUBLISH", false)];
    const published1 = [mk("SHOOT", true), mk("EDIT", true), mk("PUBLISH", true, true)];
    expect(producedCompanyPlanCount(openAll as never, "c1")).toBe(0);
    expect(producedCompanyPlanCount(produced1 as never, "c1")).toBe(1);
    expect(completedCompanyPlanCount(produced1 as never, "c1")).toBe(0); // منتَج ≠ منشور
    expect(completedCompanyPlanCount(published1 as never, "c1")).toBe(1);
  });

  it("قاعدة الكلمتين: «منتَج» عمره ما بيقل عن «منشور»", () => {
    // علاقة رياضية لازم تصمد مهما تغيّرت الداتا: النشر آخر خط، فكل منشور منتَج.
    const rows = [
      task({ stage: "SHOOT", type: "REEL", pieceNo: 1, pipelineKey: "k1", status: "READY", board: "DONE" }),
      task({ stage: "EDIT", type: "REEL", pieceNo: 1, pipelineKey: "k1", status: "READY", board: "DONE" }),
      task({ stage: "PUBLISH", type: "REEL", pieceNo: 1, pipelineKey: "k1", status: "PUBLISHED", board: "DONE" }),
      task({ stage: "DESIGN", type: "POST", pieceNo: 1, pipelineKey: "k2", status: "READY", board: "DONE" }),
      task({ stage: "PUBLISH", type: "POST", pieceNo: 1, pipelineKey: "k2", status: "NOT_STARTED", board: "TODO" }),
    ];
    expect(producedCompanyPlanCount(rows as never, "c1")).toBeGreaterThanOrEqual(
      completedCompanyPlanCount(rows as never, "c1"),
    );
  });
});

// ═══════════════════════════════ ٥. الكروت ← الحمل الشهري (شعاع الإسناد)

describe("العلاقة: إسناد كرت ← حمل صاحبه", () => {
  const employees = [
    {
      id: "e1",
      name: "مصمم",
      role: "designer",
      hoursPerDay: 6,
      workDays: JSON.stringify([0, 1, 2, 3, 4]),
      isScheduled: true,
      isPhotographer: false,
      salary: 0,
      costPerReel: null,
      color: null,
      rates: JSON.stringify({ POST: 4 }),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ] as never;

  const row = (tasks: unknown[]) =>
    computeWorkload(employees, tasks as never, 2026, 6, [], [] as never).find(
      (r) => r.employee.id === "e1",
    )!;

  it("إسناد كرت بيرفع الالتزام، وإنجازه ما بيرجّعه (الالتزام ثابت-الإنجاز)", () => {
    const open = task({ assigneeId: "e1", workDate: new Date(2026, 6, 5), status: "NOT_STARTED" });
    const done = task({
      assigneeId: "e1",
      workDate: new Date(2026, 6, 5),
      status: "READY",
      board: "DONE",
      finishedAt: new Date(2026, 6, 5),
    });
    const withOpen = row([open]);
    const withDone = row([done]);
    expect(withOpen.committedDays).toBeGreaterThan(0);
    // القاعدة (feedback_plan_driven_workload): الحمل التزام شهري، إنجاز الشغل
    // بينقله من «باقي» لـ«منجز» بس ما بيمحيه من الالتزام.
    expect(withDone.committedDays).toBe(withOpen.committedDays);
    expect(withDone.doneDays).toBeGreaterThan(0);
  });

  it("شعاع التغيير: نقل الكرت لشخص تاني بينقل الحمل معه بالكامل", () => {
    const mine = task({ assigneeId: "e1", workDate: new Date(2026, 6, 5) });
    const theirs = task({ assigneeId: "e2", workDate: new Date(2026, 6, 5) });
    expect(row([mine]).committedDays).toBeGreaterThan(0);
    expect(row([theirs]).committedDays).toBe(0);
  });
});

// ═══════════════════════════════ ٦. كل شي ← البريف الصباحي (الصيغة المتفقة)

describe("العلاقة: حالة النظام ← رسائل البريف (الصيغة المتفق عليها)", () => {
  const brief = (): DailyBrief =>
    buildDailyBrief({
      today: new Date(2026, 7, 3),
      employees: [
        {
          id: EMP.ayman,
          name: "أيمن",
          role: "designer",
          hoursPerDay: 6,
          workDays: JSON.stringify([0, 1, 2, 3, 4]),
          isScheduled: true,
          isPhotographer: false,
          salary: 1,
          rates: JSON.stringify({ POST: 4 }),
        },
      ],
      companies: [
        {
          id: "c1", name: "وصل للتداول", slug: "Wasl", managed: true, status: "active",
          priority: 1, lateExemptReason: null, posts: 4, reels: 0, stories: 4, aiReels: 0,
        },
      ],
      tasks: [
        task({
          assigneeId: EMP.ayman,
          companyId: "c1",
          type: "STORY",
          stage: "DESIGN",
          pieceNo: 7,
          month: 6,
          workDate: new Date(2026, 7, 3),
          readyDate: new Date(2026, 7, 3),
          publishDate: new Date(2026, 7, 4),
        }),
      ],
      sessions: [],
      deliveries: { matched: 0, unmatched: 0 },
    } as never);

  it("موجة ٧:٤٥ = رسالة وحدة: توزيع المهام (القائدة ١٦/٩)", () => {
    const msgs = briefMessagesFor(brief(), "general");
    expect(msgs.map((m) => m.key)).toEqual(["schedule"]);
  });

  it("قاعدة الموجتين: رسالة ٧:٤٥ بلا ولا اسم قطعة ولا تاريخ — التفاصيل موجة تانية", () => {
    // feedback_brief_two_waves: «أي اسم قطعة أو تاريخ أو عدد أيام بينتمي لموجة ٨:٠٠».
    const schedule = brief().schedule.text;
    // (١٦/٩) الشركة والعدد والنوع مسموحة («وصل 3 ستوري»)؛ الممنوع أرقام القطع
    // والتواريخ وعدد أيام التأخير.
    expect(schedule).not.toMatch(/\d+\s*-\s*\d+/); // «Wasl 7-2»
    expect(schedule).not.toMatch(/بوست-\d|ستوري-\d|ريل-\d|تسليم \d|\d+ يوم/);
  });

  it("موجة ٨:٠٠ = التقرير المفصّل الواحد، مو رشقة رسائل لكل شركة وشخص", () => {
    // شكوى القائدة (3/8): «كل يوم عم يوصلني كتييير مسجات باسلوب عشوائي ما عم
    // استفيد منه». الصيغة المتفقة: تقرير واحد بأقسام تصميم/تصوير ومونتاج/نشر؛
    // أوراق الشركات والأشخاص بتضل بالداشبورد تنبعت عند الطلب.
    const msgs = briefMessagesFor(brief(), "detail");
    expect(msgs.map((m) => m.key)).toEqual(["detail"]);
    expect(msgs[0].text).toContain("🎨 للتصميم");
  });

  it("«الكل» = التوزيع ثم التفاصيل — رسالتان، وتقرير القائد للمعاينة فقط", () => {
    expect(briefMessagesFor(brief(), "all").map((m) => m.key)).toEqual(["schedule", "detail"]);
  });
});
