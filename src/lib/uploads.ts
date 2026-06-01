/**
 * Centralised upload validation.
 *
 * - Enforces maximum upload sizes so the server cannot be trivially DoS'd
 *   by an authenticated user.
 * - Pins the accepted MIME types for each surface. Anything outside the
 *   allowlist (HTML, SVG, executables, etc.) is rejected so signed URLs
 *   cannot be used to serve hostile content from the Supabase origin.
 * - Rejects filenames that could confuse downstream systems (control
 *   characters, bidi overrides, Windows reserved device names, etc.).
 */

export const MAX_PROOF_BYTES = 25 * 1024 * 1024; // 25 MB
export const MAX_RECEIPT_BYTES = 25 * 1024 * 1024; // 25 MB
export const MAX_XLSX_BYTES = 10 * 1024 * 1024; // 10 MB

// Hard ceiling on rows we will read out of an uploaded spreadsheet. The byte
// cap bounds the compressed input, but exceljs materialises the whole workbook
// in memory and a small file can expand to a sheet with millions of (sparse)
// rows — enough to OOM a constrained serverless runtime. Reject before we walk
// the sheet rather than risk the crash.
export const MAX_SHEET_ROWS = 10_000;

const IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const DOC_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
]);

const PROOF_MIMES = new Set<string>([...IMAGE_MIMES, ...DOC_MIMES]);
const RECEIPT_MIMES = new Set<string>([...IMAGE_MIMES, ...DOC_MIMES]);

export type UploadKind = "proof" | "receipt";

const CONFIG: Record<
  UploadKind,
  { maxBytes: number; allowed: Set<string>; label: string }
> = {
  proof: { maxBytes: MAX_PROOF_BYTES, allowed: PROOF_MIMES, label: "proof" },
  receipt: {
    maxBytes: MAX_RECEIPT_BYTES,
    allowed: RECEIPT_MIMES,
    label: "receipt",
  },
};

export type UploadValidationError = { ok: false; error: string };
export type UploadValidationSuccess = { ok: true };

/** Validate a single upload. */
export function validateUpload(
  kind: UploadKind,
  input: { size: number; mimeType: string; fileName: string },
): UploadValidationSuccess | UploadValidationError {
  const cfg = CONFIG[kind];
  if (!input || input.size <= 0) {
    return { ok: false, error: `Empty ${cfg.label} file` };
  }
  if (input.size > cfg.maxBytes) {
    return {
      ok: false,
      error: `${cfg.label[0].toUpperCase() + cfg.label.slice(1)} must be ${cfg.maxBytes / (1024 * 1024)} MB or smaller`,
    };
  }
  const mime = (input.mimeType || "").toLowerCase();
  if (!cfg.allowed.has(mime)) {
    return {
      ok: false,
      error: `Unsupported ${cfg.label} type: ${mime || "unknown"}`,
    };
  }
  // Disallow filenames that could confuse downstream systems (H-8).
  const fileNameError = checkUnsafeFileName(input.fileName);
  if (fileNameError) {
    return { ok: false, error: `Invalid ${cfg.label} filename: ${fileNameError}` };
  }
  return { ok: true };
}

const WIN_RESERVED_STEMS = new Set([
  "con", "prn", "nul", "aux",
  "com1", "com2", "com3", "com4", "com5", "com6", "com7", "com8", "com9",
  "lpt1", "lpt2", "lpt3", "lpt4", "lpt5", "lpt6", "lpt7", "lpt8", "lpt9",
]);

/**
 * Return a short reason string if the filename is unsafe, or null if OK.
 *
 * Catches: control chars; bidi-override and isolate codepoints (which can
 * disguise the visible filename in OS shells / mail UIs); trailing dots
 * (Windows strips them, leaving a different file); leading dashes (CLI
 * argument injection); Windows reserved device names; empty stem.
 */
