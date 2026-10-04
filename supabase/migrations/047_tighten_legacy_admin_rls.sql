-- Legacy policies treated every admin role as an unrestricted data editor.
-- Admin routes use the service role after explicit RBAC; direct clients stay scoped.

drop policy if exists "users edit own profile" on public.profiles;
create policy "users edit own profile" on public.profiles for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "owners manage photos" on public.profile_photos;
create policy "owners manage photos" on public.profile_photos for all to authenticated
using (profile_id = public.current_profile_id())
with check (profile_id = public.current_profile_id());

drop policy if exists "owners manage intentions" on public.profile_intentions;
create policy "owners manage intentions" on public.profile_intentions for all to authenticated
using (profile_id = public.current_profile_id())
with check (profile_id = public.current_profile_id());

drop policy if exists "owners manage answers" on public.profile_answers;
create policy "owners manage answers" on public.profile_answers for all to authenticated
using (profile_id = public.current_profile_id())
with check (profile_id = public.current_profile_id());

drop policy if exists "users manage own swipes" on public.swipes;
create policy "users manage own swipes" on public.swipes for all to authenticated
using (swiper_id = public.current_profile_id())
with check (swiper_id = public.current_profile_id());

drop policy if exists "admins manage personas" on public.bot_personas;
create policy "bot roles manage personas" on public.bot_personas for all to authenticated
using (public.has_admin_role(array['owner','bot_editor']))
with check (public.has_admin_role(array['owner','bot_editor']));

create or replace function public.profile_is_visible(profile_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from public.profiles target
    where target.id = profile_uuid
      and (
        target.user_id = auth.uid()
        or public.has_admin_role(array['owner','moderator','support'])
        or (
          target.is_discoverable
          and not exists (
            select 1 from public.blocks b
            where (b.blocker_id = public.current_profile_id() and b.blocked_id = target.id)
               or (b.blocker_id = target.id and b.blocked_id = public.current_profile_id())
          )
        )
      )
  );
$$;
