create table if not exists public.admin_resource_reads (
  admin_user_id uuid not null references public.admin_users(user_id) on delete cascade,
  resource text not null check (resource in ('users')),
  seen_at timestamptz not null default now(),
  primary key(admin_user_id,resource)
);
alter table public.admin_resource_reads enable row level security;
create policy "admins manage own resource reads" on public.admin_resource_reads for all to authenticated
using (admin_user_id = auth.uid()) with check (admin_user_id = auth.uid());
revoke all on public.admin_resource_reads from anon;

