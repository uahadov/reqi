-- ============================================================
-- BOUTIQUE — inventory cədvəli üçün mənfi sayı constraint-ini silmə
-- Bu faylı Supabase SQL Editor-da işlədin.
--
-- Nə edir:
--   1. inventory cədvəlindəki qty sütununa tətbiq olunmuş
--      `inventory_qty_nonneg` (və ya buna bənzər) check constraint-i silir.
--   2. Əgər belə bir constraint yoxdursa, xəta verməz (IF EXISTS).
--
-- DIQQƏT: Bu əməliyyatdan sonra inventory.qty mənfi dəyərlər də qəbul edəcək.
-- ============================================================

-- Mövcud check constraint-i sil (ad fərqli ola bilər)
ALTER TABLE inventory
DROP CONSTRAINT IF EXISTS inventory_qty_nonneg;

-- Bəzi hallarda constraint-in adı avtomatik generasiya olunmuş ola bilər,
-- ona görə qty sütununa aid bütün check constraint-ləri tapıb silək.
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'inventory'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%qty%'
      AND pg_get_constraintdef(oid) ILIKE '%>= 0%'
  LOOP
    EXECUTE format('ALTER TABLE inventory DROP CONSTRAINT %I', rec.conname);
  END LOOP;
END;
$$;

-- Schema cache-i yenilə
NOTIFY pgrst, 'reload schema';
