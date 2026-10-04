-- Keep candidate listing consistent with the decision lifecycle and perform
-- mutual eligibility before LIMIT so discovery does not need one RPC per row.

drop function if exists public.get_discovery_candidates(integer);

create function public.get_discovery_candidates(candidate_limit integer default 20)
returns table (
  id uuid,
  kind public.profile_kind,
  display_name text,
  age integer,
  city text,
  gender text,
  is_verified boolean,
  photo_path text,
  badges text[],
  prompt text,
  answer text
)
language sql stable security definer set search_path=''
as $$
  select
    target.id,
    target.kind,
    target.display_name,
    extract(year from age(current_date,target.birth_date))::integer,
    target.city,
    target.gender,
    target.is_verified,
    photo.photo_path,
    coalesce(badge_list.badges,array[]::text[]),
    response.prompt,
    response.answer
  from public.profiles target
  join public.profiles viewer on viewer.id=public.current_profile_id()
  left join public.discovery_preferences pref on pref.profile_id=viewer.id
  join lateral (
    select coalesce(pp.variants->>'960',pp.variants->>'480',pp.storage_path) photo_path
    from public.profile_photos pp
    where pp.profile_id=target.id
      and pp.processing_status='ready'
      and pp.moderation_status='approved'
    order by pp.is_primary desc,pp.sort_order
    limit 1
  ) photo on true
  left join lateral (
    select array_agg(ib.label order by ib.label) badges
    from public.profile_intentions pi
    join public.intent_badges ib on ib.id=pi.badge_id
    where pi.profile_id=target.id
  ) badge_list on true
  left join lateral (
    select ip.prompt,pa.answer
    from public.profile_answers pa
    join public.icebreaker_prompts ip on ip.id=pa.prompt_id
    where pa.profile_id=target.id
    order by pa.sort_order
    limit 1
  ) response on true
  where target.id<>viewer.id
    and public.mutually_eligible(viewer.id,target.id)
    and extract(year from age(current_date,target.birth_date))::integer between coalesce(pref.min_age,18) and coalesce(pref.max_age,80)
    and target.gender=any(coalesce(pref.interested_genders,array['kadın','erkek','nonbinary','other']::text[]))
    and (
      not coalesce(pref.verified_only,false)
      or not exists(select 1 from public.user_entitlements ue where ue.profile_id=viewer.id and ue.noir_until>now())
      or target.is_verified
    )
    and (
      not coalesce(pref.same_city_only,false)
      or not exists(select 1 from public.user_entitlements ue where ue.profile_id=viewer.id and ue.noir_until>now())
      or viewer.city is null
      or target.city=viewer.city
    )
    and not exists(
      select 1
      from public.swipes s
      where s.swiper_id=viewer.id
        and s.target_id=target.id
        and s.created_at>now()-interval '30 days'
    )
    and not exists(
      select 1
      from public.matches m
      where m.user_a=least(viewer.id,target.id)
        and m.user_b=greatest(viewer.id,target.id)
        and m.connection_type='matched'
        and (
          m.status='active'
          or (m.status='unmatched' and coalesce(m.closed_at,m.matched_at)>now()-interval '90 days')
        )
    )
  order by exists(
      select 1 from public.swipes incoming
      where incoming.swiper_id=target.id
        and incoming.target_id=viewer.id
        and incoming.direction='super'
        and incoming.created_at>now()-interval '30 days'
    ) desc,
    exists(
      select 1 from public.swipes incoming
      where incoming.swiper_id=target.id
        and incoming.target_id=viewer.id
        and incoming.direction='right'
        and incoming.created_at>now()-interval '30 days'
    ) desc,
    md5(target.id::text||viewer.id::text||current_date::text)
  limit least(greatest(coalesce(candidate_limit,20),1),40);
$$;

revoke all on function public.get_discovery_candidates(integer) from public;
grant execute on function public.get_discovery_candidates(integer) to authenticated;

-- Return one exact summary per conversation instead of downloading a shared
-- 1,000-message window that can hide quieter conversations.
create or replace function public.get_conversation_message_summaries(requested_match_ids uuid[])
returns table (
  match_id uuid,
  last_body text,
  last_kind public.message_kind,
  last_sender_id uuid,
  last_at timestamptz,
  unread_count bigint
)
language sql stable security definer set search_path=''
as $$
  select
    connection.id,
    latest.body,
    latest.kind,
    latest.sender_id,
    latest.created_at,
    (
      select count(*)
      from public.messages unread
      where unread.match_id=connection.id
        and unread.sender_id<>viewer.id
        and unread.read_at is null
    )
  from public.matches connection
  join public.profiles viewer on viewer.id=public.current_profile_id()
  left join lateral (
    select message.body,message.kind,message.sender_id,message.created_at
    from public.messages message
    where message.match_id=connection.id
    order by message.created_at desc,message.id desc
    limit 1
  ) latest on true
  where connection.id=any(coalesce(requested_match_ids,array[]::uuid[]))
    and viewer.id in(connection.user_a,connection.user_b);
