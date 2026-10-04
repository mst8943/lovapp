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
