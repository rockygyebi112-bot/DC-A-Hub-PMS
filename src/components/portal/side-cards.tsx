import Link from "next/link";
import { HeadphonesIcon } from "lucide-react";
import type { PortalManager } from "@/lib/portal/queries";

export function NeedHelpCard({ manager }: { manager: PortalManager | null }) {
  const href = manager ? `mailto:${manager.email}` : "mailto:support@dca-hub.com";
  return (
    <section className="rounded-[14px] border bg-card p-5 shadow-card">
      <div className="flex items-start gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <HeadphonesIcon className="size-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <h3 className="font-heading text-sm font-semibold tracking-tight">
              Need help?
            </h3>
            <p className="text-xs text-muted-foreground">
              Reach out to the project team for any questions or support you may need.
            </p>
          </div>
          <Link
            href={href}
            className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
          >
            <HeadphonesIcon className="size-3.5" />
            Contact project team
          </Link>
        </div>
      </div>
    </section>
  );
}
