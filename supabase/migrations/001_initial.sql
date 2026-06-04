-- Users table (extends Supabase Auth)
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  is_publisher boolean not null default false,
  wallet_address text,
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  suspended boolean not null default false
);

alter table public.users enable row level security;

create policy "Users can read own row" on public.users
  for select using (auth.uid() = id);

create policy "Users can update own row" on public.users
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

-- Service role can do everything (for backend)
create policy "Service role full access" on public.users
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Content table
create table public.content (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  slug text not null unique,
  type text not null check (type in ('url', 'file')),
  price_units integer not null check (price_units >= 50000),
  description text not null,
  splitter_address text not null,
  secret_url text,
  r2_key text,
  file_name text,
  file_size integer,
  suspended boolean not null default false,
  created_at timestamptz not null default now(),
  last_download_at timestamptz
);

alter table public.content enable row level security;

create policy "Owners can read own content" on public.content
  for select using (auth.uid() = owner_id);

create policy "Owners can insert own content" on public.content
  for insert with check (auth.uid() = owner_id);

create policy "Owners can update own content" on public.content
  for update using (auth.uid() = owner_id);

create policy "Owners can delete own content" on public.content
  for delete using (auth.uid() = owner_id);

create policy "Service role full access on content" on public.content
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Function: auto-create user row on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Indexes
create index content_owner_id_idx on public.content(owner_id);
create index content_slug_idx on public.content(slug);
create index users_wallet_idx on public.users(wallet_address);
