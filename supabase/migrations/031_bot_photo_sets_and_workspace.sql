-- Identity-safe bot photo sets and atomic profile photo organization.

create table if not exists public.bot_photo_sets (
  id uuid primary key default gen_random_uuid(),
  gender text not null check (gender in ('kadın', 'erkek')),
  age_band text not null check (age_band in ('18-24', '25-34', '35-44', '45+')),
  status text not null default 'available' check (status in ('available', 'assigning', 'assigned', 'archived')),
  assigned_profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.admin_users(user_id) on delete set null,
  created_at timestamptz not null default now(),
  assigned_at timestamptz,
  constraint assigned_photo_set_has_profile check (
    (status = 'available' and assigned_profile_id is null and assigned_at is null)
    or (status = 'assigning' and assigned_profile_id is not null and assigned_at is null)
    or (status in ('assigned', 'archived'))
  )
);

create table if not exists public.bot_photo_set_items (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.bot_photo_sets(id) on delete cascade,
  storage_path text not null unique,
  sort_order smallint not null check (sort_order between 0 and 5),
  width integer not null check (width between 1 and 12000),
  height integer not null check (height between 1 and 12000),
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  created_at timestamptz not null default now(),
  unique(set_id, sort_order)
);

alter table public.profile_photos
  add column if not exists source_set_id uuid references public.bot_photo_sets(id) on delete set null;

-- Photo ordering is rewritten as one transaction. Deferring this uniqueness
-- check lets rows cross positions without unsafe out-of-range placeholders.
alter table public.profile_photos drop constraint if exists profile_photos_profile_id_sort_order_key;
alter table public.profile_photos add constraint profile_photos_profile_id_sort_order_key
  unique(profile_id, sort_order) deferrable initially immediate;

create index if not exists bot_photo_sets_assignment_queue
  on public.bot_photo_sets(status, gender, age_band, created_at);
create index if not exists bot_photo_set_items_set_order
  on public.bot_photo_set_items(set_id, sort_order);
create index if not exists profile_photos_source_set
  on public.profile_photos(source_set_id) where source_set_id is not null;

alter table public.bot_photo_sets enable row level security;
alter table public.bot_photo_set_items enable row level security;

drop policy if exists "bot editors manage photo sets" on public.bot_photo_sets;
create policy "bot editors manage photo sets" on public.bot_photo_sets for all to authenticated
using (public.has_admin_role(array['owner','bot_editor']))
with check (public.has_admin_role(array['owner','bot_editor']));

drop policy if exists "bot editors manage photo set items" on public.bot_photo_set_items;
create policy "bot editors manage photo set items" on public.bot_photo_set_items for all to authenticated
using (public.has_admin_role(array['owner','bot_editor']))
with check (public.has_admin_role(array['owner','bot_editor']));

grant select, insert, update, delete on public.bot_photo_sets to authenticated;
grant select, insert, update, delete on public.bot_photo_set_items to authenticated;

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

  select id into locked_target from public.profiles where id = target_profile_id and kind = 'bot' for update;
  if locked_target is null then raise exception 'target_bot_not_found'; end if;
  if source_profile_id = target_profile_id then raise exception 'same_profile'; end if;

  -- Lock profiles in a deterministic order before counts and reordering.
  perform pg_advisory_xact_lock(hashtextextended(least(source_profile_id, target_profile_id)::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(greatest(source_profile_id, target_profile_id)::text, 0));

  select count(*) into source_count from public.profile_photos where profile_id = source_profile_id;
  select count(*) into target_count from public.profile_photos where profile_id = target_profile_id;
  if target_count >= 6 then raise exception 'photo_limit_reached'; end if;

  insert_position := greatest(0, least(coalesce(target_position, target_count), target_count));

  set constraints profile_photos_profile_id_sort_order_key deferred;
  update public.profile_photos set sort_order = sort_order + 1
    where profile_id = target_profile_id and sort_order >= insert_position;
  update public.profile_photos
    set profile_id = target_profile_id, sort_order = insert_position, is_primary = (target_count = 0)
    where id = moved_photo_id;

  with ordered as (
    select id, row_number() over(order by sort_order, created_at, id) - 1 as next_order
    from public.profile_photos where profile_id = source_profile_id
  )
  update public.profile_photos pp
    set sort_order = ordered.next_order,
        is_primary = case when source_primary then ordered.next_order = 0 else pp.is_primary end
  from ordered where pp.id = ordered.id;

  if source_count = 1 then
    update public.profiles set is_discoverable = false, updated_at = now() where id = source_profile_id;
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

create or replace function public.set_bot_primary_photo(photo_uuid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare target_profile uuid;
begin
  if not public.has_admin_role(array['owner','bot_editor']) then raise exception 'admin_required'; end if;
  select pp.profile_id into target_profile
  from public.profile_photos pp join public.profiles p on p.id = pp.profile_id and p.kind = 'bot'
  where pp.id = photo_uuid for update;
  if target_profile is null then raise exception 'photo_not_found'; end if;
  update public.profile_photos set is_primary = false where profile_id = target_profile and is_primary;
  update public.profile_photos set is_primary = true where id = photo_uuid;
end;
$$;

revoke all on function public.set_bot_primary_photo(uuid) from public;
grant execute on function public.set_bot_primary_photo(uuid) to authenticated;
