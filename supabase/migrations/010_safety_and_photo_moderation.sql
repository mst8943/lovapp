-- Atomic blocking/reporting and auditable photo moderation metadata.

alter table public.reports
  add column if not exists match_id uuid references public.matches(id) on delete set null,
  add column if not exists reviewed_by uuid references auth.users(id),
  add column if not exists reviewed_at timestamptz,
  add column if not exists resolution text;
alter table public.reports drop constraint if exists reports_status_check;
alter table public.reports add constraint reports_status_check check(status in ('open','reviewing','resolved','rejected'));

alter table public.profile_photos
  add column if not exists moderation_reason text,
  add column if not exists moderated_by uuid references auth.users(id),
  add column if not exists moderated_at timestamptz;

create or replace function public.block_profile(target_profile uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare viewer uuid := public.current_profile_id();
begin
  if viewer is null then raise exception 'profile_required'; end if;
  if target_profile is null or target_profile=viewer or not exists(select 1 from public.profiles where id=target_profile) then raise exception 'invalid_target'; end if;
  insert into public.blocks(blocker_id,blocked_id) values(viewer,target_profile) on conflict do nothing;
  update public.matches set status='blocked'
    where status='active' and user_a=least(viewer,target_profile) and user_b=greatest(viewer,target_profile);
end;
$$;

create or replace function public.unblock_profile(target_profile uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.blocks where blocker_id=public.current_profile_id() and blocked_id=target_profile;
$$;

create or replace function public.submit_profile_report(target_profile uuid, report_reason text, report_details text default null, related_match uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare viewer uuid := public.current_profile_id(); report_uuid uuid;
begin
  if viewer is null then raise exception 'profile_required'; end if;
  if target_profile is null or target_profile=viewer then raise exception 'invalid_target'; end if;
  if report_reason not in ('fake_profile','harassment','inappropriate_content','fraud','underage','spam','other') then raise exception 'invalid_reason'; end if;
  if report_details is not null and char_length(btrim(report_details))>1000 then raise exception 'details_too_long'; end if;
  if related_match is not null and not exists(select 1 from public.matches where id=related_match and viewer in(user_a,user_b) and target_profile in(user_a,user_b)) then raise exception 'invalid_match'; end if;
  insert into public.reports(reporter_id,reported_id,reason,details,match_id)
  values(viewer,target_profile,report_reason,nullif(btrim(report_details),''),related_match) returning id into report_uuid;
  return report_uuid;
end;
$$;

revoke all on function public.block_profile(uuid) from public;
revoke all on function public.unblock_profile(uuid) from public;
revoke all on function public.submit_profile_report(uuid,text,text,uuid) from public;
grant execute on function public.block_profile(uuid) to authenticated;
grant execute on function public.unblock_profile(uuid) to authenticated;
grant execute on function public.submit_profile_report(uuid,text,text,uuid) to authenticated;
