import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const reorderSections = vi.fn(async () => ({ ok: true as const }));
const refresh = vi.fn();

vi.mock('@/lib/internal/actions', () => ({
  reorderSections: (...args: unknown[]) => reorderSections(...(args as [])),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

import { SortableSectionList, type SortableItem } from '@/components/internal/sortable-sections';

const ITEMS: SortableItem[] = [
  { id: 'a', label: 'Inception', header: <span>Inception</span>, body: <p>a-body</p> },
  { id: 'b', label: 'Fieldwork', header: <span>Fieldwork</span>, body: <p>b-body</p> },
  { id: 'c', label: 'Reporting', header: <span>Reporting</span>, body: <p>c-body</p> },
];

/** Section names in the order they currently appear in the DOM. */
function renderedOrder() {
  return screen
    .getAllByRole('button', { name: /^Reorder / })
    .map((el) => el.getAttribute('aria-label')!.match(/^Reorder (.+?)\./)![1]);
}

beforeEach(() => {
  reorderSections.mockClear();
  refresh.mockClear();
});

describe('SortableSectionList keyboard reordering (WCAG 2.1.1)', () => {
  it('exposes a focusable reorder control for each section', () => {
    render(<SortableSectionList items={ITEMS} canReorder />);
    const grips = screen.getAllByRole('button', { name: /^Reorder / });
    expect(grips).toHaveLength(3);
    // A real <button> is in the tab order without an explicit tabindex.
    for (const g of grips) {
      expect(g.tagName).toBe('BUTTON');
      expect(g.getAttribute('tabindex')).toBeNull();
    }
  });

  it('moves a section later with ArrowDown and persists the new order', async () => {
    render(<SortableSectionList items={ITEMS} canReorder />);
    expect(renderedOrder()).toEqual(['Inception', 'Fieldwork', 'Reporting']);

    fireEvent.keyDown(screen.getByRole('button', { name: /^Reorder Inception/ }), {
      key: 'ArrowDown',
    });

    await waitFor(() => expect(renderedOrder()).toEqual(['Fieldwork', 'Inception', 'Reporting']));
    expect(reorderSections).toHaveBeenCalledWith(['b', 'a', 'c']);
  });

  it('moves a section earlier with ArrowUp', async () => {
    render(<SortableSectionList items={ITEMS} canReorder />);

    fireEvent.keyDown(screen.getByRole('button', { name: /^Reorder Reporting/ }), {
      key: 'ArrowUp',
    });

    await waitFor(() => expect(renderedOrder()).toEqual(['Inception', 'Reporting', 'Fieldwork']));
    expect(reorderSections).toHaveBeenCalledWith(['a', 'c', 'b']);
  });

  it('announces the new position in a live region', async () => {
    const { container } = render(<SortableSectionList items={ITEMS} canReorder />);

    fireEvent.keyDown(screen.getByRole('button', { name: /^Reorder Inception/ }), {
      key: 'ArrowDown',
    });

    const live = container.querySelector('[aria-live="polite"]')!;
    await waitFor(() => expect(live.textContent).toBe('Inception moved to position 2 of 3.'));
  });

  it('refuses to move past the ends and says so, without writing', async () => {
    const { container } = render(<SortableSectionList items={ITEMS} canReorder />);

    fireEvent.keyDown(screen.getByRole('button', { name: /^Reorder Inception/ }), {
      key: 'ArrowUp',
    });

    const live = container.querySelector('[aria-live="polite"]')!;
    await waitFor(() => expect(live.textContent).toBe('Inception is already first.'));
    expect(renderedOrder()).toEqual(['Inception', 'Fieldwork', 'Reporting']);
    expect(reorderSections).not.toHaveBeenCalled();
  });

  it('omits the reorder control when the user cannot reorder', () => {
    render(<SortableSectionList items={ITEMS} canReorder={false} />);
    expect(screen.queryByRole('button', { name: /^Reorder / })).toBeNull();
  });
});
