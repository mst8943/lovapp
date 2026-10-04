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
