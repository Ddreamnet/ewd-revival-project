-- ============================================================================
-- Denetim (19 Eylül) · önceki fazlardan kalan iki açık
-- ============================================================================
-- Canlı veritabanı, Supabase güvenlik denetçisi ve yayın listesi taranırken
-- çıktı. İkisi de sessiz: hata vermiyor, yalnızca olması gerekeni yapmıyor.
--
-- 1) free_lesson_slots YENİDEN KİLİTLENİYOR. 20260829120000 onu bilerek
--    API'den kaldırmıştı ("başka öğretmenin takvimini okur, PostgREST'ten
--    erişilememeli"). 20260917010000 imzasına bir parametre eklemek için
--    fonksiyonu DROP edip yeniden oluşturdu; REVOKE eski imzayla birlikte
--    gitti ve yeni fonksiyon PUBLIC'e açık doğdu — oturum açmamış biri bile
--    /rpc/free_lesson_slots ile bir öğretmenin dolu/boş saatlerini
--    yoklayabiliyordu. İstemci bunu doğrudan çağırmıyor; çağıranların hepsi
--    SECURITY DEFINER (sahibinin yetkisiyle çalışır), kilitten etkilenmez.
--    Ders: bir fonksiyonu DROP + CREATE eden her migration yetkilerini de
--    yeniden yazmalı.
--
-- 2) CANLI YAYINDA EKSİK İKİ TABLO. İstemci üç yerde realtime dinliyor:
--    bildirim zili (notifications), öğrenci paneli (lesson_instances) ve admin
--    zili (admin_notifications). Yayında yalnızca sonuncusu vardı; ilk ikisi
--    hiç eklenmemiş. Abonelik hata vermediği için fark edilmedi: öğrenci
--    ödev yükleyince öğretmenin zili, öğretmen dersi işleyince öğrencinin
--    paneli ancak sayfa yenilenince güncelleniyordu.

REVOKE EXECUTE ON FUNCTION public.free_lesson_slots(
  uuid, uuid, integer, date, time without time zone, boolean, uuid[], date, boolean)
  FROM public, anon, authenticated;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['notifications', 'lesson_instances'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
