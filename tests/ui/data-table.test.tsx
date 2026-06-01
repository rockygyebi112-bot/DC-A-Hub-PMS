import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";

import { DataTable, type ColumnDef } from "@/components/ui/data-table";

// next/navigation's useRouter isn't available under jsdom; stub it.
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

type Row = { id: string; name: string; score: number | null };

const rows: Row[] = [
  { id: "1", name: "Charlie", score: 30 },
  { id: "2", name: "alice", score: null },
  { id: "3", name: "Bob", score: 9 },
];

const columns: ColumnDef<Row>[] = [
  { id: "name", header: "Name", primary: true, accessor: (r) => r.name, sortable: true },
  { id: "score", header: "Score", align: "end", accessor: (r) => r.score, sortable: true },
];

/** Read the data rows (skip the header row) from the desktop <table>. */
function bodyRowText() {
  const table = screen.getByRole("table");
  // First row is the header; the rest are body rows.
  const allRows = within(table).getAllByRole("row").slice(1);
  return allRows.map((r) => r.textContent);
}

beforeEach(() => {
  push.mockClear();
});

describe("DataTable", () => {
  it("renders headers and a row per datum", () => {
    render(
      <DataTable caption="People" columns={columns} data={rows} getRowId={(r) => r.id} />,
    );
    const table = screen.getByRole("table");
    expect(within(table).getByText("Name")).toBeInTheDocument();
    expect(within(table).getByText("Charlie")).toBeInTheDocument();
    expect(bodyRowText()).toHaveLength(3);
  });

  it("sorts ascending then descending on header click, with case-insensitivity and nulls last", () => {
    render(
      <DataTable caption="People" columns={columns} data={rows} getRowId={(r) => r.id} />,
    );
    const table = screen.getByRole("table");
    const nameHeader = within(table).getByRole("button", { name: "Sort by Name" });

    fireEvent.click(nameHeader); // asc — "alice" sorts with A/B/C despite lowercase
    expect(bodyRowText().map((t) => t?.replace(/[0-9—]/g, ""))).toEqual([
      "alice",
      "Bob",
      "Charlie",
    ]);
    expect(within(table).getByRole("columnheader", { name: /Name/ })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );

    fireEvent.click(nameHeader); // desc
    expect(bodyRowText().map((t) => t?.replace(/[0-9—]/g, ""))).toEqual([
      "Charlie",
      "Bob",
      "alice",
    ]);
    expect(within(table).getByRole("columnheader", { name: /Name/ })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
  });

  it("sorts numbers numerically and pushes null values to the end", () => {
    render(
      <DataTable caption="People" columns={columns} data={rows} getRowId={(r) => r.id} />,
    );
    const table = screen.getByRole("table");
    fireEvent.click(within(table).getByRole("button", { name: "Sort by Score" }));
    // asc: 9, 30, then the null-score row last
    expect(bodyRowText()).toEqual(["Bob9", "Charlie30", "alice—"]);
  });

  it("shows skeleton rows and marks the table busy while loading", () => {
    render(
      <DataTable
        caption="People"
        columns={columns}
        data={[]}
        getRowId={(r) => r.id}
        loading
        skeletonRows={4}
      />,
    );
    expect(screen.getByRole("table")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("Charlie")).not.toBeInTheDocument();
  });

  it("renders an alert row on error, taking precedence over empty", () => {
    render(
      <DataTable
        caption="People"
        columns={columns}
        data={[]}
        getRowId={(r) => r.id}
        error="Couldn’t load people."
        empty={{ title: "No people" }}
      />,
    );
    const alerts = screen.getAllByRole("alert");
    expect(alerts.some((a) => a.textContent?.includes("Couldn’t load people."))).toBe(true);
    expect(screen.queryByText("No people")).not.toBeInTheDocument();
  });

  it("shows the empty state when there are no rows", () => {
    render(
      <DataTable
        caption="People"
        columns={columns}
        data={[]}
        getRowId={(r) => r.id}
        empty={{ title: "No people yet", description: "Add one." }}
      />,
    );
    // Rendered in both desktop + mobile branches; assert at least one is present.
    expect(screen.getAllByText("No people yet").length).toBeGreaterThan(0);
  });

  it("renders a real link in the primary cell when rowHref is set", () => {
    render(
      <DataTable
        caption="People"
        columns={columns}
        data={rows}
        getRowId={(r) => r.id}
        rowHref={(r) => `/people/${r.id}`}
      />,
    );
    const table = screen.getByRole("table");
    const link = within(table).getByRole("link", { name: "Charlie" });
    expect(link).toHaveAttribute("href", "/people/1");
  });

  it("fires onRowClick from a row click but NOT from an in-cell button", () => {
    const onRowClick = vi.fn();
    const cols: ColumnDef<Row>[] = [
      ...columns,
      {
        id: "actions",
        header: "Actions",
        cell: (r) => <button type="button">Edit {r.name}</button>,
      },
    ];
    render(
      <DataTable
        caption="People"
        columns={cols}
        data={rows}
        getRowId={(r) => r.id}
        onRowClick={onRowClick}
      />,
    );
    const table = screen.getByRole("table");

    // Clicking the in-cell button must not bubble up to row activation.
    fireEvent.click(within(table).getByRole("button", { name: "Edit Charlie" }));
    expect(onRowClick).not.toHaveBeenCalled();

    // Clicking a plain cell activates the row.
    fireEvent.click(within(table).getByText("30"));
    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });

  it("supports controlled sort (no internal state change; calls onSortChange)", () => {
    const onSortChange = vi.fn();
    const { rerender } = render(
      <DataTable
        caption="People"
        columns={columns}
        data={rows}
        getRowId={(r) => r.id}
        sort={{ columnId: "name", direction: "asc" }}
        onSortChange={onSortChange}
      />,
    );
    const table = screen.getByRole("table");
    // Controlled to asc — order reflects the prop, not a click.
    expect(bodyRowText().map((t) => t?.replace(/[0-9—]/g, ""))).toEqual([
      "alice",
      "Bob",
      "Charlie",
    ]);

    fireEvent.click(within(table).getByRole("button", { name: "Sort by Name" }));
    // It asks the parent to flip, but the view doesn't change until the prop does.
    expect(onSortChange).toHaveBeenCalledWith({ columnId: "name", direction: "desc" });
    expect(bodyRowText().map((t) => t?.replace(/[0-9—]/g, ""))).toEqual([
      "alice",
      "Bob",
      "Charlie",
    ]);

    rerender(
      <DataTable
        caption="People"
        columns={columns}
        data={rows}
        getRowId={(r) => r.id}
        sort={{ columnId: "name", direction: "desc" }}
        onSortChange={onSortChange}
      />,
    );
    expect(bodyRowText().map((t) => t?.replace(/[0-9—]/g, ""))).toEqual([
      "Charlie",
      "Bob",
      "alice",
    ]);
  });
});
