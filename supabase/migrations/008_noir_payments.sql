-- Fixed-term Noir access and auditable, idempotent payment approval.

create table if not exists public.premium_plans (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9-]+$'),
  name text not null check (char_length(name) between 2 and 80),
  duration_days integer not null check (duration_days between 1 and 365),
  price_amount numeric(10,2) not null check (price_amount > 0),
  currency text not null default 'TRY' check (currency ~ '^[A-Z]{3}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  plan_id uuid not null references public.premium_plans(id) on delete restrict,
  provider text not null check (provider in ('shopier','bank_transfer','manual')),
  amount numeric(10,2) not null check (amount > 0),
  currency text not null default 'TRY' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'awaiting_payment' check (status in (
    'pending','awaiting_payment','under_review','approved','rejected','cancelled','expired'
  )),
  provider_order_id text,
  payment_reference text unique not null,
  proof_path text,
  rejection_reason text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists payment_orders_provider_id_unique
  on public.payment_orders(provider, provider_order_id) where provider_order_id is not null;
create index if not exists payment_orders_profile_timeline on public.payment_orders(profile_id, created_at desc);
create index if not exists payment_orders_review_queue on public.payment_orders(status, created_at asc);

insert into public.premium_plans(slug,name,duration_days,price_amount,currency)
values
  ('noir-weekly','Haftalık Noir',7,199.00,'TRY'),
  ('noir-monthly','Aylık Noir',30,599.00,'TRY')
on conflict (slug) do update set
  name = excluded.name,
  duration_days = excluded.duration_days,
  price_amount = excluded.price_amount,
  currency = excluded.currency,
  updated_at = now();

alter table public.premium_plans enable row level security;
alter table public.payment_orders enable row level security;

create policy "active plans are visible" on public.premium_plans for select to authenticated using (is_active);
create policy "owners see payment orders" on public.payment_orders for select to authenticated
using (profile_id = public.current_profile_id() or public.has_admin_role(array['owner','support']));

revoke insert, update, delete on public.payment_orders from anon, authenticated;
revoke insert, update, delete on public.premium_plans from anon, authenticated;

create or replace function public.create_noir_payment_order(plan_slug text, payment_provider text)
returns public.payment_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  buyer uuid := public.current_profile_id();
  selected_plan public.premium_plans%rowtype;
  created_order public.payment_orders%rowtype;
begin
  if buyer is null then raise exception 'profile_required'; end if;
  if payment_provider not in ('bank_transfer','shopier') then raise exception 'invalid_provider'; end if;
  select * into selected_plan from public.premium_plans where slug = plan_slug and is_active for share;
  if not found then raise exception 'plan_unavailable'; end if;

  insert into public.payment_orders(profile_id,plan_id,provider,amount,currency,payment_reference)
  values (
    buyer, selected_plan.id, payment_provider, selected_plan.price_amount, selected_plan.currency,
    'LVK-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))
  ) returning * into created_order;
  return created_order;
end;
$$;

create or replace function public.submit_noir_payment_proof(order_uuid uuid, object_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  buyer uuid := public.current_profile_id();
begin
  if buyer is null then raise exception 'profile_required'; end if;
  if object_path not like buyer::text || '/' || order_uuid::text || '/%' then raise exception 'invalid_proof_path'; end if;
  update public.payment_orders
    set proof_path = object_path, status = 'under_review', updated_at = now()
  where id = order_uuid and profile_id = buyer and provider = 'bank_transfer'
    and status in ('awaiting_payment','under_review');
  if not found then raise exception 'order_not_uploadable'; end if;
end;
$$;

create or replace function public.approve_noir_payment(order_uuid uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_order public.payment_orders%rowtype;
  access_days integer;
  new_until timestamptz;
begin
  if not public.has_admin_role(array['owner','support']) then raise exception 'admin_required'; end if;
  select * into selected_order from public.payment_orders where id = order_uuid for update;
  if not found then raise exception 'order_not_found'; end if;
  if selected_order.status = 'approved' then
    select noir_until into new_until from public.user_entitlements where profile_id = selected_order.profile_id;
    return new_until;
  end if;
  if selected_order.status not in ('under_review','pending') then raise exception 'order_not_approvable'; end if;
  select duration_days into access_days from public.premium_plans where id = selected_order.plan_id;

  insert into public.user_entitlements(profile_id,noir_until,source,updated_at)
  values (selected_order.profile_id, now() + make_interval(days => access_days), 'payment:' || order_uuid::text, now())
  on conflict (profile_id) do update set
    noir_until = greatest(coalesce(public.user_entitlements.noir_until, now()), now()) + make_interval(days => access_days),
    source = 'payment:' || order_uuid::text,
    updated_at = now()
  returning noir_until into new_until;

  update public.payment_orders set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  where id = order_uuid;
  insert into public.admin_audit_log(actor_user_id,action,target_type,target_id,metadata)
  values (auth.uid(),'payment.approved','payment_order',order_uuid::text,jsonb_build_object('profileId',selected_order.profile_id,'noirUntil',new_until));
  return new_until;
end;
$$;

create or replace function public.reject_noir_payment(order_uuid uuid, reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_admin_role(array['owner','support']) then raise exception 'admin_required'; end if;
  if char_length(btrim(reason)) not between 3 and 500 then raise exception 'invalid_reason'; end if;
  update public.payment_orders set status = 'rejected', rejection_reason = btrim(reason), reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  where id = order_uuid and status in ('under_review','pending');
  if not found then raise exception 'order_not_rejectable'; end if;
  insert into public.admin_audit_log(actor_user_id,action,target_type,target_id,metadata)
  values (auth.uid(),'payment.rejected','payment_order',order_uuid::text,jsonb_build_object('reason',btrim(reason)));
end;
$$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('payment-proofs','payment-proofs',false,5242880,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

revoke all on function public.create_noir_payment_order(text,text) from public;
revoke all on function public.submit_noir_payment_proof(uuid,text) from public;
revoke all on function public.approve_noir_payment(uuid) from public;
revoke all on function public.reject_noir_payment(uuid,text) from public;
grant execute on function public.create_noir_payment_order(text,text) to authenticated;
grant execute on function public.submit_noir_payment_proof(uuid,text) to authenticated;
grant execute on function public.approve_noir_payment(uuid) to authenticated;
grant execute on function public.reject_noir_payment(uuid,text) to authenticated;
