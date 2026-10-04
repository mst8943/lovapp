-- Shopier card checkout correlation and idempotent webhook processing.

alter table public.payment_orders
  add column if not exists provider_checkout_id text,
  add column if not exists checkout_url text;

create unique index if not exists payment_orders_provider_checkout_unique
  on public.payment_orders(provider, provider_checkout_id)
  where provider_checkout_id is not null;

create table if not exists public.payment_webhook_events (
  webhook_id text primary key,
  provider text not null check (provider in ('shopier')),
  event_type text not null,
  provider_order_id text,
  payment_order_id uuid references public.payment_orders(id) on delete set null,
  payload_hash text not null,
  status text not null check (status in ('processed','ignored','failed')),
  error_code text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists payment_webhook_events_timeline
  on public.payment_webhook_events(received_at desc);

alter table public.payment_webhook_events enable row level security;
revoke all on public.payment_webhook_events from anon, authenticated;

create or replace function public.approve_verified_shopier_payment(
  order_uuid uuid,
  shopier_order_id text
)
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
  if auth.role() <> 'service_role' then raise exception 'service_role_required'; end if;
  if nullif(btrim(shopier_order_id), '') is null then raise exception 'provider_order_required'; end if;

  select * into selected_order from public.payment_orders where id = order_uuid for update;
  if not found then raise exception 'order_not_found'; end if;
  if selected_order.provider <> 'shopier' then raise exception 'provider_mismatch'; end if;

  if selected_order.status = 'approved' then
    if selected_order.provider_order_id is distinct from shopier_order_id then
      raise exception 'provider_order_mismatch';
    end if;
    select noir_until into new_until from public.user_entitlements where profile_id = selected_order.profile_id;
    return new_until;
  end if;

  if selected_order.status not in ('pending','awaiting_payment') then raise exception 'order_not_approvable'; end if;
  if exists (
    select 1 from public.payment_orders
    where provider = 'shopier' and provider_order_id = shopier_order_id and id <> order_uuid
  ) then raise exception 'provider_order_already_used'; end if;

  select duration_days into access_days from public.premium_plans where id = selected_order.plan_id;
  if access_days is null then raise exception 'plan_not_found'; end if;

  insert into public.user_entitlements(profile_id,noir_until,source,updated_at)
  values (
    selected_order.profile_id,
    now() + make_interval(days => access_days),
    'shopier:' || shopier_order_id,
    now()
  )
  on conflict (profile_id) do update set
    noir_until = greatest(coalesce(public.user_entitlements.noir_until, now()), now()) + make_interval(days => access_days),
    source = 'shopier:' || shopier_order_id,
    updated_at = now()
  returning noir_until into new_until;

  update public.payment_orders set
    status = 'approved',
    provider_order_id = shopier_order_id,
    reviewed_at = now(),
    updated_at = now()
  where id = order_uuid;

  return new_until;
end;
$$;

revoke all on function public.approve_verified_shopier_payment(uuid,text) from public;
grant execute on function public.approve_verified_shopier_payment(uuid,text) to service_role;
