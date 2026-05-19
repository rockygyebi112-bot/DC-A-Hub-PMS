export type AppRole = 'admin' | 'staff' | 'client';

export function resolveHomeForRole(role: AppRole | null): string {
  if (role === 'admin') return '/admin';
  if (role === 'staff') return '/workspace';
  if (role === 'client') return '/portal';
  return '/login';
}

export function isRoleAllowed(
  role: AppRole | null,
  allowed: AppRole[],
): boolean {
  if (role === null) return false;
  return allowed.includes(role);
}
