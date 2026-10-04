-- Phase 3: controlled takeover, fallback, risk review, persona versions and experiments.

alter table public.bot_conversation_controls drop constraint if exists bot_conversation_controls_mode_check;
alter table public.bot_conversation_controls
  add constraint bot_conversation_controls_mode_check check (mode in ('ai','admin','paused')),
  add column if not exists takeover_expires_at timestamptz,
  add column if not exists auto_return_to_ai boolean not null default true,
  add column if not exists pause_reason text;

alter table public.bot_reply_jobs add column if not exists fallback_sent_at timestamptz;

create table if not exists public.bot_fallback_templates (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 3 and 240),
  is_active boolean not null default true,
  created_by uuid references public.admin_users(user_id),
  created_at timestamptz not null default now()
);
create unique index if not exists bot_fallback_template_unique on public.bot_fallback_templates(coalesce(profile_id,'00000000-0000-0000-0000-000000000000'::uuid),body);
insert into public.bot_fallback_templates(body) values
  ('Bir işim çıktı, birazdan daha rahat yazacağım.'),
  ('Şimdi biraz yoğunum, az sonra döneyim.'),
  ('Bir şeye bakmam gerekiyor, biraz bekletiyorum seni.')
on conflict do nothing;

create table if not exists public.bot_risk_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  message_id uuid references public.messages(id) on delete set null,
  category text not null,
  severity text not null check (severity in ('low','medium','high')),
  score numeric(5,4),
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  reviewed_by uuid references public.admin_users(user_id),
  reviewed_at timestamptz,
  resolution text,
  created_at timestamptz not null default now()
);
create index if not exists bot_risk_review_queue on public.bot_risk_events(status,severity,created_at);

create table if not exists public.bot_persona_versions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  version_number integer not null,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  persona text not null check (char_length(persona) between 20 and 8000),
  provider text not null default 'inherit' check (provider in ('inherit','openai','openrouter','deepseek','gemini')),
  model text not null,
  created_by uuid references public.admin_users(user_id),
  published_by uuid references public.admin_users(user_id),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique(profile_id,version_number)
);
insert into public.bot_persona_versions(profile_id,version_number,status,persona,provider,model,created_by,published_at)
select profile_id,1,'published',persona,provider,model,created_by,updated_at from public.bot_personas
on conflict(profile_id,version_number) do nothing;

create table if not exists public.bot_experiments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 3 and 120),
  status text not null default 'draft' check (status in ('draft','running','paused','completed')),
  traffic_percent integer not null default 20 check (traffic_percent between 1 and 100),
  control_config jsonb not null default '{}'::jsonb,
  variant_config jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  ended_at timestamptz,
  created_by uuid references public.admin_users(user_id),
  created_at timestamptz not null default now()
);

alter table public.bot_fallback_templates enable row level security;
alter table public.bot_risk_events enable row level security;
alter table public.bot_persona_versions enable row level security;
alter table public.bot_experiments enable row level security;
create policy "bot editors manage fallback templates" on public.bot_fallback_templates for all to authenticated
using (public.has_admin_role(array['owner','bot_editor'])) with check (public.has_admin_role(array['owner','bot_editor']));
create policy "moderators review bot risk" on public.bot_risk_events for all to authenticated
using (public.has_admin_role(array['owner','moderator','support'])) with check (public.has_admin_role(array['owner','moderator','support']));
create policy "bot editors manage persona versions" on public.bot_persona_versions for all to authenticated
using (public.has_admin_role(array['owner','bot_editor'])) with check (public.has_admin_role(array['owner','bot_editor']));
create policy "bot editors manage experiments" on public.bot_experiments for all to authenticated
using (public.has_admin_role(array['owner','bot_editor'])) with check (public.has_admin_role(array['owner','bot_editor']));

revoke all on public.bot_fallback_templates from anon;
revoke all on public.bot_risk_events from anon;
revoke all on public.bot_persona_versions from anon;
revoke all on public.bot_experiments from anon;
