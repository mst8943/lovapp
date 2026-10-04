create table if not exists public.brand_settings (
  id boolean primary key default true check (id),
  brand_name text not null default 'Lovask' check (char_length(brand_name) between 1 and 80),
  tagline text not null default 'Tesadüften fazlası' check (char_length(tagline) between 1 and 160),
  support_email text not null default 'destek@example.com' check (char_length(support_email) between 3 and 320),
  logo_url text not null default '/logo_l_extra_thick.png' check (char_length(logo_url) between 1 and 2048),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.brand_settings enable row level security;
insert into public.brand_settings (id) values (true) on conflict (id) do nothing;
