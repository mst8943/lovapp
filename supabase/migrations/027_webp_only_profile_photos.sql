-- Enforce modern image storage for every new profile photo record. Existing
-- legacy rows remain readable until the health screen cleanup is completed.
alter table public.profile_photos drop constraint if exists profile_photos_webp_only;
alter table public.profile_photos add constraint profile_photos_webp_only
check (
  storage_path ~* '\.webp$'
  and (variants is null or not jsonb_path_exists(variants, '$.* ? (@ like_regex ".*\\.(jpe?g|png|heic|heif)$" flag "i")'))
) not valid;

