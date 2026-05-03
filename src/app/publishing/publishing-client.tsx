"use client";

import PublishingForm from "@/components/forms/PublishingForm";
import { CompanyChip } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import {
  PUBLISH_STATUS_COLORS,
  PUBLISH_STATUS_LABELS,
  PUBLISH_TYPE_LABELS,
  type PublishContentType,
  type PublishStatus,
} from "@/lib/constants";
import {
  ARABIC_MONTHS,
  ARABIC_WEEK_LABELS,
  formatDateShort,
  formatMonthLabel,
  getMonthDays,
  nextMonth,
  prevMonth,
  toISODate,
} from "@/lib/dates";
import { cn } from "@/lib/utils";
import {
  autoSchedulePublishing,
  clearMonthPublishing,
  deletePublishingItem,
  updatePublishingItemStatus,
} from "@/server/actions/publishing";
import type { Company, PublishingItem } from "@/types";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Pencil,
  Plus,
  Trash2,
  Wand2,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";

interface Props {
  companies: Company[];
  items: PublishingItem[];
}

type ViewMode = "month" | "list";

export default function PublishingClient({ companies, items }: Props) {
  const [view, setView] = useState<ViewMode>("month");
  const [anchor, setAnchor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<PublishingItem | null>(null);
  const [fCompany, setFCompany] = useState("");
  const [fType, setFType] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [isScheduling, startScheduling] = useTransition();
  const [, startTransition] = useTransition();

  const yr = anchor.getFullYear();
  const mo = anchor.getMonth();
  const monthLabel = formatMonthLabel(anchor);

  const monthItems = useMemo(() => {
    return items.filter((it) => {
      const d = new Date(it.publishDate);
      return d.getFullYear() === yr && d.getMonth() === mo;
    });
  }, [items, yr, mo]);

  const filtered = useMemo(() => {
    return monthItems.filter((it) => {
      if (fCompany && it.companyId !== fCompany) return false;
      if (fType && it.contentType !== fType) return false;
      if (fStatus && it.status !== fStatus) return false;
      return true;
    });
  }, [monthItems, fCompany, fType, fStatus]);

  const stats = useMemo(() => {
    const posts = monthItems.filter((i) => i.contentType === "post").length;
    const reelAi = monthItems.filter((i) => i.contentType === "reel_ai").length;
    const reelVideo = monthItems.filter(
      (i) => i.contentType === "reel_video",
    ).length;
    const published = monthItems.filter((i) => i.status === "published").length;
    return { total: monthItems.length, posts, reelAi, reelVideo, published };
  }, [monthItems]);

  const handleAutoSchedule = () => {
    if (
      monthItems.some((i) => i.status === "scheduled" && i.isAuto) &&
      !confirm(
        `سيتم استبدال ${monthItems.filter((i) => i.status === "scheduled" && i.isAuto).length} عنصر مجدول. المنشور والمضاف يدوياً يبقى. متابعة؟`,
      )
    ) {
      return;
    }
    startScheduling(async () => {
      const result = await autoSchedulePublishing(yr, mo);
      if (result.ok) {
        toast(`تم توليد ${result.stats.total} عنصر نشر لـ ${monthLabel}`);
        result.warnings.forEach((w) =>
          toast(w.message, w.level === "error" ? "error" : "warning"),
        );
      } else {
        toast(result.error, "error");
      }
    });
  };

  const handleClear = () => {
    if (
      !confirm(
        "حذف جميع عناصر النشر التلقائية المجدولة لهذا الشهر؟ المنشور لن يُحذف.",
      )
    )
      return;
    startScheduling(async () => {
      const result = await clearMonthPublishing(yr, mo);
      if (result.ok) toast(`تم حذف ${result.count} عنصر`);
      else toast(result.error, "error");
    });
  };

  const handleStatusChange = (id: string, status: string) => {
    startTransition(async () => {
      const result = await updatePublishingItemStatus(id, status);
      if (result.ok) toast("تم التحديث");
      else toast(result.error, "error");
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("حذف هذا العنصر؟")) return;
    startTransition(async () => {
      const result = await deletePublishingItem(id);
      if (result.ok) toast("تم الحذف");
      else toast(result.error, "error");
    });
  };

  const clearFilters = () => {
    setFCompany("");
    setFType("");
    setFStatus("");
  };

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="icon"
            onClick={() => setAnchor(prevMonth(anchor))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          <div className="display-font text-xl font-semibold min-w-[160px] text-center">
            {monthLabel}
          </div>
          <Button
            variant="default"
            size="icon"
            onClick={() => setAnchor(nextMonth(anchor))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const d = new Date();
              d.setDate(1);
              setAnchor(d);
            }}
          >
            هذا الشهر
          </Button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex bg-bg-elev border border-border rounded-lg p-1">
            {(["month", "list"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                  view === v
                    ? "bg-accent text-bg"
                    : "text-fg-dim hover:text-fg",
                )}
              >
                {v === "month" ? "تقويم" : "قائمة"}
              </button>
            ))}
          </div>
          <Button
            variant="default"
            onClick={() => {
              setEditItem(null);
              setShowForm(true);
            }}
          >
            <Plus className="w-4 h-4" />
            إضافة يدوية
          </Button>
          <Button
            variant="primary"
            onClick={handleAutoSchedule}
            disabled={isScheduling}
          >
            <Wand2 className="w-4 h-4" />
            {isScheduling ? "جاري التوليد..." : "توليد جدول النشر"}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <StatCard label="إجمالي الشهر" value={stats.total} />
        <StatCard label="بوست" value={stats.posts} color="text-info" />
        <StatCard label="ريل AI" value={stats.reelAi} color="text-warning" />
        <StatCard
          label="ريل تصوير"
          value={stats.reelVideo}
          color="text-success"
        />
        <StatCard label="منشور" value={stats.published} color="text-success" />
      </div>

      {/* Filters */}
      <Card className="mb-5 !p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-fg-dim" />
          <span className="text-xs text-fg-dim font-semibold">الفلاتر:</span>
          <Select
            value={fCompany}
            onChange={(e) => setFCompany(e.target.value)}
            className="!w-auto min-w-[140px]"
          >
            <option value="">كل الشركات</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select
            value={fType}
            onChange={(e) => setFType(e.target.value)}
            className="!w-auto min-w-[120px]"
          >
            <option value="">كل الأنواع</option>
            {Object.entries(PUBLISH_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
          <Select
            value={fStatus}
            onChange={(e) => setFStatus(e.target.value)}
            className="!w-auto min-w-[120px]"
          >
            <option value="">كل الحالات</option>
            {Object.entries(PUBLISH_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            مسح
          </Button>
          {monthItems.some((i) => i.isAuto) && (
            <Button variant="ghost" size="sm" onClick={handleClear}>
              <Trash2 className="w-3.5 h-3.5" />
              مسح التوليد
            </Button>
          )}
        </div>
      </Card>

      {view === "month" ? (
        <MonthCalendar
          anchor={anchor}
          items={filtered}
          companies={companies}
          onItemClick={(it) => {
            setEditItem(it);
            setShowForm(true);
          }}
        />
      ) : (
        <ListView
          items={filtered}
          companies={companies}
          onEdit={(it) => {
            setEditItem(it);
            setShowForm(true);
          }}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
        />
      )}

      <PublishingForm
        key={editItem?.id ?? "new"}
        open={showForm}
        onOpenChange={(o) => {
          setShowForm(o);
          if (!o) setEditItem(null);
        }}
        item={editItem}
        companies={companies}
      />
    </>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="bg-bg-card border border-border-soft rounded-[14px] p-4">
      <div className="text-[10px] text-fg-dim tracking-wider font-semibold uppercase mb-1.5">
        {label}
      </div>
      <div
        className={cn(
          "display-font text-2xl font-bold leading-none",
          color,
        )}
      >
        {value}
      </div>
    </div>
  );
}

function MonthCalendar({
  anchor,
  items,
  companies,
  onItemClick,
}: {
  anchor: Date;
  items: PublishingItem[];
  companies: Company[];
  onItemClick: (it: PublishingItem) => void;
}) {
  const yr = anchor.getFullYear();
  const mo = anchor.getMonth();
  const days = getMonthDays(yr, mo);
  const today = new Date();
  const todayISO = toISODate(today);

  // Arabic week starts Saturday (getDay=6)
  const dayMap: Record<number, number> = {
    6: 0,
    0: 1,
    1: 2,
    2: 3,
    3: 4,
    4: 5,
    5: 6,
  };
  const offset = dayMap[new Date(yr, mo, 1).getDay()];

  return (
    <div className="card">
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: "repeat(7, 1fr)" }}
      >
        {ARABIC_WEEK_LABELS.map((d) => (
          <div
            key={d}
            className="text-center py-2 text-[10px] text-fg-muted tracking-widest font-semibold uppercase"
          >
            {d}
          </div>
        ))}

        {Array.from({ length: offset }).map((_, i) => (
          <div key={`e-${i}`} className="invisible" />
        ))}

        {days.map((d) => {
          const iso = toISODate(d);
          const isToday = iso === todayISO;
          const dayItems = items.filter(
            (it) => toISODate(new Date(it.publishDate)) === iso,
          );

          return (
            <div
              key={iso}
              className={cn(
                "min-h-[110px] bg-bg-elev border border-border-soft rounded-lg p-1.5 flex flex-col overflow-hidden transition-all",
                "hover:border-accent-dim",
                isToday && "border-accent ring-1 ring-accent",
              )}
            >
              <div
                className={cn(
                  "text-xs font-bold mb-1",
                  isToday ? "text-accent" : "text-fg-dim",
                )}
              >
                {d.getDate()}
              </div>
              <div className="flex flex-col gap-0.5 overflow-hidden flex-1">
                {dayItems.slice(0, 4).map((it) => {
                  const co = companies.find((c) => c.id === it.companyId);
                  const typeLabel =
                    PUBLISH_TYPE_LABELS[it.contentType as PublishContentType];
                  return (
                    <button
                      key={it.id}
                      onClick={() => onItemClick(it)}
                      className={cn(
                        "text-[9px] py-0.5 px-1.5 rounded font-medium truncate border-r-2 text-right",
                        "hover:bg-bg-elev-2 transition",
                        it.status === "published" && "opacity-60",
                      )}
                      style={{
                        color: co?.color ?? "#d4af37",
                        borderRightColor: co?.color ?? "#d4af37",
                        background: "rgba(255,255,255,0.03)",
                      }}
                      title={`${co?.name ?? ""} — ${typeLabel}${it.status === "published" ? " · منشور" : ""}`}
                    >
                      {it.status === "published" ? "✓ " : ""}
                      {co?.name ?? ""} · {typeLabel}
                    </button>
                  );
                })}
                {dayItems.length > 4 && (
                  <div className="text-[9px] text-fg-muted text-center font-bold">
                    +{dayItems.length - 4}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ListView({
  items,
  companies,
  onEdit,
  onStatusChange,
  onDelete,
}: {
  items: PublishingItem[];
  companies: Company[];
  onEdit: (it: PublishingItem) => void;
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card className="!p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-bg-elev border-b border-border">
              <Th>التاريخ</Th>
              <Th>اليوم</Th>
              <Th>الشركة</Th>
              <Th>النوع</Th>
              <Th>الحالة</Th>
              <Th>ملاحظات</Th>
              <th className="px-4 py-3.5"></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="text-center py-12 text-fg-muted"
                >
                  لا توجد عناصر نشر — اضغط "توليد جدول النشر" للبدء
                </td>
              </tr>
            ) : (
              items.map((it) => {
                const co = companies.find((c) => c.id === it.companyId);
                const d = new Date(it.publishDate);
                return (
                  <tr
                    key={it.id}
                    className="border-b border-border-soft last:border-b-0 hover:bg-bg-elev"
                  >
                    <td className="px-4 py-3 text-sm font-semibold">
                      {formatDateShort(d)}
                    </td>
                    <td className="px-4 py-3 text-xs text-fg-dim">
                      {ARABIC_WEEK_LABELS[
                        d.getDay() === 6
                          ? 0
                          : d.getDay() === 5
                            ? 6
                            : d.getDay() + 1
                      ]}
                    </td>
                    <td className="px-4 py-3">
                      {co ? (
                        <CompanyChip name={co.name} color={co.color} />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {
                        PUBLISH_TYPE_LABELS[
                          it.contentType as PublishContentType
                        ]
                      }
                    </td>
                    <td className="px-4 py-3">
                      <Select
                        value={it.status}
                        onChange={(e) =>
                          onStatusChange(it.id, e.target.value)
                        }
                        className={cn(
                          "!py-1 !text-xs !w-auto border",
                          PUBLISH_STATUS_COLORS[it.status as PublishStatus],
                        )}
                      >
                        {Object.entries(PUBLISH_STATUS_LABELS).map(
                          ([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ),
                        )}
                      </Select>
                    </td>
                    <td className="px-4 py-3 text-xs text-fg-muted truncate max-w-[200px]">
                      {it.notes ?? ""}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(it)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="danger"
                          size="icon"
                          onClick={() => onDelete(it.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-right px-4 py-3.5 text-[11px] tracking-wider font-semibold text-fg-dim uppercase">
      {children}
    </th>
  );
}
