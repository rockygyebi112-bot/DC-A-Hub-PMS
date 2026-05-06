"use client";

import { useState, useRef, useCallback, useEffect } from "react";

/** Persists state in sessionStorage so it survives in-tab navigation */
function useSessionState<T>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return defaultValue;
    try {
      const stored = sessionStorage.getItem(key);
      return stored !== null ? (JSON.parse(stored) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(state));
    } catch {
      // sessionStorage full or unavailable — silently ignore
    }
  }, [key, state]);

  return [state, setState];
}
import { createClient } from "@/lib/supabase/client";
import { getTableForProgram } from "@/lib/db/tables";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Download, Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import { PROGRAMS, REGIONS, GENDERS, DISABILITY_TYPES, OWNERSHIP_TYPES, BUSINESS_SIZES, FUNDING_STATUSES, BUSINESS_SECTORS, EMPLOYMENT_STATUSES, LEARNING_CATEGORIES } from "@/lib/constants";
import { getAgeBracket } from "@/lib/utils";
import type { Program, ProgramSlug } from "@/lib/types";

type UploadSlug = ProgramSlug;

interface RowError {
  row: number;
  field: string;
  message: string;
}

interface ParsedRow {
  rowNumber: number;
  data: Record<string, unknown>;
  errors: RowError[];
}

const TEMPLATE_COLUMNS: Record<UploadSlug, { key: string; label: string; required?: boolean }[]> = {
  "enterprise-spotlight": [
    { key: "applicant_name", label: "Applicant Name", required: true },
    { key: "region", label: "Region" },
    { key: "gender", label: "Gender" },
    { key: "age", label: "Age" },
    { key: "disability_status", label: "Disability Status" },
    { key: "disability_type", label: "Disability Type" },
    { key: "ownership_type", label: "Ownership Type" },
    { key: "business_longevity", label: "Business Longevity (years)" },
    { key: "business_size", label: "Business Size" },
    { key: "funding_status", label: "Funding Status" },
    { key: "business_registered", label: "Business Registered" },
    { key: "business_sector", label: "Business Sector" },
    { key: "learning", label: "Learning" },
  ],
  "virtual-university": [
    { key: "episode_title", label: "Episode Title", required: true },
    { key: "date_aired", label: "Date Aired (YYYY-MM-DD)" },
    { key: "facebook_views", label: "Facebook Views" },
    { key: "facebook_shares", label: "Facebook Shares" },
    { key: "facebook_saves", label: "Facebook Saves" },
    { key: "facebook_likes", label: "Facebook Likes" },
    { key: "youtube_views", label: "YouTube Views" },
    { key: "youtube_shares", label: "YouTube Shares" },
    { key: "youtube_saves", label: "YouTube Saves" },
    { key: "youtube_likes", label: "YouTube Likes" },
    { key: "learning", label: "Learning" },
  ],
  hangout: [
    { key: "episode_title", label: "Episode Title", required: true },
    { key: "date_aired", label: "Date Aired (YYYY-MM-DD)" },
    { key: "facebook_views", label: "Facebook Views" },
    { key: "facebook_shares", label: "Facebook Shares" },
    { key: "facebook_saves", label: "Facebook Saves" },
    { key: "facebook_likes", label: "Facebook Likes" },
    { key: "youtube_views", label: "YouTube Views" },
    { key: "youtube_shares", label: "YouTube Shares" },
    { key: "youtube_saves", label: "YouTube Saves" },
    { key: "youtube_likes", label: "YouTube Likes" },
    { key: "learning", label: "Learning" },
  ],
  "absa-onboarding": [
    { key: "participant_name", label: "Participant Name", required: true },
    { key: "gender", label: "Gender" },
    { key: "age", label: "Age" },
    { key: "region", label: "Region" },
    { key: "employment_status", label: "Employment Status" },
    { key: "disability_status", label: "Disability Status" },
    { key: "disability_type", label: "Disability Type" },
    { key: "learning", label: "Learning" },
  ],
  learnings: [
    { key: "program", label: "Program", required: true },
    { key: "title", label: "Title", required: true },
    { key: "category", label: "Category" },
    { key: "description", label: "Description" },
    { key: "learning_date", label: "Date (YYYY-MM-DD)" },
  ],
};

