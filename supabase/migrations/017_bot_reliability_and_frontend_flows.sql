-- Reliability, measurable experiments, persistent discovery preferences and atomic publishes.

alter table public.bot_reply_jobs
  add column if not exists experiment_id uuid references public.bot_experiments(id) on delete set null,
  add column if not exists experiment_variant text check (experiment_variant in ('control','variant'));
create index if not exists bot_reply_jobs_stale_processing on public.bot_reply_jobs(locked_at) where status='processing';

create table if not exists public.bot_experiment_assignments (
  experiment_id uuid not null references public.bot_experiments(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  variant text not null check (variant in ('control','variant')),
  assigned_at timestamptz not null default now(),
  sent_at timestamptz,
  replied_at timestamptz,
  blocked_at timestamptz,
  reported_at timestamptz,
  primary key(experiment_id,match_id)
);
alter table public.bot_experiment_assignments enable row level security;
create policy "bot editors inspect experiment assignments" on public.bot_experiment_assignments for select to authenticated
using (public.has_admin_role(array['owner','bot_editor']));
revoke all on public.bot_experiment_assignments from anon,authenticated;

create table if not exists public.discovery_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  min_age integer not null default 18 check(min_age between 18 and 99),
  max_age integer not null default 80 check(max_age between 18 and 99),
  verified_only boolean not null default false,
  updated_at timestamptz not null default now(),
  check(min_age <= max_age)
);
alter table public.discovery_preferences enable row level security;
create policy "users manage discovery preferences" on public.discovery_preferences for all to authenticated
using(profile_id=public.current_profile_id()) with check(profile_id=public.current_profile_id());

