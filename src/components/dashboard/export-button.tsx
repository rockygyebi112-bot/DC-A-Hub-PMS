"use client";

import { Download } from "lucide-react";
import * as XLSX from "xlsx";

interface ExportButtonProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>[];
  filename: string;
  columns?: { key: string; label: string }[];
}

export function ExportButton({ data, filename, columns }: ExportButtonProps) {
  function handleExport() {
    if (data.length === 0) return;

    let sheetData: Record<string, unknown>[];
    if (columns) {
      sheetData = data.map((row) => {
        const obj: Record<string, unknown> = {};
        for (const col of columns) {
          obj[col.label] = row[col.key];
        }
        return obj;
      });
    } else {
      sheetData = data;
    }

    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, `${filename}.xlsx`);
  }

  return (
    <button
      onClick={handleExport}
      className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-muted-foreground bg-card border border-border rounded-lg hover:bg-muted hover:text-foreground transition-colors shadow-sm"
    >
      <Download className="size-3.5" />
      Export
    </button>
  );
}
