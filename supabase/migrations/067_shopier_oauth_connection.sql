-- Keep seller OAuth tokens encrypted at the application layer and unavailable to clients.
create table if not exists public.shopier_connection (
  id boolean primary key default true check (id),
  encrypted_config text not null,
  updated_at timestamptz not null default now()
);
alter table public.shopier_connection enable row level security;
revoke all on public.shopier_connection from anon, authenticated;
