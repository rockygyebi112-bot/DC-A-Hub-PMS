import { NextResponse } from 'next/server';

import { requireRole } from '@/lib/auth/require-role-server';
import { createServiceClient } from '@/lib/supabase/server';
import { isSameOrigin } from '@/lib/http/same-origin';
import { MAX_XLSX_BYTES, MAX_SHEET_ROWS } from '@/lib/uploads';
import { parseCsv } from '@/lib/csv';
import { replaceMisInvestments } from '@/lib/supabase/rpcs';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// MIS uploads arrive as CSV or XLSX. Pin the content types we accept so a
// hostile body can't be streamed in under an arbitrary type. octet-stream /
// text-plain are tolerated because some browsers mislabel CSV.
const ALLOWED_MIS_TYPES = new Set([
  'text/csv',
  'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
]);

type MisRow = {
  community: string;
  district: string;
  investment_type: string;
  investment_name: string;
  completion_date: string | null;
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1. CSRF: route handlers get no automatic Origin enforcement, so refuse
  // anything that didn't come from our own origin before touching the body.
  if (!isSameOrigin(req)) {
    return new NextResponse('Cross-origin request rejected', { status: 403 });
  }

  // 2. Auth BEFORE buffering bytes — an oversized body must not OOM the
  // runtime ahead of the identity check.
  const auth = await requireRole(['admin']);
  if (!auth.ok) return new NextResponse('Unauthorized', { status: 401 });
  const { id: evaluationId } = await params;

  // 3. Size cap from Content-Length (client-supplied, so re-checked on the
  // File below). Reject early so a multi-GB upload can't exhaust memory in
  // formData()/arrayBuffer().
  const contentLength = Number(req.headers.get('content-length') ?? '0');
  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_XLSX_BYTES + 64 * 1024
  ) {
    return new NextResponse('File too large', { status: 413 });
  }

  // 4. Content-Type sanity: must be a multipart upload.
  const contentType = (req.headers.get('content-type') ?? '').toLowerCase();
  if (!contentType.startsWith('multipart/form-data')) {
    return new NextResponse('Expected multipart/form-data upload', {
      status: 415,
    });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return new NextResponse('Could not read upload', { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof File)) {
    return new NextResponse('No file', { status: 400 });
  }
  // 5. Authoritative size + type checks on the actual File.
  if (file.size > MAX_XLSX_BYTES) {
    return new NextResponse('File too large', { status: 413 });
  }
  if (file.type && !ALLOWED_MIS_TYPES.has(file.type.toLowerCase())) {
    return new NextResponse('Only CSV or XLSX files are supported', {
      status: 415,
    });
  }

  const sb = createServiceClient();

  // 6. Re-validate the path-supplied evaluation id against a real row before
  // the destructive replace. This route uses the RLS-bypassing service client,
  // so a bogus/foreign id would otherwise blind-delete with no backstop.
  const { data: evaluation, error: evalErr } = await sb
    .from('evaluations')
    .select('id')
    .eq('id', evaluationId)
    .maybeSingle();
  if (evalErr) {
    console.error('[mis/upload] evaluation lookup failed', evalErr);
    return new NextResponse('Failed to load evaluation', { status: 500 });
  }
  if (!evaluation) {
    return new NextResponse('Evaluation not found', { status: 404 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  let rows: MisRow[];
  try {
    rows = await parseRows(file.name, buf);
  } catch (err) {
    if (err instanceof TooManyRowsError) {
      return new NextResponse(
        `Spreadsheet has too many rows (max ${MAX_SHEET_ROWS})`,
        { status: 413 },
      );
    }
    console.error('[mis/upload] parse failed', err);
    return new NextResponse('Could not parse the upload', { status: 400 });
  }
  if (rows.length === 0) {
    return new NextResponse('No rows parsed', { status: 400 });
  }

  // Atomic replace: delete-existing + bulk-insert run in a single transaction
  // inside the RPC (migration 0042). A failure rolls back the delete, so a
  // bad insert can't wipe the prior dataset.
  const { error } = await replaceMisInvestments(sb, {
    evaluation_id: evaluationId,
    rows,
  });
  if (error) {
    console.error('[mis/upload] replace failed', error);
    return new NextResponse('Failed to save MIS data', { status: 500 });
  }

  return NextResponse.json({ inserted: rows.length });
}

class TooManyRowsError extends Error {}

async function parseRows(name: string, buf: Buffer): Promise<MisRow[]> {
  const lower = name.toLowerCase();
  if (lower.endsWith('.csv')) {
    // RFC-4180 aware parse: a comma inside a quoted value (e.g. "Tamale,
    // Northern") must NOT shift the remaining columns into the wrong fields.
    const records = parseCsv(buf.toString('utf8'));
    if (records.length < 2) return [];
    if (records.length - 1 > MAX_SHEET_ROWS) throw new TooManyRowsError();
    const header = records[0].map((h) => h.trim().toLowerCase());
    const col = {
      community: header.indexOf('community'),
      district: header.indexOf('district'),
      investment_type: header.indexOf('investment_type'),
      investment_name: header.indexOf('investment_name'),
      completion_date: header.indexOf('completion_date'),
    };
    const rows: MisRow[] = [];
    for (let i = 1; i < records.length; i++) {
      const cells = records[i];
      const get = (idx: number) => (idx >= 0 ? (cells[idx] ?? '').trim() : '');
      const community = get(col.community);
      const investment_name = get(col.investment_name);
      if (!community || !investment_name) continue;
      rows.push({
        community,
        district: get(col.district),
        investment_type: get(col.investment_type),
        investment_name,
        completion_date: get(col.completion_date) || null,
      });
    }
    return rows;
  }

  // XLSX path via exceljs.
  const ExcelJS = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  if (ws.rowCount > MAX_SHEET_ROWS + 1) throw new TooManyRowsError();
  const headerRow = ws.getRow(1);
  const headerMap: Record<string, number> = {};
  headerRow.eachCell((cell, col) => {
    headerMap[String(cell.value).trim().toLowerCase()] = col;
  });
  const rows: MisRow[] = [];
  for (let i = 2; i <= ws.rowCount; i++) {
    const row = ws.getRow(i);
    const get = (k: string) => {
      const col = headerMap[k];
      return col ? String(row.getCell(col).value ?? '').trim() : '';
    };
    if (!get('community') || !get('investment_name')) continue;
    rows.push({
      community: get('community'),
      district: get('district'),
      investment_type: get('investment_type'),
      investment_name: get('investment_name'),
      completion_date: get('completion_date') || null,
    });
  }
  return rows;
}
