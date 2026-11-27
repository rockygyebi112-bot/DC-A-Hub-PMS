"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyDashboardLink({ path, label = "Copy PMS link" }: { path: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState("");

  async function copy() {
    const url = new URL(path, window.location.origin).href;
    setCopied(false);
    try {
      await navigator.clipboard.writeText(url);
      setFallback("");
      setCopied(true);
    } catch {
      setFallback(url);
    }
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <Button type="button" size="sm" variant="outline" onClick={copy}>
        {label}
      </Button>
      <span role="status" className="text-sm">{copied && "Link copied"}</span>
      {fallback && (
        <input
          aria-label="Dashboard URL"
          className="min-w-0 max-w-full rounded border px-2 py-1 text-sm"
          value={fallback}
          readOnly
          onFocus={(event) => event.currentTarget.select()}
        />
      )}
    </div>
  );
}
