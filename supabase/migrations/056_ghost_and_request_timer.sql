alter table public.profiles add column if not exists ghost_enabled boolean not null default false;

create or replace function public.ghost_allows(viewer_uuid uuid,target_uuid uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(
    select 1 from public.profiles target where target.id=target_uuid and (
      target.kind='bot' or not target.ghost_enabled
      or not exists(select 1 from public.user_entitlements e where e.profile_id=target.id and e.noir_until>now())
      or viewer_uuid=target.id
      or exists(select 1 from public.swipes s where s.swiper_id=target.id and s.target_id=viewer_uuid and s.direction in ('right','super') and s.created_at>now()-interval '30 days')
      or exists(select 1 from public.matches m where m.status='active' and m.connection_type in ('matched','direct_chat') and m.user_a=least(viewer_uuid,target.id) and m.user_b=greatest(viewer_uuid,target.id))
    )
  );
$$;
revoke all on function public.ghost_allows(uuid,uuid) from public;
grant execute on function public.ghost_allows(uuid,uuid) to authenticated;

create or replace function public.profile_is_visible(profile_uuid uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(select 1 from public.profiles target where target.id=profile_uuid and (
    target.user_id=auth.uid() or public.has_admin_role(array['owner','moderator','support'])
    or (target.is_discoverable and public.ghost_allows(public.current_profile_id(),target.id)
      and not exists(select 1 from public.blocks b where
        (b.blocker_id=public.current_profile_id() and b.blocked_id=target.id)
        or (b.blocker_id=target.id and b.blocked_id=public.current_profile_id())))
  ));
$$;

create or replace function public.mutually_eligible(viewer_uuid uuid,target_uuid uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(
    select 1 from public.profiles viewer
    join public.profiles target on target.id=target_uuid
    left join public.discovery_preferences vp on vp.profile_id=viewer.id
    left join public.discovery_preferences tp on tp.profile_id=target.id
    where viewer.id=viewer_uuid and viewer.kind='human' and target.kind in ('human','bot')
      and viewer.onboarding_completed and target.onboarding_completed
      and viewer.deleted_at is null and target.deleted_at is null
      and viewer.safety_restricted_at is null and target.safety_restricted_at is null
      and target.is_discoverable and public.ghost_allows(viewer.id,target.id)
      and not exists(select 1 from public.blocks b where
        (b.blocker_id=viewer.id and b.blocked_id=target.id) or (b.blocker_id=target.id and b.blocked_id=viewer.id))
      and (target.kind='bot' or (
        viewer.gender=any(coalesce(tp.interested_genders,array['kadın','erkek','nonbinary','other']::text[]))
        and target.gender=any(coalesce(vp.interested_genders,array['kadın','erkek','nonbinary','other']::text[]))
        and extract(year from age(current_date,viewer.birth_date))::integer between coalesce(tp.min_age,18) and coalesce(tp.max_age,99)
        and extract(year from age(current_date,target.birth_date))::integer between coalesce(vp.min_age,18) and coalesce(vp.max_age,99)
      ))
  );
$$;

create or replace function public.limit_message_request_expiry()
returns trigger language plpgsql set search_path=''
as $$
begin
  if new.connection_type='message_request' and new.request_status='pending'
    and (new.request_expires_at is null or new.request_expires_at>now()+interval '24 hours') then
    new.request_expires_at:=now()+interval '24 hours';
  end if;
  return new;
end;
$$;
drop trigger if exists limit_message_request_expiry on public.matches;
create trigger limit_message_request_expiry before insert or update of connection_type,request_status,request_expires_at on public.matches
for each row execute function public.limit_message_request_expiry();
update public.matches set request_expires_at=least(request_expires_at,now()+interval '24 hours')
where connection_type='message_request' and request_status='pending' and request_expires_at>now()+interval '24 hours';
create index if not exists matches_pending_request_expiry_idx on public.matches(request_expires_at)
where status='active' and connection_type='message_request' and request_status='pending';

create or replace function public.expire_pending_message_requests()
returns integer language plpgsql security definer set search_path=''
as $$
declare affected integer;
begin
  update public.matches set status='unmatched',request_status='expired',closed_at=now()
  where status='active' and connection_type='message_request' and request_status='pending' and request_expires_at<=now();
  get diagnostics affected=row_count;
  return affected;
end;
$$;
revoke all on function public.expire_pending_message_requests() from public;
grant execute on function public.expire_pending_message_requests() to service_role;

create table if not exists public.wingman_daily_usage (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  usage_date date not null,
  request_count integer not null default 0 check(request_count between 0 and 3),
  primary key(profile_id,usage_date)
);
alter table public.wingman_daily_usage enable row level security;
revoke all on public.wingman_daily_usage from anon,authenticated;
create or replace function public.reserve_wingman_request()
returns boolean language plpgsql security definer set search_path=''
as $$
declare viewer uuid:=public.current_profile_id(); today_tr date:=(now() at time zone 'Europe/Istanbul')::date;
  used integer;
begin
  if viewer is null then return false; end if;
  insert into public.wingman_daily_usage(profile_id,usage_date,request_count) values(viewer,today_tr,1)
    on conflict(profile_id,usage_date) do update set request_count=public.wingman_daily_usage.request_count+1
    where public.wingman_daily_usage.request_count<3
    returning request_count into used;
  return used is not null;
end;
$$;
revoke all on function public.reserve_wingman_request() from public;
grant execute on function public.reserve_wingman_request() to authenticated;
