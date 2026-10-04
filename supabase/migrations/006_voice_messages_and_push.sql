-- Lovask voice messaging and cost-controlled Web Push subscriptions.

alter table public.messages
  add column if not exists audio_waveform smallint[];

alter table public.messages drop constraint if exists messages_audio_waveform_check;
alter table public.messages add constraint messages_audio_waveform_check check (
  audio_waveform is null or (
    cardinality(audio_waveform) between 8 and 48
    and 0 <= all(audio_waveform)
    and 100 >= all(audio_waveform)
  )
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) between 20 and 2048),
  p256dh text not null check (char_length(p256dh) between 20 and 512),
  auth text not null check (char_length(auth) between 8 and 256),
  user_agent text,
  failure_count integer not null default 0 check (failure_count >= 0),
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_subscriptions_profile_active
  on public.push_subscriptions(profile_id) where disabled_at is null;

create or replace function public.increment_push_failure(subscription_uuid uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.push_subscriptions
  set failure_count = failure_count + 1,
      disabled_at = case when failure_count >= 4 then now() else disabled_at end,
      updated_at = now()
  where id = subscription_uuid;
$$;

alter table public.push_subscriptions enable row level security;
create policy "users read own push subscriptions" on public.push_subscriptions for select to authenticated
using (profile_id = public.current_profile_id());
create policy "users delete own push subscriptions" on public.push_subscriptions for delete to authenticated
using (profile_id = public.current_profile_id());
revoke insert, update on public.push_subscriptions from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'voice-messages',
  'voice-messages',
  false,
  4194304,
  array['audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/x-m4a']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.send_audio_message(
  match_uuid uuid,
  message_audio_path text,
  message_duration_ms integer,
  message_waveform smallint[],
  client_uuid uuid
)
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
  if message_duration_ms not between 500 and 60000 then raise exception 'invalid_audio_duration'; end if;
  if cardinality(message_waveform) not between 8 and 48
    or not (0 <= all(message_waveform) and 100 >= all(message_waveform)) then
    raise exception 'invalid_audio_waveform';
  end if;
  if message_audio_path not like sender_profile::text || '/' || match_uuid::text || '/%' then
    raise exception 'invalid_audio_path';
  end if;

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
  insert into public.messages(match_id, sender_id, kind, audio_path, audio_duration_ms, audio_waveform, client_message_id)
  values (match_uuid, sender_profile, 'audio', message_audio_path, message_duration_ms, message_waveform, client_uuid)
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

drop function if exists public.get_match_messages(uuid,integer);
create function public.get_match_messages(match_uuid uuid, message_limit integer default 80)
returns table (
  id uuid,
  sender_id uuid,
  kind public.message_kind,
  body text,
  audio_path text,
  audio_duration_ms integer,
  audio_waveform smallint[],
  read_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.sender_id, m.kind, m.body, m.audio_path, m.audio_duration_ms,
    m.audio_waveform, m.read_at, m.created_at
  from public.messages m
  where m.match_id = match_uuid
    and (public.in_match(match_uuid) or public.can_review_match(match_uuid))
  order by m.created_at asc
  limit least(greatest(coalesce(message_limit, 80), 1), 120);
$$;

revoke all on function public.send_audio_message(uuid,text,integer,smallint[],uuid) from public;
grant execute on function public.send_audio_message(uuid,text,integer,smallint[],uuid) to authenticated;
revoke all on function public.get_match_messages(uuid,integer) from public;
grant execute on function public.get_match_messages(uuid,integer) to authenticated;
revoke all on function public.increment_push_failure(uuid) from public;
grant execute on function public.increment_push_failure(uuid) to service_role;
