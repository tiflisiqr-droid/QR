-- =============================================================================
-- Menu category consistency fix (all groups)
-- Run in Supabase SQL Editor as ONE script.
--
-- What it does:
-- 1) Ensures canonical categories (ids 200..211) exist with correct names/order.
-- 2) Re-links menu rows from known legacy category ids/names to canonical ids.
-- 3) Removes only legacy categories that were explicitly mapped and are unused.
-- 4) Prints diagnostics at the end.
-- =============================================================================

begin;

-- Create/normalize canonical rows (no TEMP tables; safe in pooled sessions).
with desired_categories(id, name_en, name_ka, name_ru, icon, sort_order) as (
  values
    (200, 'Salads',           'სალათი',               'Салаты',            '◈',  1),
    (201, 'Cold appetizers',  'ცივი წასახემსებელი',   'Холодные закуски',  '◇',  2),
    (202, 'Hot appetizers',   'ცხელი წასახემსებელი',  'Горячие закуски',   '◉',  3),
    (203, 'Soups',            'წვნიანი',              'Супы',              '◌',  4),
    (204, 'Bakery',           'ცომეული',              'Выпечка',           '◎',  5),
    (205, 'Khinkali',         'ხინკალი',              'Хинкали',           '◊',  6),
    (206, 'Grill & Josper',   'შამფური და ჯოსპერი',   'Мангал и джоспер',  '▣',  7),
    (207, 'Pasta & risotto',  'პასტა/რიზოტო',         'Паста и ризотто',   '▤',  8),
    (208, 'Main courses',     'ცხელი კერძები',        'Горячие блюда',     '▥',  9),
    (209, 'Seafood',          'თევზეული',             'Морепродукты',      '▦', 10),
    (210, 'Side dishes',      'გარნირი',              'Гарниры',           '▧', 11),
    (211, 'Desserts',         'დესერტი',              'Десерты',           '▨', 12)
)
insert into public.menu_categories as mc (id, name_en, name_ka, name_ru, icon, sort_order)
select d.id, d.name_en, d.name_ka, d.name_ru, d.icon, d.sort_order
from desired_categories d
on conflict (id) do update
set
  name_en = excluded.name_en,
  name_ka = excluded.name_ka,
  name_ru = excluded.name_ru,
  icon = excluded.icon,
  sort_order = excluded.sort_order;

-- Re-link dishes to canonical categories.
with category_alias_map(alias_ka, target_id) as (
  values
    ('სალათები', 200),
    ('სალათი', 200),
    ('ცივი წასახემსებელი', 201),
    ('ცხელი წასახემსებელი', 202),
    ('წვნიანი', 203),
    ('ცომეული', 204),
    ('ხინკალი', 205),
    ('შამფური', 206),
    ('შამფური და ჯოსპერი', 206),
    ('პასტა/რიზოტო', 207),
    ('ცხელი კერძები', 208),
    ('თევზეული', 209),
    ('გარნირი', 210),
    ('დესერტი', 211),
    ('დესერტები', 211),
    ('სასმელები', 210)
),
legacy_to_canonical as (
  select mc.id as from_id, am.target_id as to_id
  from public.menu_categories mc
  join category_alias_map am
    on btrim(lower(mc.name_ka)) = btrim(lower(am.alias_ka))
  where mc.id <> am.target_id
)
update public.menu m
set category_id = map.to_id
from legacy_to_canonical map
where m.category_id = map.from_id;

-- Remove only mapped legacy categories that became unused.
with category_alias_map(alias_ka, target_id) as (
  values
    ('სალათები', 200),
    ('სალათი', 200),
    ('ცივი წასახემსებელი', 201),
    ('ცხელი წასახემსებელი', 202),
    ('წვნიანი', 203),
    ('ცომეული', 204),
    ('ხინკალი', 205),
    ('შამფური', 206),
    ('შამფური და ჯოსპერი', 206),
    ('პასტა/რიზოტო', 207),
    ('ცხელი კერძები', 208),
    ('თევზეული', 209),
    ('გარნირი', 210),
    ('დესერტი', 211),
    ('დესერტები', 211),
    ('სასმელები', 210)
),
legacy_to_canonical as (
  select mc.id as from_id, am.target_id as to_id
  from public.menu_categories mc
  join category_alias_map am
    on btrim(lower(mc.name_ka)) = btrim(lower(am.alias_ka))
  where mc.id <> am.target_id
)
delete from public.menu_categories mc
using legacy_to_canonical map
where mc.id = map.from_id
  and not exists (
    select 1
    from public.menu m
    where m.category_id = mc.id
  );

commit;

-- =============================================================================
-- Diagnostics (post-fix)
-- =============================================================================

-- Canonical category list and dish counts.
select
  mc.id,
  mc.name_ka,
  mc.name_en,
  mc.sort_order,
  count(m.id)::int as dishes
from public.menu_categories mc
left join public.menu m on m.category_id = mc.id
where mc.id between 200 and 211
group by mc.id, mc.name_ka, mc.name_en, mc.sort_order
order by mc.sort_order, mc.id;

-- Any menu rows with missing category reference (should be 0).
select count(*)::int as orphan_menu_rows
from public.menu m
left join public.menu_categories c on c.id = m.category_id
where c.id is null;

-- Any duplicate Georgian category names (should be 0 for canonical set).
select lower(btrim(name_ka)) as ka_name_norm, count(*)::int as cnt, array_agg(id order by id) as ids
from public.menu_categories
group by lower(btrim(name_ka))
having count(*) > 1
order by cnt desc, ka_name_norm;
