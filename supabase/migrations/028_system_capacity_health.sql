create table if not exists public.system_capacity_settings (
  id boolean primary key default true check (id),
  database_limit_bytes bigint not null default 524288000 check (database_limit_bytes > 0),
  storage_limit_bytes bigint not null default 1073741824 check (storage_limit_bytes > 0),
  updated_by uuid references public.admin_users(user_id),
  updated_at timestamptz not null default now()
);
insert into public.system_capacity_settings(id) values(true) on conflict(id) do nothing;
alter table public.system_capacity_settings enable row level security;
create policy "owners manage capacity settings" on public.system_capacity_settings for all to authenticated
using (public.has_admin_role(array['owner'])) with check (public.has_admin_role(array['owner']));

create or replace function public.get_system_health_snapshot()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if auth.role() <> 'service_role' and not public.has_admin_role(array['owner']) then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'databaseBytes', pg_database_size(current_database()),
    'storageBytes', coalesce((select sum((metadata->>'size')::bigint) from storage.objects where metadata ? 'size'),0),
    'storageObjects', (select count(*) from storage.objects),
    'storageBuckets', (select count(*) from storage.buckets),
    'legacyProfileRows', (select count(*) from public.profile_photos where storage_path !~* '\.webp$' or coalesce(variants::text,'') ~* '\.(jpe?g|png|heic|heif)'),
    'failedBotJobs', (select count(*) from public.bot_reply_jobs where status='failed'),
    'queuedBotJobs', (select count(*) from public.bot_reply_jobs where status in ('queued','typing','processing')),
    'openSupportTickets', (select count(*) from public.support_tickets where status <> 'closed'),
    'pendingPhotos', (select count(*) from public.profile_photos where processing_status='ready' and moderation_status='pending'),
    'largestTables', coalesce((select jsonb_agg(x order by (x->>'bytes')::bigint desc) from (select jsonb_build_object('name',relname,'bytes',pg_total_relation_size(relid),'rows',n_live_tup) x from pg_stat_user_tables order by pg_total_relation_size(relid) desc limit 8) q),'[]'::jsonb)
  ) into result;
  return result;
end; $$;
revoke all on function public.get_system_health_snapshot() from public;
grant execute on function public.get_system_health_snapshot() to authenticated, service_role;
revoke all on public.system_capacity_settings from anon;

