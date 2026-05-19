export type ParsedVisibility = 'client_visible' | 'internal';

export type ParseResult =
  | { ok: true; value: ParsedVisibility }
  | { ok: false; error: string };

export function parseWorkplanRowVisibility(raw: string | undefined): ParseResult {
  const text = (raw ?? '').trim().toLowerCase();
  if (!text) {
    return { ok: false, error: 'visibility is required: client_visible or internal' };
  }
  if (text === 'client_visible' || text === 'client visible') {
    return { ok: true, value: 'client_visible' };
  }
  if (text === 'internal' || text === 'internal only' || text === 'internal_only') {
    return { ok: true, value: 'internal' };
  }
  return {
    ok: false,
    error: `visibility "${raw}" is not valid: use client_visible or internal`,
  };
}
