-- First-party organic growth attribution, founding cohort and referral rewards.
-- Every activation path is deliberately restricted to human profiles.

create table if not exists public.growth_campaigns (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,80}$'),
  name text not null check (char_length(name) between 3 and 120),
  city text check (city is null or char_length(city) between 2 and 80),
  member_limit integer not null default 200 check (member_limit between 1 and 100000),
  founding_noir_days integer not null default 30 check (founding_noir_days between 0 and 365),
  referral_noir_days integer not null default 7 check (referral_noir_days between 0 and 90),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[A-Z0-9-]{4,32}$'),
  kind text not null default 'member' check (kind in ('member','ambassador','community','campaign')),
  label text check (label is null or char_length(label) <= 120),
  owner_profile_id uuid references public.profiles(id) on delete cascade,
  campaign_id uuid references public.growth_campaigns(id) on delete set null,
  is_active boolean not null default true,
  max_activations integer check (max_activations is null or max_activations > 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists referral_codes_code_unique on public.referral_codes (upper(code));
create unique index if not exists referral_codes_member_owner_unique on public.referral_codes (owner_profile_id) where kind = 'member';

alter table public.membership_applications
  add column if not exists campaign_id uuid references public.growth_campaigns(id) on delete set null,
  add column if not exists referral_code_id uuid references public.referral_codes(id) on delete set null,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_content text,
  add column if not exists landing_path text,
  add column if not exists initial_referrer text,
  add column if not exists privacy_notice_accepted_at timestamptz,
  add column if not exists marketing_consent_at timestamptz;

create table if not exists public.campaign_members (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.growth_campaigns(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  application_id uuid references public.membership_applications(id) on delete set null,
  position integer not null check (position > 0),
  activated_at timestamptz not null default now(),
  unique (campaign_id, profile_id),
  unique (campaign_id, position)
);

create table if not exists public.referral_activations (
  id uuid primary key default gen_random_uuid(),
  referral_code_id uuid not null references public.referral_codes(id) on delete restrict,
  campaign_id uuid references public.growth_campaigns(id) on delete set null,
  referrer_profile_id uuid not null references public.profiles(id) on delete cascade,
  referred_profile_id uuid not null references public.profiles(id) on delete cascade,
  application_id uuid references public.membership_applications(id) on delete set null,
  reward_days integer not null check (reward_days between 1 and 90),
  activated_at timestamptz not null default now(),
  unique (referred_profile_id),
  check (referrer_profile_id <> referred_profile_id)
);

create table if not exists public.growth_rewards (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  reward_type text not null check (reward_type in ('founding','referrer','referred')),
  reference_key text not null check (char_length(reference_key) between 1 and 100),
  days integer not null check (days between 1 and 365),
  applied_at timestamptz not null default now(),
  unique (profile_id, reward_type, reference_key)
);

create table if not exists public.growth_events (
  id bigint generated always as identity primary key,
  event_name text not null check (event_name in ('campaign_viewed','application_submitted','application_approved','invitation_sent','onboarding_completed','referral_shared','referral_activated','reward_applied')),
  campaign_id uuid references public.growth_campaigns(id) on delete set null,
  referral_code_id uuid references public.referral_codes(id) on delete set null,
  application_id uuid references public.membership_applications(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  source text,
  properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists growth_events_campaign_timeline on public.growth_events (campaign_id, occurred_at desc);
create index if not exists growth_events_name_timeline on public.growth_events (event_name, occurred_at desc);
create index if not exists membership_applications_campaign_queue on public.membership_applications (campaign_id, status, created_at);

alter table public.growth_campaigns enable row level security;
alter table public.referral_codes enable row level security;
alter table public.campaign_members enable row level security;
alter table public.referral_activations enable row level security;
alter table public.growth_rewards enable row level security;
alter table public.growth_events enable row level security;
revoke all on public.growth_campaigns, public.referral_codes, public.campaign_members, public.referral_activations, public.growth_rewards, public.growth_events from anon, authenticated;

create policy "members read own referral code" on public.referral_codes for select to authenticated
using (owner_profile_id = public.current_profile_id() or public.has_admin_role(array['owner','support']));
create policy "members read own campaign membership" on public.campaign_members for select to authenticated
using (profile_id = public.current_profile_id() or public.has_admin_role(array['owner','support']));
create policy "members read own referral activations" on public.referral_activations for select to authenticated
using (referrer_profile_id = public.current_profile_id() or referred_profile_id = public.current_profile_id() or public.has_admin_role(array['owner','support']));
create policy "members read own growth rewards" on public.growth_rewards for select to authenticated
using (profile_id = public.current_profile_id() or public.has_admin_role(array['owner','support']));

insert into public.growth_campaigns (slug, name, city, member_limit, founding_noir_days, referral_noir_days)
values ('istanbul-kurucu-200', 'İstanbul Kurucu 200', 'İstanbul', 200, 30, 7)
on conflict (slug) do nothing;

insert into public.referral_codes (code, kind, label, campaign_id)
select 'KURUCU200', 'campaign', 'Kurucu Üye ana kampanya kodu', id
from public.growth_campaigns where slug = 'istanbul-kurucu-200'
on conflict do nothing;

create or replace function public.process_growth_activation(profile_uuid uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  member public.profiles%rowtype;
  application public.membership_applications%rowtype;
  campaign public.growth_campaigns%rowtype;
  code public.referral_codes%rowtype;
  cohort_position integer;
  inserted_count integer;
  founding_awarded boolean := false;
  referral_awarded boolean := false;
  activation_id uuid;
begin
  select * into member from public.profiles where id = profile_uuid and kind = 'human';
  if not found or not member.onboarding_completed then raise exception 'human_onboarding_required'; end if;
  if auth.uid() is not null and auth.uid() <> member.user_id then raise exception 'profile_mismatch'; end if;

  select * into application
  from public.membership_applications
  where invited_user_id = member.user_id and status in ('approved','invited')
  order by created_at desc limit 1;

  insert into public.growth_events(event_name, application_id, profile_id, campaign_id, referral_code_id)
  values ('onboarding_completed', application.id, member.id, application.campaign_id, application.referral_code_id);

  if application.campaign_id is not null then
    select * into campaign from public.growth_campaigns
    where id = application.campaign_id and is_active and starts_at <= now() and (ends_at is null or ends_at > now())
    for update;
    if found then
      select count(*) + 1 into cohort_position from public.campaign_members where campaign_id = campaign.id;
      if cohort_position <= campaign.member_limit then
        insert into public.campaign_members(campaign_id, profile_id, application_id, position)
        values (campaign.id, member.id, application.id, cohort_position)
        on conflict do nothing;
        get diagnostics inserted_count = row_count;
        if inserted_count > 0 and campaign.founding_noir_days > 0 then
          insert into public.growth_rewards(profile_id, reward_type, reference_key, days)
          values (member.id, 'founding', campaign.id::text, campaign.founding_noir_days)
          on conflict do nothing;
          get diagnostics inserted_count = row_count;
          if inserted_count > 0 then
            insert into public.user_entitlements(profile_id, noir_until, source, updated_at)
            values (member.id, now() + make_interval(days => campaign.founding_noir_days), 'growth:founding:' || campaign.slug, now())
            on conflict (profile_id) do update set
              noir_until = greatest(coalesce(public.user_entitlements.noir_until, now()), now()) + make_interval(days => campaign.founding_noir_days),
              source = excluded.source, updated_at = now();
            founding_awarded := true;
            insert into public.growth_events(event_name, campaign_id, application_id, profile_id, properties)
            values ('reward_applied', campaign.id, application.id, member.id, jsonb_build_object('type','founding','days',campaign.founding_noir_days));
          end if;
        end if;
      end if;
    end if;
  end if;

  if application.referral_code_id is not null then
    select * into code from public.referral_codes where id = application.referral_code_id and is_active;
    if found and code.owner_profile_id is not null and code.owner_profile_id <> member.id
      and exists (select 1 from public.profiles where id = code.owner_profile_id and kind = 'human' and onboarding_completed) then
      insert into public.referral_activations(referral_code_id, campaign_id, referrer_profile_id, referred_profile_id, application_id, reward_days)
      values (code.id, application.campaign_id, code.owner_profile_id, member.id, application.id, coalesce(campaign.referral_noir_days, 7))
      on conflict do nothing returning id into activation_id;
      if activation_id is not null then
        insert into public.growth_rewards(profile_id, reward_type, reference_key, days)
        values (code.owner_profile_id, 'referrer', activation_id::text, coalesce(campaign.referral_noir_days, 7)),
               (member.id, 'referred', activation_id::text, coalesce(campaign.referral_noir_days, 7))
        on conflict do nothing;
        insert into public.user_entitlements(profile_id, noir_until, source, updated_at)
        values
          (code.owner_profile_id, now() + make_interval(days => coalesce(campaign.referral_noir_days, 7)), 'growth:referral:' || code.code, now()),
          (member.id, now() + make_interval(days => coalesce(campaign.referral_noir_days, 7)), 'growth:referred:' || code.code, now())
        on conflict (profile_id) do update set
          noir_until = greatest(coalesce(public.user_entitlements.noir_until, now()), now()) + make_interval(days => coalesce(campaign.referral_noir_days, 7)),
          source = excluded.source, updated_at = now();
        referral_awarded := true;
        insert into public.growth_events(event_name, campaign_id, referral_code_id, application_id, profile_id, properties)
        values ('referral_activated', application.campaign_id, code.id, application.id, member.id, jsonb_build_object('reward_days',coalesce(campaign.referral_noir_days, 7)));
      end if;
    end if;
  end if;

  return jsonb_build_object('foundingAwarded', founding_awarded, 'referralAwarded', referral_awarded, 'position', cohort_position);
end;
$$;

revoke all on function public.process_growth_activation(uuid) from public;
grant execute on function public.process_growth_activation(uuid) to authenticated, service_role;
