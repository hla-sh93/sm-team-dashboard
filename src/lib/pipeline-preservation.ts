import type { PipelineTask } from "./pipeline";

export type ExistingPipelineTaskState = {
  pipelineKey: string | null;
  stage: string | null;
  board: string | null;
  status: string;
  isPinned: boolean;
  title: string | null;
  workDate: Date | null;
  readyDate: Date | null;
  manualDay?: Date | null;
  assigneeId: string | null;
  priority: string | null;
  quantity: number | null;
  companyId: string | null;
  type: string | null;
  publishDate: Date | null;
  kind: string | null;
  // Work history — preserved together with board/status so regen never resets
  // when work actually began/finished (reports compute actual durations from
  // these).
  startedAt?: Date | null;
  finishedAt?: Date | null;
  completedAt?: Date | null;
  // The plan's own words (§14). Imported once per month from the client's .docx
  // and NOT re-derivable by the engine, so a regeneration that drops it destroys
  // the only thing that makes delivery-matching honest: without a brief the
  // matcher falls back to blind type-matching and inflates every figure. This
  // silently wiped 29 rows of مركز البلسم and all of التوظيف before it was found.
  brief?: string | null;
  // ليش الكرت بهالحالة: «سُلّم على تلغرام (بالاسم): al balsam-post -8-3.jpg»،
  // «أُعيد فتحه بعد فحص المحتوى…». التوليد ما بيقدر يستنتجها، وبلاها الكرت
  // بيصير مسكّر بلا دليل — وهاد بالضبط اللي بيخلّي التقارير تخمين.
  notes?: string | null;
  // Stable piece identity — see PIECE-KEY note in applyPipelinePreservation.
  pieceNo?: number | null;
  // مراجعة القائدة — كانت بتنمحى بأول إعادة توليد (RG-07).
  reviewedAt?: Date | null;
  reviewedById?: string | null;
};

type CanceledPiece = {
  pipelineKey: string;
  companyId: string;
  type: string;
  publishDate: string | null;
};

