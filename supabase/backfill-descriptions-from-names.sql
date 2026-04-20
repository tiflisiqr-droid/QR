-- =============================================================================
-- Supabase → SQL Editor → Paste → Run
-- ცარიელ description_en / description_ka / description_ru ივსება იმავე ენის
-- name_*-ით, რომ მთავარ მენიუში ტექსტი გამოჩნდეს. შემდეგ Admin → Cuisine-დან
-- შეცვალე რეალური აღწერებით.
-- =============================================================================

UPDATE public.menu
SET
  description_en = trim(coalesce(name_en, ''))
WHERE trim(coalesce(description_en, '')) = ''
  AND trim(coalesce(name_en, '')) <> '';

UPDATE public.menu
SET
  description_ka = trim(coalesce(name_ka, ''))
WHERE trim(coalesce(description_ka, '')) = ''
  AND trim(coalesce(name_ka, '')) <> '';

UPDATE public.menu
SET
  description_ru = trim(coalesce(name_ru, ''))
WHERE trim(coalesce(description_ru, '')) = ''
  AND trim(coalesce(name_ru, '')) <> '';
