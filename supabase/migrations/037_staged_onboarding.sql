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

