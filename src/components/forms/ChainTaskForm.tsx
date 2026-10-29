"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import type { PublicCompany, PublicEmployee } from "@/types";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { PRIORITIES, PRIORITY_LABELS } from "@/lib/constants";
import { teamTodayISO } from "@/lib/team-day";
import { CHAIN_STAGE_LABELS, CHAIN_TEMPLATES, validateChainStages, type ChainStage } from "@/lib/task-chain";
import { createTaskChain, previewTaskChain, type ChainPreviewStep } from "@/server/actions/task-chain";

type Step = { stage: ChainStage; assigneeId: string; days: string };

/** صاحب افتراضي لكل مرحلة من دور الموظف — المسؤولة بتغيّره. */
const ROLE_OF: Record<ChainStage, RegExp> = {
  WRITE: /كات|writer/i,
  DESIGN: /مصمم|designer/i,
  SHOOT: /مصور|photo/i,
  EDIT: /مونت|editor/i,
  PUBLISH: /ناشر|publish/i,
};
const DEFAULT_DAYS: Record<ChainStage, string> = { WRITE: "0.5", DESIGN: "1", SHOOT: "1", EDIT: "1", PUBLISH: "0" };
const ALL_STAGES: ChainStage[] = ["WRITE", "DESIGN", "SHOOT", "EDIT", "PUBLISH"];
const fmt = (iso: string | null) => (iso ? `${Number(iso.slice(8, 10))}/${Number(iso.slice(5, 7))}` : "—");

/**
 * «سلسلة مراحل» (خطة التحسينات B): قالب ← أصحاب ومدد ← موعد ← **معاينة المواعيد** ← إنشاء.
 * المواعيد ما بتنكتب بالإيد: بتنحسب رجوعاً من الموعد على أيام دوام كل واحد وحمله.
 */
