import { describe, it, expect } from 'vitest';
import { decideRedirect } from '@/lib/auth/decide-redirect';

describe('decideRedirect', () => {
  it('unauthenticated user on protected route → /login', () => {
    expect(decideRedirect({ pathname: '/admin', role: null })).toBe('/login');
    expect(decideRedirect({ pathname: '/workspace', role: null })).toBe('/login');
    expect(decideRedirect({ pathname: '/portal', role: null })).toBe('/login');
  });

  it('unauthenticated on /login or / passes through', () => {
    expect(decideRedirect({ pathname: '/login', role: null })).toBeNull();
    expect(decideRedirect({ pathname: '/', role: null })).toBeNull();
  });

  it('authenticated user on / is sent to their home', () => {
    expect(decideRedirect({ pathname: '/', role: 'admin' })).toBe('/admin');
    expect(decideRedirect({ pathname: '/', role: 'staff' })).toBe('/workspace');
    expect(decideRedirect({ pathname: '/', role: 'client' })).toBe('/portal');
  });

  it('client on /admin or /workspace → /portal', () => {
    expect(decideRedirect({ pathname: '/admin', role: 'client' })).toBe('/portal');
    expect(decideRedirect({ pathname: '/workspace', role: 'client' })).toBe('/portal');
  });

  it('staff on /admin → /workspace', () => {
    expect(decideRedirect({ pathname: '/admin', role: 'staff' })).toBe('/workspace');
  });

  it('staff on /portal → /workspace', () => {
    expect(decideRedirect({ pathname: '/portal', role: 'staff' })).toBe('/workspace');
  });

  it('admin can access any surface (no redirect)', () => {
    expect(decideRedirect({ pathname: '/admin', role: 'admin' })).toBeNull();
    expect(decideRedirect({ pathname: '/workspace', role: 'admin' })).toBeNull();
    expect(decideRedirect({ pathname: '/portal', role: 'admin' })).toBeNull();
  });

  it('user on their own surface passes through', () => {
    expect(decideRedirect({ pathname: '/workspace/projects/abc', role: 'staff' })).toBeNull();
    expect(decideRedirect({ pathname: '/portal/projects/abc', role: 'client' })).toBeNull();
  });

  it('authenticated user on /login is sent to their home', () => {
    expect(decideRedirect({ pathname: '/login', role: 'admin' })).toBe('/admin');
  });
});
