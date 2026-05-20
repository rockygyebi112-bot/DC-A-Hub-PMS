import { NextResponse } from 'next/server';

import { requireRole } from '@/lib/auth/require-role-server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

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
  const auth = await requireRole(['admin']);
  if (!auth.ok) return new NextResponse('Unauthorized', { status: 401 });
  const { id: evaluationId } = await params;

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return new NextResponse('No file', { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const rows = await parseRows(file.name, buf);
  if (rows.length === 0) {
    return new NextResponse('No rows parsed', { status: 400 });
  }

  const sb = createServiceClient();
  // Replace strategy: delete existing for this evaluation, then bulk insert.
  const { error: delErr } = await sb
    .from('mis_investments')
    .delete()
    .eq('evaluation_id', evaluationId);
  if (delErr) return new NextResponse(delErr.message, { status: 500 });

  const { error } = await sb
    .from('mis_investments')
    .insert(rows.map((r) => ({ ...r, evaluation_id: evaluationId })));
  if (error) return new NextResponse(error.message, { status: 500 });

  return NextResponse.json({ inserted: rows.length });
}

async function parseRows(name: string, buf: Buffer): Promise<MisRow[]> {
  const lower = name.toLowerCase();
  if (lower.endsWith('.csv')) {
    const text = buf.toString('utf8');
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return [];
    const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
    return lines
      .slice(1)
      .map((ln) => {
        const cells = ln.split(',').map((c) => c.trim());
        const get = (k: string) => cells[header.indexOf(k)] ?? '';
        return {
          community: get('community'),
          district: get('district'),
          investment_type: get('investment_type'),
          investment_name: get('investment_name'),
          completion_date: get('completion_date') || null,
        };
      })
      .filter((r) => r.community && r.investment_name);
  }

  // XLSX path via exceljs.
  const ExcelJS = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
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
