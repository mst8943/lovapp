-- Bot likes resolve once at swipe time: 25% become delayed matches, the rest stay rejected.

create table if not exists public.bot_match_decisions (
  id uuid primary key default gen_random_uuid(),
  member_profile_id uuid not null references public.profiles(id) on delete cascade,
  bot_profile_id uuid not null references public.profiles(id) on delete cascade,
  swipe_id bigint not null references public.swipes(id) on delete cascade,
  status text not null check (status in ('queued','rejected','matched','cancelled')),
  scheduled_for timestamptz,
  matched_at timestamptz,
  match_id uuid references public.matches(id) on delete set null,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(member_profile_id,bot_profile_id),
  check ((status='queued' and scheduled_for is not null) or status<>'queued')
);
create index if not exists bot_match_decisions_due on public.bot_match_decisions(status,scheduled_for) where status='queued';
alter table public.bot_match_decisions enable row level security;
drop policy if exists "admins inspect bot match decisions" on public.bot_match_decisions;
create policy "admins inspect bot match decisions" on public.bot_match_decisions for select to authenticated
using (public.has_admin_role(array['owner','bot_editor','support']));
revoke all on public.bot_match_decisions from anon,authenticated;

create or replace function public.record_swipe(target_profile uuid, swipe_choice public.swipe_direction)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  viewer public.profiles%rowtype; target public.profiles%rowtype; inserted_swipe public.swipes%rowtype;
  positive boolean := swipe_choice in ('right','super'); reciprocal boolean := false;
  resulting_match uuid; quest_uuid uuid; quest_target integer; quest_reward integer;
  quest_progress integer := 0; awarded_rows integer := 0; today_tr date := (now() at time zone 'Europe/Istanbul')::date;
  allowance jsonb; bot_will_match boolean := false; bot_due timestamptz;
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
      bot_will_match := random()<0.25;
      if bot_will_match then
        bot_due := now() + case when random()<0.5
          then make_interval(secs => 300 + floor(random()*3301)::integer)
          else make_interval(secs => 3600 + floor(random()*18001)::integer) end;
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

create or replace function public.process_due_bot_matches_service(batch_limit integer default 20, only_member uuid default null)
returns table(decision_id uuid,match_id uuid,member_profile_id uuid,bot_profile_id uuid)
language plpgsql security definer set search_path=''
as $$
declare decision public.bot_match_decisions%rowtype; created_match uuid;
begin
  if auth.role()<>'service_role' then raise exception 'service_role_required'; end if;
  for decision in
    select d.* from public.bot_match_decisions d
    where d.status='queued' and d.scheduled_for<=now() and (only_member is null or d.member_profile_id=only_member)
    order by d.scheduled_for for update skip locked limit greatest(1,least(batch_limit,100))
  loop
    if not exists(select 1 from public.profiles where id=decision.member_profile_id and kind='human' and onboarding_completed and is_discoverable)
      or not exists(select 1 from public.profiles where id=decision.bot_profile_id and kind='bot' and onboarding_completed and is_discoverable)
      or exists(select 1 from public.blocks where (blocker_id=decision.member_profile_id and blocked_id=decision.bot_profile_id) or (blocker_id=decision.bot_profile_id and blocked_id=decision.member_profile_id)) then
      update public.bot_match_decisions set status='cancelled',cancellation_reason='profile_unavailable',updated_at=now() where id=decision.id;
      continue;
    end if;
    insert into public.matches(user_a,user_b,status) values(least(decision.member_profile_id,decision.bot_profile_id),greatest(decision.member_profile_id,decision.bot_profile_id),'active')
    on conflict(user_a,user_b) do update set status='active',matched_at=now() returning id into created_match;
    update public.bot_match_decisions set status='matched',match_id=created_match,matched_at=now(),updated_at=now() where id=decision.id;
    decision_id:=decision.id; match_id:=created_match; member_profile_id:=decision.member_profile_id; bot_profile_id:=decision.bot_profile_id; return next;
  end loop;
end;
$$;
revoke all on function public.process_due_bot_matches_service(integer,uuid) from public;
grant execute on function public.process_due_bot_matches_service(integer,uuid) to service_role;

create or replace function public.rewind_last_swipe()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare viewer uuid:=public.current_profile_id(); last_swipe public.swipes%rowtype; match_row public.matches%rowtype;
begin
  if viewer is null then raise exception 'authentication_required'; end if;
  if not exists(select 1 from public.user_entitlements where profile_id=viewer and noir_until>now()) then raise exception 'noir_required'; end if;
  select * into last_swipe from public.swipes where swiper_id=viewer order by created_at desc,id desc limit 1 for update;
  if not found then raise exception 'nothing_to_rewind'; end if;
  select * into match_row from public.matches where user_a=least(viewer,last_swipe.target_id) and user_b=greatest(viewer,last_swipe.target_id) and status='active' for update;
  if found and exists(select 1 from public.messages where match_id=match_row.id) then raise exception 'conversation_started'; end if;
  if found then delete from public.matches where id=match_row.id; end if;
  delete from public.bot_match_decisions where swipe_id=last_swipe.id;
  delete from public.swipes where id=last_swipe.id;
  return jsonb_build_object('profileId',last_swipe.target_id,'direction',last_swipe.direction);
end;
$$;

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='bot_match_decisions') then
    alter publication supabase_realtime add table public.bot_match_decisions;
  end if;
end $$;