create or replace function public.send_bot_text_message_service(member_uuid uuid,match_uuid uuid,message_body text,client_uuid uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare existing public.messages%rowtype; inserted public.messages%rowtype; quest_uuid uuid; quest_reward integer; awarded integer:=0; used_count integer:=0; daily_limit integer;
begin
  if auth.role()<>'service_role' then raise exception 'service_role_required'; end if;
  if char_length(btrim(message_body)) not between 1 and 1200 or client_uuid is null then raise exception 'invalid_message'; end if;
  if not exists(select 1 from public.matches m join public.profiles p on p.id=case when m.user_a=member_uuid then m.user_b else m.user_a end where m.id=match_uuid and m.status='active' and member_uuid in(m.user_a,m.user_b) and p.kind='bot') then raise exception 'active_bot_match_required'; end if;
  select * into existing from public.messages where match_id=match_uuid and sender_id=member_uuid and client_message_id=client_uuid;
  if found then return jsonb_build_object('messageId',existing.id,'createdAt',existing.created_at,'duplicate',true); end if;
  insert into public.messages(match_id,sender_id,kind,body,client_message_id) values(match_uuid,member_uuid,'text',btrim(message_body),client_uuid) returning * into inserted;
  update public.matches set last_message_at=inserted.created_at where id=match_uuid;
  select id,xp_reward into quest_uuid,quest_reward from public.daily_quests where slug='start-chat' and is_active limit 1;
  if quest_uuid is not null then
    insert into public.user_quest_progress(user_id,quest_id,quest_date,progress,completed_at,xp_claimed_at) values(member_uuid,quest_uuid,(now() at time zone 'Europe/Istanbul')::date,1,now(),now()) on conflict(user_id,quest_id,quest_date) do nothing;
    get diagnostics awarded=row_count; if awarded=1 then update public.profiles set xp=xp+quest_reward where id=member_uuid; end if;
  end if;
  select case when exists(select 1 from public.user_entitlements where profile_id=member_uuid and noir_until>now()) then 100 else 25 end into daily_limit;
  select coalesce(reply_count,0) into used_count from public.bot_reply_usage where profile_id=member_uuid and usage_date=(now() at time zone 'Europe/Istanbul')::date;
  return jsonb_build_object('allowed',true,'messageId',inserted.id,'createdAt',inserted.created_at,'remaining',greatest(daily_limit-used_count,0),'limit',daily_limit,'xpAwarded',case when awarded=1 then quest_reward else 0 end);
end;
$$;
revoke all on function public.send_bot_text_message_service(uuid,uuid,text,uuid) from public;
grant execute on function public.send_bot_text_message_service(uuid,uuid,text,uuid) to service_role;

create or replace function public.send_bot_audio_message_service(member_uuid uuid,match_uuid uuid,message_audio_path text,message_duration_ms integer,message_waveform smallint[],client_uuid uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare existing public.messages%rowtype; inserted public.messages%rowtype; quest_uuid uuid; quest_reward integer; awarded integer:=0; used_count integer:=0; daily_limit integer;
begin
  if auth.role()<>'service_role' then raise exception 'service_role_required'; end if;
  if client_uuid is null or message_duration_ms not between 500 and 60000 or cardinality(message_waveform) not between 8 and 48 then raise exception 'invalid_audio'; end if;
  if message_audio_path not like member_uuid::text||'/'||match_uuid::text||'/%' then raise exception 'invalid_audio_path'; end if;
  if not exists(select 1 from public.matches m join public.profiles p on p.id=case when m.user_a=member_uuid then m.user_b else m.user_a end where m.id=match_uuid and m.status='active' and member_uuid in(m.user_a,m.user_b) and p.kind='bot') then raise exception 'active_bot_match_required'; end if;
  select * into existing from public.messages where match_id=match_uuid and sender_id=member_uuid and client_message_id=client_uuid;
  if found then return jsonb_build_object('messageId',existing.id,'createdAt',existing.created_at,'duplicate',true); end if;
  insert into public.messages(match_id,sender_id,kind,audio_path,audio_duration_ms,audio_waveform,client_message_id) values(match_uuid,member_uuid,'audio',message_audio_path,message_duration_ms,message_waveform,client_uuid) returning * into inserted;
  update public.matches set last_message_at=inserted.created_at where id=match_uuid;
  select id,xp_reward into quest_uuid,quest_reward from public.daily_quests where slug='start-chat' and is_active limit 1;
  if quest_uuid is not null then
    insert into public.user_quest_progress(user_id,quest_id,quest_date,progress,completed_at,xp_claimed_at) values(member_uuid,quest_uuid,(now() at time zone 'Europe/Istanbul')::date,1,now(),now()) on conflict(user_id,quest_id,quest_date) do nothing;
    get diagnostics awarded=row_count; if awarded=1 then update public.profiles set xp=xp+quest_reward where id=member_uuid; end if;
  end if;
  select case when exists(select 1 from public.user_entitlements where profile_id=member_uuid and noir_until>now()) then 100 else 25 end into daily_limit;
  select coalesce(reply_count,0) into used_count from public.bot_reply_usage where profile_id=member_uuid and usage_date=(now() at time zone 'Europe/Istanbul')::date;
  return jsonb_build_object('allowed',true,'messageId',inserted.id,'createdAt',inserted.created_at,'remaining',greatest(daily_limit-used_count,0),'limit',daily_limit,'xpAwarded',case when awarded=1 then quest_reward else 0 end);
end;
$$;
revoke all on function public.send_bot_audio_message_service(uuid,uuid,text,integer,smallint[],uuid) from public;
grant execute on function public.send_bot_audio_message_service(uuid,uuid,text,integer,smallint[],uuid) to service_role;

create or replace function public.commit_bot_reply(
  job_uuid uuid, reply_body text, reply_provider text, reply_model text
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  reply_job public.bot_reply_jobs%rowtype;
  inserted_message public.messages%rowtype;
  today_tr date := (now() at time zone 'Europe/Istanbul')::date;
  used_count integer;
  daily_limit integer;
begin
  if auth.role() <> 'service_role' then raise exception 'service_role_required'; end if;
  if char_length(btrim(reply_body)) not between 1 and 1200 then raise exception 'invalid_reply'; end if;
  select * into reply_job from public.bot_reply_jobs where id=job_uuid and status='processing' for update;
  if not found then return jsonb_build_object('saved',false,'reason','job_unavailable'); end if;
  if reply_job.job_type='reply' then
    select case when exists(select 1 from public.user_entitlements where profile_id=reply_job.member_profile_id and noir_until>now()) then 100 else 25 end into daily_limit;
    insert into public.bot_reply_usage(profile_id,usage_date,reply_count) values(reply_job.member_profile_id,today_tr,0) on conflict(profile_id,usage_date) do nothing;
    select reply_count into used_count from public.bot_reply_usage where profile_id=reply_job.member_profile_id and usage_date=today_tr for update;
    if used_count>=daily_limit then
      update public.bot_reply_jobs set status='cancelled',cancellation_reason='quota_reached',completed_at=now(),updated_at=now() where id=job_uuid;
      return jsonb_build_object('saved',false,'reason','quota_reached','remaining',0);
    end if;
    update public.bot_reply_usage set reply_count=reply_count+1 where profile_id=reply_job.member_profile_id and usage_date=today_tr;
  else
    daily_limit := 0; used_count := -1;
  end if;
  insert into public.messages(match_id,sender_id,kind,body,ai_provider,ai_model)
  values(reply_job.match_id,reply_job.bot_profile_id,'text',btrim(reply_body),reply_provider,reply_model) returning * into inserted_message;
  update public.matches set last_message_at=inserted_message.created_at where id=reply_job.match_id;
  update public.bot_reply_jobs set status='sent',completed_at=inserted_message.created_at,updated_at=inserted_message.created_at where id=job_uuid;
  if reply_job.experiment_id is not null then
    update public.bot_experiment_assignments set sent_at=coalesce(sent_at,inserted_message.created_at)
    where experiment_id=reply_job.experiment_id and match_id=reply_job.match_id;
  end if;
  return jsonb_build_object('saved',true,'messageId',inserted_message.id,'createdAt',inserted_message.created_at,'remaining',case when reply_job.job_type='reply' then daily_limit-used_count-1 else null end);
end;
$$;
revoke all on function public.commit_bot_reply(uuid,text,text,text) from public;
grant execute on function public.commit_bot_reply(uuid,text,text,text) to service_role;

create or replace function public.publish_bot_persona_version(version_uuid uuid, actor_uuid uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare selected public.bot_persona_versions%rowtype;
begin
  if auth.role()<>'service_role' then raise exception 'service_role_required'; end if;
  select * into selected from public.bot_persona_versions where id=version_uuid for update;
  if not found then raise exception 'version_not_found'; end if;
  update public.bot_persona_versions set status='archived' where profile_id=selected.profile_id and status='published';
  update public.bot_persona_versions set status='published',published_by=actor_uuid,published_at=now() where id=version_uuid;
  update public.bot_personas set persona=selected.persona,provider=selected.provider,model=selected.model,updated_at=now() where profile_id=selected.profile_id;
  if not found then raise exception 'persona_not_found'; end if;
end;
$$;
revoke all on function public.publish_bot_persona_version(uuid,uuid) from public;
grant execute on function public.publish_bot_persona_version(uuid,uuid) to service_role;

do $$ begin
  if not exists (
    select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='matches'
  ) then alter publication supabase_realtime add table public.matches; end if;
end $$;
