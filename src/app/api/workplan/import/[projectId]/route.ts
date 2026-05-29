import { NextResponse } from "next/server";
import { importWorkplanSheet } from "@/lib/workspace/actions";
import { requireProjectWriter } from "@/lib/auth/guards";
import { MAX_XLSX_BYTES } from "@/lib/uploads";
import { isSameOrigin } from "@/lib/http/same-origin";

// Thin wrapper around the `importWorkplanSheet` server action so the client
// can upload with XMLHttpRequest and surface real upload progress. The server
// action still owns parsing and revalidation logic — but the gates that
// matter (auth, CSRF, size, content-type) MUST execute here before we ever
// buffer the request body.

const ALLOWED_XLSX_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // some browsers still send this for .xls/.xlsx
  "application/octet-stream", // a few clients fail to set a real type
]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  // 1. CSRF: refuse anything that didn't come from our own origin.
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { ok: false, error: "Cross-origin request rejected" },
      { status: 403 },
    );
  }

  const { projectId } = await params;

  // 2. Auth: verify the caller can actually write to this project BEFORE
  // we buffer multipart bytes. Without this an anonymous caller could DoS
  // the route by streaming gigabytes into request.formData().
  const auth = await requireProjectWriter(projectId);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: 403 });
  }

  // 3. Size cap from the Content-Length header. The previous size check
  // inside `importWorkplanSheet` only ran AFTER the body was fully buffered,
  // so a huge multipart payload would OOM the Node runtime before reaching
  // the check. We reject early here. (We still re-validate file.size below
  // because Content-Length is client-supplied and not authoritative.)
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 0) {
    // Allow some multipart envelope overhead on top of the file bytes.
    if (contentLength > MAX_XLSX_BYTES + 64 * 1024) {
      return NextResponse.json(
        {
          ok: false,
          error: `Workplan file must be ${MAX_XLSX_BYTES / (1024 * 1024)} MB or smaller`,
        },
        { status: 413 },
      );
    }
  }

  // 4. Content-Type sanity: must be a multipart/form-data POST.
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return NextResponse.json(
      { ok: false, error: "Expected multipart/form-data upload" },
      { status: 415 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Could not read upload" },
      { status: 400 },
    );
  }

  const file = formData.get("workplan");
  if (file instanceof File) {
    if (file.size > MAX_XLSX_BYTES) {
      return NextResponse.json(
        {
          ok: false,
          error: `Workplan file must be ${MAX_XLSX_BYTES / (1024 * 1024)} MB or smaller`,
        },
        { status: 413 },
      );
    }
    if (file.type && !ALLOWED_XLSX_TYPES.has(file.type.toLowerCase())) {
      return NextResponse.json(
        { ok: false, error: "Only .xlsx workbooks are supported" },
        { status: 415 },
      );
    }
  }

  const result = await importWorkplanSheet(projectId, formData);
  const status = result.ok ? 200 : 400;
  return NextResponse.json(result, { status });
}
