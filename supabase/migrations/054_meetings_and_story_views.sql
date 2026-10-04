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

