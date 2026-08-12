import { parseMentions } from '@/lib/internal/mentions';
import { cn } from '@/lib/utils';

/**
 * Renders a comment body, turning `@[Name](user-id)` markup into chips.
 *
 * Output is React text nodes throughout — no `dangerouslySetInnerHTML` — so a
 * body containing angle brackets or markup-shaped text renders as the author
 * typed it and cannot inject anything.
 *
 * A mention of the reader is marked so it stands out when scanning a thread
 * for the place you were pulled into.
 */
export function CommentBody({
  body,
  currentUserId,
}: {
  body: string;
  currentUserId: string;
}) {
  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
      {parseMentions(body).map((segment, i) =>
        segment.type === 'text' ? (
          segment.value
        ) : (
          <span
            key={`${segment.id}-${i}`}
            data-self={String(segment.id === currentUserId)}
            className={cn(
              'rounded px-1 py-0.5 text-sm font-medium',
              segment.id === currentUserId
                ? 'bg-primary/15 text-primary'
                : 'bg-muted text-foreground/80',
            )}
          >
            @{segment.name}
          </span>
        ),
      )}
    </p>
  );
}
