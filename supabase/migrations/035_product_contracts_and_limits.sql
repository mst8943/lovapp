-- Product contracts agreed on 2026-08-15: explicit connection states,
-- scarce standard likes, truthful message counters, profile compatibility and
-- durable privacy/safety settings.

alter table public.profiles
  add column if not exists district text,
  add column if not exists gender_detail text,
  add column if not exists relationship_goal text,
  add column if not exists marital_status text,
  add column if not exists has_children boolean,
  add column if not exists children_preference text,
  add column if not exists alcohol_use text,
  add column if not exists smoking_use text,
  add column if not exists pet_preference text,
  add column if not exists sports_habit text,
  add column if not exists height_cm smallint,
  add column if not exists education_level text,
  add column if not exists languages text[] not null default array[]::text[],
  add column if not exists verification_status text not null default 'unverified',
  add column if not exists safety_restricted_at timestamptz,
  add column if not exists deleted_at timestamptz;

alter table public.profiles drop constraint if exists profiles_relationship_goal_check;
alter table public.profiles add constraint profiles_relationship_goal_check check (
  relationship_goal is null or relationship_goal in ('marriage','serious','dating','short_term','friendship','unsure')
);
alter table public.profiles drop constraint if exists profiles_marital_status_check;
alter table public.profiles add constraint profiles_marital_status_check check (
  marital_status is null or marital_status in ('never_married','divorced','widowed','separated','married')
);
alter table public.profiles drop constraint if exists profiles_children_preference_check;
alter table public.profiles add constraint profiles_children_preference_check check (
  children_preference is null or children_preference in ('want','do_not_want','open','unsure')
);
alter table public.profiles drop constraint if exists profiles_height_check;
alter table public.profiles add constraint profiles_height_check check (height_cm is null or height_cm between 120 and 230);
alter table public.profiles drop constraint if exists profiles_verification_status_check;
alter table public.profiles add constraint profiles_verification_status_check check (
  verification_status in ('unverified','pending','verified','rejected','suspended')
);

alter table public.discovery_preferences
  add column if not exists cities text[] not null default array[]::text[],
  add column if not exists max_distance_km integer,
  add column if not exists relationship_goals text[] not null default array[]::text[],
  add column if not exists marital_statuses text[] not null default array[]::text[],
  add column if not exists has_children_values boolean[] not null default array[]::boolean[],
  add column if not exists children_preferences text[] not null default array[]::text[],
  add column if not exists alcohol_values text[] not null default array[]::text[],
  add column if not exists smoking_values text[] not null default array[]::text[],
  add column if not exists pet_values text[] not null default array[]::text[],
  add column if not exists sports_values text[] not null default array[]::text[],
  add column if not exists zodiac_values text[] not null default array[]::text[],
  add column if not exists min_height_cm integer,
  add column if not exists max_height_cm integer,
  add column if not exists education_values text[] not null default array[]::text[],
  add column if not exists language_values text[] not null default array[]::text[];

alter table public.matches
  add column if not exists connection_type text not null default 'matched',
  add column if not exists request_sender_id uuid references public.profiles(id) on delete set null,
  add column if not exists request_status text,
  add column if not exists request_expires_at timestamptz,
  add column if not exists closed_at timestamptz;
alter table public.matches drop constraint if exists matches_connection_type_check;
alter table public.matches add constraint matches_connection_type_check check (
  connection_type in ('matched','message_request','direct_chat')
);
alter table public.matches drop constraint if exists matches_request_status_check;
alter table public.matches add constraint matches_request_status_check check (
  request_status is null or request_status in ('draft','pending','accepted','rejected','expired','closed')
);

-- Preserve historical direct conversations without relying on a magic date in
-- application code. Mutual likes and completed bot decisions are matches;
-- other active rows with messages become accepted direct chats.
update public.matches m set connection_type = case
  when exists(select 1 from public.swipes a where a.swiper_id=m.user_a and a.target_id=m.user_b and a.direction in ('right','super'))
   and exists(select 1 from public.swipes b where b.swiper_id=m.user_b and b.target_id=m.user_a and b.direction in ('right','super')) then 'matched'
  when exists(select 1 from public.bot_match_decisions d where d.match_id=m.id and d.status='matched') then 'matched'
  when exists(select 1 from public.messages msg where msg.match_id=m.id) then 'direct_chat'
  else 'matched'
