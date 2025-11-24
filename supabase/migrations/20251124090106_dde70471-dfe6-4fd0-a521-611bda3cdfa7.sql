-- Ödev yükleme sistemi için tablo ve storage bucket oluşturma

-- Ödev dosyaları için storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('homework-files', 'homework-files', false)
ON CONFLICT (id) DO NOTHING;

-- Ödev gönderileri tablosu
CREATE TABLE IF NOT EXISTS public.homework_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  file_url text NOT NULL,
  file_type text NOT NULL,
  file_name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS aktif et
ALTER TABLE public.homework_submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Öğrenci sadece kendi ödevlerini görebilir/oluşturabilir
CREATE POLICY "student_view_own_homework"
ON public.homework_submissions
FOR SELECT
USING (auth.uid() = student_id);

CREATE POLICY "student_create_own_homework"
ON public.homework_submissions
FOR INSERT
WITH CHECK (auth.uid() = student_id);

-- RLS Policies - Öğretmen sadece kendi öğrencilerinin ödevlerini görebilir
CREATE POLICY "teacher_view_student_homework"
ON public.homework_submissions
FOR SELECT
USING (
  is_teacher(auth.uid()) AND 
  EXISTS (
    SELECT 1 FROM students 
    WHERE students.teacher_id = auth.uid() 
    AND students.student_id = homework_submissions.student_id
  )
);

-- RLS Policies - Admin tüm ödevleri görebilir
CREATE POLICY "admin_full_access_homework"
ON public.homework_submissions
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Storage policies - Öğrenci kendi klasörüne yükleyebilir
CREATE POLICY "student_upload_own_homework_files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'homework-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Storage policies - Öğrenci kendi dosyalarını görebilir
CREATE POLICY "student_view_own_homework_files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'homework-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Storage policies - Öğretmen öğrencilerinin dosyalarını görebilir
CREATE POLICY "teacher_view_student_homework_files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'homework-files' AND
  is_teacher(auth.uid()) AND
  EXISTS (
    SELECT 1 FROM students 
    WHERE students.teacher_id = auth.uid() 
    AND students.student_id::text = (storage.foldername(name))[1]
  )
);

-- Storage policies - Admin tüm dosyaları görebilir
CREATE POLICY "admin_view_all_homework_files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'homework-files' AND
  has_role(auth.uid(), 'admin'::app_role)
);

-- Updated_at trigger
CREATE TRIGGER update_homework_submissions_updated_at
BEFORE UPDATE ON public.homework_submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();