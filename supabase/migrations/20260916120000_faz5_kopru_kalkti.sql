-- ============================================================================
-- Faz 5 (son adım) · Geçiş köprüsü kaldırıldı
-- ============================================================================
-- Deneme dersleri ders takvimine taşınırken, yayındaki eski arayüz hâlâ
-- `trial_lessons` tablosunu okuyup yazdığı için aynı adla bir görünüm ve bir
-- INSTEAD OF tetikleyicisi bırakılmıştı. Yeni arayüz 16 Eylül 2026'da canlıya
-- alındı ve derlenmiş pakette tabloya tek bir çağrı kalmadığı doğrulandı;
-- köprü artık bir şeyi ayakta tutmuyor.
--
-- Aynı sebeple iki yönlendirici de kalkıyor: rpc_complete_trial_lesson ve
-- rpc_undo_trial_lesson yalnızca normal ders yolunu çağıran birer kabuktu,
-- istemci artık doğrudan rpc_complete_lesson / rpc_undo_complete_lesson
-- kullanıyor (ikisi de türe göre dallanıyor).
--
-- trial_lessons_eski tablosu duruyor: taşımadan önceki hâlin donmuş kaydı.

DROP TRIGGER IF EXISTS trg_trial_lessons_kopru ON public.trial_lessons;
DROP VIEW IF EXISTS public.trial_lessons;
DROP FUNCTION IF EXISTS public.trial_lessons_kopru();

DROP FUNCTION IF EXISTS public.rpc_complete_trial_lesson(uuid, uuid);
DROP FUNCTION IF EXISTS public.rpc_undo_trial_lesson(uuid, uuid);
DROP FUNCTION IF EXISTS public.rpc_complete_trial_lesson_impl(uuid, uuid);
DROP FUNCTION IF EXISTS public.rpc_undo_trial_lesson_impl(uuid, uuid);
