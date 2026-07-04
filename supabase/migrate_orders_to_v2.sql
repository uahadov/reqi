-- ============================================================
-- BOUTIQUE — orders cədvəlini yeni struktura köçürmə
-- Bu faylı Supabase SQL Editor-da işlədin.
--
-- Nə edir:
--   1. Köhnə orders məlumatlarını _orders_backup cədvəlinə köçürür.
--   2. Köhnə orders cədvəlini və asılı obyektləri (RLS, index) silir.
--   3. Yeni orders cədvəlini (product_code, qty, note, generated order_text) yaradır.
--   4. Köhnə məlumatları yeni struktura uyğun geri əlavə edir.
--   5. RLS siyasətlərini və icazələri bərpa edir.
--
-- DIQQƏT: Bu əməliyyat geri qaytarıla bilməz. Əvvəlcə Supabase UI-dən
-- orders cədvəlinin CSV/JSON export-unu almağı tövsiyə edirik.
-- ============================================================

-- 1. Köhnə məlumatları müvəqqəti cədvələ köçür
DROP TABLE IF EXISTS _orders_backup;
CREATE TABLE _orders_backup AS
SELECT * FROM orders;

-- 2. Köhnə orders cədvəlini və asılı obyektləri sil
DROP POLICY IF EXISTS "orders_select" ON orders;
DROP POLICY IF EXISTS "orders_insert_branch_own" ON orders;
DROP TABLE IF EXISTS orders;

-- 3. Yeni orders cədvəlini yarat
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES users(id) NOT NULL,
  branch_name text NOT NULL,
  brand text NOT NULL,
  product_code text NOT NULL,
  qty integer NOT NULL DEFAULT 0,
  note text DEFAULT NULL,
  order_text text GENERATED ALWAYS AS (
    product_code || ' — ' || qty ||
    CASE WHEN note IS NOT NULL AND note <> '' THEN ' (' || note || ')' ELSE '' END
  ) STORED,
  created_at timestamptz DEFAULT now(),
  deleted_at timestamptz DEFAULT NULL
);

CREATE INDEX idx_orders_branch_id ON orders(branch_id);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_deleted_at ON orders(deleted_at);

-- 4. Köhnə məlumatları yeni struktura uyğun geri əlavə et
--    Köhnə order_text-i product_code kimi saxlayırıq, qty=0, note=null.
INSERT INTO orders (id, branch_id, branch_name, brand, product_code, qty, note, created_at, deleted_at)
SELECT
  id,
  branch_id,
  branch_name,
  brand,
  COALESCE(NULLIF(order_text, ''), '—') AS product_code,
  0 AS qty,
  NULL AS note,
  created_at,
  deleted_at
FROM _orders_backup;

-- 5. RLS siyasətlərini bərpa et
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_select"
  ON orders FOR SELECT
  USING (
    (branch_id = auth_user_id() AND deleted_at IS NULL)
    OR (is_admin() AND deleted_at IS NULL)
  );

CREATE POLICY "orders_insert_branch_own"
  ON orders FOR INSERT
  WITH CHECK (
    branch_id = auth_user_id()
    AND is_branch()
  );

-- 6. İcazələri bərpa et
GRANT SELECT, INSERT ON orders TO anon, authenticated;

-- 7. Schema cache-i yenilə
NOTIFY pgrst, 'reload schema';

-- 8. (İstəyə bağlı) Müvəqqəti yedək cədvəli sil
-- DROP TABLE IF EXISTS _orders_backup;
