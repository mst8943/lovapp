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
