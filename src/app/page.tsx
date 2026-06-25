import OverviewView from "./OverviewView";

export default function HomePage({
  searchParams,
}: {
  searchParams: { y?: string; m?: string };
}) {
  return <OverviewView searchParams={searchParams} />;
}
