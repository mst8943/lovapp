-- Lovask fresh-install bundle. Run once on an empty Supabase project.

-- ===== 001_initial.sql =====
-- Lovask core schema (Supabase/PostgreSQL)
create extension if not exists pgcrypto;

create type public.profile_kind as enum ('human', 'bot');
create type public.swipe_direction as enum ('left', 'right', 'super');
create type public.message_kind as enum ('text', 'audio');
create type public.match_status as enum ('active', 'unmatched', 'blocked');

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  kind public.profile_kind not null default 'human',
  display_name text not null check (char_length(display_name) between 1 and 60),
  birth_date date not null,
  gender text not null,
  bio text,
  city text,
  xp integer not null default 0 check (xp >= 0),
  level integer generated always as (greatest(1, floor(sqrt(xp / 100.0))::integer + 1)) stored,
  is_verified boolean not null default false,
  is_discoverable boolean not null default true,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint adults_only check (birth_date <= current_date - interval '18 years'),
  constraint profile_identity check ((kind = 'human' and user_id is not null) or (kind = 'bot' and user_id is null))
);

create table public.profile_photos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  sort_order smallint not null default 0 check (sort_order between 0 and 8),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique(profile_id, sort_order)
);
create unique index one_primary_photo on public.profile_photos(profile_id) where is_primary;

create table public.intent_badges (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  label text unique not null,
  is_active boolean not null default true
);
create table public.profile_intentions (
  profile_id uuid references public.profiles(id) on delete cascade,
  badge_id uuid references public.intent_badges(id) on delete cascade,
  primary key(profile_id, badge_id)
);

create table public.icebreaker_prompts (
  id uuid primary key default gen_random_uuid(),
  prompt text unique not null,
  is_active boolean not null default true
);
create table public.profile_answers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  prompt_id uuid not null references public.icebreaker_prompts(id),
  answer text not null check (char_length(answer) between 1 and 240),
  sort_order smallint not null default 0,
  unique(profile_id, prompt_id)
);

create table public.bot_personas (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  persona text not null check (char_length(persona) between 20 and 8000),
  model text not null default 'gpt-5.6-luna',
  temperature numeric(3,2),
  greeting text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table public.swipes (
  id bigint generated always as identity primary key,
  swiper_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.profiles(id) on delete cascade,
  direction public.swipe_direction not null,
  created_at timestamptz not null default now(),
  unique(swiper_id, target_id),
  check(swiper_id <> target_id)
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  status public.match_status not null default 'active',
  matched_at timestamptz not null default now(),
  last_message_at timestamptz,
  check(user_a < user_b),
  unique(user_a, user_b)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  kind public.message_kind not null default 'text',
  body text,
  audio_path text,
  audio_duration_ms integer check(audio_duration_ms between 0 and 600000),
  ai_response_id text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check ((kind = 'text' and body is not null) or (kind = 'audio' and audio_path is not null))
);
create index messages_match_timeline on public.messages(match_id, created_at desc);

create table public.daily_quests (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  event_name text not null,
  target_count integer not null check(target_count > 0),
  xp_reward integer not null check(xp_reward > 0),
  is_active boolean not null default true
);
create table public.user_quest_progress (
  user_id uuid references public.profiles(id) on delete cascade,
  quest_id uuid references public.daily_quests(id) on delete cascade,
  quest_date date not null default current_date,
  progress integer not null default 0 check(progress >= 0),
  completed_at timestamptz,
  xp_claimed_at timestamptz,
  primary key(user_id, quest_id, quest_date)
);

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table public.blocks (
  blocker_id uuid references public.profiles(id) on delete cascade,
  blocked_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(blocker_id, blocked_id),
  check(blocker_id <> blocked_id)
);
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id),
  reported_id uuid not null references public.profiles(id),
  reason text not null,
  details text,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.admin_users where user_id = auth.uid());
$$;
create or replace function public.current_profile_id() returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.profiles where user_id = auth.uid() limit 1;
$$;
create or replace function public.in_match(match_uuid uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.matches where id = match_uuid and public.current_profile_id() in (user_a, user_b));
$$;

alter table public.profiles enable row level security;
alter table public.profile_photos enable row level security;
alter table public.profile_intentions enable row level security;
alter table public.profile_answers enable row level security;
alter table public.bot_personas enable row level security;
alter table public.swipes enable row level security;
alter table public.matches enable row level security;
alter table public.messages enable row level security;
alter table public.user_quest_progress enable row level security;
alter table public.admin_users enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;

create policy "discoverable profiles are visible" on public.profiles for select to authenticated using (is_discoverable or user_id = auth.uid() or public.is_admin());
create policy "users edit own profile" on public.profiles for all to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy "profile photos visible" on public.profile_photos for select to authenticated using (true);
create policy "owners manage photos" on public.profile_photos for all to authenticated using (profile_id = public.current_profile_id() or public.is_admin()) with check (profile_id = public.current_profile_id() or public.is_admin());
create policy "intentions visible" on public.profile_intentions for select to authenticated using (true);
create policy "owners manage intentions" on public.profile_intentions for all to authenticated using (profile_id = public.current_profile_id() or public.is_admin()) with check (profile_id = public.current_profile_id() or public.is_admin());
create policy "answers visible" on public.profile_answers for select to authenticated using (true);
create policy "owners manage answers" on public.profile_answers for all to authenticated using (profile_id = public.current_profile_id() or public.is_admin()) with check (profile_id = public.current_profile_id() or public.is_admin());
create policy "admins manage personas" on public.bot_personas for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "users manage own swipes" on public.swipes for all to authenticated using (swiper_id = public.current_profile_id() or public.is_admin()) with check (swiper_id = public.current_profile_id() or public.is_admin());
create policy "members see matches" on public.matches for select to authenticated using (public.current_profile_id() in (user_a,user_b) or public.is_admin());
create policy "members see messages" on public.messages for select to authenticated using (public.in_match(match_id) or public.is_admin());
create policy "members send messages" on public.messages for insert to authenticated with check (sender_id = public.current_profile_id() and public.in_match(match_id));
create policy "users see quest progress" on public.user_quest_progress for select to authenticated using (user_id = public.current_profile_id() or public.is_admin());
create policy "users create quest progress" on public.user_quest_progress for insert to authenticated with check (user_id = public.current_profile_id());
create policy "admins visible to admins" on public.admin_users for select to authenticated using (public.is_admin());
create policy "users manage blocks" on public.blocks for all to authenticated using (blocker_id = public.current_profile_id()) with check (blocker_id = public.current_profile_id());
create policy "users create reports" on public.reports for insert to authenticated with check (reporter_id = public.current_profile_id());
create policy "admins review reports" on public.reports for select to authenticated using (public.is_admin());

insert into public.intent_badges(slug,label) values ('serious','Ciddi düşünüyor'),('fun','Eğlence arıyor'),('adventure','Maceracı'),('coffee','Kahve sever'),('night-owl','Gece kuşu'),('live-music','Canlı müzik'),('foodie','Yeni tatlar'),('travel','Seyahat tutkunu') on conflict do nothing;
insert into public.icebreaker_prompts(prompt) values ('En gizli yeteneğim…'),('Benimle çıkmanın küçük bir lüksü…'),('Beni etkilemenin en kısa yolu…'),('Birlikte mutlaka denemeliyiz…') on conflict do nothing;
insert into public.daily_quests(slug,title,event_name,target_count,xp_reward) values ('three-right-swipes','3 kişiye kalbini aç','right_swipe',3,120),('start-chat','Bir sohbet başlat','message_sent',1,80),('polish-profile','Profiline bir dokunuş ekle','profile_updated',1,60) on conflict do nothing;


-- ===== 002_security_foundation.sql =====
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


-- ===== 003_profile_foundation.sql =====
-- Lovask profile foundation: private identity data, atomic onboarding and
-- WebP-only photo metadata. Originals are never written to Storage.

do $$ begin
  create type public.photo_moderation_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.photo_processing_status as enum ('processing', 'ready', 'failed');
exception when duplicate_object then null;
end $$;

alter table public.profiles add column if not exists name_changed_at timestamptz;

create table if not exists public.private_profile_data (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  birth_date date not null,
  phone text,
  updated_at timestamptz not null default now(),
  constraint private_adults_only check (birth_date <= current_date - interval '18 years'),
  constraint phone_length check (phone is null or char_length(phone) between 7 and 24)
);

insert into public.private_profile_data(profile_id, birth_date)
select id, birth_date from public.profiles where kind = 'human'
on conflict (profile_id) do nothing;

alter table public.private_profile_data enable row level security;
drop policy if exists "owners read private profile data" on public.private_profile_data;
create policy "owners read private profile data" on public.private_profile_data for select to authenticated
using (
  profile_id = public.current_profile_id()
  or public.has_admin_role(array['owner','support'])
);

alter table public.profile_photos
  add column if not exists variants jsonb not null default '{}'::jsonb,
  add column if not exists width integer,
  add column if not exists height integer,
  add column if not exists moderation_status public.photo_moderation_status not null default 'approved',
  add column if not exists processing_status public.photo_processing_status not null default 'ready';

alter table public.profile_photos drop constraint if exists profile_photos_width_check;
alter table public.profile_photos add constraint profile_photos_width_check check (width is null or width between 1 and 12000);
alter table public.profile_photos drop constraint if exists profile_photos_height_check;
alter table public.profile_photos add constraint profile_photos_height_check check (height is null or height between 1 and 12000);

create or replace function public.enforce_profile_photo_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.profile_id::text, 0));
  select count(*) into current_count
  from public.profile_photos
  where profile_id = new.profile_id and id <> new.id;
  if current_count >= 6 then
    raise exception 'photo_limit_reached';
  end if;
  return new;
end;
$$;

drop trigger if exists profile_photo_limit on public.profile_photos;
create trigger profile_photo_limit
before insert or update of profile_id on public.profile_photos
for each row execute function public.enforce_profile_photo_limit();

drop policy if exists "visible profile photos" on public.profile_photos;
drop policy if exists "profile photos visible" on public.profile_photos;
create policy "approved or owned photos are visible" on public.profile_photos for select to authenticated
using (
  (profile_id = public.current_profile_id())
  or public.has_admin_role(array['owner','moderator','support'])
  or (moderation_status = 'approved' and processing_status = 'ready' and public.profile_is_visible(profile_id))
);

-- Table-level grants would expose birth_date even when RLS is correct. Replace
-- them with an explicit public profile projection.
revoke select on public.profiles from anon, authenticated;
revoke insert, update, delete on public.profiles from anon, authenticated;
grant select (
  id, kind, display_name, gender, bio, city, xp, level, is_verified,
  is_discoverable, onboarding_completed, created_at, updated_at
) on public.profiles to authenticated;

-- Profile writes pass through validated RPCs; photo bytes pass through the
-- server conversion route. This prevents clients from bypassing limits.
revoke insert, update, delete on public.profile_photos from anon, authenticated;
revoke insert, update, delete on public.profile_intentions from anon, authenticated;
revoke insert, update, delete on public.profile_answers from anon, authenticated;

