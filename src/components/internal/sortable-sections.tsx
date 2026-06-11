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

export type SortableItem = { id: string; header: ReactNode; body: ReactNode };

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

  // Re-sync when sections are added/removed/renamed server-side.
  const key = ids.join(',');
  useEffect(() => {
    setOrder(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

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
      start(async () => {
        const r = await reorderSections(next);
        if (!r.ok) toast.error(r.error ?? 'Could not reorder sections');
        router.refresh();
      });
      return next;
    });
  }

  return {
    order,
    activeId,
    overId,
    setOverId,
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

function Grip({
  onGrab,
  className,
}: {
  onGrab: () => void;
  className?: string;
}) {
  return (
    <span
      role="button"
      aria-label="Drag to reorder section"
      onMouseDown={onGrab}
      onMouseUp={(e) => e.currentTarget.blur()}
      className={cn(
        'grid size-5 shrink-0 cursor-grab place-items-center rounded text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground active:cursor-grabbing',
        className,
      )}
    >
      <GripVertical className="size-3.5" />
    </span>
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
  const { order, activeId, overId, setOverId, begin, end, onDrop } = useReorder(
    items.map((i) => i.id),
  );
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
              {canReorder && <Grip onGrab={() => setDragEnabledId(id)} className="group-hover/sec:opacity-100" />}
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
  const { order, activeId, overId, setOverId, begin, end, onDrop } = useReorder(
    items.map((i) => i.id),
  );
  const [dragEnabledId, setDragEnabledId] = useState<string | null>(null);
  const byId = new Map(items.map((i) => [i.id, i]));

  return (
    <div className="flex h-[calc(100vh-var(--topbar-height,58px)-16rem)] min-h-[560px] gap-4">
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
              {canReorder && <Grip onGrab={() => setDragEnabledId(id)} className="group-hover/col:opacity-100" />}
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
