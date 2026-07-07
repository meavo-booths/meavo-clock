import AppShell from "@/components/app-shell";
import { requireClockAccess } from "@/lib/meavo-auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireClockAccess();
  return <AppShell>{children}</AppShell>;
}
