'use client';

import { useState, useMemo, useTransition } from 'react';
import type { Task, TeamMember, Company } from '@/types';
import { Plus, Pencil, Trash2, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/input';
import { CompanyChip, StatusBadge, Avatar } from '@/components/ui/badge';
import TaskForm from '@/components/forms/TaskForm';
import { TYPE_LABELS, type TaskType, type TaskStatus, STATUS_LABELS } from '@/lib/constants';
import { formatDateShort } from '@/lib/dates';
import { deleteTask, updateTaskStatus } from '@/server/actions/tasks';
import { toast } from '@/components/ui/toaster';

interface TasksClientProps {
  team: TeamMember[];
  companies: Company[];
  tasks: Task[];
}

export default function TasksClient({ team, companies, tasks }: TasksClientProps) {
  const [showForm, setShowForm] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [, startTransition] = useTransition();

  const [fPerson, setFPerson] = useState('');
  const [fCompany, setFCompany] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fType, setFType] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);

  // Active list excludes ready/published by default — they remain in the
  // database for reports but disappear from the live task table once the
  // user marks them done. Selecting a specific status (including ready or
  // published) or toggling "show completed" overrides this.
  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (fPerson && t.assigneeId !== fPerson) return false;
      if (fCompany && t.companyId !== fCompany) return false;
      if (fStatus) {
        if (t.status !== fStatus) return false;
      } else if (!showCompleted && (t.status === 'ready' || t.status === 'published')) {
        return false;
      }
      if (fType && t.type !== fType) return false;
      return true;
    });
  }, [tasks, fPerson, fCompany, fStatus, fType, showCompleted]);

  const completedCount = useMemo(
    () => tasks.filter((t) => t.status === 'ready' || t.status === 'published').length,
    [tasks],
  );

  const handleStatusChange = (id: string, status: string) => {
    startTransition(async () => {
      const result = await updateTaskStatus(id, status);
      if (result.ok) toast('تم تحديث الحالة');
      else toast(result.error, 'error');
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm('حذف التاسك؟')) return;
    startTransition(async () => {
      const result = await deleteTask(id);
      if (result.ok) toast('تم الحذف');
      else toast(result.error, 'error');
    });
  };

  const clearFilters = () => {
    setFPerson('');
    setFCompany('');
    setFStatus('');
    setFType('');
    setShowCompleted(false);
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-end justify-between mb-7 gap-4 flex-wrap">
        <div>
          <h1 className="display-font text-3xl font-semibold">كل التاسكات</h1>
          <p className="text-fg-dim mt-1.5">
            {filtered.length} مهمة نشطة
            {completedCount > 0 && !showCompleted && !fStatus && (
              <>
                {' '}
                · <span className="text-fg-muted">{completedCount} مكتملة مخفية</span>
              </>
            )}
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setEditTask(null);
            setShowForm(true);
          }}
        >
          <Plus className="w-4 h-4" />
          إضافة تاسك
        </Button>
      </div>

      <Card className="mb-5 !p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-fg-dim" />
          <span className="text-xs text-fg-dim font-semibold">الفلاتر:</span>
          <Select value={fPerson} onChange={(e) => setFPerson(e.target.value)} className="!w-auto min-w-[120px]">
            <option value="">كل الموظفين</option>
            {team.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
          <Select value={fCompany} onChange={(e) => setFCompany(e.target.value)} className="!w-auto min-w-[120px]">
            <option value="">كل الشركات</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="!w-auto min-w-[140px]">
            <option value="">كل الحالات</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
          <Select value={fType} onChange={(e) => setFType(e.target.value)} className="!w-auto min-w-[120px]">
            <option value="">كل الأنواع</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none px-2 py-1 rounded-md hover:bg-bg-elev-2">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
              className="w-3.5 h-3.5 accent-accent"
            />
            إظهار المكتملة
          </label>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            مسح
          </Button>
        </div>
      </Card>

      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-bg-elev border-b border-border">
                <th className="text-right px-4 py-3.5 text-[11px] tracking-wider font-semibold text-fg-dim uppercase">
                  المهمة
                </th>
                <th className="text-right px-4 py-3.5 text-[11px] tracking-wider font-semibold text-fg-dim uppercase">
                  الشركة
                </th>
                <th className="text-right px-4 py-3.5 text-[11px] tracking-wider font-semibold text-fg-dim uppercase">
                  النوع
                </th>
                <th className="text-right px-4 py-3.5 text-[11px] tracking-wider font-semibold text-fg-dim uppercase">
                  المسؤول
                </th>
                <th className="text-right px-4 py-3.5 text-[11px] tracking-wider font-semibold text-fg-dim uppercase">
                  التاريخ
                </th>
                <th className="text-right px-4 py-3.5 text-[11px] tracking-wider font-semibold text-fg-dim uppercase">
                  الحالة
                </th>
                <th className="px-4 py-3.5"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-fg-muted">
                    لا توجد تاسكات. اضغط "توليد جدول الشهر" من الصفحة الرئيسية للبدء.
                  </td>
                </tr>
              ) : (
                filtered.map((t) => {
                  const co = companies.find((c) => c.id === t.companyId);
                  const m = team.find((tm) => tm.id === t.assigneeId);
                  return (
                    <tr key={t.id} className="border-b border-border-soft last:border-b-0 hover:bg-bg-elev">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-sm">{t.title}</div>
                        {t.notes && <div className="text-xs text-fg-muted truncate max-w-[300px]">{t.notes}</div>}
                      </td>
                      <td className="px-4 py-3">
                        {co ? (
                          <CompanyChip name={co.name} color={co.color} />
                        ) : (
                          <span className="text-xs text-fg-muted">داخلي</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">{TYPE_LABELS[t.type as TaskType]}</td>
                      <td className="px-4 py-3">
                        {m && (
                          <div className="flex items-center gap-2">
                            <Avatar name={m.name} size={26} />
                            <span className="text-sm">{m.name}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-fg-dim">
                        {formatDateShort(new Date(t.startDate))}
                      </td>
                      <td className="px-4 py-3">
                        <Select
                          value={t.status}
                          onChange={(e) => handleStatusChange(t.id, e.target.value)}
                          className="!py-1 !text-xs !w-auto"
                        >
                          {Object.entries(STATUS_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditTask(t);
                              setShowForm(true);
                            }}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="danger"
                            size="icon"
                            onClick={() => handleDelete(t.id)}
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

      <TaskForm
        key={editTask?.id ?? 'new'}
        open={showForm}
        onOpenChange={(o) => {
          setShowForm(o);
          if (!o) setEditTask(null);
        }}
        task={editTask}
        team={team}
        companies={companies}
      />
    </div>
  );
}
