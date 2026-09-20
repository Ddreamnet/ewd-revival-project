-- ============================================================================
-- Senaryo testleri · 6/6 · Temizlik
-- ============================================================================
-- Kurguyu ve yardımcıları tamamen kaldırır. Gerçek veriye dokunmaz.

SELECT bolum,
       count(*) FILTER (WHERE gerceklesen = beklenen OR (beklenen = 'ok' AND gerceklesen = 'uyari')) AS gecti,
       count(*) FILTER (WHERE NOT (gerceklesen = beklenen OR (beklenen = 'ok' AND gerceklesen = 'uyari'))) AS kaldi,
       count(*) FILTER (WHERE gerceklesen = 'HAM ISTISNA') AS ham_istisna
  FROM public.zz_test_sonuc GROUP BY bolum ORDER BY bolum;

SELECT public.zz_yik();

DROP FUNCTION IF EXISTS public.zz_kur();
DROP FUNCTION IF EXISTS public.zz_yik();
DROP FUNCTION IF EXISTS public.zz_sifirla();
DROP FUNCTION IF EXISTS public.zz_admin_ol();
DROP FUNCTION IF EXISTS public.zz_kaydet(text, text, text, json, text);
DROP FUNCTION IF EXISTS public.zz_istisna(text, text, text, text);
DROP FUNCTION IF EXISTS public.zz_dogrula(text, text, text, text);
DROP FUNCTION IF EXISTS public.zz_ders(text, date, time);
DROP FUNCTION IF EXISTS public.zz_program(text);
DROP FUNCTION IF EXISTS public.zz_saat_ilerlet(uuid);
DROP FUNCTION IF EXISTS public.zz_dokum(uuid);
DROP FUNCTION IF EXISTS public.zz_dokum_ust(uuid);
DROP FUNCTION IF EXISTS public.zz_id(text);
DROP TABLE IF EXISTS public.zz_test_sonuc;

SELECT (SELECT count(*) FROM auth.users WHERE email LIKE 'zz-%') AS kalan_hesap,
       (SELECT count(*) FROM pg_proc WHERE proname LIKE 'zz\_%') AS kalan_islev,
       (SELECT string_agg(kod || '=' || adet, ', ' ORDER BY kod) FROM public.sistem_sagligi() WHERE adet > 0) AS saglik;
