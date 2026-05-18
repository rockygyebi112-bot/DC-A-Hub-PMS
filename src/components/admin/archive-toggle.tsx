"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function ArchiveToggle({ label = "Show archived" }: { label?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();
  const showing = params.get("archived") === "1";

  function onToggle(checked: boolean) {
    const next = new URLSearchParams(Array.from(params.entries()));
    if (checked) next.set("archived", "1");
    else next.delete("archived");
    // Reset pagination on filter change.
    next.delete("page");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex items-center gap-2">
      <Switch id="archive-toggle" checked={showing} onCheckedChange={onToggle} />
      <Label htmlFor="archive-toggle">{label}</Label>
    </div>
  );
}
