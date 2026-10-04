-- Premium profile visitors. One row per visitor/profile pair keeps the table
-- compact; repeat views are counted at most once every six hours.

create table if not exists public.profile_visits (
  visitor_id uuid not null references public.profiles(id) on delete cascade,
  visited_id uuid not null references public.profiles(id) on delete cascade,
  last_visited_at timestamptz not null default now(),
  visit_count integer not null default 1 check (visit_count > 0),
  primary key (visitor_id, visited_id),
  constraint profile_visits_not_self check (visitor_id <> visited_id)
);

create index if not exists profile_visits_recipient_timeline
  on public.profile_visits(visited_id, last_visited_at desc);

alter table public.profile_visits enable row level security;
revoke all on public.profile_visits from anon, authenticated;

create or replace function public.record_profile_visit(target_profile uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_profile uuid := public.current_profile_id();
begin
  if viewer_profile is null or target_profile is null or viewer_profile = target_profile then return; end if;
  if not exists (
    select 1 from public.profiles where id = target_profile
      and onboarding_completed = true and is_discoverable = true
  ) then return; end if;

  insert into public.profile_visits(visitor_id, visited_id)
  values (viewer_profile, target_profile)
  on conflict (visitor_id, visited_id) do update
    set last_visited_at = now(), visit_count = public.profile_visits.visit_count + 1
    where public.profile_visits.last_visited_at <= now() - interval '6 hours';
end;
$$;

revoke all on function public.record_profile_visit(uuid) from public;
grant execute on function public.record_profile_visit(uuid) to authenticated;