end,
request_status = case when exists(select 1 from public.messages msg where msg.match_id=m.id)
  and not (
    exists(select 1 from public.swipes a where a.swiper_id=m.user_a and a.target_id=m.user_b and a.direction in ('right','super'))
    and exists(select 1 from public.swipes b where b.swiper_id=m.user_b and b.target_id=m.user_a and b.direction in ('right','super'))
  ) then 'accepted' else null end
where m.connection_type='matched';

create table if not exists public.swipe_daily_usage (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  usage_date date not null,
  like_count integer not null default 0 check(like_count>=0),
  primary key(profile_id,usage_date)
);
create table if not exists public.message_request_daily_usage (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  usage_date date not null,
  request_count integer not null default 0 check(request_count>=0),
  primary key(profile_id,usage_date)
);
alter table public.swipe_daily_usage enable row level security;
alter table public.message_request_daily_usage enable row level security;
drop policy if exists "users see own swipe usage" on public.swipe_daily_usage;
create policy "users see own swipe usage" on public.swipe_daily_usage for select to authenticated
using(profile_id=public.current_profile_id());
drop policy if exists "users see own request usage" on public.message_request_daily_usage;
create policy "users see own request usage" on public.message_request_daily_usage for select to authenticated
using(profile_id=public.current_profile_id());
revoke insert,update,delete on public.swipe_daily_usage from anon,authenticated;
revoke insert,update,delete on public.message_request_daily_usage from anon,authenticated;

create table if not exists public.profile_verification_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  selfie_path text,
  challenge text not null,
  status text not null default 'pending' check(status in ('pending','approved','rejected','cancelled')),
  rejection_reason text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  media_deleted_at timestamptz,
  media_deleted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists profile_verification_one_pending
  on public.profile_verification_requests(profile_id) where status='pending';
alter table public.profile_verification_requests enable row level security;
drop policy if exists "users see own verification" on public.profile_verification_requests;
create policy "users see own verification" on public.profile_verification_requests for select to authenticated
using(profile_id=public.current_profile_id() or public.has_admin_role(array['owner','moderator','support']));
revoke insert,update,delete on public.profile_verification_requests from anon,authenticated;

create table if not exists public.legal_acceptances (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null check(document_type in ('terms','privacy','community','noir_payment','marketing')),
  document_version text not null,
  accepted boolean not null,
  accepted_at timestamptz not null default now(),
  unique(user_id,document_type,document_version)
);
alter table public.legal_acceptances enable row level security;
drop policy if exists "users see own legal acceptances" on public.legal_acceptances;
create policy "users see own legal acceptances" on public.legal_acceptances for select to authenticated using(user_id=auth.uid());
revoke insert,update,delete on public.legal_acceptances from anon,authenticated;

alter table public.notification_preferences
  add column if not exists likes_enabled boolean not null default true,
  add column if not exists matches_enabled boolean not null default true,
  add column if not exists visitors_enabled boolean not null default true,
  add column if not exists messages_enabled boolean not null default true,
  add column if not exists message_requests_enabled boolean not null default true,
  add column if not exists admin_updates_enabled boolean not null default true,
  add column if not exists product_updates_enabled boolean not null default false,
  add column if not exists incognito_enabled boolean not null default false,
  add column if not exists incognito_started_at timestamptz;

