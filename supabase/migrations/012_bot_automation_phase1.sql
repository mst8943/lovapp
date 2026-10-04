-- Durable bot automation: global/per-bot timing, active schedules and reply jobs.

create table if not exists public.bot_automation_settings (
  id boolean primary key default true check (id),
  automation_enabled boolean not null default true,
  min_reply_delay_seconds integer not null default 20 check (min_reply_delay_seconds between 3 and 3600),
  max_reply_delay_seconds integer not null default 90 check (max_reply_delay_seconds between 3 and 7200),
  typing_min_seconds integer not null default 3 check (typing_min_seconds between 1 and 60),
  typing_max_seconds integer not null default 12 check (typing_max_seconds between 1 and 120),
  bundle_window_seconds integer not null default 12 check (bundle_window_seconds between 1 and 60),
  bundle_max_seconds integer not null default 45 check (bundle_max_seconds between 5 and 180),
  timezone text not null default 'Europe/Istanbul',
  weekly_schedule jsonb not null default '{"0":[["10:00","23:30"]],"1":[["09:00","23:30"]],"2":[["09:00","23:30"]],"3":[["09:00","23:30"]],"4":[["09:00","23:30"]],"5":[["09:00","23:59"]],"6":[["10:00","23:59"]]}'::jsonb,
  updated_by uuid references public.admin_users(user_id),
  updated_at timestamptz not null default now(),
  check (min_reply_delay_seconds <= max_reply_delay_seconds),
  check (typing_min_seconds <= typing_max_seconds),
  check (bundle_window_seconds <= bundle_max_seconds)
);
insert into public.bot_automation_settings(id) values (true) on conflict (id) do nothing;

create table if not exists public.bot_automation_overrides (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  automation_enabled boolean,
  min_reply_delay_seconds integer check (min_reply_delay_seconds between 3 and 3600),
  max_reply_delay_seconds integer check (max_reply_delay_seconds between 3 and 7200),
  typing_min_seconds integer check (typing_min_seconds between 1 and 60),
  typing_max_seconds integer check (typing_max_seconds between 1 and 120),
  bundle_window_seconds integer check (bundle_window_seconds between 1 and 60),
  bundle_max_seconds integer check (bundle_max_seconds between 5 and 180),
  timezone text,
  weekly_schedule jsonb,
  presence_override text not null default 'auto' check (presence_override in ('auto','online','offline')),
  updated_by uuid references public.admin_users(user_id),
  updated_at timestamptz not null default now(),
  check (min_reply_delay_seconds is null or max_reply_delay_seconds is null or min_reply_delay_seconds <= max_reply_delay_seconds),
  check (typing_min_seconds is null or typing_max_seconds is null or typing_min_seconds <= typing_max_seconds),
  check (bundle_window_seconds is null or bundle_max_seconds is null or bundle_window_seconds <= bundle_max_seconds)
);

create table if not exists public.bot_reply_jobs (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  bot_profile_id uuid not null references public.profiles(id) on delete cascade,
  member_profile_id uuid not null references public.profiles(id) on delete cascade,
  source_message_id uuid references public.messages(id) on delete set null,
  job_type text not null default 'reply' check (job_type in ('reply','first_message','follow_up')),
  status text not null default 'queued' check (status in ('queued','typing','processing','sent','cancelled','failed')),
  scheduled_for timestamptz not null,
  typing_at timestamptz not null,
  first_input_at timestamptz not null default now(),
  last_input_at timestamptz not null default now(),
  attempt_count integer not null default 0 check (attempt_count between 0 and 10),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  locked_at timestamptz,
  completed_at timestamptz,
  cancellation_reason text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists bot_reply_jobs_one_active_per_match
  on public.bot_reply_jobs(match_id)
  where status in ('queued','typing','processing');
create index if not exists bot_reply_jobs_due
  on public.bot_reply_jobs(status, scheduled_for)
  where status in ('queued','typing');

alter table public.bot_automation_settings enable row level security;
alter table public.bot_automation_overrides enable row level security;
alter table public.bot_reply_jobs enable row level security;

create policy "owners manage global bot automation" on public.bot_automation_settings for all to authenticated
using (public.has_admin_role(array['owner'])) with check (public.has_admin_role(array['owner']));
create policy "bot editors manage bot automation overrides" on public.bot_automation_overrides for all to authenticated
using (public.has_admin_role(array['owner','bot_editor'])) with check (public.has_admin_role(array['owner','bot_editor']));
create policy "admins inspect bot reply jobs" on public.bot_reply_jobs for select to authenticated
using (public.has_admin_role(array['owner','bot_editor','support']));

create or replace function public.consume_bot_reply_quota_service(profile_uuid uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  today_tr date := (now() at time zone 'Europe/Istanbul')::date;
  used_count integer;
  daily_limit integer;
begin
  if auth.role() <> 'service_role' then raise exception 'service_role_required'; end if;
  if not exists(select 1 from public.profiles where id = profile_uuid and kind = 'human') then
    raise exception 'human_profile_required';
  end if;
  select case when exists(
    select 1 from public.user_entitlements where profile_id = profile_uuid and noir_until > now()
  ) then 100 else 25 end into daily_limit;
  insert into public.bot_reply_usage(profile_id, usage_date, reply_count)
  values (profile_uuid, today_tr, 0) on conflict (profile_id, usage_date) do nothing;
  select reply_count into used_count from public.bot_reply_usage
  where profile_id = profile_uuid and usage_date = today_tr for update;
  if used_count >= daily_limit then
    return jsonb_build_object('allowed', false, 'remaining', 0, 'limit', daily_limit);
  end if;
  update public.bot_reply_usage set reply_count = reply_count + 1
  where profile_id = profile_uuid and usage_date = today_tr;
  return jsonb_build_object('allowed', true, 'remaining', daily_limit-used_count-1, 'limit', daily_limit);
end;
$$;

revoke all on public.bot_automation_settings from anon;
revoke all on public.bot_automation_overrides from anon;
revoke all on public.bot_reply_jobs from anon, authenticated;
revoke all on function public.consume_bot_reply_quota_service(uuid) from public;
grant execute on function public.consume_bot_reply_quota_service(uuid) to service_role;

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='bot_reply_jobs'
  ) then alter publication supabase_realtime add table public.bot_reply_jobs; end if;
end $$;
