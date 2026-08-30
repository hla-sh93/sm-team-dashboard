import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Task } from "@/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/server/actions/tasks", () => ({
  createTask: vi.fn(),
  updateTaskDetails: vi.fn(),
}));

vi.mock("@/components/ui/toaster", () => ({ toast: vi.fn() }));

vi.mock("@/components/ui/dialog", () => {
  const PassThrough = ({ children }: { children?: React.ReactNode }) => children;
  return {
    Dialog: PassThrough,
    DialogContent: PassThrough,
    DialogHeader: PassThrough,
    DialogTitle: PassThrough,
    DialogDescription: PassThrough,
    DialogFooter: PassThrough,
  };
});

import TaskForm from "@/components/forms/TaskForm";

const publishTask: Task = {
  id: "publish-1",
  kind: "PUBLISH",
  type: "REEL",
  title: "نشر ريل-1 · برو",
  hours: 0,
  quantity: 1,
  pieceNo: 1,
  priority: "NORMAL",
  status: "PUBLISHED",
  publishDate: new Date("2026-07-23T12:00:00Z"),
  readyDate: new Date("2026-07-23T12:00:00Z"),
  workDate: new Date("2026-07-22T12:00:00Z"),
  manualDay: null,
  week: 1,
  overflow: false,
  month: 6,
  year: 2026,
  isPinned: true,
  isAuto: true,
  stage: "PUBLISH",
  board: "DONE",
  blockedById: null,
  pipelineKey: "c_pro:REEL:1",
  detKey: "c_pro:REEL:1:PUBLISH",
  notes: null,
  brief: "BRU reel",
  completedAt: new Date("2026-07-23T12:00:00Z"),
  startedAt: null,
  finishedAt: new Date("2026-07-23T12:00:00Z"),
  reviewedAt: null,
  reviewedById: null,
  createdAt: new Date("2026-07-01T12:00:00Z"),
  updatedAt: new Date("2026-07-23T12:00:00Z"),
  companyId: "c_pro",
  assigneeId: "e_omar",
};

describe("TaskForm publication date", () => {
  it("shows the actual publication date editor for a real PUBLISH task card", () => {
    const html = renderToStaticMarkup(
      React.createElement(TaskForm, {
        open: true,
        onOpenChange: () => undefined,
        task: publishTask,
        employees: [],
        companies: [],
        year: 2026,
        month: 6,
      }),
    );

    expect(html).toContain("تاريخ النشر");
    expect(html).toContain('value="2026-07-23"');
  });
});
