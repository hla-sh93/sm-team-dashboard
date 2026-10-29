import TasksView from "../../tasks/TasksView";

export default async function AdminTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string }>;
}) {
  return <TasksView searchParams={await searchParams} admin />;
}
