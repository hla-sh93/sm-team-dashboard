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
 * فالقارئ بيشتغل على **القالب** وحده. والقالب جدول لكل نوع (قاعدة القائدة،
 * نفس قاعدة ملف التصدير): فنوع القطعة بيجي من **عنوان الجدول** — سطر بيبدأ
 * بكلمة «جدول» قبله مباشرة — أو من عمود «النوع» إذا وُجد. وبلا واحد منهن
 * بينرفض الملف كله.
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

/** صفوف جدول Word: صف ← خانة. */
export type DocxTable = string[][];
/** المستند بترتيبه: فقرة أو جدول — العنوان قبل الجدول هو يلي بيعطي النوع. */
export type DocxBlock = { kind: "p"; text: string } | { kind: "table"; rows: DocxTable };

const T_TAG = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
const TBL_G = /<w:tbl>[\s\S]*?<\/w:tbl>/g;
const TR = /<w:tr[\s>][\s\S]*?<\/w:tr>/g;
const TC = /<w:tc[\s>][\s\S]*?<\/w:tc>/g;
const P_G = /<w:p[\s>][\s\S]*?<\/w:p>/g;
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

function runsText(xml: string): string {
  let out = "";
  for (const match of xml.matchAll(T_TAG)) out += match[1];
  return unescapeXml(out).replace(/[ \t ]+/g, " ").trim();
}

function cellText(cellXml: string): string {
  return cellXml.split(P_END).map(runsText).filter(Boolean).join("\n");
}

function tableRows(tableXml: string): DocxTable {
  const rows: string[][] = [];
  for (const rowMatch of tableXml.match(TR) ?? []) {
    const cells = (rowMatch.match(TC) ?? []).map(cellText);
    if (cells.some(Boolean)) rows.push(cells);
  }
  return rows;
}

/**
 * المستند ككتل بترتيبها. الفقرات جوّا الجداول ما بتنعدّ فقرات — وإلا صار كل
 * نصّ بخانة «عنوان جدول» محتمل.
 */
export function extractDocxBlocks(documentXml: string): DocxBlock[] {
  const blocks: DocxBlock[] = [];
  const pushParagraphs = (segment: string) => {
    for (const match of segment.match(P_G) ?? []) {
      const text = runsText(match);
      if (text) blocks.push({ kind: "p", text });
    }
  };
  let cursor = 0;
  for (const match of documentXml.matchAll(TBL_G)) {
    pushParagraphs(documentXml.slice(cursor, match.index));
    const rows = tableRows(match[0]);
    if (rows.length) blocks.push({ kind: "table", rows });
    cursor = match.index + match[0].length;
  }
  pushParagraphs(documentXml.slice(cursor));
  return blocks;
}

/** جداول المستند وحدها — للفحوص والاستعمال البسيط. */
export function extractDocxTables(documentXml: string): DocxTable[] {
  return extractDocxBlocks(documentXml)
    .filter((block): block is { kind: "table"; rows: DocxTable } => block.kind === "table")
    .map((block) => block.rows);
}

type ColumnKey = "no" | "type" | "hook" | "script" | "caption" | "tags" | "note";

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
  // «رقم» هو هوية القطعة. بلاه الصف مجرد نصّ.
  return map.no !== undefined ? map : null;
}

const REEL_WORD = /reel|ريل|فيديو/i;
/** `\bai\b` بيمسك «AI» لحالها وما بيمسكها جوّا كلمة متل «main». */
const AI_WORD = /\bai\b|ذكاء/i;

const TYPE_WORDS: { type: PieceType; test: RegExp }[] = [
  { type: "STORY", test: /story|ستور/i },
  { type: "REEL", test: REEL_WORD },
  { type: "POST", test: /post|بوست|منشور|كاروس|carousel/i },
];

export function parsePieceType(value: string): PieceType | null {
  const text = value.trim();
  if (!text) return null;
  // «ريلات AI» قبل «ريل»، وإلا بيصير ريلاً عادياً. الفحص بوجود الكلمتين مو
  // بنظمهن: `(reel|ريل)\w*` ما بيعبر «ات» لأنّ `\w` لاتيني بس.
  if (AI_WORD.test(text) && REEL_WORD.test(text)) return "AI_REEL";
  for (const { type, test } of TYPE_WORDS) if (test.test(text)) return type;
  return null;
}

