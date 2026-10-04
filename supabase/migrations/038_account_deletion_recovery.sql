-- A reversible 30-day account deletion window. Authentication is kept until
-- the cleanup worker completes the request so the owner can sign in and undo it.

create table if not exists public.account_deletion_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  requested_at timestamptz not null default now(),
  scheduled_for timestamptz not null default (now() + interval '30 days'),
  cancelled_at timestamptz,
  completed_at timestamptz,
  attempt_count integer not null default 0,
  last_error text,
  updated_at timestamptz not null default now()
);

create index if not exists account_deletion_requests_due
  on public.account_deletion_requests(scheduled_for)
  where cancelled_at is null and completed_at is null;

alter table public.account_deletion_requests enable row level security;
revoke all on public.account_deletion_requests from anon, authenticated;

create or replace function public.schedule_account_deletion()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  owner_profile uuid;
  deadline timestamptz := now() + interval '30 days';
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  select id into owner_profile from public.profiles
    where user_id=owner_id and kind='human' for update;
  if owner_profile is null then raise exception 'profile_not_found'; end if;

  insert into public.account_deletion_requests(user_id,profile_id,requested_at,scheduled_for,cancelled_at,completed_at,attempt_count,last_error,updated_at)
  values(owner_id,owner_profile,now(),deadline,null,null,0,null,now())
  on conflict(user_id) do update set
    profile_id=excluded.profile_id,requested_at=excluded.requested_at,
    scheduled_for=excluded.scheduled_for,cancelled_at=null,completed_at=null,
    attempt_count=0,last_error=null,updated_at=now();

  update public.profiles set is_discoverable=false,deleted_at=now(),updated_at=now()
    where id=owner_profile;
  return deadline;
end;
$$;

create or replace function public.cancel_account_deletion()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  owner_profile uuid;
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  select profile_id into owner_profile from public.account_deletion_requests
    where user_id=owner_id and cancelled_at is null and completed_at is null and scheduled_for>now()
    for update;
  if owner_profile is null then return false; end if;

  update public.account_deletion_requests set cancelled_at=now(),updated_at=now()
    where user_id=owner_id;
  update public.profiles set deleted_at=null,is_discoverable=false,updated_at=now()
    where id=owner_profile;
  return true;
end;
$$;

revoke all on function public.schedule_account_deletion() from public;
revoke all on function public.cancel_account_deletion() from public;
grant execute on function public.schedule_account_deletion() to authenticated;
grant execute on function public.cancel_account_deletion() to authenticated;
