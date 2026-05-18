"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PageInfo } from "@/lib/pagination";

/**
 * Server-driven pagination control. Receives an authoritative PageInfo from
 * the server-rendered page and renders prev/next links plus a compact
 * "Showing X–Y of Z" summary. Page navigation is a plain `<Link>` so
 * Next.js performs an RSC payload swap without a full document reload.
 *
 * The component is a tiny client component so it can read sibling query
 * params off `useSearchParams` and preserve them in the prev/next hrefs.
 */
export function ListPagination({ info }: { info: PageInfo }) {
  const pathname = usePathname();
  const params = useSearchParams();

  function buildHref(targetPage: number): string {
    const next = new URLSearchParams(Array.from(params.entries()));
    if (targetPage <= 1) next.delete("page");
    else next.set("page", String(targetPage));
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  if (info.totalCount === 0) return null;

  const start = info.offset + 1;
  const end = Math.min(info.offset + info.pageSize, info.totalCount);

  return (
    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">
        Showing <span className="font-medium text-foreground">{start.toLocaleString()}</span>
        {start !== end && (
          <>
            {" – "}
            <span className="font-medium text-foreground">{end.toLocaleString()}</span>
          </>
        )}{" "}
        of <span className="font-medium text-foreground">{info.totalCount.toLocaleString()}</span>
      </p>
      <div className="flex items-center gap-1">
        <PageButton
          href={buildHref(info.page - 1)}
          disabled={!info.hasPrev}
          ariaLabel="Previous page"
        >
          <ChevronLeft className="size-4" />
          <span>Previous</span>
        </PageButton>
        <span className="px-2 text-xs tabular-nums text-muted-foreground">
          Page {info.page} of {info.totalPages}
        </span>
        <PageButton
          href={buildHref(info.page + 1)}
          disabled={!info.hasNext}
          ariaLabel="Next page"
        >
          <span>Next</span>
          <ChevronRight className="size-4" />
        </PageButton>
      </div>
    </div>
  );
}

function PageButton({
  href,
  disabled,
  ariaLabel,
  children,
}: {
  href: string;
  disabled: boolean;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  const className = cn(
    "inline-flex h-8 items-center gap-1 rounded-md border px-2.5 text-xs font-medium",
    disabled
      ? "pointer-events-none cursor-not-allowed border-border bg-background text-muted-foreground/50"
      : "border-border bg-background text-foreground hover:bg-accent",
  );
  if (disabled) {
    return (
      <span aria-disabled className={className} aria-label={ariaLabel}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={className} aria-label={ariaLabel} prefetch={false}>
      {children}
    </Link>
  );
}
