import TasksView from "./TasksView";

export default function TasksPage({
  searchParams,
}: {
  searchParams: { y?: string; m?: string };
}) {
  return <TasksView searchParams={searchParams} />;
}
