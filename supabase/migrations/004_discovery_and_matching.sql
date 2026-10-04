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
