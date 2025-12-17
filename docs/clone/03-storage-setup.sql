-- ============================================================================
-- ENGLISH WITH DILARA - STORAGE BUCKET VE POLİTİKALARI
-- Bu SQL, 02-rls-policies.sql'den SONRA çalıştırılmalıdır
-- ============================================================================

-- ============================================================================
-- 1. STORAGE BUCKET'LARI OLUŞTUR
-- ============================================================================

-- Öğrenme kaynakları bucket'ı (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('learning-resources', 'learning-resources', true)
ON CONFLICT (id) DO NOTHING;

-- Ödev dosyaları bucket'ı (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('homework-files', 'homework-files', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. LEARNING-RESOURCES BUCKET POLİTİKALARI
-- ============================================================================

-- Herkes görüntüleyebilir (public bucket)
CREATE POLICY "Public can view learning-resources"
ON storage.objects
FOR SELECT
USING (bucket_id = 'learning-resources');

-- Admin yükleyebilir
CREATE POLICY "Admins can upload learning-resources"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'learning-resources' 
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Öğretmenler de yükleyebilir
CREATE POLICY "Teachers can upload learning-resources"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'learning-resources' 
  AND public.has_role(auth.uid(), 'teacher'::public.app_role)
);

-- Admin silebilir/güncelleyebilir
CREATE POLICY "Admins can manage learning-resources"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'learning-resources' 
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  bucket_id = 'learning-resources' 
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- ============================================================================
-- 3. HOMEWORK-FILES BUCKET POLİTİKALARI
-- ============================================================================

-- Öğrenci kendi dosyalarını görebilir
CREATE POLICY "Students can view own homework"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'homework-files' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Öğrenci kendi klasörüne yükleyebilir
CREATE POLICY "Students can upload own homework"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'homework-files' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Öğretmen öğrencilerinin dosyalarını görebilir
CREATE POLICY "Teachers can view student homework"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'homework-files' AND
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.teacher_id = auth.uid()
    AND s.student_id::text = (storage.foldername(name))[1]
  )
);

-- Öğretmen öğrencileri için yükleyebilir
CREATE POLICY "Teachers can upload student homework"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'homework-files' AND
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.teacher_id = auth.uid()
    AND s.student_id::text = (storage.foldername(name))[1]
  )
);

-- Kullanıcı kendi yüklediğini silebilir
CREATE POLICY "Users can delete own uploads"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'homework-files' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Admin tam erişim
CREATE POLICY "Admins full access homework files"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'homework-files' AND
  public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  bucket_id = 'homework-files' AND
  public.has_role(auth.uid(), 'admin'::public.app_role)
);
