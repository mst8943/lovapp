-- Keep the API contract boolean when a member has no Noir entitlement.
create or replace function public.profile_boost_status()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare viewer public.profiles%rowtype; boost public.profile_boosts%rowtype; noir_until timestamptz; eligible boolean;
begin
  select * into viewer from public.profiles where id=public.current_profile_id() and kind='human';
  if not found then raise exception 'profile_required'; end if;
  select max(e.noir_until) into noir_until from public.user_entitlements e where e.profile_id=viewer.id;
  select * into boost from public.profile_boosts where profile_id=viewer.id;
  eligible:=viewer.onboarding_completed and viewer.is_discoverable and not viewer.ghost_enabled
    and viewer.deleted_at is null and viewer.safety_restricted_at is null
    and exists(select 1 from public.profile_photos p where p.profile_id=viewer.id and p.processing_status='ready' and p.moderation_status='approved');
  return jsonb_build_object(
    'activeUntil',case when boost.expires_at>now() then boost.expires_at else null end,
    'nextAvailableAt',case when boost.started_at+interval '7 days'>now() then boost.started_at+interval '7 days' else null end,
    'noirUntil',noir_until,
    'eligible',coalesce(eligible,false),
    'canActivate',coalesce(eligible and noir_until>=now()+interval '30 minutes' and (boost.started_at is null or boost.started_at+interval '7 days'<=now()),false)
  );
end;
$$;
