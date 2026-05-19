"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { dbErrorMessage } from "@/lib/db-errors";
import {
  checkRateLimit,
  extractClientIp,
  logPasswordVerifyAttempt,
  rateLimitMessage,
} from "@/lib/rate-limit";
import { requireAuth, requireProjectReader, requireProjectWriter } from "@/lib/auth/guards";
import {
  validateUpload,
  sanitizeFileName,
  MAX_XLSX_BYTES,
} from "@/lib/uploads";
import {
  activitySchema,
  activityUpdateSchema,
  phaseSchema,
} from "@/lib/workspace/schemas";
import { notifyClientViewersActivityDone } from "@/lib/workspace/notifications";
import { parseWorkplanRowVisibility } from "./workplan-parse";
import type { ActionResult } from "@/lib/action-result";
import { ACTIVITY_PROJECT_JOIN } from "@/lib/supabase/columns";
import {
  insertActivityOrdered,
  insertPhaseOrdered,
} from "@/lib/supabase/rpcs";

async function currentUserId() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  return user?.id ?? null;
}

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

// Escape Postgres LIKE/ILIKE wildcards so attacker-supplied strings cannot
// pattern-match unintended rows.
function escapeLike(value: string): string {
  return value.replace(/([\\%_])/g, "\\$1");
}

function normalizeStatus(value: unknown): "not_started" | "in_progress" | "done" {
  const text = String(value ?? "").toLowerCase().trim();
  if (["done", "complete", "completed", "closed"].includes(text)) return "done";
  if (["in progress", "in-progress", "ongoing", "started"].includes(text)) return "in_progress";
  return "not_started";
}

/**
 * Coerce an ExcelJS cell value to a plain string. ExcelJS surfaces several
 * shapes depending on cell type:
 *   - strings as-is
 *   - numbers as numbers
 *   - Date objects for date-typed cells
 *   - { richText: [{ text }] } for styled text
 *   - { formula, result } for formula cells
 *   - { hyperlink, text } for hyperlinks
 *   - null for empty cells
 * We flatten all of them to a trimmed string so the downstream parsers
 * (`parseDateCell`, `normalizeStatus`, `getCell`) keep working unchanged.
 */
function cellText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) {
    // Preserve the YYYY-MM-DD form parseDateCell expects on the ISO branch.
    return value.toISOString();
  }
  if (typeof value === "object") {
    const obj = value as {
      richText?: { text?: string }[];
      result?: unknown;
      text?: string;
      hyperlink?: string;
    };
    if (Array.isArray(obj.richText)) {
      return obj.richText.map((part) => part.text ?? "").join("").trim();
    }
    if (obj.result !== undefined) return cellText(obj.result);
    if (typeof obj.text === "string") return obj.text.trim();
  }
  return String(value).trim();
}

function getCell(row: Record<string, unknown>, names: string[]) {
  const entries = Object.entries(row);
  for (const name of names) {
    const found = entries.find(([key]) => normalizeKey(key) === normalizeKey(name));
    if (found && found[1] != null) return String(found[1]).trim();
  }
  return "";
}

