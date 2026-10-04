create table public.profile_stories (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  constraint story_lifetime check (expires_at > created_at and expires_at <= created_at + interval '24 hours')
);

create index profile_stories_active on public.profile_stories(profile_id, expires_at desc);
alter table public.profile_stories enable row level security;
revoke all on public.profile_stories from anon, authenticated;
