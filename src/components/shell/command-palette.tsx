"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type CommandItem = {
  id: string;
  label: string;
  hint?: string;
  group?: string;
  href?: string;
  onRun?: () => void;
  keywords?: string[];
};

export function CommandPalette({ items }: { items: CommandItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);

  // Cmd/Ctrl + K toggle
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Listen to a custom event so any topbar trigger can open the palette.
  useEffect(() => {
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("dcahub:open-command-palette", onOpen);
    return () =>
      window.removeEventListener("dcahub:open-command-palette", onOpen);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveIdx(0);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      const hay = [
        it.label,
        it.hint ?? "",
        it.group ?? "",
        ...(it.keywords ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [items, query]);

  const grouped = useMemo(() => {
    const m = new Map<string, CommandItem[]>();
    for (const it of filtered) {
      const g = it.group ?? "Other";
      const arr = m.get(g) ?? [];
      arr.push(it);
      m.set(g, arr);
    }
    return Array.from(m.entries());
  }, [filtered]);

  function run(it: CommandItem) {
    setOpen(false);
    if (it.onRun) it.onRun();
    else if (it.href) router.push(it.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const it = filtered[activeIdx];
      if (it) run(it);
    }
  }

  let renderIdx = -1;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        className="!top-[20%] !translate-y-0 max-w-xl p-0 sm:max-w-xl gap-0 overflow-hidden"
      >
        <div className="flex items-center gap-2 border-b px-3.5 py-2.5">
          <Search className="size-4 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIdx(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search projects, pages, actions…"
            className="h-7 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <span className="kbd">esc</span>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              No matches for &ldquo;{query}&rdquo;
            </div>
          ) : (
            grouped.map(([group, list]) => (
              <div key={group} className="px-1 pb-1.5">
                <p className="px-2 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group}
                </p>
                <ul>
                  {list.map((it) => {
                    renderIdx += 1;
                    const isActive = renderIdx === activeIdx;
                    return (
                      <li key={it.id}>
                        <button
                          type="button"
                          onMouseEnter={() => setActiveIdx(renderIdx)}
                          onClick={() => run(it)}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors",
                            isActive
                              ? "bg-accent text-accent-foreground"
                              : "text-foreground hover:bg-muted/60",
                          )}
                        >
                          <span className="truncate">{it.label}</span>
                          {it.hint && (
                            <span className="shrink-0 text-[11px] text-muted-foreground">
                              {it.hint}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
        <div className="flex items-center justify-between gap-2 border-t bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="kbd">↑</span>
            <span className="kbd">↓</span>
            <span>navigate</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="kbd">↵</span>
            <span>open</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CommandPaletteTrigger() {
  function open() {
    window.dispatchEvent(new Event("dcahub:open-command-palette"));
  }
  return (
    <button
      type="button"
      onClick={open}
      aria-label="Open command palette"
      className="hidden md:inline-flex h-7 items-center gap-2 rounded-md border border-input bg-muted/40 px-2 pr-1.5 text-[12px] text-muted-foreground transition-colors hover:border-primary/30 hover:bg-background"
    >
      <Search className="size-3.5" />
      <span className="pr-3">Search…</span>
      <span className="kbd">⌘</span>
      <span className="kbd">K</span>
    </button>
  );
}
