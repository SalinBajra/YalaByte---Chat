create extension if not exists pgcrypto;

create table if not exists public.leads (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

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
  customer_company text not null default '',
  subject text not null default 'Website chat',
  status text not null default 'open' check (status in ('open', 'pending', 'resolved')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  assigned_to uuid references auth.users(id) on delete set null,
  assigned_to_name text not null default '',
  converted_lead_id text references public.leads(id) on delete set null,
  converted_at timestamptz,
  ended_at timestamptz,
  ended_by text not null default '' check (ended_by in ('', 'client', 'team')),
  end_reason text not null default '',
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

alter table public.website_chat_conversations
  add column if not exists customer_company text not null default '',
  add column if not exists converted_lead_id text references public.leads(id) on delete set null,
  add column if not exists converted_at timestamptz,
  add column if not exists ended_at timestamptz,
  add column if not exists ended_by text not null default '',
  add column if not exists end_reason text not null default '';

do $$
begin
  alter table public.website_chat_conversations
    add constraint website_chat_conversations_ended_by_check
    check (ended_by in ('', 'client', 'team'));
exception
  when duplicate_object then null;
end $$;

alter table public.chat_profiles enable row level security;
alter table public.team_chat_messages enable row level security;
alter table public.team_direct_messages enable row level security;
alter table public.website_chat_conversations enable row level security;
alter table public.website_chat_messages enable row level security;
alter table public.leads enable row level security;

drop policy if exists "YalaByte team can read converted leads" on public.leads;
create policy "YalaByte team can read converted leads"
  on public.leads
  for select
  to authenticated
  using ((auth.jwt() ->> 'email') ilike '%@yalabyte.com');

drop policy if exists "YalaByte team can create converted leads" on public.leads;
create policy "YalaByte team can create converted leads"
  on public.leads
  for insert
  to authenticated
  with check ((auth.jwt() ->> 'email') ilike '%@yalabyte.com');

drop policy if exists "YalaByte team can update converted leads" on public.leads;
create policy "YalaByte team can update converted leads"
  on public.leads
  for update
  to authenticated
  using ((auth.jwt() ->> 'email') ilike '%@yalabyte.com')
  with check ((auth.jwt() ->> 'email') ilike '%@yalabyte.com');

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

grant select, insert, update on public.leads to authenticated;
grant select, insert, update on public.chat_profiles to authenticated;
grant select, insert on public.team_chat_messages to authenticated;
grant select, insert on public.team_direct_messages to authenticated;
grant select, update on public.website_chat_conversations to authenticated;
grant select, insert on public.website_chat_messages to authenticated;

grant all on public.leads to service_role;
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

create or replace function public.convert_website_chat_to_lead(p_conversation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_actor_name text := coalesce(auth.jwt() ->> 'name', split_part(lower(coalesce(auth.jwt() ->> 'email', '')), '@', 1));
  v_conversation public.website_chat_conversations%rowtype;
  v_first_message text := '';
  v_transcript text := '';
  v_lead_id text;
  v_now timestamptz := now();
  v_lead jsonb;
begin
  if v_actor_email not like '%@yalabyte.com' then
    raise exception 'Only YalaByte team members can convert chats to leads.';
  end if;

  select *
    into v_conversation
    from public.website_chat_conversations
   where id = p_conversation_id
   for update;

  if not found then
    raise exception 'Website chat conversation was not found.';
  end if;

  if v_conversation.converted_lead_id is not null then
    select data into v_lead from public.leads where id = v_conversation.converted_lead_id;
    return coalesce(v_lead, jsonb_build_object('id', v_conversation.converted_lead_id));
  end if;

  select body
    into v_first_message
    from public.website_chat_messages
   where conversation_id = p_conversation_id
     and author_type = 'client'
   order by created_at asc
   limit 1;

  select coalesce(string_agg(
    concat(
      to_char(created_at, 'YYYY-MM-DD HH24:MI'),
      ' - ',
      case when author_type = 'team' then coalesce(author_name, 'YalaByte') else coalesce(author_name, 'Client') end,
      ': ',
      body
    ),
    E'\n'
    order by created_at
  ), '')
    into v_transcript
    from public.website_chat_messages
   where conversation_id = p_conversation_id;

  v_lead_id := 'lead-chat-' || substr(md5(p_conversation_id::text), 1, 32);
  v_lead := jsonb_build_object(
    'id', v_lead_id,
    'name', v_conversation.customer_name,
    'email', v_conversation.customer_email,
    'phone', v_conversation.customer_phone,
    'company', v_conversation.customer_company,
    'service', 'Website Chat',
    'message', coalesce(nullif(v_first_message, ''), v_conversation.subject),
    'status', 'new',
    'priority', initcap(v_conversation.priority),
    'owner', v_conversation.assigned_to_name,
    'value', '',
    'followUpDate', '',
    'source', 'Website Chat',
    'notes', concat('Converted from ChatByte conversation: ', p_conversation_id::text, E'\n\nTranscript:\n', v_transcript),
    'createdAt', v_now,
    'updatedAt', v_now,
    'activities', jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid()::text,
      'type', 'Created',
      'text', 'Lead converted from ChatByte website conversation.',
      'at', v_now,
      'by', v_actor_name,
      'byEmail', v_actor_email
    ))
  );

  insert into public.leads(id, data, created_at, updated_at)
  values (v_lead_id, v_lead, v_now, v_now)
  on conflict (id) do update
    set data = excluded.data,
        updated_at = excluded.updated_at;

  update public.website_chat_conversations
     set converted_lead_id = v_lead_id,
         converted_at = v_now,
         updated_at = v_now
   where id = p_conversation_id;

  return v_lead;
end;
$$;

grant execute on function public.convert_website_chat_to_lead(uuid) to authenticated;

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
