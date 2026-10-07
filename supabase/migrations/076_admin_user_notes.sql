-- Internal notes that admins attach to a member. Never exposed to members.
create table if not exists public.admin_user_notes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists admin_user_notes_profile_timeline on public.admin_user_notes(profile_id, created_at desc);

alter table public.admin_user_notes enable row level security;
-- No policies on purpose: only the server (service role) reads and writes notes.
revoke all on public.admin_user_notes from anon, authenticated;
