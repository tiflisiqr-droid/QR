-- =============================================================================
-- Tiflisi Digital Menu — Supabase SQL (სრული სქემა აპთან სინქში)
-- Dashboard → SQL → New query → Paste → Run (შეიძლება განმეორებით — idempotent)
-- ემთხვევა: src/supabaseMenu.js, tiflisi-menu.jsx (menu, menu_categories, seating, Storage)
-- (Copy of schema.sql — keep both in sync.)
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

alter table public.menu add column if not exists price_variants jsonb not null default '[]'::jsonb;

comment on column public.menu.price_variants is
  'Array of { id, label: {en,ka,ru}, price, amount?, unit? }. Empty [] = guest uses menu.price only.';

create index if not exists menu_category_id_idx on public.menu (category_id);
create index if not exists menu_created_at_idx on public.menu (created_at);
create index if not exists menu_category_sort_idx on public.menu (category_id, sort_order);

alter table public.menu enable row level security;

drop policy if exists "menu_select_anon" on public.menu;
drop policy if exists "menu_insert_anon" on public.menu;
drop policy if exists "menu_update_anon" on public.menu;
drop policy if exists "menu_delete_anon" on public.menu;

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

-- ── 1a) public.menu_categories
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

-- ── 1b) public.seating
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

-- service_alerts — სტუმარი → პერსონალი (სრული სქემა იხ. schema.sql §1c)
create table if not exists public.service_alerts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  type text not null check (type in ('waiter', 'bill', 'order')),
  table_id text not null default '',
  table_name text not null default '',
  table_zone text not null default '',
  message text not null default '',
  read boolean not null default false
);
create index if not exists service_alerts_created_at_idx on public.service_alerts (created_at desc);
alter table public.service_alerts enable row level security;
drop policy if exists "service_alerts_select_anon" on public.service_alerts;
drop policy if exists "service_alerts_insert_anon" on public.service_alerts;
drop policy if exists "service_alerts_update_anon" on public.service_alerts;
drop policy if exists "service_alerts_delete_anon" on public.service_alerts;
create policy "service_alerts_select_anon" on public.service_alerts for select to anon, authenticated using (true);
create policy "service_alerts_insert_anon" on public.service_alerts for insert to anon, authenticated with check (true);
create policy "service_alerts_update_anon" on public.service_alerts for update to anon, authenticated using (true) with check (true);
create policy "service_alerts_delete_anon" on public.service_alerts for delete to anon, authenticated using (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.menu to anon, authenticated;
grant select, insert, update, delete on table public.menu_categories to anon, authenticated;
grant select, insert, update, delete on table public.seating to anon, authenticated;
grant select, insert, update, delete on table public.service_alerts to anon, authenticated;

-- ── 2) Storage bucket menu-images
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

-- ── 3) Storage RLS
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

-- Done. Next: Project Settings → API → copy URL + anon key into your app .env.local
