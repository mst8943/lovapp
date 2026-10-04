alter table public.swipes add column if not exists super_like_note text;
alter table public.swipes drop constraint if exists swipes_super_like_note_length;
alter table public.swipes add constraint swipes_super_like_note_length check (super_like_note is null or char_length(super_like_note) between 1 and 280);

create or replace function public.set_super_like_note(target_uuid uuid, note_text text)
returns boolean language plpgsql security definer set search_path=''
as $$
declare viewer uuid := public.current_profile_id(); cleaned text := nullif(btrim(note_text),'');
begin
  if viewer is null then raise exception 'profile_required'; end if;
  if cleaned is null or char_length(cleaned) > 280 then raise exception 'invalid_note'; end if;
  update public.swipes set super_like_note=cleaned
  where swiper_id=viewer and target_id=target_uuid and direction='super';
  if not found then raise exception 'super_like_required'; end if;
  return true;
end;
$$;
revoke all on function public.set_super_like_note(uuid,text) from public;
grant execute on function public.set_super_like_note(uuid,text) to authenticated;
