"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/badge";
import MemberForm from "@/components/forms/MemberForm";
import { deleteEmployee } from "@/server/actions/employees";
import { toast } from "@/components/ui/toaster";
import { ROLE_LABELS, WEEKDAY_LABELS } from "@/lib/constants";
import { parseWorkDays } from "@/lib/dates";
import type { Employee } from "@/types";
import { Plus, Pencil, Trash2, Camera, Zap } from "lucide-react";

export default function TeamClient({ employees }: { employees: Employee[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [, start] = useTransition();

  const onDelete = (e: Employee) => {
    if (!confirm(`حذف ${e.name}؟`)) return;
    start(async () => {
      const r = await deleteEmployee(e.id);
      if (r.ok) {
        toast("تم الحذف");
        router.refresh();
      } else toast(r.error, "error");
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="display-font text-2xl">الفريق</h1>
          <p className="text-sm text-fg-dim">السعة وأيام العمل لكل موظف</p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="w-4 h-4" /> موظف جديد
        </Button>
      </header>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {employees.map((e) => {
          const wd = parseWorkDays(e.workDays);
          return (
            <Card key={e.id}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar name={e.name} color={e.color ?? undefined} size={42} />
                  <div>
                    <div className="font-semibold flex items-center gap-1.5">
                      {e.name}
                      {e.isPhotographer && <Camera className="w-3.5 h-3.5 text-accent" />}
                      {e.isScheduled && <Zap className="w-3.5 h-3.5 text-success" />}
                    </div>
                    <div className="text-xs text-fg-dim">
                      {ROLE_LABELS[e.role] ?? e.role} · {e.hoursPerDay}س/يوم
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    className="p-1.5 rounded-md hover:bg-bg-elev-2 text-fg-dim"
                    onClick={() => {
                      setEditing(e);
                      setOpen(true);
                    }}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    className="p-1.5 rounded-md hover:bg-danger/10 text-danger"
                    onClick={() => onDelete(e)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 mt-3">
                {wd.map((d) => (
                  <span
                    key={d}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-bg-elev-2 text-fg-dim"
                  >
                    {WEEKDAY_LABELS[d]}
                  </span>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      <MemberForm open={open} onOpenChange={setOpen} employee={editing} />
    </div>
  );
}
