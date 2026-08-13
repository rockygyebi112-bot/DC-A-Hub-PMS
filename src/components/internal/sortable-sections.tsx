'use client';

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, GripVertical } from 'lucide-react';
import { toast } from 'sonner';

import { reorderSections } from '@/lib/internal/actions';
import { cn } from '@/lib/utils';

export type SortableItem = {
  id: string;
  /** Plain-text section name. The header is arbitrary JSX, so the reorder
   *  handle and its live-region announcements need a readable name of their
   *  own to reference. */
  label: string;
  header: ReactNode;
  body: ReactNode;
};

/**
 * Shared drag-reorder state for sections. Optimistically reorders locally, then
 * persists the full ordering. Native HTML5 drag-and-drop keeps it dependency
 * free; a dedicated grip handle is the only draggable affordance so task links
 * and inline forms stay clickable.
 */
function useReorder(ids: string[]) {
  const router = useRouter();
  const [order, setOrder] = useState<string[]>(ids);
  const [, start] = useTransition();
  const dragId = useRef<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  // Announced to screen readers after a keyboard move, since the visual
  // reordering on its own conveys nothing to a non-sighted user.
  const [announcement, setAnnouncement] = useState('');

  // Re-sync when sections are added/removed/renamed server-side.
  const key = ids.join(',');
  useEffect(() => {
    setOrder(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  function persist(next: string[]) {
    start(async () => {
      const r = await reorderSections(next);
      if (!r.ok) toast.error(r.error ?? 'Could not reorder sections');
      router.refresh();
    });
  }

  function onDrop(targetId: string) {
    const from = dragId.current;
    dragId.current = null;
    setActiveId(null);
    setOverId(null);
    if (!from || from === targetId) return;
    setOrder((prev) => {
      const next = prev.filter((id) => id !== from);
      const idx = next.indexOf(targetId);
      next.splice(idx < 0 ? next.length : idx, 0, from);
      persist(next);
      return next;
    });
  }

  /** Keyboard equivalent of a drag: shift one position in `delta` direction.
   *  WCAG 2.1.1 requires every drag interaction to have a keyboard path. */
  function move(id: string, delta: -1 | 1, label: string) {
    setOrder((prev) => {
      const from = prev.indexOf(id);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= prev.length) {
        setAnnouncement(
          `${label} is already ${delta < 0 ? 'first' : 'last'}.`,
        );
        return prev;
      }
      const next = [...prev];
      [next[from], next[to]] = [next[to], next[from]];
      setAnnouncement(`${label} moved to position ${to + 1} of ${next.length}.`);
      persist(next);
      return next;
    });
  }

  return {
    order,
    activeId,
    overId,
    setOverId,
    announcement,
    move,
    begin: (id: string) => {
      dragId.current = id;
      setActiveId(id);
    },
    end: () => {
      dragId.current = null;
      setActiveId(null);
      setOverId(null);
    },
    onDrop,
  };
}

/** Polite live region carrying reorder feedback. Rendered once per list. */
function ReorderAnnouncer({ message }: { message: string }) {
  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
}

/**
 * Reorder handle. Pointer users drag it; keyboard users focus it and press the
 * arrow keys, which is the only reason this is a real <button> rather than a
 * span with role="button" — it needs to be in the tab order, and it must stay
 * focused after activation (the old implementation called .blur() on mouseup).
 *
 * `opacity-0` hides the grip until the row is hovered, so it also has to
 * reveal itself on focus or a keyboard user would be driving something they
 * cannot see (WCAG 2.4.7).
 */
function Grip({
  onGrab,
  onMove,
  label,
  orientation,
  className,
}: {
  onGrab: () => void;
  onMove: (delta: -1 | 1) => void;
  label: string;
  orientation: 'vertical' | 'horizontal';
  className?: string;
}) {
  const [prevKey, nextKey] =
    orientation === 'vertical'
      ? (['ArrowUp', 'ArrowDown'] as const)
      : (['ArrowLeft', 'ArrowRight'] as const);

  return (
    <button
      type="button"
      aria-label={`Reorder ${label}. Press the ${
        orientation === 'vertical' ? 'up and down' : 'left and right'
      } arrow keys to move it.`}
      onMouseDown={onGrab}
      onKeyDown={(e) => {
        if (e.key === prevKey) {
          e.preventDefault();
          onMove(-1);
        } else if (e.key === nextKey) {
          e.preventDefault();
          onMove(1);
        }
      }}
      className={cn(
        'grid size-5 shrink-0 cursor-grab place-items-center rounded text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground focus-visible:opacity-100 active:cursor-grabbing',
        className,
      )}
    >
      <GripVertical className="size-3.5" />
    </button>
  );
}

/** List view: stacked, collapsible, drag-reorderable sections. */
export function SortableSectionList({
  items,
  canReorder,
}: {
  items: SortableItem[];
  canReorder: boolean;
}) {
  const { order, activeId, overId, setOverId, announcement, move, begin, end, onDrop } =
    useReorder(items.map((i) => i.id));
  const [dragEnabledId, setDragEnabledId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const byId = new Map(items.map((i) => [i.id, i]));

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      <ReorderAnnouncer message={announcement} />
      {order.map((id) => {
        const item = byId.get(id);
        if (!item) return null;
        const open = !collapsed.has(id);
        return (
          <div
            key={id}
            draggable={canReorder && dragEnabledId === id}
            onDragStart={(e) => {
              begin(id);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(e) => {
              if (activeId) {
                e.preventDefault();
                setOverId(id);
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              onDrop(id);
              setDragEnabledId(null);
            }}
            onDragEnd={() => {
              end();
              setDragEnabledId(null);
            }}
            className={cn(
              'group/sec border-b border-border/60',
              overId === id && activeId !== id && 'bg-accent/30',
              activeId === id && 'opacity-50',
            )}
          >
            <div className="flex items-center gap-1 px-3 py-2.5">
              {canReorder && (
                <Grip
                  onGrab={() => setDragEnabledId(id)}
                  onMove={(delta) => move(id, delta, item.label)}
                  label={item.label}
                  orientation="vertical"
                  className="group-hover/sec:opacity-100"
                />
              )}
              <button
                type="button"
                onClick={() => toggle(id)}
                aria-expanded={open}
                aria-label={open ? 'Collapse section' : 'Expand section'}
                className="grid size-5 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronRight className={cn('size-3.5 transition-transform', open && 'rotate-90')} />
              </button>
              {item.header}
            </div>
            {open && <div>{item.body}</div>}
          </div>
        );
      })}
    </>
  );
}

/** Board view: horizontal, drag-reorderable section columns. */
export function SortableSectionColumns({
  items,
  canReorder,
  trailer,
}: {
  items: SortableItem[];
  canReorder: boolean;
  trailer?: ReactNode;
}) {
  const { order, activeId, overId, setOverId, announcement, move, begin, end, onDrop } =
    useReorder(items.map((i) => i.id));
  const [dragEnabledId, setDragEnabledId] = useState<string | null>(null);
  const byId = new Map(items.map((i) => [i.id, i]));

  return (
    <div className="flex h-[calc(100vh-var(--topbar-height,58px)-16rem)] min-h-[560px] gap-4">
      <ReorderAnnouncer message={announcement} />
      {order.map((id) => {
        const item = byId.get(id);
        if (!item) return null;
        return (
          <section
            key={id}
            draggable={canReorder && dragEnabledId === id}
            onDragStart={(e) => {
              begin(id);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(e) => {
              if (activeId) {
                e.preventDefault();
                setOverId(id);
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              onDrop(id);
              setDragEnabledId(null);
            }}
            onDragEnd={() => {
              end();
              setDragEnabledId(null);
            }}
            className={cn(
              'group/col flex w-[300px] shrink-0 flex-col rounded-lg transition-colors',
              overId === id && activeId !== id && 'bg-accent/30',
              activeId === id && 'opacity-50',
            )}
          >
            <header className="flex shrink-0 items-center gap-1 px-1 pb-2">
              {canReorder && (
                <Grip
                  onGrab={() => setDragEnabledId(id)}
                  onMove={(delta) => move(id, delta, item.label)}
                  label={item.label}
                  orientation="horizontal"
                  className="group-hover/col:opacity-100"
                />
              )}
              {item.header}
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto">{item.body}</div>
          </section>
        );
      })}
      {trailer}
    </div>
  );
}
