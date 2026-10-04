-- One Android welcome gift per account and per device. Existing rewards stay intact.
create table public.android_welcome_device_claims (
  device_hash text primary key check (device_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid references auth.users(id) on delete set null,
  claimed_at timestamptz not null default now()
);

alter table public.android_welcome_device_claims enable row level security;
revoke all on public.android_welcome_device_claims from public, anon, authenticated;

drop function public.claim_android_welcome_noir();

create function public.claim_android_welcome_noir_for_device(claim_user_id uuid, claim_device_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  member_id uuid;
  reserved_user_id uuid;
  was_granted boolean := false;
  access_until timestamptz;
begin
  if claim_device_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid_device_hash'; end if;

  insert into public.android_welcome_device_claims(device_hash, user_id)
  values (claim_device_hash, claim_user_id)
  on conflict do nothing;

  select user_id into reserved_user_id from public.android_welcome_device_claims
  where device_hash = claim_device_hash;
  if reserved_user_id is distinct from claim_user_id then
    return jsonb_build_object('granted', false, 'noirUntil', null);
  end if;

  select id into member_id from public.profiles
  where user_id = claim_user_id and kind = 'human' and onboarding_completed = true and deleted_at is null
  for update;
  if member_id is null then
    return jsonb_build_object('granted', false, 'noirUntil', null);
  end if;

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
  end if;

  if access_until is null then
    select noir_until into access_until from public.user_entitlements where profile_id = member_id;
  end if;
  return jsonb_build_object('granted', coalesce(was_granted, false), 'noirUntil', access_until);
end $$;

revoke all on function public.claim_android_welcome_noir_for_device(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_android_welcome_noir_for_device(uuid, text) to service_role;
