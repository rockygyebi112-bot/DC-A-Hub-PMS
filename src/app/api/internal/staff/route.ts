import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/auth/get-current-profile';

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== 'admin' && profile.role !== 'staff')) {
    return NextResponse.json([], { status: 403 });
  }
  // Use the service client so a staff caller sees ALL staff/admin colleagues to
  // assign. The `profiles` RLS policy (migration 0017) only exposes self /
  // admin / shared-project rows, which would otherwise hide most colleagues
  // from the internal-task assignee picker. This route is already gated to
  // admin/staff and returns only non-sensitive name/id for staff+admins.
  const sb = createServiceClient();
  const { data } = await sb
    .from('profiles')
    .select('user_id, full_name')
    .in('role', ['admin', 'staff'])
    .order('full_name');
  return NextResponse.json(data ?? []);
}
