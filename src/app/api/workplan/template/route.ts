import * as XLSX from "xlsx";
import { requireAuth } from "@/lib/auth/guards";

/**
 * Workplan template download.
 *
 * Returns an XLSX file with the exact column headers that
 * `importWorkplanSheet` in `@/lib/workspace/actions` recognises, plus a few
 * example rows that demonstrate the supported patterns:
 *
 *  - `Category` may be left blank on subsequent rows; the importer carries
 *    the most recent value forward, so each phase only needs to be named
 *    once on its first row.
 *  - `Activity` is required and uniquely identifies a task within its phase.
 *  - `Deliverable` and `Notes/Dependencies` get concatenated into the
 *    activity description on import.
 *  - `Responsible Team Member/Team` populates the assignee field.
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

  const headerRow = [
    "Category",
    "Activity",
    "Deliverable",
    "Notes/Dependencies",
    "Responsible Team Member/Team",
    "Status",
  ];

  const exampleRows: (string | number)[][] = [
    [
      "Inception",
      "Kick-off meeting",
      "Signed minutes shared with client",
      "Confirm attendee list 2 days prior",
      "Project Manager",
      "done",
    ],
    [
      "",
      "Stakeholder mapping",
      "Stakeholder register v1",
      "Interview top 5 stakeholders",
      "Analyst",
      "in_progress",
    ],
    [
      "Discovery",
      "Field assessment",
      "Field report",
      "Coordinate logistics with field lead",
      "Field Team",
      "not_started",
    ],
    [
      "",
      "Requirements workshop",
      "Workshop summary",
      "Send pre-read 3 days prior",
      "Lead Consultant",
      "not_started",
    ],
  ];

  const aoa: (string | number)[][] = [headerRow, ...exampleRows];

  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  // Reasonable column widths so the file opens with all headers visible.
  sheet["!cols"] = [
    { wch: 18 }, // Category
    { wch: 32 }, // Activity
    { wch: 36 }, // Deliverable
    { wch: 36 }, // Notes/Dependencies
    { wch: 28 }, // Responsible
    { wch: 14 }, // Status
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