export function checkUnsafeFileName(name: string): string | null {
  if (!name) return "empty";

  for (let i = 0; i < name.length; i++) {
    const code = name.charCodeAt(i);
    if (code <= 0x1f) return "control character";
    // Bidi overrides: LRM/RLM (200E-200F), LRE/RLE/PDF/LRO/RLO (202A-202E),
    // LRI/RLI/FSI/PDI (2066-2069). Any of these can flip the displayed
    // filename so users open something they didn't expect.
    if (
      (code >= 0x200e && code <= 0x200f) ||
      (code >= 0x202a && code <= 0x202e) ||
      (code >= 0x2066 && code <= 0x2069)
    ) {
      return "bidirectional override";
    }
  }

  if (name.startsWith("-")) return "leading dash";
  if (name.endsWith(".") || name.endsWith(" ")) return "trailing dot or space";

  const stem = name.split(".")[0]?.toLowerCase() ?? "";
  if (WIN_RESERVED_STEMS.has(stem)) return "reserved name";

  return null;
}

/** Strip path separators and other risky characters from a user-supplied name. */
export function sanitizeFileName(name: string): string {
  return (
    name
      .replace(/[/\\]+/g, "_")
      .replace(/[^A-Za-z0-9._-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 180) || "file"
  );
}

/**
 * Content-based defence (L-1) layered on top of the MIME allowlist.
 *
 * `validateUpload` trusts the client-declared `mimeType`. Proof/receipt
 * uploads stream the file straight into Supabase storage with that declared
 * type, and storage serves it from a *.supabase.co origin where the app's
 * `nosniff` / CSP headers do NOT apply. So a file whose bytes are actually
 * HTML / SVG / XML / a script / an executable is a content-confusion and
 * stored-XSS risk even when the caller labels it `image/png` or `text/csv`.
 *
 * This inspects the real leading bytes and rejects those dangerous shapes.
 * It is a DENYLIST, not a positive signature check, precisely so it never
 * rejects a legitimate allowlisted upload: real PDFs (`%PDF`), images, ZIP-
 * based Office docs (`PK\x03\x04`), legacy OLE2 docs, and plain CSV/text do
 * not begin with any of these markers.
 *
 * Returns a short reason string if the content is dangerous, else null.
 */
export function sniffDangerousContent(head: Uint8Array): string | null {
  if (head.length === 0) return null;

  // Binary executable magic numbers (checked on raw bytes).
  // MZ (PE/DOS), \x7FELF (ELF), \xFE\xED\xFA\xCE/CF + \xCA\xFE\xBA\xBE (Mach-O / Java class).
  if (head[0] === 0x4d && head[1] === 0x5a) return "executable";
  if (head[0] === 0x7f && head[1] === 0x45 && head[2] === 0x4c && head[3] === 0x46) {
    return "executable";
  }
  if (
    head[0] === 0xfe && head[1] === 0xed && head[2] === 0xfa &&
    (head[3] === 0xce || head[3] === 0xcf)
  ) {
    return "executable";
  }
  if (head[0] === 0xca && head[1] === 0xfe && head[2] === 0xba && head[3] === 0xbe) {
    return "executable";
  }

  // Textual markup / scripts: decode the head as ASCII, skip a leading UTF-8
  // BOM and whitespace, lowercase, then match dangerous document prefixes.
  let text = "";
  for (let i = 0; i < head.length && i < 64; i++) {
    text += String.fromCharCode(head[i]);
  }
  const trimmed = text.replace(/^\xEF\xBB\xBF/, "").replace(/^[\s﻿]+/, "").toLowerCase();

  const dangerousPrefixes = [
    "<!doctype html",
    "<html",
    "<head",
    "<body",
    "<script",
    "<svg",
    "<?xml",   // SVG / XHTML / generic XML that a browser may render
    "<!--",
    "#!",      // shebang scripts
    "<%",      // server-page / template markers
  ];
  for (const p of dangerousPrefixes) {
    if (trimmed.startsWith(p)) return "html/script/executable content";
  }
  return null;
}

/**
 * Read the leading bytes of an upload and run {@link sniffDangerousContent}.
 * Convenience wrapper so server actions don't each re-implement the slice.
 */
export async function checkUploadContent(file: File): Promise<string | null> {
  const head = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  return sniffDangerousContent(head);
}
