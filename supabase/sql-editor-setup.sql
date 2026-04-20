-- =============================================================================
-- Tiflisi Digital Menu — Supabase SQL Editor (Run once, then refresh the app)
-- Dashboard → SQL → New query → Paste → Run
-- =============================================================================

-- 1) Menu table (matches src/supabaseMenu.js + tiflisi-menu.jsx)
create table if not exists public.menu (
  id uuid primary key default gen_random_uuid(),
  category_id integer not null,
  name_en text not null default '',
  name_ka text not null default '',
  name_ru text not null default '',
  description_en text not null default '',
  description_ka text not null default '',
  description_ru text not null default '',
  price numeric(12, 2) not null default 0,
  image_url text not null default '',
  ingredients text[] not null default '{}',
  badges text[] not null default '{}',
  available boolean not null default true,
  featured boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists menu_category_id_idx on public.menu (category_id);
create index if not exists menu_created_at_idx on public.menu (created_at);

alter table public.menu enable row level security;

drop policy if exists "menu_select_anon" on public.menu;
drop policy if exists "menu_insert_anon" on public.menu;
drop policy if exists "menu_update_anon" on public.menu;
drop policy if exists "menu_delete_anon" on public.menu;

-- Dev / restaurant LAN: anon key from the website can read/write.
-- Production: replace with auth.uid() checks + Supabase Auth for staff.
create policy "menu_select_anon" on public.menu for select using (true);
create policy "menu_insert_anon" on public.menu for insert with check (true);
create policy "menu_update_anon" on public.menu for update using (true) with check (true);
create policy "menu_delete_anon" on public.menu for delete using (true);

-- 2) Storage bucket for dish photos (bucket id must be: menu-images)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'menu-images',
  'menu-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 3) Storage RLS on storage.objects
drop policy if exists "menu_images_read" on storage.objects;
drop policy if exists "menu_images_insert" on storage.objects;
drop policy if exists "menu_images_update" on storage.objects;
drop policy if exists "menu_images_delete" on storage.objects;

create policy "menu_images_read"
  on storage.objects for select
  using (bucket_id = 'menu-images');

create policy "menu_images_insert"
  on storage.objects for insert
  with check (bucket_id = 'menu-images');

create policy "menu_images_update"
  on storage.objects for update
  using (bucket_id = 'menu-images')
  with check (bucket_id = 'menu-images');

create policy "menu_images_delete"
  on storage.objects for delete
  using (bucket_id = 'menu-images');

-- Done. Next: Project Settings → API → copy URL + anon key into your app .env.local
