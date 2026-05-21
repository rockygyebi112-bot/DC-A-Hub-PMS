"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Calendar, Columns3, LayoutGrid, ListChecks, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const VIEWS = [
  { value: "list", label: "List", icon: ListChecks },
  { value: "cards", label: "Cards", icon: LayoutGrid },
  { value: "kanban", label: "Kanban", icon: Columns3 },
  { value: "calendar", label: "Calendar", icon: Calendar },
];

export function ProjectsToolbar({
  showFilters = true,
  total,
}: {
  showFilters?: boolean;
  total?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const view = params.get("view") ?? "list";
  const status = params.get("status") ?? "all";
  const sort = params.get("sort") ?? "created";

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value && value !== "all") next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
      <div className="flex items-center gap-1 rounded-lg bg-muted/60 p-1">
        {VIEWS.map((v) => {
          const Icon = v.icon;
          const active = view === v.value;
          return (
            <button
              key={v.value}
              type="button"
              onClick={() => setParam("view", v.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" />
              {v.label}
            </button>
          );
        })}
      </div>

      {showFilters && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Chip label="Show" value={statusLabel(status)} onChange={(v) => setParam("status", v)} options={STATUS_OPTIONS} />
          <Chip label="Sort" value={sortLabel(sort)} onChange={(v) => setParam("sort", v)} options={SORT_OPTIONS} />
          <Button variant="outline" size="sm" className="h-8 gap-1.5">
            <SlidersHorizontal className="size-3.5" />
            Add filter
          </Button>
          {typeof total === "number" && (
            <span className="hidden text-muted-foreground sm:inline">{total} projects</span>
          )}
        </div>
      )}
    </div>
  );
}

const STATUS_OPTIONS = [
  { value: "all", label: "All projects" },
  { value: "planning", label: "Planning" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
];

const SORT_OPTIONS = [
  { value: "created", label: "Create date" },
  { value: "name", label: "Name" },
  { value: "deadline", label: "Deadline" },
  { value: "status", label: "Status" },
];

function statusLabel(value: string) {
  return STATUS_OPTIONS.find((o) => o.value === value)?.label ?? "All projects";
}
function sortLabel(value: string) {
  return SORT_OPTIONS.find((o) => o.value === value)?.label ?? "Create date";
}

function Chip({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const current = options.find((o) => o.label === value)?.value ?? options[0].value;
  return (
    <div className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span className="text-muted-foreground">{label}:</span>
      <Select value={current} onValueChange={(v) => onChange(v ?? current)}>
        <SelectTrigger size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
