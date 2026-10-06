-- Private date plans and voluntary check-ins. Sharing is initiated by the member's device.
create table public.private_date_plans (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  venue text not null check (char_length(venue) between 2 and 160),
  city text not null check (char_length(city) between 2 and 80),
  starts_at timestamptz not null,
  expected_end_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'checked_in', 'completed', 'cancelled')),
  checked_in_at timestamptz,
  feedback_rating integer check (feedback_rating between 1 and 5),
  feedback_note text check (char_length(feedback_note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expected_end_at > starts_at)
);
create index private_date_plans_owner_timeline on public.private_date_plans(profile_id, starts_at desc);
alter table public.private_date_plans enable row level security;
create policy "members see own date plans" on public.private_date_plans
  for select to authenticated using (
    exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = auth.uid() and p.kind = 'human')
  );
revoke insert, update, delete on public.private_date_plans from anon, authenticated;
