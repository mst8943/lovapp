-- Harden payment authorization, checkout recovery and manual submission idempotency.

alter table public.payment_orders
  add column if not exists checkout_claimed_at timestamptz;

create or replace function public.create_noir_payment_order(plan_slug text, payment_provider text)
returns public.payment_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  buyer uuid := public.current_profile_id();
  selected_plan public.premium_plans%rowtype;
  existing_order public.payment_orders%rowtype;
  created_order public.payment_orders%rowtype;
begin
  if buyer is null then raise exception 'profile_required'; end if;
  if payment_provider not in ('bank_transfer','papara','crypto','shopier') then raise exception 'invalid_provider'; end if;
  if payment_provider <> 'shopier' and not exists (
    select 1 from public.payment_method_settings
    where method = payment_provider and enabled
  ) then raise exception 'payment_method_unavailable'; end if;

  select * into selected_plan
  from public.premium_plans
  where slug = plan_slug and is_active
  for share;
  if not found then raise exception 'plan_unavailable'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(buyer::text || ':' || selected_plan.id::text || ':' || payment_provider, 0)
  );

  select * into existing_order
  from public.payment_orders
  where profile_id = buyer
    and plan_id = selected_plan.id
    and provider = payment_provider
    and (
      (payment_provider = 'shopier' and status in ('awaiting_payment','pending'))
      or
      (payment_provider <> 'shopier' and status in ('awaiting_payment','under_review'))
    )
  order by created_at desc, id desc
  limit 1
  for update;
  if found then return existing_order; end if;

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
  local_today date := (pg_catalog.timezone('Europe/Istanbul', now()))::date;
begin
  if buyer is null then raise exception 'profile_required'; end if;
  if char_length(btrim(sender_name)) not between 3 and 120 then raise exception 'invalid_sender'; end if;
  if paid_on is null or paid_on > local_today or paid_on < local_today - 30 then raise exception 'invalid_payment_date'; end if;
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
    and status = 'awaiting_payment';
  if not found then raise exception 'order_not_submittable'; end if;
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
  if not public.has_admin_role(array['owner']) then raise exception 'owner_required'; end if;
  select * into selected_order from public.payment_orders where id = order_uuid for update;
  if not found then raise exception 'order_not_found'; end if;
  if selected_order.status = 'approved' then
    select noir_until into new_until from public.user_entitlements where profile_id = selected_order.profile_id;
    return new_until;
  end if;
  if selected_order.provider not in ('bank_transfer','papara','crypto','manual') then raise exception 'manual_provider_required'; end if;
  if selected_order.status <> 'under_review' then raise exception 'order_not_approvable'; end if;
  select duration_days into access_days from public.premium_plans where id = selected_order.plan_id;
  if access_days is null then raise exception 'plan_not_found'; end if;

  insert into public.user_entitlements(profile_id,noir_until,source,updated_at)
  values (selected_order.profile_id, now() + make_interval(days => access_days), 'payment:' || order_uuid::text, now())
  on conflict (profile_id) do update set
    noir_until = greatest(coalesce(public.user_entitlements.noir_until, now()), now()) + make_interval(days => access_days),
    source = 'payment:' || order_uuid::text,
    updated_at = now()
  returning noir_until into new_until;

  update public.payment_orders
  set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
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
  if not public.has_admin_role(array['owner']) then raise exception 'owner_required'; end if;
  if char_length(btrim(reason)) not between 3 and 500 then raise exception 'invalid_reason'; end if;
  update public.payment_orders
  set status = 'rejected', rejection_reason = btrim(reason), reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  where id = order_uuid
    and provider in ('bank_transfer','papara','crypto','manual')
    and status = 'under_review';
  if not found then raise exception 'order_not_rejectable'; end if;
  insert into public.admin_audit_log(actor_user_id,action,target_type,target_id,metadata)
  values (auth.uid(),'payment.rejected','payment_order',order_uuid::text,jsonb_build_object('reason',btrim(reason)));
end;
$$;

revoke all on function public.create_noir_payment_order(text,text) from public;
revoke all on function public.submit_manual_payment(uuid,text,date,text,text) from public;
revoke all on function public.approve_noir_payment(uuid) from public;
revoke all on function public.reject_noir_payment(uuid,text) from public;
grant execute on function public.create_noir_payment_order(text,text) to authenticated;
grant execute on function public.submit_manual_payment(uuid,text,date,text,text) to authenticated;
grant execute on function public.approve_noir_payment(uuid) to authenticated;
grant execute on function public.reject_noir_payment(uuid,text) to authenticated;
