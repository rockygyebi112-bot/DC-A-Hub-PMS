import type { AppRole } from './require-role';

type Input = {
  pathname: string;
  role: AppRole | null;
};

function surfaceFor(pathname: string): 'admin' | 'workspace' | 'portal' | null {
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return 'admin';
  if (pathname === '/workspace' || pathname.startsWith('/workspace/')) return 'workspace';
  if (pathname === '/portal' || pathname.startsWith('/portal/')) return 'portal';
  return null;
}

export function decideRedirect({ pathname, role }: Input): string | null {
  const surface = surfaceFor(pathname);

  // Unauthenticated
  if (role === null) {
    if (surface !== null) return '/login';
    return null;
  }

  // Authenticated
  const home =
    role === 'admin' ? '/admin' :
    role === 'staff' ? '/workspace' :
    /* client */       '/portal';

  // Root or login → bounce to home
  if (pathname === '/' || pathname === '/login') return home;

  // Admin can go anywhere
  if (role === 'admin') return null;

  // Otherwise must match own surface
  if (surface === null) return null; // /account, etc.
  if (
    (role === 'staff'  && surface !== 'workspace') ||
    (role === 'client' && surface !== 'portal')
  ) return home;

  return null;
}
