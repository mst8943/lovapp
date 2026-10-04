-- Admin-managed manual payment channels and optional payment proof.

alter table public.payment_orders
  drop constraint if exists payment_orders_provider_check;
alter table public.payment_orders
  add constraint payment_orders_provider_check
  check (provider in ('shopier','bank_transfer','papara','crypto','manual'));

alter table public.payment_orders
  add column if not exists sender_full_name text,
  add column if not exists payment_date date,
  add column if not exists external_reference text,
  add column if not exists submitted_at timestamptz;

create table if not exists public.payment_method_settings (
  method text primary key check (method in ('bank_transfer','papara','crypto')),
  enabled boolean not null default false,
  account_name text,
  bank_name text,
  iban text,
  papara_number text,
  crypto_asset text,
  crypto_network text,
  wallet_address text,
  instructions text,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

insert into public.payment_method_settings(method)
values ('bank_transfer'), ('papara'), ('crypto')
on conflict (method) do nothing;

alter table public.payment_method_settings enable row level security;
revoke all on public.payment_method_settings from anon, authenticated;

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
  if payment_provider not in ('bank_transfer','papara','crypto','shopier') then raise exception 'invalid_provider'; end if;
  if payment_provider <> 'shopier' and not exists (
    select 1 from public.payment_method_settings
    where method = payment_provider and enabled
  ) then raise exception 'payment_method_unavailable'; end if;
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

create or replace function public.submit_manual_payment(
  order_uuid uuid,
  sender_name text,
  paid_on date,
  provider_reference text default null,
  object_path text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  buyer uuid := public.current_profile_id();
begin
  if buyer is null then raise exception 'profile_required'; end if;
  if char_length(btrim(sender_name)) not between 3 and 120 then raise exception 'invalid_sender'; end if;
  if paid_on is null or paid_on > current_date or paid_on < current_date - 30 then raise exception 'invalid_payment_date'; end if;
  if provider_reference is not null and char_length(btrim(provider_reference)) > 160 then raise exception 'invalid_reference'; end if;
  if object_path is not null and object_path not like buyer::text || '/' || order_uuid::text || '/%' then
    raise exception 'invalid_proof_path';
  end if;

  update public.payment_orders
    set sender_full_name = btrim(sender_name),
        payment_date = paid_on,
        external_reference = nullif(btrim(provider_reference), ''),
        proof_path = object_path,
        submitted_at = now(),
        status = 'under_review',
        updated_at = now()
  where id = order_uuid and profile_id = buyer
    and provider in ('bank_transfer','papara','crypto')
    and status in ('awaiting_payment','under_review');
  if not found then raise exception 'order_not_submittable'; end if;
end;
$$;

revoke all on function public.submit_manual_payment(uuid,text,date,text,text) from public;
grant execute on function public.submit_manual_payment(uuid,text,date,text,text) to authenticated;
