-- DC&A Hub PMS — extend non-admin SELECT policies to hide archived rows

-- projects: replace projects_member_read so non-admin only sees non-archived
drop policy if exists projects_member_read on projects;
create policy projects_member_read on projects for select
  using (
    public.is_admin()
    or (archived_at is null and public.can_access_project(id))
  );

-- clients: replace clients_member_read with archive-aware variant
drop policy if exists clients_member_read on clients;
create policy clients_member_read on clients for select
  using (
    public.is_admin()
    or (
      archived_at is null
      and exists (
        select 1 from projects p
        join project_members pm on pm.project_id = p.id
        where p.client_id = clients.id
          and pm.user_id = auth.uid()
          and p.archived_at is null
      )
    )
  );
