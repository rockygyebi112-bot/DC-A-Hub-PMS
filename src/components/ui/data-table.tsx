"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronsUpDown, ChevronUp, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonText } from "@/components/ui/skeleton";

/**
 * DataTable<T> — a reusable, accessible table for list/index pages.
 *
 * Composes the `Table*` primitives and adds the things every real table needs
 * but nobody wants to re-implement per page: sorting, loading/empty/error
 * states, sticky header, whole-row navigation, and a mobile card-stack so the
 * table doesn't become an unusable horizontal scroll on phones.
 *
 * Sorting is uncontrolled by default. Pass `sort` + `onSortChange` to control
 * it (e.g. to drive a server-side `ORDER BY` via URL params).
 *
 * @example Basic (client-side sort)
 * ```tsx
 * type Project = { id: string; name: string; status: string; updatedAt: string };
 *
 * <DataTable<Project>
 *   caption="Projects"
 *   data={projects}
 *   getRowId={(p) => p.id}
 *   rowHref={(p) => `/admin/projects/${p.id}`}
 *   empty={{ title: "No projects yet", description: "Create one to get started." }}
 *   columns={[
 *     { id: "name", header: "Name", primary: true,
 *       accessor: (p) => p.name, sortable: true },
 *     { id: "status", header: "Status",
 *       cell: (p) => <StatusPill status={p.status} />,
 *       accessor: (p) => p.status, sortable: true },
 *     { id: "updated", header: "Updated", align: "end",
 *       accessor: (p) => p.updatedAt, sortable: true,
 *       cell: (p) => formatDate(p.updatedAt) },
 *   ]}
 * />
 * ```
 *
 * @example Server-controlled sort
 * ```tsx
 * <DataTable
 *   caption="Users"
 *   data={rows}
 *   getRowId={(u) => u.id}
 *   sort={sort}                          // from the URL / server state
 *   onSortChange={(next) => router.push(`?sort=${next.columnId}.${next.direction}`)}
 *   columns={columns}
 * />
 * ```
 *
 * @example Loading / error
 * ```tsx
 * <DataTable caption="Expenses" columns={columns} data={data ?? []}
 *   getRowId={(r) => r.id} loading={isLoading} error={err ? "Couldn’t load expenses." : null} />
 * ```
 */

export type SortDirection = "asc" | "desc";
export type SortState = { columnId: string; direction: SortDirection };

export type ColumnDef<T> = {
  /** Stable identifier — also the React key and the sort token. */
  id: string;
  /** Column heading. A string is used as the sort button's accessible name. */
  header: React.ReactNode;
  /** Value used for the default cell render AND default sorting. */
  accessor?: (row: T) => string | number | null | undefined;
  /** Custom cell render. Falls back to `accessor`'s value (or an em dash). */
  cell?: (row: T) => React.ReactNode;
  /** Allow sorting on this column. Requires `accessor` or `sortFn`. */
  sortable?: boolean;
  /** Custom comparator. Overrides the `accessor`-based default. */
  sortFn?: (a: T, b: T) => number;
  align?: "start" | "end" | "center";
  /** CSS width for the column (e.g. "12rem", "20%"). */
  width?: string;
  cellClassName?: string | ((row: T) => string);
  /** Label for this field in the mobile card-stack. Defaults to `header`. */
  mobileLabel?: React.ReactNode;
  /** Marks the column that holds the card title and the row link. Defaults to the first column. */
  primary?: boolean;
  /** Omit this column from the mobile card-stack. */
  hideOnMobile?: boolean;
};

