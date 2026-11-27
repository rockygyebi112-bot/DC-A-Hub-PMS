"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize, Minimize } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CopyDashboardLink } from "./copy-dashboard-link";

export function DashboardViewer({
  title,
  path,
  source,
}: {
  title: string;
  path?: string;
  source: string;
}) {
  const viewer = useRef<HTMLDivElement>(null);
  const [native, setNative] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const full = native || expanded;

  useEffect(() => {
    function sync() {
      setNative(document.fullscreenElement === viewer.current);
    }
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function close(event: KeyboardEvent) {
      if (event.key === "Escape") setExpanded(false);
    }
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", close);
    };
  }, [expanded]);

  async function toggle() {
    if (native) {
      await document.exitFullscreen();
      return;
    }
    if (expanded) {
      setExpanded(false);
      return;
    }
    try {
      const element = viewer.current;
      if (element?.requestFullscreen) {
        await element.requestFullscreen();
        return;
      }
    } catch {
      // Fall back to the browser viewport when native fullscreen is unavailable.
    }
    setExpanded(true);
  }

  const Icon = full ? Minimize : Maximize;

  return (
    <div
      ref={viewer}
      className={cn(
        "flex min-w-0 flex-col gap-4",
        full && "h-dvh w-full bg-background p-3 sm:p-4",
        expanded && "fixed inset-0 z-[100]",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">{title}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {path && <CopyDashboardLink path={path} />}
          <Button type="button" size="sm" variant="outline" onClick={toggle}>
            <Icon aria-hidden="true" />
            {full ? "Exit full screen" : "Full screen"}
          </Button>
        </div>
      </div>
      <iframe
        className={cn("w-full rounded border bg-white", full ? "min-h-0 flex-1" : "h-[80dvh] min-h-[24rem]")}
        title={title}
        src={source}
        sandbox="allow-scripts"
      />
    </div>
  );
}
