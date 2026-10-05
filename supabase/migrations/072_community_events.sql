-- Curated in-person events. Only an authenticated human profile can RSVP.
create table public.community_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 4 and 100),
  description text not null check (char_length(description) between 10 and 1000),
  city text not null check (char_length(city) between 2 and 80),
  venue text not null check (char_length(venue) between 2 and 160),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null check (capacity between 2 and 500),
  status text not null default 'draft' check (status in ('draft', 'published', 'cancelled')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.community_event_rsvps (
  event_id uuid not null references public.community_events(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('going', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, profile_id)
);

create index community_events_public_list on public.community_events(starts_at) where status = 'published';
create index community_event_rsvps_count on public.community_event_rsvps(event_id) where status = 'going';

alter table public.community_events enable row level security;
alter table public.community_event_rsvps enable row level security;
create policy "scheduled events are visible" on public.community_events
  for select to authenticated using (status in ('published', 'cancelled'));
create policy "members see own event response" on public.community_event_rsvps
  for select to authenticated using (
    exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = auth.uid() and p.kind = 'human')
  );
revoke insert, update, delete on public.community_events from anon, authenticated;
revoke insert, update, delete on public.community_event_rsvps from anon, authenticated;

create or replace function public.respond_to_community_event(event_uuid uuid, attend boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  selected_event public.community_events%rowtype;
  member_id uuid;
  attendee_count integer;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select id into member_id from public.profiles
    where user_id = auth.uid() and kind = 'human' and deleted_at is null and onboarding_completed = true;
  if member_id is null then raise exception 'profile_required'; end if;
  select * into selected_event from public.community_events where id = event_uuid for update;
  if not found then raise exception 'event_unavailable'; end if;
  if attend then
    if selected_event.status <> 'published' or selected_event.starts_at <= now() then
      raise exception 'event_unavailable';
    end if;
    if not exists (select 1 from public.community_event_rsvps where event_id = event_uuid and profile_id = member_id and status = 'going') then
      select count(*) into attendee_count from public.community_event_rsvps where event_id = event_uuid and status = 'going';
      if attendee_count >= selected_event.capacity then raise exception 'event_full'; end if;
    end if;
  end if;
  insert into public.community_event_rsvps(event_id, profile_id, status, updated_at)
  values (event_uuid, member_id, case when attend then 'going' else 'cancelled' end, now())
  on conflict (event_id, profile_id) do update set status = excluded.status, updated_at = now();
end;
$$;
revoke all on function public.respond_to_community_event(uuid, boolean) from public, anon;
grant execute on function public.respond_to_community_event(uuid, boolean) to authenticated;
