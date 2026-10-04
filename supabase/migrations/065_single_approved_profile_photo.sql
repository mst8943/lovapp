create or replace function public.finalize_onboarding()
returns void language plpgsql security definer set search_path=''
as $$
declare profile_uuid uuid;
begin
  profile_uuid:=public.current_profile_id();
  if profile_uuid is null then raise exception 'profile_required'; end if;
  perform 1 from public.profiles where id=profile_uuid and kind='human' for update;
  if not found then raise exception 'profile_required'; end if;
  if not exists (
    select 1 from public.profile_photos
    where profile_id=profile_uuid and processing_status='ready' and moderation_status='approved'
  ) then raise exception 'approved_photo_required'; end if;
  update public.profiles set onboarding_completed=true,is_discoverable=true,updated_at=now()
  where id=profile_uuid and kind='human';
end;
$$;

create or replace function public.prevent_last_approved_profile_photo_delete()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  -- Lock the parent so concurrent deletes cannot each remove the other's last photo.
  perform 1 from public.profiles
  where id=old.profile_id and kind='human' and onboarding_completed for update;
  if found and old.processing_status='ready' and old.moderation_status='approved'
    and not exists (
      select 1 from public.profile_photos
      where profile_id=old.profile_id and id<>old.id
        and processing_status='ready' and moderation_status='approved'
    ) then raise exception 'approved_photo_required'; end if;
  return old;
end;
$$;

create trigger prevent_last_approved_profile_photo_delete
before delete on public.profile_photos
for each row execute function public.prevent_last_approved_profile_photo_delete();
