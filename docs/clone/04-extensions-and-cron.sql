-- ============================================================================
-- ENGLISH WITH DILARA - EXTENSIONS VE CRON JOB
-- Bu SQL, 03-storage-setup.sql'den SONRA çalıştırılmalıdır
-- ============================================================================

-- ============================================================================
-- 1. EXTENSION'LARI AKTİFLEŞTİR
-- ============================================================================
-- NOT: Bu extension'lar Supabase Dashboard → Database → Extensions'dan
-- manuel olarak da aktifleştirilebilir

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================================================
-- 2. CRON JOB OLUŞTUR
-- ============================================================================
-- ÖNEMLİ: Aşağıdaki URL ve Authorization token'ı YENİ projenizin
-- bilgileriyle DEĞİŞTİRMENİZ GEREKİYOR!
--
-- Değiştirilecek yerler:
-- 1. url: 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/cleanup-lesson-overrides'
-- 2. Authorization Bearer: 'YOUR_ANON_KEY'
-- ============================================================================

/*
-- Günde bir kez (saat 01:00'de) expired lesson override'ları temizle
SELECT cron.schedule(
  'cleanup-lesson-overrides-daily',
  '0 1 * * *',
  $$
  SELECT net.http_post(
    url:='https://YOUR_PROJECT_ID.supabase.co/functions/v1/cleanup-lesson-overrides',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
*/

-- ============================================================================
-- ÖRNEK (Gerçek değerlerle):
-- Aşağıdaki değerleri kendi projenizinkilerle değiştirin:
-- - hwwpbtcgppzuscbvjkde → Yeni Project ID
-- - eyJhbGci... → Yeni Anon Key
-- ============================================================================

-- SELECT cron.schedule(
--   'cleanup-lesson-overrides-daily',
--   '0 1 * * *',
--   $$
--   SELECT net.http_post(
--     url:='https://hwwpbtcgppzuscbvjkde.supabase.co/functions/v1/cleanup-lesson-overrides',
--     headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}'::jsonb,
--     body:='{}'::jsonb
--   ) as request_id;
--   $$
-- );
