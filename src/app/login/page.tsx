import { redirect } from "next/navigation";
import { isAuthenticated, isAdminConfigured } from "@/lib/auth";
import LoginClient from "./login-client";

export const metadata = { title: "دخول الإدارة" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  // Only allow same-app admin paths as the post-login destination.
  const rawFrom = (await searchParams).from ?? "/admin";
  const from = rawFrom.startsWith("/admin") ? rawFrom : "/admin";

  if (await isAuthenticated()) redirect(from);
  const configured = await isAdminConfigured();

  return <LoginClient configured={configured} from={from} />;
}