revoke all on public.private_profile_data from anon;
revoke all on public.private_profile_data from authenticated;
grant select (profile_id, birth_date, phone, updated_at) on public.private_profile_data to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profiles', 'profiles', false, 3145728, array['image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.save_onboarding_profile(
  profile_name text,
  profile_birth_date date,
  profile_gender text,
  profile_city text,
  profile_phone text,
  badge_slugs text[],
  icebreaker_prompt text,
  icebreaker_answer text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid;
  existing public.profiles%rowtype;
  badge_count integer;
  prompt_uuid uuid;
  cleaned_phone text := nullif(btrim(profile_phone), '');
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if char_length(btrim(profile_name)) not between 2 and 60 then raise exception 'invalid_name'; end if;
  if profile_birth_date > current_date - interval '18 years' or profile_birth_date < current_date - interval '100 years' then
    raise exception 'invalid_birth_date';
  end if;
  if char_length(btrim(profile_gender)) not between 1 and 40 then raise exception 'invalid_gender'; end if;
  if profile_city is not null and char_length(btrim(profile_city)) > 80 then raise exception 'invalid_city'; end if;
  if cleaned_phone is not null and char_length(cleaned_phone) not between 7 and 24 then raise exception 'invalid_phone'; end if;
  if coalesce(array_length(badge_slugs, 1), 0) not between 1 and 3 then raise exception 'invalid_badge_count'; end if;
  if char_length(btrim(icebreaker_answer)) not between 1 and 160 then raise exception 'invalid_answer'; end if;

  select * into existing from public.profiles where user_id = auth.uid() and kind = 'human' for update;
  if found then
    if existing.onboarding_completed and existing.birth_date <> profile_birth_date then
      raise exception 'birth_date_support_required';
    end if;
    if existing.display_name <> btrim(profile_name)
       and existing.name_changed_at is not null
       and existing.name_changed_at > now() - interval '30 days' then
      raise exception 'name_change_cooldown';
    end if;

    update public.profiles set
      display_name = btrim(profile_name),
      birth_date = profile_birth_date,
      gender = btrim(profile_gender),
      city = nullif(btrim(profile_city), ''),
      name_changed_at = case when existing.display_name <> btrim(profile_name) then now() else existing.name_changed_at end,
      updated_at = now()
    where id = existing.id returning id into profile_uuid;
  else
    insert into public.profiles(user_id, kind, display_name, birth_date, gender, city, is_discoverable)
    values (auth.uid(), 'human', btrim(profile_name), profile_birth_date, btrim(profile_gender), nullif(btrim(profile_city), ''), false)
    returning id into profile_uuid;
  end if;

  insert into public.private_profile_data(profile_id, birth_date, phone, updated_at)
  values (profile_uuid, profile_birth_date, cleaned_phone, now())
  on conflict (profile_id) do update set birth_date = excluded.birth_date, phone = excluded.phone, updated_at = now();

  select count(*) into badge_count
  from public.intent_badges where slug = any(badge_slugs) and is_active;
  if badge_count <> array_length(badge_slugs, 1) then raise exception 'invalid_badge'; end if;

  select id into prompt_uuid from public.icebreaker_prompts
  where prompt = icebreaker_prompt and is_active limit 1;
  if prompt_uuid is null then raise exception 'invalid_prompt'; end if;

  delete from public.profile_intentions where profile_id = profile_uuid;
  insert into public.profile_intentions(profile_id, badge_id)
  select profile_uuid, id from public.intent_badges where slug = any(badge_slugs) and is_active;

  delete from public.profile_answers where profile_id = profile_uuid;
  insert into public.profile_answers(profile_id, prompt_id, answer)
  values (profile_uuid, prompt_uuid, btrim(icebreaker_answer));

  return profile_uuid;
end;
$$;

create or replace function public.finalize_onboarding()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid;
  ready_photos integer;
begin
  profile_uuid := public.current_profile_id();
  if profile_uuid is null then raise exception 'profile_required'; end if;
  select count(*) into ready_photos from public.profile_photos
  where profile_id = profile_uuid and processing_status = 'ready' and moderation_status <> 'rejected';
  if ready_photos < 2 then raise exception 'two_photos_required'; end if;
  update public.profiles set onboarding_completed = true, is_discoverable = true, updated_at = now()
  where id = profile_uuid and kind = 'human';
end;
$$;

revoke all on function public.save_onboarding_profile(text,date,text,text,text,text[],text,text) from public;
revoke all on function public.finalize_onboarding() from public;
grant execute on function public.save_onboarding_profile(text,date,text,text,text,text[],text,text) to authenticated;
grant execute on function public.finalize_onboarding() to authenticated;


-- ===== 004_discovery_and_matching.sql =====
-- Lovask discovery and matching: deterministic candidate deck and atomic
-- swipe/match/quest updates.

create or replace function public.get_discovery_candidates(candidate_limit integer default 20)
returns table (
  id uuid,
  kind public.profile_kind,
  display_name text,
  age integer,
  city text,
  is_verified boolean,
  photo_path text,
  badges text[],
  prompt text,
  answer text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    target.id,
    target.kind,
    target.display_name,
    extract(year from age(current_date, target.birth_date))::integer,
    target.city,
    target.is_verified,
    photo.photo_path,
    coalesce(badge_list.badges, array[]::text[]),
    response.prompt,
    response.answer
  from public.profiles target
  join lateral (
    select coalesce(pp.variants->>'960', pp.variants->>'480', pp.storage_path) as photo_path
    from public.profile_photos pp
    where pp.profile_id = target.id
      and pp.processing_status = 'ready'
      and pp.moderation_status = 'approved'
    order by pp.is_primary desc, pp.sort_order
    limit 1
  ) photo on true
  left join lateral (
    select array_agg(ib.label order by ib.label) as badges
    from public.profile_intentions pi
    join public.intent_badges ib on ib.id = pi.badge_id
    where pi.profile_id = target.id
  ) badge_list on true
  left join lateral (
    select ip.prompt, pa.answer
    from public.profile_answers pa
    join public.icebreaker_prompts ip on ip.id = pa.prompt_id
    where pa.profile_id = target.id
    order by pa.sort_order
    limit 1
  ) response on true
  where public.current_profile_id() is not null
    and target.id <> public.current_profile_id()
    and target.is_discoverable
    and target.onboarding_completed
    and public.profile_is_visible(target.id)
    and not exists (
      select 1 from public.swipes s
      where s.swiper_id = public.current_profile_id() and s.target_id = target.id
    )
  order by md5(target.id::text || public.current_profile_id()::text || current_date::text)
  limit least(greatest(coalesce(candidate_limit, 20), 1), 40);
$$;

create or replace function public.get_active_match_profiles()
returns table (
  match_id uuid,
  id uuid,
  kind public.profile_kind,
  display_name text,
  age integer,
  city text,
  is_verified boolean,
  photo_path text,
  badges text[],
  prompt text,
  answer text,
  matched_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    m.id,
    target.id,
    target.kind,
    target.display_name,
    extract(year from age(current_date, target.birth_date))::integer,
    target.city,
    target.is_verified,
    photo.photo_path,
    coalesce(badge_list.badges, array[]::text[]),
    response.prompt,
    response.answer,
    m.matched_at
  from public.matches m
  join public.profiles target on target.id = case
    when m.user_a = public.current_profile_id() then m.user_b else m.user_a end
  left join lateral (
    select coalesce(pp.variants->>'960', pp.variants->>'480', pp.storage_path) as photo_path
    from public.profile_photos pp
    where pp.profile_id = target.id and pp.processing_status = 'ready' and pp.moderation_status <> 'rejected'
    order by pp.is_primary desc, pp.sort_order
    limit 1
  ) photo on true
  left join lateral (
    select array_agg(ib.label order by ib.label) as badges
    from public.profile_intentions pi
    join public.intent_badges ib on ib.id = pi.badge_id
    where pi.profile_id = target.id
  ) badge_list on true
  left join lateral (
    select ip.prompt, pa.answer
    from public.profile_answers pa
    join public.icebreaker_prompts ip on ip.id = pa.prompt_id
    where pa.profile_id = target.id order by pa.sort_order limit 1
  ) response on true
  where public.current_profile_id() in (m.user_a, m.user_b) and m.status = 'active'
  order by coalesce(m.last_message_at, m.matched_at) desc;
$$;

create or replace function public.record_swipe(target_profile uuid, swipe_choice public.swipe_direction)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer public.profiles%rowtype;
  target public.profiles%rowtype;
  positive boolean := swipe_choice in ('right', 'super');
  reciprocal boolean := false;
  resulting_match uuid;
  quest_uuid uuid;
  quest_target integer;
  quest_reward integer;
  quest_progress integer := 0;
  awarded_rows integer := 0;
  today_tr date := (now() at time zone 'Europe/Istanbul')::date;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select * into viewer from public.profiles where user_id = auth.uid() and kind = 'human' for update;
  if not found or not viewer.onboarding_completed then raise exception 'onboarding_required'; end if;
  if viewer.id = target_profile then raise exception 'self_swipe_forbidden'; end if;

  perform pg_advisory_xact_lock(hashtextextended(viewer.id::text, 0));
  select * into target from public.profiles where id = target_profile and is_discoverable and onboarding_completed;
  if not found or not public.profile_is_visible(target_profile) then raise exception 'target_unavailable'; end if;
  if exists(select 1 from public.swipes where swiper_id = viewer.id and target_id = target.id) then
    raise exception 'already_swiped';
  end if;

  insert into public.swipes(swiper_id, target_id, direction) values (viewer.id, target.id, swipe_choice);

  if positive then
    reciprocal := target.kind = 'bot' or exists(
      select 1 from public.swipes
      where swiper_id = target.id and target_id = viewer.id and direction in ('right','super')
    );
    if reciprocal then
      insert into public.matches(user_a, user_b, status)
      values (least(viewer.id, target.id), greatest(viewer.id, target.id), 'active')
      on conflict (user_a, user_b) do nothing
      returning id into resulting_match;
      if resulting_match is null then
        select id into resulting_match from public.matches
        where user_a = least(viewer.id, target.id)
          and user_b = greatest(viewer.id, target.id)
          and status = 'active';
      end if;
    end if;

    select id, target_count, xp_reward into quest_uuid, quest_target, quest_reward
    from public.daily_quests where slug = 'three-right-swipes' and is_active limit 1;
    if quest_uuid is not null then
      insert into public.user_quest_progress(user_id, quest_id, quest_date, progress)
      values (viewer.id, quest_uuid, today_tr, 1)
      on conflict (user_id, quest_id, quest_date) do update
        set progress = least(public.user_quest_progress.progress + 1, quest_target)
      returning progress into quest_progress;

      if quest_progress >= quest_target then
        update public.user_quest_progress set completed_at = coalesce(completed_at, now()), xp_claimed_at = now()
        where user_id = viewer.id and quest_id = quest_uuid and quest_date = today_tr and xp_claimed_at is null;
        get diagnostics awarded_rows = row_count;
        if awarded_rows = 1 then update public.profiles set xp = xp + quest_reward where id = viewer.id; end if;
      end if;
    end if;
  else
    select coalesce(uqp.progress, 0) into quest_progress
    from public.daily_quests dq
    left join public.user_quest_progress uqp on uqp.quest_id = dq.id and uqp.user_id = viewer.id and uqp.quest_date = today_tr
    where dq.slug = 'three-right-swipes' limit 1;
    quest_progress := coalesce(quest_progress, 0);
  end if;

  return jsonb_build_object(
    'matched', resulting_match is not null,
    'matchId', resulting_match,
    'targetKind', target.kind,
    'questProgress', quest_progress,
    'xpAwarded', case when awarded_rows = 1 then quest_reward else 0 end
  );
end;
$$;

revoke insert, update, delete on public.swipes from anon, authenticated;
revoke insert, update, delete on public.matches from anon, authenticated;
revoke all on function public.get_discovery_candidates(integer) from public;
revoke all on function public.get_active_match_profiles() from public;
revoke all on function public.record_swipe(uuid,public.swipe_direction) from public;
grant execute on function public.get_discovery_candidates(integer) to authenticated;
grant execute on function public.get_active_match_profiles() to authenticated;
grant execute on function public.record_swipe(uuid,public.swipe_direction) to authenticated;


-- ===== 005_persistent_messaging_and_ai.sql =====
-- Lovask persistent messaging: idempotent sends, daily limits, realtime,
-- provider runtime settings and per-conversation admin takeover.

alter table public.messages
  add column if not exists client_message_id uuid,
  add column if not exists ai_provider text,
  add column if not exists ai_model text,
  add column if not exists sent_by_admin uuid references auth.users(id);
create unique index if not exists messages_client_idempotency
  on public.messages(match_id, client_message_id) where client_message_id is not null;

create table if not exists public.message_daily_usage (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  usage_date date not null,
  sent_count integer not null default 0 check (sent_count >= 0),
  primary key(profile_id, usage_date)
);

create table if not exists public.bot_conversation_controls (
  match_id uuid primary key references public.matches(id) on delete cascade,
  mode text not null default 'ai' check (mode in ('ai','admin')),
  updated_by uuid references public.admin_users(user_id),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_runtime_settings (
  id boolean primary key default true check (id),
  default_provider text not null default 'openai' check (default_provider in ('openai','openrouter','deepseek','gemini')),
  fallback_order text[] not null default array['gemini','deepseek','openrouter'],
  openai_model text not null default 'gpt-5.6-luna',
  openrouter_model text not null default 'openai/gpt-5.6-luna',
  deepseek_model text not null default 'deepseek-chat',
  gemini_model text not null default 'gemini-3.6-flash',
  updated_by uuid references public.admin_users(user_id),
  updated_at timestamptz not null default now(),
  check (fallback_order <@ array['openai','openrouter','deepseek','gemini']::text[])
);
insert into public.ai_runtime_settings(id) values (true) on conflict (id) do nothing;

alter table public.bot_personas add column if not exists provider text not null default 'inherit'
  check (provider in ('inherit','openai','openrouter','deepseek','gemini'));

alter table public.message_daily_usage enable row level security;
alter table public.bot_conversation_controls enable row level security;
alter table public.ai_runtime_settings enable row level security;

create policy "users see own message usage" on public.message_daily_usage for select to authenticated
using (profile_id = public.current_profile_id() or public.has_admin_role(array['owner','support']));
create policy "admins see bot conversation mode" on public.bot_conversation_controls for select to authenticated
using (public.has_admin_role(array['owner','bot_editor','support']));
create policy "owners manage ai runtime settings" on public.ai_runtime_settings for all to authenticated
using (public.has_admin_role(array['owner'])) with check (public.has_admin_role(array['owner']));

create or replace function public.send_text_message(match_uuid uuid, message_body text, client_uuid uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  sender_profile uuid := public.current_profile_id();
  active_match public.matches%rowtype;
  existing_message public.messages%rowtype;
  inserted_message public.messages%rowtype;
  today_tr date := (now() at time zone 'Europe/Istanbul')::date;
  daily_limit integer;
  used_count integer;
  quest_uuid uuid;
  quest_reward integer;
  awarded_rows integer := 0;
begin
  if sender_profile is null then raise exception 'profile_required'; end if;
  if client_uuid is null then raise exception 'client_id_required'; end if;
  if char_length(btrim(message_body)) not between 1 and 1200 then raise exception 'invalid_message'; end if;

  select * into active_match from public.matches
  where id = match_uuid and status = 'active' and sender_profile in (user_a, user_b) for update;
  if not found then raise exception 'active_match_required'; end if;

  select * into existing_message from public.messages
  where match_id = match_uuid and client_message_id = client_uuid and sender_id = sender_profile;
  if found then
    return jsonb_build_object('messageId', existing_message.id, 'createdAt', existing_message.created_at, 'duplicate', true);
  end if;

  select case when exists(
    select 1 from public.user_entitlements where profile_id = sender_profile and noir_until > now()
  ) then 100 else 25 end into daily_limit;

  insert into public.message_daily_usage(profile_id, usage_date, sent_count)
  values (sender_profile, today_tr, 0) on conflict (profile_id, usage_date) do nothing;
  select sent_count into used_count from public.message_daily_usage
  where profile_id = sender_profile and usage_date = today_tr for update;
  if used_count >= daily_limit then
    return jsonb_build_object('allowed', false, 'remaining', 0, 'limit', daily_limit);
  end if;

  update public.message_daily_usage set sent_count = sent_count + 1
  where profile_id = sender_profile and usage_date = today_tr;
  insert into public.messages(match_id, sender_id, kind, body, client_message_id)
  values (match_uuid, sender_profile, 'text', btrim(message_body), client_uuid)
  returning * into inserted_message;
  update public.matches set last_message_at = inserted_message.created_at where id = match_uuid;

  select id, xp_reward into quest_uuid, quest_reward from public.daily_quests
  where slug = 'start-chat' and is_active limit 1;
  if quest_uuid is not null then
    insert into public.user_quest_progress(user_id, quest_id, quest_date, progress, completed_at, xp_claimed_at)
    values (sender_profile, quest_uuid, today_tr, 1, now(), now())
    on conflict (user_id, quest_id, quest_date) do nothing;
    get diagnostics awarded_rows = row_count;
    if awarded_rows = 1 then update public.profiles set xp = xp + quest_reward where id = sender_profile; end if;
  end if;

  return jsonb_build_object(
    'allowed', true,
    'messageId', inserted_message.id,
    'createdAt', inserted_message.created_at,
    'remaining', daily_limit - used_count - 1,
    'limit', daily_limit,
    'xpAwarded', case when awarded_rows = 1 then quest_reward else 0 end
  );
end;
$$;

create or replace function public.get_match_messages(match_uuid uuid, message_limit integer default 80)
returns table (
  id uuid,
  sender_id uuid,
  kind public.message_kind,
  body text,
  audio_path text,
  audio_duration_ms integer,
  read_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.sender_id, m.kind, m.body, m.audio_path, m.audio_duration_ms, m.read_at, m.created_at
  from public.messages m
  where m.match_id = match_uuid
    and (public.in_match(match_uuid) or public.can_review_match(match_uuid))
  order by m.created_at asc
  limit least(greatest(coalesce(message_limit, 80), 1), 120);
$$;

create or replace function public.refund_bot_reply_quota(profile_uuid uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.bot_reply_usage
  set reply_count = greatest(reply_count - 1, 0)
  where profile_id = profile_uuid
    and usage_date = (now() at time zone 'Europe/Istanbul')::date;
$$;

revoke insert, update, delete on public.messages from anon, authenticated;
revoke all on function public.send_text_message(uuid,text,uuid) from public;
revoke all on function public.get_match_messages(uuid,integer) from public;
revoke all on function public.refund_bot_reply_quota(uuid) from public;
grant execute on function public.send_text_message(uuid,text,uuid) to authenticated;
grant execute on function public.get_match_messages(uuid,integer) to authenticated;
grant execute on function public.refund_bot_reply_quota(uuid) to service_role;

do $$ begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then alter publication supabase_realtime add table public.messages; end if;
end $$;


-- ===== 006_voice_messages_and_push.sql =====
-- Lovask voice messaging and cost-controlled Web Push subscriptions.

alter table public.messages
  add column if not exists audio_waveform smallint[];

alter table public.messages drop constraint if exists messages_audio_waveform_check;
alter table public.messages add constraint messages_audio_waveform_check check (
  audio_waveform is null or (
    cardinality(audio_waveform) between 8 and 48
    and 0 <= all(audio_waveform)
    and 100 >= all(audio_waveform)
  )
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) between 20 and 2048),
  p256dh text not null check (char_length(p256dh) between 20 and 512),
  auth text not null check (char_length(auth) between 8 and 256),
  user_agent text,
  failure_count integer not null default 0 check (failure_count >= 0),
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_subscriptions_profile_active
  on public.push_subscriptions(profile_id) where disabled_at is null;

create or replace function public.increment_push_failure(subscription_uuid uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.push_subscriptions
  set failure_count = failure_count + 1,
      disabled_at = case when failure_count >= 4 then now() else disabled_at end,
      updated_at = now()
  where id = subscription_uuid;
$$;

alter table public.push_subscriptions enable row level security;
create policy "users read own push subscriptions" on public.push_subscriptions for select to authenticated
using (profile_id = public.current_profile_id());
create policy "users delete own push subscriptions" on public.push_subscriptions for delete to authenticated
using (profile_id = public.current_profile_id());
revoke insert, update on public.push_subscriptions from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'voice-messages',
  'voice-messages',
  false,
  4194304,
  array['audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/x-m4a']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.send_audio_message(
  match_uuid uuid,
  message_audio_path text,
  message_duration_ms integer,
  message_waveform smallint[],
  client_uuid uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  sender_profile uuid := public.current_profile_id();
  active_match public.matches%rowtype;
  existing_message public.messages%rowtype;
  inserted_message public.messages%rowtype;
  today_tr date := (now() at time zone 'Europe/Istanbul')::date;
  daily_limit integer;
  used_count integer;
  quest_uuid uuid;
  quest_reward integer;
  awarded_rows integer := 0;
begin
  if sender_profile is null then raise exception 'profile_required'; end if;
  if client_uuid is null then raise exception 'client_id_required'; end if;
  if message_duration_ms not between 500 and 60000 then raise exception 'invalid_audio_duration'; end if;
  if cardinality(message_waveform) not between 8 and 48
    or not (0 <= all(message_waveform) and 100 >= all(message_waveform)) then
    raise exception 'invalid_audio_waveform';
  end if;
  if message_audio_path not like sender_profile::text || '/' || match_uuid::text || '/%' then
    raise exception 'invalid_audio_path';
  end if;

  select * into active_match from public.matches
  where id = match_uuid and status = 'active' and sender_profile in (user_a, user_b) for update;
  if not found then raise exception 'active_match_required'; end if;

  select * into existing_message from public.messages
  where match_id = match_uuid and client_message_id = client_uuid and sender_id = sender_profile;
  if found then
    return jsonb_build_object('messageId', existing_message.id, 'createdAt', existing_message.created_at, 'duplicate', true);
  end if;

  select case when exists(
    select 1 from public.user_entitlements where profile_id = sender_profile and noir_until > now()
  ) then 100 else 25 end into daily_limit;

  insert into public.message_daily_usage(profile_id, usage_date, sent_count)
  values (sender_profile, today_tr, 0) on conflict (profile_id, usage_date) do nothing;
  select sent_count into used_count from public.message_daily_usage
  where profile_id = sender_profile and usage_date = today_tr for update;
  if used_count >= daily_limit then
    return jsonb_build_object('allowed', false, 'remaining', 0, 'limit', daily_limit);
  end if;

  update public.message_daily_usage set sent_count = sent_count + 1
  where profile_id = sender_profile and usage_date = today_tr;
  insert into public.messages(match_id, sender_id, kind, audio_path, audio_duration_ms, audio_waveform, client_message_id)
  values (match_uuid, sender_profile, 'audio', message_audio_path, message_duration_ms, message_waveform, client_uuid)
  returning * into inserted_message;
  update public.matches set last_message_at = inserted_message.created_at where id = match_uuid;

  select id, xp_reward into quest_uuid, quest_reward from public.daily_quests
  where slug = 'start-chat' and is_active limit 1;
  if quest_uuid is not null then
    insert into public.user_quest_progress(user_id, quest_id, quest_date, progress, completed_at, xp_claimed_at)
    values (sender_profile, quest_uuid, today_tr, 1, now(), now())
    on conflict (user_id, quest_id, quest_date) do nothing;
    get diagnostics awarded_rows = row_count;
    if awarded_rows = 1 then update public.profiles set xp = xp + quest_reward where id = sender_profile; end if;
  end if;

  return jsonb_build_object(
    'allowed', true,
    'messageId', inserted_message.id,
    'createdAt', inserted_message.created_at,
    'remaining', daily_limit - used_count - 1,
    'limit', daily_limit,
    'xpAwarded', case when awarded_rows = 1 then quest_reward else 0 end
  );
end;
$$;

drop function if exists public.get_match_messages(uuid,integer);
create function public.get_match_messages(match_uuid uuid, message_limit integer default 80)
returns table (
  id uuid,
  sender_id uuid,
  kind public.message_kind,
  body text,
  audio_path text,
  audio_duration_ms integer,
  audio_waveform smallint[],
  read_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.sender_id, m.kind, m.body, m.audio_path, m.audio_duration_ms,
    m.audio_waveform, m.read_at, m.created_at
  from public.messages m
  where m.match_id = match_uuid
    and (public.in_match(match_uuid) or public.can_review_match(match_uuid))
  order by m.created_at asc
  limit least(greatest(coalesce(message_limit, 80), 1), 120);
$$;

revoke all on function public.send_audio_message(uuid,text,integer,smallint[],uuid) from public;
grant execute on function public.send_audio_message(uuid,text,integer,smallint[],uuid) to authenticated;
revoke all on function public.get_match_messages(uuid,integer) from public;
grant execute on function public.get_match_messages(uuid,integer) to authenticated;
revoke all on function public.increment_push_failure(uuid) from public;
grant execute on function public.increment_push_failure(uuid) to service_role;


-- ===== 007_profile_visitors.sql =====
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



-- ===== 008_noir_payments.sql =====
-- Fixed-term Noir access and auditable, idempotent payment approval.

create table if not exists public.premium_plans (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9-]+$'),
  name text not null check (char_length(name) between 2 and 80),
  duration_days integer not null check (duration_days between 1 and 365),
  price_amount numeric(10,2) not null check (price_amount > 0),
  currency text not null default 'TRY' check (currency ~ '^[A-Z]{3}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  plan_id uuid not null references public.premium_plans(id) on delete restrict,
  provider text not null check (provider in ('shopier','bank_transfer','manual')),
  amount numeric(10,2) not null check (amount > 0),
  currency text not null default 'TRY' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'awaiting_payment' check (status in (
    'pending','awaiting_payment','under_review','approved','rejected','cancelled','expired'
  )),
  provider_order_id text,
  payment_reference text unique not null,
  proof_path text,
  rejection_reason text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists payment_orders_provider_id_unique
  on public.payment_orders(provider, provider_order_id) where provider_order_id is not null;
create index if not exists payment_orders_profile_timeline on public.payment_orders(profile_id, created_at desc);
create index if not exists payment_orders_review_queue on public.payment_orders(status, created_at asc);

insert into public.premium_plans(slug,name,duration_days,price_amount,currency)
values
  ('noir-weekly','Haftalık Noir',7,199.00,'TRY'),
  ('noir-monthly','Aylık Noir',30,599.00,'TRY')
on conflict (slug) do update set
  name = excluded.name,
  duration_days = excluded.duration_days,
  price_amount = excluded.price_amount,
  currency = excluded.currency,
  updated_at = now();

alter table public.premium_plans enable row level security;
alter table public.payment_orders enable row level security;

create policy "active plans are visible" on public.premium_plans for select to authenticated using (is_active);
create policy "owners see payment orders" on public.payment_orders for select to authenticated
using (profile_id = public.current_profile_id() or public.has_admin_role(array['owner','support']));

revoke insert, update, delete on public.payment_orders from anon, authenticated;
revoke insert, update, delete on public.premium_plans from anon, authenticated;

create or replace function public.create_noir_payment_order(plan_slug text, payment_provider text)
returns public.payment_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  buyer uuid := public.current_profile_id();
  selected_plan public.premium_plans%rowtype;
  created_order public.payment_orders%rowtype;
begin
  if buyer is null then raise exception 'profile_required'; end if;
  if payment_provider not in ('bank_transfer','shopier') then raise exception 'invalid_provider'; end if;
  select * into selected_plan from public.premium_plans where slug = plan_slug and is_active for share;
  if not found then raise exception 'plan_unavailable'; end if;

  insert into public.payment_orders(profile_id,plan_id,provider,amount,currency,payment_reference)
  values (
    buyer, selected_plan.id, payment_provider, selected_plan.price_amount, selected_plan.currency,
    'LVK-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))
  ) returning * into created_order;
  return created_order;
end;
$$;

create or replace function public.submit_noir_payment_proof(order_uuid uuid, object_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  buyer uuid := public.current_profile_id();
begin
  if buyer is null then raise exception 'profile_required'; end if;
  if object_path not like buyer::text || '/' || order_uuid::text || '/%' then raise exception 'invalid_proof_path'; end if;
  update public.payment_orders
    set proof_path = object_path, status = 'under_review', updated_at = now()
  where id = order_uuid and profile_id = buyer and provider = 'bank_transfer'
    and status in ('awaiting_payment','under_review');
  if not found then raise exception 'order_not_uploadable'; end if;
end;
$$;

create or replace function public.approve_noir_payment(order_uuid uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_order public.payment_orders%rowtype;
  access_days integer;
  new_until timestamptz;
begin
  if not public.has_admin_role(array['owner','support']) then raise exception 'admin_required'; end if;
  select * into selected_order from public.payment_orders where id = order_uuid for update;
  if not found then raise exception 'order_not_found'; end if;
  if selected_order.status = 'approved' then
    select noir_until into new_until from public.user_entitlements where profile_id = selected_order.profile_id;
    return new_until;
  end if;
  if selected_order.status not in ('under_review','pending') then raise exception 'order_not_approvable'; end if;
  select duration_days into access_days from public.premium_plans where id = selected_order.plan_id;

  insert into public.user_entitlements(profile_id,noir_until,source,updated_at)
  values (selected_order.profile_id, now() + make_interval(days => access_days), 'payment:' || order_uuid::text, now())
  on conflict (profile_id) do update set
    noir_until = greatest(coalesce(public.user_entitlements.noir_until, now()), now()) + make_interval(days => access_days),
    source = 'payment:' || order_uuid::text,
    updated_at = now()
  returning noir_until into new_until;

  update public.payment_orders set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  where id = order_uuid;
  insert into public.admin_audit_log(actor_user_id,action,target_type,target_id,metadata)
  values (auth.uid(),'payment.approved','payment_order',order_uuid::text,jsonb_build_object('profileId',selected_order.profile_id,'noirUntil',new_until));
  return new_until;
end;
$$;

create or replace function public.reject_noir_payment(order_uuid uuid, reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_admin_role(array['owner','support']) then raise exception 'admin_required'; end if;
  if char_length(btrim(reason)) not between 3 and 500 then raise exception 'invalid_reason'; end if;
  update public.payment_orders set status = 'rejected', rejection_reason = btrim(reason), reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  where id = order_uuid and status in ('under_review','pending');
  if not found then raise exception 'order_not_rejectable'; end if;
  insert into public.admin_audit_log(actor_user_id,action,target_type,target_id,metadata)
  values (auth.uid(),'payment.rejected','payment_order',order_uuid::text,jsonb_build_object('reason',btrim(reason)));
end;
$$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('payment-proofs','payment-proofs',false,5242880,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

revoke all on function public.create_noir_payment_order(text,text) from public;
revoke all on function public.submit_noir_payment_proof(uuid,text) from public;
revoke all on function public.approve_noir_payment(uuid) from public;
revoke all on function public.reject_noir_payment(uuid,text) from public;
grant execute on function public.create_noir_payment_order(text,text) to authenticated;
grant execute on function public.submit_noir_payment_proof(uuid,text) to authenticated;
grant execute on function public.approve_noir_payment(uuid) to authenticated;
grant execute on function public.reject_noir_payment(uuid,text) to authenticated;


-- ===== 009_presence_and_read_receipts.sql =====
-- Throttled presence and Noir-only read receipts. Premium fields are gated in SQL.

create table if not exists public.profile_presence (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profile_presence enable row level security;
revoke all on public.profile_presence from anon, authenticated;

create or replace function public.has_active_noir()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.user_entitlements where profile_id = public.current_profile_id() and noir_until > now());
$$;

create or replace function public.touch_presence()
returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare viewer uuid := public.current_profile_id(); seen timestamptz;
begin
  if viewer is null then raise exception 'profile_required'; end if;
  insert into public.profile_presence(profile_id,last_seen_at,updated_at) values(viewer,now(),now())
  on conflict(profile_id) do update set last_seen_at = now(), updated_at = now()
    where public.profile_presence.updated_at <= now() - interval '3 minutes'
  returning last_seen_at into seen;
  if seen is null then select last_seen_at into seen from public.profile_presence where profile_id = viewer; end if;
  return seen;
end;
$$;

create or replace function public.mark_match_messages_read(match_uuid uuid)
returns integer
language plpgsql security definer set search_path = '' as $$
declare viewer uuid := public.current_profile_id(); changed integer;
begin
  if viewer is null or not exists(select 1 from public.matches where id=match_uuid and status='active' and viewer in(user_a,user_b)) then
    raise exception 'active_match_required';
  end if;
  update public.messages set read_at = now() where match_id=match_uuid and sender_id<>viewer and read_at is null;
  get diagnostics changed = row_count;
  return changed;
end;
$$;

create or replace function public.get_match_presence(match_uuid uuid)
returns table(last_seen_at timestamptz, is_online boolean)
language sql stable security definer set search_path = '' as $$
  select case when public.has_active_noir() then pp.last_seen_at else null end,
         case when public.has_active_noir() then coalesce(pp.last_seen_at > now()-interval '5 minutes',false) else false end
  from public.matches ma
  left join public.profile_presence pp on pp.profile_id = case when ma.user_a=public.current_profile_id() then ma.user_b else ma.user_a end
  where ma.id=match_uuid and ma.status='active' and public.current_profile_id() in(ma.user_a,ma.user_b);
$$;

drop function if exists public.get_match_messages(uuid,integer);
create function public.get_match_messages(match_uuid uuid, message_limit integer default 80)
returns table (
  id uuid, sender_id uuid, kind public.message_kind, body text, audio_path text,
  audio_duration_ms integer, audio_waveform smallint[], read_at timestamptz, created_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select m.id,m.sender_id,m.kind,m.body,m.audio_path,m.audio_duration_ms,m.audio_waveform,
    case when public.can_review_match(match_uuid) or public.has_active_noir() then m.read_at else null end,
    m.created_at
  from public.messages m
  where m.match_id=match_uuid and (public.in_match(match_uuid) or public.can_review_match(match_uuid))
  order by m.created_at asc limit least(greatest(coalesce(message_limit,80),1),120);
$$;

revoke all on function public.has_active_noir() from public;
revoke all on function public.touch_presence() from public;
revoke all on function public.mark_match_messages_read(uuid) from public;
revoke all on function public.get_match_presence(uuid) from public;
revoke all on function public.get_match_messages(uuid,integer) from public;
grant execute on function public.has_active_noir() to authenticated;
grant execute on function public.touch_presence() to authenticated;
grant execute on function public.mark_match_messages_read(uuid) to authenticated;
grant execute on function public.get_match_presence(uuid) to authenticated;
grant execute on function public.get_match_messages(uuid,integer) to authenticated;


-- ===== 010_safety_and_photo_moderation.sql =====
-- Atomic blocking/reporting and auditable photo moderation metadata.

alter table public.reports
  add column if not exists match_id uuid references public.matches(id) on delete set null,
  add column if not exists reviewed_by uuid references auth.users(id),
  add column if not exists reviewed_at timestamptz,
  add column if not exists resolution text;
alter table public.reports drop constraint if exists reports_status_check;
alter table public.reports add constraint reports_status_check check(status in ('open','reviewing','resolved','rejected'));

alter table public.profile_photos
  add column if not exists moderation_reason text,
  add column if not exists moderated_by uuid references auth.users(id),
  add column if not exists moderated_at timestamptz;

create or replace function public.block_profile(target_profile uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare viewer uuid := public.current_profile_id();
begin
  if viewer is null then raise exception 'profile_required'; end if;
  if target_profile is null or target_profile=viewer or not exists(select 1 from public.profiles where id=target_profile) then raise exception 'invalid_target'; end if;
  insert into public.blocks(blocker_id,blocked_id) values(viewer,target_profile) on conflict do nothing;
  update public.matches set status='blocked'
    where status='active' and user_a=least(viewer,target_profile) and user_b=greatest(viewer,target_profile);
end;
$$;

create or replace function public.unblock_profile(target_profile uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.blocks where blocker_id=public.current_profile_id() and blocked_id=target_profile;
$$;

create or replace function public.submit_profile_report(target_profile uuid, report_reason text, report_details text default null, related_match uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare viewer uuid := public.current_profile_id(); report_uuid uuid;
begin
  if viewer is null then raise exception 'profile_required'; end if;
  if target_profile is null or target_profile=viewer then raise exception 'invalid_target'; end if;
  if report_reason not in ('fake_profile','harassment','inappropriate_content','fraud','underage','spam','other') then raise exception 'invalid_reason'; end if;
  if report_details is not null and char_length(btrim(report_details))>1000 then raise exception 'details_too_long'; end if;
  if related_match is not null and not exists(select 1 from public.matches where id=related_match and viewer in(user_a,user_b) and target_profile in(user_a,user_b)) then raise exception 'invalid_match'; end if;
  insert into public.reports(reporter_id,reported_id,reason,details,match_id)
  values(viewer,target_profile,report_reason,nullif(btrim(report_details),''),related_match) returning id into report_uuid;
  return report_uuid;
end;
$$;

revoke all on function public.block_profile(uuid) from public;
revoke all on function public.unblock_profile(uuid) from public;
revoke all on function public.submit_profile_report(uuid,text,text,uuid) from public;
grant execute on function public.block_profile(uuid) to authenticated;
grant execute on function public.unblock_profile(uuid) to authenticated;
grant execute on function public.submit_profile_report(uuid,text,text,uuid) to authenticated;


-- ===== 011_shopier_card_payments.sql =====
-- Shopier card checkout correlation and idempotent webhook processing.

alter table public.payment_orders
  add column if not exists provider_checkout_id text,
  add column if not exists checkout_url text;

create unique index if not exists payment_orders_provider_checkout_unique
  on public.payment_orders(provider, provider_checkout_id)
  where provider_checkout_id is not null;

create table if not exists public.payment_webhook_events (
  webhook_id text primary key,
  provider text not null check (provider in ('shopier')),
  event_type text not null,
  provider_order_id text,
  payment_order_id uuid references public.payment_orders(id) on delete set null,
  payload_hash text not null,
  status text not null check (status in ('processed','ignored','failed')),
  error_code text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists payment_webhook_events_timeline
  on public.payment_webhook_events(received_at desc);

alter table public.payment_webhook_events enable row level security;
revoke all on public.payment_webhook_events from anon, authenticated;

create or replace function public.approve_verified_shopier_payment(
  order_uuid uuid,
  shopier_order_id text
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_order public.payment_orders%rowtype;
  access_days integer;
  new_until timestamptz;
begin
  if auth.role() <> 'service_role' then raise exception 'service_role_required'; end if;
  if nullif(btrim(shopier_order_id), '') is null then raise exception 'provider_order_required'; end if;

  select * into selected_order from public.payment_orders where id = order_uuid for update;
  if not found then raise exception 'order_not_found'; end if;
  if selected_order.provider <> 'shopier' then raise exception 'provider_mismatch'; end if;

  if selected_order.status = 'approved' then
    if selected_order.provider_order_id is distinct from shopier_order_id then
      raise exception 'provider_order_mismatch';
    end if;
    select noir_until into new_until from public.user_entitlements where profile_id = selected_order.profile_id;
    return new_until;
  end if;

  if selected_order.status not in ('pending','awaiting_payment') then raise exception 'order_not_approvable'; end if;
  if exists (
    select 1 from public.payment_orders
    where provider = 'shopier' and provider_order_id = shopier_order_id and id <> order_uuid
  ) then raise exception 'provider_order_already_used'; end if;

  select duration_days into access_days from public.premium_plans where id = selected_order.plan_id;
  if access_days is null then raise exception 'plan_not_found'; end if;

  insert into public.user_entitlements(profile_id,noir_until,source,updated_at)
  values (
    selected_order.profile_id,
    now() + make_interval(days => access_days),
    'shopier:' || shopier_order_id,
    now()
  )
  on conflict (profile_id) do update set
    noir_until = greatest(coalesce(public.user_entitlements.noir_until, now()), now()) + make_interval(days => access_days),
    source = 'shopier:' || shopier_order_id,
    updated_at = now()
  returning noir_until into new_until;

  update public.payment_orders set
    status = 'approved',
    provider_order_id = shopier_order_id,
    reviewed_at = now(),
    updated_at = now()
  where id = order_uuid;

  return new_until;
end;
$$;

revoke all on function public.approve_verified_shopier_payment(uuid,text) from public;
grant execute on function public.approve_verified_shopier_payment(uuid,text) to service_role;


-- ===== 012_bot_automation_phase1.sql =====
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


-- ===== 013_bot_behavior_phase2.sql =====
-- Phase 2: proactive behavior, scoped memory, relationship state and voice transcripts.

alter table public.bot_automation_settings
  add column if not exists first_message_enabled boolean not null default true,
  add column if not exists first_message_min_seconds integer not null default 120 check (first_message_min_seconds between 15 and 86400),
  add column if not exists first_message_max_seconds integer not null default 900 check (first_message_max_seconds between 15 and 172800),
  add column if not exists follow_up_enabled boolean not null default true,
  add column if not exists follow_up_min_seconds integer not null default 43200 check (follow_up_min_seconds between 3600 and 604800),
  add column if not exists follow_up_max_seconds integer not null default 129600 check (follow_up_max_seconds between 3600 and 1209600),
  add column if not exists memory_enabled boolean not null default true,
  add column if not exists daily_state_enabled boolean not null default true;

alter table public.bot_automation_overrides
  add column if not exists first_message_enabled boolean,
  add column if not exists first_message_min_seconds integer check (first_message_min_seconds between 15 and 86400),
  add column if not exists first_message_max_seconds integer check (first_message_max_seconds between 15 and 172800),
  add column if not exists follow_up_enabled boolean,
  add column if not exists follow_up_min_seconds integer check (follow_up_min_seconds between 3600 and 604800),
  add column if not exists follow_up_max_seconds integer check (follow_up_max_seconds between 3600 and 1209600),
  add column if not exists memory_enabled boolean,
  add column if not exists daily_state_enabled boolean;

alter table public.messages
  add column if not exists transcript text,
  add column if not exists transcription_status text check (transcription_status in ('pending','ready','failed'));

create table if not exists public.bot_conversation_memory (
  match_id uuid primary key references public.matches(id) on delete cascade,
  bot_profile_id uuid not null references public.profiles(id) on delete cascade,
  member_profile_id uuid not null references public.profiles(id) on delete cascade,
  summary text not null default '',
  facts jsonb not null default '[]'::jsonb,
  last_message_id uuid references public.messages(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.bot_relationship_state (
  match_id uuid primary key references public.matches(id) on delete cascade,
  stage text not null default 'new_match' check (stage in ('new_match','getting_to_know','comfortable','closer','distant','reconnecting')),
  score integer not null default 0 check (score between -100 and 100),
  admin_override boolean not null default false,
  updated_by uuid references public.admin_users(user_id),
  updated_at timestamptz not null default now()
);

create table if not exists public.bot_daily_states (
  bot_profile_id uuid not null references public.profiles(id) on delete cascade,
  state_date date not null,
  energy text not null check (energy in ('low','normal','high')),
  availability text not null check (availability in ('busy','relaxed','brief')),
  mood text not null check (mood in ('cheerful','calm','thoughtful','stressed')),
  context text not null check (char_length(context) between 1 and 240),
  generated_automatically boolean not null default true,
  updated_by uuid references public.admin_users(user_id),
  updated_at timestamptz not null default now(),
  primary key(bot_profile_id,state_date)
);

alter table public.bot_conversation_memory enable row level security;
alter table public.bot_relationship_state enable row level security;
alter table public.bot_daily_states enable row level security;
create policy "admins inspect bot conversation memory" on public.bot_conversation_memory for select to authenticated
using (public.has_admin_role(array['owner','bot_editor','support']));
create policy "admins manage relationship state" on public.bot_relationship_state for all to authenticated
using (public.has_admin_role(array['owner','bot_editor','support'])) with check (public.has_admin_role(array['owner','bot_editor','support']));
create policy "bot editors manage daily states" on public.bot_daily_states for all to authenticated
using (public.has_admin_role(array['owner','bot_editor'])) with check (public.has_admin_role(array['owner','bot_editor']));

revoke all on public.bot_conversation_memory from anon, authenticated;
revoke all on public.bot_daily_states from anon;


-- ===== 014_bot_operations_phase3.sql =====
-- Phase 3: controlled takeover, fallback, risk review, persona versions and experiments.

alter table public.bot_conversation_controls drop constraint if exists bot_conversation_controls_mode_check;
alter table public.bot_conversation_controls
  add constraint bot_conversation_controls_mode_check check (mode in ('ai','admin','paused')),
  add column if not exists takeover_expires_at timestamptz,
  add column if not exists auto_return_to_ai boolean not null default true,
  add column if not exists pause_reason text;

alter table public.bot_reply_jobs add column if not exists fallback_sent_at timestamptz;

create table if not exists public.bot_fallback_templates (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 3 and 240),
  is_active boolean not null default true,
  created_by uuid references public.admin_users(user_id),
  created_at timestamptz not null default now()
);
create unique index if not exists bot_fallback_template_unique on public.bot_fallback_templates(coalesce(profile_id,'00000000-0000-0000-0000-000000000000'::uuid),body);
insert into public.bot_fallback_templates(body) values
  ('Bir işim çıktı, birazdan daha rahat yazacağım.'),
  ('Şimdi biraz yoğunum, az sonra döneyim.'),
  ('Bir şeye bakmam gerekiyor, biraz bekletiyorum seni.')
on conflict do nothing;

create table if not exists public.bot_risk_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  message_id uuid references public.messages(id) on delete set null,
  category text not null,
  severity text not null check (severity in ('low','medium','high')),
  score numeric(5,4),
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  reviewed_by uuid references public.admin_users(user_id),
  reviewed_at timestamptz,
  resolution text,
  created_at timestamptz not null default now()
);
create index if not exists bot_risk_review_queue on public.bot_risk_events(status,severity,created_at);

create table if not exists public.bot_persona_versions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  version_number integer not null,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  persona text not null check (char_length(persona) between 20 and 8000),
  provider text not null default 'inherit' check (provider in ('inherit','openai','openrouter','deepseek','gemini')),
  model text not null,
  created_by uuid references public.admin_users(user_id),
  published_by uuid references public.admin_users(user_id),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique(profile_id,version_number)
);
insert into public.bot_persona_versions(profile_id,version_number,status,persona,provider,model,created_by,published_at)
select profile_id,1,'published',persona,provider,model,created_by,updated_at from public.bot_personas
on conflict(profile_id,version_number) do nothing;

create table if not exists public.bot_experiments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 3 and 120),
  status text not null default 'draft' check (status in ('draft','running','paused','completed')),
  traffic_percent integer not null default 20 check (traffic_percent between 1 and 100),
  control_config jsonb not null default '{}'::jsonb,
  variant_config jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  ended_at timestamptz,
  created_by uuid references public.admin_users(user_id),
  created_at timestamptz not null default now()
);

alter table public.bot_fallback_templates enable row level security;
alter table public.bot_risk_events enable row level security;
alter table public.bot_persona_versions enable row level security;
alter table public.bot_experiments enable row level security;
create policy "bot editors manage fallback templates" on public.bot_fallback_templates for all to authenticated
using (public.has_admin_role(array['owner','bot_editor'])) with check (public.has_admin_role(array['owner','bot_editor']));
create policy "moderators review bot risk" on public.bot_risk_events for all to authenticated
using (public.has_admin_role(array['owner','moderator','support'])) with check (public.has_admin_role(array['owner','moderator','support']));
create policy "bot editors manage persona versions" on public.bot_persona_versions for all to authenticated
using (public.has_admin_role(array['owner','bot_editor'])) with check (public.has_admin_role(array['owner','bot_editor']));
create policy "bot editors manage experiments" on public.bot_experiments for all to authenticated
using (public.has_admin_role(array['owner','bot_editor'])) with check (public.has_admin_role(array['owner','bot_editor']));

revoke all on public.bot_fallback_templates from anon;
revoke all on public.bot_risk_events from anon;
revoke all on public.bot_persona_versions from anon;
revoke all on public.bot_experiments from anon;


-- ===== 015_notification_quiet_hours.sql =====
-- User-controlled quiet hours with durable deferred push delivery.

create table if not exists public.notification_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  quiet_hours_enabled boolean not null default true,
  quiet_start time not null default '23:00',
  quiet_end time not null default '09:00',
  timezone text not null default 'Europe/Istanbul',
  updated_at timestamptz not null default now()
);
create table if not exists public.deferred_push_notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  payload jsonb not null,
  deliver_at timestamptz not null,
  status text not null default 'queued' check (status in ('queued','sent','cancelled','failed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists deferred_push_due on public.deferred_push_notifications(status,deliver_at) where status='queued';
alter table public.notification_preferences enable row level security;
alter table public.deferred_push_notifications enable row level security;
create policy "users manage notification preferences" on public.notification_preferences for all to authenticated
using (profile_id=public.current_profile_id()) with check (profile_id=public.current_profile_id());
revoke all on public.deferred_push_notifications from anon, authenticated;


-- ===== 016_bot_feature_flags_and_active_chat.sql =====
-- Independent rollout controls and active-chat push suppression.

alter table public.bot_automation_settings
  add column if not exists phase1_timing_enabled boolean not null default true,
  add column if not exists phase2_behavior_enabled boolean not null default true,
  add column if not exists phase3_safety_enabled boolean not null default true;

create table if not exists public.active_chat_sessions (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  last_heartbeat_at timestamptz not null default now()
);
create index if not exists active_chat_sessions_match_heartbeat
  on public.active_chat_sessions(match_id,last_heartbeat_at);

alter table public.active_chat_sessions enable row level security;
revoke all on public.active_chat_sessions from anon, authenticated;

create or replace function public.touch_active_chat(match_uuid uuid, is_open boolean default true)
returns timestamptz
language plpgsql
security definer
set search_path=public
as $$
declare
  viewer uuid := public.current_profile_id();
  touched timestamptz := now();
begin
  if viewer is null or not exists (
    select 1 from public.matches
    where id=match_uuid and status='active' and viewer in (user_a,user_b)
  ) then
    raise exception 'not_allowed';
  end if;
  if is_open then
    insert into public.active_chat_sessions(profile_id,match_id,last_heartbeat_at)
    values(viewer,match_uuid,touched)
    on conflict(profile_id) do update set match_id=excluded.match_id,last_heartbeat_at=excluded.last_heartbeat_at;
  else
    delete from public.active_chat_sessions where profile_id=viewer and match_id=match_uuid;
  end if;
  return touched;
end;
$$;

revoke all on function public.touch_active_chat(uuid,boolean) from public;
grant execute on function public.touch_active_chat(uuid,boolean) to authenticated;


-- ===== 017_bot_reliability_and_frontend_flows.sql =====
-- Reliability, measurable experiments, persistent discovery preferences and atomic publishes.

alter table public.bot_reply_jobs
  add column if not exists experiment_id uuid references public.bot_experiments(id) on delete set null,
  add column if not exists experiment_variant text check (experiment_variant in ('control','variant'));
create index if not exists bot_reply_jobs_stale_processing on public.bot_reply_jobs(locked_at) where status='processing';

create table if not exists public.bot_experiment_assignments (
  experiment_id uuid not null references public.bot_experiments(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  variant text not null check (variant in ('control','variant')),
  assigned_at timestamptz not null default now(),
  sent_at timestamptz,
  replied_at timestamptz,
  blocked_at timestamptz,
  reported_at timestamptz,
  primary key(experiment_id,match_id)
);
alter table public.bot_experiment_assignments enable row level security;
create policy "bot editors inspect experiment assignments" on public.bot_experiment_assignments for select to authenticated
using (public.has_admin_role(array['owner','bot_editor']));
revoke all on public.bot_experiment_assignments from anon,authenticated;

create table if not exists public.discovery_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  min_age integer not null default 18 check(min_age between 18 and 99),
  max_age integer not null default 80 check(max_age between 18 and 99),
  verified_only boolean not null default false,
  updated_at timestamptz not null default now(),
  check(min_age <= max_age)
);
alter table public.discovery_preferences enable row level security;
create policy "users manage discovery preferences" on public.discovery_preferences for all to authenticated
using(profile_id=public.current_profile_id()) with check(profile_id=public.current_profile_id());

create or replace function public.send_bot_text_message_service(member_uuid uuid,match_uuid uuid,message_body text,client_uuid uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare existing public.messages%rowtype; inserted public.messages%rowtype; quest_uuid uuid; quest_reward integer; awarded integer:=0; used_count integer:=0; daily_limit integer;
begin
  if auth.role()<>'service_role' then raise exception 'service_role_required'; end if;
  if char_length(btrim(message_body)) not between 1 and 1200 or client_uuid is null then raise exception 'invalid_message'; end if;
  if not exists(select 1 from public.matches m join public.profiles p on p.id=case when m.user_a=member_uuid then m.user_b else m.user_a end where m.id=match_uuid and m.status='active' and member_uuid in(m.user_a,m.user_b) and p.kind='bot') then raise exception 'active_bot_match_required'; end if;
  select * into existing from public.messages where match_id=match_uuid and sender_id=member_uuid and client_message_id=client_uuid;
  if found then return jsonb_build_object('messageId',existing.id,'createdAt',existing.created_at,'duplicate',true); end if;
  insert into public.messages(match_id,sender_id,kind,body,client_message_id) values(match_uuid,member_uuid,'text',btrim(message_body),client_uuid) returning * into inserted;
  update public.matches set last_message_at=inserted.created_at where id=match_uuid;
  select id,xp_reward into quest_uuid,quest_reward from public.daily_quests where slug='start-chat' and is_active limit 1;
  if quest_uuid is not null then
    insert into public.user_quest_progress(user_id,quest_id,quest_date,progress,completed_at,xp_claimed_at) values(member_uuid,quest_uuid,(now() at time zone 'Europe/Istanbul')::date,1,now(),now()) on conflict(user_id,quest_id,quest_date) do nothing;
    get diagnostics awarded=row_count; if awarded=1 then update public.profiles set xp=xp+quest_reward where id=member_uuid; end if;
  end if;
  select case when exists(select 1 from public.user_entitlements where profile_id=member_uuid and noir_until>now()) then 100 else 25 end into daily_limit;
  select coalesce(reply_count,0) into used_count from public.bot_reply_usage where profile_id=member_uuid and usage_date=(now() at time zone 'Europe/Istanbul')::date;
  return jsonb_build_object('allowed',true,'messageId',inserted.id,'createdAt',inserted.created_at,'remaining',greatest(daily_limit-used_count,0),'limit',daily_limit,'xpAwarded',case when awarded=1 then quest_reward else 0 end);
end;
$$;
revoke all on function public.send_bot_text_message_service(uuid,uuid,text,uuid) from public;
grant execute on function public.send_bot_text_message_service(uuid,uuid,text,uuid) to service_role;

create or replace function public.send_bot_audio_message_service(member_uuid uuid,match_uuid uuid,message_audio_path text,message_duration_ms integer,message_waveform smallint[],client_uuid uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare existing public.messages%rowtype; inserted public.messages%rowtype; quest_uuid uuid; quest_reward integer; awarded integer:=0; used_count integer:=0; daily_limit integer;
begin
  if auth.role()<>'service_role' then raise exception 'service_role_required'; end if;
  if client_uuid is null or message_duration_ms not between 500 and 60000 or cardinality(message_waveform) not between 8 and 48 then raise exception 'invalid_audio'; end if;
  if message_audio_path not like member_uuid::text||'/'||match_uuid::text||'/%' then raise exception 'invalid_audio_path'; end if;
  if not exists(select 1 from public.matches m join public.profiles p on p.id=case when m.user_a=member_uuid then m.user_b else m.user_a end where m.id=match_uuid and m.status='active' and member_uuid in(m.user_a,m.user_b) and p.kind='bot') then raise exception 'active_bot_match_required'; end if;
  select * into existing from public.messages where match_id=match_uuid and sender_id=member_uuid and client_message_id=client_uuid;
  if found then return jsonb_build_object('messageId',existing.id,'createdAt',existing.created_at,'duplicate',true); end if;
  insert into public.messages(match_id,sender_id,kind,audio_path,audio_duration_ms,audio_waveform,client_message_id) values(match_uuid,member_uuid,'audio',message_audio_path,message_duration_ms,message_waveform,client_uuid) returning * into inserted;
  update public.matches set last_message_at=inserted.created_at where id=match_uuid;
  select id,xp_reward into quest_uuid,quest_reward from public.daily_quests where slug='start-chat' and is_active limit 1;
  if quest_uuid is not null then
    insert into public.user_quest_progress(user_id,quest_id,quest_date,progress,completed_at,xp_claimed_at) values(member_uuid,quest_uuid,(now() at time zone 'Europe/Istanbul')::date,1,now(),now()) on conflict(user_id,quest_id,quest_date) do nothing;
    get diagnostics awarded=row_count; if awarded=1 then update public.profiles set xp=xp+quest_reward where id=member_uuid; end if;
  end if;
  select case when exists(select 1 from public.user_entitlements where profile_id=member_uuid and noir_until>now()) then 100 else 25 end into daily_limit;
  select coalesce(reply_count,0) into used_count from public.bot_reply_usage where profile_id=member_uuid and usage_date=(now() at time zone 'Europe/Istanbul')::date;
  return jsonb_build_object('allowed',true,'messageId',inserted.id,'createdAt',inserted.created_at,'remaining',greatest(daily_limit-used_count,0),'limit',daily_limit,'xpAwarded',case when awarded=1 then quest_reward else 0 end);
end;
$$;
revoke all on function public.send_bot_audio_message_service(uuid,uuid,text,integer,smallint[],uuid) from public;
grant execute on function public.send_bot_audio_message_service(uuid,uuid,text,integer,smallint[],uuid) to service_role;

create or replace function public.commit_bot_reply(
  job_uuid uuid, reply_body text, reply_provider text, reply_model text
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  reply_job public.bot_reply_jobs%rowtype;
  inserted_message public.messages%rowtype;
  today_tr date := (now() at time zone 'Europe/Istanbul')::date;
  used_count integer;
  daily_limit integer;
begin
  if auth.role() <> 'service_role' then raise exception 'service_role_required'; end if;
  if char_length(btrim(reply_body)) not between 1 and 1200 then raise exception 'invalid_reply'; end if;
  select * into reply_job from public.bot_reply_jobs where id=job_uuid and status='processing' for update;
  if not found then return jsonb_build_object('saved',false,'reason','job_unavailable'); end if;
  if reply_job.job_type='reply' then
    select case when exists(select 1 from public.user_entitlements where profile_id=reply_job.member_profile_id and noir_until>now()) then 100 else 25 end into daily_limit;
    insert into public.bot_reply_usage(profile_id,usage_date,reply_count) values(reply_job.member_profile_id,today_tr,0) on conflict(profile_id,usage_date) do nothing;
    select reply_count into used_count from public.bot_reply_usage where profile_id=reply_job.member_profile_id and usage_date=today_tr for update;
    if used_count>=daily_limit then
      update public.bot_reply_jobs set status='cancelled',cancellation_reason='quota_reached',completed_at=now(),updated_at=now() where id=job_uuid;
      return jsonb_build_object('saved',false,'reason','quota_reached','remaining',0);
    end if;
    update public.bot_reply_usage set reply_count=reply_count+1 where profile_id=reply_job.member_profile_id and usage_date=today_tr;
  else
    daily_limit := 0; used_count := -1;
  end if;
  insert into public.messages(match_id,sender_id,kind,body,ai_provider,ai_model)
  values(reply_job.match_id,reply_job.bot_profile_id,'text',btrim(reply_body),reply_provider,reply_model) returning * into inserted_message;
  update public.matches set last_message_at=inserted_message.created_at where id=reply_job.match_id;
  update public.bot_reply_jobs set status='sent',completed_at=inserted_message.created_at,updated_at=inserted_message.created_at where id=job_uuid;
  if reply_job.experiment_id is not null then
    update public.bot_experiment_assignments set sent_at=coalesce(sent_at,inserted_message.created_at)
    where experiment_id=reply_job.experiment_id and match_id=reply_job.match_id;
  end if;
  return jsonb_build_object('saved',true,'messageId',inserted_message.id,'createdAt',inserted_message.created_at,'remaining',case when reply_job.job_type='reply' then daily_limit-used_count-1 else null end);
end;
$$;
revoke all on function public.commit_bot_reply(uuid,text,text,text) from public;
grant execute on function public.commit_bot_reply(uuid,text,text,text) to service_role;

create or replace function public.publish_bot_persona_version(version_uuid uuid, actor_uuid uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare selected public.bot_persona_versions%rowtype;
begin
  if auth.role()<>'service_role' then raise exception 'service_role_required'; end if;
  select * into selected from public.bot_persona_versions where id=version_uuid for update;
  if not found then raise exception 'version_not_found'; end if;
  update public.bot_persona_versions set status='archived' where profile_id=selected.profile_id and status='published';
  update public.bot_persona_versions set status='published',published_by=actor_uuid,published_at=now() where id=version_uuid;
  update public.bot_personas set persona=selected.persona,provider=selected.provider,model=selected.model,updated_at=now() where profile_id=selected.profile_id;
  if not found then raise exception 'persona_not_found'; end if;
end;
$$;
revoke all on function public.publish_bot_persona_version(uuid,uuid) from public;
grant execute on function public.publish_bot_persona_version(uuid,uuid) to service_role;

do $$ begin
  if not exists (
    select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='matches'
  ) then alter publication supabase_realtime add table public.matches; end if;
end $$;


-- ===== 018_discovery_and_account_experience.sql =====
-- Discovery preferences, scarce super likes, Noir rewind, unmatch and account visibility.

alter table public.bot_experiments
  add column if not exists winner_variant text check (winner_variant in ('control','variant')),
  add column if not exists published_at timestamptz;

alter table public.discovery_preferences
  add column if not exists interested_genders text[] not null default array['kadın','erkek','nonbinary','other']::text[],
  add column if not exists same_city_only boolean not null default false;

alter table public.discovery_preferences drop constraint if exists discovery_preferences_interested_genders_check;
alter table public.discovery_preferences add constraint discovery_preferences_interested_genders_check
  check (cardinality(interested_genders) between 1 and 4 and interested_genders <@ array['kadın','erkek','nonbinary','other']::text[]);

create or replace function public.get_discovery_candidates(candidate_limit integer default 20)
returns table (id uuid,kind public.profile_kind,display_name text,age integer,city text,is_verified boolean,photo_path text,badges text[],prompt text,answer text)
language sql stable security definer set search_path=''
as $$
  select target.id,target.kind,target.display_name,extract(year from age(current_date,target.birth_date))::integer,target.city,target.is_verified,
    photo.photo_path,coalesce(badge_list.badges,array[]::text[]),response.prompt,response.answer
  from public.profiles target
  join public.profiles viewer on viewer.id=public.current_profile_id()
  left join public.discovery_preferences pref on pref.profile_id=viewer.id
  join lateral (
    select coalesce(pp.variants->>'960',pp.variants->>'480',pp.storage_path) photo_path from public.profile_photos pp
    where pp.profile_id=target.id and pp.processing_status='ready' and pp.moderation_status='approved'
    order by pp.is_primary desc,pp.sort_order limit 1
  ) photo on true
  left join lateral (
    select array_agg(ib.label order by ib.label) badges from public.profile_intentions pi join public.intent_badges ib on ib.id=pi.badge_id where pi.profile_id=target.id
  ) badge_list on true
  left join lateral (
    select ip.prompt,pa.answer from public.profile_answers pa join public.icebreaker_prompts ip on ip.id=pa.prompt_id
    where pa.profile_id=target.id order by pa.sort_order limit 1
  ) response on true
  where target.id<>viewer.id and target.is_discoverable and target.onboarding_completed and public.profile_is_visible(target.id)
    and (select count(*) from public.profile_photos approved_photo where approved_photo.profile_id=target.id and approved_photo.processing_status='ready' and approved_photo.moderation_status='approved')>=1
    and extract(year from age(current_date,target.birth_date))::integer between coalesce(pref.min_age,18) and coalesce(pref.max_age,80)
    and (not coalesce(pref.verified_only,false) or not exists(select 1 from public.user_entitlements ue where ue.profile_id=viewer.id and ue.noir_until>now()) or target.is_verified)
    and target.gender=any(coalesce(pref.interested_genders,array['kadın','erkek','nonbinary','other']::text[]))
    and (not coalesce(pref.same_city_only,false) or not exists(select 1 from public.user_entitlements ue where ue.profile_id=viewer.id and ue.noir_until>now()) or viewer.city is null or target.city=viewer.city)
    and not exists(select 1 from public.swipes s where s.swiper_id=viewer.id and s.target_id=target.id)
  order by exists(select 1 from public.swipes incoming where incoming.swiper_id=target.id and incoming.target_id=viewer.id and incoming.direction='super') desc,
    exists(select 1 from public.swipes incoming where incoming.swiper_id=target.id and incoming.target_id=viewer.id and incoming.direction='right') desc,
    md5(target.id::text||viewer.id::text||current_date::text)
  limit least(greatest(coalesce(candidate_limit,20),1),40);
$$;

create or replace function public.get_super_like_allowance()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  viewer uuid := public.current_profile_id();
  premium boolean;
  window_start timestamptz;
  window_end timestamptz;
  used_count integer;
begin
  if viewer is null then raise exception 'profile_required'; end if;
  premium := exists(select 1 from public.user_entitlements where profile_id=viewer and noir_until>now());
  if premium then
    window_start := date_trunc('day', now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul';
    window_end := window_start + interval '1 day';
  else
    window_start := date_trunc('week', now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul';
    window_end := window_start + interval '1 week';
  end if;
  select count(*)::integer into used_count from public.swipes
    where swiper_id=viewer and direction='super' and created_at>=window_start and created_at<window_end;
  return jsonb_build_object('remaining',greatest(1-used_count,0),'limit',1,'premium',premium,'resetsAt',window_end);
end;
$$;

create or replace function public.record_swipe(target_profile uuid, swipe_choice public.swipe_direction)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  viewer public.profiles%rowtype; target public.profiles%rowtype;
  positive boolean := swipe_choice in ('right','super'); reciprocal boolean := false;
  resulting_match uuid; quest_uuid uuid; quest_target integer; quest_reward integer;
  quest_progress integer := 0; awarded_rows integer := 0;
  today_tr date := (now() at time zone 'Europe/Istanbul')::date;
  allowance jsonb;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select * into viewer from public.profiles where user_id=auth.uid() and kind='human' for update;
  if not found or not viewer.onboarding_completed then raise exception 'onboarding_required'; end if;
  if viewer.id=target_profile then raise exception 'self_swipe_forbidden'; end if;
  perform pg_advisory_xact_lock(hashtextextended(viewer.id::text,0));
  select * into target from public.profiles where id=target_profile and is_discoverable and onboarding_completed;
  if not found or not public.profile_is_visible(target_profile) then raise exception 'target_unavailable'; end if;
  if exists(select 1 from public.swipes where swiper_id=viewer.id and target_id=target.id) then raise exception 'already_swiped'; end if;
  if swipe_choice='super' then
    allowance := public.get_super_like_allowance();
    if coalesce((allowance->>'remaining')::integer,0)<1 then raise exception 'super_like_limit_reached'; end if;
  end if;
  insert into public.swipes(swiper_id,target_id,direction) values(viewer.id,target.id,swipe_choice);
  if positive then
    reciprocal := target.kind='bot' or exists(select 1 from public.swipes where swiper_id=target.id and target_id=viewer.id and direction in ('right','super'));
    if reciprocal then
      insert into public.matches(user_a,user_b,status) values(least(viewer.id,target.id),greatest(viewer.id,target.id),'active')
      on conflict(user_a,user_b) do update set status='active',matched_at=now()
      returning id into resulting_match;
    end if;
    select id,target_count,xp_reward into quest_uuid,quest_target,quest_reward from public.daily_quests where slug='three-right-swipes' and is_active limit 1;
    if quest_uuid is not null then
      insert into public.user_quest_progress(user_id,quest_id,quest_date,progress) values(viewer.id,quest_uuid,today_tr,1)
      on conflict(user_id,quest_id,quest_date) do update set progress=least(public.user_quest_progress.progress+1,quest_target)
      returning progress into quest_progress;
      if quest_progress>=quest_target then
        update public.user_quest_progress set completed_at=coalesce(completed_at,now()),xp_claimed_at=now()
        where user_id=viewer.id and quest_id=quest_uuid and quest_date=today_tr and xp_claimed_at is null;
        get diagnostics awarded_rows=row_count;
        if awarded_rows=1 then update public.profiles set xp=xp+quest_reward where id=viewer.id; end if;
      end if;
    end if;
  else
    select coalesce(uqp.progress,0) into quest_progress from public.daily_quests dq left join public.user_quest_progress uqp
      on uqp.quest_id=dq.id and uqp.user_id=viewer.id and uqp.quest_date=today_tr where dq.slug='three-right-swipes' limit 1;
  end if;
  allowance := public.get_super_like_allowance();
  return jsonb_build_object('matched',resulting_match is not null,'matchId',resulting_match,'targetKind',target.kind,
    'questProgress',coalesce(quest_progress,0),'xpAwarded',case when awarded_rows=1 then quest_reward else 0 end,
    'superLike',allowance);
end;
$$;

create or replace function public.rewind_last_swipe()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  viewer uuid := public.current_profile_id(); last_swipe public.swipes%rowtype; match_row public.matches%rowtype;
  quest_uuid uuid; quest_target integer; quest_reward integer; progress_row public.user_quest_progress%rowtype;
  today_tr date := (now() at time zone 'Europe/Istanbul')::date;
begin
  if viewer is null then raise exception 'profile_required'; end if;
  if not exists(select 1 from public.user_entitlements where profile_id=viewer and noir_until>now()) then raise exception 'noir_required'; end if;
  select * into last_swipe from public.swipes where swiper_id=viewer order by created_at desc,id desc limit 1 for update;
  if not found then raise exception 'nothing_to_rewind'; end if;
  select * into match_row from public.matches where user_a=least(viewer,last_swipe.target_id) and user_b=greatest(viewer,last_swipe.target_id) and status='active' for update;
  if found and exists(select 1 from public.messages where match_id=match_row.id) then raise exception 'conversation_started'; end if;
  if found then
    delete from public.bot_reply_jobs where match_id=match_row.id;
    delete from public.matches where id=match_row.id;
  end if;
  if last_swipe.direction in ('right','super') then
    select id,target_count,xp_reward into quest_uuid,quest_target,quest_reward from public.daily_quests where slug='three-right-swipes' limit 1;
    select * into progress_row from public.user_quest_progress where user_id=viewer and quest_id=quest_uuid and quest_date=today_tr for update;
    if found then
      if progress_row.progress>=quest_target and progress_row.xp_claimed_at is not null then
        update public.profiles set xp=greatest(0,xp-quest_reward) where id=viewer;
      end if;
      update public.user_quest_progress set progress=greatest(progress-1,0),completed_at=null,xp_claimed_at=null
        where user_id=viewer and quest_id=quest_uuid and quest_date=today_tr;
    end if;
  end if;
  delete from public.swipes where id=last_swipe.id;
  return jsonb_build_object('profileId',last_swipe.target_id,'direction',last_swipe.direction);
end;
$$;

create or replace function public.unmatch_profile(target_profile uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare viewer uuid := public.current_profile_id(); match_uuid uuid;
begin
  if viewer is null then raise exception 'profile_required'; end if;
  update public.matches set status='unmatched'
    where status='active' and user_a=least(viewer,target_profile) and user_b=greatest(viewer,target_profile)
    returning id into match_uuid;
  if match_uuid is null then raise exception 'active_match_required'; end if;
  update public.bot_reply_jobs set status='cancelled',cancellation_reason='unmatched',completed_at=now(),updated_at=now()
    where match_id=match_uuid and status in ('queued','typing','processing');
end;
$$;

revoke all on function public.get_super_like_allowance() from public;
revoke all on function public.rewind_last_swipe() from public;
revoke all on function public.unmatch_profile(uuid) from public;
grant execute on function public.get_super_like_allowance() to authenticated;
grant execute on function public.rewind_last_swipe() to authenticated;
grant execute on function public.unmatch_profile(uuid) to authenticated;


-- ===== 019_shopier_checkout_idempotency.sql =====
-- Reuse one open Shopier checkout per profile and plan.

with ranked_open_shopier_orders as (
  select
    id,
    row_number() over (
      partition by profile_id, plan_id, provider
      order by created_at desc, id desc
    ) as position
  from public.payment_orders
  where provider = 'shopier'
    and status in ('awaiting_payment', 'pending')
)
update public.payment_orders as payment_order
set
  status = 'cancelled',
  updated_at = now()
from ranked_open_shopier_orders as ranked
where payment_order.id = ranked.id
  and ranked.position > 1;

create unique index if not exists payment_orders_one_open_shopier_checkout
  on public.payment_orders(profile_id, plan_id, provider)
  where provider = 'shopier'
    and status in ('awaiting_payment', 'pending');


-- ===== 020_notification_read_state.sql =====
-- Persist notification cursors without mutating the underlying like events.

create table if not exists public.notification_read_state (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  likes_seen_at timestamptz not null default 'epoch',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_read_state enable row level security;

create policy "users manage own notification read state"
on public.notification_read_state for all to authenticated
using (profile_id = public.current_profile_id())
with check (profile_id = public.current_profile_id());



-- ===== 021_blog_content.sql =====
-- SEO-ready editorial content and public blog cover storage.

do $$ begin
  create type public.blog_post_status as enum ('draft', 'published', 'archived');
exception when duplicate_object then null;
end $$;

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 10 and 120),
  excerpt text not null check (char_length(excerpt) between 50 and 320),
  content_markdown text not null check (char_length(content_markdown) between 200 and 60000),
  category text not null default 'İlişkiler' check (char_length(category) between 2 and 60),
  tags text[] not null default '{}',
  primary_keyword text check (primary_keyword is null or char_length(primary_keyword) between 2 and 100),
  seo_title text check (seo_title is null or char_length(seo_title) between 10 and 70),
  seo_description text check (seo_description is null or char_length(seo_description) between 50 and 170),
  cover_image_url text,
  cover_image_alt text check (cover_image_alt is null or char_length(cover_image_alt) between 5 and 180),
  author_name text not null default 'Lovask Editörleri' check (char_length(author_name) between 2 and 80),
  status public.blog_post_status not null default 'draft',
  published_at timestamptz,
  created_by uuid references public.admin_users(user_id),
  updated_by uuid references public.admin_users(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'published' or published_at is not null),
  check ((cover_image_url is null and cover_image_alt is null) or (cover_image_url is not null and cover_image_alt is not null))
);

create index if not exists blog_posts_public_timeline
  on public.blog_posts(status, published_at desc)
  where status = 'published';

alter table public.blog_posts enable row level security;

create policy "published blog posts are public"
on public.blog_posts for select to anon, authenticated
using (status = 'published' or public.has_admin_role(array['owner','bot_editor']));

create policy "editors manage blog posts"
on public.blog_posts for all to authenticated
using (public.has_admin_role(array['owner','bot_editor']))
with check (public.has_admin_role(array['owner','bot_editor']));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('blog-covers', 'blog-covers', true, 5242880, array['image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "public reads blog covers"
on storage.objects for select to anon, authenticated
using (bucket_id = 'blog-covers');

revoke insert, update, delete on public.blog_posts from anon, authenticated;



-- ===== 022_manual_payment_channels.sql =====
-- Admin-managed manual payment channels and optional payment proof.

alter table public.payment_orders
  drop constraint if exists payment_orders_provider_check;
alter table public.payment_orders
  add constraint payment_orders_provider_check
  check (provider in ('shopier','bank_transfer','papara','crypto','manual'));

alter table public.payment_orders
  add column if not exists sender_full_name text,
  add column if not exists payment_date date,
  add column if not exists external_reference text,
  add column if not exists submitted_at timestamptz;

create table if not exists public.payment_method_settings (
  method text primary key check (method in ('bank_transfer','papara','crypto')),
  enabled boolean not null default false,
  account_name text,
  bank_name text,
  iban text,
  papara_number text,
  crypto_asset text,
  crypto_network text,
  wallet_address text,
  instructions text,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

insert into public.payment_method_settings(method)
values ('bank_transfer'), ('papara'), ('crypto')
on conflict (method) do nothing;

alter table public.payment_method_settings enable row level security;
revoke all on public.payment_method_settings from anon, authenticated;

create or replace function public.create_noir_payment_order(plan_slug text, payment_provider text)
returns public.payment_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  buyer uuid := public.current_profile_id();
  selected_plan public.premium_plans%rowtype;
  created_order public.payment_orders%rowtype;
begin
  if buyer is null then raise exception 'profile_required'; end if;
  if payment_provider not in ('bank_transfer','papara','crypto','shopier') then raise exception 'invalid_provider'; end if;
  if payment_provider <> 'shopier' and not exists (
    select 1 from public.payment_method_settings
    where method = payment_provider and enabled
  ) then raise exception 'payment_method_unavailable'; end if;
  select * into selected_plan from public.premium_plans where slug = plan_slug and is_active for share;
  if not found then raise exception 'plan_unavailable'; end if;

  insert into public.payment_orders(profile_id,plan_id,provider,amount,currency,payment_reference)
  values (
    buyer, selected_plan.id, payment_provider, selected_plan.price_amount, selected_plan.currency,
    'LVK-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))
  ) returning * into created_order;
  return created_order;
end;
$$;

create or replace function public.submit_manual_payment(
  order_uuid uuid,
  sender_name text,
  paid_on date,
  provider_reference text default null,
  object_path text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  buyer uuid := public.current_profile_id();
begin
  if buyer is null then raise exception 'profile_required'; end if;
  if char_length(btrim(sender_name)) not between 3 and 120 then raise exception 'invalid_sender'; end if;
  if paid_on is null or paid_on > current_date or paid_on < current_date - 30 then raise exception 'invalid_payment_date'; end if;
  if provider_reference is not null and char_length(btrim(provider_reference)) > 160 then raise exception 'invalid_reference'; end if;
  if object_path is not null and object_path not like buyer::text || '/' || order_uuid::text || '/%' then
    raise exception 'invalid_proof_path';
  end if;

  update public.payment_orders
    set sender_full_name = btrim(sender_name),
        payment_date = paid_on,
        external_reference = nullif(btrim(provider_reference), ''),
        proof_path = object_path,
        submitted_at = now(),
        status = 'under_review',
        updated_at = now()
  where id = order_uuid and profile_id = buyer
    and provider in ('bank_transfer','papara','crypto')
    and status in ('awaiting_payment','under_review');
  if not found then raise exception 'order_not_submittable'; end if;
end;
$$;

revoke all on function public.submit_manual_payment(uuid,text,date,text,text) from public;
grant execute on function public.submit_manual_payment(uuid,text,date,text,text) to authenticated;


-- ===== 023_membership_applications.sql =====
-- Curated membership applications. Public writes go through the server API;
-- only trusted service-role/admin paths can read or mutate applicant data.

create table if not exists public.membership_applications (
  id uuid primary key default gen_random_uuid(),
  application_code text unique not null default ('LVK-A-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  email text not null check (char_length(email) between 5 and 254),
  full_name text not null check (char_length(full_name) between 3 and 120),
  instagram_username text check (instagram_username is null or char_length(instagram_username) between 1 and 30),
  occupation text not null check (char_length(occupation) between 2 and 120),
  industry text not null check (char_length(industry) between 2 and 120),
  city text check (city is null or char_length(city) between 2 and 80),
  application_note text check (application_note is null or char_length(application_note) between 10 and 800),
  marketing_consent boolean not null default false,
  privacy_notice_version text not null,
  status text not null default 'submitted' check (status in ('submitted','reviewing','approved','rejected','invited','withdrawn')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 2000),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  invited_user_id uuid references auth.users(id),
  invited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists membership_applications_email_unique
  on public.membership_applications (lower(email));
create index if not exists membership_applications_review_queue
  on public.membership_applications (status, created_at asc);
create index if not exists membership_applications_profile_filter
  on public.membership_applications (industry, occupation);

alter table public.membership_applications enable row level security;
revoke all on public.membership_applications from anon, authenticated;



-- ===== 024_application_contact_notifications.sql =====
-- Contact details and delivery bookkeeping for membership applications.

alter table public.membership_applications
  add column if not exists phone_e164 text,
  add column if not exists notification_consent boolean not null default false,
  add column if not exists receipt_email_sent_at timestamptz,
  add column if not exists receipt_sms_sent_at timestamptz,
  add column if not exists decision_email_sent_at timestamptz,
  add column if not exists decision_sms_sent_at timestamptz,
  add column if not exists invitation_sms_sent_at timestamptz,
  add column if not exists notification_last_error text;

alter table public.membership_applications
  drop constraint if exists membership_applications_phone_e164_check;

alter table public.membership_applications
  add constraint membership_applications_phone_e164_check
  check (phone_e164 is null or phone_e164 ~ '^\+905[0-9]{9}$');

create unique index if not exists membership_applications_phone_unique
  on public.membership_applications (phone_e164)
  where phone_e164 is not null;


-- ===== 025_support_tickets.sql =====
-- User support inbox with auditable admin workflow.

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null check (char_length(subject) between 3 and 120),
  category text not null default 'other' check (category in ('account','payment','safety','technical','other')),
  status text not null default 'open' check (status in ('open','waiting','in_progress','closed')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  assigned_to uuid references public.admin_users(user_id),
  last_message_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_profile_id uuid references public.profiles(id) on delete set null,
  sender_admin_id uuid references public.admin_users(user_id) on delete set null,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  check ((sender_profile_id is not null)::integer + (sender_admin_id is not null)::integer = 1)
);

create index if not exists support_tickets_queue_idx on public.support_tickets(status,priority,last_message_at desc);
create index if not exists support_ticket_messages_ticket_idx on public.support_ticket_messages(ticket_id,created_at);

alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;

create policy "members read own support tickets" on public.support_tickets for select to authenticated
using (profile_id = public.current_profile_id() or public.has_admin_role(array['owner','support']));
create policy "members create own support tickets" on public.support_tickets for insert to authenticated
with check (profile_id = public.current_profile_id());
create policy "support admins update tickets" on public.support_tickets for update to authenticated
using (public.has_admin_role(array['owner','support'])) with check (public.has_admin_role(array['owner','support']));
create policy "participants read support messages" on public.support_ticket_messages for select to authenticated
using (exists(select 1 from public.support_tickets t where t.id = ticket_id and (t.profile_id = public.current_profile_id() or public.has_admin_role(array['owner','support']))));
create policy "members write own support messages" on public.support_ticket_messages for insert to authenticated
with check (sender_profile_id = public.current_profile_id() and exists(select 1 from public.support_tickets t where t.id = ticket_id and t.profile_id = public.current_profile_id() and t.status <> 'closed'));
create policy "support admins write messages" on public.support_ticket_messages for insert to authenticated
with check (sender_admin_id = auth.uid() and public.has_admin_role(array['owner','support']));

revoke all on public.support_tickets, public.support_ticket_messages from anon;



-- ===== 026_admin_resource_reads.sql =====
create table if not exists public.admin_resource_reads (
  admin_user_id uuid not null references public.admin_users(user_id) on delete cascade,
  resource text not null check (resource in ('users')),
  seen_at timestamptz not null default now(),
  primary key(admin_user_id,resource)
);
alter table public.admin_resource_reads enable row level security;
create policy "admins manage own resource reads" on public.admin_resource_reads for all to authenticated
using (admin_user_id = auth.uid()) with check (admin_user_id = auth.uid());
revoke all on public.admin_resource_reads from anon;



-- ===== 027_webp_only_profile_photos.sql =====
-- Enforce modern image storage for every new profile photo record. Existing
-- legacy rows remain readable until the health screen cleanup is completed.
alter table public.profile_photos drop constraint if exists profile_photos_webp_only;
alter table public.profile_photos add constraint profile_photos_webp_only
check (
  storage_path ~* '\.webp$'
  and (variants is null or not jsonb_path_exists(variants, '$.* ? (@ like_regex ".*\\.(jpe?g|png|heic|heif)$" flag "i")'))
) not valid;



-- ===== 028_system_capacity_health.sql =====
create table if not exists public.system_capacity_settings (
  id boolean primary key default true check (id),
  database_limit_bytes bigint not null default 524288000 check (database_limit_bytes > 0),
  storage_limit_bytes bigint not null default 1073741824 check (storage_limit_bytes > 0),
  updated_by uuid references public.admin_users(user_id),
  updated_at timestamptz not null default now()
);
insert into public.system_capacity_settings(id) values(true) on conflict(id) do nothing;
alter table public.system_capacity_settings enable row level security;
create policy "owners manage capacity settings" on public.system_capacity_settings for all to authenticated
using (public.has_admin_role(array['owner'])) with check (public.has_admin_role(array['owner']));

create or replace function public.get_system_health_snapshot()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if auth.role() <> 'service_role' and not public.has_admin_role(array['owner']) then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'databaseBytes', pg_database_size(current_database()),
    'storageBytes', coalesce((select sum((metadata->>'size')::bigint) from storage.objects where metadata ? 'size'),0),
    'storageObjects', (select count(*) from storage.objects),
    'storageBuckets', (select count(*) from storage.buckets),
    'legacyProfileRows', (select count(*) from public.profile_photos where storage_path !~* '\.webp$' or coalesce(variants::text,'') ~* '\.(jpe?g|png|heic|heif)'),
    'failedBotJobs', (select count(*) from public.bot_reply_jobs where status='failed'),
    'queuedBotJobs', (select count(*) from public.bot_reply_jobs where status in ('queued','typing','processing')),
    'openSupportTickets', (select count(*) from public.support_tickets where status <> 'closed'),
    'pendingPhotos', (select count(*) from public.profile_photos where processing_status='ready' and moderation_status='pending'),
    'largestTables', coalesce((select jsonb_agg(x order by (x->>'bytes')::bigint desc) from (select jsonb_build_object('name',relname,'bytes',pg_total_relation_size(relid),'rows',n_live_tup) x from pg_stat_user_tables order by pg_total_relation_size(relid) desc limit 8) q),'[]'::jsonb)
  ) into result;
  return result;
end; $$;
revoke all on function public.get_system_health_snapshot() from public;
grant execute on function public.get_system_health_snapshot() to authenticated, service_role;
revoke all on public.system_capacity_settings from anon;



-- ===== 029_global_ai_prompt.sql =====
alter table public.ai_runtime_settings
  add column if not exists global_system_prompt text not null default 'Türkçe konuşma dilini kullan. Resmî ve robotik cümlelerden kaçın; bağlama göre sıcak, kısa ve doğal cevap ver. Her mesajı soruyla bitirme. Aynı kalıbı tekrar etme.',
  add column if not exists global_knowledge text not null default '';
update public.ai_runtime_settings set deepseek_model='deepseek-v4-flash' where deepseek_model='deepseek-chat';
update public.ai_runtime_settings set openrouter_model='deepseek/deepseek-v4-flash' where openrouter_model='openai/gpt-5.6-luna';
update public.ai_runtime_settings set default_provider='openrouter', fallback_order=array['deepseek','gemini','openai'] where default_provider='openai';


-- ===== 030_backfill_imported_bot_personas.sql =====
insert into public.bot_persona_versions (
  profile_id, version_number, status, persona, provider, model,
  created_by, published_by, published_at
)
select
  persona.profile_id, 1, 'published', persona.persona, persona.provider, persona.model,
  persona.created_by, persona.created_by, coalesce(persona.updated_at, now())
from public.bot_personas persona
where not exists (
  select 1 from public.bot_persona_versions version
  where version.profile_id = persona.profile_id and version.status = 'published'
);


-- ===== 031_bot_photo_sets_and_workspace.sql =====
-- Identity-safe bot photo sets and atomic profile photo organization.

create table if not exists public.bot_photo_sets (
  id uuid primary key default gen_random_uuid(),
  gender text not null check (gender in ('kadın', 'erkek')),
  age_band text not null check (age_band in ('18-24', '25-34', '35-44', '45+')),
  status text not null default 'available' check (status in ('available', 'assigning', 'assigned', 'archived')),
  assigned_profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.admin_users(user_id) on delete set null,
  created_at timestamptz not null default now(),
  assigned_at timestamptz,
  constraint assigned_photo_set_has_profile check (
    (status = 'available' and assigned_profile_id is null and assigned_at is null)
    or (status = 'assigning' and assigned_profile_id is not null and assigned_at is null)
    or (status in ('assigned', 'archived'))
  )
);

create table if not exists public.bot_photo_set_items (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.bot_photo_sets(id) on delete cascade,
  storage_path text not null unique,
  sort_order smallint not null check (sort_order between 0 and 5),
  width integer not null check (width between 1 and 12000),
  height integer not null check (height between 1 and 12000),
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  created_at timestamptz not null default now(),
  unique(set_id, sort_order)
);

alter table public.profile_photos
  add column if not exists source_set_id uuid references public.bot_photo_sets(id) on delete set null;

-- Photo ordering is rewritten as one transaction. Deferring this uniqueness
-- check lets rows cross positions without unsafe out-of-range placeholders.
alter table public.profile_photos drop constraint if exists profile_photos_profile_id_sort_order_key;
alter table public.profile_photos add constraint profile_photos_profile_id_sort_order_key
  unique(profile_id, sort_order) deferrable initially immediate;

create index if not exists bot_photo_sets_assignment_queue
  on public.bot_photo_sets(status, gender, age_band, created_at);
create index if not exists bot_photo_set_items_set_order
  on public.bot_photo_set_items(set_id, sort_order);
create index if not exists profile_photos_source_set
  on public.profile_photos(source_set_id) where source_set_id is not null;

alter table public.bot_photo_sets enable row level security;
alter table public.bot_photo_set_items enable row level security;

drop policy if exists "bot editors manage photo sets" on public.bot_photo_sets;
create policy "bot editors manage photo sets" on public.bot_photo_sets for all to authenticated
using (public.has_admin_role(array['owner','bot_editor']))
with check (public.has_admin_role(array['owner','bot_editor']));

drop policy if exists "bot editors manage photo set items" on public.bot_photo_set_items;
create policy "bot editors manage photo set items" on public.bot_photo_set_items for all to authenticated
using (public.has_admin_role(array['owner','bot_editor']))
with check (public.has_admin_role(array['owner','bot_editor']));

grant select, insert, update, delete on public.bot_photo_sets to authenticated;
grant select, insert, update, delete on public.bot_photo_set_items to authenticated;

create or replace function public.move_bot_photo(
  moved_photo_id uuid,
  target_profile_id uuid,
  target_position integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_profile_id uuid;
  source_primary boolean;
  source_count integer;
  target_count integer;
  insert_position integer;
  locked_target uuid;
begin
  if not public.has_admin_role(array['owner','bot_editor']) then
    raise exception 'admin_required';
  end if;

  select pp.profile_id, pp.is_primary into source_profile_id, source_primary
  from public.profile_photos pp
  join public.profiles p on p.id = pp.profile_id and p.kind = 'bot'
  where pp.id = moved_photo_id
  for update;
  if source_profile_id is null then raise exception 'photo_not_found'; end if;

  select id into locked_target from public.profiles where id = target_profile_id and kind = 'bot' for update;
  if locked_target is null then raise exception 'target_bot_not_found'; end if;
  if source_profile_id = target_profile_id then raise exception 'same_profile'; end if;

  -- Lock profiles in a deterministic order before counts and reordering.
  perform pg_advisory_xact_lock(hashtextextended(least(source_profile_id, target_profile_id)::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(greatest(source_profile_id, target_profile_id)::text, 0));

  select count(*) into source_count from public.profile_photos where profile_id = source_profile_id;
  select count(*) into target_count from public.profile_photos where profile_id = target_profile_id;
  if target_count >= 6 then raise exception 'photo_limit_reached'; end if;

  insert_position := greatest(0, least(coalesce(target_position, target_count), target_count));

  set constraints profile_photos_profile_id_sort_order_key deferred;
  update public.profile_photos set sort_order = sort_order + 1
    where profile_id = target_profile_id and sort_order >= insert_position;
  update public.profile_photos
    set profile_id = target_profile_id, sort_order = insert_position, is_primary = (target_count = 0)
    where id = moved_photo_id;

  with ordered as (
    select id, row_number() over(order by sort_order, created_at, id) - 1 as next_order
    from public.profile_photos where profile_id = source_profile_id
  )
  update public.profile_photos pp
    set sort_order = ordered.next_order,
        is_primary = case when source_primary then ordered.next_order = 0 else pp.is_primary end
  from ordered where pp.id = ordered.id;

  if source_count = 1 then
    update public.profiles set is_discoverable = false, updated_at = now() where id = source_profile_id;
  end if;

  return jsonb_build_object(
    'photoId', moved_photo_id,
    'sourceProfileId', source_profile_id,
    'targetProfileId', target_profile_id,
    'sourceBecameEmpty', source_count = 1
  );
end;
$$;

revoke all on function public.move_bot_photo(uuid,uuid,integer) from public;
grant execute on function public.move_bot_photo(uuid,uuid,integer) to authenticated;

create or replace function public.set_bot_primary_photo(photo_uuid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare target_profile uuid;
begin
  if not public.has_admin_role(array['owner','bot_editor']) then raise exception 'admin_required'; end if;
  select pp.profile_id into target_profile
  from public.profile_photos pp join public.profiles p on p.id = pp.profile_id and p.kind = 'bot'
  where pp.id = photo_uuid for update;
  if target_profile is null then raise exception 'photo_not_found'; end if;
  update public.profile_photos set is_primary = false where profile_id = target_profile and is_primary;
  update public.profile_photos set is_primary = true where id = photo_uuid;
end;
$$;

revoke all on function public.set_bot_primary_photo(uuid) from public;
grant execute on function public.set_bot_primary_photo(uuid) to authenticated;


-- ===== 032_fix_bot_photo_drag_drop.sql =====
-- Repair the first live version of bot photo movement. The original function
-- used temporary sort orders outside the profile_photos 0..8 check range.

alter table public.bot_photo_sets drop constraint if exists bot_photo_sets_status_check;
alter table public.bot_photo_sets add constraint bot_photo_sets_status_check
  check (status in ('available', 'assigning', 'assigned', 'archived'));

alter table public.bot_photo_sets drop constraint if exists assigned_photo_set_has_profile;
alter table public.bot_photo_sets add constraint assigned_photo_set_has_profile check (
  (status = 'available' and assigned_profile_id is null and assigned_at is null)
  or (status = 'assigning' and assigned_profile_id is not null and assigned_at is null)
  or (status in ('assigned', 'archived'))
);

alter table public.profile_photos drop constraint if exists profile_photos_profile_id_sort_order_key;
alter table public.profile_photos add constraint profile_photos_profile_id_sort_order_key
  unique(profile_id, sort_order) deferrable initially immediate;

create or replace function public.move_bot_photo(
  moved_photo_id uuid,
  target_profile_id uuid,
  target_position integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_profile_id uuid;
  source_primary boolean;
  source_count integer;
  target_count integer;
  insert_position integer;
  locked_target uuid;
begin
  if not public.has_admin_role(array['owner','bot_editor']) then
    raise exception 'admin_required';
  end if;

  select pp.profile_id, pp.is_primary into source_profile_id, source_primary
  from public.profile_photos pp
  join public.profiles p on p.id = pp.profile_id and p.kind = 'bot'
  where pp.id = moved_photo_id
  for update;
  if source_profile_id is null then raise exception 'photo_not_found'; end if;

  select id into locked_target
  from public.profiles
  where id = target_profile_id and kind = 'bot'
  for update;
  if locked_target is null then raise exception 'target_bot_not_found'; end if;
  if source_profile_id = target_profile_id then raise exception 'same_profile'; end if;

  perform pg_advisory_xact_lock(hashtextextended(least(source_profile_id, target_profile_id)::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(greatest(source_profile_id, target_profile_id)::text, 0));

  select count(*) into source_count from public.profile_photos where profile_id = source_profile_id;
  select count(*) into target_count from public.profile_photos where profile_id = target_profile_id;
  if target_count >= 6 then raise exception 'photo_limit_reached'; end if;

  insert_position := greatest(0, least(coalesce(target_position, target_count), target_count));
  set constraints profile_photos_profile_id_sort_order_key deferred;

  update public.profile_photos
  set sort_order = sort_order + 1
  where profile_id = target_profile_id and sort_order >= insert_position;

  update public.profile_photos
  set profile_id = target_profile_id,
      sort_order = insert_position,
      is_primary = (target_count = 0)
  where id = moved_photo_id;

  with ordered as (
    select id, row_number() over(order by sort_order, created_at, id) - 1 as next_order
    from public.profile_photos
    where profile_id = source_profile_id
  )
  update public.profile_photos pp
  set sort_order = ordered.next_order,
      is_primary = case when source_primary then ordered.next_order = 0 else pp.is_primary end
  from ordered
  where pp.id = ordered.id;

  if source_count = 1 then
    update public.profiles
    set is_discoverable = false, updated_at = now()
    where id = source_profile_id;
  end if;

  return jsonb_build_object(
    'photoId', moved_photo_id,
    'sourceProfileId', source_profile_id,
    'targetProfileId', target_profile_id,
    'sourceBecameEmpty', source_count = 1
  );
end;
$$;

revoke all on function public.move_bot_photo(uuid,uuid,integer) from public;
grant execute on function public.move_bot_photo(uuid,uuid,integer) to authenticated;


-- ===== 033_delayed_bot_matches.sql =====
-- Bot likes resolve once at swipe time: 25% become delayed matches, the rest stay rejected.

create table if not exists public.bot_match_decisions (
  id uuid primary key default gen_random_uuid(),
  member_profile_id uuid not null references public.profiles(id) on delete cascade,
  bot_profile_id uuid not null references public.profiles(id) on delete cascade,
  swipe_id bigint not null references public.swipes(id) on delete cascade,
  status text not null check (status in ('queued','rejected','matched','cancelled')),
  scheduled_for timestamptz,
  matched_at timestamptz,
  match_id uuid references public.matches(id) on delete set null,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(member_profile_id,bot_profile_id),
  check ((status='queued' and scheduled_for is not null) or status<>'queued')
);
create index if not exists bot_match_decisions_due on public.bot_match_decisions(status,scheduled_for) where status='queued';
alter table public.bot_match_decisions enable row level security;
drop policy if exists "admins inspect bot match decisions" on public.bot_match_decisions;
create policy "admins inspect bot match decisions" on public.bot_match_decisions for select to authenticated
using (public.has_admin_role(array['owner','bot_editor','support']));
revoke all on public.bot_match_decisions from anon,authenticated;

create or replace function public.record_swipe(target_profile uuid, swipe_choice public.swipe_direction)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  viewer public.profiles%rowtype; target public.profiles%rowtype; inserted_swipe public.swipes%rowtype;
  positive boolean := swipe_choice in ('right','super'); reciprocal boolean := false;
  resulting_match uuid; quest_uuid uuid; quest_target integer; quest_reward integer;
  quest_progress integer := 0; awarded_rows integer := 0; today_tr date := (now() at time zone 'Europe/Istanbul')::date;
  allowance jsonb; bot_will_match boolean := false; bot_due timestamptz;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select * into viewer from public.profiles where user_id=auth.uid() and kind='human' for update;
  if not found or not viewer.onboarding_completed then raise exception 'onboarding_required'; end if;
  if viewer.id=target_profile then raise exception 'self_swipe_forbidden'; end if;
  perform pg_advisory_xact_lock(hashtextextended(viewer.id::text,0));
  select * into target from public.profiles where id=target_profile and is_discoverable and onboarding_completed;
  if not found or not public.profile_is_visible(target_profile) then raise exception 'target_unavailable'; end if;
  if exists(select 1 from public.swipes where swiper_id=viewer.id and target_id=target.id) then raise exception 'already_swiped'; end if;
  if swipe_choice='super' then
    allowance := public.get_super_like_allowance();
    if coalesce((allowance->>'remaining')::integer,0)<1 then raise exception 'super_like_limit_reached'; end if;
  end if;
  insert into public.swipes(swiper_id,target_id,direction) values(viewer.id,target.id,swipe_choice) returning * into inserted_swipe;
  if positive then
    if target.kind='bot' then
      bot_will_match := random()<0.25;
      if bot_will_match then
        bot_due := now() + case when random()<0.5
          then make_interval(secs => 300 + floor(random()*3301)::integer)
          else make_interval(secs => 3600 + floor(random()*18001)::integer) end;
      end if;
      insert into public.bot_match_decisions(member_profile_id,bot_profile_id,swipe_id,status,scheduled_for)
      values(viewer.id,target.id,inserted_swipe.id,case when bot_will_match then 'queued' else 'rejected' end,bot_due);
    else
      reciprocal := exists(select 1 from public.swipes where swiper_id=target.id and target_id=viewer.id and direction in ('right','super'));
      if reciprocal then
        insert into public.matches(user_a,user_b,status) values(least(viewer.id,target.id),greatest(viewer.id,target.id),'active')
        on conflict(user_a,user_b) do update set status='active',matched_at=now() returning id into resulting_match;
      end if;
    end if;
    select id,target_count,xp_reward into quest_uuid,quest_target,quest_reward from public.daily_quests where slug='three-right-swipes' and is_active limit 1;
    if quest_uuid is not null then
      insert into public.user_quest_progress(user_id,quest_id,quest_date,progress) values(viewer.id,quest_uuid,today_tr,1)
      on conflict(user_id,quest_id,quest_date) do update set progress=least(public.user_quest_progress.progress+1,quest_target) returning progress into quest_progress;
      if quest_progress>=quest_target then
        update public.user_quest_progress set completed_at=coalesce(completed_at,now()),xp_claimed_at=now()
        where user_id=viewer.id and quest_id=quest_uuid and quest_date=today_tr and xp_claimed_at is null;
        get diagnostics awarded_rows=row_count;
        if awarded_rows=1 then update public.profiles set xp=xp+quest_reward where id=viewer.id; end if;
      end if;
    end if;
  else
    select coalesce(uqp.progress,0) into quest_progress from public.daily_quests dq left join public.user_quest_progress uqp
      on uqp.quest_id=dq.id and uqp.user_id=viewer.id and uqp.quest_date=today_tr where dq.slug='three-right-swipes' limit 1;
  end if;
  allowance := public.get_super_like_allowance();
  return jsonb_build_object('matched',resulting_match is not null,'matchId',resulting_match,'targetKind',target.kind,
    'botMatchPending',target.kind='bot' and bot_will_match,'questProgress',coalesce(quest_progress,0),
    'xpAwarded',case when awarded_rows=1 then quest_reward else 0 end,'superLike',allowance);
end;
$$;

create or replace function public.process_due_bot_matches_service(batch_limit integer default 20, only_member uuid default null)
returns table(decision_id uuid,match_id uuid,member_profile_id uuid,bot_profile_id uuid)
language plpgsql security definer set search_path=''
as $$
declare decision public.bot_match_decisions%rowtype; created_match uuid;
begin
  if auth.role()<>'service_role' then raise exception 'service_role_required'; end if;
  for decision in
    select d.* from public.bot_match_decisions d
    where d.status='queued' and d.scheduled_for<=now() and (only_member is null or d.member_profile_id=only_member)
    order by d.scheduled_for for update skip locked limit greatest(1,least(batch_limit,100))
  loop
    if not exists(select 1 from public.profiles where id=decision.member_profile_id and kind='human' and onboarding_completed and is_discoverable)
      or not exists(select 1 from public.profiles where id=decision.bot_profile_id and kind='bot' and onboarding_completed and is_discoverable)
      or exists(select 1 from public.blocks where (blocker_id=decision.member_profile_id and blocked_id=decision.bot_profile_id) or (blocker_id=decision.bot_profile_id and blocked_id=decision.member_profile_id)) then
      update public.bot_match_decisions set status='cancelled',cancellation_reason='profile_unavailable',updated_at=now() where id=decision.id;
      continue;
    end if;
    insert into public.matches(user_a,user_b,status) values(least(decision.member_profile_id,decision.bot_profile_id),greatest(decision.member_profile_id,decision.bot_profile_id),'active')
    on conflict(user_a,user_b) do update set status='active',matched_at=now() returning id into created_match;
    update public.bot_match_decisions set status='matched',match_id=created_match,matched_at=now(),updated_at=now() where id=decision.id;
    decision_id:=decision.id; match_id:=created_match; member_profile_id:=decision.member_profile_id; bot_profile_id:=decision.bot_profile_id; return next;
  end loop;
end;
$$;
revoke all on function public.process_due_bot_matches_service(integer,uuid) from public;
grant execute on function public.process_due_bot_matches_service(integer,uuid) to service_role;

create or replace function public.rewind_last_swipe()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare viewer uuid:=public.current_profile_id(); last_swipe public.swipes%rowtype; match_row public.matches%rowtype;
begin
  if viewer is null then raise exception 'authentication_required'; end if;
  if not exists(select 1 from public.user_entitlements where profile_id=viewer and noir_until>now()) then raise exception 'noir_required'; end if;
  select * into last_swipe from public.swipes where swiper_id=viewer order by created_at desc,id desc limit 1 for update;
  if not found then raise exception 'nothing_to_rewind'; end if;
  select * into match_row from public.matches where user_a=least(viewer,last_swipe.target_id) and user_b=greatest(viewer,last_swipe.target_id) and status='active' for update;
  if found and exists(select 1 from public.messages where match_id=match_row.id) then raise exception 'conversation_started'; end if;
  if found then delete from public.matches where id=match_row.id; end if;
  delete from public.bot_match_decisions where swipe_id=last_swipe.id;
  delete from public.swipes where id=last_swipe.id;
  return jsonb_build_object('profileId',last_swipe.target_id,'direction',last_swipe.direction);
end;
$$;

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='bot_match_decisions') then
    alter publication supabase_realtime add table public.bot_match_decisions;
  end if;
end $$;


-- ===== 034_bot_message_rate_and_new_member_likes.sql =====
-- Keep proactive bot outreach scarce and seed new members with a small, idempotent daily like flow.

create or replace function public.record_swipe(target_profile uuid, swipe_choice public.swipe_direction)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  viewer public.profiles%rowtype; target public.profiles%rowtype; inserted_swipe public.swipes%rowtype;
  positive boolean := swipe_choice in ('right','super'); reciprocal boolean := false;
  resulting_match uuid; quest_uuid uuid; quest_target integer; quest_reward integer;
  quest_progress integer := 0; awarded_rows integer := 0; today_tr date := (now() at time zone 'Europe/Istanbul')::date;
  allowance jsonb; bot_will_match boolean := false; bot_due timestamptz; bot_delay_bucket integer;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select * into viewer from public.profiles where user_id=auth.uid() and kind='human' for update;
  if not found or not viewer.onboarding_completed then raise exception 'onboarding_required'; end if;
  if viewer.id=target_profile then raise exception 'self_swipe_forbidden'; end if;
  perform pg_advisory_xact_lock(hashtextextended(viewer.id::text,0));
  select * into target from public.profiles where id=target_profile and is_discoverable and onboarding_completed;
  if not found or not public.profile_is_visible(target_profile) then raise exception 'target_unavailable'; end if;
  if exists(select 1 from public.swipes where swiper_id=viewer.id and target_id=target.id) then raise exception 'already_swiped'; end if;
  if swipe_choice='super' then
    allowance := public.get_super_like_allowance();
    if coalesce((allowance->>'remaining')::integer,0)<1 then raise exception 'super_like_limit_reached'; end if;
  end if;
  insert into public.swipes(swiper_id,target_id,direction) values(viewer.id,target.id,swipe_choice) returning * into inserted_swipe;
  if positive then
    if target.kind='bot' then
      -- A stable member/bot cohort makes exactly the same decision on retries. Roughly 10% of
      -- positively-swiped bots become a delayed match and can therefore send the first message.
      bot_will_match := mod(abs(hashtextextended(viewer.id::text || ':' || target.id::text, 10)::numeric),100)<10;
      if bot_will_match then
        bot_delay_bucket := mod(abs(hashtextextended(target.id::text || ':' || viewer.id::text, 20)::numeric),21601)::integer;
        bot_due := now() + case when bot_delay_bucket<10800
          then make_interval(secs => 300 + mod(bot_delay_bucket,3301))
          else make_interval(secs => 3600 + mod(bot_delay_bucket,18001)) end;
      end if;
      insert into public.bot_match_decisions(member_profile_id,bot_profile_id,swipe_id,status,scheduled_for)
      values(viewer.id,target.id,inserted_swipe.id,case when bot_will_match then 'queued' else 'rejected' end,bot_due);
    else
      reciprocal := exists(select 1 from public.swipes where swiper_id=target.id and target_id=viewer.id and direction in ('right','super'));
      if reciprocal then
        insert into public.matches(user_a,user_b,status) values(least(viewer.id,target.id),greatest(viewer.id,target.id),'active')
        on conflict(user_a,user_b) do update set status='active',matched_at=now() returning id into resulting_match;
      end if;
    end if;
    select id,target_count,xp_reward into quest_uuid,quest_target,quest_reward from public.daily_quests where slug='three-right-swipes' and is_active limit 1;
    if quest_uuid is not null then
      insert into public.user_quest_progress(user_id,quest_id,quest_date,progress) values(viewer.id,quest_uuid,today_tr,1)
      on conflict(user_id,quest_id,quest_date) do update set progress=least(public.user_quest_progress.progress+1,quest_target) returning progress into quest_progress;
      if quest_progress>=quest_target then
        update public.user_quest_progress set completed_at=coalesce(completed_at,now()),xp_claimed_at=now()
        where user_id=viewer.id and quest_id=quest_uuid and quest_date=today_tr and xp_claimed_at is null;
        get diagnostics awarded_rows=row_count;
        if awarded_rows=1 then update public.profiles set xp=xp+quest_reward where id=viewer.id; end if;
      end if;
    end if;
  else
    select coalesce(uqp.progress,0) into quest_progress from public.daily_quests dq left join public.user_quest_progress uqp
      on uqp.quest_id=dq.id and uqp.user_id=viewer.id and uqp.quest_date=today_tr where dq.slug='three-right-swipes' limit 1;
  end if;
  allowance := public.get_super_like_allowance();
  return jsonb_build_object('matched',resulting_match is not null,'matchId',resulting_match,'targetKind',target.kind,
    'botMatchPending',target.kind='bot' and bot_will_match,'questProgress',coalesce(quest_progress,0),
    'xpAwarded',case when awarded_rows=1 then quest_reward else 0 end,'superLike',allowance);
end;
$$;

-- On every worker pass, fill each member's daily allocation instead of adding blindly. The
-- unique swiper/target constraint plus the day count make retries and concurrent workers safe.
create or replace function public.seed_new_member_bot_likes_service(member_limit integer default 50)
returns table(member_profile_id uuid, bot_profile_id uuid, swipe_id bigint)
language plpgsql security definer set search_path=''
as $$
declare
  member_row record; bot_row record; desired integer; delivered integer; inserted_id bigint;
  today_tr date := (now() at time zone 'Europe/Istanbul')::date;
  day_start timestamptz := today_tr::timestamp at time zone 'Europe/Istanbul';
  day_end timestamptz := (today_tr + 1)::timestamp at time zone 'Europe/Istanbul';
begin
  if auth.role()<>'service_role' then raise exception 'service_role_required'; end if;
  for member_row in
    select p.id from public.profiles p
    where p.kind='human' and p.onboarding_completed and p.is_discoverable
      and p.created_at>=now()-interval '14 days'
      and (select count(*) from public.swipes daily_swipe join public.profiles daily_bot
        on daily_bot.id=daily_swipe.swiper_id and daily_bot.kind='bot'
        where daily_swipe.target_id=p.id and daily_swipe.direction in ('right','super')
          and daily_swipe.created_at>=day_start and daily_swipe.created_at<day_end)
        < 1 + mod(abs(hashtextextended(p.id::text || ':' || today_tr::text, 30)::numeric),2)
    order by p.created_at desc
    limit greatest(1,least(member_limit,200))
  loop
    perform pg_advisory_xact_lock(hashtextextended(member_row.id::text, 50));
    desired := 1 + mod(abs(hashtextextended(member_row.id::text || ':' || today_tr::text, 30)::numeric),2)::integer;
    select count(*)::integer into delivered
    from public.swipes s join public.profiles b on b.id=s.swiper_id and b.kind='bot'
    where s.target_id=member_row.id and s.direction in ('right','super')
      and s.created_at>=day_start and s.created_at<day_end;
    if delivered>=desired then continue; end if;
    for bot_row in
      select b.id from public.profiles b
      where b.kind='bot' and b.onboarding_completed and b.is_discoverable
        and not exists(select 1 from public.swipes s where s.swiper_id=b.id and s.target_id=member_row.id)
        and not exists(select 1 from public.blocks x where
          (x.blocker_id=b.id and x.blocked_id=member_row.id) or (x.blocker_id=member_row.id and x.blocked_id=b.id))
      order by hashtextextended(b.id::text || ':' || member_row.id::text || ':' || today_tr::text, 40)
      limit (desired-delivered)
    loop
      insert into public.swipes(swiper_id,target_id,direction)
      values(bot_row.id,member_row.id,'right') on conflict(swiper_id,target_id) do nothing returning id into inserted_id;
      if inserted_id is not null then
        member_profile_id:=member_row.id; bot_profile_id:=bot_row.id; swipe_id:=inserted_id; return next;
      end if;
      inserted_id:=null;
    end loop;
  end loop;
end;
$$;

revoke all on function public.seed_new_member_bot_likes_service(integer) from public;
grant execute on function public.seed_new_member_bot_likes_service(integer) to service_role;

-- Bring work queued under the former 25% random policy into the same stable 10% cohort.
update public.bot_match_decisions d
set status='rejected', scheduled_for=null, updated_at=now()
where d.status='queued'
  and mod(abs(hashtextextended(d.member_profile_id::text || ':' || d.bot_profile_id::text, 10)::numeric),100)>=10;

update public.bot_reply_jobs j
set status='cancelled', cancellation_reason='first_message_cohort_reduced', completed_at=now(), updated_at=now()
where j.job_type='first_message' and j.status in ('queued','typing')
  and mod(abs(hashtextextended(j.member_profile_id::text || ':' || j.bot_profile_id::text, 10)::numeric),100)>=10;


-- ===== 035_product_contracts_and_limits.sql =====
-- Product contracts agreed on 2026-08-15: explicit connection states,
-- scarce standard likes, truthful message counters, profile compatibility and
-- durable privacy/safety settings.

alter table public.profiles
  add column if not exists district text,
  add column if not exists gender_detail text,
  add column if not exists relationship_goal text,
  add column if not exists marital_status text,
  add column if not exists has_children boolean,
  add column if not exists children_preference text,
  add column if not exists alcohol_use text,
  add column if not exists smoking_use text,
  add column if not exists pet_preference text,
  add column if not exists sports_habit text,
  add column if not exists height_cm smallint,
  add column if not exists education_level text,
  add column if not exists languages text[] not null default array[]::text[],
  add column if not exists verification_status text not null default 'unverified',
  add column if not exists safety_restricted_at timestamptz,
  add column if not exists deleted_at timestamptz;

alter table public.profiles drop constraint if exists profiles_relationship_goal_check;
alter table public.profiles add constraint profiles_relationship_goal_check check (
  relationship_goal is null or relationship_goal in ('marriage','serious','dating','short_term','friendship','unsure')
);
alter table public.profiles drop constraint if exists profiles_marital_status_check;
alter table public.profiles add constraint profiles_marital_status_check check (
  marital_status is null or marital_status in ('never_married','divorced','widowed','separated','married')
);
alter table public.profiles drop constraint if exists profiles_children_preference_check;
alter table public.profiles add constraint profiles_children_preference_check check (
  children_preference is null or children_preference in ('want','do_not_want','open','unsure')
);
alter table public.profiles drop constraint if exists profiles_height_check;
alter table public.profiles add constraint profiles_height_check check (height_cm is null or height_cm between 120 and 230);
alter table public.profiles drop constraint if exists profiles_verification_status_check;
alter table public.profiles add constraint profiles_verification_status_check check (
  verification_status in ('unverified','pending','verified','rejected','suspended')
);

alter table public.discovery_preferences
  add column if not exists cities text[] not null default array[]::text[],
  add column if not exists max_distance_km integer,
  add column if not exists relationship_goals text[] not null default array[]::text[],
  add column if not exists marital_statuses text[] not null default array[]::text[],
  add column if not exists has_children_values boolean[] not null default array[]::boolean[],
  add column if not exists children_preferences text[] not null default array[]::text[],
  add column if not exists alcohol_values text[] not null default array[]::text[],
  add column if not exists smoking_values text[] not null default array[]::text[],
  add column if not exists pet_values text[] not null default array[]::text[],
  add column if not exists sports_values text[] not null default array[]::text[],
  add column if not exists zodiac_values text[] not null default array[]::text[],
  add column if not exists min_height_cm integer,
  add column if not exists max_height_cm integer,
  add column if not exists education_values text[] not null default array[]::text[],
  add column if not exists language_values text[] not null default array[]::text[];

alter table public.matches
  add column if not exists connection_type text not null default 'matched',
  add column if not exists request_sender_id uuid references public.profiles(id) on delete set null,
  add column if not exists request_status text,
  add column if not exists request_expires_at timestamptz,
  add column if not exists closed_at timestamptz;
alter table public.matches drop constraint if exists matches_connection_type_check;
alter table public.matches add constraint matches_connection_type_check check (
  connection_type in ('matched','message_request','direct_chat')
);
alter table public.matches drop constraint if exists matches_request_status_check;
alter table public.matches add constraint matches_request_status_check check (
  request_status is null or request_status in ('draft','pending','accepted','rejected','expired','closed')
);

-- Preserve historical direct conversations without relying on a magic date in
-- application code. Mutual likes and completed bot decisions are matches;
-- other active rows with messages become accepted direct chats.
update public.matches m set connection_type = case
  when exists(select 1 from public.swipes a where a.swiper_id=m.user_a and a.target_id=m.user_b and a.direction in ('right','super'))
   and exists(select 1 from public.swipes b where b.swiper_id=m.user_b and b.target_id=m.user_a and b.direction in ('right','super')) then 'matched'
  when exists(select 1 from public.bot_match_decisions d where d.match_id=m.id and d.status='matched') then 'matched'
  when exists(select 1 from public.messages msg where msg.match_id=m.id) then 'direct_chat'
  else 'matched'
end,
request_status = case when exists(select 1 from public.messages msg where msg.match_id=m.id)
  and not (
    exists(select 1 from public.swipes a where a.swiper_id=m.user_a and a.target_id=m.user_b and a.direction in ('right','super'))
    and exists(select 1 from public.swipes b where b.swiper_id=m.user_b and b.target_id=m.user_a and b.direction in ('right','super'))
  ) then 'accepted' else null end
where m.connection_type='matched';

create table if not exists public.swipe_daily_usage (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  usage_date date not null,
  like_count integer not null default 0 check(like_count>=0),
  primary key(profile_id,usage_date)
);
create table if not exists public.message_request_daily_usage (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  usage_date date not null,
  request_count integer not null default 0 check(request_count>=0),
  primary key(profile_id,usage_date)
);
alter table public.swipe_daily_usage enable row level security;
alter table public.message_request_daily_usage enable row level security;
drop policy if exists "users see own swipe usage" on public.swipe_daily_usage;
create policy "users see own swipe usage" on public.swipe_daily_usage for select to authenticated
using(profile_id=public.current_profile_id());
drop policy if exists "users see own request usage" on public.message_request_daily_usage;
create policy "users see own request usage" on public.message_request_daily_usage for select to authenticated
using(profile_id=public.current_profile_id());
revoke insert,update,delete on public.swipe_daily_usage from anon,authenticated;
revoke insert,update,delete on public.message_request_daily_usage from anon,authenticated;

create table if not exists public.profile_verification_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  selfie_path text,
  challenge text not null,
  status text not null default 'pending' check(status in ('pending','approved','rejected','cancelled')),
  rejection_reason text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  media_deleted_at timestamptz,
  media_deleted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists profile_verification_one_pending
  on public.profile_verification_requests(profile_id) where status='pending';
alter table public.profile_verification_requests enable row level security;
drop policy if exists "users see own verification" on public.profile_verification_requests;
create policy "users see own verification" on public.profile_verification_requests for select to authenticated
using(profile_id=public.current_profile_id() or public.has_admin_role(array['owner','moderator','support']));
revoke insert,update,delete on public.profile_verification_requests from anon,authenticated;

create table if not exists public.legal_acceptances (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null check(document_type in ('terms','privacy','community','noir_payment','marketing')),
  document_version text not null,
  accepted boolean not null,
  accepted_at timestamptz not null default now(),
  unique(user_id,document_type,document_version)
);
alter table public.legal_acceptances enable row level security;
drop policy if exists "users see own legal acceptances" on public.legal_acceptances;
create policy "users see own legal acceptances" on public.legal_acceptances for select to authenticated using(user_id=auth.uid());
revoke insert,update,delete on public.legal_acceptances from anon,authenticated;

alter table public.notification_preferences
  add column if not exists likes_enabled boolean not null default true,
  add column if not exists matches_enabled boolean not null default true,
  add column if not exists visitors_enabled boolean not null default true,
  add column if not exists messages_enabled boolean not null default true,
  add column if not exists message_requests_enabled boolean not null default true,
  add column if not exists admin_updates_enabled boolean not null default true,
  add column if not exists product_updates_enabled boolean not null default false,
  add column if not exists incognito_enabled boolean not null default false,
  add column if not exists incognito_started_at timestamptz;

create or replace function public.profile_details_complete(profile_uuid uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select coalesce(p.city,'')<>'' and p.relationship_goal is not null and p.marital_status is not null
    and p.has_children is not null and p.children_preference is not null
  from public.profiles p where p.id=profile_uuid and p.kind='human';
$$;

create or replace function public.mutually_eligible(viewer_uuid uuid,target_uuid uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(
    select 1 from public.profiles viewer
    join public.profiles target on target.id=target_uuid
    left join public.discovery_preferences vp on vp.profile_id=viewer.id
    left join public.discovery_preferences tp on tp.profile_id=target.id
    where viewer.id=viewer_uuid and viewer.kind='human' and target.kind in ('human','bot')
      and viewer.onboarding_completed and target.onboarding_completed
      and viewer.deleted_at is null and target.deleted_at is null
      and viewer.safety_restricted_at is null and target.safety_restricted_at is null
      and target.is_discoverable
      and not exists(select 1 from public.blocks b where
        (b.blocker_id=viewer.id and b.blocked_id=target.id) or (b.blocker_id=target.id and b.blocked_id=viewer.id))
      and (target.kind='bot' or (
        viewer.gender=any(coalesce(tp.interested_genders,array['kadın','erkek','nonbinary','other']::text[]))
        and target.gender=any(coalesce(vp.interested_genders,array['kadın','erkek','nonbinary','other']::text[]))
        and extract(year from age(current_date,viewer.birth_date))::integer between coalesce(tp.min_age,18) and coalesce(tp.max_age,99)
        and extract(year from age(current_date,target.birth_date))::integer between coalesce(vp.min_age,18) and coalesce(vp.max_age,99)
      ))
  );
$$;

create or replace function public.get_like_allowance()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare viewer uuid:=public.current_profile_id(); premium boolean; used_count integer:=0;
  today_tr date:=(now() at time zone 'Europe/Istanbul')::date; resets timestamptz;
begin
  if viewer is null then raise exception 'profile_required'; end if;
  premium:=exists(select 1 from public.user_entitlements where profile_id=viewer and noir_until>now());
  select coalesce(like_count,0) into used_count from public.swipe_daily_usage where profile_id=viewer and usage_date=today_tr;
  resets:=((today_tr+1)::timestamp at time zone 'Europe/Istanbul');
  return jsonb_build_object('remaining',case when premium then null else greatest(10-used_count,0) end,
    'limit',case when premium then null else 10 end,'premium',premium,'resetsAt',resets);
end;
$$;

create or replace function public.get_message_allowance()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare viewer uuid:=public.current_profile_id(); premium boolean; used_messages integer:=0; used_requests integer:=0;
  today_tr date:=(now() at time zone 'Europe/Istanbul')::date; message_limit integer; request_limit integer;
begin
  if viewer is null then raise exception 'profile_required'; end if;
  premium:=exists(select 1 from public.user_entitlements where profile_id=viewer and noir_until>now());
  message_limit:=case when premium then 100 else 25 end; request_limit:=case when premium then 3 else 1 end;
  select coalesce(sent_count,0) into used_messages from public.message_daily_usage where profile_id=viewer and usage_date=today_tr;
  select coalesce(request_count,0) into used_requests from public.message_request_daily_usage where profile_id=viewer and usage_date=today_tr;
  return jsonb_build_object('remaining',greatest(message_limit-used_messages,0),'limit',message_limit,
    'requestRemaining',greatest(request_limit-used_requests,0),'requestLimit',request_limit,
    'resetsAt',((today_tr+1)::timestamp at time zone 'Europe/Istanbul'),'premium',premium);
end;
$$;

-- The daily quest now rewards three considered profile decisions, not three
-- unconditional positive swipes.
update public.daily_quests set slug='three-profile-decisions',title='3 profil hakkında karar ver',event_name='profile_decision'
where slug='three-right-swipes';

create or replace function public.record_swipe(target_profile uuid, swipe_choice public.swipe_direction)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  viewer public.profiles%rowtype; target public.profiles%rowtype; existing_swipe public.swipes%rowtype; inserted_swipe public.swipes%rowtype;
  positive boolean:=swipe_choice in ('right','super'); reciprocal boolean:=false; premium boolean:=false;
  resulting_match uuid; quest_uuid uuid; quest_target integer; quest_reward integer; quest_progress integer:=0; awarded_rows integer:=0;
  today_tr date:=(now() at time zone 'Europe/Istanbul')::date; used_likes integer:=0; allowance jsonb;
  positive_count integer:=0; bot_success_count integer:=0; bot_threshold integer:=0; bot_will_match boolean:=false; bot_due timestamptz;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select * into viewer from public.profiles where user_id=auth.uid() and kind='human' for update;
  if not found or not viewer.onboarding_completed then raise exception 'onboarding_required'; end if;
  if not public.profile_details_complete(viewer.id) then raise exception 'profile_details_required'; end if;
  if viewer.id=target_profile then raise exception 'self_swipe_forbidden'; end if;
  perform pg_advisory_xact_lock(hashtextextended(viewer.id::text,0));
  select * into target from public.profiles where id=target_profile and is_discoverable and onboarding_completed for share;
  if not found or not public.profile_is_visible(target_profile) or not public.mutually_eligible(viewer.id,target.id) then raise exception 'target_unavailable'; end if;
  select * into existing_swipe from public.swipes where swiper_id=viewer.id and target_id=target.id for update;
  if found then
    if existing_swipe.direction='left' and existing_swipe.created_at<=now()-interval '30 days' then
      delete from public.swipes where id=existing_swipe.id;
    elsif existing_swipe.direction in ('right','super') and existing_swipe.created_at<=now()-interval '30 days'
      and not exists(select 1 from public.matches m where m.user_a=least(viewer.id,target.id) and m.user_b=greatest(viewer.id,target.id) and m.status='active') then
      delete from public.bot_match_decisions where swipe_id=existing_swipe.id;
      delete from public.swipes where id=existing_swipe.id;
    else raise exception 'already_swiped'; end if;
  end if;
  premium:=exists(select 1 from public.user_entitlements where profile_id=viewer.id and noir_until>now());
  if swipe_choice='right' and not premium then
    insert into public.swipe_daily_usage(profile_id,usage_date,like_count) values(viewer.id,today_tr,0) on conflict do nothing;
    select like_count into used_likes from public.swipe_daily_usage where profile_id=viewer.id and usage_date=today_tr for update;
    if used_likes>=10 then raise exception 'like_limit_reached'; end if;
    update public.swipe_daily_usage set like_count=like_count+1 where profile_id=viewer.id and usage_date=today_tr;
  end if;
  if swipe_choice='super' then
    allowance:=public.get_super_like_allowance();
    if coalesce((allowance->>'remaining')::integer,0)<1 then raise exception 'super_like_limit_reached'; end if;
  end if;
  insert into public.swipes(swiper_id,target_id,direction) values(viewer.id,target.id,swipe_choice) returning * into inserted_swipe;
  if positive then
    if target.kind='bot' then
      select count(*)::integer into positive_count from public.swipes where swiper_id=viewer.id and direction in ('right','super');
      select count(*)::integer into bot_success_count from public.bot_match_decisions where member_profile_id=viewer.id and status in ('queued','matched');
      bot_threshold:=case bot_success_count
        when 0 then 6+mod(abs(hashtextextended(viewer.id::text||':first',91)::numeric),10)::integer
        when 1 then 25+mod(abs(hashtextextended(viewer.id::text||':second',92)::numeric),21)::integer
        when 2 then 50+mod(abs(hashtextextended(viewer.id::text||':third',93)::numeric),26)::integer
        when 3 then 76+mod(abs(hashtextextended(viewer.id::text||':fourth',94)::numeric),25)::integer
        else 100+(bot_success_count-3)*(60+mod(abs(hashtextextended(viewer.id::text||':'||bot_success_count::text,95)::numeric),61)::integer)
      end;
      bot_will_match:=positive_count>=bot_threshold
        and not exists(select 1 from public.bot_match_decisions where member_profile_id=viewer.id and status in ('queued','matched') and created_at>=date_trunc('day',now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul')
        and (bot_success_count<4 or not exists(select 1 from public.bot_match_decisions where member_profile_id=viewer.id and status in ('queued','matched') and created_at>=date_trunc('week',now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul'));
      if bot_will_match then
        bot_due:=now()+case when bot_success_count=0
          then make_interval(secs=>1800+floor(random()*19801)::integer)
          else make_interval(secs=>21600+floor(random()*64801)::integer) end;
      end if;
      insert into public.bot_match_decisions(member_profile_id,bot_profile_id,swipe_id,status,scheduled_for)
      values(viewer.id,target.id,inserted_swipe.id,case when bot_will_match then 'queued' else 'rejected' end,bot_due);
    else
      reciprocal:=exists(select 1 from public.swipes where swiper_id=target.id and target_id=viewer.id and direction in ('right','super') and created_at>now()-interval '30 days');
    end if;
    if reciprocal then
      insert into public.matches(user_a,user_b,status,connection_type,request_status,request_expires_at)
      values(least(viewer.id,target.id),greatest(viewer.id,target.id),'active','matched',null,null)
      on conflict(user_a,user_b) do update set status='active',connection_type='matched',request_status=null,request_expires_at=null,closed_at=null,matched_at=now()
      returning id into resulting_match;
    end if;
  end if;
  select id,target_count,xp_reward into quest_uuid,quest_target,quest_reward from public.daily_quests where slug='three-profile-decisions' and is_active limit 1;
  if quest_uuid is not null then
    insert into public.user_quest_progress(user_id,quest_id,quest_date,progress) values(viewer.id,quest_uuid,today_tr,1)
    on conflict(user_id,quest_id,quest_date) do update set progress=least(public.user_quest_progress.progress+1,quest_target) returning progress into quest_progress;
    if quest_progress>=quest_target then
      update public.user_quest_progress set completed_at=coalesce(completed_at,now()),xp_claimed_at=now()
      where user_id=viewer.id and quest_id=quest_uuid and quest_date=today_tr and xp_claimed_at is null;
      get diagnostics awarded_rows=row_count;
      if awarded_rows=1 then update public.profiles set xp=xp+quest_reward where id=viewer.id; end if;
    end if;
  end if;
  return jsonb_build_object('matched',resulting_match is not null,'matchId',resulting_match,'targetKind',target.kind,
    'questProgress',coalesce(quest_progress,0),'xpAwarded',case when awarded_rows=1 then quest_reward else 0 end,
    'botMatchPending',target.kind='bot' and bot_will_match,'superLike',public.get_super_like_allowance(),'likeAllowance',public.get_like_allowance());
end;
$$;

create or replace function public.rewind_last_swipe()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare viewer uuid:=public.current_profile_id(); last_swipe public.swipes%rowtype;
begin
  if viewer is null then raise exception 'authentication_required'; end if;
  if not exists(select 1 from public.user_entitlements where profile_id=viewer and noir_until>now()) then raise exception 'noir_required'; end if;
  select * into last_swipe from public.swipes where swiper_id=viewer order by created_at desc,id desc limit 1 for update;
  if not found then raise exception 'nothing_to_rewind'; end if;
  if last_swipe.direction='super' then raise exception 'super_like_not_rewindable'; end if;
  if exists(select 1 from public.matches where user_a=least(viewer,last_swipe.target_id) and user_b=greatest(viewer,last_swipe.target_id) and status='active') then raise exception 'matched_decision_not_rewindable'; end if;
  delete from public.bot_match_decisions where swipe_id=last_swipe.id;
  delete from public.swipes where id=last_swipe.id;
  return jsonb_build_object('profileId',last_swipe.target_id,'direction',last_swipe.direction);
end;
$$;

create or replace function public.respond_message_request(match_uuid uuid, request_action text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare viewer uuid:=public.current_profile_id(); connection public.matches%rowtype;
begin
  if viewer is null then raise exception 'profile_required'; end if;
  if request_action not in ('accept','reject') then raise exception 'invalid_action'; end if;
  select * into connection from public.matches where id=match_uuid and status='active' and connection_type='message_request' for update;
  if not found or viewer not in(connection.user_a,connection.user_b) or viewer=connection.request_sender_id then raise exception 'request_unavailable'; end if;
  if connection.request_status<>'pending' or connection.request_expires_at<=now() then
    update public.matches set request_status='expired',closed_at=now() where id=match_uuid and request_status='pending';
    raise exception 'request_unavailable';
  end if;
  if request_action='accept' then
    update public.matches set connection_type='direct_chat',request_status='accepted',request_expires_at=null where id=match_uuid;
  else
    update public.matches set status='unmatched',request_status='rejected',closed_at=now() where id=match_uuid;
  end if;
  return jsonb_build_object('accepted',request_action='accept');
end;
$$;

create or replace function public.open_message_request(target_profile uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare viewer uuid:=public.current_profile_id(); existing public.matches%rowtype; created public.matches%rowtype;
begin
  if viewer is null then raise exception 'profile_required'; end if;
  if viewer=target_profile or not public.mutually_eligible(viewer,target_profile) then raise exception 'target_unavailable'; end if;
  perform pg_advisory_xact_lock(hashtextextended(least(viewer,target_profile)::text||greatest(viewer,target_profile)::text,71));
  select * into existing from public.matches where user_a=least(viewer,target_profile) and user_b=greatest(viewer,target_profile) for update;
  if found then
    if existing.status='active' and existing.connection_type in ('matched','direct_chat') then
      return jsonb_build_object('matchId',existing.id,'connectionType',existing.connection_type,'requestStatus',existing.request_status);
    end if;
    if existing.status='active' and existing.connection_type='message_request' and existing.request_sender_id=viewer
      and existing.request_status in ('draft','pending') then
      return jsonb_build_object('matchId',existing.id,'connectionType','message_request','requestStatus',existing.request_status);
    end if;
    raise exception 'request_already_closed';
  end if;
  insert into public.matches(user_a,user_b,status,connection_type,request_sender_id,request_status,request_expires_at)
  values(least(viewer,target_profile),greatest(viewer,target_profile),'active','message_request',viewer,'draft',now()+interval '7 days')
  returning * into created;
  return jsonb_build_object('matchId',created.id,'connectionType','message_request','requestStatus','draft');
end;
$$;

create or replace function public.consume_message_allowance(sender_profile uuid, match_uuid uuid, message_kind text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare connection public.matches%rowtype; today_tr date:=(now() at time zone 'Europe/Istanbul')::date;
  premium boolean; daily_limit integer; request_limit integer; used_count integer:=0; used_requests integer:=0; first_request boolean:=false;
begin
  select * into connection from public.matches where id=match_uuid and status='active' and sender_profile in(user_a,user_b) for update;
  if not found then raise exception 'active_match_required'; end if;
  if connection.connection_type='message_request' then
    if connection.request_expires_at<=now() then
      update public.matches set status='unmatched',request_status='expired',closed_at=now() where id=match_uuid;
      raise exception 'message_request_expired';
    end if;
    if sender_profile<>connection.request_sender_id then raise exception 'message_request_accept_required'; end if;
    if message_kind<>'text' then raise exception 'message_request_text_only'; end if;
    if connection.request_status='pending' or exists(select 1 from public.messages where match_id=match_uuid and sender_id=sender_profile) then
      raise exception 'message_request_reply_required';
    end if;
    if connection.request_status<>'draft' then raise exception 'message_request_closed'; end if;
    first_request:=true;
  end if;
  premium:=exists(select 1 from public.user_entitlements where profile_id=sender_profile and noir_until>now());
  daily_limit:=case when premium then 100 else 25 end;
  request_limit:=case when premium then 3 else 1 end;
  insert into public.message_daily_usage(profile_id,usage_date,sent_count) values(sender_profile,today_tr,0) on conflict do nothing;
  select sent_count into used_count from public.message_daily_usage where profile_id=sender_profile and usage_date=today_tr for update;
  if used_count>=daily_limit then return jsonb_build_object('allowed',false,'reason','message_limit','remaining',0,'limit',daily_limit); end if;
  if first_request then
    insert into public.message_request_daily_usage(profile_id,usage_date,request_count) values(sender_profile,today_tr,0) on conflict do nothing;
    select request_count into used_requests from public.message_request_daily_usage where profile_id=sender_profile and usage_date=today_tr for update;
    if used_requests>=request_limit then
      return jsonb_build_object('allowed',false,'reason','request_limit','remaining',daily_limit-used_count,'limit',daily_limit,
        'requestRemaining',0,'requestLimit',request_limit);
    end if;
    update public.message_request_daily_usage set request_count=request_count+1 where profile_id=sender_profile and usage_date=today_tr;
    update public.matches set request_status='pending',request_expires_at=now()+interval '7 days' where id=match_uuid;
  end if;
  update public.message_daily_usage set sent_count=sent_count+1 where profile_id=sender_profile and usage_date=today_tr;
  return jsonb_build_object('allowed',true,'remaining',daily_limit-used_count-1,'limit',daily_limit,
    'requestRemaining',case when first_request then request_limit-used_requests-1 else null end,'requestLimit',request_limit,'firstRequest',first_request);
end;
$$;

create or replace function public.send_text_message(match_uuid uuid,message_body text,client_uuid uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare sender_profile uuid:=public.current_profile_id(); existing public.messages%rowtype; inserted public.messages%rowtype;
  quota jsonb; quest_uuid uuid; quest_reward integer; awarded_rows integer:=0; today_tr date:=(now() at time zone 'Europe/Istanbul')::date;
  connection_type_value text;
begin
  if sender_profile is null then raise exception 'profile_required'; end if;
  if client_uuid is null or char_length(btrim(message_body)) not between 1 and 1200 then raise exception 'invalid_message'; end if;
  select * into existing from public.messages where match_id=match_uuid and sender_id=sender_profile and client_message_id=client_uuid;
  if found then return jsonb_build_object('messageId',existing.id,'createdAt',existing.created_at,'duplicate',true); end if;
  quota:=public.consume_message_allowance(sender_profile,match_uuid,'text');
  if not coalesce((quota->>'allowed')::boolean,false) then return quota; end if;
  insert into public.messages(match_id,sender_id,kind,body,client_message_id)
  values(match_uuid,sender_profile,'text',btrim(message_body),client_uuid) returning * into inserted;
  update public.matches set last_message_at=inserted.created_at where id=match_uuid;
  select connection_type into connection_type_value from public.matches where id=match_uuid;
  if connection_type_value in ('matched','direct_chat') then
    select id,xp_reward into quest_uuid,quest_reward from public.daily_quests where slug='start-chat' and is_active limit 1;
    if quest_uuid is not null then
      insert into public.user_quest_progress(user_id,quest_id,quest_date,progress,completed_at,xp_claimed_at)
      values(sender_profile,quest_uuid,today_tr,1,now(),now()) on conflict(user_id,quest_id,quest_date) do nothing;
      get diagnostics awarded_rows=row_count;
      if awarded_rows=1 then update public.profiles set xp=xp+quest_reward where id=sender_profile; end if;
    end if;
  end if;
  return quota||jsonb_build_object('messageId',inserted.id,'createdAt',inserted.created_at,
    'xpAwarded',case when awarded_rows=1 then quest_reward else 0 end);
end;
$$;

create or replace function public.send_audio_message(match_uuid uuid,message_audio_path text,message_duration_ms integer,message_waveform smallint[],client_uuid uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare sender_profile uuid:=public.current_profile_id(); existing public.messages%rowtype; inserted public.messages%rowtype; quota jsonb;
begin
  if sender_profile is null then raise exception 'profile_required'; end if;
  if client_uuid is null or message_duration_ms not between 500 and 60000 or cardinality(message_waveform) not between 8 and 48
    or not(0<=all(message_waveform) and 100>=all(message_waveform)) then raise exception 'invalid_audio'; end if;
  if message_audio_path not like sender_profile::text||'/'||match_uuid::text||'/%' then raise exception 'invalid_audio_path'; end if;
  select * into existing from public.messages where match_id=match_uuid and sender_id=sender_profile and client_message_id=client_uuid;
  if found then return jsonb_build_object('messageId',existing.id,'createdAt',existing.created_at,'duplicate',true); end if;
  quota:=public.consume_message_allowance(sender_profile,match_uuid,'audio');
  if not coalesce((quota->>'allowed')::boolean,false) then return quota; end if;
  insert into public.messages(match_id,sender_id,kind,audio_path,audio_duration_ms,audio_waveform,client_message_id)
  values(match_uuid,sender_profile,'audio',message_audio_path,message_duration_ms,message_waveform,client_uuid) returning * into inserted;
  update public.matches set last_message_at=inserted.created_at where id=match_uuid;
  return quota||jsonb_build_object('messageId',inserted.id,'createdAt',inserted.created_at);
end;
$$;

create or replace function public.send_bot_text_message_service(member_uuid uuid,match_uuid uuid,message_body text,client_uuid uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare existing public.messages%rowtype; inserted public.messages%rowtype; quota jsonb; quest_uuid uuid; quest_reward integer; awarded integer:=0;
  today_tr date:=(now() at time zone 'Europe/Istanbul')::date;
begin
  if auth.role()<>'service_role' then raise exception 'service_role_required'; end if;
  if char_length(btrim(message_body)) not between 1 and 1200 or client_uuid is null then raise exception 'invalid_message'; end if;
  if not exists(select 1 from public.matches m join public.profiles p on p.id=case when m.user_a=member_uuid then m.user_b else m.user_a end
    where m.id=match_uuid and m.status='active' and member_uuid in(m.user_a,m.user_b) and p.kind='bot') then raise exception 'active_bot_match_required'; end if;
  select * into existing from public.messages where match_id=match_uuid and sender_id=member_uuid and client_message_id=client_uuid;
  if found then return jsonb_build_object('messageId',existing.id,'createdAt',existing.created_at,'duplicate',true); end if;
  quota:=public.consume_message_allowance(member_uuid,match_uuid,'text');
  if not coalesce((quota->>'allowed')::boolean,false) then return quota; end if;
  insert into public.messages(match_id,sender_id,kind,body,client_message_id)
  values(match_uuid,member_uuid,'text',btrim(message_body),client_uuid) returning * into inserted;
  update public.matches set last_message_at=inserted.created_at where id=match_uuid;
  select id,xp_reward into quest_uuid,quest_reward from public.daily_quests where slug='start-chat' and is_active limit 1;
  if quest_uuid is not null then
    insert into public.user_quest_progress(user_id,quest_id,quest_date,progress,completed_at,xp_claimed_at)
    values(member_uuid,quest_uuid,today_tr,1,now(),now()) on conflict(user_id,quest_id,quest_date) do nothing;
    get diagnostics awarded=row_count; if awarded=1 then update public.profiles set xp=xp+quest_reward where id=member_uuid; end if;
  end if;
  return quota||jsonb_build_object('messageId',inserted.id,'createdAt',inserted.created_at,'xpAwarded',case when awarded=1 then quest_reward else 0 end);
end;
$$;

create or replace function public.send_bot_audio_message_service(member_uuid uuid,match_uuid uuid,message_audio_path text,message_duration_ms integer,message_waveform smallint[],client_uuid uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare existing public.messages%rowtype; inserted public.messages%rowtype; quota jsonb;
begin
  if auth.role()<>'service_role' then raise exception 'service_role_required'; end if;
  if client_uuid is null or message_duration_ms not between 500 and 60000 or cardinality(message_waveform) not between 8 and 48 then raise exception 'invalid_audio'; end if;
  if message_audio_path not like member_uuid::text||'/'||match_uuid::text||'/%' then raise exception 'invalid_audio_path'; end if;
  if not exists(select 1 from public.matches m join public.profiles p on p.id=case when m.user_a=member_uuid then m.user_b else m.user_a end
    where m.id=match_uuid and m.status='active' and member_uuid in(m.user_a,m.user_b) and p.kind='bot') then raise exception 'active_bot_match_required'; end if;
  select * into existing from public.messages where match_id=match_uuid and sender_id=member_uuid and client_message_id=client_uuid;
  if found then return jsonb_build_object('messageId',existing.id,'createdAt',existing.created_at,'duplicate',true); end if;
  quota:=public.consume_message_allowance(member_uuid,match_uuid,'audio');
  if not coalesce((quota->>'allowed')::boolean,false) then return quota; end if;
  insert into public.messages(match_id,sender_id,kind,audio_path,audio_duration_ms,audio_waveform,client_message_id)
  values(match_uuid,member_uuid,'audio',message_audio_path,message_duration_ms,message_waveform,client_uuid) returning * into inserted;
  update public.matches set last_message_at=inserted.created_at where id=match_uuid;
  return quota||jsonb_build_object('messageId',inserted.id,'createdAt',inserted.created_at);
end;
$$;

create or replace function public.process_due_bot_matches_service(batch_limit integer default 20,only_member uuid default null)
returns table(decision_id uuid,match_id uuid,member_profile_id uuid,bot_profile_id uuid)
language plpgsql security definer set search_path=''
as $$
declare decision public.bot_match_decisions%rowtype; created_match uuid;
begin
  if auth.role()<>'service_role' then raise exception 'service_role_required'; end if;
  for decision in select d.* from public.bot_match_decisions d
    where d.status='queued' and d.scheduled_for<=now() and (only_member is null or d.member_profile_id=only_member)
    order by d.scheduled_for for update skip locked limit greatest(1,least(batch_limit,100))
  loop
    if not exists(select 1 from public.profiles where id=decision.member_profile_id and kind='human' and onboarding_completed and is_discoverable and deleted_at is null and safety_restricted_at is null)
      or not exists(select 1 from public.profiles where id=decision.bot_profile_id and kind='bot' and onboarding_completed and is_discoverable and deleted_at is null and safety_restricted_at is null)
      or exists(select 1 from public.blocks where (blocker_id=decision.member_profile_id and blocked_id=decision.bot_profile_id) or (blocker_id=decision.bot_profile_id and blocked_id=decision.member_profile_id)) then
      update public.bot_match_decisions set status='cancelled',cancellation_reason='profile_unavailable',updated_at=now() where id=decision.id;
      continue;
    end if;
    insert into public.matches(user_a,user_b,status,connection_type,request_status,request_expires_at,closed_at)
    values(least(decision.member_profile_id,decision.bot_profile_id),greatest(decision.member_profile_id,decision.bot_profile_id),'active','matched',null,null,null)
    on conflict(user_a,user_b) do update set status='active',connection_type='matched',request_status=null,request_expires_at=null,closed_at=null,matched_at=now()
    returning id into created_match;
    update public.bot_match_decisions set status='matched',match_id=created_match,matched_at=now(),updated_at=now() where id=decision.id;
    decision_id:=decision.id; match_id:=created_match; member_profile_id:=decision.member_profile_id; bot_profile_id:=decision.bot_profile_id; return next;
  end loop;
end;
$$;

revoke all on function public.profile_details_complete(uuid) from public;
revoke all on function public.mutually_eligible(uuid,uuid) from public;
revoke all on function public.get_like_allowance() from public;
revoke all on function public.get_message_allowance() from public;
revoke all on function public.respond_message_request(uuid,text) from public;
revoke all on function public.open_message_request(uuid) from public;
revoke all on function public.consume_message_allowance(uuid,uuid,text) from public;
revoke all on function public.send_text_message(uuid,text,uuid) from public;
revoke all on function public.send_audio_message(uuid,text,integer,smallint[],uuid) from public;
revoke all on function public.send_bot_text_message_service(uuid,uuid,text,uuid) from public;
revoke all on function public.send_bot_audio_message_service(uuid,uuid,text,integer,smallint[],uuid) from public;
revoke all on function public.process_due_bot_matches_service(integer,uuid) from public;
grant execute on function public.get_like_allowance() to authenticated;
grant execute on function public.get_message_allowance() to authenticated;
grant execute on function public.respond_message_request(uuid,text) to authenticated;
grant execute on function public.open_message_request(uuid) to authenticated;
grant execute on function public.send_text_message(uuid,text,uuid) to authenticated;
grant execute on function public.send_audio_message(uuid,text,integer,smallint[],uuid) to authenticated;
grant execute on function public.send_bot_text_message_service(uuid,uuid,text,uuid) to service_role;
grant execute on function public.send_bot_audio_message_service(uuid,uuid,text,integer,smallint[],uuid) to service_role;
grant execute on function public.process_due_bot_matches_service(integer,uuid) to service_role;

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='profile_verification_requests') then
    alter publication supabase_realtime add table public.profile_verification_requests;
  end if;
end $$;


-- ===== 036_api_rate_limits.sql =====
-- Durable, atomic API throttling for serverless route handlers.
create table if not exists public.api_rate_limit_buckets (
  scope text not null,
  subject_hash text not null,
  window_start timestamptz not null,
  hits integer not null default 1 check (hits > 0),
  expires_at timestamptz not null,
  primary key (scope, subject_hash, window_start)
);

create index if not exists api_rate_limit_buckets_expiry
  on public.api_rate_limit_buckets (expires_at);

alter table public.api_rate_limit_buckets enable row level security;
revoke all on public.api_rate_limit_buckets from anon, authenticated;

create or replace function public.consume_api_rate_limit(
  limit_scope text,
  limit_subject_hash text,
  max_hits integer,
  window_seconds integer
)
returns table(allowed boolean, remaining integer, retry_after integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  now_at timestamptz := clock_timestamp();
  bucket_start timestamptz;
  next_hits integer;
begin
  if limit_scope is null or length(limit_scope) not between 1 and 80
    or limit_subject_hash is null or length(limit_subject_hash) <> 64
    or max_hits not between 1 and 10000
    or window_seconds not between 1 and 86400 then
    raise exception 'invalid_rate_limit_arguments';
  end if;

  bucket_start := to_timestamp(
    floor(extract(epoch from now_at) / window_seconds) * window_seconds
  );

  insert into public.api_rate_limit_buckets(scope, subject_hash, window_start, hits, expires_at)
  values (limit_scope, limit_subject_hash, bucket_start, 1, bucket_start + make_interval(secs => window_seconds))
  on conflict (scope, subject_hash, window_start)
  do update set hits = public.api_rate_limit_buckets.hits + 1
  returning hits into next_hits;

  return query select
    next_hits <= max_hits,
    greatest(0, max_hits - next_hits),
    greatest(1, ceil(extract(epoch from (bucket_start + make_interval(secs => window_seconds) - now_at)))::integer);
end;
$$;

revoke all on function public.consume_api_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, text, integer, integer) to service_role;



-- ===== 037_staged_onboarding.sql =====
-- Let members finish the safety-critical onboarding first and enrich the
-- profile later. Discovery still requires an approved primary surface.
create or replace function public.save_onboarding_profile(
  profile_name text,
  profile_birth_date date,
  profile_gender text,
  profile_city text,
  profile_phone text,
  badge_slugs text[],
  icebreaker_prompt text,
  icebreaker_answer text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid;
  existing public.profiles%rowtype;
  badge_count integer;
  prompt_uuid uuid;
  cleaned_phone text := nullif(btrim(profile_phone), '');
  cleaned_answer text := btrim(coalesce(icebreaker_answer, ''));
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if char_length(btrim(profile_name)) not between 2 and 60 then raise exception 'invalid_name'; end if;
  if profile_birth_date > current_date - interval '18 years' or profile_birth_date < current_date - interval '100 years' then raise exception 'invalid_birth_date'; end if;
  if char_length(btrim(profile_gender)) not between 1 and 40 then raise exception 'invalid_gender'; end if;
  if profile_city is not null and char_length(btrim(profile_city)) > 80 then raise exception 'invalid_city'; end if;
  if cleaned_phone is not null and char_length(cleaned_phone) not between 7 and 24 then raise exception 'invalid_phone'; end if;
  if coalesce(array_length(badge_slugs, 1), 0) > 3 then raise exception 'invalid_badge_count'; end if;
  if char_length(cleaned_answer) > 160 then raise exception 'invalid_answer'; end if;

  select * into existing from public.profiles where user_id = auth.uid() and kind = 'human' for update;
  if found then
    if existing.onboarding_completed and existing.birth_date <> profile_birth_date then raise exception 'birth_date_support_required'; end if;
    if existing.display_name <> btrim(profile_name) and existing.name_changed_at is not null and existing.name_changed_at > now() - interval '30 days' then raise exception 'name_change_cooldown'; end if;
    update public.profiles set
      display_name=btrim(profile_name), birth_date=profile_birth_date, gender=btrim(profile_gender),
      city=nullif(btrim(profile_city), ''),
      name_changed_at=case when existing.display_name<>btrim(profile_name) then now() else existing.name_changed_at end,
      updated_at=now()
    where id=existing.id returning id into profile_uuid;
  else
    insert into public.profiles(user_id,kind,display_name,birth_date,gender,city,is_discoverable)
    values(auth.uid(),'human',btrim(profile_name),profile_birth_date,btrim(profile_gender),nullif(btrim(profile_city),''),false)
    returning id into profile_uuid;
  end if;

  insert into public.private_profile_data(profile_id,birth_date,phone,updated_at)
  values(profile_uuid,profile_birth_date,cleaned_phone,now())
  on conflict(profile_id) do update set birth_date=excluded.birth_date,phone=excluded.phone,updated_at=now();

  delete from public.profile_intentions where profile_id=profile_uuid;
  if coalesce(array_length(badge_slugs,1),0)>0 then
    select count(*) into badge_count from public.intent_badges where slug=any(badge_slugs) and is_active;
    if badge_count<>array_length(badge_slugs,1) then raise exception 'invalid_badge'; end if;
    insert into public.profile_intentions(profile_id,badge_id)
    select profile_uuid,id from public.intent_badges where slug=any(badge_slugs) and is_active;
  end if;

  delete from public.profile_answers where profile_id=profile_uuid;
  if cleaned_answer<>'' then
    select id into prompt_uuid from public.icebreaker_prompts where prompt=icebreaker_prompt and is_active limit 1;
    if prompt_uuid is null then raise exception 'invalid_prompt'; end if;
    insert into public.profile_answers(profile_id,prompt_id,answer) values(profile_uuid,prompt_uuid,cleaned_answer);
  end if;
  return profile_uuid;
end;
$$;

create or replace function public.finalize_onboarding()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid;
  ready_photos integer;
  approved_photos integer;
begin
  profile_uuid:=public.current_profile_id();
  if profile_uuid is null then raise exception 'profile_required'; end if;
  select count(*) filter(where moderation_status<>'rejected'), count(*) filter(where moderation_status='approved')
  into ready_photos,approved_photos from public.profile_photos
  where profile_id=profile_uuid and processing_status='ready';
  if ready_photos<2 then raise exception 'two_photos_required'; end if;
  update public.profiles set onboarding_completed=true,is_discoverable=approved_photos>=1,updated_at=now()
  where id=profile_uuid and kind='human';
end;
$$;



-- ===== 038_account_deletion_recovery.sql =====
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


-- ===== 039_organic_growth_foundation.sql =====
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


-- ===== 040_payment_flow_hardening.sql =====
-- Harden payment authorization, checkout recovery and manual submission idempotency.

alter table public.payment_orders
  add column if not exists checkout_claimed_at timestamptz;

create or replace function public.create_noir_payment_order(plan_slug text, payment_provider text)
returns public.payment_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  buyer uuid := public.current_profile_id();
  selected_plan public.premium_plans%rowtype;
  existing_order public.payment_orders%rowtype;
  created_order public.payment_orders%rowtype;
begin
  if buyer is null then raise exception 'profile_required'; end if;
  if payment_provider not in ('bank_transfer','papara','crypto','shopier') then raise exception 'invalid_provider'; end if;
  if payment_provider <> 'shopier' and not exists (
    select 1 from public.payment_method_settings
    where method = payment_provider and enabled
  ) then raise exception 'payment_method_unavailable'; end if;

  select * into selected_plan
  from public.premium_plans
  where slug = plan_slug and is_active
  for share;
  if not found then raise exception 'plan_unavailable'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(buyer::text || ':' || selected_plan.id::text || ':' || payment_provider, 0)
  );

  select * into existing_order
  from public.payment_orders
  where profile_id = buyer
    and plan_id = selected_plan.id
    and provider = payment_provider
    and (
      (payment_provider = 'shopier' and status in ('awaiting_payment','pending'))
      or
      (payment_provider <> 'shopier' and status in ('awaiting_payment','under_review'))
    )
  order by created_at desc, id desc
  limit 1
  for update;
  if found then return existing_order; end if;

  insert into public.payment_orders(profile_id,plan_id,provider,amount,currency,payment_reference)
  values (
    buyer, selected_plan.id, payment_provider, selected_plan.price_amount, selected_plan.currency,
    'LVK-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))
  ) returning * into created_order;
  return created_order;
end;
$$;

create or replace function public.submit_manual_payment(
  order_uuid uuid,
  sender_name text,
  paid_on date,
  provider_reference text default null,
  object_path text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  buyer uuid := public.current_profile_id();
  local_today date := (pg_catalog.timezone('Europe/Istanbul', now()))::date;
begin
  if buyer is null then raise exception 'profile_required'; end if;
  if char_length(btrim(sender_name)) not between 3 and 120 then raise exception 'invalid_sender'; end if;
  if paid_on is null or paid_on > local_today or paid_on < local_today - 30 then raise exception 'invalid_payment_date'; end if;
  if provider_reference is not null and char_length(btrim(provider_reference)) > 160 then raise exception 'invalid_reference'; end if;
  if object_path is not null and object_path not like buyer::text || '/' || order_uuid::text || '/%' then
    raise exception 'invalid_proof_path';
  end if;

  update public.payment_orders
    set sender_full_name = btrim(sender_name),
        payment_date = paid_on,
        external_reference = nullif(btrim(provider_reference), ''),
        proof_path = object_path,
        submitted_at = now(),
        status = 'under_review',
        updated_at = now()
  where id = order_uuid and profile_id = buyer
    and provider in ('bank_transfer','papara','crypto')
    and status = 'awaiting_payment';
  if not found then raise exception 'order_not_submittable'; end if;
end;
$$;

create or replace function public.approve_noir_payment(order_uuid uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_order public.payment_orders%rowtype;
  access_days integer;
  new_until timestamptz;
begin
  if not public.has_admin_role(array['owner']) then raise exception 'owner_required'; end if;
  select * into selected_order from public.payment_orders where id = order_uuid for update;
  if not found then raise exception 'order_not_found'; end if;
  if selected_order.status = 'approved' then
    select noir_until into new_until from public.user_entitlements where profile_id = selected_order.profile_id;
    return new_until;
  end if;
  if selected_order.provider not in ('bank_transfer','papara','crypto','manual') then raise exception 'manual_provider_required'; end if;
  if selected_order.status <> 'under_review' then raise exception 'order_not_approvable'; end if;
  select duration_days into access_days from public.premium_plans where id = selected_order.plan_id;
  if access_days is null then raise exception 'plan_not_found'; end if;

  insert into public.user_entitlements(profile_id,noir_until,source,updated_at)
  values (selected_order.profile_id, now() + make_interval(days => access_days), 'payment:' || order_uuid::text, now())
  on conflict (profile_id) do update set
    noir_until = greatest(coalesce(public.user_entitlements.noir_until, now()), now()) + make_interval(days => access_days),
    source = 'payment:' || order_uuid::text,
    updated_at = now()
  returning noir_until into new_until;

  update public.payment_orders
  set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  where id = order_uuid;
  insert into public.admin_audit_log(actor_user_id,action,target_type,target_id,metadata)
  values (auth.uid(),'payment.approved','payment_order',order_uuid::text,jsonb_build_object('profileId',selected_order.profile_id,'noirUntil',new_until));
  return new_until;
end;
$$;

create or replace function public.reject_noir_payment(order_uuid uuid, reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_admin_role(array['owner']) then raise exception 'owner_required'; end if;
  if char_length(btrim(reason)) not between 3 and 500 then raise exception 'invalid_reason'; end if;
  update public.payment_orders
  set status = 'rejected', rejection_reason = btrim(reason), reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  where id = order_uuid
    and provider in ('bank_transfer','papara','crypto','manual')
    and status = 'under_review';
  if not found then raise exception 'order_not_rejectable'; end if;
  insert into public.admin_audit_log(actor_user_id,action,target_type,target_id,metadata)
  values (auth.uid(),'payment.rejected','payment_order',order_uuid::text,jsonb_build_object('reason',btrim(reason)));
end;
$$;

revoke all on function public.create_noir_payment_order(text,text) from public;
revoke all on function public.submit_manual_payment(uuid,text,date,text,text) from public;
revoke all on function public.approve_noir_payment(uuid) from public;
revoke all on function public.reject_noir_payment(uuid,text) from public;
grant execute on function public.create_noir_payment_order(text,text) to authenticated;
grant execute on function public.submit_manual_payment(uuid,text,date,text,text) to authenticated;
grant execute on function public.approve_noir_payment(uuid) to authenticated;
grant execute on function public.reject_noir_payment(uuid,text) to authenticated;


-- ===== 041_message_request_acceptance_consistency.sql =====
-- A reply is definitive acceptance of a message request, regardless of whether
-- it came from a human client, bot automation, or an administrative flow.
create or replace function public.accept_message_request_on_reply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.matches
  set connection_type = 'direct_chat',
      request_status = 'accepted',
      request_expires_at = null,
      closed_at = null
  where id = new.match_id
    and status = 'active'
    and connection_type = 'message_request'
    and request_status in ('draft', 'pending')
    and request_sender_id is distinct from new.sender_id;
  return new;
end;
$$;

drop trigger if exists messages_accept_request_on_reply on public.messages;
create trigger messages_accept_request_on_reply
after insert on public.messages
for each row execute function public.accept_message_request_on_reply();

-- Repair existing conversations where the recipient already replied but the
-- request row remained pending because the reply bypassed the response RPC.
update public.matches m
set connection_type = 'direct_chat',
    request_status = 'accepted',
    request_expires_at = null,
    closed_at = null
where m.status = 'active'
  and m.connection_type = 'message_request'
  and m.request_status in ('draft', 'pending')
  and exists (
    select 1
    from public.messages msg
    where msg.match_id = m.id
      and msg.sender_id is distinct from m.request_sender_id
  );

revoke all on function public.accept_message_request_on_reply() from public;


-- ===== 042_brand_settings.sql =====
create table if not exists public.brand_settings (
  id boolean primary key default true check (id),
  brand_name text not null default 'Lovask' check (char_length(brand_name) between 1 and 80),
  tagline text not null default 'Tesadüften fazlası' check (char_length(tagline) between 1 and 160),
  support_email text not null default 'destek@example.com' check (char_length(support_email) between 3 and 320),
  logo_url text not null default '/logo_l_extra_thick.png' check (char_length(logo_url) between 1 and 2048),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.brand_settings enable row level security;
insert into public.brand_settings (id) values (true) on conflict (id) do nothing;


-- ===== 043_security_hardening.sql =====
-- Keep membership approval at the database boundary as well as in the API.
create or replace function public.save_onboarding_profile(
  profile_name text, profile_birth_date date, profile_gender text, profile_city text,
  profile_phone text, badge_slugs text[], icebreaker_prompt text, icebreaker_answer text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare profile_uuid uuid; existing public.profiles%rowtype; cleaned_phone text := nullif(btrim(profile_phone), '');
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select * into existing from public.profiles where user_id = auth.uid() and kind = 'human' for update;
  if not found and coalesce(auth.jwt()->'app_metadata'->>'approved_member', 'false') <> 'true' then
    raise exception 'membership_approval_required';
  end if;
  if char_length(btrim(profile_name)) not between 2 and 60 then raise exception 'invalid_name'; end if;
  if profile_birth_date > current_date - interval '18 years' or profile_birth_date < current_date - interval '100 years' then raise exception 'invalid_birth_date'; end if;
  if char_length(btrim(profile_gender)) not between 1 and 40 then raise exception 'invalid_gender'; end if;
  if profile_city is not null and char_length(btrim(profile_city)) > 80 then raise exception 'invalid_city'; end if;
  if cleaned_phone is not null and char_length(cleaned_phone) not between 7 and 24 then raise exception 'invalid_phone'; end if;
  if coalesce(array_length(badge_slugs, 1), 0) > 3 then raise exception 'invalid_badge_count'; end if;
  if char_length(btrim(coalesce(icebreaker_answer, ''))) > 160 then raise exception 'invalid_answer'; end if;
  if found then
    if existing.onboarding_completed and existing.birth_date <> profile_birth_date then raise exception 'birth_date_support_required'; end if;
    if existing.display_name <> btrim(profile_name) and existing.name_changed_at is not null and existing.name_changed_at > now() - interval '30 days' then raise exception 'name_change_cooldown'; end if;
    update public.profiles set display_name=btrim(profile_name), birth_date=profile_birth_date, gender=btrim(profile_gender), city=nullif(btrim(profile_city), ''), updated_at=now() where id=existing.id returning id into profile_uuid;
  else
    insert into public.profiles(user_id,kind,display_name,birth_date,gender,city,is_discoverable) values(auth.uid(),'human',btrim(profile_name),profile_birth_date,btrim(profile_gender),nullif(btrim(profile_city),''),false) returning id into profile_uuid;
  end if;
  insert into public.private_profile_data(profile_id,birth_date,phone,updated_at) values(profile_uuid,profile_birth_date,cleaned_phone,now()) on conflict(profile_id) do update set birth_date=excluded.birth_date,phone=excluded.phone,updated_at=now();
  delete from public.profile_intentions where profile_id=profile_uuid;
  if coalesce(array_length(badge_slugs,1),0)>0 then
    if (select count(*) from public.intent_badges where slug=any(badge_slugs) and is_active) <> array_length(badge_slugs,1) then raise exception 'invalid_badge'; end if;
    insert into public.profile_intentions(profile_id,badge_id) select profile_uuid,id from public.intent_badges where slug=any(badge_slugs) and is_active;
  end if;
  delete from public.profile_answers where profile_id=profile_uuid;
  if btrim(coalesce(icebreaker_answer,''))<>'' then
    insert into public.profile_answers(profile_id,prompt_id,answer) select profile_uuid,id,btrim(icebreaker_answer) from public.icebreaker_prompts where prompt=icebreaker_prompt and is_active limit 1;
    if not found then raise exception 'invalid_prompt'; end if;
  end if;
  return profile_uuid;
end; $$;
revoke all on function public.save_onboarding_profile(text,date,text,text,text,text[],text,text) from public;
grant execute on function public.save_onboarding_profile(text,date,text,text,text,text[],text,text) to authenticated;


-- ===== 044_disable_unwired_profile_quest.sql =====
-- Profil düzenleme için ödül akışı yok; tamamlanmış gibi gösterilen görevi kapat.
update public.daily_quests
set is_active = false
where slug = 'polish-profile';


-- ===== 045_staged_onboarding_discovery_compatibility.sql =====
-- Staged onboarding deliberately defers optional relationship details. Members
-- may still browse and decide after completing the required onboarding steps.
create or replace function public.record_swipe(target_profile uuid, swipe_choice public.swipe_direction)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  viewer public.profiles%rowtype; target public.profiles%rowtype; existing_swipe public.swipes%rowtype; inserted_swipe public.swipes%rowtype;
  positive boolean:=swipe_choice in ('right','super'); reciprocal boolean:=false; premium boolean:=false;
  resulting_match uuid; quest_uuid uuid; quest_target integer; quest_reward integer; quest_progress integer:=0; awarded_rows integer:=0;
  today_tr date:=(now() at time zone 'Europe/Istanbul')::date; used_likes integer:=0; allowance jsonb;
  positive_count integer:=0; bot_success_count integer:=0; bot_threshold integer:=0; bot_will_match boolean:=false; bot_due timestamptz;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select * into viewer from public.profiles where user_id=auth.uid() and kind='human' for update;
  if not found or not viewer.onboarding_completed then raise exception 'onboarding_required'; end if;
  if viewer.id=target_profile then raise exception 'self_swipe_forbidden'; end if;
  perform pg_advisory_xact_lock(hashtextextended(viewer.id::text,0));
  select * into target from public.profiles where id=target_profile and is_discoverable and onboarding_completed for share;
  if not found or not public.profile_is_visible(target_profile) or not public.mutually_eligible(viewer.id,target.id) then raise exception 'target_unavailable'; end if;
  select * into existing_swipe from public.swipes where swiper_id=viewer.id and target_id=target.id for update;
  if found then
    if existing_swipe.direction='left' and existing_swipe.created_at<=now()-interval '30 days' then
      delete from public.swipes where id=existing_swipe.id;
    elsif existing_swipe.direction in ('right','super') and existing_swipe.created_at<=now()-interval '30 days'
      and not exists(select 1 from public.matches m where m.user_a=least(viewer.id,target.id) and m.user_b=greatest(viewer.id,target.id) and m.status='active') then
      delete from public.bot_match_decisions where swipe_id=existing_swipe.id;
      delete from public.swipes where id=existing_swipe.id;
    else raise exception 'already_swiped'; end if;
  end if;
  premium:=exists(select 1 from public.user_entitlements where profile_id=viewer.id and noir_until>now());
  if swipe_choice='right' and not premium then
    insert into public.swipe_daily_usage(profile_id,usage_date,like_count) values(viewer.id,today_tr,0) on conflict do nothing;
    select like_count into used_likes from public.swipe_daily_usage where profile_id=viewer.id and usage_date=today_tr for update;
    if used_likes>=10 then raise exception 'like_limit_reached'; end if;
    update public.swipe_daily_usage set like_count=like_count+1 where profile_id=viewer.id and usage_date=today_tr;
  end if;
  if swipe_choice='super' then
    allowance:=public.get_super_like_allowance();
    if coalesce((allowance->>'remaining')::integer,0)<1 then raise exception 'super_like_limit_reached'; end if;
  end if;
  insert into public.swipes(swiper_id,target_id,direction) values(viewer.id,target.id,swipe_choice) returning * into inserted_swipe;
  if positive then
    if target.kind='bot' then
      select count(*)::integer into positive_count from public.swipes where swiper_id=viewer.id and direction in ('right','super');
      select count(*)::integer into bot_success_count from public.bot_match_decisions where member_profile_id=viewer.id and status in ('queued','matched');
      bot_threshold:=case bot_success_count
        when 0 then 6+mod(abs(hashtextextended(viewer.id::text||':first',91)::numeric),10)::integer
        when 1 then 25+mod(abs(hashtextextended(viewer.id::text||':second',92)::numeric),21)::integer
        when 2 then 50+mod(abs(hashtextextended(viewer.id::text||':third',93)::numeric),26)::integer
        when 3 then 76+mod(abs(hashtextextended(viewer.id::text||':fourth',94)::numeric),25)::integer
        else 100+(bot_success_count-3)*(60+mod(abs(hashtextextended(viewer.id::text||':'||bot_success_count::text,95)::numeric),61)::integer)
      end;
      bot_will_match:=positive_count>=bot_threshold
        and not exists(select 1 from public.bot_match_decisions where member_profile_id=viewer.id and status in ('queued','matched') and created_at>=date_trunc('day',now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul')
        and (bot_success_count<4 or not exists(select 1 from public.bot_match_decisions where member_profile_id=viewer.id and status in ('queued','matched') and created_at>=date_trunc('week',now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul'));
      if bot_will_match then
        bot_due:=now()+case when bot_success_count=0
          then make_interval(secs=>1800+floor(random()*19801)::integer)
          else make_interval(secs=>21600+floor(random()*64801)::integer) end;
      end if;
      insert into public.bot_match_decisions(member_profile_id,bot_profile_id,swipe_id,status,scheduled_for)
      values(viewer.id,target.id,inserted_swipe.id,case when bot_will_match then 'queued' else 'rejected' end,bot_due);
    else
      reciprocal:=exists(select 1 from public.swipes where swiper_id=target.id and target_id=viewer.id and direction in ('right','super') and created_at>now()-interval '30 days');
    end if;
    if reciprocal then
      insert into public.matches(user_a,user_b,status,connection_type,request_status,request_expires_at)
      values(least(viewer.id,target.id),greatest(viewer.id,target.id),'active','matched',null,null)
      on conflict(user_a,user_b) do update set status='active',connection_type='matched',request_status=null,request_expires_at=null,closed_at=null,matched_at=now()
      returning id into resulting_match;
    end if;
  end if;
  select id,target_count,xp_reward into quest_uuid,quest_target,quest_reward from public.daily_quests where slug='three-profile-decisions' and is_active limit 1;
  if quest_uuid is not null then
    insert into public.user_quest_progress(user_id,quest_id,quest_date,progress) values(viewer.id,quest_uuid,today_tr,1)
    on conflict(user_id,quest_id,quest_date) do update set progress=least(public.user_quest_progress.progress+1,quest_target) returning progress into quest_progress;
    if quest_progress>=quest_target then
      update public.user_quest_progress set completed_at=coalesce(completed_at,now()),xp_claimed_at=now()
      where user_id=viewer.id and quest_id=quest_uuid and quest_date=today_tr and xp_claimed_at is null;
      get diagnostics awarded_rows=row_count;
      if awarded_rows=1 then update public.profiles set xp=xp+quest_reward where id=viewer.id; end if;
    end if;
  end if;
  return jsonb_build_object('matched',resulting_match is not null,'matchId',resulting_match,'targetKind',target.kind,
    'questProgress',coalesce(quest_progress,0),'xpAwarded',case when awarded_rows=1 then quest_reward else 0 end,
    'botMatchPending',target.kind='bot' and bot_will_match,'superLike',public.get_super_like_allowance(),'likeAllowance',public.get_like_allowance());
end;
$$;

-- The discovery query itself already requires an approved photo. Keeping the
-- member's preference on lets approval make the profile visible automatically.
create or replace function public.finalize_onboarding()
returns void language plpgsql security definer set search_path=''
as $$
declare profile_uuid uuid; ready_photos integer;
begin
  profile_uuid:=public.current_profile_id();
  if profile_uuid is null then raise exception 'profile_required'; end if;
  select count(*) filter(where moderation_status<>'rejected') into ready_photos
  from public.profile_photos where profile_id=profile_uuid and processing_status='ready';
  if ready_photos<2 then raise exception 'two_photos_required'; end if;
  update public.profiles set onboarding_completed=true,is_discoverable=true,updated_at=now()
  where id=profile_uuid and kind='human';
end;
$$;


-- ===== 046_profile_contract_and_allowance_defaults.sql =====
-- Keep profile vocabulary consistent at both the API and database boundary.
alter table public.profiles drop constraint if exists profiles_gender_check;
alter table public.profiles add constraint profiles_gender_check
  check (gender in ('kadın', 'erkek', 'nonbinary', 'other'));

-- SELECT INTO assigns NULL when the daily row does not exist. Read through a
-- scalar subquery so a new day starts with the full allowance instead of zero.
create or replace function public.get_like_allowance()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare viewer uuid:=public.current_profile_id(); premium boolean; used_count integer;
  today_tr date:=(now() at time zone 'Europe/Istanbul')::date; resets timestamptz;
begin
  if viewer is null then raise exception 'profile_required'; end if;
  premium:=exists(select 1 from public.user_entitlements where profile_id=viewer and noir_until>now());
  select coalesce((select like_count from public.swipe_daily_usage where profile_id=viewer and usage_date=today_tr),0) into used_count;
  resets:=((today_tr+1)::timestamp at time zone 'Europe/Istanbul');
  return jsonb_build_object('remaining',case when premium then null else greatest(10-used_count,0) end,
    'limit',case when premium then null else 10 end,'premium',premium,'resetsAt',resets);
end;
$$;

create or replace function public.get_message_allowance()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare viewer uuid:=public.current_profile_id(); premium boolean; used_messages integer; used_requests integer;
  today_tr date:=(now() at time zone 'Europe/Istanbul')::date; message_limit integer; request_limit integer;
begin
  if viewer is null then raise exception 'profile_required'; end if;
  premium:=exists(select 1 from public.user_entitlements where profile_id=viewer and noir_until>now());
  message_limit:=case when premium then 100 else 25 end; request_limit:=case when premium then 3 else 1 end;
  select coalesce((select sent_count from public.message_daily_usage where profile_id=viewer and usage_date=today_tr),0) into used_messages;
  select coalesce((select request_count from public.message_request_daily_usage where profile_id=viewer and usage_date=today_tr),0) into used_requests;
  return jsonb_build_object('remaining',greatest(message_limit-used_messages,0),'limit',message_limit,
    'requestRemaining',greatest(request_limit-used_requests,0),'requestLimit',request_limit,
    'resetsAt',((today_tr+1)::timestamp at time zone 'Europe/Istanbul'),'premium',premium);
end;
$$;

revoke all on function public.get_like_allowance() from public;
revoke all on function public.get_message_allowance() from public;
grant execute on function public.get_like_allowance() to authenticated;
grant execute on function public.get_message_allowance() to authenticated;

-- Closing a chat is cleanup and must stay idempotent after block/unmatch changes
-- the match status. Opening still requires an active match membership.
create or replace function public.touch_active_chat(match_uuid uuid, is_open boolean default true)
returns timestamptz language plpgsql security definer set search_path=public
as $$
declare viewer uuid:=public.current_profile_id(); touched timestamptz:=now();
begin
  if viewer is null then raise exception 'not_allowed'; end if;
  if not is_open then
    delete from public.active_chat_sessions where profile_id=viewer and match_id=match_uuid;
    return touched;
  end if;
  if not exists(select 1 from public.matches where id=match_uuid and status='active' and viewer in(user_a,user_b)) then
    raise exception 'not_allowed';
  end if;
  insert into public.active_chat_sessions(profile_id,match_id,last_heartbeat_at)
  values(viewer,match_uuid,touched)
  on conflict(profile_id) do update set match_id=excluded.match_id,last_heartbeat_at=excluded.last_heartbeat_at;
  return touched;
end;
$$;

revoke all on function public.touch_active_chat(uuid,boolean) from public;
grant execute on function public.touch_active_chat(uuid,boolean) to authenticated;


-- ===== 047_tighten_legacy_admin_rls.sql =====
-- Legacy policies treated every admin role as an unrestricted data editor.
-- Admin routes use the service role after explicit RBAC; direct clients stay scoped.

drop policy if exists "users edit own profile" on public.profiles;
create policy "users edit own profile" on public.profiles for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "owners manage photos" on public.profile_photos;
create policy "owners manage photos" on public.profile_photos for all to authenticated
using (profile_id = public.current_profile_id())
with check (profile_id = public.current_profile_id());

drop policy if exists "owners manage intentions" on public.profile_intentions;
create policy "owners manage intentions" on public.profile_intentions for all to authenticated
using (profile_id = public.current_profile_id())
with check (profile_id = public.current_profile_id());

drop policy if exists "owners manage answers" on public.profile_answers;
create policy "owners manage answers" on public.profile_answers for all to authenticated
using (profile_id = public.current_profile_id())
with check (profile_id = public.current_profile_id());

drop policy if exists "users manage own swipes" on public.swipes;
create policy "users manage own swipes" on public.swipes for all to authenticated
using (swiper_id = public.current_profile_id())
with check (swiper_id = public.current_profile_id());

drop policy if exists "admins manage personas" on public.bot_personas;
create policy "bot roles manage personas" on public.bot_personas for all to authenticated
using (public.has_admin_role(array['owner','bot_editor']))
with check (public.has_admin_role(array['owner','bot_editor']));

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
        or public.has_admin_role(array['owner','moderator','support'])
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


-- ===== 048_discovery_lifecycle_and_query_efficiency.sql =====
-- Keep candidate listing consistent with the decision lifecycle and perform
-- mutual eligibility before LIMIT so discovery does not need one RPC per row.

drop function if exists public.get_discovery_candidates(integer);

create function public.get_discovery_candidates(candidate_limit integer default 20)
returns table (
  id uuid,
  kind public.profile_kind,
  display_name text,
  age integer,
  city text,
  gender text,
  is_verified boolean,
  photo_path text,
  badges text[],
  prompt text,
  answer text
)
language sql stable security definer set search_path=''
as $$
  select
    target.id,
    target.kind,
    target.display_name,
    extract(year from age(current_date,target.birth_date))::integer,
    target.city,
    target.gender,
    target.is_verified,
    photo.photo_path,
    coalesce(badge_list.badges,array[]::text[]),
    response.prompt,
    response.answer
  from public.profiles target
  join public.profiles viewer on viewer.id=public.current_profile_id()
  left join public.discovery_preferences pref on pref.profile_id=viewer.id
  join lateral (
    select coalesce(pp.variants->>'960',pp.variants->>'480',pp.storage_path) photo_path
    from public.profile_photos pp
    where pp.profile_id=target.id
      and pp.processing_status='ready'
      and pp.moderation_status='approved'
    order by pp.is_primary desc,pp.sort_order
    limit 1
  ) photo on true
  left join lateral (
    select array_agg(ib.label order by ib.label) badges
    from public.profile_intentions pi
    join public.intent_badges ib on ib.id=pi.badge_id
    where pi.profile_id=target.id
  ) badge_list on true
  left join lateral (
    select ip.prompt,pa.answer
    from public.profile_answers pa
    join public.icebreaker_prompts ip on ip.id=pa.prompt_id
    where pa.profile_id=target.id
    order by pa.sort_order
    limit 1
  ) response on true
  where target.id<>viewer.id
    and public.mutually_eligible(viewer.id,target.id)
    and extract(year from age(current_date,target.birth_date))::integer between coalesce(pref.min_age,18) and coalesce(pref.max_age,80)
    and target.gender=any(coalesce(pref.interested_genders,array['kadın','erkek','nonbinary','other']::text[]))
    and (
      not coalesce(pref.verified_only,false)
      or not exists(select 1 from public.user_entitlements ue where ue.profile_id=viewer.id and ue.noir_until>now())
      or target.is_verified
    )
    and (
      not coalesce(pref.same_city_only,false)
      or not exists(select 1 from public.user_entitlements ue where ue.profile_id=viewer.id and ue.noir_until>now())
      or viewer.city is null
      or target.city=viewer.city
    )
    and not exists(
      select 1
      from public.swipes s
      where s.swiper_id=viewer.id
        and s.target_id=target.id
        and s.created_at>now()-interval '30 days'
    )
    and not exists(
      select 1
      from public.matches m
      where m.user_a=least(viewer.id,target.id)
        and m.user_b=greatest(viewer.id,target.id)
        and m.connection_type='matched'
        and (
          m.status='active'
          or (m.status='unmatched' and coalesce(m.closed_at,m.matched_at)>now()-interval '90 days')
        )
    )
  order by exists(
      select 1 from public.swipes incoming
      where incoming.swiper_id=target.id
        and incoming.target_id=viewer.id
        and incoming.direction='super'
        and incoming.created_at>now()-interval '30 days'
    ) desc,
    exists(
      select 1 from public.swipes incoming
      where incoming.swiper_id=target.id
        and incoming.target_id=viewer.id
        and incoming.direction='right'
        and incoming.created_at>now()-interval '30 days'
    ) desc,
    md5(target.id::text||viewer.id::text||current_date::text)
  limit least(greatest(coalesce(candidate_limit,20),1),40);
$$;

revoke all on function public.get_discovery_candidates(integer) from public;
grant execute on function public.get_discovery_candidates(integer) to authenticated;

-- Return one exact summary per conversation instead of downloading a shared
-- 1,000-message window that can hide quieter conversations.
create or replace function public.get_conversation_message_summaries(requested_match_ids uuid[])
returns table (
  match_id uuid,
  last_body text,
  last_kind public.message_kind,
  last_sender_id uuid,
  last_at timestamptz,
  unread_count bigint
)
language sql stable security definer set search_path=''
as $$
  select
    connection.id,
    latest.body,
    latest.kind,
    latest.sender_id,
    latest.created_at,
    (
      select count(*)
      from public.messages unread
      where unread.match_id=connection.id
        and unread.sender_id<>viewer.id
        and unread.read_at is null
    )
  from public.matches connection
  join public.profiles viewer on viewer.id=public.current_profile_id()
  left join lateral (
    select message.body,message.kind,message.sender_id,message.created_at
    from public.messages message
    where message.match_id=connection.id
    order by message.created_at desc,message.id desc
    limit 1
  ) latest on true
  where connection.id=any(coalesce(requested_match_ids,array[]::uuid[]))
    and viewer.id in(connection.user_a,connection.user_b);
$$;

revoke all on function public.get_conversation_message_summaries(uuid[]) from public;
grant execute on function public.get_conversation_message_summaries(uuid[]) to authenticated;

-- Enforce the rolling 24-hour delivery limit at delivery time. A queued match
-- crossing midnight is postponed instead of bypassing the limit.
create or replace function public.process_due_bot_matches_service(batch_limit integer default 20,only_member uuid default null)
returns table(decision_id uuid,match_id uuid,member_profile_id uuid,bot_profile_id uuid)
language plpgsql security definer set search_path=''
as $$
declare decision public.bot_match_decisions%rowtype; created_match uuid; last_delivery timestamptz;
begin
  if auth.role()<>'service_role' then raise exception 'service_role_required'; end if;
  for decision in select d.* from public.bot_match_decisions d
    where d.status='queued' and d.scheduled_for<=now() and (only_member is null or d.member_profile_id=only_member)
    order by d.scheduled_for for update skip locked limit greatest(1,least(batch_limit,100))
  loop
    select max(d.matched_at) into last_delivery from public.bot_match_decisions d
    where d.member_profile_id=decision.member_profile_id and d.status='matched' and d.id<>decision.id;
    if last_delivery>now()-interval '24 hours' then
      update public.bot_match_decisions set scheduled_for=last_delivery+interval '24 hours',updated_at=now() where id=decision.id;
      continue;
    end if;
    if not exists(select 1 from public.profiles where id=decision.member_profile_id and kind='human' and onboarding_completed and is_discoverable and deleted_at is null and safety_restricted_at is null)
      or not exists(select 1 from public.profiles where id=decision.bot_profile_id and kind='bot' and onboarding_completed and is_discoverable and deleted_at is null and safety_restricted_at is null)
      or exists(select 1 from public.blocks where (blocker_id=decision.member_profile_id and blocked_id=decision.bot_profile_id) or (blocker_id=decision.bot_profile_id and blocked_id=decision.member_profile_id)) then
      update public.bot_match_decisions set status='cancelled',cancellation_reason='profile_unavailable',updated_at=now() where id=decision.id;
      continue;
    end if;
    insert into public.matches(user_a,user_b,status,connection_type,request_status,request_expires_at,closed_at)
    values(least(decision.member_profile_id,decision.bot_profile_id),greatest(decision.member_profile_id,decision.bot_profile_id),'active','matched',null,null,null)
    on conflict(user_a,user_b) do update set status='active',connection_type='matched',request_status=null,request_expires_at=null,closed_at=null,matched_at=now()
    returning id into created_match;
    update public.bot_match_decisions set status='matched',match_id=created_match,matched_at=now(),updated_at=now() where id=decision.id;
    decision_id:=decision.id; match_id:=created_match; member_profile_id:=decision.member_profile_id; bot_profile_id:=decision.bot_profile_id; return next;
  end loop;
end;
$$;

revoke all on function public.process_due_bot_matches_service(integer,uuid) from public;
grant execute on function public.process_due_bot_matches_service(integer,uuid) to service_role;

-- The 90-day rediscovery rule needs a reliable close timestamp.
create or replace function public.unmatch_profile(target_profile uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare viewer uuid:=public.current_profile_id(); match_uuid uuid;
begin
  if viewer is null then raise exception 'profile_required'; end if;
  update public.matches
  set status='unmatched',request_status=coalesce(request_status,'closed'),closed_at=now()
  where status='active'
    and connection_type='matched'
    and user_a=least(viewer,target_profile)
    and user_b=greatest(viewer,target_profile)
  returning id into match_uuid;
  if match_uuid is null then raise exception 'active_match_required'; end if;
  update public.bot_reply_jobs
  set status='cancelled',cancellation_reason='unmatched',completed_at=now(),updated_at=now()
  where match_id=match_uuid and status in ('queued','typing','processing');
end;
$$;

revoke all on function public.unmatch_profile(uuid) from public;
grant execute on function public.unmatch_profile(uuid) to authenticated;


-- ===== 049_discovery_filters_and_message_pages.sql =====
-- Finish the wired discovery filters, keep standard filters standard, and
-- return the newest chat messages instead of the oldest rows in long chats.

create index if not exists profiles_discovery_filter_idx
  on public.profiles(gender,city,relationship_goal) where is_discoverable and onboarding_completed;

drop function if exists public.get_discovery_candidates(integer);
create function public.get_discovery_candidates(candidate_limit integer default 20)
returns table (
  id uuid, kind public.profile_kind, display_name text, age integer, city text,
  gender text, is_verified boolean, photo_path text, badges text[], prompt text, answer text
)
language sql stable security definer set search_path=''
as $$
  select target.id,target.kind,target.display_name,
    extract(year from age(current_date,target.birth_date))::integer,target.city,target.gender,target.is_verified,
    photo.photo_path,coalesce(badge_list.badges,array[]::text[]),response.prompt,response.answer
  from public.profiles target
  join public.profiles viewer on viewer.id=public.current_profile_id()
  left join public.discovery_preferences pref on pref.profile_id=viewer.id
  left join public.user_entitlements entitlement on entitlement.profile_id=viewer.id and entitlement.noir_until>now()
  join lateral (
    select coalesce(pp.variants->>'960',pp.variants->>'480',pp.storage_path) photo_path
    from public.profile_photos pp where pp.profile_id=target.id
      and pp.processing_status='ready' and pp.moderation_status='approved'
    order by pp.is_primary desc,pp.sort_order limit 1
  ) photo on true
  left join lateral (
    select array_agg(ib.label order by ib.label) badges from public.profile_intentions pi
    join public.intent_badges ib on ib.id=pi.badge_id where pi.profile_id=target.id
  ) badge_list on true
  left join lateral (
    select ip.prompt,pa.answer from public.profile_answers pa
    join public.icebreaker_prompts ip on ip.id=pa.prompt_id where pa.profile_id=target.id
    order by pa.sort_order limit 1
  ) response on true
  where target.id<>viewer.id
    and public.mutually_eligible(viewer.id,target.id)
    and extract(year from age(current_date,target.birth_date))::integer between coalesce(pref.min_age,18) and coalesce(pref.max_age,80)
    and target.gender=any(coalesce(pref.interested_genders,array['kadın','erkek','nonbinary','other']::text[]))
    and (not coalesce(pref.same_city_only,false) or viewer.city is null or lower(target.city)=lower(viewer.city))
    and (cardinality(coalesce(pref.cities,array[]::text[]))=0 or exists(select 1 from unnest(pref.cities) selected_city where lower(selected_city)=lower(target.city)))
    and (cardinality(coalesce(pref.relationship_goals,array[]::text[]))=0 or target.relationship_goal=any(pref.relationship_goals))
    and (entitlement.profile_id is null or (
      (not coalesce(pref.verified_only,false) or target.is_verified)
      and (cardinality(coalesce(pref.marital_statuses,array[]::text[]))=0 or target.marital_status=any(pref.marital_statuses))
      and (cardinality(coalesce(pref.has_children_values,array[]::boolean[]))=0 or target.has_children=any(pref.has_children_values))
      and (cardinality(coalesce(pref.children_preferences,array[]::text[]))=0 or target.children_preference=any(pref.children_preferences))
      and (cardinality(coalesce(pref.alcohol_values,array[]::text[]))=0 or target.alcohol_use=any(pref.alcohol_values))
      and (cardinality(coalesce(pref.smoking_values,array[]::text[]))=0 or target.smoking_use=any(pref.smoking_values))
      and (cardinality(coalesce(pref.pet_values,array[]::text[]))=0 or target.pet_preference=any(pref.pet_values))
      and (cardinality(coalesce(pref.sports_values,array[]::text[]))=0 or target.sports_habit=any(pref.sports_values))
      and (pref.min_height_cm is null or target.height_cm>=pref.min_height_cm)
      and (pref.max_height_cm is null or target.height_cm<=pref.max_height_cm)
      and (cardinality(coalesce(pref.education_values,array[]::text[]))=0 or target.education_level=any(pref.education_values))
      and (cardinality(coalesce(pref.language_values,array[]::text[]))=0 or target.languages&&pref.language_values)
    ))
    and not exists(select 1 from public.swipes s where s.swiper_id=viewer.id and s.target_id=target.id and s.created_at>now()-interval '30 days')
    and not exists(select 1 from public.matches m where m.user_a=least(viewer.id,target.id) and m.user_b=greatest(viewer.id,target.id)
      and m.connection_type='matched' and (m.status='active' or (m.status='unmatched' and coalesce(m.closed_at,m.matched_at)>now()-interval '90 days')))
  order by exists(select 1 from public.swipes incoming where incoming.swiper_id=target.id and incoming.target_id=viewer.id
      and incoming.direction='super' and incoming.created_at>now()-interval '30 days') desc,
    exists(select 1 from public.swipes incoming where incoming.swiper_id=target.id and incoming.target_id=viewer.id
      and incoming.direction='right' and incoming.created_at>now()-interval '30 days') desc,
    md5(target.id::text||viewer.id::text||current_date::text)
  limit least(greatest(coalesce(candidate_limit,20),1),40);
$$;
revoke all on function public.get_discovery_candidates(integer) from public;
grant execute on function public.get_discovery_candidates(integer) to authenticated;

create or replace function public.get_match_messages(match_uuid uuid, message_limit integer default 80)
returns table (
  id uuid, sender_id uuid, kind public.message_kind, body text, audio_path text,
  audio_duration_ms integer, audio_waveform smallint[], read_at timestamptz, created_at timestamptz
)
language sql stable security definer set search_path=''
as $$
  select page.id,page.sender_id,page.kind,page.body,page.audio_path,page.audio_duration_ms,page.audio_waveform,page.read_at,page.created_at
  from (
    select m.id,m.sender_id,m.kind,m.body,m.audio_path,m.audio_duration_ms,m.audio_waveform,
      case when public.can_review_match(match_uuid) or public.has_active_noir() then m.read_at else null end read_at,m.created_at
    from public.messages m
    where m.match_id=match_uuid and (public.in_match(match_uuid) or public.can_review_match(match_uuid))
    order by m.created_at desc,m.id desc limit least(greatest(coalesce(message_limit,80),1),120)
  ) page order by page.created_at,page.id;
$$;
revoke all on function public.get_match_messages(uuid,integer) from public;
grant execute on function public.get_match_messages(uuid,integer) to authenticated;

-- This campaign bypassed the threshold-based bot match contract and is no
-- longer called by the worker. Remove its service entry point as well.
drop function if exists public.seed_new_member_bot_likes_service(integer);


-- ===== 050_distance_noir_filters_and_chat_pagination.sql =====
-- City-centre distance, complete compatibility filters, and cursor chat pages.
-- Province coordinates: https://github.com/enisbt/turkey-cities (WGS84).

create or replace function public.normalize_location(value text)
returns text language sql immutable parallel safe set search_path=''
as $$ select translate(lower(replace(coalesce(value,''),'İ','i')),'çğıöşü','cgiosu') $$;

create table if not exists public.city_centers (
  city_key text primary key,
  latitude double precision not null check(latitude between -90 and 90),
  longitude double precision not null check(longitude between -180 and 180)
);
alter table public.city_centers enable row level security;
revoke all on public.city_centers from anon,authenticated;

insert into public.city_centers(city_key,latitude,longitude) values
('adana',36.9914,35.3308),('adiyaman',37.7636,38.2773),('afyonkarahisar',38.7569,30.5387),('agri',39.7191,43.0506),
('amasya',40.6565,35.8373),('ankara',39.9334,32.8597),('antalya',36.8969,30.7133),('artvin',41.1809,41.8208),
('aydin',37.8380,27.8456),('balikesir',39.6533,27.8903),('bilecik',40.1426,29.9793),('bingol',38.8855,40.4966),
('bitlis',38.4006,42.1095),('bolu',40.7325,31.6082),('burdur',37.7183,30.2823),('bursa',40.1885,29.0610),
('canakkale',40.1467,26.4086),('cankiri',40.6002,33.6162),('corum',40.5499,34.9537),('denizli',37.7830,29.0963),
('diyarbakir',37.9250,40.2110),('edirne',41.6771,26.5557),('elazig',38.6748,39.2225),('erzincan',39.7468,39.4911),
('erzurum',39.9055,41.2658),('eskisehir',39.7667,30.5256),('gaziantep',37.0660,37.3781),('giresun',40.9175,38.3927),
('gumushane',40.4608,39.4803),('hakkari',37.5774,43.7368),('hatay',36.2023,36.1613),('isparta',37.7626,30.5537),
('mersin',36.8121,34.6415),('istanbul',41.0082,28.9784),('izmir',38.4237,27.1428),('kars',40.6013,43.0975),
('kastamonu',41.3766,33.7765),('kayseri',38.7205,35.4826),('kirklareli',41.7355,27.2244),('kirsehir',39.1461,34.1595),
('kocaeli',40.7654,29.9408),('konya',37.8746,32.4932),('kutahya',39.4200,29.9857),('malatya',38.3554,38.3335),
('manisa',38.6140,27.4296),('kahramanmaras',37.5753,36.9228),('mardin',37.3129,40.7340),('mugla',37.2154,28.3634),
('mus',38.7346,41.4910),('nevsehir',38.6247,34.7142),('nigde',37.9698,34.6766),('ordu',40.9862,37.8797),
('rize',41.0255,40.5177),('sakarya',40.7889,30.4060),('samsun',41.2797,36.3361),('siirt',37.9274,41.9420),
('sinop',42.0280,35.1517),('sivas',39.7505,37.0150),('tekirdag',40.9781,27.5117),('tokat',40.3235,36.5522),
('trabzon',41.0027,39.7168),('tunceli',39.1062,39.5483),('sanliurfa',37.1674,38.7955),('usak',38.6742,29.4059),
('van',38.5012,43.3730),('yozgat',39.8210,34.8086),('zonguldak',41.4535,31.7894),('aksaray',38.3686,34.0297),
('bayburt',40.2603,40.2280),('karaman',37.1810,33.2222),('kirikkale',39.8398,33.5089),('batman',37.8895,41.1293),
('sirnak',37.5190,42.4537),('bartin',41.6376,32.3338),('ardahan',41.1130,42.7023),('igdir',39.9201,44.0436),
('yalova',40.6549,29.2842),('karabuk',41.1956,32.6227),('kilis',36.7165,37.1147),('osmaniye',37.0746,36.2464),
('duzce',40.8387,31.1626)
on conflict(city_key) do update set latitude=excluded.latitude,longitude=excluded.longitude;

alter table public.profiles drop constraint if exists profiles_alcohol_use_check;
alter table public.profiles add constraint profiles_alcohol_use_check check(alcohol_use is null or alcohol_use in ('never','occasionally','socially','regularly'));
alter table public.profiles drop constraint if exists profiles_smoking_use_check;
alter table public.profiles add constraint profiles_smoking_use_check check(smoking_use is null or smoking_use in ('never','occasionally','regularly','quitting'));
alter table public.profiles drop constraint if exists profiles_pet_preference_check;
alter table public.profiles add constraint profiles_pet_preference_check check(pet_preference is null or pet_preference in ('has_pets','likes_pets','no_pets','allergic'));
alter table public.profiles drop constraint if exists profiles_sports_habit_check;
alter table public.profiles add constraint profiles_sports_habit_check check(sports_habit is null or sports_habit in ('never','sometimes','regularly','daily'));
alter table public.profiles drop constraint if exists profiles_education_level_check;
alter table public.profiles add constraint profiles_education_level_check check(education_level is null or education_level in ('high_school','associate','bachelor','master','doctorate','other'));

create or replace function public.zodiac_for_birth_date(value date)
returns text language sql immutable parallel safe set search_path=''
as $$ select case
  when (extract(month from value)=3 and extract(day from value)>=21) or (extract(month from value)=4 and extract(day from value)<=19) then 'aries'
  when (extract(month from value)=4 and extract(day from value)>=20) or (extract(month from value)=5 and extract(day from value)<=20) then 'taurus'
  when (extract(month from value)=5 and extract(day from value)>=21) or (extract(month from value)=6 and extract(day from value)<=20) then 'gemini'
  when (extract(month from value)=6 and extract(day from value)>=21) or (extract(month from value)=7 and extract(day from value)<=22) then 'cancer'
  when (extract(month from value)=7 and extract(day from value)>=23) or (extract(month from value)=8 and extract(day from value)<=22) then 'leo'
  when (extract(month from value)=8 and extract(day from value)>=23) or (extract(month from value)=9 and extract(day from value)<=22) then 'virgo'
  when (extract(month from value)=9 and extract(day from value)>=23) or (extract(month from value)=10 and extract(day from value)<=22) then 'libra'
  when (extract(month from value)=10 and extract(day from value)>=23) or (extract(month from value)=11 and extract(day from value)<=21) then 'scorpio'
  when (extract(month from value)=11 and extract(day from value)>=22) or (extract(month from value)=12 and extract(day from value)<=21) then 'sagittarius'
  when (extract(month from value)=12 and extract(day from value)>=22) or (extract(month from value)=1 and extract(day from value)<=19) then 'capricorn'
  when (extract(month from value)=1 and extract(day from value)>=20) or (extract(month from value)=2 and extract(day from value)<=18) then 'aquarius'
  else 'pisces' end $$;

drop function if exists public.get_discovery_candidates(integer);
create function public.get_discovery_candidates(candidate_limit integer default 20)
returns table(id uuid,kind public.profile_kind,display_name text,age integer,city text,gender text,is_verified boolean,photo_path text,badges text[],prompt text,answer text,distance_km integer)
language sql stable security definer set search_path=''
as $$
  select target.id,target.kind,target.display_name,extract(year from age(current_date,target.birth_date))::integer,target.city,target.gender,target.is_verified,
    photo.photo_path,coalesce(badge_list.badges,array[]::text[]),response.prompt,response.answer,
    case when viewer_city.city_key is null or target_city.city_key is null then null else round(distance.km)::integer end
  from public.profiles target
  join public.profiles viewer on viewer.id=public.current_profile_id()
  left join public.discovery_preferences pref on pref.profile_id=viewer.id
  left join public.user_entitlements entitlement on entitlement.profile_id=viewer.id and entitlement.noir_until>now()
  left join public.city_centers viewer_city on viewer_city.city_key=public.normalize_location(viewer.city)
  left join public.city_centers target_city on target_city.city_key=public.normalize_location(target.city)
  left join lateral (select 6371*2*asin(sqrt(power(sin(radians(target_city.latitude-viewer_city.latitude)/2),2)+cos(radians(viewer_city.latitude))*cos(radians(target_city.latitude))*power(sin(radians(target_city.longitude-viewer_city.longitude)/2),2))) km) distance on viewer_city.city_key is not null and target_city.city_key is not null
  join lateral (select coalesce(pp.variants->>'960',pp.variants->>'480',pp.storage_path) photo_path from public.profile_photos pp where pp.profile_id=target.id and pp.processing_status='ready' and pp.moderation_status='approved' order by pp.is_primary desc,pp.sort_order limit 1) photo on true
  left join lateral (select array_agg(ib.label order by ib.label) badges from public.profile_intentions pi join public.intent_badges ib on ib.id=pi.badge_id where pi.profile_id=target.id) badge_list on true
  left join lateral (select ip.prompt,pa.answer from public.profile_answers pa join public.icebreaker_prompts ip on ip.id=pa.prompt_id where pa.profile_id=target.id order by pa.sort_order limit 1) response on true
  where target.id<>viewer.id and public.mutually_eligible(viewer.id,target.id)
    and extract(year from age(current_date,target.birth_date))::integer between coalesce(pref.min_age,18) and coalesce(pref.max_age,80)
    and target.gender=any(coalesce(pref.interested_genders,array['kadın','erkek','nonbinary','other']::text[]))
    and (not coalesce(pref.same_city_only,false) or public.normalize_location(target.city)=public.normalize_location(viewer.city))
    and (cardinality(coalesce(pref.cities,array[]::text[]))=0 or exists(select 1 from unnest(pref.cities) selected_city where public.normalize_location(selected_city)=public.normalize_location(target.city)))
    and (pref.max_distance_km is null or distance.km<=pref.max_distance_km)
    and (cardinality(coalesce(pref.relationship_goals,array[]::text[]))=0 or target.relationship_goal=any(pref.relationship_goals))
    and (entitlement.profile_id is null or ((not coalesce(pref.verified_only,false) or target.is_verified)
      and (cardinality(coalesce(pref.marital_statuses,array[]::text[]))=0 or target.marital_status=any(pref.marital_statuses))
      and (cardinality(coalesce(pref.has_children_values,array[]::boolean[]))=0 or target.has_children=any(pref.has_children_values))
      and (cardinality(coalesce(pref.children_preferences,array[]::text[]))=0 or target.children_preference=any(pref.children_preferences))
      and (cardinality(coalesce(pref.alcohol_values,array[]::text[]))=0 or target.alcohol_use=any(pref.alcohol_values))
      and (cardinality(coalesce(pref.smoking_values,array[]::text[]))=0 or target.smoking_use=any(pref.smoking_values))
      and (cardinality(coalesce(pref.pet_values,array[]::text[]))=0 or target.pet_preference=any(pref.pet_values))
      and (cardinality(coalesce(pref.sports_values,array[]::text[]))=0 or target.sports_habit=any(pref.sports_values))
      and (cardinality(coalesce(pref.zodiac_values,array[]::text[]))=0 or public.zodiac_for_birth_date(target.birth_date)=any(pref.zodiac_values))
      and (pref.min_height_cm is null or target.height_cm>=pref.min_height_cm) and (pref.max_height_cm is null or target.height_cm<=pref.max_height_cm)
      and (cardinality(coalesce(pref.education_values,array[]::text[]))=0 or target.education_level=any(pref.education_values))
      and (cardinality(coalesce(pref.language_values,array[]::text[]))=0 or exists(select 1 from unnest(pref.language_values) as wanted(value) join unnest(target.languages) as spoken(value) on lower(wanted.value)=lower(spoken.value)))))
    and not exists(select 1 from public.swipes s where s.swiper_id=viewer.id and s.target_id=target.id and s.created_at>now()-interval '30 days')
    and not exists(select 1 from public.matches m where m.user_a=least(viewer.id,target.id) and m.user_b=greatest(viewer.id,target.id) and m.connection_type='matched' and (m.status='active' or (m.status='unmatched' and coalesce(m.closed_at,m.matched_at)>now()-interval '90 days')))
  order by exists(select 1 from public.swipes incoming where incoming.swiper_id=target.id and incoming.target_id=viewer.id and incoming.direction='super' and incoming.created_at>now()-interval '30 days') desc,
    exists(select 1 from public.swipes incoming where incoming.swiper_id=target.id and incoming.target_id=viewer.id and incoming.direction='right' and incoming.created_at>now()-interval '30 days') desc,
    md5(target.id::text||viewer.id::text||current_date::text)
  limit least(greatest(coalesce(candidate_limit,20),1),40);
$$;
revoke all on function public.get_discovery_candidates(integer) from public;
grant execute on function public.get_discovery_candidates(integer) to authenticated;

create or replace function public.get_match_message_page(match_uuid uuid,page_limit integer default 51,before_created_at timestamptz default null,before_message_id uuid default null)
returns table(id uuid,sender_id uuid,kind public.message_kind,body text,audio_path text,audio_duration_ms integer,audio_waveform smallint[],read_at timestamptz,created_at timestamptz)
language sql stable security definer set search_path=''
as $$
  select page.id,page.sender_id,page.kind,page.body,page.audio_path,page.audio_duration_ms,page.audio_waveform,page.read_at,page.created_at from (
    select m.id,m.sender_id,m.kind,m.body,m.audio_path,m.audio_duration_ms,m.audio_waveform,
      case when public.can_review_match(match_uuid) or public.has_active_noir() then m.read_at else null end read_at,m.created_at
    from public.messages m where m.match_id=match_uuid and (public.in_match(match_uuid) or public.can_review_match(match_uuid))
      and (before_created_at is null or (m.created_at,m.id)<(before_created_at,coalesce(before_message_id,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
    order by m.created_at desc,m.id desc limit least(greatest(coalesce(page_limit,51),1),101)
  ) page order by page.created_at,page.id;
$$;
revoke all on function public.get_match_message_page(uuid,integer,timestamptz,uuid) from public;
grant execute on function public.get_match_message_page(uuid,integer,timestamptz,uuid) to authenticated;

revoke all on function public.normalize_location(text) from public;
revoke all on function public.zodiac_for_birth_date(date) from public;


-- ===== 051_hourly_noir_plan.sql =====
-- A genuine, one-time Lemon Squeezy product can grant a short Noir entitlement.
alter table public.premium_plans
  add column if not exists duration_minutes integer check (duration_minutes is null or duration_minutes between 1 and 525600);

insert into public.premium_plans(slug,name,duration_days,duration_minutes,price_amount,currency,is_active)
values ('noir-hourly','1 Saatlik Noir',1,60,24.50,'TRY',true)
on conflict (slug) do update set
  name=excluded.name,
  duration_days=excluded.duration_days,
  duration_minutes=excluded.duration_minutes,
  price_amount=excluded.price_amount,
  currency=excluded.currency,
  is_active=excluded.is_active,
  updated_at=now();

create or replace function public.approve_verified_shopier_payment(order_uuid uuid, shopier_order_id text)
returns timestamptz language plpgsql security definer set search_path=''
as $$
declare
  selected_order public.payment_orders%rowtype;
  access_days integer;
  access_minutes integer;
  new_until timestamptz;
begin
  if auth.role() <> 'service_role' then raise exception 'service_role_required'; end if;
  if nullif(btrim(shopier_order_id), '') is null then raise exception 'provider_order_required'; end if;
  select * into selected_order from public.payment_orders where id=order_uuid for update;
  if not found then raise exception 'order_not_found'; end if;
  if selected_order.provider <> 'shopier' then raise exception 'provider_mismatch'; end if;
  if selected_order.status='approved' then
    if selected_order.provider_order_id is distinct from shopier_order_id then raise exception 'provider_order_mismatch'; end if;
    select noir_until into new_until from public.user_entitlements where profile_id=selected_order.profile_id;
    return new_until;
  end if;
  if selected_order.status not in ('pending','awaiting_payment') then raise exception 'order_not_approvable'; end if;
  if exists(select 1 from public.payment_orders where provider='shopier' and provider_order_id=shopier_order_id and id<>order_uuid) then raise exception 'provider_order_already_used'; end if;
  select duration_days,duration_minutes into access_days,access_minutes from public.premium_plans where id=selected_order.plan_id;
  if access_days is null then raise exception 'plan_not_found'; end if;
  insert into public.user_entitlements(profile_id,noir_until,source,updated_at)
  values (selected_order.profile_id,now()+case when access_minutes is null then make_interval(days=>access_days) else make_interval(mins=>access_minutes) end,'shopier:'||shopier_order_id,now())
  on conflict(profile_id) do update set
    noir_until=greatest(coalesce(public.user_entitlements.noir_until,now()),now())+case when access_minutes is null then make_interval(days=>access_days) else make_interval(mins=>access_minutes) end,
    source='shopier:'||shopier_order_id,updated_at=now()
  returning noir_until into new_until;
  update public.payment_orders set status='approved',provider_order_id=shopier_order_id,reviewed_at=now(),updated_at=now() where id=order_uuid;
  return new_until;
end;
$$;

create or replace function public.approve_noir_payment(order_uuid uuid)
returns timestamptz language plpgsql security definer set search_path=''
as $$
declare
  selected_order public.payment_orders%rowtype;
  access_days integer;
  access_minutes integer;
  new_until timestamptz;
begin
  if not public.has_admin_role(array['owner']) then raise exception 'owner_required'; end if;
  select * into selected_order from public.payment_orders where id=order_uuid for update;
  if not found then raise exception 'order_not_found'; end if;
  if selected_order.status='approved' then select noir_until into new_until from public.user_entitlements where profile_id=selected_order.profile_id; return new_until; end if;
  if selected_order.provider not in ('bank_transfer','papara','crypto','manual') then raise exception 'manual_provider_required'; end if;
  if selected_order.status<>'under_review' then raise exception 'order_not_approvable'; end if;
  select duration_days,duration_minutes into access_days,access_minutes from public.premium_plans where id=selected_order.plan_id;
  if access_days is null then raise exception 'plan_not_found'; end if;
  insert into public.user_entitlements(profile_id,noir_until,source,updated_at)
  values (selected_order.profile_id,now()+case when access_minutes is null then make_interval(days=>access_days) else make_interval(mins=>access_minutes) end,'payment:'||order_uuid::text,now())
  on conflict(profile_id) do update set
    noir_until=greatest(coalesce(public.user_entitlements.noir_until,now()),now())+case when access_minutes is null then make_interval(days=>access_days) else make_interval(mins=>access_minutes) end,
    source='payment:'||order_uuid::text,updated_at=now()
  returning noir_until into new_until;
  update public.payment_orders set status='approved',reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=order_uuid;
  insert into public.admin_audit_log(actor_user_id,action,target_type,target_id,metadata) values(auth.uid(),'payment.approved','payment_order',order_uuid::text,jsonb_build_object('profileId',selected_order.profile_id,'noirUntil',new_until));
  return new_until;
end;
$$;

revoke all on function public.approve_verified_shopier_payment(uuid,text) from public;
grant execute on function public.approve_verified_shopier_payment(uuid,text) to service_role;
revoke all on function public.approve_noir_payment(uuid) from public;
grant execute on function public.approve_noir_payment(uuid) to authenticated;


-- ===== 052_shopier_static_product_fulfillment.sql =====
create or replace function public.profile_id_for_auth_email(lookup_email text)
returns uuid
language sql
security definer
set search_path = public, auth
stable
as $$
  select p.id
  from auth.users u
  join public.profiles p on p.user_id = u.id
  where lower(u.email) = lower(btrim(lookup_email))
    and p.kind = 'human'
    and p.deleted_at is null
  limit 1;
$$;

revoke all on function public.profile_id_for_auth_email(text) from public;
grant execute on function public.profile_id_for_auth_email(text) to service_role;


-- ===== 053_profile_stories.sql =====
create table public.profile_stories (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  constraint story_lifetime check (expires_at > created_at and expires_at <= created_at + interval '24 hours')
);

create index profile_stories_active on public.profile_stories(profile_id, expires_at desc);
alter table public.profile_stories enable row level security;
revoke all on public.profile_stories from anon, authenticated;


-- ===== 054_meetings_and_story_views.sql =====
create table public.meeting_options (
  id uuid primary key default gen_random_uuid(),
  label text not null check (length(trim(label)) between 2 and 60),
  icon text not null default 'coffee' check (icon in ('coffee','walk','event')),
  active boolean not null default true,
  sort_order integer not null default 0
);
insert into public.meeting_options(label, icon, sort_order) values
  ('Bugün kahve', 'coffee', 0), ('Bir yürüyüş', 'walk', 1), ('Birlikte etkinlik', 'event', 2);
create table public.meeting_intents (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  option_id uuid not null references public.meeting_options(id),
  expires_at timestamptz not null default (now() + interval '24 hours')
);
create index meeting_intents_active on public.meeting_intents(option_id, expires_at);
create table public.story_views (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  story_id uuid not null references public.profile_stories(id) on delete cascade,
  primary key(profile_id, story_id)
);
alter table public.meeting_options enable row level security;
alter table public.meeting_intents enable row level security;
alter table public.story_views enable row level security;
revoke all on public.meeting_options, public.meeting_intents, public.story_views from anon, authenticated;
create function public.get_meeting_candidates(candidate_limit integer default 200)
returns table(id uuid,kind public.profile_kind,display_name text,age integer,city text,gender text,is_verified boolean,photo_path text,badges text[],prompt text,answer text,distance_km integer)
language sql stable security definer set search_path=''
as $$
  select target.id,target.kind,target.display_name,extract(year from age(current_date,target.birth_date))::integer,target.city,target.gender,target.is_verified,
    photo.photo_path,coalesce(badge_list.badges,array[]::text[]),response.prompt,response.answer,
    case when viewer_city.city_key is null or target_city.city_key is null then null else round(distance.km)::integer end
  from public.profiles target
  join public.profiles viewer on viewer.id=public.current_profile_id()
  left join public.discovery_preferences pref on pref.profile_id=viewer.id
  left join public.user_entitlements entitlement on entitlement.profile_id=viewer.id and entitlement.noir_until>now()
  left join public.city_centers viewer_city on viewer_city.city_key=public.normalize_location(viewer.city)
  left join public.city_centers target_city on target_city.city_key=public.normalize_location(target.city)
  left join lateral (select 6371*2*asin(sqrt(power(sin(radians(target_city.latitude-viewer_city.latitude)/2),2)+cos(radians(viewer_city.latitude))*cos(radians(target_city.latitude))*power(sin(radians(target_city.longitude-viewer_city.longitude)/2),2))) km) distance on viewer_city.city_key is not null and target_city.city_key is not null
  join lateral (select coalesce(pp.variants->>'960',pp.variants->>'480',pp.storage_path) photo_path from public.profile_photos pp where pp.profile_id=target.id and pp.processing_status='ready' and pp.moderation_status='approved' order by pp.is_primary desc,pp.sort_order limit 1) photo on true
  left join lateral (select array_agg(ib.label order by ib.label) badges from public.profile_intentions pi join public.intent_badges ib on ib.id=pi.badge_id where pi.profile_id=target.id) badge_list on true
  left join lateral (select ip.prompt,pa.answer from public.profile_answers pa join public.icebreaker_prompts ip on ip.id=pa.prompt_id where pa.profile_id=target.id order by pa.sort_order limit 1) response on true
  where target.kind='human' and target.id<>viewer.id and public.mutually_eligible(viewer.id,target.id)
    and exists(select 1 from public.meeting_intents mine join public.meeting_intents peer on peer.option_id=mine.option_id join public.meeting_options option on option.id=mine.option_id and option.active where mine.profile_id=viewer.id and peer.profile_id=target.id and mine.expires_at>now() and peer.expires_at>now())
    and extract(year from age(current_date,target.birth_date))::integer between coalesce(pref.min_age,18) and coalesce(pref.max_age,80)
    and target.gender=any(coalesce(pref.interested_genders,array['kadın','erkek','nonbinary','other']::text[]))
    and (not coalesce(pref.same_city_only,false) or public.normalize_location(target.city)=public.normalize_location(viewer.city))
    and (cardinality(coalesce(pref.cities,array[]::text[]))=0 or exists(select 1 from unnest(pref.cities) selected_city where public.normalize_location(selected_city)=public.normalize_location(target.city)))
    and (pref.max_distance_km is null or distance.km<=pref.max_distance_km)
    and (cardinality(coalesce(pref.relationship_goals,array[]::text[]))=0 or target.relationship_goal=any(pref.relationship_goals))
    and (entitlement.profile_id is null or ((not coalesce(pref.verified_only,false) or target.is_verified)
      and (cardinality(coalesce(pref.marital_statuses,array[]::text[]))=0 or target.marital_status=any(pref.marital_statuses))
      and (cardinality(coalesce(pref.has_children_values,array[]::boolean[]))=0 or target.has_children=any(pref.has_children_values))
      and (cardinality(coalesce(pref.children_preferences,array[]::text[]))=0 or target.children_preference=any(pref.children_preferences))
      and (cardinality(coalesce(pref.alcohol_values,array[]::text[]))=0 or target.alcohol_use=any(pref.alcohol_values))
      and (cardinality(coalesce(pref.smoking_values,array[]::text[]))=0 or target.smoking_use=any(pref.smoking_values))
      and (cardinality(coalesce(pref.pet_values,array[]::text[]))=0 or target.pet_preference=any(pref.pet_values))
      and (cardinality(coalesce(pref.sports_values,array[]::text[]))=0 or target.sports_habit=any(pref.sports_values))
      and (cardinality(coalesce(pref.zodiac_values,array[]::text[]))=0 or public.zodiac_for_birth_date(target.birth_date)=any(pref.zodiac_values))
      and (pref.min_height_cm is null or target.height_cm>=pref.min_height_cm) and (pref.max_height_cm is null or target.height_cm<=pref.max_height_cm)
      and (cardinality(coalesce(pref.education_values,array[]::text[]))=0 or target.education_level=any(pref.education_values))
      and (cardinality(coalesce(pref.language_values,array[]::text[]))=0 or exists(select 1 from unnest(pref.language_values) as wanted(value) join unnest(target.languages) as spoken(value) on lower(wanted.value)=lower(spoken.value)))))
    and not exists(select 1 from public.swipes s where s.swiper_id=viewer.id and s.target_id=target.id and s.direction='left' and s.created_at>now()-interval '30 days')
    and not exists(select 1 from public.matches m where m.user_a=least(viewer.id,target.id) and m.user_b=greatest(viewer.id,target.id) and m.connection_type='matched' and (m.status='unmatched' and coalesce(m.closed_at,m.matched_at)>now()-interval '90 days'))
  order by exists(select 1 from public.swipes incoming where incoming.swiper_id=target.id and incoming.target_id=viewer.id and incoming.direction='super' and incoming.created_at>now()-interval '30 days') desc,
    exists(select 1 from public.swipes incoming where incoming.swiper_id=target.id and incoming.target_id=viewer.id and incoming.direction='right' and incoming.created_at>now()-interval '30 days') desc,
    md5(target.id::text||viewer.id::text||current_date::text)
  limit least(greatest(coalesce(candidate_limit,200),1),200);
$$;
revoke all on function public.get_meeting_candidates(integer) from public;
grant execute on function public.get_meeting_candidates(integer) to authenticated;



-- ===== 055_chat_actions.sql =====
alter table public.messages add column if not exists reply_to_id uuid references public.messages(id) on delete set null;
alter table public.messages add column if not exists deleted_at timestamptz;

create table if not exists public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (emoji in ('❤️','😂','✨','👍','😮')),
  created_at timestamptz not null default now(),
  primary key (message_id, profile_id)
);
alter table public.message_reactions enable row level security;
revoke all on public.message_reactions from anon, authenticated;

create or replace function public.get_match_message_page_v2(match_uuid uuid,page_limit integer default 51,before_created_at timestamptz default null,before_message_id uuid default null)
returns table(id uuid,sender_id uuid,kind public.message_kind,body text,audio_path text,audio_duration_ms integer,audio_waveform smallint[],read_at timestamptz,created_at timestamptz,reply_to_id uuid,reply_body text,reply_kind public.message_kind,deleted_at timestamptz,reactions jsonb)
language sql stable security definer set search_path=''
as $$
  select page.id,page.sender_id,page.kind,page.body,page.audio_path,page.audio_duration_ms,page.audio_waveform,page.read_at,page.created_at,
    page.reply_to_id,reply.body,reply.kind,page.deleted_at,
    coalesce((select jsonb_agg(jsonb_build_object('emoji',r.emoji,'profileId',r.profile_id)) from public.message_reactions r where r.message_id=page.id),'[]'::jsonb)
  from (
    select m.id,m.sender_id,m.kind,m.body,m.audio_path,m.audio_duration_ms,m.audio_waveform,
      case when public.can_review_match(match_uuid) or public.has_active_noir() then m.read_at else null end read_at,
      m.created_at,m.reply_to_id,m.deleted_at
    from public.messages m where m.match_id=match_uuid and (public.in_match(match_uuid) or public.can_review_match(match_uuid))
      and (before_created_at is null or (m.created_at,m.id)<(before_created_at,coalesce(before_message_id,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
    order by m.created_at desc,m.id desc limit least(greatest(coalesce(page_limit,51),1),101)
  ) page
  left join public.messages reply on reply.id=page.reply_to_id and reply.match_id=match_uuid
  order by page.created_at,page.id;
$$;
revoke all on function public.get_match_message_page_v2(uuid,integer,timestamptz,uuid) from public;
grant execute on function public.get_match_message_page_v2(uuid,integer,timestamptz,uuid) to authenticated;

create table public.profile_voice_prompts (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  prompt text not null check (length(prompt) between 3 and 100),
  audio_path text not null,
  duration_ms integer not null check (duration_ms between 15000 and 30000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profile_voice_prompts enable row level security;
revoke all on public.profile_voice_prompts from anon, authenticated;


-- ===== 056_ghost_and_request_timer.sql =====
alter table public.profiles add column if not exists ghost_enabled boolean not null default false;

create or replace function public.ghost_allows(viewer_uuid uuid,target_uuid uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(
    select 1 from public.profiles target where target.id=target_uuid and (
      target.kind='bot' or not target.ghost_enabled
      or not exists(select 1 from public.user_entitlements e where e.profile_id=target.id and e.noir_until>now())
      or viewer_uuid=target.id
      or exists(select 1 from public.swipes s where s.swiper_id=target.id and s.target_id=viewer_uuid and s.direction in ('right','super') and s.created_at>now()-interval '30 days')
      or exists(select 1 from public.matches m where m.status='active' and m.connection_type in ('matched','direct_chat') and m.user_a=least(viewer_uuid,target.id) and m.user_b=greatest(viewer_uuid,target.id))
    )
  );
$$;
revoke all on function public.ghost_allows(uuid,uuid) from public;
grant execute on function public.ghost_allows(uuid,uuid) to authenticated;

create or replace function public.profile_is_visible(profile_uuid uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(select 1 from public.profiles target where target.id=profile_uuid and (
    target.user_id=auth.uid() or public.has_admin_role(array['owner','moderator','support'])
    or (target.is_discoverable and public.ghost_allows(public.current_profile_id(),target.id)
      and not exists(select 1 from public.blocks b where
        (b.blocker_id=public.current_profile_id() and b.blocked_id=target.id)
        or (b.blocker_id=target.id and b.blocked_id=public.current_profile_id())))
  ));
$$;

create or replace function public.mutually_eligible(viewer_uuid uuid,target_uuid uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(
    select 1 from public.profiles viewer
    join public.profiles target on target.id=target_uuid
    left join public.discovery_preferences vp on vp.profile_id=viewer.id
    left join public.discovery_preferences tp on tp.profile_id=target.id
    where viewer.id=viewer_uuid and viewer.kind='human' and target.kind in ('human','bot')
      and viewer.onboarding_completed and target.onboarding_completed
      and viewer.deleted_at is null and target.deleted_at is null
      and viewer.safety_restricted_at is null and target.safety_restricted_at is null
      and target.is_discoverable and public.ghost_allows(viewer.id,target.id)
      and not exists(select 1 from public.blocks b where
        (b.blocker_id=viewer.id and b.blocked_id=target.id) or (b.blocker_id=target.id and b.blocked_id=viewer.id))
      and (target.kind='bot' or (
        viewer.gender=any(coalesce(tp.interested_genders,array['kadın','erkek','nonbinary','other']::text[]))
        and target.gender=any(coalesce(vp.interested_genders,array['kadın','erkek','nonbinary','other']::text[]))
        and extract(year from age(current_date,viewer.birth_date))::integer between coalesce(tp.min_age,18) and coalesce(tp.max_age,99)
        and extract(year from age(current_date,target.birth_date))::integer between coalesce(vp.min_age,18) and coalesce(vp.max_age,99)
      ))
  );
$$;

create or replace function public.limit_message_request_expiry()
returns trigger language plpgsql set search_path=''
as $$
begin
  if new.connection_type='message_request' and new.request_status='pending'
    and (new.request_expires_at is null or new.request_expires_at>now()+interval '24 hours') then
    new.request_expires_at:=now()+interval '24 hours';
  end if;
  return new;
end;
$$;
drop trigger if exists limit_message_request_expiry on public.matches;
create trigger limit_message_request_expiry before insert or update of connection_type,request_status,request_expires_at on public.matches
for each row execute function public.limit_message_request_expiry();
update public.matches set request_expires_at=least(request_expires_at,now()+interval '24 hours')
where connection_type='message_request' and request_status='pending' and request_expires_at>now()+interval '24 hours';
create index if not exists matches_pending_request_expiry_idx on public.matches(request_expires_at)
where status='active' and connection_type='message_request' and request_status='pending';

create or replace function public.expire_pending_message_requests()
returns integer language plpgsql security definer set search_path=''
as $$
declare affected integer;
begin
  update public.matches set status='unmatched',request_status='expired',closed_at=now()
  where status='active' and connection_type='message_request' and request_status='pending' and request_expires_at<=now();
  get diagnostics affected=row_count;
  return affected;
end;
$$;
revoke all on function public.expire_pending_message_requests() from public;
grant execute on function public.expire_pending_message_requests() to service_role;

create table if not exists public.wingman_daily_usage (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  usage_date date not null,
  request_count integer not null default 0 check(request_count between 0 and 3),
  primary key(profile_id,usage_date)
);
alter table public.wingman_daily_usage enable row level security;
revoke all on public.wingman_daily_usage from anon,authenticated;
create or replace function public.reserve_wingman_request()
returns boolean language plpgsql security definer set search_path=''
as $$
declare viewer uuid:=public.current_profile_id(); today_tr date:=(now() at time zone 'Europe/Istanbul')::date;
  used integer;
begin
  if viewer is null then return false; end if;
  insert into public.wingman_daily_usage(profile_id,usage_date,request_count) values(viewer,today_tr,1)
    on conflict(profile_id,usage_date) do update set request_count=public.wingman_daily_usage.request_count+1
    where public.wingman_daily_usage.request_count<3
    returning request_count into used;
  return used is not null;
end;
$$;
revoke all on function public.reserve_wingman_request() from public;
grant execute on function public.reserve_wingman_request() to authenticated;


-- ===== 057_super_like_note.sql =====
alter table public.swipes add column if not exists super_like_note text;
alter table public.swipes drop constraint if exists swipes_super_like_note_length;
alter table public.swipes add constraint swipes_super_like_note_length check (super_like_note is null or char_length(super_like_note) between 1 and 280);

create or replace function public.set_super_like_note(target_uuid uuid, note_text text)
returns boolean language plpgsql security definer set search_path=''
as $$
declare viewer uuid := public.current_profile_id(); cleaned text := nullif(btrim(note_text),'');
begin
  if viewer is null then raise exception 'profile_required'; end if;
  if cleaned is null or char_length(cleaned) > 280 then raise exception 'invalid_note'; end if;
  update public.swipes set super_like_note=cleaned
  where swiper_id=viewer and target_id=target_uuid and direction='super';
  if not found then raise exception 'super_like_required'; end if;
  return true;
end;
$$;
revoke all on function public.set_super_like_note(uuid,text) from public;
grant execute on function public.set_super_like_note(uuid,text) to authenticated;


-- ===== 058_hidden_conversations.sql =====
create table if not exists public.hidden_conversations (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (profile_id, match_id)
);
alter table public.hidden_conversations enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'hidden_conversations' and policyname = 'Users can view their own hidden conversations'
  ) then
    create policy "Users can view their own hidden conversations"
      on public.hidden_conversations for select
      to authenticated
      using (profile_id = public.current_profile_id());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'hidden_conversations' and policyname = 'Users can insert their own hidden conversations'
  ) then
    create policy "Users can insert their own hidden conversations"
      on public.hidden_conversations for insert
      to authenticated
      with check (profile_id = public.current_profile_id());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'hidden_conversations' and policyname = 'Users can delete their own hidden conversations'
  ) then
    create policy "Users can delete their own hidden conversations"
      on public.hidden_conversations for delete
      to authenticated
      using (profile_id = public.current_profile_id());
  end if;
end $$;


-- ===== 059_chat_image_kind.sql =====
alter type public.message_kind add value if not exists 'image';


-- ===== 060_trust_media_and_funnel.sql =====
-- Verification requests and chat photos stay in private storage buckets.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('verification-selfies','verification-selfies',false,5242880,array['image/webp']),
       ('chat-images','chat-images',false,5242880,array['image/webp'])
on conflict (id) do nothing;

-- The request table already exists in migration 035 and keeps review history.
create or replace function public.review_profile_verification(p_request uuid,p_status text,p_admin uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
declare reviewed_profile uuid;
begin
  if p_status not in ('approved','rejected') then raise exception 'invalid_status'; end if;
  update public.profile_verification_requests
  set status=p_status,reviewed_by=p_admin,reviewed_at=now(),updated_at=now()
  where id=p_request and status='pending' and selfie_path is not null
  returning profile_id into reviewed_profile;
  if not found then return false; end if;
  if p_status='approved' then
    update public.profiles set is_verified=true where id=reviewed_profile and kind='human';
    if not found then raise exception 'profile_missing'; end if;
  end if;
  return true;
end;
$$;
revoke all on function public.review_profile_verification(uuid,text,uuid) from public;
grant execute on function public.review_profile_verification(uuid,text,uuid) to service_role;

create table if not exists public.contact_verification_challenges (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null check (channel in ('email','sms')),
  destination text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (profile_id,channel)
);
alter table public.contact_verification_challenges enable row level security;
revoke all on public.contact_verification_challenges from anon, authenticated;

create or replace function public.take_contact_verification_attempt(p_profile uuid,p_channel text,p_destination text)
returns text language sql security definer set search_path=''
as $$
  update public.contact_verification_challenges
  set attempts=attempts+1
  where profile_id=p_profile and channel=p_channel and destination=p_destination
    and verified_at is null and expires_at>now() and attempts<5
  returning code_hash;
$$;
revoke all on function public.take_contact_verification_attempt(uuid,text,text) from public;
grant execute on function public.take_contact_verification_attempt(uuid,text,text) to service_role;

create table if not exists public.verification_provider_settings (
  id boolean primary key default true check (id),
  encrypted_config text not null,
  updated_at timestamptz not null default now()
);
alter table public.verification_provider_settings enable row level security;
revoke all on public.verification_provider_settings from anon, authenticated;

create table if not exists public.product_funnel_events (
  id bigint generated always as identity primary key,
  event_name text not null check (event_name in ('signup_completed','profile_completed','photo_uploaded','verification_started','verification_passed','like_sent','pass_sent','match_created','first_message_sent','reply_received','block_created','report_created')),
  profile_id uuid references public.profiles(id) on delete set null,
  subject_id uuid,
  occurred_at timestamptz not null default now()
);
create index if not exists product_funnel_events_timeline on public.product_funnel_events(event_name,occurred_at desc);
alter table public.product_funnel_events enable row level security;
revoke all on public.product_funnel_events from anon, authenticated;

alter table public.messages drop constraint if exists messages_check;
alter table public.messages add constraint messages_content_check check (
  (kind='text' and body is not null) or
  (kind='audio' and audio_path is not null) or
  (kind::text='image' and audio_path is not null)
);

create or replace function public.send_image_message(match_uuid uuid,image_path text,client_uuid uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare sender_profile uuid:=public.current_profile_id(); existing public.messages%rowtype;
  inserted public.messages%rowtype; quota jsonb;
begin
  if sender_profile is null or client_uuid is null or image_path !~ ('^'||sender_profile::text||'/[0-9a-f-]{36}\.webp$') then
    raise exception 'invalid_image_message';
  end if;
  select * into existing from public.messages where match_id=match_uuid and sender_id=sender_profile and client_message_id=client_uuid;
  if found then return jsonb_build_object('messageId',existing.id,'createdAt',existing.created_at,'duplicate',true); end if;
  quota:=public.consume_message_allowance(sender_profile,match_uuid,'image');
  if not coalesce((quota->>'allowed')::boolean,false) then return quota; end if;
  insert into public.messages(match_id,sender_id,kind,audio_path,client_message_id)
  values(match_uuid,sender_profile,'image',image_path,client_uuid) returning * into inserted;
  update public.matches set last_message_at=inserted.created_at where id=match_uuid;
  return quota||jsonb_build_object('messageId',inserted.id,'createdAt',inserted.created_at);
end;
$$;
revoke all on function public.send_image_message(uuid,text,uuid) from public;
grant execute on function public.send_image_message(uuid,text,uuid) to authenticated;

create or replace function public.capture_product_funnel_event()
returns trigger language plpgsql security definer set search_path=''
as $$
declare first_sender uuid;
begin
  if tg_table_name='profiles' then
    if new.kind='human' and new.onboarding_completed and not old.onboarding_completed then
      insert into public.product_funnel_events(event_name,profile_id,subject_id) values('profile_completed',new.id,new.id);
    end if;
  elsif tg_table_name='profile_photos' then
    if exists(select 1 from public.profiles where id=new.profile_id and kind='human') then
      insert into public.product_funnel_events(event_name,profile_id,subject_id) values('photo_uploaded',new.profile_id,new.id);
    end if;
  elsif tg_table_name='profile_verification_requests' then
    if tg_op='INSERT' then
      if new.selfie_path is not null and new.status='pending' then
        insert into public.product_funnel_events(event_name,profile_id,subject_id) values('verification_started',new.profile_id,new.id);
      end if;
    else
      if old.selfie_path is null and new.selfie_path is not null and new.status='pending' then
        insert into public.product_funnel_events(event_name,profile_id,subject_id) values('verification_started',new.profile_id,new.id);
      elsif new.status='approved' and old.status is distinct from 'approved' then
        insert into public.product_funnel_events(event_name,profile_id,subject_id) values('verification_passed',new.profile_id,new.id);
      end if;
    end if;
  elsif tg_table_name='blocks' then
    if exists(select 1 from public.profiles where id=new.blocker_id and kind='human') then
      insert into public.product_funnel_events(event_name,profile_id,subject_id) values('block_created',new.blocker_id,new.blocked_id);
    end if;
  elsif tg_table_name='reports' then
    if exists(select 1 from public.profiles where id=new.reporter_id and kind='human') then
      insert into public.product_funnel_events(event_name,profile_id,subject_id) values('report_created',new.reporter_id,new.reported_id);
    end if;
  elsif tg_table_name='swipes' then
    if exists(select 1 from public.profiles where id=new.swiper_id and kind='human') then
      insert into public.product_funnel_events(event_name,profile_id,subject_id)
      values(case when new.direction='left' then 'pass_sent' else 'like_sent' end,new.swiper_id,new.target_id);
    end if;
  elsif tg_table_name='matches' then
    if exists(select 1 from public.profiles where id=new.user_a and kind='human')
      and exists(select 1 from public.profiles where id=new.user_b and kind='human') then
      insert into public.product_funnel_events(event_name,profile_id,subject_id) values('match_created',new.user_a,new.id);
    end if;
  elsif tg_table_name='messages' then
    if exists(select 1 from public.matches m join public.profiles a on a.id=m.user_a join public.profiles b on b.id=m.user_b where m.id=new.match_id and a.kind='human' and b.kind='human') then
      select sender_id into first_sender from public.messages where match_id=new.match_id and id<>new.id order by created_at,id limit 1;
      if first_sender is null then
        insert into public.product_funnel_events(event_name,profile_id,subject_id) values('first_message_sent',new.sender_id,new.match_id);
      elsif first_sender<>new.sender_id and not exists(select 1 from public.product_funnel_events where event_name='reply_received' and subject_id=new.match_id) then
        insert into public.product_funnel_events(event_name,profile_id,subject_id) values('reply_received',first_sender,new.match_id);
      end if;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists product_funnel_profiles on public.profiles;
create trigger product_funnel_profiles after update of onboarding_completed on public.profiles for each row execute function public.capture_product_funnel_event();
drop trigger if exists product_funnel_photos on public.profile_photos;
create trigger product_funnel_photos after insert on public.profile_photos for each row execute function public.capture_product_funnel_event();
drop trigger if exists product_funnel_verification on public.profile_verification_requests;
create trigger product_funnel_verification after insert or update of selfie_path,status on public.profile_verification_requests for each row execute function public.capture_product_funnel_event();
drop trigger if exists product_funnel_blocks on public.blocks;
create trigger product_funnel_blocks after insert on public.blocks for each row execute function public.capture_product_funnel_event();
drop trigger if exists product_funnel_reports on public.reports;
create trigger product_funnel_reports after insert on public.reports for each row execute function public.capture_product_funnel_event();
drop trigger if exists product_funnel_swipes on public.swipes;
create trigger product_funnel_swipes after insert on public.swipes for each row execute function public.capture_product_funnel_event();
drop trigger if exists product_funnel_matches on public.matches;
create trigger product_funnel_matches after insert on public.matches for each row execute function public.capture_product_funnel_event();
drop trigger if exists product_funnel_messages on public.messages;
create trigger product_funnel_messages after insert on public.messages for each row execute function public.capture_product_funnel_event();

create or replace function public.product_funnel_counts(since_date timestamptz)
returns table(event_name text,total bigint) language sql stable security definer set search_path=''
as $$ select e.event_name,count(*) from public.product_funnel_events e where e.occurred_at>=since_date group by e.event_name $$;
revoke all on function public.product_funnel_counts(timestamptz) from public;
grant execute on function public.product_funnel_counts(timestamptz) to service_role;


-- ===== 061_profile_boost.sql =====
-- One 30-minute Boost per Noir member every seven days.
create table public.profile_boosts (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  started_at timestamptz not null,
  expires_at timestamptz not null,
  check (expires_at > started_at)
);
alter table public.profile_boosts enable row level security;
revoke all on public.profile_boosts from anon, authenticated;

alter table public.product_funnel_events drop constraint product_funnel_events_event_name_check;
alter table public.product_funnel_events add constraint product_funnel_events_event_name_check
  check (event_name in ('signup_completed','profile_completed','photo_uploaded','verification_started','verification_passed','like_sent','pass_sent','match_created','first_message_sent','reply_received','block_created','report_created','boost_activated'));

create function public.profile_boost_status()
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
    'eligible',eligible,
    'canActivate',eligible and noir_until>=now()+interval '30 minutes' and (boost.started_at is null or boost.started_at+interval '7 days'<=now())
  );
end;
$$;
revoke all on function public.profile_boost_status() from public;
grant execute on function public.profile_boost_status() to authenticated;

create function public.activate_profile_boost()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare viewer public.profiles%rowtype; state jsonb; started timestamptz:=now();
begin
  select * into viewer from public.profiles where id=public.current_profile_id() and kind='human' for update;
  if not found then raise exception 'profile_required'; end if;
  state:=public.profile_boost_status();
  if not coalesce((state->>'canActivate')::boolean,false) then return state; end if;
  insert into public.profile_boosts(profile_id,started_at,expires_at)
  values(viewer.id,started,started+interval '30 minutes')
  on conflict(profile_id) do update set started_at=excluded.started_at,expires_at=excluded.expires_at;
  insert into public.product_funnel_events(event_name,profile_id,subject_id)
  values('boost_activated',viewer.id,viewer.id);
  return public.profile_boost_status();
end;
$$;
revoke all on function public.activate_profile_boost() from public;
grant execute on function public.activate_profile_boost() to authenticated;

-- Discovery keeps every existing safety, preference and photo filter. Boost only
-- triples a profile's lottery weight inside the existing reciprocal-like tiers.

create or replace function public.get_discovery_candidates(candidate_limit integer default 20)
returns table(id uuid,kind public.profile_kind,display_name text,age integer,city text,gender text,is_verified boolean,photo_path text,badges text[],prompt text,answer text,distance_km integer)
language sql stable security definer set search_path=''
as $$
  select target.id,target.kind,target.display_name,extract(year from age(current_date,target.birth_date))::integer,target.city,target.gender,target.is_verified,
    photo.photo_path,coalesce(badge_list.badges,array[]::text[]),response.prompt,response.answer,
    case when viewer_city.city_key is null or target_city.city_key is null then null else round(distance.km)::integer end
  from public.profiles target
  join public.profiles viewer on viewer.id=public.current_profile_id()
  left join public.discovery_preferences pref on pref.profile_id=viewer.id
  left join public.user_entitlements entitlement on entitlement.profile_id=viewer.id and entitlement.noir_until>now()
  left join public.city_centers viewer_city on viewer_city.city_key=public.normalize_location(viewer.city)
  left join public.city_centers target_city on target_city.city_key=public.normalize_location(target.city)
  left join lateral (select 6371*2*asin(sqrt(power(sin(radians(target_city.latitude-viewer_city.latitude)/2),2)+cos(radians(viewer_city.latitude))*cos(radians(target_city.latitude))*power(sin(radians(target_city.longitude-viewer_city.longitude)/2),2))) km) distance on viewer_city.city_key is not null and target_city.city_key is not null
  join lateral (select coalesce(pp.variants->>'960',pp.variants->>'480',pp.storage_path) photo_path from public.profile_photos pp where pp.profile_id=target.id and pp.processing_status='ready' and pp.moderation_status='approved' order by pp.is_primary desc,pp.sort_order limit 1) photo on true
  left join lateral (select array_agg(ib.label order by ib.label) badges from public.profile_intentions pi join public.intent_badges ib on ib.id=pi.badge_id where pi.profile_id=target.id) badge_list on true
  left join lateral (select ip.prompt,pa.answer from public.profile_answers pa join public.icebreaker_prompts ip on ip.id=pa.prompt_id where pa.profile_id=target.id order by pa.sort_order limit 1) response on true
  where target.id<>viewer.id and public.mutually_eligible(viewer.id,target.id)
    and extract(year from age(current_date,target.birth_date))::integer between coalesce(pref.min_age,18) and coalesce(pref.max_age,80)
    and target.gender=any(coalesce(pref.interested_genders,array['kadın','erkek','nonbinary','other']::text[]))
    and (not coalesce(pref.same_city_only,false) or public.normalize_location(target.city)=public.normalize_location(viewer.city))
    and (cardinality(coalesce(pref.cities,array[]::text[]))=0 or exists(select 1 from unnest(pref.cities) selected_city where public.normalize_location(selected_city)=public.normalize_location(target.city)))
    and (pref.max_distance_km is null or distance.km<=pref.max_distance_km)
    and (cardinality(coalesce(pref.relationship_goals,array[]::text[]))=0 or target.relationship_goal=any(pref.relationship_goals))
    and (entitlement.profile_id is null or ((not coalesce(pref.verified_only,false) or target.is_verified)
      and (cardinality(coalesce(pref.marital_statuses,array[]::text[]))=0 or target.marital_status=any(pref.marital_statuses))
      and (cardinality(coalesce(pref.has_children_values,array[]::boolean[]))=0 or target.has_children=any(pref.has_children_values))
      and (cardinality(coalesce(pref.children_preferences,array[]::text[]))=0 or target.children_preference=any(pref.children_preferences))
      and (cardinality(coalesce(pref.alcohol_values,array[]::text[]))=0 or target.alcohol_use=any(pref.alcohol_values))
      and (cardinality(coalesce(pref.smoking_values,array[]::text[]))=0 or target.smoking_use=any(pref.smoking_values))
      and (cardinality(coalesce(pref.pet_values,array[]::text[]))=0 or target.pet_preference=any(pref.pet_values))
      and (cardinality(coalesce(pref.sports_values,array[]::text[]))=0 or target.sports_habit=any(pref.sports_values))
      and (cardinality(coalesce(pref.zodiac_values,array[]::text[]))=0 or public.zodiac_for_birth_date(target.birth_date)=any(pref.zodiac_values))
      and (pref.min_height_cm is null or target.height_cm>=pref.min_height_cm) and (pref.max_height_cm is null or target.height_cm<=pref.max_height_cm)
      and (cardinality(coalesce(pref.education_values,array[]::text[]))=0 or target.education_level=any(pref.education_values))
      and (cardinality(coalesce(pref.language_values,array[]::text[]))=0 or exists(select 1 from unnest(pref.language_values) as wanted(value) join unnest(target.languages) as spoken(value) on lower(wanted.value)=lower(spoken.value)))))
    and not exists(select 1 from public.swipes s where s.swiper_id=viewer.id and s.target_id=target.id and s.created_at>now()-interval '30 days')
    and not exists(select 1 from public.matches m where m.user_a=least(viewer.id,target.id) and m.user_b=greatest(viewer.id,target.id) and m.connection_type='matched' and (m.status='active' or (m.status='unmatched' and coalesce(m.closed_at,m.matched_at)>now()-interval '90 days')))
  order by exists(select 1 from public.swipes incoming where incoming.swiper_id=target.id and incoming.target_id=viewer.id and incoming.direction='super' and incoming.created_at>now()-interval '30 days') desc,
    exists(select 1 from public.swipes incoming where incoming.swiper_id=target.id and incoming.target_id=viewer.id and incoming.direction='right' and incoming.created_at>now()-interval '30 days') desc,
    power(((('x'||left(md5(target.id::text||viewer.id::text||current_date::text),8))::bit(32)::bigint+1)::numeric/4294967296),
      case when exists(select 1 from public.profile_boosts boost where boost.profile_id=target.id and boost.expires_at>now()) then 1.0/3 else 1.0 end) desc
  limit least(greatest(coalesce(candidate_limit,20),1),40);
$$;
revoke all on function public.get_discovery_candidates(integer) from public;
grant execute on function public.get_discovery_candidates(integer) to authenticated;


-- ===== 062_boost_status_boolean.sql =====
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


-- ===== 063_android_welcome_and_download_tracking.sql =====
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


-- ===== 064_growth_metrics.sql =====
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


-- ===== 065_single_approved_profile_photo.sql =====
create or replace function public.finalize_onboarding()
returns void language plpgsql security definer set search_path=''
as $$
declare profile_uuid uuid;
begin
  profile_uuid:=public.current_profile_id();
  if profile_uuid is null then raise exception 'profile_required'; end if;
  perform 1 from public.profiles where id=profile_uuid and kind='human' for update;
  if not found then raise exception 'profile_required'; end if;
  if not exists (
    select 1 from public.profile_photos
    where profile_id=profile_uuid and processing_status='ready' and moderation_status='approved'
  ) then raise exception 'approved_photo_required'; end if;
  update public.profiles set onboarding_completed=true,is_discoverable=true,updated_at=now()
  where id=profile_uuid and kind='human';
end;
$$;

create or replace function public.prevent_last_approved_profile_photo_delete()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  -- Lock the parent so concurrent deletes cannot each remove the other's last photo.
  perform 1 from public.profiles
  where id=old.profile_id and kind='human' and onboarding_completed for update;
  if found and old.processing_status='ready' and old.moderation_status='approved'
    and not exists (
      select 1 from public.profile_photos
      where profile_id=old.profile_id and id<>old.id
        and processing_status='ready' and moderation_status='approved'
    ) then raise exception 'approved_photo_required'; end if;
  return old;
end;
$$;

create trigger prevent_last_approved_profile_photo_delete
before delete on public.profile_photos
for each row execute function public.prevent_last_approved_profile_photo_delete();


-- ===== 066_pending_photo_onboarding_and_verified_filter.sql =====
-- A member may use the app while a valid profile photo is waiting for review.
-- Discovery remains limited to profiles with an approved photo.
create or replace function public.finalize_onboarding()
returns void language plpgsql security definer set search_path=''
as $$
declare profile_uuid uuid; ready_photos integer; approved_photos integer;
begin
  profile_uuid:=public.current_profile_id();
  if profile_uuid is null then raise exception 'profile_required'; end if;
  perform 1 from public.profiles where id=profile_uuid and kind='human' for update;
  if not found then raise exception 'profile_required'; end if;
  select count(*) filter(where moderation_status<>'rejected'), count(*) filter(where moderation_status='approved')
  into ready_photos,approved_photos from public.profile_photos
  where profile_id=profile_uuid and processing_status='ready';
  if ready_photos<1 then raise exception 'photo_required'; end if;
  update public.profiles set onboarding_completed=true,is_discoverable=approved_photos>=1,updated_at=now()
  where id=profile_uuid and kind='human';
end;
$$;

create or replace function public.prevent_last_approved_profile_photo_delete()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  perform 1 from public.profiles
  where id=old.profile_id and kind='human' and onboarding_completed for update;
  if found and old.processing_status='ready' and old.moderation_status<>'rejected'
    and not exists (
      select 1 from public.profile_photos
      where profile_id=old.profile_id and id<>old.id
        and processing_status='ready' and moderation_status<>'rejected'
    ) then raise exception 'photo_required'; end if;
  return old;
end;
$$;

-- Verified-only is a safety preference available to every member. The other
-- detailed compatibility filters remain Noir-only.
create or replace function public.get_discovery_candidates(candidate_limit integer default 20)
returns table(id uuid,kind public.profile_kind,display_name text,age integer,city text,gender text,is_verified boolean,photo_path text,badges text[],prompt text,answer text,distance_km integer)
language sql stable security definer set search_path=''
as $$
  select target.id,target.kind,target.display_name,extract(year from age(current_date,target.birth_date))::integer,target.city,target.gender,target.is_verified,
    photo.photo_path,coalesce(badge_list.badges,array[]::text[]),response.prompt,response.answer,
    case when viewer_city.city_key is null or target_city.city_key is null then null else round(distance.km)::integer end
  from public.profiles target
  join public.profiles viewer on viewer.id=public.current_profile_id()
  left join public.discovery_preferences pref on pref.profile_id=viewer.id
  left join public.user_entitlements entitlement on entitlement.profile_id=viewer.id and entitlement.noir_until>now()
  left join public.city_centers viewer_city on viewer_city.city_key=public.normalize_location(viewer.city)
  left join public.city_centers target_city on target_city.city_key=public.normalize_location(target.city)
  left join lateral (select 6371*2*asin(sqrt(power(sin(radians(target_city.latitude-viewer_city.latitude)/2),2)+cos(radians(viewer_city.latitude))*cos(radians(target_city.latitude))*power(sin(radians(target_city.longitude-viewer_city.longitude)/2),2))) km) distance on viewer_city.city_key is not null and target_city.city_key is not null
  join lateral (select coalesce(pp.variants->>'960',pp.variants->>'480',pp.storage_path) photo_path from public.profile_photos pp where pp.profile_id=target.id and pp.processing_status='ready' and pp.moderation_status='approved' order by pp.is_primary desc,pp.sort_order limit 1) photo on true
  left join lateral (select array_agg(ib.label order by ib.label) badges from public.profile_intentions pi join public.intent_badges ib on ib.id=pi.badge_id where pi.profile_id=target.id) badge_list on true
  left join lateral (select ip.prompt,pa.answer from public.profile_answers pa join public.icebreaker_prompts ip on ip.id=pa.prompt_id where pa.profile_id=target.id order by pa.sort_order limit 1) response on true
  where target.id<>viewer.id and public.mutually_eligible(viewer.id,target.id)
    and extract(year from age(current_date,target.birth_date))::integer between coalesce(pref.min_age,18) and coalesce(pref.max_age,80)
    and target.gender=any(coalesce(pref.interested_genders,array['kadın','erkek','nonbinary','other']::text[]))
    and (not coalesce(pref.same_city_only,false) or public.normalize_location(target.city)=public.normalize_location(viewer.city))
    and (cardinality(coalesce(pref.cities,array[]::text[]))=0 or exists(select 1 from unnest(pref.cities) selected_city where public.normalize_location(selected_city)=public.normalize_location(target.city)))
    and (pref.max_distance_km is null or distance.km<=pref.max_distance_km)
    and (cardinality(coalesce(pref.relationship_goals,array[]::text[]))=0 or target.relationship_goal=any(pref.relationship_goals))
    and (not coalesce(pref.verified_only,false) or target.is_verified)
    and (entitlement.profile_id is null or (
      (cardinality(coalesce(pref.marital_statuses,array[]::text[]))=0 or target.marital_status=any(pref.marital_statuses))
      and (cardinality(coalesce(pref.has_children_values,array[]::boolean[]))=0 or target.has_children=any(pref.has_children_values))
      and (cardinality(coalesce(pref.children_preferences,array[]::text[]))=0 or target.children_preference=any(pref.children_preferences))
      and (cardinality(coalesce(pref.alcohol_values,array[]::text[]))=0 or target.alcohol_use=any(pref.alcohol_values))
      and (cardinality(coalesce(pref.smoking_values,array[]::text[]))=0 or target.smoking_use=any(pref.smoking_values))
      and (cardinality(coalesce(pref.pet_values,array[]::text[]))=0 or target.pet_preference=any(pref.pet_values))
      and (cardinality(coalesce(pref.sports_values,array[]::text[]))=0 or target.sports_habit=any(pref.sports_values))
      and (cardinality(coalesce(pref.zodiac_values,array[]::text[]))=0 or public.zodiac_for_birth_date(target.birth_date)=any(pref.zodiac_values))
      and (pref.min_height_cm is null or target.height_cm>=pref.min_height_cm) and (pref.max_height_cm is null or target.height_cm<=pref.max_height_cm)
      and (cardinality(coalesce(pref.education_values,array[]::text[]))=0 or target.education_level=any(pref.education_values))
      and (cardinality(coalesce(pref.language_values,array[]::text[]))=0 or exists(select 1 from unnest(pref.language_values) as wanted(value) join unnest(target.languages) as spoken(value) on lower(wanted.value)=lower(spoken.value)))))
    and not exists(select 1 from public.swipes s where s.swiper_id=viewer.id and s.target_id=target.id and s.created_at>now()-interval '30 days')
    and not exists(select 1 from public.matches m where m.user_a=least(viewer.id,target.id) and m.user_b=greatest(viewer.id,target.id) and m.connection_type='matched' and (m.status='active' or (m.status='unmatched' and coalesce(m.closed_at,m.matched_at)>now()-interval '90 days')))
  order by exists(select 1 from public.swipes incoming where incoming.swiper_id=target.id and incoming.target_id=viewer.id and incoming.direction='super' and incoming.created_at>now()-interval '30 days') desc,
    exists(select 1 from public.swipes incoming where incoming.swiper_id=target.id and incoming.target_id=viewer.id and incoming.direction='right' and incoming.created_at>now()-interval '30 days') desc,
    power(((('x'||left(md5(target.id::text||viewer.id::text||current_date::text),8))::bit(32)::bigint+1)::numeric/4294967296),
      case when exists(select 1 from public.profile_boosts boost where boost.profile_id=target.id and boost.expires_at>now()) then 1.0/3 else 1.0 end) desc
  limit least(greatest(coalesce(candidate_limit,20),1),40);
$$;
revoke all on function public.get_discovery_candidates(integer) from public;
grant execute on function public.get_discovery_candidates(integer) to authenticated;


-- ===== 067_shopier_oauth_connection.sql =====
-- Keep seller OAuth tokens encrypted at the application layer and unavailable to clients.
create table if not exists public.shopier_connection (
  id boolean primary key default true check (id),
  encrypted_config text not null,
  updated_at timestamptz not null default now()
);
alter table public.shopier_connection enable row level security;
revoke all on public.shopier_connection from anon, authenticated;


-- ===== 068_android_welcome_one_device.sql =====
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


-- ===== 069_shopier_link_manual_approval.sql =====
-- A Shopier product link does not provide a verified payment callback.
-- Require a seller-panel order number and owner review before granting Noir.

create unique index if not exists payment_orders_shopier_review_reference_unique
  on public.payment_orders (lower(external_reference))
  where provider = 'shopier'
    and status in ('under_review', 'approved')
    and external_reference is not null;

create or replace function public.submit_manual_payment(
  order_uuid uuid, sender_name text, paid_on date,
  provider_reference text default null, object_path text default null
)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  buyer uuid := public.current_profile_id();
  local_today date := (pg_catalog.timezone('Europe/Istanbul', now()))::date;
  selected_order public.payment_orders%rowtype;
begin
  if buyer is null then raise exception 'profile_required'; end if;
  if char_length(btrim(sender_name)) not between 3 and 120 then raise exception 'invalid_sender'; end if;
  if paid_on is null or paid_on > local_today or paid_on < local_today - 30 then raise exception 'invalid_payment_date'; end if;
  if provider_reference is not null and char_length(btrim(provider_reference)) > 160 then raise exception 'invalid_reference'; end if;
  if object_path is not null and object_path not like buyer::text || '/' || order_uuid::text || '/%' then
    raise exception 'invalid_proof_path';
  end if;
  select * into selected_order from public.payment_orders
  where id = order_uuid and profile_id = buyer for update;
  if not found then raise exception 'order_not_submittable'; end if;
  if selected_order.provider = 'shopier' then
    if selected_order.status <> 'pending' then raise exception 'order_not_submittable'; end if;
    if provider_reference is null or char_length(btrim(provider_reference)) < 4 then
      raise exception 'shopier_order_number_required';
    end if;
    if exists (select 1 from public.payment_orders
      where provider = 'shopier' and provider_order_id = btrim(provider_reference)) then
      raise exception 'shopier_order_already_used';
    end if;
  elsif selected_order.provider not in ('bank_transfer','papara','crypto')
    or selected_order.status <> 'awaiting_payment' then
    raise exception 'order_not_submittable';
  end if;
  update public.payment_orders
    set sender_full_name = btrim(sender_name), payment_date = paid_on,
        external_reference = nullif(btrim(provider_reference), ''),
        proof_path = object_path, submitted_at = now(),
        status = 'under_review', updated_at = now()
  where id = order_uuid;
end;
$$;

create or replace function public.approve_noir_payment(order_uuid uuid)
returns timestamptz language plpgsql security definer set search_path = ''
as $$
declare
  selected_order public.payment_orders%rowtype;
  access_days integer;
  access_minutes integer;
  new_until timestamptz;
begin
  if not public.has_admin_role(array['owner']) then raise exception 'owner_required'; end if;
  select * into selected_order from public.payment_orders where id = order_uuid for update;
  if not found then raise exception 'order_not_found'; end if;
  if selected_order.status = 'approved' then
    select noir_until into new_until from public.user_entitlements where profile_id = selected_order.profile_id;
    return new_until;
  end if;
  if selected_order.provider not in ('bank_transfer','papara','crypto','manual','shopier') then raise exception 'manual_provider_required'; end if;
  if selected_order.status <> 'under_review' then raise exception 'order_not_approvable'; end if;
  if selected_order.provider = 'shopier' and nullif(btrim(selected_order.external_reference), '') is null then
    raise exception 'shopier_order_number_required';
  end if;
  select duration_days, duration_minutes into access_days, access_minutes
    from public.premium_plans where id = selected_order.plan_id;
  if access_days is null then raise exception 'plan_not_found'; end if;
  insert into public.user_entitlements(profile_id,noir_until,source,updated_at)
  values (
    selected_order.profile_id,
    now() + case when access_minutes is null then make_interval(days => access_days) else make_interval(mins => access_minutes) end,
    'payment:' || order_uuid::text, now()
  )
  on conflict(profile_id) do update set
    noir_until = greatest(coalesce(public.user_entitlements.noir_until, now()), now())
      + case when access_minutes is null then make_interval(days => access_days) else make_interval(mins => access_minutes) end,
    source = 'payment:' || order_uuid::text, updated_at = now()
  returning noir_until into new_until;
  update public.payment_orders set status = 'approved', reviewed_by = auth.uid(),
    reviewed_at = now(), updated_at = now() where id = order_uuid;
  insert into public.admin_audit_log(actor_user_id,action,target_type,target_id,metadata)
  values (auth.uid(),'payment.approved','payment_order',order_uuid::text,
    jsonb_build_object('profileId',selected_order.profile_id,'noirUntil',new_until,
      'shopierOrderNumber',selected_order.external_reference));
  return new_until;
end;
$$;

create or replace function public.reject_noir_payment(order_uuid uuid, reason text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.has_admin_role(array['owner']) then raise exception 'owner_required'; end if;
  if char_length(btrim(reason)) not between 3 and 500 then raise exception 'invalid_reason'; end if;
  update public.payment_orders
    set status = 'rejected', rejection_reason = btrim(reason), reviewed_by = auth.uid(),
      reviewed_at = now(), updated_at = now()
  where id = order_uuid
    and provider in ('bank_transfer','papara','crypto','manual','shopier')
    and status = 'under_review';
  if not found then raise exception 'order_not_rejectable'; end if;
  insert into public.admin_audit_log(actor_user_id,action,target_type,target_id,metadata)
  values (auth.uid(),'payment.rejected','payment_order',order_uuid::text,
    jsonb_build_object('reason',btrim(reason)));
end;
$$;

revoke all on function public.submit_manual_payment(uuid,text,date,text,text) from public;
revoke all on function public.approve_noir_payment(uuid) from public;
revoke all on function public.reject_noir_payment(uuid,text) from public;
grant execute on function public.submit_manual_payment(uuid,text,date,text,text) to authenticated;
grant execute on function public.approve_noir_payment(uuid) to authenticated;
grant execute on function public.reject_noir_payment(uuid,text) to authenticated;


-- ===== 070_disable_hourly_noir_plan.sql =====
-- Remove the short Noir plan from new purchases; keep past orders and entitlements.
update public.premium_plans
set is_active = false, updated_at = now()
where slug = 'noir-hourly' and is_active;