$$;

revoke all on function public.get_conversation_message_summaries(uuid[]) from public;
grant execute on function public.get_conversation_message_summaries(uuid[]) to authenticated;

-- Enforce the rolling 24-hour delivery limit at delivery time. A queued match
-- crossing midnight is postponed instead of bypassing the limit.
create or replace function public.process_due_bot_matches_service(batch_limit integer default 20,only_member uuid default null)
returns table(decision_id uuid,match_id uuid,member_profile_id uuid,bot_profile_id uuid)
language plpgsql security definer set search_path=''
as $$
declare decision public.bot_match_decisions%rowtype; created_match uuid; last_delivery timestamptz;
begin
  if auth.role()<>'service_role' then raise exception 'service_role_required'; end if;
  for decision in select d.* from public.bot_match_decisions d
    where d.status='queued' and d.scheduled_for<=now() and (only_member is null or d.member_profile_id=only_member)
    order by d.scheduled_for for update skip locked limit greatest(1,least(batch_limit,100))
  loop
    select max(d.matched_at) into last_delivery from public.bot_match_decisions d
    where d.member_profile_id=decision.member_profile_id and d.status='matched' and d.id<>decision.id;
    if last_delivery>now()-interval '24 hours' then
      update public.bot_match_decisions set scheduled_for=last_delivery+interval '24 hours',updated_at=now() where id=decision.id;
      continue;
    end if;
    if not exists(select 1 from public.profiles where id=decision.member_profile_id and kind='human' and onboarding_completed and is_discoverable and deleted_at is null and safety_restricted_at is null)
      or not exists(select 1 from public.profiles where id=decision.bot_profile_id and kind='bot' and onboarding_completed and is_discoverable and deleted_at is null and safety_restricted_at is null)
      or exists(select 1 from public.blocks where (blocker_id=decision.member_profile_id and blocked_id=decision.bot_profile_id) or (blocker_id=decision.bot_profile_id and blocked_id=decision.member_profile_id)) then
      update public.bot_match_decisions set status='cancelled',cancellation_reason='profile_unavailable',updated_at=now() where id=decision.id;
      continue;
    end if;
    insert into public.matches(user_a,user_b,status,connection_type,request_status,request_expires_at,closed_at)
    values(least(decision.member_profile_id,decision.bot_profile_id),greatest(decision.member_profile_id,decision.bot_profile_id),'active','matched',null,null,null)
    on conflict(user_a,user_b) do update set status='active',connection_type='matched',request_status=null,request_expires_at=null,closed_at=null,matched_at=now()
    returning id into created_match;
    update public.bot_match_decisions set status='matched',match_id=created_match,matched_at=now(),updated_at=now() where id=decision.id;
    decision_id:=decision.id; match_id:=created_match; member_profile_id:=decision.member_profile_id; bot_profile_id:=decision.bot_profile_id; return next;
  end loop;
end;
$$;

revoke all on function public.process_due_bot_matches_service(integer,uuid) from public;
grant execute on function public.process_due_bot_matches_service(integer,uuid) to service_role;

-- The 90-day rediscovery rule needs a reliable close timestamp.
create or replace function public.unmatch_profile(target_profile uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare viewer uuid:=public.current_profile_id(); match_uuid uuid;
begin
  if viewer is null then raise exception 'profile_required'; end if;
  update public.matches
  set status='unmatched',request_status=coalesce(request_status,'closed'),closed_at=now()
  where status='active'
    and connection_type='matched'
    and user_a=least(viewer,target_profile)
    and user_b=greatest(viewer,target_profile)
  returning id into match_uuid;
  if match_uuid is null then raise exception 'active_match_required'; end if;
  update public.bot_reply_jobs
  set status='cancelled',cancellation_reason='unmatched',completed_at=now(),updated_at=now()
  where match_id=match_uuid and status in ('queued','typing','processing');
end;
$$;

revoke all on function public.unmatch_profile(uuid) from public;
grant execute on function public.unmatch_profile(uuid) to authenticated;
