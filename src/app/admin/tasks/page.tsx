import TasksView from "../../tasks/TasksView";
import { requireAdminPage } from "@/lib/auth";

export default async function AdminTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string }>;
}) {
  await requireAdminPage("/admin/tasks");
  return <TasksView searchParams={await searchParams} admin />;
}