// Convert a free-form date cell (Excel may surface ISO strings, locale strings,
// or actual Date objects depending on cell formatting) into a Postgres-friendly
// `YYYY-MM-DD` string, or null when the value is empty/unparseable. We never
// want to fail the whole import on a single bad date — the row-level columns
// are optional.
function parseDateCell(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Already an ISO date.
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  // Day-first format used by our workplan template and most non-US locales
  // (e.g. "06/05/2026" = 6 May 2026). `new Date()` would mis-parse this as
  // MM/DD/YYYY ("June 5") on values where the day is <= 12, and reject any
  // value where the day is > 12 outright — silently dropping every row past
  // the 12th of the month. Handle DMY explicitly with / - or . separators.
  const dmy = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy) {
    const [, dStr, mStr, yStr] = dmy;
    const day = Number(dStr);
    const month = Number(mStr);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${yStr}-${mStr.padStart(2, "0")}-${dStr.padStart(2, "0")}`;
    }
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  // Strip the time-of-day so we always store a pure date.
  return parsed.toISOString().slice(0, 10);
}

export async function createPhase(projectId: string, formData: FormData): Promise<ActionResult> {
  const auth = await requireProjectWriter(projectId);
  if (!auth.ok) return auth;

  const parsed = phaseSchema.safeParse({
    name: formValue(formData, "name"),
    description: formValue(formData, "description"),
    start_date: formValue(formData, "start_date"),
    end_date: formValue(formData, "end_date"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  // Atomic ordered insert (migration 0029). The RPC takes an advisory lock
  // per project and computes order_index inside the transaction so two
  // concurrent creates can't collide on the same slot.
  const sb = await createClient();
  const { error } = await insertPhaseOrdered(sb, {
    project_id: projectId,
    name: parsed.data.name,
    description: parsed.data.description,
    start_date: parsed.data.start_date,
    end_date: parsed.data.end_date,
  });
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(`/workspace/projects/${projectId}`);
  revalidatePath(`/admin/projects/${projectId}`);
  return { ok: true };
}

export async function importWorkplanSheet(
  projectId: string,
  formData: FormData,
): Promise<ActionResult<{ phasesCreated: number; activitiesCreated: number; activitiesUpdated: number }>> {
  const auth = await requireProjectWriter(projectId);
  if (!auth.ok) return auth;

  const file = formData.get("workplan");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose an Excel checklist to import" };
  }
  if (file.size > MAX_XLSX_BYTES) {
    return { ok: false, error: `Workplan file must be ${MAX_XLSX_BYTES / (1024 * 1024)} MB or smaller` };
  }

  const bytes = await file.arrayBuffer();
  // Lazy-import exceljs so action invocations that don't touch Excel (the
  // vast majority — every other action in this file) don't pay the parse
  // cost on cold start. ExcelJS replaces the previous SheetJS dependency:
  // npm-resolved, narrower surface, easier to keep patched.
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  try {
    // ExcelJS's `.xlsx.load` is typed against an older Node `Buffer` shape
    // that differs from the current TS lib (resizable / detached members).
    // At runtime it accepts any ArrayBufferLike — which is what `File.
    // arrayBuffer()` returns. Cast at the boundary; the surrounding `try`
    // converts a malformed workbook into a friendly error response.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(bytes as any);
  } catch (err) {
    console.error("[workplan] xlsx parse failed", err);
    return { ok: false, error: "Could not parse the uploaded workbook" };
  }

  // Prefer the "Checklist" sheet (template default) if present; otherwise
  // fall back to the first worksheet. Case-insensitive match keeps user-
  // saved variants like "checklist" or "CHECKLIST" working.
  const sheet =
    workbook.worksheets.find((ws) => ws.name.toLowerCase() === "checklist") ??
    workbook.worksheets[0];
  if (!sheet) return { ok: false, error: "No worksheet found in the upload" };

  const sheetName = sheet.name;

  // Build header → column-number map from row 1. ExcelJS rows/columns are
  // 1-indexed; `sheet.getRow(1).values` returns a sparse array with `null`
  // at index 0 and headers from index 1 onwards.
  const headerRow = sheet.getRow(1);
  const headerByCol = new Map<number, string>();
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const text = cellText(cell.value);
    if (text) headerByCol.set(colNumber, text);
  });
  if (headerByCol.size === 0) {
    return { ok: false, error: "No column headers found in the upload" };
  }

  // Walk data rows (row 2 onwards) and surface as `{ header: value }` maps
  // so the existing `getCell()` helper keeps working without changes.
  const rows: Record<string, unknown>[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const out: Record<string, unknown> = {};
    let nonEmpty = false;
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const header = headerByCol.get(colNumber);
      if (!header) return;
      const value = cellText(cell.value);
      out[header] = value;
      if (value) nonEmpty = true;
    });
    if (nonEmpty) rows.push(out);
  });
  if (rows.length === 0) return { ok: false, error: "No checklist rows found" };

  const sb = await createClient();
  const userId = await currentUserId();

  // ──────────────────────────────────────────────────────────────────────
  // Parse rows into a typed in-memory shape FIRST. The previous loop
  // issued ~5 DB round-trips per row (select phase, select activity,
  // count, insert/update, activity_log insert) for a worst case of
  // ~2500 round-trips on a 500-row workplan. We replace that with a
  // bounded number of queries: 1 phase fetch, 1 activity fetch, N
  // phase RPCs (rare), 1 bulk activity insert, M parallel updates,
  // 1 bulk activity_log insert.
  // ──────────────────────────────────────────────────────────────────────

  type ParsedRow = {
    phaseName: string;
    activityName: string;
    deliverable: string;
    notes: string;
    responsible: string;
    status: "not_started" | "in_progress" | "done";
    plannedDate: string | null;
    completedDate: string | null;
    visibility: "client_visible" | "internal";
  };

  const parsed: ParsedRow[] = [];
  const rowErrors: string[] = [];
  let currentPhaseName = "";
  rows.forEach((row, idx) => {
    const phaseName = getCell(row, ["Category", "Phase"]);
    const activityName = getCell(row, ["Activity", "Task Description", "Task"]);
    if (phaseName) currentPhaseName = phaseName;
    if (!currentPhaseName || !activityName) return;
    const vis = parseWorkplanRowVisibility(getCell(row, ["Visibility"]));
    if (!vis.ok) {
      // idx + 2: spreadsheet row = header (row 1) + zero-based idx.
      rowErrors.push(`Row ${idx + 2} (${activityName}): ${vis.error}`);
      return;
    }
    parsed.push({
      phaseName: currentPhaseName,
      activityName,
      deliverable: getCell(row, ["Deliverable"]),
      notes: getCell(row, ["Notes/Dependencies", "Notes", "Dependencies"]),
      responsible: getCell(row, ["Responsible Team Member/Team", "Responsible"]),
      status: normalizeStatus(getCell(row, ["Status"])),
      plannedDate: parseDateCell(getCell(row, ["Start Date", "Planned Date", "Start"])),
      completedDate: parseDateCell(
        getCell(row, ["End Date", "Completed Date", "Completion Date", "End"]),
      ),
      visibility: vis.value,
    });
  });
  if (rowErrors.length > 0) return { ok: false, error: rowErrors.join("\n") };
  if (parsed.length === 0) return { ok: false, error: "No checklist rows found" };

  // 1) Fetch existing phases for the project — one round-trip.
  const { data: existingPhases, error: phaseError } = await sb
    .from("phases")
    .select("id, name, order_index")
    .eq("project_id", projectId);
  if (phaseError) return { ok: false, error: dbErrorMessage(phaseError) };

  const phaseByKey = new Map<string, { id: string }>();
  for (const ph of existingPhases ?? []) {
    phaseByKey.set(normalizeKey(ph.name), { id: ph.id });
  }

  // 2) Create missing phases via the atomic ordered-insert RPC.
  // Sequential because each call must observe the previous one's
  // committed order_index. Typical workbooks have <10 phases.
  const neededPhaseKeys = new Set<string>();
  const phaseDisplayName = new Map<string, string>(); // first-seen display form
  for (const p of parsed) {
    const key = normalizeKey(p.phaseName);
    if (!phaseByKey.has(key)) {
      neededPhaseKeys.add(key);
      if (!phaseDisplayName.has(key)) phaseDisplayName.set(key, p.phaseName);
    }
  }
  let phasesCreated = 0;
  for (const key of neededPhaseKeys) {
    const { data: created, error } = await insertPhaseOrdered(sb, {
      project_id: projectId,
      name: phaseDisplayName.get(key)!,
    });
    if (error || !created) return { ok: false, error: dbErrorMessage(error) };
    phaseByKey.set(key, { id: created.id });
    phasesCreated += 1;
  }

  // 3) Pre-fetch existing activities for ALL phases in scope — one round-
  // trip replacing N selects in the old loop.
  const phaseIdsInScope = parsed
    .map((p) => phaseByKey.get(normalizeKey(p.phaseName))?.id)
    .filter((id): id is string => typeof id === "string");
  const uniquePhaseIds = Array.from(new Set(phaseIdsInScope));
  const { data: existingActivities, error: existingActErr } = await sb
    .from("activities")
    .select("id, phase_id, name, order_index")
    .in("phase_id", uniquePhaseIds);
  if (existingActErr) return { ok: false, error: dbErrorMessage(existingActErr) };

  const activityKey = (phaseId: string, name: string) =>
    `${phaseId}::${normalizeKey(name)}`;
  const existingByKey = new Map<string, { id: string }>();
  const maxOrderByPhase = new Map<string, number>();
  for (const a of existingActivities ?? []) {
    existingByKey.set(activityKey(a.phase_id, a.name), { id: a.id });
    const prev = maxOrderByPhase.get(a.phase_id) ?? -1;
    if (a.order_index > prev) maxOrderByPhase.set(a.phase_id, a.order_index);
  }

  // 4) Walk parsed rows and partition into inserts vs updates. Inserts
  // are deduped within the workbook (last occurrence wins) so duplicate
  // sheet rows don't trip the phase+name unique constraint mid-batch.
  type InsertRow = {
    phase_id: string;
    name: string;
    description: string | null;
    deliverable: string | null;
    responsible: string | null;
    status: ParsedRow["status"];
    planned_date: string | null;
    completed_date: string | null;
    order_index: number;
    created_by: string | null;
    visibility: ParsedRow["visibility"];
  };
  type UpdateRow = {
    id: string;
    description: string | null;
    deliverable: string | null;
    responsible: string | null;
    status: ParsedRow["status"];
    visibility: ParsedRow["visibility"];
    planned_date?: string | null;
    completed_date?: string | null;
  };

  const insertsByKey = new Map<string, InsertRow>();
  const updates: UpdateRow[] = [];
  // We escape ILIKE wildcards only for the rare exact-match fallback below.
  void escapeLike;

  for (const p of parsed) {
    const phaseKey = normalizeKey(p.phaseName);
    const phase = phaseByKey.get(phaseKey);
    if (!phase) continue; // unreachable: created above
    const aKey = activityKey(phase.id, p.activityName);
    const existing = existingByKey.get(aKey);

    if (existing) {
      updates.push({
        id: existing.id,
        description: p.notes || null,
        deliverable: p.deliverable || null,
        responsible: p.responsible || null,
        status: p.status,
        visibility: p.visibility,
        ...(p.plannedDate ? { planned_date: p.plannedDate } : {}),
        ...(p.completedDate ? { completed_date: p.completedDate } : {}),
      });
    } else {
      // Compute next order_index from in-memory max so concurrent rows in
      // the same phase get sequential slots. Last occurrence of a duplicate
      // (phase, name) wins.
      const prevMax = maxOrderByPhase.get(phase.id) ?? -1;
      let nextOrder: number;
      if (insertsByKey.has(aKey)) {
        nextOrder = insertsByKey.get(aKey)!.order_index;
      } else {
        nextOrder = prevMax + 1;
        maxOrderByPhase.set(phase.id, nextOrder);
      }
      insertsByKey.set(aKey, {
        phase_id: phase.id,
        name: p.activityName,
        description: p.notes || null,
        deliverable: p.deliverable || null,
        responsible: p.responsible || null,
        status: p.status,
        planned_date: p.plannedDate,
        completed_date: p.completedDate,
        order_index: nextOrder,
        created_by: userId,
        visibility: p.visibility,
      });
    }
  }

  // 5) Bulk insert all new activities in one round-trip. The DB unique
  // index on (phase_id, order_index) added by migration 0029 protects
  // against any race with a concurrent import.
  const insertsArr = Array.from(insertsByKey.values());
  let activitiesCreated = 0;
  let createdIds: string[] = [];
  if (insertsArr.length > 0) {
    const { data: created, error } = await sb
      .from("activities")
      .insert(insertsArr)
      .select("id");
    if (error) return { ok: false, error: dbErrorMessage(error) };
    activitiesCreated = created?.length ?? 0;
    createdIds = (created ?? []).map((r) => r.id);
  }

  // 6) Run updates in parallel. supabase-js can't bulk UPDATE different
  // payloads in one request, but Promise.all keeps the round-trips
  // overlapping rather than sequential.
  let activitiesUpdated = 0;
  if (updates.length > 0) {
    const results = await Promise.all(
      updates.map((u) =>
        sb
          .from("activities")
          .update({
            description: u.description,
            deliverable: u.deliverable,
            responsible: u.responsible,
            status: u.status,
            visibility: u.visibility,
            ...(u.planned_date !== undefined ? { planned_date: u.planned_date } : {}),
            ...(u.completed_date !== undefined ? { completed_date: u.completed_date } : {}),
          })
          .eq("id", u.id),
      ),
    );
    for (const r of results) {
      if (r.error) return { ok: false, error: dbErrorMessage(r.error) };
      activitiesUpdated += 1;
    }
  }

  // 7) One bulk activity_log insert for the newly created activities.
  if (createdIds.length > 0) {
    await sb.from("activity_log").insert(
      createdIds.map((activity_id) => ({
        project_id: projectId,
        activity_id,
        actor_user_id: userId,
        action: "created",
        meta: { source: "workplan_import", sheet: sheetName },
      })),
    );
  }

  revalidatePath(`/workspace/projects/${projectId}`);
  revalidatePath(`/portal/projects/${projectId}`);
  revalidatePath(`/admin/projects/${projectId}`);
  return { ok: true, data: { phasesCreated, activitiesCreated, activitiesUpdated } };
}

