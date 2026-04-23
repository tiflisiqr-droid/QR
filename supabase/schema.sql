-- =============================================================================
-- Tiflisi Digital Menu — Supabase SQL (სრული სქემა აპთან სინქში)
-- Dashboard → SQL → New query → Paste → Run (შეიძლება განმეორებით — idempotent)
-- ემთხვევა: src/supabaseMenu.js, tiflisi-menu.jsx (menu, menu_categories, seating, Storage)
-- (Copy of sql-editor-setup.sql — keep both in sync.)
-- =============================================================================

-- ── 1) public.menu — კერძები (uuid id, category_id → menu_categories.id)
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
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.menu add column if not exists sort_order integer not null default 0;

create index if not exists menu_category_id_idx on public.menu (category_id);
create index if not exists menu_created_at_idx on public.menu (created_at);
create index if not exists menu_category_sort_idx on public.menu (category_id, sort_order);

alter table public.menu enable row level security;

drop policy if exists "menu_select_anon" on public.menu;
drop policy if exists "menu_insert_anon" on public.menu;
drop policy if exists "menu_update_anon" on public.menu;
drop policy if exists "menu_delete_anon" on public.menu;

-- PostgREST იყენებს anon / authenticated როლებს — explicit TO + GRANT ქსელიდან INSERT-ისთვის
create policy "menu_select_anon"
  on public.menu for select
  to anon, authenticated
  using (true);

create policy "menu_insert_anon"
  on public.menu for insert
  to anon, authenticated
  with check (true);

create policy "menu_update_anon"
  on public.menu for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "menu_delete_anon"
  on public.menu for delete
  to anon, authenticated
  using (true);

-- ── 1a) public.menu_categories — Admin → Cuisine → Categories (sort_order = app `order`)
create table if not exists public.menu_categories (
  id integer primary key,
  name_en text not null default '',
  name_ka text not null default '',
  name_ru text not null default '',
  icon text not null default '◆',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists menu_categories_sort_order_idx on public.menu_categories (sort_order);

alter table public.menu_categories enable row level security;

drop policy if exists "menu_categories_select_anon" on public.menu_categories;
drop policy if exists "menu_categories_insert_anon" on public.menu_categories;
drop policy if exists "menu_categories_update_anon" on public.menu_categories;
drop policy if exists "menu_categories_delete_anon" on public.menu_categories;

create policy "menu_categories_select_anon"
  on public.menu_categories for select
  to anon, authenticated
  using (true);

create policy "menu_categories_insert_anon"
  on public.menu_categories for insert
  to anon, authenticated
  with check (true);

create policy "menu_categories_update_anon"
  on public.menu_categories for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "menu_categories_delete_anon"
  on public.menu_categories for delete
  to anon, authenticated
  using (true);

-- საწყისი კატეგორიები მხოლოდ ცარიელი ცხრილისას (არსებულ მონაცემებს არ წაშლის)
insert into public.menu_categories (id, name_en, name_ka, name_ru, icon, sort_order)
select v.id, v.name_en, v.name_ka, v.name_ru, v.icon, v.sort_order
from (
  values
    (1, 'Khinkali', 'ხინკალი', 'Хинкали', '◈', 1),
    (2, 'Khachapuri', 'ხაჭაპური', 'Хачапури', '◇', 2),
    (3, 'Grill & Josper', 'შამფური და ჯოსპერი', 'Мангал и джоспер', '◉', 3),
    (4, 'Salads', 'სალათები', 'Салаты', '◌', 4),
    (5, 'Desserts', 'დესერტები', 'Десерты', '◎', 5),
    (6, 'Cellar', 'სასმელები', 'Погреб', '◊', 6)
) as v(id, name_en, name_ka, name_ru, icon, sort_order)
where not exists (select 1 from public.menu_categories limit 1);

-- ── 1b) public.seating — მაგიდები / QR ?table=<uuid> (src/supabaseMenu.js)
create table if not exists public.seating (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  zone text not null default '',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists seating_sort_order_idx on public.seating (sort_order);
create index if not exists seating_created_at_idx on public.seating (created_at);

alter table public.seating enable row level security;

drop policy if exists "seating_select_anon" on public.seating;
drop policy if exists "seating_insert_anon" on public.seating;
drop policy if exists "seating_update_anon" on public.seating;
drop policy if exists "seating_delete_anon" on public.seating;

create policy "seating_select_anon"
  on public.seating for select
  to anon, authenticated
  using (true);

create policy "seating_insert_anon"
  on public.seating for insert
  to anon, authenticated
  with check (true);

create policy "seating_update_anon"
  on public.seating for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "seating_delete_anon"
  on public.seating for delete
  to anon, authenticated
  using (true);

insert into public.seating (name, zone, active, sort_order)
select v.name, v.zone, v.active, v.sort_order
from (
  values
    ('Table 01', 'Grand Hall', true, 1),
    ('Table 02', 'Grand Hall', true, 2),
    ('Salon Privé', 'VIP', true, 3),
    ('Terrace I', 'Terrace', true, 4),
    ('Terrace II', 'Terrace', false, 5),
    ('Wine Cellar', 'Private', true, 6)
) as v(name, zone, active, sort_order)
where not exists (select 1 from public.seating limit 1);

-- API როლებისთვის სქემა + ცხრილები (თუ პროექტში GRANT-ები აკლია)
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.menu to anon, authenticated;
grant select, insert, update, delete on table public.menu_categories to anon, authenticated;
grant select, insert, update, delete on table public.seating to anon, authenticated;

-- ── 2) Storage: bucket id უნდა იყოს menu-images (src/supabaseMenu.js const BUCKET)
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

-- ── 3) Storage RLS (storage.objects)
drop policy if exists "menu_images_read" on storage.objects;
drop policy if exists "menu_images_insert" on storage.objects;
drop policy if exists "menu_images_update" on storage.objects;
drop policy if exists "menu_images_delete" on storage.objects;

create policy "menu_images_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'menu-images');

create policy "menu_images_insert"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'menu-images');

create policy "menu_images_update"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'menu-images')
  with check (bucket_id = 'menu-images');

create policy "menu_images_delete"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'menu-images');

-- ── 4) (არასავალდებულო) Realtime — მაგიდების ცვლილება live რომ ჩანდეს ყველა კლიენტზე:
-- Dashboard → Database → Publications → supabase_realtime → public.seating ჩართე
-- ან SQL: alter publication supabase_realtime add table public.seating;

-- შემდეგი: Project Settings → API → URL + anon key → .env.local (VITE_SUPABASE_*)
