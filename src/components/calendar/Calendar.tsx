"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import SideDrawer from "./SideDrawer";
import {
  ARABIC_MONTHS,
  getWeekDays,
  monthGridDays,
  toISODate,
} from "@/lib/dates";
import { WEEKDAY_LABELS } from "@/lib/constants";

export type CalendarMode = "monthly" | "weekly" | "daily";

const WEEK_COLS = [6, 0, 1, 2, 3, 4, 5]; // Sat → Fri

/**
 * Reusable calendar (SOCIAL_SCHEDULER_SPEC iteration-2). Generic over the item
 * type T; the caller supplies getDate + renderers and (optionally) the drawer
 * body. Used by BOTH the Tasks calendar (getDate=workDate) and the Publishing
 * calendar (getDate=publishDate) with different data + visual identity.
 */
export default function Calendar<T>({
  mode,
  year,
  month,
  items,
  getDate,
  renderChip,
  renderCard,
  renderDrawer,
  accent = "#C8A84E",
  emptyLabel = "لا عناصر",
}: {
  mode: CalendarMode;
  year: number;
  month: number;
  items: T[];
  getDate: (item: T) => Date | null;
  renderChip: (item: T) => React.ReactNode;
  renderCard: (item: T) => React.ReactNode;
  renderDrawer?: (date: Date, dayItems: T[]) => React.ReactNode;
  accent?: string;
  emptyLabel?: string;
}) {
  // Anchor for day/week navigation — defaults to today if it's in the month,
  // else the first of the month.
  const initialAnchor = useMemo(() => {
    const today = new Date();
    return today.getFullYear() === year && today.getMonth() === month
      ? today
      : new Date(year, month, 1);
  }, [year, month]);
  const [anchor, setAnchor] = useState<Date>(initialAnchor);
  const [drawerDate, setDrawerDate] = useState<Date | null>(null);

  const byDay = useMemo(() => {
    const m = new Map<string, T[]>();
    for (const it of items) {
      const d = getDate(it);
      if (!d) continue;
      const iso = toISODate(new Date(d));
      const arr = m.get(iso) ?? [];
      arr.push(it);
      m.set(iso, arr);
    }
    return m;
  }, [items, getDate]);

  const dayItems = (d: Date) => byDay.get(toISODate(d)) ?? [];

  // Furthest item date — lets the monthly grid stretch to cover contract cycles
  // that publish into the next calendar month.
  const maxItemDate = useMemo(() => {
    let max: Date | null = null;
    for (const it of items) {
      const d = getDate(it);
      if (d && (!max || d.getTime() > max.getTime())) max = new Date(d);
    }
    return max;
  }, [items, getDate]);

  const shiftAnchor = (deltaDays: number) => {
    const d = new Date(anchor);
    d.setDate(d.getDate() + deltaDays);
    setAnchor(d);
  };

  return (
    <>
      {mode === "monthly" && (
        <MonthGrid
          year={year}
          month={month}
          until={maxItemDate}
          dayItems={dayItems}
          renderChip={renderChip}
          accent={accent}
          onCellClick={(d) => setDrawerDate(d)}
        />
      )}

      {mode === "weekly" && (
        <div className="flex flex-col gap-3">
          <NavBar
            label={weekLabel(anchor)}
            onPrev={() => shiftAnchor(-7)}
            onNext={() => shiftAnchor(7)}
          />
          <WeekGrid
            anchor={anchor}
            dayItems={dayItems}
            renderCard={renderCard}
            accent={accent}
            emptyLabel={emptyLabel}
          />
        </div>
      )}

      {mode === "daily" && (
        <div className="flex flex-col gap-3">
          <NavBar
            label={dayLabel(anchor)}
            onPrev={() => shiftAnchor(-1)}
            onNext={() => shiftAnchor(1)}
          />
          <DayColumn
            day={anchor}
            items={dayItems(anchor)}
            renderCard={renderCard}
            emptyLabel={emptyLabel}
          />
        </div>
      )}

      <SideDrawer
        open={drawerDate !== null}
        onClose={() => setDrawerDate(null)}
        title={drawerDate ? dayLabel(drawerDate) : ""}
        subtitle={
          drawerDate ? `${dayItems(drawerDate).length} عنصر` : undefined
        }
        accent={accent}
      >
        {drawerDate &&
          (renderDrawer ? (
            renderDrawer(drawerDate, dayItems(drawerDate))
          ) : (
            <div className="flex flex-col gap-2">
              {dayItems(drawerDate).length === 0 && (
                <p className="text-sm text-fg-muted">{emptyLabel}</p>
              )}
              {dayItems(drawerDate).map((it, i) => (
                <div key={i}>{renderCard(it)}</div>
              ))}
            </div>
          ))}
      </SideDrawer>
    </>
  );
}

