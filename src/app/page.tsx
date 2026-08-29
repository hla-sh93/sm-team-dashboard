import OverviewView from "./OverviewView";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string }>;
}) {
  return <OverviewView searchParams={await searchParams} />;
}