/**
 * عنوان الجدول: سطر بيبدأ بكلمة «جدول» وفيه اسم النوع — «جدول الريلات».
 *
 * الشرط إنّو يبدأ بـ«جدول» مقصود: فقرة التعليمات بتذكر كل الأنواع بسطر واحد
 * («النوع: بوست · ريل · ستوري»)، فلو قبلنا أي سطر فيه كلمة نوع لصار عنواناً.
 */
export function tableHeadingType(text: string): PieceType | null {
  // `\b` بيشتغل على [A-Za-z0-9_] وبس، فما بيلقى حدّاً بين حرف عربي ومسافة —
  // و`/^\s*جدول\b/` كان بيفشل على «جدول الريلات» نفسها.
  return /^\s*جدول(?:\s|:|$)/.test(text) ? parsePieceType(text) : null;
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
 * يقرأ المستند ويرجّع القطع. بيرفض الملف كله عند أول صفّ ملتبس: قطعة بلا رقم،
 * أو نوع مو معروف، أو رقم مكرّر. القارئ يلي «بيتسامح» بينزّل النصّ الغلط على
 * القطعة الغلط، وما حدا بيلاحظ إلا بعد النشر.
 */
export function parsePlanDocument(blocks: DocxBlock[]): PlanDocxResult {
  const tables = blocks.filter((block) => block.kind === "table");
  if (!tables.length) return { ok: false, error: "ما في جدول بالملف — استعملي قالب الخطة." };

  const pieces: PlanDocxPiece[] = [];
  const warnings: string[] = [];
  const problems: string[] = [];
  const seen = new Set<string>();
  let recognised = 0;
  let heading: { type: PieceType; text: string } | null = null;
  let tableNo = 0;

  for (const block of blocks) {
    if (block.kind === "p") {
      const type = tableHeadingType(block.text);
      if (type) heading = { type, text: block.text.trim() };
      continue;
    }
    tableNo++;
    const rows = block.rows;
    const map = mapHeader(rows[0]);
    if (!map) {
      heading = null;
      continue; // جدول مو جدول قطع (غلاف، ملخّص…)
    }
    const headingType = heading?.type ?? null;
    const label = heading ? `«${heading.text}»` : `جدول ${tableNo}`;
    if (map.type === undefined && !headingType) {
      problems.push(`${label}: ما في عمود «النوع» ولا عنوان جدول يحدّد النوع`);
      heading = null;
      continue;
    }
    recognised++;
    for (const [rowIndex, row] of rows.slice(1).entries()) {
      const at = `${label} صف ${rowIndex + 2}`;
      const cell = (key: ColumnKey) => (map[key] !== undefined ? (row[map[key]!] ?? "").trim() : "");
      const rawNo = cell("no");
      const rawType = cell("type");
      const content = [cell("hook"), cell("script"), cell("caption"), cell("tags")].join("");
      if (!rawNo && !rawType && !content) continue; // صف فاضي من القالب

      // صفّ المثال بالقالب رقمه كلمة «مثال» — بينتخطّى انحذف أو ضلّ.
      if (/^\s*(مثال|example)\s*$/i.test(rawNo)) continue;
      const noMatch = rawNo.match(/\d+/);
      if (!noMatch) {
        problems.push(`${at}: ما في رقم للقطعة`);
        continue;
      }
      const type = rawType ? parsePieceType(rawType) : headingType;
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
    heading = null;
  }

  if (!recognised && !problems.length) {
    return {
      ok: false,
      error: "ما في جدول فيه عمود «رقم» — استعملي قالب الخطة بلا تغيير عناوين الأعمدة.",
    };
  }
  if (problems.length) {
    return { ok: false, error: `الملف ما انقرا: ${problems.slice(0, 6).join(" · ")}` };
  }
  if (!pieces.length) return { ok: false, error: "الجداول فاضية — ما في ولا قطعة." };

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

/** نفس القراءة لجداول بلا عناوين — لازم كل جدول يحمل عمود «النوع». */
export function parsePlanTables(tables: DocxTable[]): PlanDocxResult {
  return parsePlanDocument(tables.map((rows) => ({ kind: "table" as const, rows })));
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
