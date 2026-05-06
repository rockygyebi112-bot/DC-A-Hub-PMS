import { SidebarProvider } from "@/lib/sidebar-context";
import { DashboardShell } from "@/components/layout/dashboard-shell";

// Dashboard pages are all auth-gated and user-specific — skip static
// prerendering so the build doesn't try to instantiate the Supabase
// client without runtime env vars.
export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <DashboardShell>{children}</DashboardShell>
    </SidebarProvider>
  );
}
