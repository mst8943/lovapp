-- Lovask core schema (Supabase/PostgreSQL)
create extension if not exists pgcrypto;

create type public.profile_kind as enum ('human', 'bot');
create type public.swipe_direction as enum ('left', 'right', 'super');
create type public.message_kind as enum ('text', 'audio');
create type public.match_status as enum ('active', 'unmatched', 'blocked');

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  kind public.profile_kind not null default 'human',
  display_name text not null check (char_length(display_name) between 1 and 60),
  birth_date date not null,
  gender text not null,
  bio text,
  city text,
  xp integer not null default 0 check (xp >= 0),
  level integer generated always as (greatest(1, floor(sqrt(xp / 100.0))::integer + 1)) stored,
  is_verified boolean not null default false,
  is_discoverable boolean not null default true,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint adults_only check (birth_date <= current_date - interval '18 years'),
  constraint profile_identity check ((kind = 'human' and user_id is not null) or (kind = 'bot' and user_id is null))
);

create table public.profile_photos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  sort_order smallint not null default 0 check (sort_order between 0 and 8),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique(profile_id, sort_order)
);
create unique index one_primary_photo on public.profile_photos(profile_id) where is_primary;

create table public.intent_badges (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  label text unique not null,
  is_active boolean not null default true
);
create table public.profile_intentions (
  profile_id uuid references public.profiles(id) on delete cascade,
  badge_id uuid references public.intent_badges(id) on delete cascade,
  primary key(profile_id, badge_id)
);

create table public.icebreaker_prompts (
  id uuid primary key default gen_random_uuid(),
  prompt text unique not null,
  is_active boolean not null default true
);
create table public.profile_answers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  prompt_id uuid not null references public.icebreaker_prompts(id),
  answer text not null check (char_length(answer) between 1 and 240),
  sort_order smallint not null default 0,
  unique(profile_id, prompt_id)
);

create table public.bot_personas (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  persona text not null check (char_length(persona) between 20 and 8000),
  model text not null default 'gpt-5.6-luna',
  temperature numeric(3,2),
  greeting text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table public.swipes (
  id bigint generated always as identity primary key,
  swiper_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.profiles(id) on delete cascade,
  direction public.swipe_direction not null,
  created_at timestamptz not null default now(),
  unique(swiper_id, target_id),
  check(swiper_id <> target_id)
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  status public.match_status not null default 'active',
  matched_at timestamptz not null default now(),
  last_message_at timestamptz,
  check(user_a < user_b),
  unique(user_a, user_b)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  kind public.message_kind not null default 'text',
  body text,
  audio_path text,
  audio_duration_ms integer check(audio_duration_ms between 0 and 600000),
  ai_response_id text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check ((kind = 'text' and body is not null) or (kind = 'audio' and audio_path is not null))
);
create index messages_match_timeline on public.messages(match_id, created_at desc);

create table public.daily_quests (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  event_name text not null,
  target_count integer not null check(target_count > 0),
  xp_reward integer not null check(xp_reward > 0),
  is_active boolean not null default true
);
create table public.user_quest_progress (
  user_id uuid references public.profiles(id) on delete cascade,
  quest_id uuid references public.daily_quests(id) on delete cascade,
  quest_date date not null default current_date,
  progress integer not null default 0 check(progress >= 0),
  completed_at timestamptz,
  xp_claimed_at timestamptz,
  primary key(user_id, quest_id, quest_date)
);

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table public.blocks (
  blocker_id uuid references public.profiles(id) on delete cascade,
  blocked_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(blocker_id, blocked_id),
  check(blocker_id <> blocked_id)
);
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id),
  reported_id uuid not null references public.profiles(id),
  reason text not null,
  details text,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.admin_users where user_id = auth.uid());
$$;
create or replace function public.current_profile_id() returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.profiles where user_id = auth.uid() limit 1;
$$;
create or replace function public.in_match(match_uuid uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.matches where id = match_uuid and public.current_profile_id() in (user_a, user_b));
$$;

alter table public.profiles enable row level security;
alter table public.profile_photos enable row level security;
alter table public.profile_intentions enable row level security;
alter table public.profile_answers enable row level security;
alter table public.bot_personas enable row level security;
alter table public.swipes enable row level security;
alter table public.matches enable row level security;
alter table public.messages enable row level security;
alter table public.user_quest_progress enable row level security;
alter table public.admin_users enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;

create policy "discoverable profiles are visible" on public.profiles for select to authenticated using (is_discoverable or user_id = auth.uid() or public.is_admin());
create policy "users edit own profile" on public.profiles for all to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy "profile photos visible" on public.profile_photos for select to authenticated using (true);
create policy "owners manage photos" on public.profile_photos for all to authenticated using (profile_id = public.current_profile_id() or public.is_admin()) with check (profile_id = public.current_profile_id() or public.is_admin());
create policy "intentions visible" on public.profile_intentions for select to authenticated using (true);
create policy "owners manage intentions" on public.profile_intentions for all to authenticated using (profile_id = public.current_profile_id() or public.is_admin()) with check (profile_id = public.current_profile_id() or public.is_admin());
create policy "answers visible" on public.profile_answers for select to authenticated using (true);
create policy "owners manage answers" on public.profile_answers for all to authenticated using (profile_id = public.current_profile_id() or public.is_admin()) with check (profile_id = public.current_profile_id() or public.is_admin());
create policy "admins manage personas" on public.bot_personas for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "users manage own swipes" on public.swipes for all to authenticated using (swiper_id = public.current_profile_id() or public.is_admin()) with check (swiper_id = public.current_profile_id() or public.is_admin());
create policy "members see matches" on public.matches for select to authenticated using (public.current_profile_id() in (user_a,user_b) or public.is_admin());
create policy "members see messages" on public.messages for select to authenticated using (public.in_match(match_id) or public.is_admin());
create policy "members send messages" on public.messages for insert to authenticated with check (sender_id = public.current_profile_id() and public.in_match(match_id));
create policy "users see quest progress" on public.user_quest_progress for select to authenticated using (user_id = public.current_profile_id() or public.is_admin());
create policy "users create quest progress" on public.user_quest_progress for insert to authenticated with check (user_id = public.current_profile_id());
create policy "admins visible to admins" on public.admin_users for select to authenticated using (public.is_admin());
create policy "users manage blocks" on public.blocks for all to authenticated using (blocker_id = public.current_profile_id()) with check (blocker_id = public.current_profile_id());
create policy "users create reports" on public.reports for insert to authenticated with check (reporter_id = public.current_profile_id());
create policy "admins review reports" on public.reports for select to authenticated using (public.is_admin());

insert into public.intent_badges(slug,label) values ('serious','Ciddi düşünüyor'),('fun','Eğlence arıyor'),('adventure','Maceracı'),('coffee','Kahve sever'),('night-owl','Gece kuşu'),('live-music','Canlı müzik'),('foodie','Yeni tatlar'),('travel','Seyahat tutkunu') on conflict do nothing;
insert into public.icebreaker_prompts(prompt) values ('En gizli yeteneğim…'),('Benimle çıkmanın küçük bir lüksü…'),('Beni etkilemenin en kısa yolu…'),('Birlikte mutlaka denemeliyiz…') on conflict do nothing;
insert into public.daily_quests(slug,title,event_name,target_count,xp_reward) values ('three-right-swipes','3 kişiye kalbini aç','right_swipe',3,120),('start-chat','Bir sohbet başlat','message_sent',1,80),('polish-profile','Profiline bir dokunuş ekle','profile_updated',1,60) on conflict do nothing;
