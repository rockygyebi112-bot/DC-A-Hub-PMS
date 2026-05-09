/**
 * Centralised upload validation.
 *
 * - Enforces maximum upload sizes so the server cannot be trivially DoS'd
 *   by an authenticated user.
 * - Pins the accepted MIME types for each surface. Anything outside the
 *   allowlist (HTML, SVG, executables, etc.) is rejected so signed URLs
 *   cannot be used to serve hostile content from the Supabase origin.
 */

export const MAX_PROOF_BYTES = 25 * 1024 * 1024; // 25 MB
export const MAX_RECEIPT_BYTES = 25 * 1024 * 1024; // 25 MB
export const MAX_XLSX_BYTES = 10 * 1024 * 1024; // 10 MB

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
  // Disallow filenames that could confuse downstream systems.
  if (/[\u0000-\u001F]/.test(input.fileName)) {
    return { ok: false, error: `Invalid ${cfg.label} filename` };
  }
  return { ok: true };
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
