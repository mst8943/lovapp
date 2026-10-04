-- Exact admin aggregates and idempotent anonymous Android first opens.
create table public.android_install_opens (
  installation_id uuid primary key,
  first_opened_at timestamptz not null default now()
);
create index android_install_opens_time on public.android_install_opens(first_opened_at);
alter table public.android_install_opens enable row level security;
revoke all on public.android_install_opens from anon, authenticated;

alter table public.product_funnel_events add column source text;
create index product_funnel_signup_source_time on public.product_funnel_events(source, occurred_at)
  where event_name = 'signup_completed';

create or replace function public.admin_growth_metrics(start_at timestamptz default null, end_at timestamptz default null, source_filter text default null)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'views', (select count(*) from public.growth_events e where e.event_name = 'campaign_viewed' and (start_at is null or e.occurred_at >= start_at) and (end_at is null or e.occurred_at < end_at) and (source_filter is null or coalesce(e.source, 'direct') = source_filter)),
      'applications', (select count(*) from public.membership_applications a where (start_at is null or a.created_at >= start_at) and (end_at is null or a.created_at < end_at) and (source_filter is null or coalesce(a.utm_source, case when a.referral_code_id is not null then 'referral' else 'direct' end) = source_filter)),
      'approved', (select count(*) from public.membership_applications a where a.status in ('approved','invited') and (start_at is null or a.created_at >= start_at) and (end_at is null or a.created_at < end_at) and (source_filter is null or coalesce(a.utm_source, case when a.referral_code_id is not null then 'referral' else 'direct' end) = source_filter)),
      'activated', (select count(*) from public.campaign_members m where (start_at is null or m.activated_at >= start_at) and (end_at is null or m.activated_at < end_at) and (source_filter is null or exists (select 1 from public.membership_applications a where a.id = m.application_id and coalesce(a.utm_source, case when a.referral_code_id is not null then 'referral' else 'direct' end) = source_filter))),
      'referralActivations', (select count(*) from public.referral_activations r where (start_at is null or r.activated_at >= start_at) and (end_at is null or r.activated_at < end_at) and (source_filter is null or exists (select 1 from public.membership_applications a where a.id = r.application_id and coalesce(a.utm_source, case when a.referral_code_id is not null then 'referral' else 'direct' end) = source_filter))),
      'rewardDays', (select coalesce(sum(r.days), 0) from public.growth_rewards r where (start_at is null or r.applied_at >= start_at) and (end_at is null or r.applied_at < end_at) and (source_filter is null or (r.reward_type = 'android_welcome' and source_filter = 'android') or exists (select 1 from public.referral_activations ra join public.membership_applications a on a.id = ra.application_id where ra.id::text = r.reference_key and coalesce(a.utm_source, case when a.referral_code_id is not null then 'referral' else 'direct' end) = source_filter) or exists (select 1 from public.campaign_members m join public.membership_applications a on a.id = m.application_id where r.reward_type = 'founding' and m.profile_id = r.profile_id and m.campaign_id::text = r.reference_key and coalesce(a.utm_source, case when a.referral_code_id is not null then 'referral' else 'direct' end) = source_filter))),
      'androidDownloads', (select count(*) from public.growth_events e where e.event_name = 'apk_download_started' and (start_at is null or e.occurred_at >= start_at) and (end_at is null or e.occurred_at < end_at) and (source_filter is null or coalesce(e.source, 'direct') = source_filter)),
      'androidOpens', (select count(*) from public.android_install_opens o where (start_at is null or o.first_opened_at >= start_at) and (end_at is null or o.first_opened_at < end_at) and (source_filter is null or source_filter = 'android')),
      'androidRegistrations', (select count(*) from public.product_funnel_events p where p.event_name = 'signup_completed' and p.source = 'android' and (start_at is null or p.occurred_at >= start_at) and (end_at is null or p.occurred_at < end_at) and (source_filter is null or source_filter = 'android')),
      'androidGifts', (select count(*) from public.growth_rewards r where r.reward_type = 'android_welcome' and (start_at is null or r.applied_at >= start_at) and (end_at is null or r.applied_at < end_at) and (source_filter is null or source_filter = 'android'))
    ),
    'sources', (select coalesce(jsonb_agg(row_to_json(s)), '[]'::jsonb) from (
      select coalesce(a.utm_source, case when a.referral_code_id is not null then 'referral' else 'direct' end) as source,
        count(*) as applications,
        count(*) filter (where a.status in ('approved','invited')) as approved,
        count(*) filter (where a.status = 'invited') as invited
      from public.membership_applications a
      where (start_at is null or a.created_at >= start_at) and (end_at is null or a.created_at < end_at)
        and (source_filter is null or coalesce(a.utm_source, case when a.referral_code_id is not null then 'referral' else 'direct' end) = source_filter)
      group by 1 order by applications desc
    ) s),
    'campaignCounts', (select coalesce(jsonb_object_agg(c.id, jsonb_build_object(
      'members', (select count(*) from public.campaign_members m where m.campaign_id = c.id and (start_at is null or m.activated_at >= start_at) and (end_at is null or m.activated_at < end_at) and (source_filter is null or exists (select 1 from public.membership_applications a where a.id = m.application_id and coalesce(a.utm_source, case when a.referral_code_id is not null then 'referral' else 'direct' end) = source_filter))),
      'applications', (select count(*) from public.membership_applications a where a.campaign_id = c.id and (start_at is null or a.created_at >= start_at) and (end_at is null or a.created_at < end_at) and (source_filter is null or coalesce(a.utm_source, case when a.referral_code_id is not null then 'referral' else 'direct' end) = source_filter))
    )), '{}'::jsonb) from public.growth_campaigns c),
    'codeCounts', (select coalesce(jsonb_object_agg(c.id, (select count(*) from public.referral_activations r where r.referral_code_id = c.id and (start_at is null or r.activated_at >= start_at) and (end_at is null or r.activated_at < end_at) and (source_filter is null or exists (select 1 from public.membership_applications a where a.id = r.application_id and coalesce(a.utm_source, case when a.referral_code_id is not null then 'referral' else 'direct' end) = source_filter)))), '{}'::jsonb) from public.referral_codes c)
  );
$$;
revoke all on function public.admin_growth_metrics(timestamptz,timestamptz,text) from public, anon, authenticated;
grant execute on function public.admin_growth_metrics(timestamptz,timestamptz,text) to service_role;
