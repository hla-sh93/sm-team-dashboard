"use client";

import { useState, useTransition } from "react";
import Swal from "sweetalert2";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import CompanyForm from "@/components/forms/CompanyForm";
import { deleteCompany, archiveCompany } from "@/server/actions/companies";
import { toast } from "@/components/ui/toaster";
import type { Company, Employee } from "@/types";
import { Plus, Pencil, Trash2 } from "lucide-react";

export default function CompaniesClient({
  employees,
  companies,
}: {
  employees: Employee[];
  companies: Company[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [, start] = useTransition();
  const empName = (id: string | null) => employees.find((e) => e.id === id)?.name ?? "—";

  const doArchive = (c: Company) =>
    start(async () => {
      const r = await archiveCompany(c.id);
      if (r.ok) {
        toast(`تمت أرشفة ${c.name}`);
        router.refresh();
      } else toast(r.error, "error");
    });

  const onDelete = (c: Company) => {
    Swal.fire({
      title: "تأكيد الحذف",
      text: `حذف ${c.name}؟ إن كان لديها تاريخ، سيُقترح الأرشفة بدل الحذف.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "نعم، احذف",
      cancelButtonText: "إلغاء",
      confirmButtonColor: "#ef4444",
    }).then((result) => {
      if (!result.isConfirmed) return;
      start(async () => {
        const r = await deleteCompany(c.id);
        if (r.ok) {
          toast("تم الحذف");
          router.refresh();
          return;
        }
        // Has history → cascade-delete blocked. Offer archiving instead.
        if ("canArchive" in r && r.canArchive) {
          const choice = await Swal.fire({
            title: "لا يمكن الحذف — يوجد تاريخ محفوظ",
            text: r.error,
            icon: "info",
            showCancelButton: true,
            confirmButtonText: "أرشفة الشركة",
            cancelButtonText: "إلغاء",
            confirmButtonColor: "#0a8fa3",
          });
          if (choice.isConfirmed) doArchive(c);
        } else {
          toast(r.error, "error");
        }
      });
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="display-font text-2xl">الشركات</h1>
          <p className="text-sm text-fg-dim">الخطة والمالكون لكل نوع محتوى</p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="w-4 h-4" /> شركة جديدة
        </Button>
      </header>

      <div className="grid md:grid-cols-2 gap-4">
        {companies.map((c) => (
          <Card key={c.id} style={{ borderRight: `4px solid ${c.color ?? "#C8A84E"}` }}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="display-font text-lg">{c.name}</h2>
                  <span
                    className={
                      "text-[10px] px-2 py-0.5 rounded-full font-semibold " +
                      (c.managed
                        ? "bg-accent/15 text-accent"
                        : "bg-info/15 text-info")
                    }
                  >
                    {c.managed ? "مُدارة" : "تصميم-فقط"}
                  </span>
                </div>
                {c.managed ? (
                  <p className="text-xs text-fg-dim mt-1">
                    {c.posts} بوست · {c.reels} ريل · {c.aiReels} ريل AI · {c.stories} ستوري
                  </p>
                ) : (
                  <p className="text-xs text-fg-dim mt-1">
                    المسؤول: {empName(c.defaultOwnerId)}
                  </p>
                )}
              </div>
              <div className="flex gap-1">
                <button
                  className="p-1.5 rounded-md hover:bg-bg-elev-2 text-fg-dim"
                  onClick={() => {
                    setEditing(c);
                    setOpen(true);
                  }}
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  className="p-1.5 rounded-md hover:bg-danger/10 text-danger"
                  onClick={() => onDelete(c)}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            {c.managed && (
              <div className="flex gap-3 mt-3 text-[11px] text-fg-muted flex-wrap">
                <span>بوست → {empName(c.postOwnerId)}</span>
                <span>· ستوري → {empName(c.storyOwnerId)}</span>
                {c.aiReels > 0 && <span>· ريل AI → {empName(c.aiReelOwnerId)}</span>}
              </div>
            )}
          </Card>
        ))}
        {companies.length === 0 && (
          <p className="text-sm text-fg-muted">لا توجد شركات بعد.</p>
        )}
      </div>

      <CompanyForm open={open} onOpenChange={setOpen} company={editing} employees={employees} />
    </div>
  );
}
