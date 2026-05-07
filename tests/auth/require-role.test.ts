import { describe, it, expect } from 'vitest';
import { resolveHomeForRole, isRoleAllowed } from '@/lib/auth/require-role';

describe('resolveHomeForRole', () => {
  it('routes admin to /admin', () => {
    expect(resolveHomeForRole('admin')).toBe('/admin');
  });
  it('routes staff to /workspace', () => {
    expect(resolveHomeForRole('staff')).toBe('/workspace');
  });
  it('routes client to /portal', () => {
    expect(resolveHomeForRole('client')).toBe('/portal');
  });
  it('routes unauthenticated (null) to /login', () => {
    expect(resolveHomeForRole(null)).toBe('/login');
  });
});

describe('isRoleAllowed', () => {
  it('admin can access admin-only route', () => {
    expect(isRoleAllowed('admin', ['admin'])).toBe(true);
  });
  it('admin can access workspace route (admin always allowed in workspace)', () => {
    expect(isRoleAllowed('admin', ['staff', 'admin'])).toBe(true);
  });
  it('staff cannot access admin route', () => {
    expect(isRoleAllowed('staff', ['admin'])).toBe(false);
  });
  it('client cannot access workspace', () => {
    expect(isRoleAllowed('client', ['staff', 'admin'])).toBe(false);
  });
  it('null role is denied everywhere', () => {
    expect(isRoleAllowed(null, ['admin'])).toBe(false);
    expect(isRoleAllowed(null, ['staff', 'admin'])).toBe(false);
    expect(isRoleAllowed(null, ['client'])).toBe(false);
  });
});
