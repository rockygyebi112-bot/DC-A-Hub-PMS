-- DC&A Hub PMS — archive columns + user is_active flag

alter table clients  add column if not exists archived_at timestamptz;
alter table projects add column if not exists archived_at timestamptz;
alter table profiles add column if not exists is_active boolean not null default true;

create index if not exists clients_active_idx  on clients  (archived_at) where archived_at is null;
create index if not exists projects_active_idx on projects (archived_at) where archived_at is null;
create index if not exists profiles_active_idx on profiles (is_active) where is_active = true;
