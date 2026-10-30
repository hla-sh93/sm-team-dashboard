import OverviewView from "../OverviewView";
import { requireAdminPage } from "@/lib/auth";

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string }>;
}) {
  await requireAdminPage("/admin");
  return <OverviewView searchParams={await searchParams} />;
}
