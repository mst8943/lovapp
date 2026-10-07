-- 078: in-app voice and video calls (WebRTC signaling). The media never touches the database or the app server;
-- only the call record and the short-lived offer/answer/ICE messages do. Writes go through the API (service role).

create table if not exists public.call_sessions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  caller_id uuid not null references public.profiles(id) on delete cascade,
  callee_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('audio', 'video')),
  status text not null default 'ringing' check (status in ('ringing', 'accepted', 'declined', 'cancelled', 'missed', 'ended')),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz,
  check (caller_id <> callee_id)
);
create index if not exists call_sessions_callee_recent on public.call_sessions(callee_id, status, created_at desc);
create index if not exists call_sessions_caller_recent on public.call_sessions(caller_id, created_at desc);
create index if not exists call_sessions_match_recent on public.call_sessions(match_id, created_at desc);

create table if not exists public.call_signals (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.call_sessions(id) on delete cascade,
  from_profile_id uuid not null references public.profiles(id) on delete cascade,
  to_profile_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('offer', 'answer', 'ice')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists call_signals_session_order on public.call_signals(session_id, id);
create index if not exists call_signals_age on public.call_signals(created_at);

alter table public.call_sessions enable row level security;
alter table public.call_signals enable row level security;
drop policy if exists "participants see their calls" on public.call_sessions;
create policy "participants see their calls" on public.call_sessions
  for select to authenticated using (public.current_profile_id() in (caller_id, callee_id));
drop policy if exists "recipients see their call signals" on public.call_signals;
create policy "recipients see their call signals" on public.call_signals
  for select to authenticated using (to_profile_id = public.current_profile_id());
revoke insert, update, delete on public.call_sessions from anon, authenticated;
revoke insert, update, delete on public.call_signals from anon, authenticated;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'call_sessions')
    then alter publication supabase_realtime add table public.call_sessions; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'call_signals')
    then alter publication supabase_realtime add table public.call_signals; end if;
end $$;

-- Members can switch incoming calls off entirely.
alter table public.notification_preferences add column if not exists calls_enabled boolean not null default true;
