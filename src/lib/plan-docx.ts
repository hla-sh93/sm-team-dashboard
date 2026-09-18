/**
 * قراءة خطة المحتوى من ملف Word — الحلقة الناقصة بين نوال واللوحة.
 *
 * القائدة (١٨/٩): «نوال تكتب وترفع الخطط، وانت تحولها لكروت مهام مع الوصف
 * والتواريخ». كل باقي السلسلة شغّالة أصلاً: التوليد بيعمل الكروت، والدورة
 * بتحسب التواريخ، والحمولة بتنزّل الأوصاف. الوحيد يلي كان بالإيد هو تحويل
 * الملف لحمولة.
 *
 * **القاعدة الأولى: ما في تخمين.** مسح الخطط الحالية (١٣ ملف) طلّع ستة أشكال
 * مختلفة: ثلاث خانات بترويسة وثلاث بلا ترويسة أصلاً (BW حزيران وتموز، فأول صف
 * قطعة لا عنوان)، وأربع خانات بجدولين (جدارات)، وستّ خانات (البلسم)، وجدول
 * تواريخ (وصل). وعمود «النوع» بيجمع الرقم والنوع والملاحظة بلا فاصل
 * («3Reelوظيفة الاسبوع…»، «8 Reel»، «4post»). قراءة كل هالأشكال بالتخمين
 * بتنزّل سكريبت على القطعة الغلط بصمت — وهاد أسوأ من رفض الملف.
 *
 * فالقارئ بيشتغل على **القالب** وحده: بيلزمه ترويسة فيها «رقم» و«النوع»،
 * وبيرفض الملف كله إذا ما لقيها. `scripts/make-plan-template.ts` بيولّد القالب،
 * و`scripts/parse-plan-docx.ts` بيفرجي شو قرا قبل أي كتابة.
 */

/** أنواع المحتوى متل ما بيخزّنها التطبيق. */
export type PieceType = "POST" | "REEL" | "AI_REEL" | "STORY";

export type PlanDocxPiece = {
  type: PieceType;
  pieceNo: number;
  /** الوصف الكامل متل ما بينزل على الكرت. */
  brief: string;
  /** ملاحظة الصف (تصوير، فكرة الأسبوع…) — بتنكتب بآخر الوصف. */
  note: string | null;
};

export type PlanDocxResult =
  | { ok: true; pieces: PlanDocxPiece[]; warnings: string[] }
  | { ok: false; error: string };

/** صفوف جدول Word: جدول ← صف ← خانة. */
export type DocxTable = string[][];

const T_TAG = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
const TBL = /<w:tbl>[\s\S]*?<\/w:tbl>/g;
const TR = /<w:tr[\s>][\s\S]*?<\/w:tr>/g;
const TC = /<w:tc[\s>][\s\S]*?<\/w:tc>/g;
/** الفقرة داخل الخانة = سطر. بلا هيك بيلتصق «الهوك» بالسكريبت بكلمة وحدة. */
const P_END = /<\/w:p>/g;

function unescapeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&");
}

function cellText(cellXml: string): string {
  // كل `</w:p>` بيصير سطر جديد، وبعدين بنقرا النصوص بينهن.
  const lines = cellXml
    .split(P_END)
    .map((part) => {
      let out = "";
      for (const match of part.matchAll(T_TAG)) out += match[1];
      return unescapeXml(out).replace(/[ \t ]+/g, " ").trim();
    })
    .filter(Boolean);
  return lines.join("\n");
}

/** جداول المستند كنصّ — نقية، بلا فكّ ضغط (الضغط مسؤولية المنادي). */
export function extractDocxTables(documentXml: string): DocxTable[] {
  const tables: DocxTable[] = [];
  for (const tableMatch of documentXml.match(TBL) ?? []) {
    const rows: string[][] = [];
    for (const rowMatch of tableMatch.match(TR) ?? []) {
      const cells = (rowMatch.match(TC) ?? []).map(cellText);
      if (cells.some(Boolean)) rows.push(cells);
    }
    if (rows.length) tables.push(rows);
  }
  return tables;
}

