-- Reuse one open Shopier checkout per profile and plan.

with ranked_open_shopier_orders as (
  select
    id,
    row_number() over (
      partition by profile_id, plan_id, provider
      order by created_at desc, id desc
    ) as position
  from public.payment_orders
  where provider = 'shopier'
    and status in ('awaiting_payment', 'pending')
)
update public.payment_orders as payment_order
set
  status = 'cancelled',
  updated_at = now()
from ranked_open_shopier_orders as ranked
where payment_order.id = ranked.id
  and ranked.position > 1;

create unique index if not exists payment_orders_one_open_shopier_checkout
  on public.payment_orders(profile_id, plan_id, provider)
  where provider = 'shopier'
    and status in ('awaiting_payment', 'pending');
