
-- Projects
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  description text,
  client text,
  status text not null default 'planning',
  budget numeric not null default 0,
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.projects enable row level security;
create policy "projects_all_own" on public.projects for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger projects_updated before update on public.projects for each row execute function public.set_updated_at();

-- Tasks
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  project_id uuid,
  title text not null,
  description text,
  assignee text,
  priority text not null default 'medium',
  status text not null default 'todo',
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.tasks enable row level security;
create policy "tasks_all_own" on public.tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger tasks_updated before update on public.tasks for each row execute function public.set_updated_at();

-- Suppliers
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  contact_name text,
  email text,
  phone text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.suppliers enable row level security;
create policy "suppliers_all_own" on public.suppliers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger suppliers_updated before update on public.suppliers for each row execute function public.set_updated_at();

-- Purchase orders
create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  supplier_id uuid,
  po_number text not null,
  total numeric not null default 0,
  status text not null default 'draft',
  order_date date not null default current_date,
  expected_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.purchase_orders enable row level security;
create policy "purchase_orders_all_own" on public.purchase_orders for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger purchase_orders_updated before update on public.purchase_orders for each row execute function public.set_updated_at();
