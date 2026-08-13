import Link from "next/link";
import { ArchiveRestore, Check, Trash2 } from "lucide-react";

import { UserAvatar } from "@/components/admin/ui/user-avatar";
import { archiveTask, restoreTask, setTaskStatus } from "@/lib/internal/actions";
import { cn } from "@/lib/utils";
import { TaskCard, type TaskRow } from "./task-card";
import { InlineAddTask } from "./inline-add-task";
import { AddSection, SectionHeading } from "./section-controls";
import { PermanentDeleteButton } from "./permanent-delete-button";
import {
  SortableSectionColumns,
  SortableSectionList,
  type SortableItem,
} from "./sortable-sections";
import { TASK_STATUS_META, asTaskStatus, type TaskStatus } from "./task-meta";

type Section = {
  id: string;
  name: string;
  color?: string | null;
  archived_at?: string | null;
};
type Project = { id: string; name: string; client?: { name: string } | null };
type Task = TaskRow & { area_id: string; archived_at?: string | null };
type ViewMode = "board" | "list";

export function TaskBoard({
  tasks,
  sections,
  projects = [],
  view = "list",
  canManage = false,
  isAdmin = false,
  archivedView = false,
}: {
  tasks: Task[];
  sections: Section[];
  projects?: Project[];
  view?: ViewMode;
  canManage?: boolean;
  /** Archiving a section and deleting anything for good are admin-only. */
  isAdmin?: boolean;
  /** Showing archived items only — nothing here is a place to add work. */
  archivedView?: boolean;
}) {
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const bySection = new Map(sections.map((s) => [s.id, [] as Task[]]));
  for (const t of tasks) bySection.get(t.area_id)?.push(t);

  if (view === "list") {
    return (
      <TaskListView
        sections={sections}
        bySection={bySection}
        canManage={canManage}
        isAdmin={isAdmin}
        archivedView={archivedView}
      />
    );
  }

  const boardItems: SortableItem[] = sections.map((section) => {
    const list = bySection.get(section.id) ?? [];
    return {
      id: section.id,
      label: section.name,
      header: (
        <SectionHeading
          id={section.id}
          name={section.name}
          count={list.length}
          color={section.color}
          canManage={canManage}
          canArchive={isAdmin}
          archived={Boolean(section.archived_at)}
        />
      ),
      body: (
        <div className="flex flex-col gap-2">
          {list.map((t) => (
            <div key={t.id} className={cn(t.archived_at && "opacity-60")}>
              <TaskCard
                task={t}
                project={t.project_id ? projectById.get(t.project_id) : undefined}
              />
              {t.archived_at && (
                <ArchivedTaskFooter
                  taskId={t.id}
                  title={t.title}
                  isAdmin={isAdmin}
                />
              )}
            </div>
          ))}
          {!section.archived_at && !archivedView && (
            <InlineAddTask areaId={section.id} variant="board" />
          )}
        </div>
      ),
    };
  });

  return (
    <div className="-mx-4 min-h-0 overflow-x-auto px-4 py-1 md:mx-0 md:px-0">
      <SortableSectionColumns
        items={boardItems}
        canReorder={canManage}
        trailer={
          canManage && !archivedView ? (
            <div className="w-[260px] shrink-0 pt-0.5">
              <AddSection variant="board" />
            </div>
          ) : null
        }
      />
    </div>
  );
}

// Trailing column holds the hover-revealed archive/restore control, plus the
// permanent delete an admin sees on archived rows.
const LIST_COLS = "grid-cols-[minmax(0,1fr)_11rem_7rem_3.5rem]";

function TaskListView({
  sections,
  bySection,
  canManage,
  isAdmin,
  archivedView,
}: {
  sections: Section[];
  bySection: Map<string, Task[]>;
  canManage: boolean;
  isAdmin: boolean;
  archivedView: boolean;
}) {
  const listItems: SortableItem[] = sections.map((section) => {
    const list = bySection.get(section.id) ?? [];
    return {
      id: section.id,
      label: section.name,
      header: (
        <SectionHeading
          id={section.id}
          name={section.name}
          count={list.length}
          color={section.color}
          canManage={canManage}
          canArchive={isAdmin}
          archived={Boolean(section.archived_at)}
        />
      ),
      body: (
        <>
          {list.map((task) => (
            <TaskListRow key={task.id} task={task} isAdmin={isAdmin} />
          ))}
          {!section.archived_at && !archivedView && (
            <div className="border-t border-border/40 py-1 pl-[28px] pr-3">
              <InlineAddTask areaId={section.id} variant="list" />
            </div>
          )}
        </>
      ),
    };
  });

  return (
    <div className="-mx-4 overflow-x-auto md:mx-0">
      <div className="min-w-[680px]">
        <div
          className={cn(
            "grid items-center gap-3 border-y border-border px-3 py-2 text-xs font-medium text-muted-foreground",
            LIST_COLS,
          )}
        >
          <span className="pl-[26px]">Name</span>
          <span>Assignee</span>
          <span>Due date</span>
          <span />
        </div>

        <SortableSectionList items={listItems} canReorder={canManage} />

        {canManage && !archivedView && (
          <div className="px-3 py-3">
            <AddSection variant="list" />
          </div>
        )}
      </div>
    </div>
  );
}

