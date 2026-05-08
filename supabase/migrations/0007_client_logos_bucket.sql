-- DC&A Hub PMS — client logos storage bucket (public)

insert into storage.buckets (id, name, public)
values ('client-logos', 'client-logos', true)
on conflict (id) do update set public = true;

-- read: public (bucket is public, anyone with URL can view)
create policy "client_logos_read"
on storage.objects for select
to public
using (bucket_id = 'client-logos');

-- write/upload: admin only
create policy "client_logos_write"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'client-logos'
  and public.is_admin()
);

create policy "client_logos_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'client-logos'
  and public.is_admin()
);

create policy "client_logos_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'client-logos'
  and public.is_admin()
);
