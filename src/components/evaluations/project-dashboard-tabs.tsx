import Link from 'next/link';
import {
  BarChart3,
  CalendarDays,
  Columns3,
  Layers,
  ListChecks,
} from 'lucide-react';

import { cn } from '@/lib/utils';

const tabBase =
  'inline-flex items-center justify-center gap-1.5 rounded-md border border-transparent px-3 text-sm font-medium whitespace-nowrap transition-all [&_svg]:size-4 [&_svg]:shrink-0';
const tabInactive = 'text-muted-foreground hover:text-foreground';
const tabActive =
  'bg-background text-foreground shadow-sm dark:border-input dark:bg-input/30';

/**
 * Tab strip rendered on the project's Data Collection dashboard route so the
 * page reads as the "Data Collection" tab inside the project. The four
 * Phases/Board/List/Timeline entries are links back to the project page (where
 * they are real in-page tabs); Data Collection shows the active style.
 */
export function ProjectDashboardTabs({ projectId }: { projectId: string }) {
  return (
    <div className="inline-flex min-h-8 max-w-full items-center justify-start gap-1 overflow-x-auto rounded-lg bg-muted p-[3px]">
      <Link
        href={`/workspace/projects/${projectId}`}
        className={cn(tabBase, tabInactive, 'py-1')}
      >
        <Layers />
        Phases
      </Link>
      <Link
        href={`/workspace/projects/${projectId}`}
        className={cn(tabBase, tabInactive, 'py-1')}
      >
        <Columns3 />
        Board
      </Link>
      <Link
        href={`/workspace/projects/${projectId}`}
        className={cn(tabBase, tabInactive, 'py-1')}
      >
        <ListChecks />
        List
      </Link>
      <Link
        href={`/workspace/projects/${projectId}`}
        className={cn(tabBase, tabInactive, 'py-1')}
      >
        <CalendarDays />
        Timeline
      </Link>
      <span className={cn(tabBase, tabActive, 'py-1')} aria-current="page">
        <BarChart3 />
        Data Collection
      </span>
    </div>
  );
}
