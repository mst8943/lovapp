-- Verification requests and chat photos stay in private storage buckets.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('verification-selfies','verification-selfies',false,5242880,array['image/webp']),
       ('chat-images','chat-images',false,5242880,array['image/webp'])
on conflict (id) do nothing;

-- The request table already exists in migration 035 and keeps review history.
create or replace function public.review_profile_verification(p_request uuid,p_status text,p_admin uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
declare reviewed_profile uuid;
begin
  if p_status not in ('approved','rejected') then raise exception 'invalid_status'; end if;
  update public.profile_verification_requests
  set status=p_status,reviewed_by=p_admin,reviewed_at=now(),updated_at=now()
  where id=p_request and status='pending' and selfie_path is not null
  returning profile_id into reviewed_profile;
  if not found then return false; end if;
  if p_status='approved' then
    update public.profiles set is_verified=true where id=reviewed_profile and kind='human';
    if not found then raise exception 'profile_missing'; end if;
  end if;
  return true;
end;
$$;
revoke all on function public.review_profile_verification(uuid,text,uuid) from public;
grant execute on function public.review_profile_verification(uuid,text,uuid) to service_role;

create table if not exists public.contact_verification_challenges (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null check (channel in ('email','sms')),
  destination text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (profile_id,channel)
);
alter table public.contact_verification_challenges enable row level security;
revoke all on public.contact_verification_challenges from anon, authenticated;

create or replace function public.take_contact_verification_attempt(p_profile uuid,p_channel text,p_destination text)
returns text language sql security definer set search_path=''
as $$
  update public.contact_verification_challenges
  set attempts=attempts+1
  where profile_id=p_profile and channel=p_channel and destination=p_destination
    and verified_at is null and expires_at>now() and attempts<5
  returning code_hash;
$$;
revoke all on function public.take_contact_verification_attempt(uuid,text,text) from public;
grant execute on function public.take_contact_verification_attempt(uuid,text,text) to service_role;

create table if not exists public.verification_provider_settings (
  id boolean primary key default true check (id),
  encrypted_config text not null,
  updated_at timestamptz not null default now()
);
alter table public.verification_provider_settings enable row level security;
revoke all on public.verification_provider_settings from anon, authenticated;

create table if not exists public.product_funnel_events (
  id bigint generated always as identity primary key,
  event_name text not null check (event_name in ('signup_completed','profile_completed','photo_uploaded','verification_started','verification_passed','like_sent','pass_sent','match_created','first_message_sent','reply_received','block_created','report_created')),
  profile_id uuid references public.profiles(id) on delete set null,
  subject_id uuid,
  occurred_at timestamptz not null default now()
);
create index if not exists product_funnel_events_timeline on public.product_funnel_events(event_name,occurred_at desc);
alter table public.product_funnel_events enable row level security;
revoke all on public.product_funnel_events from anon, authenticated;

alter table public.messages drop constraint if exists messages_check;
alter table public.messages add constraint messages_content_check check (
  (kind='text' and body is not null) or
  (kind='audio' and audio_path is not null) or
  (kind::text='image' and audio_path is not null)
);

create or replace function public.send_image_message(match_uuid uuid,image_path text,client_uuid uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare sender_profile uuid:=public.current_profile_id(); existing public.messages%rowtype;
  inserted public.messages%rowtype; quota jsonb;
begin
  if sender_profile is null or client_uuid is null or image_path !~ ('^'||sender_profile::text||'/[0-9a-f-]{36}\.webp$') then
    raise exception 'invalid_image_message';
  end if;
  select * into existing from public.messages where match_id=match_uuid and sender_id=sender_profile and client_message_id=client_uuid;
  if found then return jsonb_build_object('messageId',existing.id,'createdAt',existing.created_at,'duplicate',true); end if;
  quota:=public.consume_message_allowance(sender_profile,match_uuid,'image');
  if not coalesce((quota->>'allowed')::boolean,false) then return quota; end if;
  insert into public.messages(match_id,sender_id,kind,audio_path,client_message_id)
  values(match_uuid,sender_profile,'image',image_path,client_uuid) returning * into inserted;
  update public.matches set last_message_at=inserted.created_at where id=match_uuid;
  return quota||jsonb_build_object('messageId',inserted.id,'createdAt',inserted.created_at);
end;
$$;
revoke all on function public.send_image_message(uuid,text,uuid) from public;
grant execute on function public.send_image_message(uuid,text,uuid) to authenticated;

create or replace function public.capture_product_funnel_event()
returns trigger language plpgsql security definer set search_path=''
as $$
declare first_sender uuid;
begin
  if tg_table_name='profiles' then
    if new.kind='human' and new.onboarding_completed and not old.onboarding_completed then
      insert into public.product_funnel_events(event_name,profile_id,subject_id) values('profile_completed',new.id,new.id);
    end if;
  elsif tg_table_name='profile_photos' then
    if exists(select 1 from public.profiles where id=new.profile_id and kind='human') then
      insert into public.product_funnel_events(event_name,profile_id,subject_id) values('photo_uploaded',new.profile_id,new.id);
    end if;
  elsif tg_table_name='profile_verification_requests' then
    if tg_op='INSERT' then
      if new.selfie_path is not null and new.status='pending' then
        insert into public.product_funnel_events(event_name,profile_id,subject_id) values('verification_started',new.profile_id,new.id);
      end if;
    else
      if old.selfie_path is null and new.selfie_path is not null and new.status='pending' then
        insert into public.product_funnel_events(event_name,profile_id,subject_id) values('verification_started',new.profile_id,new.id);
      elsif new.status='approved' and old.status is distinct from 'approved' then
        insert into public.product_funnel_events(event_name,profile_id,subject_id) values('verification_passed',new.profile_id,new.id);
      end if;
    end if;
  elsif tg_table_name='blocks' then
    if exists(select 1 from public.profiles where id=new.blocker_id and kind='human') then
      insert into public.product_funnel_events(event_name,profile_id,subject_id) values('block_created',new.blocker_id,new.blocked_id);
    end if;
  elsif tg_table_name='reports' then
    if exists(select 1 from public.profiles where id=new.reporter_id and kind='human') then
      insert into public.product_funnel_events(event_name,profile_id,subject_id) values('report_created',new.reporter_id,new.reported_id);
    end if;
  elsif tg_table_name='swipes' then
    if exists(select 1 from public.profiles where id=new.swiper_id and kind='human') then
      insert into public.product_funnel_events(event_name,profile_id,subject_id)
      values(case when new.direction='left' then 'pass_sent' else 'like_sent' end,new.swiper_id,new.target_id);
    end if;
  elsif tg_table_name='matches' then
    if exists(select 1 from public.profiles where id=new.user_a and kind='human')
      and exists(select 1 from public.profiles where id=new.user_b and kind='human') then
      insert into public.product_funnel_events(event_name,profile_id,subject_id) values('match_created',new.user_a,new.id);
    end if;
  elsif tg_table_name='messages' then
    if exists(select 1 from public.matches m join public.profiles a on a.id=m.user_a join public.profiles b on b.id=m.user_b where m.id=new.match_id and a.kind='human' and b.kind='human') then
      select sender_id into first_sender from public.messages where match_id=new.match_id and id<>new.id order by created_at,id limit 1;
      if first_sender is null then
        insert into public.product_funnel_events(event_name,profile_id,subject_id) values('first_message_sent',new.sender_id,new.match_id);
      elsif first_sender<>new.sender_id and not exists(select 1 from public.product_funnel_events where event_name='reply_received' and subject_id=new.match_id) then
        insert into public.product_funnel_events(event_name,profile_id,subject_id) values('reply_received',first_sender,new.match_id);
      end if;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists product_funnel_profiles on public.profiles;
create trigger product_funnel_profiles after update of onboarding_completed on public.profiles for each row execute function public.capture_product_funnel_event();
drop trigger if exists product_funnel_photos on public.profile_photos;
create trigger product_funnel_photos after insert on public.profile_photos for each row execute function public.capture_product_funnel_event();
drop trigger if exists product_funnel_verification on public.profile_verification_requests;
create trigger product_funnel_verification after insert or update of selfie_path,status on public.profile_verification_requests for each row execute function public.capture_product_funnel_event();
drop trigger if exists product_funnel_blocks on public.blocks;
create trigger product_funnel_blocks after insert on public.blocks for each row execute function public.capture_product_funnel_event();
drop trigger if exists product_funnel_reports on public.reports;
create trigger product_funnel_reports after insert on public.reports for each row execute function public.capture_product_funnel_event();
drop trigger if exists product_funnel_swipes on public.swipes;
create trigger product_funnel_swipes after insert on public.swipes for each row execute function public.capture_product_funnel_event();
drop trigger if exists product_funnel_matches on public.matches;
create trigger product_funnel_matches after insert on public.matches for each row execute function public.capture_product_funnel_event();
drop trigger if exists product_funnel_messages on public.messages;
create trigger product_funnel_messages after insert on public.messages for each row execute function public.capture_product_funnel_event();

create or replace function public.product_funnel_counts(since_date timestamptz)
returns table(event_name text,total bigint) language sql stable security definer set search_path=''
as $$ select e.event_name,count(*) from public.product_funnel_events e where e.occurred_at>=since_date group by e.event_name $$;
revoke all on function public.product_funnel_counts(timestamptz) from public;
grant execute on function public.product_funnel_counts(timestamptz) to service_role;
