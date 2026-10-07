-- 077: daily question, member endorsements, date-plan safety check-ins, credit ledger,
-- AI profile coach usage and the daily bulletin log. Server-side writes only; RLS stays on.

-- Daily question: one answer per member per day; the question text lives in application code.
create table if not exists public.daily_question_answers (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  question_date date not null,
  question_key text not null check (char_length(question_key) between 1 and 60),
  option_index smallint not null check (option_index between 0 and 3),
  answered_at timestamptz not null default now(),
  primary key (profile_id, question_date)
);
create index if not exists daily_question_answers_day_option
  on public.daily_question_answers(question_date, question_key, option_index);
alter table public.daily_question_answers enable row level security;
drop policy if exists "members see own daily answers" on public.daily_question_answers;
create policy "members see own daily answers" on public.daily_question_answers
  for select to authenticated using (profile_id = public.current_profile_id());
revoke insert, update, delete on public.daily_question_answers from anon, authenticated;

-- Positive-only endorsements members leave for people they matched with.
create table if not exists public.member_endorsements (
  id uuid primary key default gen_random_uuid(),
  from_profile_id uuid not null references public.profiles(id) on delete cascade,
  to_profile_id uuid not null references public.profiles(id) on delete cascade,
  badge text not null check (badge in ('kind', 'looks_like_photos', 'great_listener', 'funny', 'respectful', 'on_time')),
  created_at timestamptz not null default now(),
  unique (from_profile_id, to_profile_id, badge),
  check (from_profile_id <> to_profile_id)
);
create index if not exists member_endorsements_recipient on public.member_endorsements(to_profile_id, badge);
alter table public.member_endorsements enable row level security;
revoke all on public.member_endorsements from anon, authenticated;

-- Safety check-in for private date plans: prompt at the end time, alert the emergency contact later.
alter table public.private_date_plans
  add column if not exists emergency_contact_name text check (char_length(emergency_contact_name) <= 80),
  add column if not exists emergency_contact_phone text check (emergency_contact_phone ~ '^\+?[0-9]{10,15}$'),
  add column if not exists safety_prompted_at timestamptz,
  add column if not exists safe_confirmed_at timestamptz,
  add column if not exists emergency_notified_at timestamptz;
create index if not exists private_date_plans_safety_due
  on public.private_date_plans(expected_end_at)
  where status in ('scheduled', 'checked_in') and safe_confirmed_at is null;

-- Credits: an append-only ledger. Balances are always the sum of the ledger.
create table if not exists public.credit_ledger (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('boost', 'super_like', 'profile_unlock')),
  delta integer not null check (delta <> 0),
  reason text not null check (char_length(reason) between 2 and 120),
  granted_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists credit_ledger_balance on public.credit_ledger(profile_id, kind);
alter table public.credit_ledger enable row level security;
drop policy if exists "members see own credits" on public.credit_ledger;
create policy "members see own credits" on public.credit_ledger
  for select to authenticated using (profile_id = public.current_profile_id());
revoke insert, update, delete on public.credit_ledger from anon, authenticated;

create or replace function public.credit_balance(p_profile uuid, p_kind text)
returns integer language sql stable security definer set search_path = ''
as $$ select coalesce(sum(delta), 0)::integer from public.credit_ledger where profile_id = p_profile and kind = p_kind; $$;
revoke all on function public.credit_balance(uuid, text) from public, anon, authenticated;

-- Spends one boost credit for the signed-in member and starts a 30-minute boost.
-- Returns {"error":"no_credit"} when the balance is empty; never double-spends while a boost is running.
create or replace function public.use_boost_credit()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare viewer public.profiles%rowtype; state jsonb; started timestamptz := now();
begin
  select * into viewer from public.profiles where id = public.current_profile_id() and kind = 'human' for update;
  if not found then raise exception 'profile_required'; end if;
  state := public.profile_boost_status();
  if state->>'activeUntil' is not null then return state; end if;
  if not coalesce((state->>'eligible')::boolean, false) then return jsonb_build_object('error', 'not_eligible'); end if;
  if public.credit_balance(viewer.id, 'boost') <= 0 then return jsonb_build_object('error', 'no_credit'); end if;
  insert into public.credit_ledger(profile_id, kind, delta, reason) values (viewer.id, 'boost', -1, 'Boost kullanıldı');
  insert into public.profile_boosts(profile_id, started_at, expires_at)
  values (viewer.id, started, started + interval '30 minutes')
  on conflict (profile_id) do update set started_at = excluded.started_at, expires_at = excluded.expires_at;
  insert into public.product_funnel_events(event_name, profile_id, subject_id) values ('boost_activated', viewer.id, viewer.id);
  return public.profile_boost_status();
end;
$$;
revoke all on function public.use_boost_credit() from public;
grant execute on function public.use_boost_credit() to authenticated;

-- AI profile coach usage (daily limit is enforced by the API).
create table if not exists public.profile_coach_runs (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists profile_coach_runs_recent on public.profile_coach_runs(profile_id, created_at desc);
alter table public.profile_coach_runs enable row level security;
revoke all on public.profile_coach_runs from anon, authenticated;

-- Daily bulletin: at most one push per member per day, with an opt-out.
create table if not exists public.daily_bulletin_log (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  sent_on date not null,
  primary key (profile_id, sent_on)
);
alter table public.daily_bulletin_log enable row level security;
revoke all on public.daily_bulletin_log from anon, authenticated;
alter table public.notification_preferences add column if not exists daily_bulletin boolean not null default true;
