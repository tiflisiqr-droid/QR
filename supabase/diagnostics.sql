-- =============================================================================
-- Supabase → SQL Editor — დიაგნოსტიკა (გაუშვი მთლიანად ან ბლოკ-ბლოკად)
-- შედეგები და ნებისმიერი ERROR ტექსტი ჩასვი აქ ჩატში.
-- =============================================================================

-- 1) ცხრილი არსებობს?
select to_regclass('public.menu') as menu_table;

-- 2) სვეტები (აპი ელის ამ სახელებს)
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'menu'
order by ordinal_position;

-- 3) RLS ჩართულია?
select relrowsecurity, relforcerowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'menu';

-- 4) პოლიტიკები public.menu-ზე (anon კლიენტი აქედან გადის)
select policyname, permissive, roles, cmd, qual::text as using_expr, with_check::text as with_check_expr
from pg_policies
where schemaname = 'public' and tablename = 'menu'
order by policyname;

-- 5) რამდენი ჩანაწერია + ბოლო 5
select count(*) as total_rows from public.menu;
select id, category_id, name_en, price, available, created_at
from public.menu
order by created_at desc
limit 5;

-- 6) Storage bucket (სურათის ატვირთვა)
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'menu-images';

-- 7) Storage policies (objects)
select policyname, cmd, qual::text as using_expr, with_check::text as with_check_expr
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and policyname like '%menu%'
order by policyname;

-- 8) ტესტი INSERT (SQL Editor ჩვეულებრივ postgres როლითაა — თუ მუშაობს, მაგრამ აპიდან არა → პრობლემა თითქმის ნამდვილად RLS + anon key-ზეა)
-- გაუშვი ცალკე; თუ გინდა ტესტის წაშლა: delete from public.menu where name_en = '__sql_editor_test__';
insert into public.menu (
  category_id, name_en, name_ka, name_ru,
  description_en, description_ka, description_ru,
  price, image_url, ingredients, badges, available, featured
) values (
  1, '__sql_editor_test__', '', '',
  'test', '', '',
  0.01, 'https://example.com/test.jpg', '{}', '{}', true, false
)
returning id, name_en, category_id;

-- (არასავალდებულო) ტესტის წაშლა:
-- delete from public.menu where name_en = '__sql_editor_test__';
