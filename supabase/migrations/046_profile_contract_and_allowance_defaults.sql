-- Keep profile vocabulary consistent at both the API and database boundary.
alter table public.profiles drop constraint if exists profiles_gender_check;
alter table public.profiles add constraint profiles_gender_check
  check (gender in ('kadın', 'erkek', 'nonbinary', 'other'));

-- SELECT INTO assigns NULL when the daily row does not exist. Read through a
-- scalar subquery so a new day starts with the full allowance instead of zero.
create or replace function public.get_like_allowance()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare viewer uuid:=public.current_profile_id(); premium boolean; used_count integer;
  today_tr date:=(now() at time zone 'Europe/Istanbul')::date; resets timestamptz;
begin
  if viewer is null then raise exception 'profile_required'; end if;
  premium:=exists(select 1 from public.user_entitlements where profile_id=viewer and noir_until>now());
  select coalesce((select like_count from public.swipe_daily_usage where profile_id=viewer and usage_date=today_tr),0) into used_count;
  resets:=((today_tr+1)::timestamp at time zone 'Europe/Istanbul');
  return jsonb_build_object('remaining',case when premium then null else greatest(10-used_count,0) end,
    'limit',case when premium then null else 10 end,'premium',premium,'resetsAt',resets);
end;
$$;

create or replace function public.get_message_allowance()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare viewer uuid:=public.current_profile_id(); premium boolean; used_messages integer; used_requests integer;
  today_tr date:=(now() at time zone 'Europe/Istanbul')::date; message_limit integer; request_limit integer;
begin
  if viewer is null then raise exception 'profile_required'; end if;
  premium:=exists(select 1 from public.user_entitlements where profile_id=viewer and noir_until>now());
  message_limit:=case when premium then 100 else 25 end; request_limit:=case when premium then 3 else 1 end;
  select coalesce((select sent_count from public.message_daily_usage where profile_id=viewer and usage_date=today_tr),0) into used_messages;
  select coalesce((select request_count from public.message_request_daily_usage where profile_id=viewer and usage_date=today_tr),0) into used_requests;
  return jsonb_build_object('remaining',greatest(message_limit-used_messages,0),'limit',message_limit,
    'requestRemaining',greatest(request_limit-used_requests,0),'requestLimit',request_limit,
    'resetsAt',((today_tr+1)::timestamp at time zone 'Europe/Istanbul'),'premium',premium);
end;
$$;

revoke all on function public.get_like_allowance() from public;
revoke all on function public.get_message_allowance() from public;
grant execute on function public.get_like_allowance() to authenticated;
grant execute on function public.get_message_allowance() to authenticated;

-- Closing a chat is cleanup and must stay idempotent after block/unmatch changes
-- the match status. Opening still requires an active match membership.
create or replace function public.touch_active_chat(match_uuid uuid, is_open boolean default true)
returns timestamptz language plpgsql security definer set search_path=public
as $$
declare viewer uuid:=public.current_profile_id(); touched timestamptz:=now();
begin
  if viewer is null then raise exception 'not_allowed'; end if;
  if not is_open then
    delete from public.active_chat_sessions where profile_id=viewer and match_id=match_uuid;
    return touched;
  end if;
  if not exists(select 1 from public.matches where id=match_uuid and status='active' and viewer in(user_a,user_b)) then
    raise exception 'not_allowed';
  end if;
  insert into public.active_chat_sessions(profile_id,match_id,last_heartbeat_at)
  values(viewer,match_uuid,touched)
  on conflict(profile_id) do update set match_id=excluded.match_id,last_heartbeat_at=excluded.last_heartbeat_at;
  return touched;
end;
$$;

revoke all on function public.touch_active_chat(uuid,boolean) from public;
grant execute on function public.touch_active_chat(uuid,boolean) to authenticated;
