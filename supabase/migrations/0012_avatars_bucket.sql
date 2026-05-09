-- DC&A Hub PMS — public avatars bucket for user profile pictures
-- Path convention: avatars/{auth.uid()}/avatar.<ext>

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- read: public (bucket is public, anyone with the URL can view).
drop policy if exists "avatars_read" on storage.objects;
create policy "avatars_read"
on storage.objects for select
to public
using (bucket_id = 'avatars');

-- write: authenticated users may only upload into their OWN folder.
drop policy if exists "avatars_self_insert" on storage.objects;
create policy "avatars_self_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "avatars_self_update" on storage.objects;
create policy "avatars_self_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "avatars_self_delete" on storage.objects;
create policy "avatars_self_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = auth.uid()::text
);
