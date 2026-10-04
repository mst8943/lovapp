-- Phase 2: proactive behavior, scoped memory, relationship state and voice transcripts.

alter table public.bot_automation_settings
  add column if not exists first_message_enabled boolean not null default true,
  add column if not exists first_message_min_seconds integer not null default 120 check (first_message_min_seconds between 15 and 86400),
  add column if not exists first_message_max_seconds integer not null default 900 check (first_message_max_seconds between 15 and 172800),
  add column if not exists follow_up_enabled boolean not null default true,
  add column if not exists follow_up_min_seconds integer not null default 43200 check (follow_up_min_seconds between 3600 and 604800),
  add column if not exists follow_up_max_seconds integer not null default 129600 check (follow_up_max_seconds between 3600 and 1209600),
  add column if not exists memory_enabled boolean not null default true,
  add column if not exists daily_state_enabled boolean not null default true;

alter table public.bot_automation_overrides
  add column if not exists first_message_enabled boolean,
  add column if not exists first_message_min_seconds integer check (first_message_min_seconds between 15 and 86400),
  add column if not exists first_message_max_seconds integer check (first_message_max_seconds between 15 and 172800),
  add column if not exists follow_up_enabled boolean,
  add column if not exists follow_up_min_seconds integer check (follow_up_min_seconds between 3600 and 604800),
  add column if not exists follow_up_max_seconds integer check (follow_up_max_seconds between 3600 and 1209600),
  add column if not exists memory_enabled boolean,
  add column if not exists daily_state_enabled boolean;

alter table public.messages
  add column if not exists transcript text,
  add column if not exists transcription_status text check (transcription_status in ('pending','ready','failed'));

create table if not exists public.bot_conversation_memory (
  match_id uuid primary key references public.matches(id) on delete cascade,
  bot_profile_id uuid not null references public.profiles(id) on delete cascade,
  member_profile_id uuid not null references public.profiles(id) on delete cascade,
  summary text not null default '',
  facts jsonb not null default '[]'::jsonb,
  last_message_id uuid references public.messages(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.bot_relationship_state (
  match_id uuid primary key references public.matches(id) on delete cascade,
  stage text not null default 'new_match' check (stage in ('new_match','getting_to_know','comfortable','closer','distant','reconnecting')),
  score integer not null default 0 check (score between -100 and 100),
  admin_override boolean not null default false,
  updated_by uuid references public.admin_users(user_id),
  updated_at timestamptz not null default now()
);

create table if not exists public.bot_daily_states (
  bot_profile_id uuid not null references public.profiles(id) on delete cascade,
  state_date date not null,
  energy text not null check (energy in ('low','normal','high')),
  availability text not null check (availability in ('busy','relaxed','brief')),
  mood text not null check (mood in ('cheerful','calm','thoughtful','stressed')),
  context text not null check (char_length(context) between 1 and 240),
  generated_automatically boolean not null default true,
  updated_by uuid references public.admin_users(user_id),
  updated_at timestamptz not null default now(),
  primary key(bot_profile_id,state_date)
);

alter table public.bot_conversation_memory enable row level security;
alter table public.bot_relationship_state enable row level security;
alter table public.bot_daily_states enable row level security;
create policy "admins inspect bot conversation memory" on public.bot_conversation_memory for select to authenticated
using (public.has_admin_role(array['owner','bot_editor','support']));
create policy "admins manage relationship state" on public.bot_relationship_state for all to authenticated
using (public.has_admin_role(array['owner','bot_editor','support'])) with check (public.has_admin_role(array['owner','bot_editor','support']));
create policy "bot editors manage daily states" on public.bot_daily_states for all to authenticated
using (public.has_admin_role(array['owner','bot_editor'])) with check (public.has_admin_role(array['owner','bot_editor']));

revoke all on public.bot_conversation_memory from anon, authenticated;
revoke all on public.bot_daily_states from anon;