export type DataTableProps<T> = {
  columns: ColumnDef<T>[];
  data: T[];
  /** Stable, unique id per row (React key + identity). */
  getRowId: (row: T) => string;
  /** Accessible name for the table. Visually hidden unless `captionVisible`. */
  caption: string;
  captionVisible?: boolean;

  loading?: boolean;
  /** Number of skeleton rows while `loading`. Default 5. */
  skeletonRows?: number;
  /** When set (and not loading), replaces the body with an alert row. */
  error?: React.ReactNode | null;
  /** Empty-state config shown when there are zero rows. */
  empty?: {
    icon?: LucideIcon;
    title: string;
    description?: string;
    action?: React.ReactNode;
  };

  /** Initial sort for the uncontrolled case. */
  defaultSort?: SortState;
  /** Controlled sort. Pass with `onSortChange` for server-driven sorting. */
  sort?: SortState | null;
  onSortChange?: (next: SortState) => void;

  /** Whole-row link target. Rendered as a real `<Link>` in the primary cell. */
  rowHref?: (row: T) => string | undefined;
  /** Whole-row click handler (mouse convenience + keyboard via primary cell). */
  onRowClick?: (row: T) => void;
  /** Extra class(es) for the desktop `<tr>` — e.g. dim archived rows. */
  rowClassName?: (row: T) => string | undefined;

  /**
   * The data is already sorted by the consumer (e.g. a server-side ORDER BY
   * driven by `sort`/`onSortChange`). Header controls still reflect `sort` and
   * emit `onSortChange`, but the rows are NOT re-ordered on the client.
   */
  manualSort?: boolean;

  /**
   * Custom mobile card renderer. When provided, the mobile card-stack uses it
   * verbatim per row (the card owns its own link/markup) instead of the generic
   * label/value layout — so bespoke mobile cards survive the migration.
   */
  renderCard?: (row: T) => React.ReactNode;

  stickyHeader?: boolean;
  className?: string;
};

function alignClass(align?: ColumnDef<unknown>["align"]) {
  return align === "end"
    ? "text-right"
    : align === "center"
      ? "text-center"
      : "text-left";
}

function justifyClass(align?: ColumnDef<unknown>["align"]) {
  return align === "end"
    ? "justify-end"
    : align === "center"
      ? "justify-center"
      : "justify-start";
}

