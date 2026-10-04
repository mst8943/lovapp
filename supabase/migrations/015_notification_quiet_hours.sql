-- User-controlled quiet hours with durable deferred push delivery.

create table if not exists public.notification_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  quiet_hours_enabled boolean not null default true,
  quiet_start time not null default '23:00',
  quiet_end time not null default '09:00',
  timezone text not null default 'Europe/Istanbul',
  updated_at timestamptz not null default now()
);
create table if not exists public.deferred_push_notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  payload jsonb not null,
  deliver_at timestamptz not null,
  status text not null default 'queued' check (status in ('queued','sent','cancelled','failed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists deferred_push_due on public.deferred_push_notifications(status,deliver_at) where status='queued';
alter table public.notification_preferences enable row level security;
alter table public.deferred_push_notifications enable row level security;
create policy "users manage notification preferences" on public.notification_preferences for all to authenticated
using (profile_id=public.current_profile_id()) with check (profile_id=public.current_profile_id());
revoke all on public.deferred_push_notifications from anon, authenticated;
