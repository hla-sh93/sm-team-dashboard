import TasksView from "../../tasks/TasksView";

export default function AdminTasksPage({
  searchParams,
}: {
  searchParams: { y?: string; m?: string };
}) {
  return <TasksView searchParams={searchParams} />;
}
