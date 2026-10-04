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
