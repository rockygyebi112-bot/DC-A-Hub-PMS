/**
 * Re-throw a Supabase / PostgREST error as a real `Error` instance.
 *
 * Supabase returns errors as plain objects of shape
 * `{ code, message, details, hint }`. When code does `throw error` with such
 * a plain object, Next.js's RSC boundary cannot serialize it and the dev
 * overlay surfaces a placeholder like `{code: ..., details: ..., hint: Null,
 * message: ...}`, hiding the real cause.
 *
 * Wrapping the payload in an `Error` preserves the original code/details/hint
 * on the `cause` while giving Next a serializable message + stack.
 */
export type SupabaseLikeError = {
  message?: string | null;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
};

export function throwIfError(
  error: SupabaseLikeError | null | undefined,
  context?: string,
): asserts error is null | undefined {
  if (!error) return;
  const parts: string[] = [];
  if (context) parts.push(`[${context}]`);
  if (error.code) parts.push(error.code);
  parts.push(error.message ?? "Unknown Supabase error");
  if (error.details) parts.push(`— ${error.details}`);
  if (error.hint) parts.push(`(hint: ${error.hint})`);
  const wrapped = new Error(parts.join(" "));
  (wrapped as Error & { cause?: unknown }).cause = error;
  throw wrapped;
}