function normalizeOptionValue(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveAllowedOption(value: unknown, allowed: readonly string[]): string {
  const normalizedValue = normalizeOptionValue(value);
  if (!normalizedValue) return "";

  const matchedOption = allowed.find(
    (option) => normalizeOptionValue(option) === normalizedValue
  );

  return matchedOption ?? normalizedValue;
}

function validateValue(value: unknown, allowed: readonly string[]): boolean {
  const normalizedValue = normalizeOptionValue(value);
  return (
    !normalizedValue ||
    allowed.some((option) => normalizeOptionValue(option) === normalizedValue)
  );
}

export function BulkUpload() {
  const [slug, setSlug] = useSessionState<UploadSlug>("bulk-upload:slug", "enterprise-spotlight");
  const [programs, setPrograms] = useState<Program[]>([]);
  const [parsedRows, setParsedRows] = useSessionState<ParsedRow[]>("bulk-upload:parsedRows", []);
  const [previewFilter, setPreviewFilter] = useSessionState<"all" | "errors">("bulk-upload:previewFilter", "all");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useSessionState<{ imported: number; skipped: number } | null>("bulk-upload:result", null);
  const fileRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    async function loadPrograms() {
      const { data } = await supabase.from("programs").select("*").order("name");
      setPrograms((data as Program[]) ?? []);
    }

    void loadPrograms();
  }, [supabase]);

  function downloadTemplate() {
    const cols = TEMPLATE_COLUMNS[slug];
    const headers = cols.map((c) => c.label);
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    ws["!cols"] = headers.map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");

    // Instructions sheet
    const instructions = [
      ["Bulk Upload Template"],
      [""],
      ["Instructions:"],
      ["1. Fill in data starting from row 2 (row 1 is headers)"],
      ["2. Required fields are marked with * in the header"],
      ["3. Save file and upload using the Upload button"],
      [""],
      ["Column Details:"],
      ...cols.map((c) => [`${c.label}${c.required ? " *" : ""}`]),
    ];
    const wsInst = XLSX.utils.aoa_to_sheet(instructions);
    XLSX.utils.book_append_sheet(wb, wsInst, "Instructions");

    const programLabel = slug === "learnings" ? "Learnings" : PROGRAMS.find((p) => p.slug === slug)?.name ?? slug;
    XLSX.writeFile(wb, `${programLabel.replace(/\s+/g, "-").toLowerCase()}-template.xlsx`);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    setPreviewFilter("all");

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

      const cols = TEMPLATE_COLUMNS[slug];
      const parsed: ParsedRow[] = json.map((row, idx) => {
        const mapped: Record<string, unknown> = {};
        const errors: RowError[] = [];
        const rowNum = idx + 2; // 1-indexed + header

        for (const col of cols) {
          const val = row[col.label];
          mapped[col.key] = val ?? "";
          if (col.required && (!val || String(val).trim() === "")) {
            errors.push({ row: rowNum, field: col.label, message: "Required" });
          }
        }

        // Program-specific validation
        if (slug === "enterprise-spotlight") {
          mapped.region = resolveAllowedOption(mapped.region, REGIONS);
          mapped.gender = resolveAllowedOption(mapped.gender, GENDERS);
          mapped.disability_type = resolveAllowedOption(
            mapped.disability_type,
            DISABILITY_TYPES
          );
          mapped.ownership_type = resolveAllowedOption(
            mapped.ownership_type,
            OWNERSHIP_TYPES
          );
          mapped.business_size = resolveAllowedOption(
            mapped.business_size,
            BUSINESS_SIZES
          );
          mapped.funding_status = resolveAllowedOption(
            mapped.funding_status,
            FUNDING_STATUSES
          );
          mapped.business_sector = resolveAllowedOption(
            mapped.business_sector,
            BUSINESS_SECTORS
          );
          if (mapped.region && !validateValue(mapped.region, REGIONS)) errors.push({ row: rowNum, field: "Region", message: "Invalid region" });
          if (mapped.gender && !validateValue(mapped.gender, GENDERS)) errors.push({ row: rowNum, field: "Gender", message: "Invalid gender" });
          if (mapped.disability_type && !validateValue(mapped.disability_type, DISABILITY_TYPES)) errors.push({ row: rowNum, field: "Disability Type", message: "Invalid type" });
          if (mapped.ownership_type && !validateValue(mapped.ownership_type, OWNERSHIP_TYPES)) errors.push({ row: rowNum, field: "Ownership Type", message: "Invalid type" });
          if (mapped.business_size && !validateValue(mapped.business_size, BUSINESS_SIZES)) errors.push({ row: rowNum, field: "Business Size", message: "Invalid size" });
          if (mapped.funding_status && !validateValue(mapped.funding_status, FUNDING_STATUSES)) errors.push({ row: rowNum, field: "Funding Status", message: "Invalid status" });
          if (mapped.business_sector && !validateValue(mapped.business_sector, BUSINESS_SECTORS)) errors.push({ row: rowNum, field: "Business Sector", message: "Invalid sector" });
        } else if (slug === "absa-onboarding") {
          mapped.gender = resolveAllowedOption(mapped.gender, GENDERS);
          mapped.region = resolveAllowedOption(mapped.region, REGIONS);
          mapped.employment_status = resolveAllowedOption(
            mapped.employment_status,
            EMPLOYMENT_STATUSES
          );
          if (mapped.gender && !validateValue(mapped.gender, GENDERS)) errors.push({ row: rowNum, field: "Gender", message: "Invalid gender" });
          if (mapped.region && !validateValue(mapped.region, REGIONS)) errors.push({ row: rowNum, field: "Region", message: "Invalid region" });
          if (mapped.employment_status && !validateValue(mapped.employment_status, EMPLOYMENT_STATUSES)) errors.push({ row: rowNum, field: "Employment Status", message: "Invalid status" });
        } else if (slug === "learnings") {
          const candidateProgram = normalizeOptionValue(mapped.program).toLowerCase();
          const validProgram = programs.some(
            (program) =>
              normalizeOptionValue(program.name).toLowerCase() === candidateProgram ||
              program.slug === candidateProgram
          );
          mapped.category = resolveAllowedOption(
            mapped.category,
            LEARNING_CATEGORIES
          );
          if (mapped.program && !validProgram) {
            errors.push({ row: rowNum, field: "Program", message: "Invalid program" });
          }
          if (mapped.category && !validateValue(mapped.category, LEARNING_CATEGORIES)) errors.push({ row: rowNum, field: "Category", message: "Invalid category" });
        }

        return { rowNumber: rowNum, data: mapped, errors };
      });

      setParsedRows(parsed);
    };
    reader.readAsArrayBuffer(file);
    // Reset file input
    if (fileRef.current) fileRef.current.value = "";
  }

  const validRows = parsedRows.filter((r) => r.errors.length === 0);
  const errorRows = parsedRows.filter((r) => r.errors.length > 0);
  const previewRows = previewFilter === "errors" ? errorRows : parsedRows;
  const visiblePreviewRows = previewRows.slice(0, 100);

  const buildRecord = useCallback((row: Record<string, unknown>, userId: string) => {
    if (slug === "enterprise-spotlight") {
      const ageNum = row.age ? parseInt(String(row.age), 10) : null;
      return {
        user_id: userId,
        applicant_name: String(row.applicant_name ?? ""),
        region: String(row.region ?? ""),
        gender: String(row.gender ?? ""),
        age: ageNum,
        age_bracket: ageNum ? getAgeBracket(ageNum) : "",
        disability_status: String(row.disability_status ?? ""),
        disability_type: row.disability_status === "Yes" ? String(row.disability_type ?? "") : null,
        ownership_type: String(row.ownership_type ?? ""),
        business_longevity: row.business_longevity ? parseInt(String(row.business_longevity), 10) : null,
        business_size: String(row.business_size ?? ""),
        funding_status: String(row.funding_status ?? ""),
        business_registered: String(row.business_registered ?? ""),
        business_sector: String(row.business_sector ?? ""),
        learning: String(row.learning ?? ""),
        is_draft: false,
      };
    } else if (slug === "virtual-university" || slug === "hangout") {
      const platforms: string[] = [];
      const metrics: Record<string, { views: number; shares: number; saves: number; likes: number }> = {};
      const fb = { views: parseInt(String(row.facebook_views ?? 0), 10) || 0, shares: parseInt(String(row.facebook_shares ?? 0), 10) || 0, saves: parseInt(String(row.facebook_saves ?? 0), 10) || 0, likes: parseInt(String(row.facebook_likes ?? 0), 10) || 0 };
      const yt = { views: parseInt(String(row.youtube_views ?? 0), 10) || 0, shares: parseInt(String(row.youtube_shares ?? 0), 10) || 0, saves: parseInt(String(row.youtube_saves ?? 0), 10) || 0, likes: parseInt(String(row.youtube_likes ?? 0), 10) || 0 };
      if (fb.views || fb.shares || fb.saves || fb.likes) { platforms.push("Facebook"); metrics.facebook = fb; }
      if (yt.views || yt.shares || yt.saves || yt.likes) { platforms.push("YouTube"); metrics.youtube = yt; }
      return {
        user_id: userId,
        episode_title: String(row.episode_title ?? ""),
        date_aired: row.date_aired ? String(row.date_aired) : null,
        platforms,
        metrics,
        demographics: { gender: {}, age_brackets: {} },
        learning: String(row.learning ?? ""),
        is_draft: false,
      };
    } else if (slug === "absa-onboarding") {
      const ageNum = row.age ? parseInt(String(row.age), 10) : null;
      return {
        user_id: userId,
        participant_name: String(row.participant_name ?? ""),
        gender: String(row.gender ?? ""),
        age: ageNum,
        age_bracket: ageNum ? getAgeBracket(ageNum) : "",
        region: String(row.region ?? ""),
        employment_status: String(row.employment_status ?? ""),
        disability_status: String(row.disability_status ?? ""),
        disability_type:
          row.disability_status === "Yes" ? String(row.disability_type ?? "") : null,
        learning: String(row.learning ?? ""),
        is_draft: false,
      };
    } else {
      // learnings
      const rawProgram = normalizeOptionValue(row.program).toLowerCase();
      const program = programs.find(
        (p) =>
          normalizeOptionValue(p.name).toLowerCase() === rawProgram ||
          p.slug === rawProgram
      );
      return {
        user_id: userId,
        program_id: program?.id ?? "",
        category: String(row.category ?? ""),
        title: String(row.title ?? ""),
        description: String(row.description ?? ""),
        learning_date: row.learning_date ? String(row.learning_date) : null,
      };
    }
  }, [slug, programs]);

  async function handleUpload() {
    if (validRows.length === 0) {
      toast.error("No valid rows to upload");
      return;
    }

    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in");
      setUploading(false);
      return;
    }

    const records = validRows.map((r) => buildRecord(r.data, user.id));
    const table = getTableForProgram(slug);

    // Insert in batches of 50
    let imported = 0;
    for (let i = 0; i < records.length; i += 50) {
      const batch = records.slice(i, i + 50);
      const { error } = await supabase.from(table).insert(batch);
      if (error) {
        toast.error(`Batch error: ${error.message}`);
        break;
      }
      imported += batch.length;
    }

    setUploading(false);
    setResult({ imported, skipped: errorRows.length });
    setParsedRows([]);
    toast.success(`${imported} records imported`);
  }

  const cols = TEMPLATE_COLUMNS[slug];

  return (
    <div className="space-y-6">
      {/* Program selector + actions */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <span className="text-[11px] text-gray-400 uppercase tracking-wider font-medium">
            Program
          </span>
          <Select value={slug} onValueChange={(v) => { setSlug((v ?? slug) as UploadSlug); setParsedRows([]); setResult(null); setPreviewFilter("all"); }}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROGRAMS.map((p) => (
                <SelectItem key={p.slug} value={p.slug}>{p.name}</SelectItem>
              ))}
              <SelectItem value="learnings">Learnings</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button variant="outline" onClick={downloadTemplate}>
          <Download className="size-4 mr-1.5" />
          Download Template
        </Button>

        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="size-4 mr-1.5" />
            Upload File
          </Button>
        </div>
      </div>

      {/* Result summary */}
      {result && (
        <div className="rounded-xl border bg-emerald-50 border-emerald-200 p-4 flex items-center gap-3">
          <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
          <div>
            <p className="font-medium text-emerald-800">{result.imported} records imported successfully</p>
            {result.skipped > 0 && (
              <p className="text-sm text-emerald-600">{result.skipped} rows skipped due to errors</p>
            )}
          </div>
        </div>
      )}

      {/* Preview table */}
      {parsedRows.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="size-5 text-muted-foreground" />
              <div>
                <p className="font-medium text-sm">
                  {parsedRows.length} rows parsed
                </p>
                <p className="text-xs text-muted-foreground">
                  <span className="text-emerald-600 font-medium">{validRows.length} valid</span>
                  {errorRows.length > 0 && (
                    <span className="text-red-500 font-medium ml-2">{errorRows.length} with errors</span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {errorRows.length > 0 && (
                <Tabs
                  value={previewFilter}
                  onValueChange={(value) =>
                    setPreviewFilter((value as "all" | "errors") ?? "all")
                  }
                >
                  <TabsList>
                    <TabsTrigger value="all">All Rows</TabsTrigger>
                    <TabsTrigger value="errors">
                      Errors Only ({errorRows.length})
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
              <Button
                onClick={handleUpload}
                disabled={uploading || validRows.length === 0}
                className="bg-srsf-green-500 hover:bg-srsf-green-600"
              >
                {uploading ? "Uploading..." : `Import ${validRows.length} Records`}
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 overflow-x-auto max-h-96 overflow-y-auto shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead className="w-16">Status</TableHead>
                  {cols.map((c) => (
                    <TableHead key={c.key}>{c.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visiblePreviewRows.map((pr) => {
                  const hasErrors = pr.errors.length > 0;
                  const errorFields = new Set(pr.errors.map((e) => e.field));
                  return (
                    <TableRow key={pr.rowNumber} className={hasErrors ? "bg-red-50/50" : ""}>
                      <TableCell className="text-xs text-muted-foreground">{pr.rowNumber}</TableCell>
                      <TableCell>
                        {hasErrors ? (
                          <Badge variant="destructive" className="text-[10px] px-1.5" title={pr.errors.map((e) => `${e.field}: ${e.message}`).join(", ")}>
                            <AlertCircle className="size-3 mr-0.5" /> Error
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] px-1.5 bg-emerald-100 text-emerald-700">
                            OK
                          </Badge>
                        )}
                      </TableCell>
                      {cols.map((c) => (
                        <TableCell key={c.key} className={errorFields.has(c.label) ? "text-red-600 font-medium" : ""}>
                          {String(pr.data[c.key] ?? "")}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {previewRows.length > 100 && (
            <p className="text-xs text-muted-foreground">
              Showing first 100 of {previewRows.length}{" "}
              {previewFilter === "errors" ? "error rows" : "rows"}
            </p>
          )}
        </div>
      )}

      {/* Empty state */}
      {parsedRows.length === 0 && !result && (
        <div className="rounded-xl border-2 border-dashed border-border/60 bg-card p-12 text-center">
          <FileSpreadsheet className="size-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">Upload a spreadsheet to get started</p>
          <p className="text-sm text-muted-foreground mt-1">
            Download a template first, fill in your data, then upload it here.
          </p>
        </div>
      )}
    </div>
  );
}
