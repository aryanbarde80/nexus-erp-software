
-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role text default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

-- handle new user
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), new.email);
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- CUSTOMERS
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  company text,
  status text not null default 'lead',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.customers enable row level security;
create policy "customers_all_own" on public.customers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger customers_updated before update on public.customers for each row execute function public.set_updated_at();
create index on public.customers (user_id);

-- PRODUCTS
create table public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  sku text,
  category text,
  price numeric(12,2) not null default 0,
  cost numeric(12,2) not null default 0,
  stock integer not null default 0,
  low_stock_threshold integer not null default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.products enable row level security;
create policy "products_all_own" on public.products for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger products_updated before update on public.products for each row execute function public.set_updated_at();
create index on public.products (user_id);

-- INVOICES
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  invoice_number text not null,
  amount numeric(12,2) not null default 0,
  tax numeric(12,2) not null default 0,
  status text not null default 'draft',
  issue_date date not null default current_date,
  due_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.invoices enable row level security;
create policy "invoices_all_own" on public.invoices for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger invoices_updated before update on public.invoices for each row execute function public.set_updated_at();
create index on public.invoices (user_id);

-- EXPENSES
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  description text,
  amount numeric(12,2) not null default 0,
  vendor text,
  date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.expenses enable row level security;
create policy "expenses_all_own" on public.expenses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger expenses_updated before update on public.expenses for each row execute function public.set_updated_at();
create index on public.expenses (user_id);

-- EMPLOYEES
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  email text,
  position text,
  department text,
  salary numeric(12,2) not null default 0,
  hire_date date not null default current_date,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.employees enable row level security;
create policy "employees_all_own" on public.employees for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger employees_updated before update on public.employees for each row execute function public.set_updated_at();
create index on public.employees (user_id);
