/**
 * سطر الدليل على الكرت (WORK_RULES §٢): كل إقفال آلي لازم يقول ليش، والدليل
 * **بينضاف** ولا بيمحي يلي قبله. السطر المكرّر حرفياً ما بينعاد.
 */
export function withEvidenceLine(notes: string | null | undefined, evidence: string): string {
  const line = evidence.trim();
  const kept = (notes ?? "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (line && !kept.includes(line)) kept.push(line);
  return kept.join("\n");
}
