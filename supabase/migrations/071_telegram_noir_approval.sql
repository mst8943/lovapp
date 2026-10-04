-- Owner-confirmed Shopier payment from the private Hermes Telegram command.
create or replace function public.approve_noir_payment_telegram(
  order_uuid uuid,
  shopier_order_number text,
  verified_amount numeric
)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  selected_order public.payment_orders%rowtype;
  actor uuid;
  access_days integer;
  access_minutes integer;
  new_until timestamptz;
begin
  if auth.role() <> 'service_role' then raise exception 'service_role_required'; end if;
  select user_id into actor from public.admin_users where role = 'owner' order by created_at limit 1;
  if actor is null then raise exception 'owner_not_found'; end if;
  select * into selected_order from public.payment_orders where id = order_uuid for update;
  if not found or selected_order.provider <> 'shopier' or selected_order.status <> 'under_review' then
    raise exception 'order_not_approvable';
  end if;
  if nullif(btrim(shopier_order_number), '') is null
     or selected_order.external_reference <> btrim(shopier_order_number)
     or selected_order.amount <> verified_amount then
    raise exception 'payment_details_mismatch';
  end if;
  select duration_days, duration_minutes into access_days, access_minutes
    from public.premium_plans where id = selected_order.plan_id;
  if access_days is null then raise exception 'plan_not_found'; end if;
  insert into public.user_entitlements(profile_id,noir_until,source,updated_at)
  values (selected_order.profile_id,
    now() + case when access_minutes is null then make_interval(days => access_days) else make_interval(mins => access_minutes) end,
    'payment:' || order_uuid::text, now())
  on conflict(profile_id) do update set
    noir_until = greatest(coalesce(public.user_entitlements.noir_until, now()), now())
      + case when access_minutes is null then make_interval(days => access_days) else make_interval(mins => access_minutes) end,
    source = 'payment:' || order_uuid::text, updated_at = now()
  returning noir_until into new_until;
  update public.payment_orders set status = 'approved', reviewed_by = actor,
    reviewed_at = now(), updated_at = now() where id = order_uuid;
  insert into public.admin_audit_log(actor_user_id,action,target_type,target_id,metadata)
  values (actor,'payment.approved.telegram','payment_order',order_uuid::text,
    jsonb_build_object('profileId',selected_order.profile_id,'noirUntil',new_until,
      'shopierOrderNumber',selected_order.external_reference,'verifiedAmount',verified_amount));
  return new_until;
end;
$$;
revoke all on function public.approve_noir_payment_telegram(uuid,text,numeric) from public;
grant execute on function public.approve_noir_payment_telegram(uuid,text,numeric) to service_role;
