create or replace function public.profile_id_for_auth_email(lookup_email text)
returns uuid
language sql
security definer
set search_path = public, auth
stable
as $$
  select p.id
  from auth.users u
  join public.profiles p on p.user_id = u.id
  where lower(u.email) = lower(btrim(lookup_email))
    and p.kind = 'human'
    and p.deleted_at is null
  limit 1;
$$;

revoke all on function public.profile_id_for_auth_email(text) from public;
grant execute on function public.profile_id_for_auth_email(text) to service_role;
