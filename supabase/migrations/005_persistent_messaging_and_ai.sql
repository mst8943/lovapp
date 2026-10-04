-- Lovask persistent messaging: idempotent sends, daily limits, realtime,
-- provider runtime settings and per-conversation admin takeover.

alter table public.messages
  add column if not exists client_message_id uuid,
  add column if not exists ai_provider text,
  add column if not exists ai_model text,
  add column if not exists sent_by_admin uuid references auth.users(id);
create unique index if not exists messages_client_idempotency
  on public.messages(match_id, client_message_id) where client_message_id is not null;

create table if not exists public.message_daily_usage (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  usage_date date not null,
  sent_count integer not null default 0 check (sent_count >= 0),
  primary key(profile_id, usage_date)
);

create table if not exists public.bot_conversation_controls (
  match_id uuid primary key references public.matches(id) on delete cascade,
  mode text not null default 'ai' check (mode in ('ai','admin')),
  updated_by uuid references public.admin_users(user_id),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_runtime_settings (
  id boolean primary key default true check (id),
  default_provider text not null default 'openai' check (default_provider in ('openai','openrouter','deepseek','gemini')),
  fallback_order text[] not null default array['gemini','deepseek','openrouter'],
  openai_model text not null default 'gpt-5.6-luna',
  openrouter_model text not null default 'openai/gpt-5.6-luna',
  deepseek_model text not null default 'deepseek-chat',
  gemini_model text not null default 'gemini-3.6-flash',
  updated_by uuid references public.admin_users(user_id),
  updated_at timestamptz not null default now(),
  check (fallback_order <@ array['openai','openrouter','deepseek','gemini']::text[])
);
insert into public.ai_runtime_settings(id) values (true) on conflict (id) do nothing;

alter table public.bot_personas add column if not exists provider text not null default 'inherit'
  check (provider in ('inherit','openai','openrouter','deepseek','gemini'));

alter table public.message_daily_usage enable row level security;
alter table public.bot_conversation_controls enable row level security;
alter table public.ai_runtime_settings enable row level security;

create policy "users see own message usage" on public.message_daily_usage for select to authenticated
using (profile_id = public.current_profile_id() or public.has_admin_role(array['owner','support']));
create policy "admins see bot conversation mode" on public.bot_conversation_controls for select to authenticated
using (public.has_admin_role(array['owner','bot_editor','support']));
create policy "owners manage ai runtime settings" on public.ai_runtime_settings for all to authenticated
using (public.has_admin_role(array['owner'])) with check (public.has_admin_role(array['owner']));

create or replace function public.send_text_message(match_uuid uuid, message_body text, client_uuid uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  sender_profile uuid := public.current_profile_id();
  active_match public.matches%rowtype;
  existing_message public.messages%rowtype;
  inserted_message public.messages%rowtype;
  today_tr date := (now() at time zone 'Europe/Istanbul')::date;
  daily_limit integer;
  used_count integer;
  quest_uuid uuid;
  quest_reward integer;
  awarded_rows integer := 0;
begin
  if sender_profile is null then raise exception 'profile_required'; end if;
  if client_uuid is null then raise exception 'client_id_required'; end if;
  if char_length(btrim(message_body)) not between 1 and 1200 then raise exception 'invalid_message'; end if;

  select * into active_match from public.matches
  where id = match_uuid and status = 'active' and sender_profile in (user_a, user_b) for update;
  if not found then raise exception 'active_match_required'; end if;

  select * into existing_message from public.messages
  where match_id = match_uuid and client_message_id = client_uuid and sender_id = sender_profile;
  if found then
    return jsonb_build_object('messageId', existing_message.id, 'createdAt', existing_message.created_at, 'duplicate', true);
  end if;

  select case when exists(
    select 1 from public.user_entitlements where profile_id = sender_profile and noir_until > now()
  ) then 100 else 25 end into daily_limit;

  insert into public.message_daily_usage(profile_id, usage_date, sent_count)
  values (sender_profile, today_tr, 0) on conflict (profile_id, usage_date) do nothing;
  select sent_count into used_count from public.message_daily_usage
  where profile_id = sender_profile and usage_date = today_tr for update;
  if used_count >= daily_limit then
    return jsonb_build_object('allowed', false, 'remaining', 0, 'limit', daily_limit);
  end if;

  update public.message_daily_usage set sent_count = sent_count + 1
  where profile_id = sender_profile and usage_date = today_tr;
  insert into public.messages(match_id, sender_id, kind, body, client_message_id)
  values (match_uuid, sender_profile, 'text', btrim(message_body), client_uuid)
  returning * into inserted_message;
  update public.matches set last_message_at = inserted_message.created_at where id = match_uuid;

  select id, xp_reward into quest_uuid, quest_reward from public.daily_quests
  where slug = 'start-chat' and is_active limit 1;
  if quest_uuid is not null then
    insert into public.user_quest_progress(user_id, quest_id, quest_date, progress, completed_at, xp_claimed_at)
    values (sender_profile, quest_uuid, today_tr, 1, now(), now())
    on conflict (user_id, quest_id, quest_date) do nothing;
    get diagnostics awarded_rows = row_count;
    if awarded_rows = 1 then update public.profiles set xp = xp + quest_reward where id = sender_profile; end if;
  end if;

  return jsonb_build_object(
    'allowed', true,
    'messageId', inserted_message.id,
    'createdAt', inserted_message.created_at,
    'remaining', daily_limit - used_count - 1,
    'limit', daily_limit,
    'xpAwarded', case when awarded_rows = 1 then quest_reward else 0 end
  );
end;
$$;

create or replace function public.get_match_messages(match_uuid uuid, message_limit integer default 80)
returns table (
  id uuid,
  sender_id uuid,
  kind public.message_kind,
  body text,
  audio_path text,
  audio_duration_ms integer,
  read_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.sender_id, m.kind, m.body, m.audio_path, m.audio_duration_ms, m.read_at, m.created_at
  from public.messages m
  where m.match_id = match_uuid
    and (public.in_match(match_uuid) or public.can_review_match(match_uuid))
  order by m.created_at asc
  limit least(greatest(coalesce(message_limit, 80), 1), 120);
$$;

create or replace function public.refund_bot_reply_quota(profile_uuid uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.bot_reply_usage
  set reply_count = greatest(reply_count - 1, 0)
  where profile_id = profile_uuid
    and usage_date = (now() at time zone 'Europe/Istanbul')::date;
$$;

revoke insert, update, delete on public.messages from anon, authenticated;
revoke all on function public.send_text_message(uuid,text,uuid) from public;
revoke all on function public.get_match_messages(uuid,integer) from public;
revoke all on function public.refund_bot_reply_quota(uuid) from public;
grant execute on function public.send_text_message(uuid,text,uuid) to authenticated;
grant execute on function public.get_match_messages(uuid,integer) to authenticated;
grant execute on function public.refund_bot_reply_quota(uuid) to service_role;

do $$ begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then alter publication supabase_realtime add table public.messages; end if;
end $$;