create or replace function public.profile_details_complete(profile_uuid uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select coalesce(p.city,'')<>'' and p.relationship_goal is not null and p.marital_status is not null
    and p.has_children is not null and p.children_preference is not null
  from public.profiles p where p.id=profile_uuid and p.kind='human';
$$;

create or replace function public.mutually_eligible(viewer_uuid uuid,target_uuid uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(
    select 1 from public.profiles viewer
    join public.profiles target on target.id=target_uuid
    left join public.discovery_preferences vp on vp.profile_id=viewer.id
    left join public.discovery_preferences tp on tp.profile_id=target.id
    where viewer.id=viewer_uuid and viewer.kind='human' and target.kind in ('human','bot')
      and viewer.onboarding_completed and target.onboarding_completed
      and viewer.deleted_at is null and target.deleted_at is null
      and viewer.safety_restricted_at is null and target.safety_restricted_at is null
      and target.is_discoverable
      and not exists(select 1 from public.blocks b where
        (b.blocker_id=viewer.id and b.blocked_id=target.id) or (b.blocker_id=target.id and b.blocked_id=viewer.id))
      and (target.kind='bot' or (
        viewer.gender=any(coalesce(tp.interested_genders,array['kadın','erkek','nonbinary','other']::text[]))
        and target.gender=any(coalesce(vp.interested_genders,array['kadın','erkek','nonbinary','other']::text[]))
        and extract(year from age(current_date,viewer.birth_date))::integer between coalesce(tp.min_age,18) and coalesce(tp.max_age,99)
        and extract(year from age(current_date,target.birth_date))::integer between coalesce(vp.min_age,18) and coalesce(vp.max_age,99)
      ))
  );
$$;

create or replace function public.get_like_allowance()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare viewer uuid:=public.current_profile_id(); premium boolean; used_count integer:=0;
  today_tr date:=(now() at time zone 'Europe/Istanbul')::date; resets timestamptz;
begin
  if viewer is null then raise exception 'profile_required'; end if;
  premium:=exists(select 1 from public.user_entitlements where profile_id=viewer and noir_until>now());
  select coalesce(like_count,0) into used_count from public.swipe_daily_usage where profile_id=viewer and usage_date=today_tr;
  resets:=((today_tr+1)::timestamp at time zone 'Europe/Istanbul');
  return jsonb_build_object('remaining',case when premium then null else greatest(10-used_count,0) end,
    'limit',case when premium then null else 10 end,'premium',premium,'resetsAt',resets);
end;
$$;

create or replace function public.get_message_allowance()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare viewer uuid:=public.current_profile_id(); premium boolean; used_messages integer:=0; used_requests integer:=0;
  today_tr date:=(now() at time zone 'Europe/Istanbul')::date; message_limit integer; request_limit integer;
begin
  if viewer is null then raise exception 'profile_required'; end if;
  premium:=exists(select 1 from public.user_entitlements where profile_id=viewer and noir_until>now());
  message_limit:=case when premium then 100 else 25 end; request_limit:=case when premium then 3 else 1 end;
  select coalesce(sent_count,0) into used_messages from public.message_daily_usage where profile_id=viewer and usage_date=today_tr;
  select coalesce(request_count,0) into used_requests from public.message_request_daily_usage where profile_id=viewer and usage_date=today_tr;
  return jsonb_build_object('remaining',greatest(message_limit-used_messages,0),'limit',message_limit,
    'requestRemaining',greatest(request_limit-used_requests,0),'requestLimit',request_limit,
    'resetsAt',((today_tr+1)::timestamp at time zone 'Europe/Istanbul'),'premium',premium);
end;
$$;

-- The daily quest now rewards three considered profile decisions, not three
-- unconditional positive swipes.
update public.daily_quests set slug='three-profile-decisions',title='3 profil hakkında karar ver',event_name='profile_decision'
where slug='three-right-swipes';

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
  if not public.profile_details_complete(viewer.id) then raise exception 'profile_details_required'; end if;
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

create or replace function public.rewind_last_swipe()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare viewer uuid:=public.current_profile_id(); last_swipe public.swipes%rowtype;
begin
  if viewer is null then raise exception 'authentication_required'; end if;
  if not exists(select 1 from public.user_entitlements where profile_id=viewer and noir_until>now()) then raise exception 'noir_required'; end if;
  select * into last_swipe from public.swipes where swiper_id=viewer order by created_at desc,id desc limit 1 for update;
  if not found then raise exception 'nothing_to_rewind'; end if;
  if last_swipe.direction='super' then raise exception 'super_like_not_rewindable'; end if;
  if exists(select 1 from public.matches where user_a=least(viewer,last_swipe.target_id) and user_b=greatest(viewer,last_swipe.target_id) and status='active') then raise exception 'matched_decision_not_rewindable'; end if;
  delete from public.bot_match_decisions where swipe_id=last_swipe.id;
  delete from public.swipes where id=last_swipe.id;
  return jsonb_build_object('profileId',last_swipe.target_id,'direction',last_swipe.direction);
end;
$$;

create or replace function public.respond_message_request(match_uuid uuid, request_action text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare viewer uuid:=public.current_profile_id(); connection public.matches%rowtype;
begin
  if viewer is null then raise exception 'profile_required'; end if;
  if request_action not in ('accept','reject') then raise exception 'invalid_action'; end if;
  select * into connection from public.matches where id=match_uuid and status='active' and connection_type='message_request' for update;
  if not found or viewer not in(connection.user_a,connection.user_b) or viewer=connection.request_sender_id then raise exception 'request_unavailable'; end if;
  if connection.request_status<>'pending' or connection.request_expires_at<=now() then
    update public.matches set request_status='expired',closed_at=now() where id=match_uuid and request_status='pending';
    raise exception 'request_unavailable';
  end if;
  if request_action='accept' then
    update public.matches set connection_type='direct_chat',request_status='accepted',request_expires_at=null where id=match_uuid;
  else
    update public.matches set status='unmatched',request_status='rejected',closed_at=now() where id=match_uuid;
  end if;
  return jsonb_build_object('accepted',request_action='accept');
end;
$$;

create or replace function public.open_message_request(target_profile uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare viewer uuid:=public.current_profile_id(); existing public.matches%rowtype; created public.matches%rowtype;
begin
  if viewer is null then raise exception 'profile_required'; end if;
  if viewer=target_profile or not public.mutually_eligible(viewer,target_profile) then raise exception 'target_unavailable'; end if;
  perform pg_advisory_xact_lock(hashtextextended(least(viewer,target_profile)::text||greatest(viewer,target_profile)::text,71));
  select * into existing from public.matches where user_a=least(viewer,target_profile) and user_b=greatest(viewer,target_profile) for update;
  if found then
    if existing.status='active' and existing.connection_type in ('matched','direct_chat') then
      return jsonb_build_object('matchId',existing.id,'connectionType',existing.connection_type,'requestStatus',existing.request_status);
    end if;
    if existing.status='active' and existing.connection_type='message_request' and existing.request_sender_id=viewer
      and existing.request_status in ('draft','pending') then
      return jsonb_build_object('matchId',existing.id,'connectionType','message_request','requestStatus',existing.request_status);
    end if;
    raise exception 'request_already_closed';
  end if;
  insert into public.matches(user_a,user_b,status,connection_type,request_sender_id,request_status,request_expires_at)
  values(least(viewer,target_profile),greatest(viewer,target_profile),'active','message_request',viewer,'draft',now()+interval '7 days')
  returning * into created;
  return jsonb_build_object('matchId',created.id,'connectionType','message_request','requestStatus','draft');
end;
$$;

create or replace function public.consume_message_allowance(sender_profile uuid, match_uuid uuid, message_kind text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare connection public.matches%rowtype; today_tr date:=(now() at time zone 'Europe/Istanbul')::date;
  premium boolean; daily_limit integer; request_limit integer; used_count integer:=0; used_requests integer:=0; first_request boolean:=false;
begin
  select * into connection from public.matches where id=match_uuid and status='active' and sender_profile in(user_a,user_b) for update;
  if not found then raise exception 'active_match_required'; end if;
  if connection.connection_type='message_request' then
    if connection.request_expires_at<=now() then
      update public.matches set status='unmatched',request_status='expired',closed_at=now() where id=match_uuid;
      raise exception 'message_request_expired';
    end if;
    if sender_profile<>connection.request_sender_id then raise exception 'message_request_accept_required'; end if;
    if message_kind<>'text' then raise exception 'message_request_text_only'; end if;
    if connection.request_status='pending' or exists(select 1 from public.messages where match_id=match_uuid and sender_id=sender_profile) then
      raise exception 'message_request_reply_required';
    end if;
    if connection.request_status<>'draft' then raise exception 'message_request_closed'; end if;
    first_request:=true;
  end if;
  premium:=exists(select 1 from public.user_entitlements where profile_id=sender_profile and noir_until>now());
  daily_limit:=case when premium then 100 else 25 end;
  request_limit:=case when premium then 3 else 1 end;
  insert into public.message_daily_usage(profile_id,usage_date,sent_count) values(sender_profile,today_tr,0) on conflict do nothing;
  select sent_count into used_count from public.message_daily_usage where profile_id=sender_profile and usage_date=today_tr for update;
  if used_count>=daily_limit then return jsonb_build_object('allowed',false,'reason','message_limit','remaining',0,'limit',daily_limit); end if;
  if first_request then
    insert into public.message_request_daily_usage(profile_id,usage_date,request_count) values(sender_profile,today_tr,0) on conflict do nothing;
    select request_count into used_requests from public.message_request_daily_usage where profile_id=sender_profile and usage_date=today_tr for update;
    if used_requests>=request_limit then
      return jsonb_build_object('allowed',false,'reason','request_limit','remaining',daily_limit-used_count,'limit',daily_limit,
        'requestRemaining',0,'requestLimit',request_limit);
    end if;
    update public.message_request_daily_usage set request_count=request_count+1 where profile_id=sender_profile and usage_date=today_tr;
    update public.matches set request_status='pending',request_expires_at=now()+interval '7 days' where id=match_uuid;
  end if;
  update public.message_daily_usage set sent_count=sent_count+1 where profile_id=sender_profile and usage_date=today_tr;
  return jsonb_build_object('allowed',true,'remaining',daily_limit-used_count-1,'limit',daily_limit,
    'requestRemaining',case when first_request then request_limit-used_requests-1 else null end,'requestLimit',request_limit,'firstRequest',first_request);
end;
$$;

create or replace function public.send_text_message(match_uuid uuid,message_body text,client_uuid uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare sender_profile uuid:=public.current_profile_id(); existing public.messages%rowtype; inserted public.messages%rowtype;
  quota jsonb; quest_uuid uuid; quest_reward integer; awarded_rows integer:=0; today_tr date:=(now() at time zone 'Europe/Istanbul')::date;
  connection_type_value text;
begin
  if sender_profile is null then raise exception 'profile_required'; end if;
  if client_uuid is null or char_length(btrim(message_body)) not between 1 and 1200 then raise exception 'invalid_message'; end if;
  select * into existing from public.messages where match_id=match_uuid and sender_id=sender_profile and client_message_id=client_uuid;
  if found then return jsonb_build_object('messageId',existing.id,'createdAt',existing.created_at,'duplicate',true); end if;
  quota:=public.consume_message_allowance(sender_profile,match_uuid,'text');
  if not coalesce((quota->>'allowed')::boolean,false) then return quota; end if;
  insert into public.messages(match_id,sender_id,kind,body,client_message_id)
  values(match_uuid,sender_profile,'text',btrim(message_body),client_uuid) returning * into inserted;
  update public.matches set last_message_at=inserted.created_at where id=match_uuid;
  select connection_type into connection_type_value from public.matches where id=match_uuid;
  if connection_type_value in ('matched','direct_chat') then
    select id,xp_reward into quest_uuid,quest_reward from public.daily_quests where slug='start-chat' and is_active limit 1;
    if quest_uuid is not null then
      insert into public.user_quest_progress(user_id,quest_id,quest_date,progress,completed_at,xp_claimed_at)
      values(sender_profile,quest_uuid,today_tr,1,now(),now()) on conflict(user_id,quest_id,quest_date) do nothing;
      get diagnostics awarded_rows=row_count;
      if awarded_rows=1 then update public.profiles set xp=xp+quest_reward where id=sender_profile; end if;
    end if;
  end if;
  return quota||jsonb_build_object('messageId',inserted.id,'createdAt',inserted.created_at,
    'xpAwarded',case when awarded_rows=1 then quest_reward else 0 end);
end;
$$;

create or replace function public.send_audio_message(match_uuid uuid,message_audio_path text,message_duration_ms integer,message_waveform smallint[],client_uuid uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare sender_profile uuid:=public.current_profile_id(); existing public.messages%rowtype; inserted public.messages%rowtype; quota jsonb;
begin
  if sender_profile is null then raise exception 'profile_required'; end if;
  if client_uuid is null or message_duration_ms not between 500 and 60000 or cardinality(message_waveform) not between 8 and 48
    or not(0<=all(message_waveform) and 100>=all(message_waveform)) then raise exception 'invalid_audio'; end if;
  if message_audio_path not like sender_profile::text||'/'||match_uuid::text||'/%' then raise exception 'invalid_audio_path'; end if;
  select * into existing from public.messages where match_id=match_uuid and sender_id=sender_profile and client_message_id=client_uuid;
  if found then return jsonb_build_object('messageId',existing.id,'createdAt',existing.created_at,'duplicate',true); end if;
  quota:=public.consume_message_allowance(sender_profile,match_uuid,'audio');
  if not coalesce((quota->>'allowed')::boolean,false) then return quota; end if;
  insert into public.messages(match_id,sender_id,kind,audio_path,audio_duration_ms,audio_waveform,client_message_id)
  values(match_uuid,sender_profile,'audio',message_audio_path,message_duration_ms,message_waveform,client_uuid) returning * into inserted;
  update public.matches set last_message_at=inserted.created_at where id=match_uuid;
  return quota||jsonb_build_object('messageId',inserted.id,'createdAt',inserted.created_at);
end;
$$;

create or replace function public.send_bot_text_message_service(member_uuid uuid,match_uuid uuid,message_body text,client_uuid uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare existing public.messages%rowtype; inserted public.messages%rowtype; quota jsonb; quest_uuid uuid; quest_reward integer; awarded integer:=0;
  today_tr date:=(now() at time zone 'Europe/Istanbul')::date;
begin
  if auth.role()<>'service_role' then raise exception 'service_role_required'; end if;
  if char_length(btrim(message_body)) not between 1 and 1200 or client_uuid is null then raise exception 'invalid_message'; end if;
  if not exists(select 1 from public.matches m join public.profiles p on p.id=case when m.user_a=member_uuid then m.user_b else m.user_a end
    where m.id=match_uuid and m.status='active' and member_uuid in(m.user_a,m.user_b) and p.kind='bot') then raise exception 'active_bot_match_required'; end if;
  select * into existing from public.messages where match_id=match_uuid and sender_id=member_uuid and client_message_id=client_uuid;
  if found then return jsonb_build_object('messageId',existing.id,'createdAt',existing.created_at,'duplicate',true); end if;
  quota:=public.consume_message_allowance(member_uuid,match_uuid,'text');
  if not coalesce((quota->>'allowed')::boolean,false) then return quota; end if;
  insert into public.messages(match_id,sender_id,kind,body,client_message_id)
  values(match_uuid,member_uuid,'text',btrim(message_body),client_uuid) returning * into inserted;
  update public.matches set last_message_at=inserted.created_at where id=match_uuid;
  select id,xp_reward into quest_uuid,quest_reward from public.daily_quests where slug='start-chat' and is_active limit 1;
  if quest_uuid is not null then
    insert into public.user_quest_progress(user_id,quest_id,quest_date,progress,completed_at,xp_claimed_at)
    values(member_uuid,quest_uuid,today_tr,1,now(),now()) on conflict(user_id,quest_id,quest_date) do nothing;
    get diagnostics awarded=row_count; if awarded=1 then update public.profiles set xp=xp+quest_reward where id=member_uuid; end if;
  end if;
  return quota||jsonb_build_object('messageId',inserted.id,'createdAt',inserted.created_at,'xpAwarded',case when awarded=1 then quest_reward else 0 end);
end;
$$;

create or replace function public.send_bot_audio_message_service(member_uuid uuid,match_uuid uuid,message_audio_path text,message_duration_ms integer,message_waveform smallint[],client_uuid uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare existing public.messages%rowtype; inserted public.messages%rowtype; quota jsonb;
begin
  if auth.role()<>'service_role' then raise exception 'service_role_required'; end if;
  if client_uuid is null or message_duration_ms not between 500 and 60000 or cardinality(message_waveform) not between 8 and 48 then raise exception 'invalid_audio'; end if;
  if message_audio_path not like member_uuid::text||'/'||match_uuid::text||'/%' then raise exception 'invalid_audio_path'; end if;
  if not exists(select 1 from public.matches m join public.profiles p on p.id=case when m.user_a=member_uuid then m.user_b else m.user_a end
    where m.id=match_uuid and m.status='active' and member_uuid in(m.user_a,m.user_b) and p.kind='bot') then raise exception 'active_bot_match_required'; end if;
  select * into existing from public.messages where match_id=match_uuid and sender_id=member_uuid and client_message_id=client_uuid;
  if found then return jsonb_build_object('messageId',existing.id,'createdAt',existing.created_at,'duplicate',true); end if;
  quota:=public.consume_message_allowance(member_uuid,match_uuid,'audio');
  if not coalesce((quota->>'allowed')::boolean,false) then return quota; end if;
  insert into public.messages(match_id,sender_id,kind,audio_path,audio_duration_ms,audio_waveform,client_message_id)
  values(match_uuid,member_uuid,'audio',message_audio_path,message_duration_ms,message_waveform,client_uuid) returning * into inserted;
  update public.matches set last_message_at=inserted.created_at where id=match_uuid;
  return quota||jsonb_build_object('messageId',inserted.id,'createdAt',inserted.created_at);
end;
$$;

create or replace function public.process_due_bot_matches_service(batch_limit integer default 20,only_member uuid default null)
returns table(decision_id uuid,match_id uuid,member_profile_id uuid,bot_profile_id uuid)
language plpgsql security definer set search_path=''
as $$
declare decision public.bot_match_decisions%rowtype; created_match uuid;
begin
  if auth.role()<>'service_role' then raise exception 'service_role_required'; end if;
  for decision in select d.* from public.bot_match_decisions d
    where d.status='queued' and d.scheduled_for<=now() and (only_member is null or d.member_profile_id=only_member)
    order by d.scheduled_for for update skip locked limit greatest(1,least(batch_limit,100))
  loop
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

revoke all on function public.profile_details_complete(uuid) from public;
revoke all on function public.mutually_eligible(uuid,uuid) from public;
revoke all on function public.get_like_allowance() from public;
revoke all on function public.get_message_allowance() from public;
revoke all on function public.respond_message_request(uuid,text) from public;
revoke all on function public.open_message_request(uuid) from public;
revoke all on function public.consume_message_allowance(uuid,uuid,text) from public;
revoke all on function public.send_text_message(uuid,text,uuid) from public;
revoke all on function public.send_audio_message(uuid,text,integer,smallint[],uuid) from public;
revoke all on function public.send_bot_text_message_service(uuid,uuid,text,uuid) from public;
revoke all on function public.send_bot_audio_message_service(uuid,uuid,text,integer,smallint[],uuid) from public;
revoke all on function public.process_due_bot_matches_service(integer,uuid) from public;
grant execute on function public.get_like_allowance() to authenticated;
grant execute on function public.get_message_allowance() to authenticated;
grant execute on function public.respond_message_request(uuid,text) to authenticated;
grant execute on function public.open_message_request(uuid) to authenticated;
grant execute on function public.send_text_message(uuid,text,uuid) to authenticated;
grant execute on function public.send_audio_message(uuid,text,integer,smallint[],uuid) to authenticated;
grant execute on function public.send_bot_text_message_service(uuid,uuid,text,uuid) to service_role;
grant execute on function public.send_bot_audio_message_service(uuid,uuid,text,integer,smallint[],uuid) to service_role;
grant execute on function public.process_due_bot_matches_service(integer,uuid) to service_role;

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='profile_verification_requests') then
    alter publication supabase_realtime add table public.profile_verification_requests;
  end if;
end $$;
