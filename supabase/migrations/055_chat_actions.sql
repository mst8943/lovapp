alter table public.messages add column if not exists reply_to_id uuid references public.messages(id) on delete set null;
alter table public.messages add column if not exists deleted_at timestamptz;

create table if not exists public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (emoji in ('❤️','😂','✨','👍','😮')),
  created_at timestamptz not null default now(),
  primary key (message_id, profile_id)
);
alter table public.message_reactions enable row level security;
revoke all on public.message_reactions from anon, authenticated;

create or replace function public.get_match_message_page_v2(match_uuid uuid,page_limit integer default 51,before_created_at timestamptz default null,before_message_id uuid default null)
returns table(id uuid,sender_id uuid,kind public.message_kind,body text,audio_path text,audio_duration_ms integer,audio_waveform smallint[],read_at timestamptz,created_at timestamptz,reply_to_id uuid,reply_body text,reply_kind public.message_kind,deleted_at timestamptz,reactions jsonb)
language sql stable security definer set search_path=''
as $$
  select page.id,page.sender_id,page.kind,page.body,page.audio_path,page.audio_duration_ms,page.audio_waveform,page.read_at,page.created_at,
    page.reply_to_id,reply.body,reply.kind,page.deleted_at,
    coalesce((select jsonb_agg(jsonb_build_object('emoji',r.emoji,'profileId',r.profile_id)) from public.message_reactions r where r.message_id=page.id),'[]'::jsonb)
  from (
    select m.id,m.sender_id,m.kind,m.body,m.audio_path,m.audio_duration_ms,m.audio_waveform,
      case when public.can_review_match(match_uuid) or public.has_active_noir() then m.read_at else null end read_at,
      m.created_at,m.reply_to_id,m.deleted_at
    from public.messages m where m.match_id=match_uuid and (public.in_match(match_uuid) or public.can_review_match(match_uuid))
      and (before_created_at is null or (m.created_at,m.id)<(before_created_at,coalesce(before_message_id,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
    order by m.created_at desc,m.id desc limit least(greatest(coalesce(page_limit,51),1),101)
  ) page
  left join public.messages reply on reply.id=page.reply_to_id and reply.match_id=match_uuid
  order by page.created_at,page.id;
$$;
revoke all on function public.get_match_message_page_v2(uuid,integer,timestamptz,uuid) from public;
grant execute on function public.get_match_message_page_v2(uuid,integer,timestamptz,uuid) to authenticated;

create table public.profile_voice_prompts (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  prompt text not null check (length(prompt) between 3 and 100),
  audio_path text not null,
  duration_ms integer not null check (duration_ms between 15000 and 30000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profile_voice_prompts enable row level security;
revoke all on public.profile_voice_prompts from anon, authenticated;
