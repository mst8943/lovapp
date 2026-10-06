-- Coupon definitions are drafts until a compatible checkout provider is connected.
create table public.noir_coupon_offers (
  id uuid primary key default gen_random_uuid(),
  code text unique not null check (code ~ '^[A-Z0-9-]{4,32}$'),
  label text not null check (char_length(label) between 2 and 120),
  plan_slug text not null references public.premium_plans(slug) on update cascade,
  discount_percent integer not null check (discount_percent between 1 and 90),
  max_redemptions integer check (max_redemptions between 1 and 100000),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
alter table public.noir_coupon_offers enable row level security;
revoke all on public.noir_coupon_offers from anon, authenticated;

create or replace function public.admin_noir_revenue_summary()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if auth.role() <> 'service_role' then raise exception 'service_role_required'; end if;
  select jsonb_build_object(
    'approvedOrders', count(*),
    'approvedTry', coalesce(sum(amount) filter (where currency = 'TRY'), 0),
    'last30Try', coalesce(sum(amount) filter (where currency = 'TRY' and coalesce(reviewed_at, created_at) >= now() - interval '30 days'), 0),
    'byMonth', (
      select coalesce(jsonb_agg(jsonb_build_object('month', month, 'amount', amount, 'orders', orders) order by month desc), '[]'::jsonb)
      from (
        select to_char(date_trunc('month', coalesce(reviewed_at, created_at) at time zone 'Europe/Istanbul'), 'YYYY-MM') as month,
          sum(amount) as amount, count(*) as orders
        from public.payment_orders
        where status = 'approved' and currency = 'TRY'
          and coalesce(reviewed_at, created_at) >= now() - interval '6 months'
        group by 1
      ) monthly
    )
  ) into result from public.payment_orders where status = 'approved';
  return result;
end;
$$;
revoke all on function public.admin_noir_revenue_summary() from public, anon, authenticated;
grant execute on function public.admin_noir_revenue_summary() to service_role;
