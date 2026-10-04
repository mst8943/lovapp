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
