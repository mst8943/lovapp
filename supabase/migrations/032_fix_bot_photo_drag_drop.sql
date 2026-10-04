-- Repair the first live version of bot photo movement. The original function
-- used temporary sort orders outside the profile_photos 0..8 check range.

alter table public.bot_photo_sets drop constraint if exists bot_photo_sets_status_check;
alter table public.bot_photo_sets add constraint bot_photo_sets_status_check
  check (status in ('available', 'assigning', 'assigned', 'archived'));

alter table public.bot_photo_sets drop constraint if exists assigned_photo_set_has_profile;
alter table public.bot_photo_sets add constraint assigned_photo_set_has_profile check (
  (status = 'available' and assigned_profile_id is null and assigned_at is null)
  or (status = 'assigning' and assigned_profile_id is not null and assigned_at is null)
  or (status in ('assigned', 'archived'))
);

alter table public.profile_photos drop constraint if exists profile_photos_profile_id_sort_order_key;
alter table public.profile_photos add constraint profile_photos_profile_id_sort_order_key
  unique(profile_id, sort_order) deferrable initially immediate;

create or replace function public.move_bot_photo(
  moved_photo_id uuid,
  target_profile_id uuid,
  target_position integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_profile_id uuid;
  source_primary boolean;
  source_count integer;
  target_count integer;
  insert_position integer;
  locked_target uuid;
begin
  if not public.has_admin_role(array['owner','bot_editor']) then
    raise exception 'admin_required';
  end if;

  select pp.profile_id, pp.is_primary into source_profile_id, source_primary
  from public.profile_photos pp
  join public.profiles p on p.id = pp.profile_id and p.kind = 'bot'
  where pp.id = moved_photo_id
  for update;
  if source_profile_id is null then raise exception 'photo_not_found'; end if;

  select id into locked_target
  from public.profiles
  where id = target_profile_id and kind = 'bot'
  for update;
  if locked_target is null then raise exception 'target_bot_not_found'; end if;
  if source_profile_id = target_profile_id then raise exception 'same_profile'; end if;

  perform pg_advisory_xact_lock(hashtextextended(least(source_profile_id, target_profile_id)::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(greatest(source_profile_id, target_profile_id)::text, 0));

  select count(*) into source_count from public.profile_photos where profile_id = source_profile_id;
  select count(*) into target_count from public.profile_photos where profile_id = target_profile_id;
  if target_count >= 6 then raise exception 'photo_limit_reached'; end if;

  insert_position := greatest(0, least(coalesce(target_position, target_count), target_count));
  set constraints profile_photos_profile_id_sort_order_key deferred;

  update public.profile_photos
  set sort_order = sort_order + 1
  where profile_id = target_profile_id and sort_order >= insert_position;

  update public.profile_photos
  set profile_id = target_profile_id,
      sort_order = insert_position,
      is_primary = (target_count = 0)
  where id = moved_photo_id;

  with ordered as (
    select id, row_number() over(order by sort_order, created_at, id) - 1 as next_order
    from public.profile_photos
    where profile_id = source_profile_id
  )
  update public.profile_photos pp
  set sort_order = ordered.next_order,
      is_primary = case when source_primary then ordered.next_order = 0 else pp.is_primary end
  from ordered
  where pp.id = ordered.id;

  if source_count = 1 then
    update public.profiles
    set is_discoverable = false, updated_at = now()
    where id = source_profile_id;
  end if;

  return jsonb_build_object(
    'photoId', moved_photo_id,
    'sourceProfileId', source_profile_id,
    'targetProfileId', target_profile_id,
    'sourceBecameEmpty', source_count = 1
  );
end;
$$;

revoke all on function public.move_bot_photo(uuid,uuid,integer) from public;
grant execute on function public.move_bot_photo(uuid,uuid,integer) to authenticated;
