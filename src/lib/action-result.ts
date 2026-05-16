/**
 * Discriminated-union return shape used by every server action in the app.
 * Previously redefined verbatim in six files (admin/*, workspace, portal,
 * account). Centralizing it keeps the contract — `ok` flag + optional `data`
 * or `error` — identical across domains, and lets shared helpers be typed
 * against one canonical alias.
 *
 * `data` is optional so the same alias works for actions that return a
 * payload (`ActionResult<{ id: string }>`) and actions that signal success
 * without one (`ActionResult` / `ActionResult<void>`). Consumers that need a
 * required payload should narrow with `if (!res.ok) return; ...res.data`
 * and either coalesce (`res.data ?? fallback`) or assert when the producer
 * guarantees a value.
 */
export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };
