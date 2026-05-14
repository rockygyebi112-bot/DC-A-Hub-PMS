import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Map a Supabase/Postgres error to a short, user-safe message. We deliberately
 * avoid surfacing raw `error.message` to the UI because it can leak schema
 * details or PII embedded in constraint names. The full error is logged for
 * server-side diagnostics so support can still trace it via the request log.
 *
 * Known Postgres SQLSTATE codes:
 *   23505 - unique_violation
 *   23503 - foreign_key_violation
 *   23502 - not_null_violation
 *   23514 - check_violation
 *   42501 - insufficient_privilege (often surfaced by RLS)
 *   PGRST116 - PostgREST: zero rows where one was expected
 */
export function dbErrorMessage(
  error: PostgrestError | { message?: string; code?: string } | null | undefined,
): string {
  if (!error) return "Operation failed";

  // Server-side log so we keep diagnostic value without leaking to the client.
  // In production we redact `details`/`hint` because they sometimes include
  // raw row data or constraint internals (M-18). Local dev keeps them.
  const isProd = process.env.NODE_ENV === "production";
  console.error("[db]", {
    code: "code" in error ? error.code : undefined,
    message: error.message,
    details: !isProd && "details" in error ? (error as PostgrestError).details : undefined,
    hint: !isProd && "hint" in error ? (error as PostgrestError).hint : undefined,
  });

  const code = "code" in error ? error.code : undefined;
  switch (code) {
    case "23505":
      return "That record already exists.";
    case "23503":
      return "This record is referenced by other data and cannot be changed.";
    case "23502":
      return "A required field is missing.";
    case "23514":
      return "The value provided is not allowed.";
    case "42501":
      return "You do not have permission to perform this action.";
    case "PGRST116":
      return "The requested record was not found.";
    default:
      return "Operation failed";
  }
}
