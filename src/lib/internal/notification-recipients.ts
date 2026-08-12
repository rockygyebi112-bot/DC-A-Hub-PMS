/**
 * Who actually gets notified when a task is assigned.
 *
 * Deliberately a standalone module with no Supabase or `server-only` imports:
 * the writer in `./notifications.ts` pulls in the service-role client (and
 * transitively `next/headers`), which is awkward to unit-test. The rule that
 * matters — never notify someone about their own action — lives here where it
 * can be tested directly.
 *
 * `createTask` always auto-assigns the creator for visibility, so the actor
 * appearing in the assignee list is the normal case, not an edge case.
 */
export function resolveAssignmentRecipients(
  assigneeIds: string[],
  actorUserId: string,
): string[] {
  return Array.from(new Set(assigneeIds.filter(Boolean))).filter(
    (id) => id !== actorUserId,
  );
}
