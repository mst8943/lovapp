insert into public.bot_persona_versions (
  profile_id, version_number, status, persona, provider, model,
  created_by, published_by, published_at
)
select
  persona.profile_id, 1, 'published', persona.persona, persona.provider, persona.model,
  persona.created_by, persona.created_by, coalesce(persona.updated_at, now())
from public.bot_personas persona
where not exists (
  select 1 from public.bot_persona_versions version
  where version.profile_id = persona.profile_id and version.status = 'published'
);
