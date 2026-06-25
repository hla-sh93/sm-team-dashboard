import OverviewView from "../OverviewView";

export default function AdminHomePage({
  searchParams,
}: {
  searchParams: { y?: string; m?: string };
}) {
  return <OverviewView searchParams={searchParams} />;
}