/** Restore (and, for admins, permanent delete) under an archived board card. */
function ArchivedTaskFooter({
  taskId,
  title,
  isAdmin,
}: {
  taskId: string;
  title: string;
  isAdmin: boolean;
}) {
  async function restore() {
    "use server";
    await restoreTask(taskId);
  }

  return (
    <div className="mt-1 flex items-center justify-end gap-1">
      <form action={restore} className="flex">
        <button
          type="submit"
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArchiveRestore className="size-3" />
          Restore
        </button>
      </form>
      {isAdmin && <PermanentDeleteButton target="task" id={taskId} name={title} />}
    </div>
  );
}

function TaskListRow({ task, isAdmin }: { task: Task; isAdmin: boolean }) {
  const assignee = (task.assignees ?? []).find((a) => a.profile);
  const status = asTaskStatus(task.status);
  const done = status === "done";
  const archived = Boolean(task.archived_at);
  const overdue = !!task.due_date && !done && !archived && task.due_date < todayIso();

  async function toggleDone() {
    "use server";
    await setTaskStatus(task.id, done ? "not_started" : "done");
  }

  async function archive() {
    "use server";
    await archiveTask(task.id);
  }

  async function restore() {
    "use server";
    await restoreTask(task.id);
  }

  return (
    <div
      className={cn(
        "group/row grid items-center gap-3 border-t border-border/40 px-3 py-2 hover:bg-muted/30",
        LIST_COLS,
        archived && "opacity-60",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <form action={toggleDone} className="flex">
          <button
            type="submit"
            aria-label={done ? "Mark task incomplete" : "Mark task complete"}
            className={cn(
              "grid size-[18px] shrink-0 place-items-center rounded-full border transition-colors",
              done
                ? "border-emerald-500 bg-emerald-500 text-white"
                : "border-muted-foreground/40 text-transparent hover:border-emerald-500 hover:text-emerald-500",
            )}
          >
            <Check className="size-3" strokeWidth={3} />
          </button>
        </form>
        <span
          aria-hidden
          className={cn("size-2 shrink-0 rounded-full", statusDot(status))}
          title={TASK_STATUS_META[status].label}
        />
        <Link
          href={`/workspace/internal/${task.id}`}
          className={cn(
            "min-w-0 truncate text-sm text-foreground hover:underline",
            done && "text-muted-foreground line-through",
          )}
        >
          {task.title}
        </Link>
      </div>

      <div className="min-w-0">
        {assignee?.profile ? (
          <span className="flex min-w-0 items-center gap-2">
            <UserAvatar
              email={assignee.user_id}
              name={assignee.profile.full_name ?? "Unknown"}
              avatarUrl={assignee.profile.avatar_url}
              size="sm"
            />
            <span className="truncate text-xs text-muted-foreground">
              {assignee.profile.full_name ?? "Unknown"}
            </span>
          </span>
        ) : (
          <span className="grid size-6 place-items-center rounded-full border border-dashed border-border text-[10px] text-muted-foreground">
            —
          </span>
        )}
      </div>

      <div>
        {task.due_date ? (
          <span
            className={cn(
              "inline-flex items-center rounded-md px-1.5 py-0.5 text-xs",
              overdue ? "bg-red-500/10 font-medium text-red-600" : "text-muted-foreground",
            )}
          >
            {formatDue(task.due_date)}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>

      <div className="flex justify-end gap-0.5">
        <form action={archived ? restore : archive} className="flex">
          <button
            type="submit"
            aria-label={archived ? "Restore task" : "Delete task"}
            title={archived ? "Restore task" : "Delete task"}
            className={cn(
              "grid size-6 place-items-center rounded text-muted-foreground transition",
              archived
                ? "hover:bg-muted hover:text-foreground"
                : "opacity-0 hover:bg-muted hover:text-destructive focus-visible:opacity-100 group-hover/row:opacity-100",
            )}
          >
            {archived ? (
              <ArchiveRestore className="size-3.5" />
            ) : (
              <Trash2 className="size-3.5" />
            )}
          </button>
        </form>
        {archived && isAdmin && (
          <PermanentDeleteButton target="task" id={task.id} name={task.title} />
        )}
      </div>
    </div>
  );
}

function statusDot(status: TaskStatus) {
  if (status === "in_progress") return "bg-blue-500";
  if (status === "blocked") return "bg-red-500";
  if (status === "done") return "bg-emerald-500";
  return "bg-slate-400";
}

function todayIso(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(
    t.getDate(),
  ).padStart(2, "0")}`;
}

function formatDue(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
