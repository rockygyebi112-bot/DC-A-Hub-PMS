-- DC&A Hub PMS — proofs storage bucket

insert into storage.buckets (id, name, public)
values ('proofs', 'proofs', false)
on conflict (id) do nothing;

-- helper: extract project_id from object path "projects/{uuid}/..."
create or replace function public.project_id_from_path(object_name text)
returns uuid language sql stable as $$
  select (
    case
      when object_name like 'projects/%/activities/%/%'
      then (split_part(object_name, '/', 2))::uuid
      else null
    end
  );
$$;

-- read: anyone who can access the project
create policy "proofs_read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'proofs'
  and public.can_access_project(public.project_id_from_path(name))
);

-- write/upload: members + admin
create policy "proofs_write"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'proofs'
  and public.can_write_project(public.project_id_from_path(name))
);

create policy "proofs_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'proofs'
  and public.can_write_project(public.project_id_from_path(name))
);

create policy "proofs_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'proofs'
  and public.can_write_project(public.project_id_from_path(name))
);
