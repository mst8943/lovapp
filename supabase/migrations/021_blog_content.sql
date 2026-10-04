-- SEO-ready editorial content and public blog cover storage.

do $$ begin
  create type public.blog_post_status as enum ('draft', 'published', 'archived');
exception when duplicate_object then null;
end $$;

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 10 and 120),
  excerpt text not null check (char_length(excerpt) between 50 and 320),
  content_markdown text not null check (char_length(content_markdown) between 200 and 60000),
  category text not null default 'İlişkiler' check (char_length(category) between 2 and 60),
  tags text[] not null default '{}',
  primary_keyword text check (primary_keyword is null or char_length(primary_keyword) between 2 and 100),
  seo_title text check (seo_title is null or char_length(seo_title) between 10 and 70),
  seo_description text check (seo_description is null or char_length(seo_description) between 50 and 170),
  cover_image_url text,
  cover_image_alt text check (cover_image_alt is null or char_length(cover_image_alt) between 5 and 180),
  author_name text not null default 'Lovask Editörleri' check (char_length(author_name) between 2 and 80),
  status public.blog_post_status not null default 'draft',
  published_at timestamptz,
  created_by uuid references public.admin_users(user_id),
  updated_by uuid references public.admin_users(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'published' or published_at is not null),
  check ((cover_image_url is null and cover_image_alt is null) or (cover_image_url is not null and cover_image_alt is not null))
);

create index if not exists blog_posts_public_timeline
  on public.blog_posts(status, published_at desc)
  where status = 'published';

alter table public.blog_posts enable row level security;

create policy "published blog posts are public"
on public.blog_posts for select to anon, authenticated
using (status = 'published' or public.has_admin_role(array['owner','bot_editor']));

create policy "editors manage blog posts"
on public.blog_posts for all to authenticated
using (public.has_admin_role(array['owner','bot_editor']))
with check (public.has_admin_role(array['owner','bot_editor']));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('blog-covers', 'blog-covers', true, 5242880, array['image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "public reads blog covers"
on storage.objects for select to anon, authenticated
using (bucket_id = 'blog-covers');

revoke insert, update, delete on public.blog_posts from anon, authenticated;

