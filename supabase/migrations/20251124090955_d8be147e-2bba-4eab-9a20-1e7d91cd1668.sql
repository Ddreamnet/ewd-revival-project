-- ============================================================================
-- STORAGE INSERT POLICY GÜNCELLEMESİ
-- ============================================================================
-- Folder yapısı değiştiği için upload policy'sini güncelle

-- Eski policy'yi kaldır
DROP POLICY IF EXISTS "student_upload_own_homework_files" ON storage.objects;

-- Yeni policy: Kullanıcı kendi ID'si ile subfolder oluşturabilir
-- Folder yapısı: studentId/uploadedById/filename
-- Öğrenci: kendi studentId folder'ına, kendi userId subfolder'ına yükleyebilir
-- Öğretmen: öğrencinin studentId folder'ına, kendi teacherId subfolder'ına yükleyebilir
CREATE POLICY "user_upload_homework_files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'homework-files' AND
  (
    -- Kullanıcı kendi ID'si ile subfolder oluşturuyor
    auth.uid()::text = (storage.foldername(name))[2]
  )
);