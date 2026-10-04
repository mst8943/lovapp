create table if not exists public.hidden_conversations (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (profile_id, match_id)
);
alter table public.hidden_conversations enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'hidden_conversations' and policyname = 'Users can view their own hidden conversations'
  ) then
    create policy "Users can view their own hidden conversations"
      on public.hidden_conversations for select
      to authenticated
      using (profile_id = public.current_profile_id());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'hidden_conversations' and policyname = 'Users can insert their own hidden conversations'
  ) then
    create policy "Users can insert their own hidden conversations"
      on public.hidden_conversations for insert
      to authenticated
      with check (profile_id = public.current_profile_id());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'hidden_conversations' and policyname = 'Users can delete their own hidden conversations'
  ) then
    create policy "Users can delete their own hidden conversations"
      on public.hidden_conversations for delete
      to authenticated
      using (profile_id = public.current_profile_id());
  end if;
end $$;
