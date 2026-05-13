import * as XLSX from "xlsx";
import { requireAuth } from "@/lib/auth/guards";

/**
 * Workplan template download.
 *
 * Returns an XLSX file with the exact column headers that
 * `importWorkplanSheet` in `@/lib/workspace/actions` recognises, plus a few
 * example rows that demonstrate the supported patterns:
 *
 *  - `Phase` may be left blank on subsequent rows; the importer carries
 *    the most recent value forward, so each phase only needs to be named
 *    once on its first row. Legacy "Category" is also accepted.
 *  - `Activity` is required and uniquely identifies a task within its phase.
 *  - `Deliverable` populates its own column on the activity (no longer
 *    folded into the description blob).
 *  - `Notes/Dependencies` becomes the activity's plain notes/description.
 *  - `Responsible Team Member/Team` populates the responsible-team field.
 *  - `Status` accepts: not_started, in_progress (or "ongoing"/"started"),
 *    done (or "complete"/"completed"/"closed"). Anything else falls back to
 *    "not_started".
 *
 * The sheet is named "Checklist" to match the importer's preferred sheet.
 */
export async function GET() {
  // Gate behind auth so we don't leak the template to anonymous users; this
  // matches the rest of the workspace surface where only signed-in members
  // can see or import workplans.
  const auth = await requireAuth();
  if (!auth.ok) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Header uses "Phase" to match the in-app terminology. The importer also
  // accepts the legacy "Category" header for back-compat with older sheets.
  // Column order mirrors the in-app activity form so what an admin sees on
  // the activity page lines up 1:1 with what they edit in the spreadsheet.
  const headerRow = [
    "Phase",
    "Activity",
    "Deliverable",
    "Responsible Team Member/Team",
    "Start Date",
    "End Date",
    "Status",
    "Notes/Dependencies",
  ];

  // Header-only blank template. We deliberately do NOT ship example rows so
  // users don't have to delete fake data before uploading, and so nobody
  // mistakes the seed content for activities tied to their project.
  const aoa: string[][] = [headerRow];

  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  // Reasonable column widths so the file opens with all headers visible.
  sheet["!cols"] = [
    { wch: 18 }, // Phase
    { wch: 32 }, // Activity
    { wch: 36 }, // Deliverable
    { wch: 28 }, // Responsible
    { wch: 14 }, // Start Date
    { wch: 14 }, // End Date
    { wch: 14 }, // Status
    { wch: 36 }, // Notes/Dependencies
  ];
  // Freeze the header row for easier editing.
  sheet["!freeze"] = { xSplit: 0, ySplit: 1 } as unknown as never;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Checklist");

  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  }) as Buffer;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="workplan-template.xlsx"',
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
