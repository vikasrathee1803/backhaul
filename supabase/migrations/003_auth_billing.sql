-- Backhaul: auth + billing schema
-- Run against your Supabase project via psql or the Supabase dashboard SQL editor.

create table if not exists public.profiles (
  id           uuid references auth.users on delete cascade primary key,
  full_name    text,
  company_name text,
  created_at   timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- ─────────────────────────────────────────────────────────
create table if not exists public.workspaces (
  id                       uuid primary key default gen_random_uuid(),
  owner_id                 uuid references auth.users on delete cascade not null,
  name                     text not null,
  plan                     text default 'free' check (plan in ('free', 'starter', 'pro', 'enterprise')),
  stripe_customer_id       text,
  stripe_subscription_id   text,
  returns_processed_month  integer default 0,
  returns_limit            integer default 0,
  created_at               timestamptz default now()
);

alter table public.workspaces enable row level security;

create policy "Owners can read own workspace"
  on public.workspaces for select
  using (auth.uid() = owner_id);

create policy "Owners can update own workspace"
  on public.workspaces for update
  using (auth.uid() = owner_id);

-- ─────────────────────────────────────────────────────────
-- Auto-create profile + workspace when a user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  insert into public.profiles (id, full_name, company_name)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'company_name'
  );

  insert into public.workspaces (owner_id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'company_name', 'My Workspace')
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
