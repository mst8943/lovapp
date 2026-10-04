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
