/**
 * Parsing for @-mentions in internal comment bodies.
 *
 * A mention is stored inline, anchored to the user id:
 *
 *     @[Kwame Gyebi](3f2a1b4c-5d6e-4f70-8a91-b2c3d4e5f607)
 *
 * The id is the truth and the name is only a display fallback, so a mention
 * survives a rename and stays unambiguous when two colleagues share a first
 * name. The alternative — plain text plus a `mentioned_user_ids` column —
 * would force every render to recover mentions by matching names, which breaks
 * on both counts.
 *
 * Deliberately a standalone module with no Supabase or `server-only` imports,
 * so it unit-tests directly — the same reasoning that keeps
 * `resolveAssignmentRecipients` in its own file.
 */

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/** Fresh each call: a `g` regex carries `lastIndex` between uses. */
const mentionPattern = () =>
  new RegExp(`@\\[([^\\]\\n]+)\\]\\((${UUID})\\)`, 'gi');

export type MentionSegment =
  | { type: 'text'; value: string }
  | { type: 'mention'; id: string; name: string };

/** User ids mentioned in a body, de-duplicated, in first-appearance order. */
export function extractMentionIds(body: string): string[] {
  const ids: string[] = [];
  for (const match of body.matchAll(mentionPattern())) {
    const id = match[2].toLowerCase();
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

/**
 * Split a body into plain-text and mention segments. Markup that doesn't
 * carry a well-formed id is left as literal text rather than dropped, so a
 * comment that merely looks like markup still reads as the author wrote it.
 */
export function parseMentions(body: string): MentionSegment[] {
  const segments: MentionSegment[] = [];
  let cursor = 0;
  for (const match of body.matchAll(mentionPattern())) {
    const start = match.index;
    if (start > cursor) {
      segments.push({ type: 'text', value: body.slice(cursor, start) });
    }
    segments.push({
      type: 'mention',
      id: match[2].toLowerCase(),
      name: match[1],
    });
    cursor = start + match[0].length;
  }
  if (cursor < body.length) {
    segments.push({ type: 'text', value: body.slice(cursor) });
  }
  return segments;
}

/**
 * The in-progress `@query` the caret sits in, or null when the picker should
 * be closed. Encodes three rules the composer depends on:
 *
 *   - The `@` must start the input or follow whitespace, so an email address
 *     (kgyebi112@gmail.com) never opens the picker.
 *   - The query may hold one internal space, so a full name can be filtered.
 *     A second space means the author moved on to writing prose.
 *   - Markup characters mean a mention was already inserted here.
 */
export function findMentionQuery(
  text: string,
  caret: number,
): { query: string; start: number } | null {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf('@');
  if (at === -1) return null;

  const preceding = at > 0 ? text[at - 1] : null;
  if (preceding !== null && !/\s/.test(preceding)) return null;

  const query = before.slice(at + 1);
  if (/[\n\r[\]()]/.test(query)) return null;
  if ((query.match(/ /g)?.length ?? 0) > 1) return null;

  return { query, start: at };
}
