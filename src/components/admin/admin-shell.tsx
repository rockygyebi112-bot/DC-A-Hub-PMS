import type { ReactNode } from "react";
import { AdminSidebar } from "./admin-sidebar";

export function AdminShell({
  children,
  userLabel,
}: {
  children: ReactNode;
  userLabel: string;
}) {
  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <div className="flex-1 flex flex-col">
        <header className="h-14 border-b flex items-center justify-end px-6 text-sm text-muted-foreground">
          {userLabel}
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
