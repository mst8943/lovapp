-- Independent rollout controls and active-chat push suppression.

alter table public.bot_automation_settings
  add column if not exists phase1_timing_enabled boolean not null default true,
  add column if not exists phase2_behavior_enabled boolean not null default true,
  add column if not exists phase3_safety_enabled boolean not null default true;

create table if not exists public.active_chat_sessions (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  last_heartbeat_at timestamptz not null default now()
);
create index if not exists active_chat_sessions_match_heartbeat
  on public.active_chat_sessions(match_id,last_heartbeat_at);

alter table public.active_chat_sessions enable row level security;
revoke all on public.active_chat_sessions from anon, authenticated;

create or replace function public.touch_active_chat(match_uuid uuid, is_open boolean default true)
returns timestamptz
language plpgsql
security definer
set search_path=public
as $$
declare
  viewer uuid := public.current_profile_id();
  touched timestamptz := now();
begin
  if viewer is null or not exists (
    select 1 from public.matches
    where id=match_uuid and status='active' and viewer in (user_a,user_b)
  ) then
    raise exception 'not_allowed';
  end if;
  if is_open then
    insert into public.active_chat_sessions(profile_id,match_id,last_heartbeat_at)
    values(viewer,match_uuid,touched)
    on conflict(profile_id) do update set match_id=excluded.match_id,last_heartbeat_at=excluded.last_heartbeat_at;
  else
    delete from public.active_chat_sessions where profile_id=viewer and match_id=match_uuid;
  end if;
  return touched;
end;
$$;

revoke all on function public.touch_active_chat(uuid,boolean) from public;
grant execute on function public.touch_active_chat(uuid,boolean) to authenticated;
