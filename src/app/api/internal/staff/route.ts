import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/auth/get-current-profile';

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== 'admin' && profile.role !== 'staff')) {
    return NextResponse.json([], { status: 403 });
  }
  const sb = await createClient();
  const { data } = await sb
    .from('profiles')
    .select('user_id, full_name')
    .in('role', ['admin', 'staff'])
    .order('full_name');
  return NextResponse.json(data ?? []);
}
