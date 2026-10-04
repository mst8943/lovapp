-- Durable, atomic API throttling for serverless route handlers.
create table if not exists public.api_rate_limit_buckets (
  scope text not null,
  subject_hash text not null,
  window_start timestamptz not null,
  hits integer not null default 1 check (hits > 0),
  expires_at timestamptz not null,
  primary key (scope, subject_hash, window_start)
);

create index if not exists api_rate_limit_buckets_expiry
  on public.api_rate_limit_buckets (expires_at);

alter table public.api_rate_limit_buckets enable row level security;
revoke all on public.api_rate_limit_buckets from anon, authenticated;

create or replace function public.consume_api_rate_limit(
  limit_scope text,
  limit_subject_hash text,
  max_hits integer,
  window_seconds integer
)
returns table(allowed boolean, remaining integer, retry_after integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  now_at timestamptz := clock_timestamp();
  bucket_start timestamptz;
  next_hits integer;
begin
  if limit_scope is null or length(limit_scope) not between 1 and 80
    or limit_subject_hash is null or length(limit_subject_hash) <> 64
    or max_hits not between 1 and 10000
    or window_seconds not between 1 and 86400 then
    raise exception 'invalid_rate_limit_arguments';
  end if;

  bucket_start := to_timestamp(
    floor(extract(epoch from now_at) / window_seconds) * window_seconds
  );

  insert into public.api_rate_limit_buckets(scope, subject_hash, window_start, hits, expires_at)
  values (limit_scope, limit_subject_hash, bucket_start, 1, bucket_start + make_interval(secs => window_seconds))
  on conflict (scope, subject_hash, window_start)
  do update set hits = public.api_rate_limit_buckets.hits + 1
  returning hits into next_hits;

  return query select
    next_hits <= max_hits,
    greatest(0, max_hits - next_hits),
    greatest(1, ceil(extract(epoch from (bucket_start + make_interval(secs => window_seconds) - now_at)))::integer);
end;
$$;

revoke all on function public.consume_api_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, text, integer, integer) to service_role;

