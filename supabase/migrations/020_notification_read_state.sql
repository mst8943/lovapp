-- Persist notification cursors without mutating the underlying like events.

create table if not exists public.notification_read_state (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  likes_seen_at timestamptz not null default 'epoch',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_read_state enable row level security;

create policy "users manage own notification read state"
on public.notification_read_state for all to authenticated
using (profile_id = public.current_profile_id())
with check (profile_id = public.current_profile_id());

