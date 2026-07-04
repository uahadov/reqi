-- ============================================================
-- BOUTIQUE — 2 ay + 5 gün (təxminən 65 gün) sifariş avto-təmizləmə quraşdırması
-- Bu faylı Supabase SQL Editor-da işlədin.
--
-- Nə edir:
--   1. pg_cron extension-unu aktivləşdirir (Supabase Pro planında mövcuddur).
--   2. Hər gecə saat 03:00-da 65 gündən köhnə sifarişləri silən cron job yaradır.
--
-- DIQQƏT: Bu əməliyyat geri qaytarıla bilməz. 2 ay + 5 gündən köhnə sifarişlər
-- hər gecə avtomatik silinəcək.
-- ============================================================

-- pg_cron extension-unu aktivləşdir (Supabase Pro planında mövcuddur)
create extension if not exists pg_cron;

-- Köhnə job varsa sil (mövcud olmayanda xəta verməməsi üçün EXCEPTION ilə)
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup_old_orders_daily');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END;
$$;

-- Hər gecə saat 03:00-da cleanup_old_orders() çağır
select cron.schedule(
  'cleanup_old_orders_daily',
  '0 3 * * *',
  'select cleanup_old_orders();'
);
