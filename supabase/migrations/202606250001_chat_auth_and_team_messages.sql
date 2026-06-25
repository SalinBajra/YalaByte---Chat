create extension if not exists pgcrypto;

create table if not exists public.chat_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null unique,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.team_chat_messages (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null default '',
  author_email text not null,
  body text not null check (char_length(trim(body)) > 0),
  created_at timestamptz not null default now()
);

alter table public.chat_profiles enable row level security;
alter table public.team_chat_messages enable row level security;

drop policy if exists "YalaByte users can read chat profiles" on public.chat_profiles;
create policy "YalaByte users can read chat profiles"
  on public.chat_profiles
  for select
  to authenticated
  using ((auth.jwt() ->> 'email') ilike '%@yalabyte.com');

drop policy if exists "YalaByte users can upsert own chat profile" on public.chat_profiles;
create policy "YalaByte users can upsert own chat profile"
  on public.chat_profiles
  for insert
  to authenticated
  with check (id = auth.uid() and email = (auth.jwt() ->> 'email') and email ilike '%@yalabyte.com');

drop policy if exists "YalaByte users can update own chat profile" on public.chat_profiles;
create policy "YalaByte users can update own chat profile"
  on public.chat_profiles
  for update
  to authenticated
  using (id = auth.uid() and (auth.jwt() ->> 'email') ilike '%@yalabyte.com')
  with check (id = auth.uid() and email = (auth.jwt() ->> 'email') and email ilike '%@yalabyte.com');

drop policy if exists "YalaByte users can read team messages" on public.team_chat_messages;
create policy "YalaByte users can read team messages"
  on public.team_chat_messages
  for select
  to authenticated
  using ((auth.jwt() ->> 'email') ilike '%@yalabyte.com');

drop policy if exists "YalaByte users can send team messages" on public.team_chat_messages;
create policy "YalaByte users can send team messages"
  on public.team_chat_messages
  for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and author_email = (auth.jwt() ->> 'email')
    and author_email ilike '%@yalabyte.com'
  );

create index if not exists team_chat_messages_created_at_idx
  on public.team_chat_messages(created_at);

do $$
begin
  alter publication supabase_realtime add table public.team_chat_messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
