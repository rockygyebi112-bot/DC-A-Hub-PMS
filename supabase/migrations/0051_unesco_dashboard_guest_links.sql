create table public.unesco_dashboard_guest_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  dashboard_slug text not null check (dashboard_slug in ('youth-in-work', 'participant-trajectory')),
  email text not null check (email = lower(email)),
  expires_at timestamptz not null,
  challenge_hash text,
  challenge_expires_at timestamptz,
  session_hash text unique,
  unique (project_id, dashboard_slug, email)
);

alter table public.unesco_dashboard_guest_links enable row level security;
revoke all on public.unesco_dashboard_guest_links from anon, authenticated;
grant select, insert, update, delete on public.unesco_dashboard_guest_links to service_role;
