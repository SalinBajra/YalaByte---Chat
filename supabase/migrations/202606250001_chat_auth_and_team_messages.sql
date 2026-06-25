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

create table if not exists public.team_direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_name text not null default '',
  sender_email text not null,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  recipient_name text not null default '',
  recipient_email text not null,
  body text not null check (char_length(trim(body)) > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.website_chat_conversations (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null default '',
  subject text not null default 'Website chat',
  status text not null default 'open' check (status in ('open', 'pending', 'resolved')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  assigned_to uuid references auth.users(id) on delete set null,
  assigned_to_name text not null default '',
  source_path text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);

create table if not exists public.website_chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.website_chat_conversations(id) on delete cascade,
  author_type text not null check (author_type in ('client', 'team')),
  author_id uuid references auth.users(id) on delete set null,
  author_name text not null,
  author_email text not null default '',
  body text not null check (char_length(trim(body)) > 0),
  created_at timestamptz not null default now()
);

alter table public.chat_profiles enable row level security;
alter table public.team_chat_messages enable row level security;
alter table public.team_direct_messages enable row level security;
alter table public.website_chat_conversations enable row level security;
alter table public.website_chat_messages enable row level security;

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

drop policy if exists "YalaByte users can read own direct messages" on public.team_direct_messages;
create policy "YalaByte users can read own direct messages"
  on public.team_direct_messages
  for select
  to authenticated
  using (
    (auth.jwt() ->> 'email') ilike '%@yalabyte.com'
    and (sender_id = auth.uid() or recipient_id = auth.uid())
  );

drop policy if exists "YalaByte users can send direct messages" on public.team_direct_messages;
create policy "YalaByte users can send direct messages"
  on public.team_direct_messages
  for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and sender_email = (auth.jwt() ->> 'email')
    and sender_email ilike '%@yalabyte.com'
  );

drop policy if exists "YalaByte users can read website chat conversations" on public.website_chat_conversations;
create policy "YalaByte users can read website chat conversations"
  on public.website_chat_conversations
  for select
  to authenticated
  using ((auth.jwt() ->> 'email') ilike '%@yalabyte.com');

drop policy if exists "YalaByte users can update website chat conversations" on public.website_chat_conversations;
create policy "YalaByte users can update website chat conversations"
  on public.website_chat_conversations
  for update
  to authenticated
  using ((auth.jwt() ->> 'email') ilike '%@yalabyte.com')
  with check ((auth.jwt() ->> 'email') ilike '%@yalabyte.com');

drop policy if exists "YalaByte users can read website chat messages" on public.website_chat_messages;
create policy "YalaByte users can read website chat messages"
  on public.website_chat_messages
  for select
  to authenticated
  using ((auth.jwt() ->> 'email') ilike '%@yalabyte.com');

drop policy if exists "YalaByte users can reply to website chat messages" on public.website_chat_messages;
create policy "YalaByte users can reply to website chat messages"
  on public.website_chat_messages
  for insert
  to authenticated
  with check (
    author_type = 'team'
    and author_id = auth.uid()
    and author_email = (auth.jwt() ->> 'email')
    and author_email ilike '%@yalabyte.com'
  );

grant usage on schema public to authenticated, service_role;

grant select, insert, update on public.chat_profiles to authenticated;
grant select, insert on public.team_chat_messages to authenticated;
grant select, insert on public.team_direct_messages to authenticated;
grant select, update on public.website_chat_conversations to authenticated;
grant select, insert on public.website_chat_messages to authenticated;

grant all on public.chat_profiles to service_role;
grant all on public.team_chat_messages to service_role;
grant all on public.team_direct_messages to service_role;
grant all on public.website_chat_conversations to service_role;
grant all on public.website_chat_messages to service_role;

create index if not exists team_chat_messages_created_at_idx
  on public.team_chat_messages(created_at);

create index if not exists team_direct_messages_participants_created_idx
  on public.team_direct_messages(sender_id, recipient_id, created_at);

create index if not exists website_chat_conversations_last_activity_idx
  on public.website_chat_conversations(last_activity_at desc);

create index if not exists website_chat_messages_conversation_created_idx
  on public.website_chat_messages(conversation_id, created_at);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'public.team_chat_messages',
    'public.chat_profiles',
    'public.team_direct_messages',
    'public.website_chat_conversations',
    'public.website_chat_messages'
  ]
  loop
    begin
      execute format('alter publication supabase_realtime add table %s', table_name);
    exception
      when duplicate_object then null;
      when undefined_object then null;
    end;
  end loop;
exception
  when undefined_object then null;
end $$;
