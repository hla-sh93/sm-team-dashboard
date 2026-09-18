/**
 * بيقرأ ملف خطة Word وبيفرجي شو فهم — قبل أي كتابة على الداتا.
 *
 *   npx tsx scripts/parse-plan-docx.ts "D:\...\Phoeni Jobs - Sept.docx" [--brief]
 *
 * نفس القارئ يلي بيستعمله الاستيراد (`src/lib/plan-docx.ts`)، فاللي بيطلع هون
 * هو اللي رح ينزل على الكروت.
 */
import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { extractDocxBlocks, parsePlanDocument, PIECE_TYPE_LABEL, summarisePieces } from "@/lib/plan-docx";

async function main() {
  const [file, ...flags] = process.argv.slice(2);
  if (!file) {
    console.error("الاستعمال: parse-plan-docx.ts <ملف.docx> [--brief]");
    process.exit(1);
  }
  const zip = await JSZip.loadAsync(readFileSync(file));
  const entry = zip.file("word/document.xml");
  if (!entry) {
    console.error("✗ مو ملف Word صالح (ما في word/document.xml)");
    process.exit(1);
  }
  const blocks = extractDocxBlocks(await entry.async("string"));
  const rowCounts = blocks.flatMap((block) => (block.kind === "table" ? [block.rows.length] : []));
  console.log(
    `— ${file}\n  جداول: ${rowCounts.length}${rowCounts.length ? ` (صفوف: ${rowCounts.join("، ")})` : ""}`,
  );
  const result = parsePlanDocument(blocks);
  if (!result.ok) {
    console.log(`  ✗ ${result.error}`);
    process.exit(1);
  }
  const counts = summarisePieces(result.pieces);
  console.log(
    "  ✓ " +
      Object.entries(counts)
        .filter(([, n]) => n)
        .map(([type, n]) => `${String(n)} ${PIECE_TYPE_LABEL[type as keyof typeof PIECE_TYPE_LABEL]}`)
        .join(" · "),
  );
  for (const warning of result.warnings) console.log(`  ⚠ ${warning}`);
  for (const piece of result.pieces) {
    const head = piece.brief.split("\n").filter((l) => l.trim() && !l.endsWith(":"))[0] ?? "";
    console.log(
      `     ${PIECE_TYPE_LABEL[piece.type]}-${piece.pieceNo}`.padEnd(16) +
        (flags.includes("--brief") ? `\n${piece.brief}\n` : ` ${head.slice(0, 90)}`),
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
