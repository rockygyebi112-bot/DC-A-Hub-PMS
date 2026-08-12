/**
 * Who actually gets notified when a task is assigned.
 *
 * Deliberately a standalone module with no Supabase or `server-only` imports:
 * the writer in `./notifications.ts` pulls in the service-role client (and
 * transitively `next/headers`), which is awkward to unit-test. The rule that
 * matters — never notify someone about their own action — lives here where it
 * can be tested directly.
 *
 * The actor can appear in `assigneeIds` when someone picks themselves in the
 * assignee picker — neither the picker nor the form excludes self. The
 * creator's auto-assignment in `createTask` is a separate insert and never
 * reaches here.
 */
export function resolveAssignmentRecipients(
  assigneeIds: string[],
  actorUserId: string,
): string[] {
  return Array.from(new Set(assigneeIds.filter(Boolean))).filter(
    (id) => id !== actorUserId,
  );
}

/**
 * Who gets notified for an @mention in a comment.
 *
 * Same rule, same reason: mentioning yourself while writing (to note who you
 * are speaking for, or after picking your own name from the list) must not
 * put a notification in your own bell. Repeats collapse because a body may
 * name the same person several times in one comment.
 */
export function resolveMentionRecipients(
  mentionedIds: string[],
  actorUserId: string,
): string[] {
  return resolveAssignmentRecipients(mentionedIds, actorUserId);
}
