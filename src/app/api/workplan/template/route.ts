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
 *
 * The sheet is named "Checklist" to match the importer's preferred sheet.
 */

// Module-level cache of the generated buffer. The template is deterministic
// (no per-user data), so we build it once per server instance and reuse it
// on every download. xlsx is loaded lazily on first request so cold starts
// for unrelated routes in the same bundle don't pay the parse cost.
let cachedBuffer: ArrayBuffer | null = null;

async function buildTemplateBuffer(): Promise<ArrayBuffer> {
  if (cachedBuffer) return cachedBuffer;

  const XLSX = await import("xlsx");

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
  sheet["!cols"] = [
    { wch: 18 },
    { wch: 32 },
    { wch: 36 },
    { wch: 28 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 36 },
  ];
  sheet["!freeze"] = { xSplit: 0, ySplit: 1 } as unknown as never;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Checklist");

  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  }) as Buffer;

  // Detach from the Node Buffer's pooled ArrayBuffer so we hand `Response`
  // a plain ArrayBuffer slice it can keep alive without our pool reclaiming
  // the bytes.
  const view = new Uint8Array(buffer);
  const detached = view.slice().buffer;
  cachedBuffer = detached;
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
