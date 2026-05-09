-- DC&A Hub PMS — finance module: per-project budgets, categories, expenses

-- project_budgets ---------------------------------------------------------
create table if not exists project_budgets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references projects(id) on delete cascade,
  total_amount numeric(14,2) not null default 0 check (total_amount >= 0),
  currency text not null default 'GHS',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists project_budgets_project_idx on project_budgets(project_id);

-- budget_categories -------------------------------------------------------
create table if not exists budget_categories (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  allocated_amount numeric(14,2) not null default 0 check (allocated_amount >= 0),
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, name)
);
create index if not exists budget_categories_project_idx on budget_categories(project_id);

-- expenses ----------------------------------------------------------------
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  category_id uuid references budget_categories(id) on delete set null,
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'GHS',
  expense_date date not null default current_date,
  vendor text,
  description text,
  status text not null default 'incurred'
    check (status in ('planned','incurred','reimbursed','cancelled')),
  receipt_path text,
  receipt_name text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists expenses_project_idx on expenses(project_id);
create index if not exists expenses_category_idx on expenses(category_id);
create index if not exists expenses_date_idx on expenses(expense_date);
create index if not exists expenses_status_idx on expenses(status);

-- updated_at triggers (re-uses set_updated_at from 0001)
create trigger project_budgets_updated_at before update on project_budgets
  for each row execute function set_updated_at();
create trigger budget_categories_updated_at before update on budget_categories
  for each row execute function set_updated_at();
create trigger expenses_updated_at before update on expenses
  for each row execute function set_updated_at();

-- RLS ---------------------------------------------------------------------
alter table project_budgets enable row level security;
alter table budget_categories enable row level security;
alter table expenses enable row level security;

-- project_budgets: read by anyone with project access; write by members/admin
create policy project_budgets_read on project_budgets for select
  using (public.can_access_project(project_id));
create policy project_budgets_write on project_budgets for all
  using (public.can_write_project(project_id))
  with check (public.can_write_project(project_id));

-- budget_categories
create policy budget_categories_read on budget_categories for select
  using (public.can_access_project(project_id));
create policy budget_categories_write on budget_categories for all
  using (public.can_write_project(project_id))
  with check (public.can_write_project(project_id));

-- expenses
create policy expenses_read on expenses for select
  using (public.can_access_project(project_id));
create policy expenses_write on expenses for all
  using (public.can_write_project(project_id))
  with check (public.can_write_project(project_id));

-- Receipts storage bucket ------------------------------------------------
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- helper: extract project_id from object path "projects/{uuid}/expenses/..."
create or replace function public.receipt_project_id(object_name text)
returns uuid language sql stable as $$
  select (
    case
      when object_name like 'projects/%/expenses/%'
      then (split_part(object_name, '/', 2))::uuid
      else null
    end
  );
$$;

create policy "receipts_read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'receipts'
  and public.can_access_project(public.receipt_project_id(name))
);

create policy "receipts_write"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'receipts'
  and public.can_write_project(public.receipt_project_id(name))
);

create policy "receipts_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'receipts'
  and public.can_write_project(public.receipt_project_id(name))
);

create policy "receipts_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'receipts'
  and public.can_write_project(public.receipt_project_id(name))
);
