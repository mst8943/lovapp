-- User support inbox with auditable admin workflow.

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null check (char_length(subject) between 3 and 120),
  category text not null default 'other' check (category in ('account','payment','safety','technical','other')),
  status text not null default 'open' check (status in ('open','waiting','in_progress','closed')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  assigned_to uuid references public.admin_users(user_id),
  last_message_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_profile_id uuid references public.profiles(id) on delete set null,
  sender_admin_id uuid references public.admin_users(user_id) on delete set null,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  check ((sender_profile_id is not null)::integer + (sender_admin_id is not null)::integer = 1)
);

create index if not exists support_tickets_queue_idx on public.support_tickets(status,priority,last_message_at desc);
create index if not exists support_ticket_messages_ticket_idx on public.support_ticket_messages(ticket_id,created_at);

alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;

create policy "members read own support tickets" on public.support_tickets for select to authenticated
using (profile_id = public.current_profile_id() or public.has_admin_role(array['owner','support']));
create policy "members create own support tickets" on public.support_tickets for insert to authenticated
with check (profile_id = public.current_profile_id());
create policy "support admins update tickets" on public.support_tickets for update to authenticated
using (public.has_admin_role(array['owner','support'])) with check (public.has_admin_role(array['owner','support']));
create policy "participants read support messages" on public.support_ticket_messages for select to authenticated
using (exists(select 1 from public.support_tickets t where t.id = ticket_id and (t.profile_id = public.current_profile_id() or public.has_admin_role(array['owner','support']))));
create policy "members write own support messages" on public.support_ticket_messages for insert to authenticated
with check (sender_profile_id = public.current_profile_id() and exists(select 1 from public.support_tickets t where t.id = ticket_id and t.profile_id = public.current_profile_id() and t.status <> 'closed'));
create policy "support admins write messages" on public.support_ticket_messages for insert to authenticated
with check (sender_admin_id = auth.uid() and public.has_admin_role(array['owner','support']));

revoke all on public.support_tickets, public.support_ticket_messages from anon;