/** أعمدة القالب. المطابقة بالكلمة المفتاحية مشان تصغير/تكبير وفراغ ما يكسروا. */
const COLUMN_PATTERNS: { key: ColumnKey; test: RegExp }[] = [
  { key: "no", test: /^\s*(#|رقم|الرقم)\s*$/ },
  { key: "type", test: /نوع/ },
  { key: "hook", test: /هوك|عنوان/ },
  { key: "script", test: /سكريبت|سكربت|نص التصميم|محتوى التصميم|نص المحتوى|^\s*المحتوى\s*$/ },
  { key: "caption", test: /كابشن|caption/i },
  { key: "tags", test: /هاشتا|hashtag/i },
  { key: "note", test: /ملاحظ|تفاصيل/ },
];

type ColumnKey = "no" | "type" | "hook" | "script" | "caption" | "tags" | "note";

function mapHeader(row: string[]): Partial<Record<ColumnKey, number>> | null {
  const map: Partial<Record<ColumnKey, number>> = {};
  row.forEach((cell, index) => {
    const label = cell.replace(/\s+/g, " ").trim();
    if (!label) return;
    for (const { key, test } of COLUMN_PATTERNS) {
      if (map[key] === undefined && test.test(label)) {
        map[key] = index;
        return;
      }
    }
  });
  // الترويسة لازم تعرّف الرقم والنوع — هنّ الهوية. بلاهن الصف مجرد نصّ.
  return map.no !== undefined && map.type !== undefined ? map : null;
}

const TYPE_WORDS: { type: PieceType; test: RegExp }[] = [
  // «ريل AI» قبل «ريل» — وإلا بيصير ريلاً عادياً.
  { type: "AI_REEL", test: /(ai|ذكاء)\s*[-_]?\s*(reel|ريل)|(reel|ريل)\s*[-_]?\s*(ai|ذكاء)/i },
  { type: "STORY", test: /story|ستور/i },
  { type: "REEL", test: /reel|ريل|فيديو/i },
  { type: "POST", test: /post|بوست|منشور|كاروس|carousel/i },
];

export function parsePieceType(value: string): PieceType | null {
  const text = value.trim();
  if (!text) return null;
  for (const { type, test } of TYPE_WORDS) if (test.test(text)) return type;
  return null;
}

const TYPE_LABEL: Record<PieceType, string> = {
  POST: "بوست",
  REEL: "ريل",
  AI_REEL: "ريل AI",
  STORY: "ستوري",
};

function buildBrief(parts: { label: string; value: string }[]): string {
  return parts
    .filter((part) => part.value.trim())
    .map((part) => `${part.label}:\n${part.value.trim()}`)
    .join("\n\n");
}

/**
 * يقرأ جداول المستند ويرجّع القطع. بيرفض الملف كله عند أول صفّ ملتبس: قطعة بلا
 * رقم، أو نوع مو معروف، أو رقم مكرّر. القارئ يلي «بيتسامح» بينزّل النصّ الغلط
 * على القطعة الغلط، وما حدا بيلاحظ إلا بعد النشر.
 */
export function parsePlanTables(tables: DocxTable[]): PlanDocxResult {
  if (!tables.length) return { ok: false, error: "ما في جدول بالملف — استعملي قالب الخطة." };

  const pieces: PlanDocxPiece[] = [];
  const warnings: string[] = [];
  const problems: string[] = [];
  const seen = new Set<string>();
  let recognised = 0;

  for (const [tableIndex, rows] of tables.entries()) {
    const map = mapHeader(rows[0]);
    if (!map) continue; // جدول مو جدول قطع (غلاف، ملخّص…)
    recognised++;
    for (const [rowIndex, row] of rows.slice(1).entries()) {
      const at = `جدول ${tableIndex + 1} صف ${rowIndex + 2}`;
      const cell = (key: ColumnKey) => (map[key] !== undefined ? (row[map[key]!] ?? "").trim() : "");
      const rawNo = cell("no");
      const rawType = cell("type");
      if (!rawNo && !rawType && !cell("script") && !cell("caption")) continue; // صف فاضي

      const noMatch = rawNo.match(/\d+/);
      if (!noMatch) {
        problems.push(`${at}: ما في رقم للقطعة`);
        continue;
      }
      const type = parsePieceType(rawType);
      if (!type) {
        problems.push(`${at}: نوع غير معروف «${rawType.slice(0, 30)}»`);
        continue;
      }
      const pieceNo = Number(noMatch[0]);
      const key = `${type}|${pieceNo}`;
      if (seen.has(key)) {
        problems.push(`${at}: ${TYPE_LABEL[type]} رقم ${pieceNo} مكرّر`);
        continue;
      }
      seen.add(key);

      const note = cell("note") || null;
      const brief = buildBrief([
        { label: "الهوك", value: cell("hook") },
        { label: "السكريبت", value: cell("script") },
        { label: "الكابشن", value: cell("caption") },
        { label: "الهاشتاغات", value: cell("tags") },
        { label: "ملاحظة", value: note ?? "" },
      ]);
      if (!brief) {
        problems.push(`${at}: ${TYPE_LABEL[type]} رقم ${pieceNo} بلا أي محتوى`);
        continue;
      }
      pieces.push({ type, pieceNo, brief, note });
    }
  }

  if (!recognised) {
    return {
      ok: false,
      error: "ما في جدول فيه عمودا «رقم» و«النوع» — استعملي قالب الخطة بلا تغيير عناوين الأعمدة.",
    };
  }
  if (problems.length) {
    return { ok: false, error: `الملف ما انقرا: ${problems.slice(0, 6).join(" · ")}` };
  }
  if (!pieces.length) return { ok: false, error: "الجدول فاضي — ما في ولا قطعة." };

  // فجوة بالترقيم = قطعة ناقصة غالباً. تحذير لا رفض: ممكن تكون خطة جزئية.
  const byType = new Map<PieceType, number[]>();
  for (const piece of pieces) {
    const list = byType.get(piece.type) ?? [];
    list.push(piece.pieceNo);
    byType.set(piece.type, list);
  }
  for (const [type, numbers] of byType) {
    numbers.sort((a, b) => a - b);
    if (numbers[0] !== 1) warnings.push(`${TYPE_LABEL[type]}: الترقيم بيبدأ من ${numbers[0]} مو من 1`);
    const gaps = numbers.filter((n, i) => i > 0 && n !== numbers[i - 1] + 1);
    if (gaps.length) warnings.push(`${TYPE_LABEL[type]}: فجوة بالترقيم قبل ${gaps.join("، ")}`);
  }

  pieces.sort((a, b) => a.type.localeCompare(b.type) || a.pieceNo - b.pieceNo);
  return { ok: true, pieces, warnings };
}

/** القطع ← بنود حمولة «استيراد خطة» — نفس الشكل المدقَّق الموجود. */
export function piecesToPayloadItems(pieces: PlanDocxPiece[]) {
  return pieces.map((piece) => ({ type: piece.type, pieceNo: piece.pieceNo, brief: piece.brief }));
}

/** ملخّص «شو فيه بالملف» — للمعاينة قبل التطبيق. */
export function summarisePieces(pieces: PlanDocxPiece[]): Record<PieceType, number> {
  const counts: Record<PieceType, number> = { POST: 0, REEL: 0, AI_REEL: 0, STORY: 0 };
  for (const piece of pieces) counts[piece.type]++;
  return counts;
}

export { TYPE_LABEL as PIECE_TYPE_LABEL };
