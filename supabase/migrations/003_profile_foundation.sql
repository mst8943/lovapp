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
