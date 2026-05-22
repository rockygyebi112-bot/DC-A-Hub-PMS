import Link from 'next/link';
import {
  BarChart3,
  CalendarDays,
  Columns3,
  Layers,
  ListChecks,
} from 'lucide-react';

import { cn } from '@/lib/utils';

const triggerBase =
  'inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all [&_svg]:size-4 [&_svg]:shrink-0';
const triggerInactive =
  'text-muted-foreground hover:text-foreground';
const triggerActive =
  'bg-background text-foreground shadow-sm dark:border-input dark:bg-input/30';

/**
 * Tab strip on the project's Data Collection dashboard route. The four
 * Phases/Board/List/Timeline entries link back to the project page; Data
 * Collection shows the active style. Styled to match the in-page `TabsList`.
 */
export function ProjectDashboardTabs({ projectId }: { projectId: string }) {
  const back = `/workspace/projects/${projectId}`;
  return (
    <div className="inline-flex w-full max-w-full items-center gap-1 overflow-x-auto rounded-lg bg-muted p-[3px] sm:w-auto">
      <Link href={back} className={cn(triggerBase, triggerInactive)}>
        <Layers />
        Phases
      </Link>
      <Link href={back} className={cn(triggerBase, triggerInactive)}>
        <Columns3 />
        Board
      </Link>
      <Link href={back} className={cn(triggerBase, triggerInactive)}>
        <ListChecks />
        List
      </Link>
      <Link href={back} className={cn(triggerBase, triggerInactive)}>
        <CalendarDays />
        Timeline
      </Link>
      <span
        className={cn(triggerBase, triggerActive)}
        aria-current="page"
      >
        <BarChart3 />
        Data Collection
      </span>
    </div>
  );
}
