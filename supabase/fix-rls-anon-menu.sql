-- =============================================================================
-- როცა INSERT SQL Editor-ში მუშაობს, მაგრამ საიტიდან არა → anon + RLS / GRANT
-- Supabase → SQL → Run once
-- =============================================================================

alter table public.menu enable row level security;

drop policy if exists "menu_select_anon" on public.menu;
drop policy if exists "menu_insert_anon" on public.menu;
drop policy if exists "menu_update_anon" on public.menu;
drop policy if exists "menu_delete_anon" on public.menu;

-- ზუსტად anon + authenticated (PostgREST API როლები)
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

-- ცხრილზე უფლებები API როლებისთვის
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.menu to anon, authenticated;

-- (არასავალდებულო) ტესტი SQL-იდან წაშლა:
-- delete from public.menu where name_en = '__sql_test__';
