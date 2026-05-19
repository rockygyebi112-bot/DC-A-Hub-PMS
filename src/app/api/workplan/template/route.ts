import { requireAuth } from "@/lib/auth/guards";

/**
 * Workplan template download.
 *
 * Returns an XLSX file with the exact column headers that
 * `importWorkplanSheet` in `@/lib/workspace/actions` recognises.
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
 *  - `Visibility` is required and must be `client_visible` or `internal`.
 *
 * The sheet is named "Checklist" to match the importer's preferred sheet.
 *
 * Generator: exceljs. Previously this used the SheetJS CDN build; ExcelJS
 * is the actively-maintained, npm-resolved equivalent with a smaller API
 * surface that better fits our 5%-of-features use case.
 */

const TEMPLATE_COLUMNS: { header: string; width: number }[] = [
  { header: "Phase", width: 18 },
  { header: "Activity", width: 32 },
  { header: "Deliverable", width: 36 },
  { header: "Responsible Team Member/Team", width: 28 },
  { header: "Start Date", width: 14 },
  { header: "End Date", width: 14 },
  { header: "Status", width: 14 },
  { header: "Visibility", width: 16 },
  { header: "Notes/Dependencies", width: 36 },
];

// Module-level cache of the generated buffer. The template is deterministic
// (no per-user data), so we build it once per server instance and reuse it
// on every download. exceljs is loaded lazily on first request so cold
// starts for unrelated routes in the same bundle don't pay the parse cost.
let cachedBuffer: ArrayBuffer | null = null;

async function buildTemplateBuffer(): Promise<ArrayBuffer> {
  if (cachedBuffer) return cachedBuffer;

  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Checklist");

  sheet.columns = TEMPLATE_COLUMNS.map((c) => ({
    header: c.header,
    key: c.header,
    width: c.width,
  }));

  // Bold the header row and freeze it. We deliberately do NOT ship example
  // rows so users don't have to delete fake data before uploading.
  const header = sheet.getRow(1);
  header.font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  // Self-documenting dropdowns on the two enum-style columns so users can
  // see accepted values without consulting docs or failing an import.
  // Applied to a generous row range; ExcelJS writes one validation rule
  // regardless of range size. Column letters track TEMPLATE_COLUMNS order.
  const statusCol = sheet.getColumn("Status").letter;
  const visibilityCol = sheet.getColumn("Visibility").letter;
  // exceljs runtime exposes `worksheet.dataValidations.add(range, rule)` but
  // the bundled .d.ts omits it; cast narrowly to the shape we use.
  const validations = (sheet as unknown as {
    dataValidations: {
      add: (
        range: string,
        rule: {
          type: string;
          allowBlank?: boolean;
          formulae: string[];
          showErrorMessage?: boolean;
          errorTitle?: string;
          error?: string;
        },
      ) => void;
    };
  }).dataValidations;
  validations.add(`${statusCol}2:${statusCol}1000`, {
    type: "list",
    allowBlank: true,
    formulae: ['"not_started,in_progress,done"'],
    showErrorMessage: true,
    errorTitle: "Invalid status",
    error: "Use one of: not_started, in_progress, done",
  });
  validations.add(`${visibilityCol}2:${visibilityCol}1000`, {
    type: "list",
    allowBlank: false,
    formulae: ['"client_visible,internal"'],
    showErrorMessage: true,
    errorTitle: "Visibility required",
    error: "Use one of: client_visible, internal",
  });

  const arrayBuffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
  // Detach into a fresh ArrayBuffer slice so the cached reference doesn't
  // alias any pool/library-internal buffer that might be reused.
  const view = new Uint8Array(arrayBuffer);
  cachedBuffer = view.slice().buffer;
  return cachedBuffer;
}

export async function GET() {
  // Gate behind auth so we don't leak the template to anonymous users; this
  // matches the rest of the workspace surface where only signed-in members
  // can see or import workplans.
  const auth = await requireAuth();
  if (!auth.ok) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await buildTemplateBuffer();

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="workplan-template.xlsx"',
      // Private so a shared CDN can't bypass the auth gate above. max-age=300
      // lets the browser reuse a recent download without a round-trip, which
      // is the realistic re-download pattern (admin downloads template, hits
      // refresh, downloads again).
      "Cache-Control": "private, max-age=300",
    },
  });
}