function iso(d: Date | null): string | null {
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function piecePlanKey(companyId: string | null, type: string | null): string | null {
  return companyId && type ? `${companyId}|${type}` : null;
}

// المونتاج مرحلة قطعة متل غيرها — لازم حالتها وبريفها يصمدوا عبر إعادة الجدولة
// متل التصوير والنشر، وإلا كل ريجن بيمسح شغل أليسار.
function isPieceStage(stage: string | null): boolean {
  return stage === "DESIGN" || stage === "SHOOT" || stage === "EDIT" || stage === "PUBLISH";
}

function isPieceTask(task: Pick<PipelineTask, "pipelineKey" | "companyId" | "type" | "stage">) {
  return !!task.pipelineKey && !!task.companyId && !!task.type && isPieceStage(task.stage);
}

function cancelPipelinePiece(pipe: PipelineTask[], pipelineKey: string) {
  for (const task of pipe) {
    if (task.pipelineKey !== pipelineKey || !isPieceStage(task.stage)) continue;
    task.status = "CANCELED";
    task.board = "TODO";
    task.isPinned = true;
  }
}

/**
 * Cancelled pieces that must be re-applied by SCHEDULE — i.e. only the legacy
 * rows that carry no piece number.
 *
 * A numbered cancelled piece is restored by its number in the main loop (status
 * CANCELED + pin, like any saved state). Re-applying it here through its OLD
 * `pipelineKey` / plan date — which both move on every re-time — used to land
 * on a DIFFERENT piece, and the last resort («the first piece of the plan»)
 * cancelled whatever came first, finished pieces included: shifting a contract
 * by 5 days turned a DONE post into TODO/CANCELED (فحص ١٢/١٠، RG-01).
 */
function collectCanceledPieces(existing: ExistingPipelineTaskState[]): CanceledPiece[] {
  const byKey = new Map<string, CanceledPiece>();
  for (const task of existing) {
    if (task.status !== "CANCELED") continue;
    if (task.pieceNo != null) continue;
    if (!task.pipelineKey || !task.companyId || !task.type || !isPieceStage(task.stage)) continue;
    byKey.set(task.pipelineKey, {
      pipelineKey: task.pipelineKey,
      companyId: task.companyId,
      type: task.type,
      publishDate: iso(task.publishDate),
    });
  }
  return [...byKey.values()];
}

function applyCanceledPieces(pipe: PipelineTask[], canceledPieces: CanceledPiece[]) {
  if (canceledPieces.length === 0) return;

  const piecesByKey = new Map<string, PipelineTask[]>();
  const piecesByPlanDate = new Map<string, string[]>();
  const piecesByPlan = new Map<string, string[]>();

  for (const task of pipe) {
    if (!isPieceTask(task)) continue;
    const piece = piecesByKey.get(task.pipelineKey!) ?? [];
    piece.push(task);
    piecesByKey.set(task.pipelineKey!, piece);
  }

  const orderedPieceKeys = [...piecesByKey.entries()]
    .map(([pipelineKey, tasks]) => {
      const sample = tasks[0];
      return {
        pipelineKey,
        plan: piecePlanKey(sample.companyId, sample.type)!,
        publishDate: sample.publishDate,
      };
    })
    .sort(
      (a, b) =>
        (a.publishDate ?? "").localeCompare(b.publishDate ?? "") ||
        a.pipelineKey.localeCompare(b.pipelineKey),
    );

  for (const piece of orderedPieceKeys) {
    const byPlan = piecesByPlan.get(piece.plan) ?? [];
    byPlan.push(piece.pipelineKey);
    piecesByPlan.set(piece.plan, byPlan);

    if (piece.publishDate) {
      const dateKey = `${piece.plan}|${piece.publishDate}`;
      const byDate = piecesByPlanDate.get(dateKey) ?? [];
      byDate.push(piece.pipelineKey);
      piecesByPlanDate.set(dateKey, byDate);
    }
  }

  // A piece that already carries a saved state (matched by number) or is done
  // is never a cancellation target — a schedule key can only guess.
  const settledKeys = new Set(
    pipe
      .filter((t) => isPieceTask(t) && (t.status === "CANCELED" || t.board === "DONE" || t.startedAt || t.finishedAt))
      .map((t) => t.pipelineKey!),
  );
  const canceledNow = new Set<string>();
  const cancelFirstAvailable = (keys: string[] | undefined): boolean => {
    for (const key of keys ?? []) {
      if (canceledNow.has(key) || settledKeys.has(key)) continue;
      cancelPipelinePiece(pipe, key);
      canceledNow.add(key);
      return true;
    }
    return false;
  };

  for (const oldPiece of canceledPieces) {
    if (piecesByKey.has(oldPiece.pipelineKey) && !canceledNow.has(oldPiece.pipelineKey)) {
      cancelPipelinePiece(pipe, oldPiece.pipelineKey);
      canceledNow.add(oldPiece.pipelineKey);
      continue;
    }

    const plan = piecePlanKey(oldPiece.companyId, oldPiece.type);
    if (!plan) continue;
    if (oldPiece.publishDate && cancelFirstAvailable(piecesByPlanDate.get(`${plan}|${oldPiece.publishDate}`))) {
      continue;
    }
    // Legacy (unnumbered) rows only: keep the plan's deleted-piece count by
    // cancelling the first piece still untouched — never a settled one.
    cancelFirstAvailable(piecesByPlan.get(plan));
  }
}

// Piece identity — company, type, number, stage. Null for a card that carries
// no number (the WRITE card, legacy rows from before numbering).
function pieceKeyOf(row: {
  companyId: string | null;
  type: string | null;
  pieceNo?: number | null;
  stage: string | null;
}): string | null {
  if (!row.companyId || !row.type || row.pieceNo == null || !row.stage || row.stage === "WRITE") {
    return null;
  }
  return `${row.companyId}|${row.type}|${row.pieceNo}|${row.stage}`;
}

/**
 * Returns the saved rows that were handed to a card of this run. A saved row
 * NOT in the set is about to be replaced by nothing — the engine refuses to do
 * that silently when the row carries work or a plan text (RG-02).
 */
export function applyPipelinePreservation(
  pipe: PipelineTask[],
  existing: ExistingPipelineTaskState[],
): Set<ExistingPipelineTaskState> {
  const matched = new Set<ExistingPipelineTaskState>();
  // Several saved rows can sit behind one schedule key (two pieces publishing
  // the same day share the plan-date key), so the schedule maps keep every
  // candidate in order and the lookup takes the first one still available.
  const byPipelineStage = new Map<string, ExistingPipelineTaskState[]>();
  for (const task of existing) {
    const key = `${task.pipelineKey}|${task.stage}`;
    const rows = byPipelineStage.get(key) ?? [];
    rows.push(task);
    byPipelineStage.set(key, rows);
  }
  // القطع يلي **نزلت فعلاً** — كرت نشرها مسكَّر. يوم النشر عندها تاريخ صار،
  // فبينجمد على كل مراحلها. القطعة يلي لساها ما نزلت يوم نشرها خطة، ولو كان
  // تصويرها أو تصميمها منجزاً.
  const publishedKeys = new Set(
    existing
      .filter((task) => task.stage === "PUBLISH" && task.board === "DONE" && task.pipelineKey)
      .map((task) => task.pipelineKey),
  );
  const byPlanDateStage = new Map<string, ExistingPipelineTaskState[]>();
  for (const task of existing) {
    if (!task.companyId || !task.type || !task.publishDate || !task.stage) continue;
    const key = `${task.companyId}|${task.type}|${iso(task.publishDate)}|${task.stage}`;
    const rows = byPlanDateStage.get(key) ?? [];
    rows.push(task);
    byPlanDateStage.set(key, rows);
  }
  // PIECE-KEY — the last resort, and the only one tied to the piece's IDENTITY
  // rather than to its schedule. Both keys above move when the plan is
  // re-timed: `pipelineKey` embeds the publish date, and the plan-date key is
  // the date itself. So changing a company's designer (which re-times every
  // card) silently orphaned the saved state and threw the plan text away —
  // مخبر lost all 12 briefs, أغاليا 11, برو and جدارات 10 each. «بوست ٣ من دورة
  // تموز» is the same piece whatever day it ends up on; that is what we key on.
  const byPiece = new Map<string, ExistingPipelineTaskState>();
  for (const task of existing) {
    const key = pieceKeyOf(task);
    if (key && !byPiece.has(key)) byPiece.set(key, task);
  }
  // CLAIMED ROWS — a saved row whose piece identity matches a numbered card of
  // THIS run belongs to that card and to nobody else. When a plan's count goes
  // up (Phoenitech 4 → 10 posts, BW 4 → 8) the new pieces carry numbers no
  // saved row has, so they fall through to the schedule keys below — and a new
  // piece's date is often the OLD date of a piece that is already matched by
  // number, because the engine re-spreads the whole cycle. POST#7 came back
  // wearing POST#3's «فُتح من جديد» notes line that way; had POST#3 been READY,
  // #7 would have been born finished — completed work that never happened.
  const claimedByNumber = new Set<string>();
  for (const task of pipe) {
    const key = pieceKeyOf(task);
    if (key && byPiece.has(key)) claimedByNumber.add(key);
  }
  // A NUMBERED card of this run takes a schedule match only from rows that carry
  // no number (the WRITE card, legacy rows from before numbering). A numbered
  // row belongs to its number: in this run it is claimed above, and when its
  // number is NOT in this run (the count went down) the piece left the plan —
  // its state goes to nobody. Handing it out by date cancelled post 1 because
  // cancelled post 3's old date was post 1's new one (فحص ١٢/١٠، RG-01).
  // A card WITHOUT a number (never produced by the engine for a typed piece)
  // keeps the 11/10 rule: any row no numbered card claims.
  const firstUnclaimed = (rows: ExistingPipelineTaskState[] | undefined, numbered: boolean) =>
    rows?.find((row) => {
      const key = pieceKeyOf(row);
      if (key == null) return true;
      return !numbered && !claimedByNumber.has(key);
    });

  // Order matters, most precise first. The PIECE key beats the plan-date key:
  // several pieces of one company legitimately share a publish date (برو ships
  // three reels on the same day), so the date alone can hand a card the wrong
  // row's state — that is how برو's «قهوتك مو طلب» script vanished on a re-time
  // even after the piece key existed. «ريل 3» is unambiguous; a date is not.
  const preservedStateOf = (task: PipelineTask) => {
    // IDENTITY BEFORE SCHEDULE. `pipelineKey` embeds the publish date, so after a
    // re-time a card's NEW key can equal some OTHER piece's OLD key — the lookup
    // then succeeds with the wrong row and the card inherits a stranger's state.
    // Moving وصل's contract start 13/7 → 21/7 shifted every date by eight days
    // and did exactly that: 13 finished cards came back open, including the one
    // piece the client had actually published. Every key still existed; the
    // wrong one just won. «ستوري ٩ من دورة تموز» is the same piece whatever day
    // it lands on, so the piece number decides first and the schedule only fills
    // in for cards that have no number (they cannot collide this way).
    const pieceKey = pieceKeyOf(task);
    if (pieceKey) {
      const byNo = byPiece.get(pieceKey);
      if (byNo) return byNo;
    }
    // Schedule keys only ever see rows that no numbered card already owns.
    const numbered = pieceKey != null;
    const direct = firstUnclaimed(byPipelineStage.get(`${task.pipelineKey}|${task.stage}`), numbered);
    if (direct) return direct;
    if (task.companyId && task.type && task.stage !== "WRITE" && task.publishDate)
      return firstUnclaimed(
        byPlanDateStage.get(`${task.companyId}|${task.type}|${task.publishDate}|${task.stage}`),
        numbered,
      );
    return undefined;
  };

  const handed = new Set<PipelineTask>();
  for (const task of pipe) {
    const saved = preservedStateOf(task);
    if (!saved) continue;
    matched.add(saved);
    handed.add(task);
    task.board = saved.board as PipelineTask["board"];
    task.status = saved.status;
    task.startedAt = saved.startedAt ?? null;
    task.finishedAt = saved.finishedAt ?? null;
    task.completedAt = saved.completedAt ?? null;
    // Always kept, pinned or not — the plan text belongs to the piece, not to a
    // manual edit, and re-importing the .docx every month is not a real option.
    if (saved.brief != null) task.brief = saved.brief;
    if (saved.notes != null) task.notes = saved.notes;
    if (saved.reviewedAt != null) {
      task.reviewedAt = saved.reviewedAt;
      task.reviewedById = saved.reviewedById ?? null;
    }
    // كرت **منجز** موعده تاريخ، مو خطة — بينحفظ ولو ما كان مثبّتاً. الاسترجاع
    // كان مشروطاً بالتثبيت، فمونتاج توظيف ريل ٢ المنجز يوم 2/8 (بلا تثبيت) رجع
    // من التوليد مؤرّخاً 9/8 — يوم الخطة، مو يوم الشغل الحقيقي. `finishedAt`
    // وحده ما بيكفي: الشاشات والتقارير بتعرض `workDate`.
    if (saved.board === "DONE") {
      if (saved.workDate) task.workDate = iso(saved.workDate);
      if (saved.readyDate) task.readyDate = iso(saved.readyDate);
      // يوم النشر بينجمد لما يكون **صار**: كرت النشر نفسه، أو أي مرحلة من قطعة
      // كرت نشرها مسكَّر. أما قطعة لساها ما نزلت — تصويرها منجز وبس — فيوم
      // نشرها خطة، وتجميده على كرت الإنتاج بيخلّي مراحل القطعة الوحدة
      // تتناقض عند إعادة الجدولة: تصوير نور ريل ١ بيقول «نشر ٣٠/٩» وكرت
      // النشر بيقول «٣/١٠». وترقيم القطع بينبني على `publishDate`، فالتناقض
      // بيغلّط الأرقام.
      const pieceWentOut =
        task.stage === "PUBLISH" || (saved.pipelineKey != null && publishedKeys.has(saved.pipelineKey));
      if (saved.publishDate && pieceWentOut) {
        task.publishDate = iso(saved.publishDate);
      }
    }
    if (saved.isPinned) {
      task.isPinned = true;
      if (saved.title != null) task.title = saved.title;
      if (saved.workDate) task.workDate = iso(saved.workDate);
      if (saved.readyDate) task.readyDate = iso(saved.readyDate);
      if (saved.publishDate) task.publishDate = iso(saved.publishDate);
      if (saved.manualDay) task.manualDay = iso(saved.manualDay);
      if (saved.assigneeId) task.assigneeId = saved.assigneeId;
      if (saved.priority) task.priority = saved.priority;
      task.quantity = saved.quantity ?? task.quantity;
    }
  }

  applyCanceledPieces(pipe, collectCanceledPieces(existing));

  // قطعة ملغاة برقمها = كل مراحلها ملغاة، حتى المرحلة يلي ما كان إلها صفّ محفوظ
  // (كرت نشر انولّد لما بلّش النشر، أو مرحلة مونتاج جديدة). بالرقم — هويّة، مو تاريخ.
  const canceledPieces = new Set(
    existing
      .filter((row) => row.status === "CANCELED" && row.companyId && row.type && row.pieceNo != null)
      .map((row) => `${row.companyId}|${row.type}|${row.pieceNo}`),
  );
  for (const task of pipe) {
    if (task.pieceNo == null || !task.companyId || !task.type || !isPieceStage(task.stage)) continue;
    if (!canceledPieces.has(`${task.companyId}|${task.type}|${task.pieceNo}`)) continue;
    if (handed.has(task)) continue; // مرحلة إلها صفّها المحفوظ — حالتها منّو
    task.status = "CANCELED";
    task.board = "TODO";
    task.isPinned = true;
  }
  return matched;
}
