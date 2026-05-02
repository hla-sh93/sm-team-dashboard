'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Task, TeamMember, Company } from '@/types';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { CompanyChip, Avatar, StatusBadge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  ARABIC_MONTHS,
  ARABIC_WEEK_LABELS,
  formatMonthLabel,
  formatWeekLabel,
  formatDateLong,
  getMonthDays,
  getWeekDays,
  isWeekend,
  isSameDay,
  toISODate,
  prevMonth,
  nextMonth,
  shiftDays,
  formatDateShort,
} from '@/lib/dates';
import { TaskStatus, TaskType, TYPE_LABELS } from '@/lib/constants';

type ViewMode = 'day' | 'week' | 'month';

interface CalendarProps {
  tasks: Task[];
  team: TeamMember[];
  companies: Company[];
}

export default function CalendarView({ tasks, team, companies }: CalendarProps) {
  const [view, setView] = useState<ViewMode>('month');
  const [anchor, setAnchor] = useState(new Date());
  const [filterPerson, setFilterPerson] = useState('');
  const [filterCompany, setFilterCompany] = useState('');

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (filterPerson && t.assigneeId !== filterPerson) return false;
      if (filterCompany && t.companyId !== filterCompany) return false;
      return true;
    });
  }, [tasks, filterPerson, filterCompany]);

  const navigate = (delta: number) => {
    if (view === 'day') setAnchor(shiftDays(anchor, delta));
    else if (view === 'week') setAnchor(shiftDays(anchor, delta * 7));
    else setAnchor(delta > 0 ? nextMonth(anchor) : prevMonth(anchor));
  };

  const goToday = () => setAnchor(new Date());

  const headerLabel =
    view === 'day' ? formatDateLong(anchor) : view === 'week' ? formatWeekLabel(anchor) : formatMonthLabel(anchor);

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-2">
          <Button variant="default" size="icon" onClick={() => navigate(-1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <div className="display-font text-xl font-semibold min-w-[200px] text-center">
            {headerLabel}
          </div>
          <Button variant="default" size="icon" onClick={() => navigate(1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={goToday}>
            اليوم
          </Button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="inline-flex bg-bg-elev border border-border rounded-lg p-1">
            {(['day', 'week', 'month'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                  view === v ? 'bg-accent text-bg' : 'text-fg-dim hover:text-fg'
                )}
              >
                {v === 'day' ? 'يومي' : v === 'week' ? 'أسبوعي' : 'شهري'}
              </button>
            ))}
          </div>

          <Select
            value={filterPerson}
            onChange={(e) => setFilterPerson(e.target.value)}
            className="min-w-[140px]"
          >
            <option value="">كل الفريق</option>
            {team.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>

          <Select
            value={filterCompany}
            onChange={(e) => setFilterCompany(e.target.value)}
            className="min-w-[140px]"
          >
            <option value="">كل الشركات</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {view === 'day' && <DayView date={anchor} tasks={filteredTasks} team={team} companies={companies} />}
      {view === 'week' && <WeekView anchor={anchor} tasks={filteredTasks} team={team} companies={companies} />}
      {view === 'month' && <MonthView anchor={anchor} tasks={filteredTasks} companies={companies} />}
    </div>
  );
}

// ============================================
// DAY VIEW — all members, their tasks for one day
// ============================================
function DayView({
  date,
  tasks,
  team,
  companies,
}: {
  date: Date;
  tasks: Task[];
  team: TeamMember[];
  companies: Company[];
}) {
  const iso = toISODate(date);
  const isWE = isWeekend(date);

  const tasksForMember = (memberId: string) =>
    tasks.filter((t) => {
      if (t.assigneeId !== memberId) return false;
      const start = toISODate(new Date(t.startDate));
      const end = toISODate(new Date(t.endDate));
      return iso >= start && iso <= end;
    });

  if (isWE) {
    return (
      <div className="card text-center py-12">
        <div className="text-4xl opacity-30 mb-3">🏖️</div>
        <div className="display-font text-lg mb-1">يوم عطلة</div>
        <div className="text-sm text-fg-dim">الخميس والجمعة عطلة لكل الفريق</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {team.map((member) => {
        const mTasks = tasksForMember(member.id);
        return (
          <div key={member.id} className="card">
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border-soft">
              <Avatar name={member.name} />
              <div className="flex-1">
                <div className="font-bold">{member.name}</div>
                <div className="text-xs text-fg-dim">
                  {mTasks.length} {mTasks.length === 1 ? 'مهمة' : 'مهام'}
                </div>
              </div>
            </div>
            {mTasks.length === 0 ? (
              <div className="text-sm text-fg-muted text-center py-4">لا توجد مهام لهذا اليوم</div>
            ) : (
              <div className="flex flex-col gap-2">
                {mTasks.map((t) => {
                  const co = companies.find((c) => c.id === t.companyId);
                  return (
                    <div
                      key={t.id}
                      className="bg-bg-elev rounded-lg p-3 border-r-[3px]"
                      style={{ borderRightColor: co?.color ?? '#d4af37' }}
                    >
                      <div className="font-semibold text-sm mb-1.5">{t.title}</div>
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        {co && <CompanyChip name={co.name} color={co.color} />}
                        <span className="text-fg-dim">{TYPE_LABELS[t.type as TaskType]}</span>
                        <StatusBadge status={t.status as TaskStatus} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// WEEK VIEW — grid: members × 5 working days
// ============================================
function WeekView({
  anchor,
  tasks,
  team,
  companies,
}: {
  anchor: Date;
  tasks: Task[];
  team: TeamMember[];
  companies: Company[];
}) {
  const allDays = getWeekDays(anchor);

  return (
    <div className="card overflow-x-auto">
      <div className="min-w-[900px]">
        {/* Header row */}
        <div className="grid gap-2 mb-2" style={{ gridTemplateColumns: '160px repeat(7, 1fr)' }}>
          <div className="text-xs text-fg-muted font-semibold tracking-widest uppercase px-2 py-3">
            الموظف / اليوم
          </div>
          {allDays.map((d, i) => {
            const isWE = isWeekend(d);
            const today = isSameDay(d, new Date());
            return (
              <div
                key={i}
                className={cn(
                  'text-center py-2 px-1 rounded-lg',
                  today && 'bg-accent/10 text-accent',
                  isWE && 'opacity-40'
                )}
              >
                <div className="text-[10px] font-semibold tracking-wider text-fg-muted">
                  {ARABIC_WEEK_LABELS[i]}
                </div>
                <div className={cn('display-font text-lg font-bold', today && 'text-accent')}>
                  {d.getDate()}
                </div>
                <div className="text-[10px] text-fg-muted">{ARABIC_MONTHS[d.getMonth()]}</div>
              </div>
            );
          })}
        </div>

        {/* Member rows */}
        {team.map((member) => (
          <div
            key={member.id}
            className="grid gap-2 mb-2"
            style={{ gridTemplateColumns: '160px repeat(7, 1fr)' }}
          >
            <div className="flex items-center gap-2.5 bg-bg-elev rounded-lg px-3 py-2.5">
              <Avatar name={member.name} size={28} />
              <div className="text-sm font-semibold truncate">{member.name}</div>
            </div>

            {allDays.map((d, i) => {
              const isWE = isWeekend(d);
              const iso = toISODate(d);
              const dayTasks = tasks.filter((t) => {
                if (t.assigneeId !== member.id) return false;
                const s = toISODate(new Date(t.startDate));
                const e = toISODate(new Date(t.endDate));
                return iso >= s && iso <= e;
              });

              if (isWE) {
                return (
                  <div
                    key={i}
                    className="bg-bg-elev/30 rounded-lg min-h-[80px] border border-dashed border-border-soft opacity-40"
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(45deg, transparent 0, transparent 6px, rgba(90,90,112,0.1) 6px, rgba(90,90,112,0.1) 12px)',
                    }}
                  />
                );
              }

              return (
                <div
                  key={i}
                  className="bg-bg-elev border border-border-soft rounded-lg p-2 min-h-[80px] flex flex-col gap-1 overflow-hidden"
                >
                  {dayTasks.length === 0 ? (
                    <div className="text-[10px] text-fg-muted text-center py-2 opacity-50">—</div>
                  ) : (
                    dayTasks.slice(0, 4).map((t) => {
                      const co = companies.find((c) => c.id === t.companyId);
                      return (
                        <div
                          key={t.id}
                          className="text-[10px] py-1 px-1.5 rounded font-medium truncate border-r-2"
                          style={{
                            color: co?.color ?? '#d4af37',
                            borderRightColor: co?.color ?? '#d4af37',
                            background: 'rgba(255,255,255,0.03)',
                          }}
                          title={t.title}
                        >
                          {t.title}
                        </div>
                      );
                    })
                  )}
                  {dayTasks.length > 4 && (
                    <div className="text-[10px] text-fg-muted text-center font-bold">
                      +{dayTasks.length - 4} أخرى
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// MONTH VIEW — full calendar grid
// ============================================
function MonthView({
  anchor,
  tasks,
  companies,
}: {
  anchor: Date;
  tasks: Task[];
  companies: Company[];
}) {
  const yr = anchor.getFullYear();
  const mo = anchor.getMonth();
  const days = getMonthDays(yr, mo);
  const today = new Date();
  const todayISO = toISODate(today);

  // Compute starting offset: Arabic week starts Saturday (getDay=6)
  const dayMap: Record<number, number> = { 6: 0, 0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 };
  const firstDay = new Date(yr, mo, 1);
  const offset = dayMap[firstDay.getDay()];

  return (
    <div className="card">
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}
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
          const isWE = isWeekend(d);
          const isToday = iso === todayISO;

          const dayTasks = tasks.filter((t) => {
            const s = toISODate(new Date(t.startDate));
            const e = toISODate(new Date(t.endDate));
            return iso >= s && iso <= e;
          });

          return (
            <div
              key={iso}
              className={cn(
                'aspect-[1/1.1] bg-bg-elev border border-border-soft rounded-lg p-1.5 flex flex-col overflow-hidden transition-all min-h-[80px]',
                !isWE && 'hover:border-accent-dim hover:-translate-y-px cursor-pointer',
                isToday && 'border-accent ring-1 ring-accent',
                isWE && 'opacity-50'
              )}
              style={
                isWE
                  ? {
                      backgroundImage:
                        'repeating-linear-gradient(45deg, transparent 0, transparent 6px, rgba(90,90,112,0.08) 6px, rgba(90,90,112,0.08) 12px)',
                    }
                  : undefined
              }
            >
              <div
                className={cn(
                  'text-xs font-bold mb-1',
                  isToday ? 'text-accent' : 'text-fg-dim'
                )}
              >
                {d.getDate()}
              </div>
              {!isWE && dayTasks.length > 0 && (
                <div className="flex flex-col gap-0.5 overflow-hidden flex-1">
                  {dayTasks.slice(0, 3).map((t) => {
                    const co = companies.find((c) => c.id === t.companyId);
                    return (
                      <div
                        key={t.id}
                        className="text-[9px] py-0.5 px-1.5 rounded font-medium truncate border-r-2"
                        style={{
                          color: co?.color ?? '#d4af37',
                          borderRightColor: co?.color ?? '#d4af37',
                          background: 'rgba(255,255,255,0.03)',
                        }}
                        title={t.title}
                      >
                        {t.title}
                      </div>
                    );
                  })}
                  {dayTasks.length > 3 && (
                    <div className="text-[9px] text-fg-muted text-center font-bold">
                      +{dayTasks.length - 3}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
