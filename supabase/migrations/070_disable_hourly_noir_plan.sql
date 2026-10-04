-- Remove the short Noir plan from new purchases; keep past orders and entitlements.
update public.premium_plans
set is_active = false, updated_at = now()
where slug = 'noir-hourly' and is_active;
