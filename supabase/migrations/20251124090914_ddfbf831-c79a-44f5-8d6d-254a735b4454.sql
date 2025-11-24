-- ============================================================================
-- ÖDEV SİSTEMİ RLS POLİCY TEMİZLİĞİ VE YENİDEN YAPILANDIRMA
-- ============================================================================
-- Amaç: Sadece ödev yükleyen kullanıcı kendi ödevini düzenleyip silebilsin

-- 1. Eski yanlış policy'leri kaldır
DROP POLICY IF EXISTS "student_delete_own_homework" ON public.homework_submissions;
DROP POLICY IF EXISTS "student_update_own_homework" ON public.homework_submissions;
DROP POLICY IF EXISTS "teacher_delete_own_homework" ON public.homework_submissions;
DROP POLICY IF EXISTS "teacher_update_own_homework" ON public.homework_submissions;

-- 2. Yeni doğru policy'leri ekle - uploaded_by_user_id bazlı
-- Sadece yükleyen kişi kendi ödevini güncelleyebilir
CREATE POLICY "user_update_own_uploaded_homework"
ON public.homework_submissions
FOR UPDATE
USING (auth.uid() = uploaded_by_user_id)
WITH CHECK (auth.uid() = uploaded_by_user_id);

-- Sadece yükleyen kişi kendi ödevini silebilir
CREATE POLICY "user_delete_own_uploaded_homework"
ON public.homework_submissions
FOR DELETE
USING (auth.uid() = uploaded_by_user_id);

-- ============================================================================
-- STORAGE POLİCY TEMİZLİĞİ
-- ============================================================================
-- Mevcut yanlış storage policy'leri kaldır
DROP POLICY IF EXISTS "teacher_delete_student_homework_files" ON storage.objects;
DROP POLICY IF EXISTS "student_delete_own_homework_files" ON storage.objects;

-- Yeni storage policy: Sadece yükleyen kişi dosyayı silebilir
-- Folder yapısı: studentId/uploadedById/filename
-- (storage.foldername(name))[2] = uploaded_by_user_id
CREATE POLICY "user_delete_own_uploaded_files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'homework-files' AND
  auth.uid()::text = (storage.foldername(name))[2]
);