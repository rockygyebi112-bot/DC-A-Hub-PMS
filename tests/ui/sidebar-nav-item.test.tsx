import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SidebarNavItem } from '@/components/shell/sidebar-nav-item';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { NavItem } from '@/components/shell/nav-utils';

const item: NavItem = {
  href: '/workspace/projects',
  label: 'Projects',
  icon: 'folder-kanban',
};

describe('SidebarNavItem', () => {
  it('renders the label and links to the item href when expanded', () => {
    render(<SidebarNavItem item={item} active={false} />);
    const link = screen.getByRole('link', { name: 'Projects' });
    expect(link.getAttribute('href')).toBe('/workspace/projects');
  });

  it('marks the link as the current page when active', () => {
    render(<SidebarNavItem item={item} active />);
    expect(screen.getByRole('link').getAttribute('aria-current')).toBe('page');
  });

  it('renders the badge when the item has one', () => {
    render(<SidebarNavItem item={{ ...item, badge: 3 }} active={false} />);
    expect(screen.getByText('3')).toBeDefined();
  });

  it('hides the text label when collapsed', () => {
    render(
      <TooltipProvider>
        <SidebarNavItem item={item} active={false} collapsed />
      </TooltipProvider>,
    );
    // Collapsed rail shows icon only — the visible link has no text label.
    expect(screen.getByRole('link').textContent).toBe('');
  });
});