/** Null/undefined sort last; numbers numerically; strings naturally. */
function defaultCompare(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
): number {
  const aNil = a === null || a === undefined || a === "";
  const bNil = b === null || b === undefined || b === "";
  if (aNil && bNil) return 0;
  if (aNil) return 1;
  if (bNil) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function isSortable<T>(col: ColumnDef<T>): boolean {
  return Boolean(col.sortable && (col.accessor || col.sortFn));
}

function headerName<T>(col: ColumnDef<T>): string {
  return typeof col.header === "string" ? col.header : col.id;
}

const INTERACTIVE_SELECTOR = "a,button,input,select,textarea,label,[role=button]";

export function DataTable<T>({
  columns,
  data,
  getRowId,
  caption,
  captionVisible = false,
  loading = false,
  skeletonRows = 5,
  error = null,
  empty,
  defaultSort,
  sort,
  onSortChange,
  rowHref,
  onRowClick,
  rowClassName,
  manualSort = false,
  renderCard,
  stickyHeader = true,
  className,
}: DataTableProps<T>) {
  const router = useRouter();
  const sortSelectId = React.useId();

  const isControlled = sort !== undefined;
  const [internalSort, setInternalSort] = React.useState<SortState | null>(
    defaultSort ?? null,
  );
  const activeSort = isControlled ? (sort ?? null) : internalSort;

  // Surface duplicate row ids in dev — they corrupt React keys silently. The
  // hook is called unconditionally (the env check lives inside) so it never
  // trips the rules-of-hooks.
  React.useMemo(() => {
    if (process.env.NODE_ENV === "production") return;
    const seen = new Set<string>();
    for (const row of data) {
      const id = getRowId(row);
      if (seen.has(id)) {
        console.warn(`[DataTable] duplicate row id: ${id}`);
        break;
      }
      seen.add(id);
    }
  }, [data, getRowId]);

  const primaryColumn =
    columns.find((c) => c.primary) ?? columns[0] ?? undefined;
  const colSpan = Math.max(columns.length, 1);
  const sortableColumns = columns.filter(isSortable);

  const applySort = React.useCallback(
    (next: SortState) => {
      if (!isControlled) setInternalSort(next);
      onSortChange?.(next);
    },
    [isControlled, onSortChange],
  );

  const toggleSort = React.useCallback(
    (col: ColumnDef<T>) => {
      if (!isSortable(col)) return;
      const next: SortState =
        activeSort?.columnId === col.id
          ? {
              columnId: col.id,
              direction: activeSort.direction === "asc" ? "desc" : "asc",
            }
          : { columnId: col.id, direction: "asc" };
      applySort(next);
    },
    [activeSort, applySort],
  );

  const sortedData = React.useMemo(() => {
    // Consumer owns ordering (server-side sort) — never re-order on the client.
    if (manualSort || !activeSort) return data;
    const col = columns.find((c) => c.id === activeSort.columnId);
    if (!col || !isSortable(col)) return data;
    const dir = activeSort.direction === "asc" ? 1 : -1;
    // Decorate-sort-undecorate keeps the sort stable across ties.
    return data
      .map((row, i) => ({ row, i }))
      .sort((x, y) => {
        const cmp = col.sortFn
          ? col.sortFn(x.row, y.row)
          : col.accessor
            ? defaultCompare(col.accessor(x.row), col.accessor(y.row))
            : 0;
        return cmp !== 0 ? cmp * dir : x.i - y.i;
      })
      .map((d) => d.row);
  }, [data, activeSort, columns, manualSort]);

  function renderCellContent(col: ColumnDef<T>, row: T): React.ReactNode {
    if (col.cell) return col.cell(row);
    if (col.accessor) {
      const v = col.accessor(row);
      if (v === null || v === undefined || v === "") {
        return <span className="text-muted-foreground">—</span>;
      }
      return v;
    }
    return null;
  }

  function handleRowActivate(
    e: React.MouseEvent<HTMLElement>,
    row: T,
  ) {
    // Don't hijack clicks that landed on an in-cell control or link.
    if ((e.target as HTMLElement).closest(INTERACTIVE_SELECTOR)) return;
    if (onRowClick) {
      onRowClick(row);
      return;
    }
    const href = rowHref?.(row);
    if (href) router.push(href);
  }

  /** Primary-cell content wrapped so keyboard users can reach the row target. */
  function primaryWrapper(row: T, content: React.ReactNode): React.ReactNode {
    const href = rowHref?.(row);
    if (href) {
      return (
        <Link
          href={href}
          className="rounded-sm font-medium text-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          {content}
        </Link>
      );
    }
    if (onRowClick) {
      return (
        <button
          type="button"
          onClick={() => onRowClick(row)}
          className="rounded-sm text-left font-medium text-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          {content}
        </button>
      );
    }
    return content;
  }

  const interactiveRows = Boolean(rowHref || onRowClick);
  const hasRows = sortedData.length > 0;
  const showEmpty = !loading && !error && !hasRows;

  // ── Desktop table ──────────────────────────────────────────────────────
  const desktop = (
    <Table
      aria-busy={loading || undefined}
      className={cn("min-w-full", className)}
    >
      <caption className={captionVisible ? "py-2 text-sm text-muted-foreground" : "sr-only"}>
        {caption}
      </caption>
      <TableHeader
        className={stickyHeader ? "sticky top-0 z-10 bg-background" : undefined}
      >
        <TableRow>
          {columns.map((col) => {
            const sortable = isSortable(col);
            const active = activeSort?.columnId === col.id;
            const ariaSort = active
              ? activeSort.direction === "asc"
                ? "ascending"
                : "descending"
              : sortable
                ? "none"
                : undefined;
            return (
              <TableHead
                key={col.id}
                style={col.width ? { width: col.width } : undefined}
                aria-sort={ariaSort}
                className={alignClass(col.align)}
              >
                <span
                  className={cn(
                    "flex items-center gap-1",
                    justifyClass(col.align),
                  )}
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col)}
                      aria-label={`Sort by ${headerName(col)}`}
                      className="-mx-1 inline-flex items-center gap-1 rounded px-1 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span>{col.header}</span>
                      {active ? (
                        activeSort.direction === "asc" ? (
                          <ChevronUp className="size-3.5" />
                        ) : (
                          <ChevronDown className="size-3.5" />
                        )
                      ) : (
                        <ChevronsUpDown className="size-3.5 opacity-50" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </span>
              </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>

      <TableBody>
        {loading ? (
          Array.from({ length: skeletonRows }).map((_, r) => (
            <TableRow key={`sk-${r}`} aria-hidden>
              {columns.map((col, c) => (
                <TableCell key={col.id} className={alignClass(col.align)}>
                  <SkeletonText
                    width={["70%", "45%", "60%", "35%"][c % 4]}
                    className={cn(col.align === "end" && "ml-auto")}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : error ? (
          <TableRow>
            <TableCell
              colSpan={colSpan}
              role="alert"
              className="py-8 text-center text-sm text-destructive"
            >
              {error}
            </TableCell>
          </TableRow>
        ) : showEmpty ? (
          <TableRow>
            <TableCell colSpan={colSpan} className="p-0">
              <EmptyState
                icon={empty?.icon}
                title={empty?.title ?? "No results"}
                description={empty?.description}
                action={empty?.action}
              />
            </TableCell>
          </TableRow>
        ) : (
          sortedData.map((row) => (
            <TableRow
              key={getRowId(row)}
              onClick={
                interactiveRows ? (e) => handleRowActivate(e, row) : undefined
              }
              className={cn(
                interactiveRows && "cursor-pointer",
                rowClassName?.(row),
              )}
            >
              {columns.map((col) => {
                const content = renderCellContent(col, row);
                return (
                  <TableCell
                    key={col.id}
                    style={col.width ? { width: col.width } : undefined}
                    className={cn(
                      alignClass(col.align),
                      typeof col.cellClassName === "function"
                        ? col.cellClassName(row)
                        : col.cellClassName,
                    )}
                  >
                    {col === primaryColumn
                      ? primaryWrapper(row, content)
                      : content}
                  </TableCell>
                );
              })}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  // ── Mobile card-stack ──────────────────────────────────────────────────
  const mobileColumns = columns.filter(
    (c) => !c.hideOnMobile && c !== primaryColumn,
  );

  const mobile = (
    <div aria-busy={loading || undefined}>
      <h2 className="sr-only">{caption}</h2>

      {sortableColumns.length > 0 && !loading && hasRows && (
        <div className="mb-3 flex items-center gap-2">
          <label htmlFor={sortSelectId} className="text-xs text-muted-foreground">
            Sort
          </label>
          <select
            id={sortSelectId}
            value={activeSort?.columnId ?? ""}
            onChange={(e) => {
              const col = columns.find((c) => c.id === e.target.value);
              if (col) {
                applySort({
                  columnId: col.id,
                  direction: activeSort?.direction ?? "asc",
                });
              }
            }}
            className="h-8 flex-1 rounded-lg border border-border bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <option value="" disabled>
              Choose a field…
            </option>
            {sortableColumns.map((c) => (
              <option key={c.id} value={c.id}>
                {headerName(c)}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!activeSort}
            onClick={() =>
              activeSort &&
              applySort({
                columnId: activeSort.columnId,
                direction: activeSort.direction === "asc" ? "desc" : "asc",
              })
            }
            aria-label={
              activeSort?.direction === "desc"
                ? "Sort ascending"
                : "Sort descending"
            }
            className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-background outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
          >
            {activeSort?.direction === "desc" ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronUp className="size-4" />
            )}
          </button>
        </div>
      )}

      {loading ? (
        <ul className="space-y-3">
          {Array.from({ length: skeletonRows }).map((_, r) => (
            <li
              key={`mc-${r}`}
              aria-hidden
              className="rounded-xl border bg-card p-4"
            >
              <SkeletonText width="55%" className="h-4" />
              <div className="mt-3 space-y-2">
                <SkeletonText width="80%" />
                <SkeletonText width="65%" />
              </div>
            </li>
          ))}
        </ul>
      ) : error ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-center text-sm text-destructive"
        >
          {error}
        </div>
      ) : showEmpty ? (
        <EmptyState
          icon={empty?.icon}
          title={empty?.title ?? "No results"}
          description={empty?.description}
          action={empty?.action}
        />
      ) : renderCard ? (
        // Consumer-owned bespoke card (owns its own link/markup).
        <ul className="space-y-3">
          {sortedData.map((row) => (
            <li key={getRowId(row)}>{renderCard(row)}</li>
          ))}
        </ul>
      ) : (
        <ul className="space-y-3">
          {sortedData.map((row) => (
            <li
              key={getRowId(row)}
              onClick={
                interactiveRows ? (e) => handleRowActivate(e, row) : undefined
              }
              className={cn(
                "rounded-xl border bg-card p-4 shadow-sm",
                interactiveRows && "cursor-pointer",
              )}
            >
              {primaryColumn && (
                <div className="text-sm">
                  {primaryWrapper(row, renderCellContent(primaryColumn, row))}
                </div>
              )}
              {mobileColumns.length > 0 && (
                <dl className="mt-2 space-y-1.5">
                  {mobileColumns.map((col) => (
                    <div
                      key={col.id}
                      className="flex items-baseline justify-between gap-3 text-sm"
                    >
                      <dt className="shrink-0 text-muted-foreground">
                        {col.mobileLabel ?? col.header}
                      </dt>
                      <dd className="min-w-0 truncate text-right font-medium text-foreground">
                        {renderCellContent(col, row)}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div data-slot="data-table">
      <div className="hidden md:block">{desktop}</div>
      <div className="md:hidden">{mobile}</div>
    </div>
  );
}
