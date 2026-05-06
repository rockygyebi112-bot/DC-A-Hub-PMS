"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { type ProgramSlug } from "@/lib/types";
import { getTableForProgram } from "@/lib/db/tables";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import { TableSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { EmptyState } from "@/components/ui/empty-state";

interface RecentEntriesTableProps {
  programSlug: ProgramSlug;
  refreshKey: number;
  onEdit: (entry: Record<string, unknown>) => void;
}

function getDisplayColumns(
  slug: ProgramSlug
): { key: string; label: string }[] {
  switch (slug) {
    case "enterprise-spotlight":
      return [
        { key: "applicant_name", label: "Applicant" },
        { key: "region", label: "Region" },
        { key: "gender", label: "Gender" },
        { key: "business_sector", label: "Sector" },
      ];
    case "virtual-university":
    case "hangout":
      return [
        { key: "episode_title", label: "Episode" },
        { key: "date_aired", label: "Date Aired" },
        { key: "platforms", label: "Platforms" },
      ];
    case "absa-onboarding":
      return [
        { key: "participant_name", label: "Participant" },
        { key: "region", label: "Region" },
        { key: "gender", label: "Gender" },
        { key: "employment_status", label: "Employment" },
      ];
    case "learnings":
      return [
        { key: "title", label: "Title" },
        { key: "category", label: "Category" },
        { key: "learning_date", label: "Date" },
      ];
  }
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function RecentEntriesTable({
  programSlug,
  refreshKey,
  onEdit,
}: RecentEntriesTableProps) {
  const [entries, setEntries] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const tableName = getTableForProgram(programSlug);
  const columns = getDisplayColumns(programSlug);

  const loadEntries = useCallback(async () => {
    await Promise.resolve();
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const query = supabase
      .from(tableName)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    const { data, error } = await query;
    if (error) {
      toast.error("Failed to load entries");
    }
    setEntries((data as Record<string, unknown>[]) ?? []);
    setLoading(false);
  }, [supabase, tableName]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries, refreshKey]);

  function handleDelete(id: string) {
    // Optimistic removal from local state
    const entryToDelete = entries.find((e) => (e.id as string) === id);
    if (!entryToDelete) return;
    setEntries((prev) => prev.filter((e) => (e.id as string) !== id));

    let undone = false;
    const timeoutId = setTimeout(async () => {
      if (undone) return;
      const { error } = await supabase.from(tableName).delete().eq("id", id);
      if (error) {
        toast.error("Delete failed: " + error.message);
        // Restore if the server actually rejected it
        setEntries((prev) => [entryToDelete, ...prev]);
      }
    }, 5000);

    toast("Entry deleted", {
      description: "The entry will be permanently removed in 5 seconds.",
      action: {
        label: "Undo",
        onClick: () => {
          undone = true;
          clearTimeout(timeoutId);
          setEntries((prev) => [entryToDelete, ...prev]);
          toast.success("Entry restored");
        },
      },
      duration: 5000,
    });
  }

  if (loading) {
    return <TableSkeleton rows={4} cols={columns.length + 2} />;
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No entries yet"
        description="Submit your first entry using the form above — it will show up here."
      />
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.key}>{col.label}</TableHead>
            ))}
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.id as string}>
              {columns.map((col) => (
                <TableCell key={col.key}>
                  {formatCellValue(entry[col.key])}
                </TableCell>
              ))}
              <TableCell>
                {entry.is_draft ? (
                  <Badge variant="secondary">Draft</Badge>
                ) : (
                  <Badge className="bg-srsf-green-100 text-srsf-green-800">
                    Submitted
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(entry)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(entry.id as string)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
