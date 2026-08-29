import TasksView from "./TasksView";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string }>;
}) {
  return <TasksView searchParams={await searchParams} />;
}
