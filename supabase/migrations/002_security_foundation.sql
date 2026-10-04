-- Lovask security foundation: scoped admin roles, immutable audit records,
-- case-bound conversation access and block-aware profile visibility.

do $$ begin
  create type public.admin_role as enum ('owner', 'moderator', 'bot_editor', 'support');
exception when duplicate_object then null;
end $$;

alter table public.admin_users add column if not exists role public.admin_role;
update public.admin_users set role = 'owner' where role is null;
alter table public.admin_users alter column role set not null;
alter table public.admin_users alter column role set default 'support';

create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid not null references auth.users(id),
  action text not null check (char_length(action) between 3 and 120),
  target_type text not null check (char_length(target_type) between 2 and 80),
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_actor_timeline on public.admin_audit_log(actor_user_id, created_at desc);

create table if not exists public.conversation_access_grants (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  admin_user_id uuid not null references public.admin_users(user_id) on delete cascade,
  reason text not null check (char_length(reason) between 10 and 500),
  granted_by uuid not null references public.admin_users(user_id),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);
create index if not exists conversation_grants_active on public.conversation_access_grants(admin_user_id, match_id, expires_at) where revoked_at is null;

create or replace function public.has_admin_role(allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1 from public.admin_users
    where user_id = auth.uid() and role::text = any(allowed_roles)
  );
$$;

create or replace function public.can_review_match(match_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_admin_role(array['owner','moderator','support']) and exists(
    select 1 from public.conversation_access_grants
    where match_id = match_uuid
      and admin_user_id = auth.uid()
      and revoked_at is null
      and expires_at > now()
  );
$$;

create or replace function public.profile_is_visible(profile_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from public.profiles target
    where target.id = profile_uuid
      and (
        target.user_id = auth.uid()
        or public.is_admin()
        or (
          target.is_discoverable
          and not exists (
            select 1 from public.blocks b
            where (b.blocker_id = public.current_profile_id() and b.blocked_id = target.id)
               or (b.blocker_id = target.id and b.blocked_id = public.current_profile_id())
          )
        )
      )
  );
$$;

create or replace function public.write_admin_audit(
  event_action text,
  event_target_type text,
  event_target_id text default null,
  event_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admin_required';
  end if;
  insert into public.admin_audit_log(actor_user_id, action, target_type, target_id, metadata)
  values (auth.uid(), event_action, event_target_type, event_target_id, coalesce(event_metadata, '{}'::jsonb));
end;
$$;

alter table public.admin_audit_log enable row level security;
alter table public.conversation_access_grants enable row level security;

drop policy if exists "discoverable profiles are visible" on public.profiles;
create policy "block aware profiles are visible" on public.profiles for select to authenticated
using (public.profile_is_visible(id));

drop policy if exists "profile photos visible" on public.profile_photos;
create policy "visible profile photos" on public.profile_photos for select to authenticated
using (public.profile_is_visible(profile_id));

drop policy if exists "intentions visible" on public.profile_intentions;
create policy "visible profile intentions" on public.profile_intentions for select to authenticated
using (public.profile_is_visible(profile_id));

drop policy if exists "answers visible" on public.profile_answers;
create policy "visible profile answers" on public.profile_answers for select to authenticated
using (public.profile_is_visible(profile_id));

drop policy if exists "members see matches" on public.matches;
create policy "members or granted reviewers see matches" on public.matches for select to authenticated
using (public.current_profile_id() in (user_a, user_b) or public.can_review_match(id));

drop policy if exists "members see messages" on public.messages;
create policy "members or granted reviewers see messages" on public.messages for select to authenticated
using (public.in_match(match_id) or public.can_review_match(match_id));

drop policy if exists "admins visible to admins" on public.admin_users;
create policy "admins see self or owner sees roles" on public.admin_users for select to authenticated
using (user_id = auth.uid() or public.has_admin_role(array['owner']));

drop policy if exists "admins review reports" on public.reports;
create policy "safety roles review reports" on public.reports for select to authenticated
using (public.has_admin_role(array['owner','moderator']));

create policy "auditors read immutable audit" on public.admin_audit_log for select to authenticated
using (actor_user_id = auth.uid() or public.has_admin_role(array['owner']));

create policy "reviewers see own grants" on public.conversation_access_grants for select to authenticated
using (admin_user_id = auth.uid() or public.has_admin_role(array['owner']));

revoke update, delete on public.admin_audit_log from authenticated;
revoke all on function public.write_admin_audit(text,text,text,jsonb) from public;
grant execute on function public.write_admin_audit(text,text,text,jsonb) to authenticated;

create index if not exists profiles_discovery_index on public.profiles(kind, is_discoverable, created_at desc);
create index if not exists swipes_target_timeline on public.swipes(target_id, created_at desc);
create index if not exists matches_user_a_status on public.matches(user_a, status, matched_at desc);
create index if not exists matches_user_b_status on public.matches(user_b, status, matched_at desc);
create index if not exists blocks_blocked_lookup on public.blocks(blocked_id, blocker_id);
create index if not exists reports_status_timeline on public.reports(status, created_at desc);

create table if not exists public.user_entitlements (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  noir_until timestamptz,
  source text,
  updated_at timestamptz not null default now()
);

create table if not exists public.bot_reply_usage (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  usage_date date not null,
  reply_count integer not null default 0 check (reply_count >= 0),
  primary key(profile_id, usage_date)
);

alter table public.user_entitlements enable row level security;
alter table public.bot_reply_usage enable row level security;

create policy "users see own entitlement" on public.user_entitlements for select to authenticated
using (profile_id = public.current_profile_id() or public.has_admin_role(array['owner','support']));
create policy "users see own bot usage" on public.bot_reply_usage for select to authenticated
using (profile_id = public.current_profile_id() or public.has_admin_role(array['owner','support']));

create or replace function public.consume_bot_reply_quota(profile_uuid uuid)
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
  if profile_uuid is null or profile_uuid <> public.current_profile_id() then
    raise exception 'profile_mismatch';
  end if;

  select case when exists(
    select 1 from public.user_entitlements
    where profile_id = profile_uuid and noir_until > now()
  ) then 100 else 25 end into daily_limit;

  insert into public.bot_reply_usage(profile_id, usage_date, reply_count)
  values (profile_uuid, today_tr, 0)
  on conflict (profile_id, usage_date) do nothing;

  select reply_count into used_count
  from public.bot_reply_usage
  where profile_id = profile_uuid and usage_date = today_tr
  for update;

  if used_count >= daily_limit then
    return jsonb_build_object('allowed', false, 'remaining', 0, 'limit', daily_limit);
  end if;

  update public.bot_reply_usage
  set reply_count = reply_count + 1
  where profile_id = profile_uuid and usage_date = today_tr;

  return jsonb_build_object('allowed', true, 'remaining', daily_limit - used_count - 1, 'limit', daily_limit);
end;
$$;

revoke all on function public.consume_bot_reply_quota(uuid) from public;
grant execute on function public.consume_bot_reply_quota(uuid) to authenticated;