function NavBar({
  label,
  onPrev,
  onNext,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between bg-bg-elev border border-border rounded-lg px-2 py-1.5">
      <button
        onClick={onPrev}
        className="p-1.5 rounded-md text-fg-dim hover:text-fg hover:bg-bg-elev-2 transition"
        aria-label="السابق"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
      <span className="text-sm font-medium">{label}</span>
      <button
        onClick={onNext}
        className="p-1.5 rounded-md text-fg-dim hover:text-fg hover:bg-bg-elev-2 transition"
        aria-label="التالي"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
    </div>
  );
}

function MonthGrid<T>({
  year,
  month,
  until,
  dayItems,
  renderChip,
  accent,
  onCellClick,
}: {
  year: number;
  month: number;
  until?: Date | null;
  dayItems: (d: Date) => T[];
  renderChip: (item: T) => React.ReactNode;
  accent: string;
  onCellClick: (d: Date) => void;
}) {
  const grid = useMemo(() => monthGridDays(year, month, until), [year, month, until]);
  const todayISO = toISODate(new Date());

  return (
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border-soft">
        {WEEK_COLS.map((wd) => (
          <div
            key={wd}
            className="p-2 text-center text-xs font-semibold text-fg-dim"
          >
            {WEEKDAY_LABELS[wd]}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {grid.map((d) => {
          const iso = toISODate(d);
          const inMonth = d.getMonth() === month;
          const items = dayItems(d);
          const isToday = iso === todayISO;
          const isFri = d.getDay() === 5;
          return (
            <button
              key={iso}
              onClick={() => onCellClick(d)}
              className={
                "min-h-[92px] text-right p-1.5 border-b border-l border-border-soft/60 align-top transition hover:bg-bg-elev-2/50 flex flex-col gap-1 " +
                (inMonth ? "" : "bg-bg-elev/40 opacity-50 ") +
                (isFri ? "bg-bg-elev-2/30 " : "")
              }
            >
              <span
                className={
                  "text-xs tabular-nums self-start " +
                  (isToday
                    ? "bg-accent text-bg rounded-full w-5 h-5 flex items-center justify-center font-bold"
                    : "text-fg-dim")
                }
              >
                {d.getDate()}
              </span>
              <div className="flex flex-col gap-0.5 w-full">
                {items.slice(0, 3).map((it, i) => (
                  <div key={i}>{renderChip(it)}</div>
                ))}
                {items.length > 3 && (
                  <span className="text-[10px] text-fg-muted">
                    +{items.length - 3}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      <div className="h-1" style={{ background: accent }} />
    </div>
  );
}

function WeekGrid<T>({
  anchor,
  dayItems,
  renderCard,
  accent,
  emptyLabel,
}: {
  anchor: Date;
  dayItems: (d: Date) => T[];
  renderCard: (item: T) => React.ReactNode;
  accent: string;
  emptyLabel: string;
}) {
  const days = useMemo(() => getWeekDays(anchor), [anchor]);
  const todayISO = toISODate(new Date());
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
      {days.map((d) => {
        const items = dayItems(d);
        const isToday = toISODate(d) === todayISO;
        return (
          <div
            key={toISODate(d)}
            className="bg-bg-card border border-border rounded-lg overflow-hidden flex flex-col min-h-[140px]"
          >
            <div
              className={
                "px-2 py-1.5 text-center border-b border-border-soft " +
                (isToday ? "text-accent font-bold" : "text-fg-dim")
              }
              style={isToday ? { borderBottomColor: accent } : undefined}
            >
              <div className="text-xs font-semibold">
                {WEEKDAY_LABELS[d.getDay()]}
              </div>
              <div className="text-[10px] tabular-nums">{d.getDate()}</div>
            </div>
            <div className="flex flex-col gap-1.5 p-1.5 flex-1">
              {items.length === 0 && (
                <span className="text-[10px] text-fg-muted text-center mt-2">
                  {emptyLabel}
                </span>
              )}
              {items.map((it, i) => (
                <div key={i}>{renderCard(it)}</div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DayColumn<T>({
  day,
  items,
  renderCard,
  emptyLabel,
}: {
  day: Date;
  items: T[];
  renderCard: (item: T) => React.ReactNode;
  emptyLabel: string;
}) {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-3 flex flex-col gap-2 min-h-[200px]">
      {items.length === 0 && (
        <p className="text-sm text-fg-muted text-center py-8">{emptyLabel}</p>
      )}
      {items.map((it, i) => (
        <div key={i}>{renderCard(it)}</div>
      ))}
    </div>
  );
}

function dayLabel(d: Date): string {
  return `${WEEKDAY_LABELS[d.getDay()]} ${d.getDate()} ${ARABIC_MONTHS[d.getMonth()]}`;
}
function weekLabel(anchor: Date): string {
  const days = getWeekDays(anchor);
  const a = days[0];
  const b = days[6];
  if (a.getMonth() === b.getMonth())
    return `${a.getDate()} – ${b.getDate()} ${ARABIC_MONTHS[a.getMonth()]}`;
  return `${a.getDate()} ${ARABIC_MONTHS[a.getMonth()]} – ${b.getDate()} ${ARABIC_MONTHS[b.getMonth()]}`;
}