export default function ChainTaskForm({
  open,
  onOpenChange,
  employees,
  companies,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: PublicEmployee[];
  companies: PublicCompany[];
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const defaultFor = (stage: ChainStage) =>
    employees.find((e) => (stage === "SHOOT" && e.isPhotographer) || ROLE_OF[stage].test(e.role))?.id ?? "";
  const stepsFor = (stages: ChainStage[]): Step[] =>
    stages.map((stage) => ({ stage, assigneeId: defaultFor(stage), days: DEFAULT_DAYS[stage] }));

  const [template, setTemplate] = useState(CHAIN_TEMPLATES[2].key);
  const [steps, setSteps] = useState<Step[]>(() => stepsFor(CHAIN_TEMPLATES[2].stages));
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>("NORMAL");
  const [target, setTarget] = useState("");
  const [preview, setPreview] = useState<{ steps: ChainPreviewStep[]; warnings: string[]; fingerprint: string } | null>(null);

  const hasPublish = steps.at(-1)?.stage === "PUBLISH";
  const orderError = useMemo(() => validateChainStages(steps.map((s) => s.stage)), [steps]);
  const input = () => ({
    title,
    brief,
    companyId: companyId || null,
    priority,
    targetISO: target,
    steps: steps.map((s) => ({ stage: s.stage, assigneeId: s.assigneeId, days: Number(s.days) || 0 })),
  });
  const edit = (fn: () => void) => {
    fn();
    setPreview(null); // أي تغيير بيبطل المعاينة
  };

  const pickTemplate = (key: string) =>
    edit(() => {
      setTemplate(key);
      const t = CHAIN_TEMPLATES.find((x) => x.key === key)!;
      setSteps(stepsFor(t.stages.length ? t.stages : ["DESIGN"]));
    });
  const setStep = (i: number, patch: Partial<Step>) =>
    edit(() =>
      setSteps((s) =>
        s.map((x, j) =>
          j === i ? { ...x, ...patch, ...(patch.stage ? { assigneeId: defaultFor(patch.stage), days: DEFAULT_DAYS[patch.stage] } : {}) } : x,
        ),
      ),
    );

  const runPreview = () =>
    start(async () => {
      const r = await previewTaskChain(input());
      if (!r.ok) return toast(r.error, "error");
      setPreview({ steps: r.steps, warnings: r.warnings, fingerprint: r.fingerprint });
    });

  const create = () =>
    preview &&
    start(async () => {
      const r = await createTaskChain(input(), preview.fingerprint);
      if (!r.ok) {
        setPreview(null);
        return toast(r.error, "error");
      }
      toast(r.warning ?? `انخلقت السلسلة (${r.ids.length} كروت)`, r.warning ? "error" : undefined);
      onOpenChange(false);
      setPreview(null);
      setTitle("");
      setBrief("");
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>سلسلة مراحل</DialogTitle>
          <DialogDescription>
            مهمة إضافية بمراحل مربوطة — كل مرحلة لصاحبها، والمواعيد بتنحسب رجوعاً من الموعد على أيام دوام كل واحد وحمله.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {CHAIN_TEMPLATES.map((t) => (
              <button
                key={t.key}
                type="button"
                title={t.hint}
                onClick={() => pickTemplate(t.key)}
                className={`text-[11px] px-2 py-1 rounded-md border ${
                  template === t.key ? "border-accent bg-accent/10 text-accent" : "border-border text-fg-dim hover:text-fg"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label>العنوان</Label>
            <Input value={title} onChange={(e) => edit(() => setTitle(e.target.value))} placeholder="مثال: هوية بصرية جديدة" />
          </div>
          <div className="space-y-1.5">
            <Label>الوصف (بيطلع على كل كروت السلسلة)</Label>
            <Textarea rows={2} value={brief} onChange={(e) => edit(() => setBrief(e.target.value))} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>الشركة</Label>
              <Select value={companyId} onChange={(e) => edit(() => setCompanyId(e.target.value))}>
                <option value="">— داخلي —</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{hasPublish ? "موعد النشر" : "موعد التسليم"}</Label>
              <Input type="date" min={teamTodayISO()} value={target} onChange={(e) => edit(() => setTarget(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>الأولوية</Label>
              <Select value={priority} onChange={(e) => edit(() => setPriority(e.target.value as typeof priority))}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>المراحل بالترتيب</Label>
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[11px] text-fg-muted w-4">{i + 1}</span>
                <Select className="h-8 w-28 text-xs" value={s.stage} onChange={(e) => setStep(i, { stage: e.target.value as ChainStage })}>
                  {ALL_STAGES.map((st) => (
                    <option key={st} value={st}>
                      {CHAIN_STAGE_LABELS[st]}
                    </option>
                  ))}
                </Select>
                <Select className="h-8 flex-1 text-xs" value={s.assigneeId} onChange={(e) => setStep(i, { assigneeId: e.target.value })}>
                  <option value="">— مين؟ —</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </Select>
                {s.stage !== "PUBLISH" ? (
                  <Input
                    className="h-8 w-20 text-xs"
                    type="number"
                    step="0.5"
                    min="0.5"
                    title="أيام شغل"
                    value={s.days}
                    onChange={(e) => setStep(i, { days: e.target.value })}
                  />
                ) : (
                  <span className="w-20 text-[10px] text-fg-muted text-center">يوم الموعد</span>
                )}
                <button
                  type="button"
                  disabled={steps.length === 1}
                  onClick={() => edit(() => setSteps((x) => x.filter((_, j) => j !== i)))}
                  className="text-fg-muted hover:text-danger disabled:opacity-30"
                  title="شيل المرحلة"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {steps.length < 5 && (
              <button
                type="button"
                onClick={() => edit(() => setSteps((x) => [...x, ...stepsFor(["PUBLISH"])]))}
                className="text-[11px] text-accent flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> مرحلة
              </button>
            )}
            {orderError && <p className="text-[11px] text-danger">{orderError}</p>}
          </div>

          {preview && (
            <div className="rounded-md border border-accent/40 bg-accent/5 p-2 space-y-1">
              <p className="text-[11px] font-semibold">المواعيد المحسوبة</p>
              {preview.steps.map((s, i) => (
                <div key={i} className="text-[11px] flex items-center gap-1.5 flex-wrap">
                  {i > 0 && <ArrowLeft className="w-3 h-3 text-fg-muted" />}
                  <span className="font-semibold">{s.label}</span>
                  <span>· {s.assigneeName}</span>
                  <span className="text-fg-dim">
                    · {s.stage === "PUBLISH" ? `نشر ${fmt(s.publishISO)}` : `${fmt(s.workISO)} ← تسليم ${fmt(s.readyISO)}`}
                  </span>
                  {s.urgent && <span className="text-danger">مستعجل</span>}
                </div>
              ))}
              {preview.warnings.map((w) => (
                <p key={w} className="text-[10px] text-warning">
                  ⚠️ {w}
                </p>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            إلغاء
          </Button>
          {preview ? (
            <Button type="button" variant="primary" onClick={create} disabled={busy}>
              {busy ? "جاري الإنشاء..." : `أنشئي ${preview.steps.length} كروت`}
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              onClick={runPreview}
              disabled={busy || !!orderError || !target || !title.trim() || !brief.trim() || steps.some((s) => !s.assigneeId)}
            >
              {busy ? "..." : "اعرضي المواعيد"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
