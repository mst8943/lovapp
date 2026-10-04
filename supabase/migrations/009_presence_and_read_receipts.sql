-- Throttled presence and Noir-only read receipts. Premium fields are gated in SQL.

create table if not exists public.profile_presence (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profile_presence enable row level security;
revoke all on public.profile_presence from anon, authenticated;

create or replace function public.has_active_noir()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.user_entitlements where profile_id = public.current_profile_id() and noir_until > now());
$$;

create or replace function public.touch_presence()
returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare viewer uuid := public.current_profile_id(); seen timestamptz;
begin
  if viewer is null then raise exception 'profile_required'; end if;
  insert into public.profile_presence(profile_id,last_seen_at,updated_at) values(viewer,now(),now())
  on conflict(profile_id) do update set last_seen_at = now(), updated_at = now()
    where public.profile_presence.updated_at <= now() - interval '3 minutes'
  returning last_seen_at into seen;
  if seen is null then select last_seen_at into seen from public.profile_presence where profile_id = viewer; end if;
  return seen;
end;
$$;

create or replace function public.mark_match_messages_read(match_uuid uuid)
returns integer
language plpgsql security definer set search_path = '' as $$
declare viewer uuid := public.current_profile_id(); changed integer;
begin
  if viewer is null or not exists(select 1 from public.matches where id=match_uuid and status='active' and viewer in(user_a,user_b)) then
    raise exception 'active_match_required';
  end if;
  update public.messages set read_at = now() where match_id=match_uuid and sender_id<>viewer and read_at is null;
  get diagnostics changed = row_count;
  return changed;
end;
$$;

create or replace function public.get_match_presence(match_uuid uuid)
returns table(last_seen_at timestamptz, is_online boolean)
language sql stable security definer set search_path = '' as $$
  select case when public.has_active_noir() then pp.last_seen_at else null end,
         case when public.has_active_noir() then coalesce(pp.last_seen_at > now()-interval '5 minutes',false) else false end
  from public.matches ma
  left join public.profile_presence pp on pp.profile_id = case when ma.user_a=public.current_profile_id() then ma.user_b else ma.user_a end
  where ma.id=match_uuid and ma.status='active' and public.current_profile_id() in(ma.user_a,ma.user_b);
$$;

drop function if exists public.get_match_messages(uuid,integer);
create function public.get_match_messages(match_uuid uuid, message_limit integer default 80)
returns table (
  id uuid, sender_id uuid, kind public.message_kind, body text, audio_path text,
  audio_duration_ms integer, audio_waveform smallint[], read_at timestamptz, created_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select m.id,m.sender_id,m.kind,m.body,m.audio_path,m.audio_duration_ms,m.audio_waveform,
    case when public.can_review_match(match_uuid) or public.has_active_noir() then m.read_at else null end,
    m.created_at
  from public.messages m
  where m.match_id=match_uuid and (public.in_match(match_uuid) or public.can_review_match(match_uuid))
  order by m.created_at asc limit least(greatest(coalesce(message_limit,80),1),120);
$$;

revoke all on function public.has_active_noir() from public;
revoke all on function public.touch_presence() from public;
revoke all on function public.mark_match_messages_read(uuid) from public;
revoke all on function public.get_match_presence(uuid) from public;
revoke all on function public.get_match_messages(uuid,integer) from public;
grant execute on function public.has_active_noir() to authenticated;
grant execute on function public.touch_presence() to authenticated;
grant execute on function public.mark_match_messages_read(uuid) to authenticated;
grant execute on function public.get_match_presence(uuid) to authenticated;
grant execute on function public.get_match_messages(uuid,integer) to authenticated;
