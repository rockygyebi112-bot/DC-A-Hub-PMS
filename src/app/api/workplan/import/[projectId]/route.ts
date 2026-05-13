import { NextResponse } from "next/server";
import { importWorkplanSheet } from "@/lib/workspace/actions";

// Thin wrapper around the `importWorkplanSheet` server action so the client
// can upload with XMLHttpRequest and surface real upload progress. The server
// action still owns all auth, parsing, and revalidation logic — this route
// only exists to expose it over fetch/XHR for progress reporting.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const formData = await request.formData();
  const result = await importWorkplanSheet(projectId, formData);
  const status = result.ok ? 200 : 400;
  return NextResponse.json(result, { status });
}
