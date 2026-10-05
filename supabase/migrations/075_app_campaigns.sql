-- Scheduled in-app campaign card with opt-in click measurement.
create table public.app_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 4 and 100),
  body text not null check (char_length(body) between 10 and 280),
  cta_label text not null check (char_length(cta_label) between 2 and 40),
  cta_path text not null check (cta_path ~ '^/[^/]'),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_active boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index app_campaigns_schedule on public.app_campaigns(starts_at, ends_at) where is_active;
create table public.app_campaign_clicks (
  campaign_id uuid not null references public.app_campaigns(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  click_date date not null,
  created_at timestamptz not null default now(),
  primary key (campaign_id, profile_id, click_date)
);
alter table public.app_campaigns enable row level security;
alter table public.app_campaign_clicks enable row level security;
create policy "active campaigns are visible" on public.app_campaigns
  for select to authenticated using (is_active and starts_at <= now() and ends_at > now());
revoke insert, update, delete on public.app_campaigns from anon, authenticated;
revoke all on public.app_campaign_clicks from anon, authenticated;