export async function updatePhase(phaseId: string, formData: FormData): Promise<ActionResult> {
  // Defense in depth: identify the caller before we touch the DB. The
  // project-scoped check below relies on RLS to keep an unauthenticated
  // user from probing phase IDs via the lookup query; we'd rather not.
  const baseAuth = await requireAuth();
  if (!baseAuth.ok) return baseAuth;

  const parsed = phaseSchema.safeParse({
    name: formValue(formData, "name"),
    description: formValue(formData, "description"),
    start_date: formValue(formData, "start_date"),
    end_date: formValue(formData, "end_date"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const sb = await createClient();
  const { data: phase } = await sb.from("phases").select("project_id").eq("id", phaseId).single();
  if (!phase?.project_id) return { ok: false, error: "Phase not found" };
  const auth = await requireProjectWriter(phase.project_id);
  if (!auth.ok) return auth;

  const { error } = await sb.from("phases").update(parsed.data).eq("id", phaseId);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(`/workspace/projects/${phase?.project_id}`);
  revalidatePath(`/admin/projects/${phase?.project_id}`);
  revalidatePath(`/workspace/projects/${phase?.project_id}/phases/${phaseId}`);
  return { ok: true };
}

export async function createActivity(projectId: string, formData: FormData): Promise<ActionResult<{ id: string }>> {
  const auth = await requireProjectWriter(projectId);
  if (!auth.ok) return auth;

  const parsed = activitySchema.safeParse({
    phase_id: formValue(formData, "phase_id"),
    name: formValue(formData, "name"),
    description: formValue(formData, "description"),
    deliverable: formValue(formData, "deliverable"),
    planned_date: formValue(formData, "planned_date"),
    responsible: formValue(formData, "responsible"),
    visibility: formValue(formData, "visibility"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const userId = await currentUserId();
  const sb = await createClient();
  // Atomic ordered insert (migration 0029).
  const { data, error } = await insertActivityOrdered(sb, {
    phase_id: parsed.data.phase_id,
    name: parsed.data.name,
    description: parsed.data.description,
    deliverable: parsed.data.deliverable,
    responsible: parsed.data.responsible,
    planned_date: parsed.data.planned_date,
    created_by: userId,
  });
  if (error || !data) return { ok: false, error: dbErrorMessage(error) };

  // The ordered-insert RPC predates the visibility column (migration 0030) and
  // hard-codes its column list, so it always inserts the default 'client_visible'.
  // Patch the chosen visibility in a follow-up UPDATE when it differs from the
  // default; avoids a new RPC-extending migration.
  if (parsed.data.visibility !== "client_visible") {
    const { error: visErr } = await sb
      .from("activities")
      .update({ visibility: parsed.data.visibility })
      .eq("id", data.id);
    if (visErr) {
      // Compensating delete: avoid leaving an activity in the wrong visibility
      // (the user asked for 'internal'; falling back to 'client_visible' would
      // be a privacy regression).
      await sb.from("activities").delete().eq("id", data.id);
      return { ok: false, error: dbErrorMessage(visErr) };
    }
  }

  await sb.from("activity_log").insert({
    project_id: projectId,
    activity_id: data.id,
    actor_user_id: userId,
    action: "created",
  });

  revalidatePath(`/workspace/projects/${projectId}`);
  revalidatePath(`/admin/projects/${projectId}`);
  return { ok: true, data: { id: data.id } };
}

export async function updateActivity(activityId: string, formData: FormData): Promise<ActionResult> {
  const parsed = activityUpdateSchema.safeParse({
    phase_id: formValue(formData, "phase_id"),
    name: formValue(formData, "name"),
    description: formValue(formData, "description"),
    deliverable: formValue(formData, "deliverable"),
    planned_date: formValue(formData, "planned_date"),
    responsible: formValue(formData, "responsible"),
    visibility: formValue(formData, "visibility"),
    status: formValue(formData, "status"),
    completed_date: formValue(formData, "completed_date"),
    narrative_note: formValue(formData, "narrative_note"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const sb = await createClient();
  const userId = await currentUserId();
  const { data: before } = await sb
    .from("activities")
    .select("status, visibility, phase:phases(project_id)")
    .eq("id", activityId)
    .single();
  const phase = Array.isArray(before?.phase) ? before?.phase[0] : before?.phase;
  const projectId = phase?.project_id;
  if (!projectId) return { ok: false, error: "Activity not found" };

  const auth = await requireProjectWriter(projectId);
  if (!auth.ok) return auth;

  const { error } = await sb.from("activities").update(parsed.data).eq("id", activityId);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  if (projectId) {
    const markedDone = before?.status !== "done" && parsed.data.status === "done";
    const markedStarted =
      before?.status !== "in_progress" &&
      before?.status !== "done" &&
      parsed.data.status === "in_progress";
    const notification = markedDone
      ? await notifyClientViewersActivityDone({ projectId, activityId }).catch((err) => ({
          ok: false,
          reason: String(err),
        }))
      : { ok: true };

    const action = markedDone ? "marked_done" : markedStarted ? "started" : "updated";
    const prevVisibility = before?.visibility;
    const visibilityChanged =
      prevVisibility !== undefined && prevVisibility !== parsed.data.visibility;
    const meta: Record<string, string> = {};
    if (!notification.ok) meta.email_error = notification.reason ?? "unknown";
    if (visibilityChanged) {
      meta.visibility_changed_from = prevVisibility!;
      meta.visibility_changed_to = parsed.data.visibility;
    }
    await sb.from("activity_log").insert({
      project_id: projectId,
      activity_id: activityId,
      actor_user_id: userId,
      action,
      meta,
    });

    revalidatePath(`/workspace/projects/${projectId}`);
    revalidatePath(`/portal/projects/${projectId}`);
    revalidatePath(`/admin/projects/${projectId}`);
  }
  revalidatePath(`/workspace/projects/${projectId}/activities/${activityId}`);
  revalidatePath(`/portal/projects/${projectId}/activities/${activityId}`);
  // (Was: a duplicate revalidatePath for `/admin/projects/${projectId}` here.
  // Removed — the branch above already revalidates it.)
  return { ok: true };
}

async function collectProofPaths(sb: Awaited<ReturnType<typeof createClient>>, activityIds: string[]) {
  if (activityIds.length === 0) return [] as string[];
  const { data } = await sb
    .from("activity_proofs")
    .select("file_path")
    .in("activity_id", activityIds);
  return (data ?? [])
    .map((p) => p.file_path)
    .filter((path): path is string => typeof path === "string" && path.length > 0);
}

async function removeStorageFiles(
  sb: Awaited<ReturnType<typeof createClient>>,
  paths: string[],
) {
  if (paths.length === 0) return;
  // Storage SDK accepts up to ~1000 paths per call.
  const chunkSize = 100;
  for (let i = 0; i < paths.length; i += chunkSize) {
    await sb.storage.from("proofs").remove(paths.slice(i, i + chunkSize));
  }
}

export async function deleteActivity(activityId: string): Promise<ActionResult<{ projectId: string }>> {
  const baseAuth = await requireAuth();
  if (!baseAuth.ok) return baseAuth;

  const sb = await createClient();
  const { data: activity, error: lookupError } = await sb
    .from("activities")
    .select(`id, ${ACTIVITY_PROJECT_JOIN}`)
    .eq("id", activityId)
    .single();
  if (lookupError || !activity) return { ok: false, error: lookupError ? dbErrorMessage(lookupError) : "Activity not found" };
  const phase = Array.isArray(activity.phase) ? activity.phase[0] : activity.phase;
  const projectId = phase?.project_id;
  if (!projectId) return { ok: false, error: "Project not found" };

  const auth = await requireProjectWriter(projectId);
  if (!auth.ok) return auth;

  const paths = await collectProofPaths(sb, [activityId]);
  await removeStorageFiles(sb, paths);

  const { error } = await sb.from("activities").delete().eq("id", activityId);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(`/workspace/projects/${projectId}`);
  revalidatePath(`/portal/projects/${projectId}`);
  return { ok: true, data: { projectId } };
}

export async function deletePhase(phaseId: string): Promise<ActionResult<{ projectId: string }>> {
  const baseAuth = await requireAuth();
  if (!baseAuth.ok) return baseAuth;

  const sb = await createClient();
  const { data: phase, error: lookupError } = await sb
    .from("phases")
    .select("id, project_id")
    .eq("id", phaseId)
    .single();
  if (lookupError || !phase) return { ok: false, error: lookupError ? dbErrorMessage(lookupError) : "Phase not found" };

  const auth = await requireProjectWriter(phase.project_id);
  if (!auth.ok) return auth;

  const { data: activityRows } = await sb.from("activities").select("id").eq("phase_id", phaseId);
  const activityIds = (activityRows ?? []).map((a) => a.id);
  const paths = await collectProofPaths(sb, activityIds);
  await removeStorageFiles(sb, paths);

  const { error } = await sb.from("phases").delete().eq("id", phaseId);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(`/workspace/projects/${phase.project_id}`);
  revalidatePath(`/portal/projects/${phase.project_id}`);
  return { ok: true, data: { projectId: phase.project_id } };
}

export async function deleteWorkplan(projectId: string): Promise<ActionResult> {
  const auth = await requireProjectWriter(projectId);
  if (!auth.ok) return auth;

  const sb = await createClient();
  const { data: phases, error: phaseError } = await sb
    .from("phases")
    .select("id")
    .eq("project_id", projectId);
  if (phaseError) return { ok: false, error: dbErrorMessage(phaseError) };

  const phaseIds = (phases ?? []).map((p) => p.id);
  if (phaseIds.length === 0) {
    revalidatePath(`/workspace/projects/${projectId}`);
    return { ok: true };
  }

  const { data: activityRows } = await sb.from("activities").select("id").in("phase_id", phaseIds);
  const activityIds = (activityRows ?? []).map((a) => a.id);
  const paths = await collectProofPaths(sb, activityIds);
  await removeStorageFiles(sb, paths);

  const { error } = await sb.from("phases").delete().in("id", phaseIds);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(`/workspace/projects/${projectId}`);
  revalidatePath(`/portal/projects/${projectId}`);
  return { ok: true };
}

export async function uploadProofs(activityId: string, formData: FormData): Promise<ActionResult> {
  const files = formData
    .getAll("proofs")
    .filter((item): item is File => item instanceof File && item.size > 0);
  if (files.length === 0) return { ok: false, error: "Choose at least one file" };

  const sb = await createClient();
  const userId = await currentUserId();
  const { data: activity } = await sb
    .from("activities")
    .select(ACTIVITY_PROJECT_JOIN)
    .eq("id", activityId)
    .single();
  const phase = Array.isArray(activity?.phase) ? activity?.phase[0] : activity?.phase;
  const projectId = phase?.project_id;
  if (!projectId) return { ok: false, error: "Project not found" };

  const auth = await requireProjectWriter(projectId);
  if (!auth.ok) return auth;

  // Validate every file up-front so we never upload partial batches.
  for (const file of files) {
    const validation = validateUpload("proof", {
      size: file.size,
      mimeType: file.type,
      fileName: file.name,
    });
    if (!validation.ok) return { ok: false, error: validation.error };
  }

  for (const file of files) {
    const safeName = sanitizeFileName(file.name);
    const path = `projects/${projectId}/activities/${activityId}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await sb.storage.from("proofs").upload(path, file, {
      contentType: file.type || "application/octet-stream",
    });
    if (uploadError) return { ok: false, error: dbErrorMessage(uploadError) };

    const { error: insertError } = await sb.from("activity_proofs").insert({
      activity_id: activityId,
      kind: "file",
      file_path: path,
      file_name: safeName,
      mime_type: file.type || null,
      size_bytes: file.size,
      caption: formValue(formData, "caption") || null,
      uploaded_by: userId,
    });
    if (insertError) return { ok: false, error: dbErrorMessage(insertError) };
  }

  await sb.from("activity_log").insert({
    project_id: projectId,
    activity_id: activityId,
    actor_user_id: userId,
    action: "proof_added",
    meta: { count: files.length },
  });

  revalidatePath(`/workspace/projects/${projectId}/activities/${activityId}`);
  revalidatePath(`/portal/projects/${projectId}/activities/${activityId}`);
  revalidatePath(`/admin/projects/${projectId}`);
  return { ok: true };
}

/**
 * Resolve an attached proof (file or link) into an actual URL that the
 * caller can open, but only after re-verifying project access and writing
 * an audit row to `proof_access_log`. This is the only place that mints
 * signed URLs for proof files — the listing query intentionally does not.
 *
 * For files: returns a short-lived (5 min) signed URL on the `proofs`
 * storage bucket. For external links: returns the stored https URL.
 *
 * The optional `purpose` string is stored in the audit log so admins can
 * see why a user opened a document (e.g. "audit review", "client report").
 */
export async function requestProofAccess(
  proofId: string,
  password: string,
  purpose?: string,
): Promise<ActionResult<{ url: string; kind: "file" | "link"; fileName: string }>> {
  const auth = await requireAuth();
  if (!auth.ok) return auth;

  if (typeof password !== "string" || password.length === 0) {
    return { ok: false, error: "Password is required" };
  }

  // C-4: rate limit before doing any work. 5 attempts per 10 minutes per
  // user — generous enough for legitimate user fat-fingering, tight enough
  // that an attacker cannot brute the password via this endpoint.
  const rl = await checkRateLimit(
    "pwd-verify",
    `proof:${auth.userId}`,
    5,
    600,
  );
  if (!rl.ok) {
    return {
      ok: false,
      error: rateLimitMessage(rl.retryAfterSeconds, "Too many password attempts"),
    };
  }

  const sb = await createClient();

  // Re-verify identity by checking the current user's password against
  // Supabase auth. We use a brand-new supabase-js client (no cookies, no
  // session persistence) so a successful signInWithPassword call here does
  // not replace or refresh the user's actual session.
  const {
    data: { user: currentUser },
  } = await sb.auth.getUser();
  if (!currentUser?.email) {
    return { ok: false, error: "Could not verify identity" };
  }
  const verifier = createSupabaseJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { error: verifyError } = await verifier.auth.signInWithPassword({
    email: currentUser.email,
    password,
  });
  await logPasswordVerifyAttempt({
    userId: auth.userId,
    email: currentUser.email,
    success: !verifyError,
    context: "proof_access",
  });
  if (verifyError) {
    return { ok: false, error: "Incorrect password" };
  }

  const { data: proof, error: pe } = await sb
    .from("activity_proofs")
    .select(
      "id, kind, file_path, file_name, url, activity:activities(id, phase:phases(id, project_id))",
    )
    .eq("id", proofId)
    .maybeSingle();
  if (pe || !proof) return { ok: false, error: "Document not found" };

  // Walk activity -> phase -> project to find which project this proof
  // belongs to, so we can re-check membership before issuing access.
  const activity = Array.isArray(proof.activity) ? proof.activity[0] : proof.activity;
  const phase = Array.isArray(activity?.phase) ? activity?.phase[0] : activity?.phase;
  const projectId: string | undefined = phase?.project_id;
  if (!projectId) return { ok: false, error: "Project not found" };

  const authz = await requireProjectReader(projectId);
  if (!authz.ok) return { ok: false, error: "Not authorized to view this document" };

  // Audit FIRST, mint URL second. If the audit insert fails the user must
  // not receive a working URL — we cannot guarantee accountability otherwise.
  // (H-11 fail-closed.)
  const trimmedPurpose = (purpose ?? "").trim().slice(0, 500);
  try {
    const hdrs = await headers();
    const userAgent = hdrs.get("user-agent");
    const ip = extractClientIp(hdrs);
    const { error: logErr } = await sb.from("proof_access_log").insert({
      proof_id: proof.id,
      project_id: projectId,
      user_id: auth.userId,
      purpose: trimmedPurpose || null,
      user_agent: userAgent,
      ip_address: ip,
    });
    if (logErr) {
      console.error("proof_access_log insert failed", logErr);
      return { ok: false, error: "Could not record document access. Try again." };
    }
  } catch (err) {
    console.error("proof_access_log insert threw", err);
    return { ok: false, error: "Could not record document access. Try again." };
  }

  // Mint the URL. Files get a 5-minute signed URL so a leaked link expires
  // quickly. Links are passed through unchanged.
  let url: string | null = null;
  const kind: "file" | "link" = proof.kind === "link" ? "link" : "file";
  if (kind === "link") {
    url = proof.url ?? null;
  } else if (proof.file_path) {
    const { data: signed } = await sb.storage
      .from("proofs")
      .createSignedUrl(proof.file_path, 5 * 60);
    url = signed?.signedUrl ?? null;
  }
  if (!url) return { ok: false, error: "Could not resolve document URL" };

  return {
    ok: true,
    data: { url, kind, fileName: proof.file_name ?? "Document" },
  };
}
