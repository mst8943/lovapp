-- A genuine, one-time Lemon Squeezy product can grant a short Noir entitlement.
alter table public.premium_plans
  add column if not exists duration_minutes integer check (duration_minutes is null or duration_minutes between 1 and 525600);

insert into public.premium_plans(slug,name,duration_days,duration_minutes,price_amount,currency,is_active)
values ('noir-hourly','1 Saatlik Noir',1,60,24.50,'TRY',true)
on conflict (slug) do update set
  name=excluded.name,
  duration_days=excluded.duration_days,
  duration_minutes=excluded.duration_minutes,
  price_amount=excluded.price_amount,
  currency=excluded.currency,
  is_active=excluded.is_active,
  updated_at=now();

create or replace function public.approve_verified_shopier_payment(order_uuid uuid, shopier_order_id text)
returns timestamptz language plpgsql security definer set search_path=''
as $$
declare
  selected_order public.payment_orders%rowtype;
  access_days integer;
  access_minutes integer;
  new_until timestamptz;
begin
  if auth.role() <> 'service_role' then raise exception 'service_role_required'; end if;
  if nullif(btrim(shopier_order_id), '') is null then raise exception 'provider_order_required'; end if;
  select * into selected_order from public.payment_orders where id=order_uuid for update;
  if not found then raise exception 'order_not_found'; end if;
  if selected_order.provider <> 'shopier' then raise exception 'provider_mismatch'; end if;
  if selected_order.status='approved' then
    if selected_order.provider_order_id is distinct from shopier_order_id then raise exception 'provider_order_mismatch'; end if;
    select noir_until into new_until from public.user_entitlements where profile_id=selected_order.profile_id;
    return new_until;
  end if;
  if selected_order.status not in ('pending','awaiting_payment') then raise exception 'order_not_approvable'; end if;
  if exists(select 1 from public.payment_orders where provider='shopier' and provider_order_id=shopier_order_id and id<>order_uuid) then raise exception 'provider_order_already_used'; end if;
  select duration_days,duration_minutes into access_days,access_minutes from public.premium_plans where id=selected_order.plan_id;
  if access_days is null then raise exception 'plan_not_found'; end if;
  insert into public.user_entitlements(profile_id,noir_until,source,updated_at)
  values (selected_order.profile_id,now()+case when access_minutes is null then make_interval(days=>access_days) else make_interval(mins=>access_minutes) end,'shopier:'||shopier_order_id,now())
  on conflict(profile_id) do update set
    noir_until=greatest(coalesce(public.user_entitlements.noir_until,now()),now())+case when access_minutes is null then make_interval(days=>access_days) else make_interval(mins=>access_minutes) end,
    source='shopier:'||shopier_order_id,updated_at=now()
  returning noir_until into new_until;
  update public.payment_orders set status='approved',provider_order_id=shopier_order_id,reviewed_at=now(),updated_at=now() where id=order_uuid;
  return new_until;
end;
$$;

create or replace function public.approve_noir_payment(order_uuid uuid)
returns timestamptz language plpgsql security definer set search_path=''
as $$
declare
  selected_order public.payment_orders%rowtype;
  access_days integer;
  access_minutes integer;
  new_until timestamptz;
begin
  if not public.has_admin_role(array['owner']) then raise exception 'owner_required'; end if;
  select * into selected_order from public.payment_orders where id=order_uuid for update;
  if not found then raise exception 'order_not_found'; end if;
  if selected_order.status='approved' then select noir_until into new_until from public.user_entitlements where profile_id=selected_order.profile_id; return new_until; end if;
  if selected_order.provider not in ('bank_transfer','papara','crypto','manual') then raise exception 'manual_provider_required'; end if;
  if selected_order.status<>'under_review' then raise exception 'order_not_approvable'; end if;
  select duration_days,duration_minutes into access_days,access_minutes from public.premium_plans where id=selected_order.plan_id;
  if access_days is null then raise exception 'plan_not_found'; end if;
  insert into public.user_entitlements(profile_id,noir_until,source,updated_at)
  values (selected_order.profile_id,now()+case when access_minutes is null then make_interval(days=>access_days) else make_interval(mins=>access_minutes) end,'payment:'||order_uuid::text,now())
  on conflict(profile_id) do update set
    noir_until=greatest(coalesce(public.user_entitlements.noir_until,now()),now())+case when access_minutes is null then make_interval(days=>access_days) else make_interval(mins=>access_minutes) end,
    source='payment:'||order_uuid::text,updated_at=now()
  returning noir_until into new_until;
  update public.payment_orders set status='approved',reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=order_uuid;
  insert into public.admin_audit_log(actor_user_id,action,target_type,target_id,metadata) values(auth.uid(),'payment.approved','payment_order',order_uuid::text,jsonb_build_object('profileId',selected_order.profile_id,'noirUntil',new_until));
  return new_until;
end;
$$;

revoke all on function public.approve_verified_shopier_payment(uuid,text) from public;
grant execute on function public.approve_verified_shopier_payment(uuid,text) to service_role;
revoke all on function public.approve_noir_payment(uuid) from public;
grant execute on function public.approve_noir_payment(uuid) to authenticated;
