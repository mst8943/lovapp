-- Curated membership applications. Public writes go through the server API;
-- only trusted service-role/admin paths can read or mutate applicant data.

create table if not exists public.membership_applications (
  id uuid primary key default gen_random_uuid(),
  application_code text unique not null default ('LVK-A-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  email text not null check (char_length(email) between 5 and 254),
  full_name text not null check (char_length(full_name) between 3 and 120),
  instagram_username text check (instagram_username is null or char_length(instagram_username) between 1 and 30),
  occupation text not null check (char_length(occupation) between 2 and 120),
  industry text not null check (char_length(industry) between 2 and 120),
  city text check (city is null or char_length(city) between 2 and 80),
  application_note text check (application_note is null or char_length(application_note) between 10 and 800),
  marketing_consent boolean not null default false,
  privacy_notice_version text not null,
  status text not null default 'submitted' check (status in ('submitted','reviewing','approved','rejected','invited','withdrawn')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 2000),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  invited_user_id uuid references auth.users(id),
  invited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists membership_applications_email_unique
  on public.membership_applications (lower(email));
create index if not exists membership_applications_review_queue
  on public.membership_applications (status, created_at asc);
create index if not exists membership_applications_profile_filter
  on public.membership_applications (industry, occupation);

alter table public.membership_applications enable row level security;
revoke all on public.membership_applications from anon, authenticated;

