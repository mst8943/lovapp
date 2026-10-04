-- One welcome gift per completed human account, plus first-party APK click counts.
alter table public.growth_rewards drop constraint if exists growth_rewards_reward_type_check;
alter table public.growth_rewards add constraint growth_rewards_reward_type_check
  check (reward_type in ('founding','referrer','referred','android_welcome'));

alter table public.growth_events drop constraint if exists growth_events_event_name_check;
alter table public.growth_events add constraint growth_events_event_name_check
  check (event_name in ('campaign_viewed','application_submitted','application_approved','invitation_sent','onboarding_completed','referral_shared','referral_activated','reward_applied','apk_download_started'));

create or replace function public.claim_android_welcome_noir()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  member_id uuid;
  was_granted boolean := false;
  access_until timestamptz;
begin
  select id into member_id from public.profiles
  where user_id = auth.uid() and kind = 'human' and onboarding_completed = true;
  if member_id is null then raise exception 'completed_profile_required'; end if;

  insert into public.growth_rewards(profile_id, reward_type, reference_key, days)
  values (member_id, 'android_welcome', 'first_android_session', 3)
  on conflict (profile_id, reward_type, reference_key) do nothing
  returning true into was_granted;

  if coalesce(was_granted, false) then
    insert into public.user_entitlements(profile_id, noir_until, source, updated_at)
    values (member_id, now() + interval '3 days', 'android_welcome', now())
    on conflict (profile_id) do update set
      noir_until = greatest(coalesce(public.user_entitlements.noir_until, now()), now()) + interval '3 days',
      source = 'android_welcome', updated_at = now()
    returning noir_until into access_until;
    insert into public.growth_events(event_name, profile_id, source, properties)
    values ('reward_applied', member_id, 'android', '{"reward":"android_welcome","days":3}'::jsonb);
  else
    select noir_until into access_until from public.user_entitlements where profile_id = member_id;
  end if;
  return jsonb_build_object('granted', coalesce(was_granted, false), 'noirUntil', access_until);
end $$;

revoke all on function public.claim_android_welcome_noir() from public, anon;
grant execute on function public.claim_android_welcome_noir() to authenticated;
