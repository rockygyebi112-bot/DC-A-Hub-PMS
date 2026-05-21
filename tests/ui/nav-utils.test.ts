import { describe, it, expect } from 'vitest';
import {
  resolveNavIcon,
  isNavItemActive,
  NAV_ICONS,
} from '@/components/shell/nav-utils';
import type { NavItem } from '@/components/shell/nav-utils';

const item = (over: Partial<NavItem> = {}): NavItem => ({
  href: '/workspace/projects',
  label: 'Projects',
  icon: 'folder-kanban',
  ...over,
});

describe('resolveNavIcon', () => {
  it('returns the mapped icon for a known key', () => {
    expect(resolveNavIcon('users')).toBe(NAV_ICONS.users);
  });

  it('falls back to the dashboard icon for an unknown key', () => {
    expect(resolveNavIcon('does-not-exist')).toBe(NAV_ICONS['layout-dashboard']);
  });
});

describe('isNavItemActive', () => {
  it('matches the exact href', () => {
    expect(isNavItemActive(item(), '/workspace/projects')).toBe(true);
  });

  it('matches descendant routes by default', () => {
    expect(isNavItemActive(item(), '/workspace/projects/abc')).toBe(true);
  });

  it('does not match descendants when exact is set', () => {
    expect(isNavItemActive(item({ exact: true }), '/workspace/projects/abc')).toBe(false);
  });

  it('does not match an unrelated route', () => {
    expect(isNavItemActive(item(), '/workspace/tasks')).toBe(false);
  });

  it('does not treat a sibling prefix as a descendant', () => {
    expect(isNavItemActive(item(), '/workspace/projects-archive')).toBe(false);
  });
});
